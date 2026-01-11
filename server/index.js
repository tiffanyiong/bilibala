import dotenv from 'dotenv';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { GoogleGenAI, Modality, Type } from '@google/genai';

// Load env from server/.env (do not rely on project root .env).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

// --- FIX: Use 0.0.0.0 for production ---
// 127.0.0.1 only works if you are on the SAME machine (localhost).
// 0.0.0.0 allows connections from the outside world (required for deployment).
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3001);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL || 'gemini-2.5-flash-native-audio-preview-12-2025';
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION; // e.g. v1alpha

if (!GEMINI_API_KEY) {
  // Fail fast so we never run a server that can't fulfill requests.
  console.error('Missing GEMINI_API_KEY in server environment.');
}

function createAi() {
  return new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    httpOptions: GEMINI_API_VERSION ? { apiVersion: GEMINI_API_VERSION } : undefined,
  });
}

function buildSystemInstruction({
  videoTitle,
  summary,
  vocabulary,
  nativeLang,
  targetLang,
  level,
}) {
  const vocabListString = Array.isArray(vocabulary)
    ? vocabulary.map((v) => `- ${v.word}: ${v.definition}`).join('\n')
    : '';
  const safeTitle = String(videoTitle || '').replace(/`/g, "'");
  const safeSummary = String(summary || '').replace(/`/g, "'");

  return `
You are 'Bilibala', an energetic and proactive language coach.
User Native: ${nativeLang}. Learning: ${targetLang}. Level: ${level}.
Topic Video: "${safeTitle}".
Summary: "${safeSummary}"
Vocabulary:
${vocabListString}

GOAL: Help the user speak MORE.
1. Ask open-ended questions about the video topic.
2. If the user gives a one-word answer (e.g., "No", "Yes"), ALWAYS ask "Why?" or "Tell me more about that."
3. Keep your turns concise (under 20 seconds) so the user gets more speaking time.
4. Be encouraging but persistent. Don't let them get away with silence!

IMPORTANT: Start the conversation immediately by introducing yourself as Bilibala the coach, and asking a specific, engaging question directly related to the video content "${safeTitle}". Do not just say "Hello".
`.trim();
}

function extractLikelyJson(text) {
  if (!text) return null;
  let t = String(text).trim();
  // Strip ``` fences
  if (t.startsWith('```')) {
    t = t.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  }
  // Try to extract the largest JSON object in the string
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return t.slice(first, last + 1);
  }
  return t;
}

function safeJsonParse(text) {
  const candidate = extractLikelyJson(text);
  if (!candidate) throw new Error('Empty JSON');
  return JSON.parse(candidate);
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(
  cors({
    origin: true, // Allows any domain to connect (good for initial production test)
    credentials: true,
  }),
);

app.get('/healthz', (_req, res) => {
  // Useful log to see when load balancers check your app
  // console.log('[server] GET /healthz'); 
  res.json({ ok: true });
});

// REST: analyze video content (no API key in browser)
app.post('/api/analyze-video-content', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
    const { videoTitle, nativeLang, targetLang, level } = req.body || {};
    const ai = createAi();

    // Delegate to the same prompt/schema logic used previously, but on the server.
    const prompt = `
I have a YouTube video titled: "${videoTitle}".

The user is a native speaker of ${nativeLang} and is learning ${targetLang}.
Their proficiency level is ${level}.

IMPORTANT: If ${nativeLang} is the same as ${targetLang}, provide the exact same text for the 'translated' fields as the main fields.

Assume this is a story or lesson.
Perform three tasks:
1. Write a comprehensive summary (3-5 sentences) in ${targetLang}, and provide a translation in ${nativeLang}.
2. Create a detailed chronological outline (10-15 sections) covering the flow in ${targetLang}, providing translations for titles and descriptions in ${nativeLang}.
3. Identify 10-15 useful words/phrases/idioms. Provide definitions and context sentences in ${targetLang} with ${nativeLang} translations.

Return ONLY valid JSON (no markdown, no commentary) with keys: summary, translatedSummary, topics, vocabulary.
`.trim();

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            translatedSummary: { type: Type.STRING },
            topics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  translatedTitle: { type: Type.STRING },
                  description: { type: Type.STRING },
                  translatedDescription: { type: Type.STRING },
                },
                required: ['title', 'translatedTitle', 'description', 'translatedDescription'],
              },
            },
            vocabulary: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  definition: { type: Type.STRING },
                  translatedDefinition: { type: Type.STRING },
                  context: { type: Type.STRING },
                  translatedContext: { type: Type.STRING },
                },
                required: ['word', 'definition', 'translatedDefinition', 'context', 'translatedContext'],
              },
            },
          },
          required: ['summary', 'translatedSummary', 'topics', 'vocabulary'],
        },
      },
    });

    const data = safeJsonParse(response.text || '');
    res.json(data);
  } catch (err) {
    console.error('analyze-video-content failed', err);
    res.status(500).json({ error: 'Failed to analyze video content' });
  }
});

// REST: conversation hints
app.post('/api/conversation-hints', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
    const { lastAiQuestion, targetLang, level } = req.body || {};
    if (!lastAiQuestion) return res.json({ hints: [] });

    const ai = createAi();
    const prompt = `
The language tutor just asked the student: "${lastAiQuestion}".
The student is learning ${targetLang} at a ${level} proficiency level.

Provide 2 distinct natural sample answers the student could use to respond:
1. A short, direct response (1 simple sentence).
2. A longer, more detailed response (3-4 sentences) that offers a completely different perspective or opinion compared to the first option.

Ensure the vocabulary and sentence structure strictly match the student's level (${level}).

Return JSON: { "hints": ["Short answer string", "Longer different answer string"] }
`.trim();

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hints: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['hints'],
        },
      },
    });

    const data = safeJsonParse(response.text || '{"hints": []}');
    res.json({ hints: data.hints || [] });
  } catch (err) {
    console.error('conversation-hints failed', err);
    res.status(500).json({ hints: [] });
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/live' });

// Make listen errors actionable (e.g., port in use).
server.on('error', (err) => {
  console.error('HTTP server error:', err);
});
wss.on('error', (err) => {
  console.error('WebSocket server error:', err);
});

wss.on('connection', (ws) => {
  console.log('[server] WS /live connected');
  let session = null;
  let isClosed = false;
  let isStarting = false;
  const pendingAudio = [];
  let lastStartPayload = null;

  const send = (obj) => {
    if (ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify(obj));
  };

  const closeWith = (code, message) => {
    if (isClosed) return;
    isClosed = true;
    try {
      ws.close(code, message);
    } catch {}
  };

  ws.on('message', async (raw, isBinary) => {
    try {
      // Protocol:
      // - JSON text frames: {type:'start'|'stop'|'text', ...}
      // - Binary frames (Buffer/ArrayBuffer): raw PCM16LE audio @ 16kHz
      console.log('[server] WS message received', {
        isBinary: !!isBinary,
        type: typeof raw,
        bytes: typeof raw === 'string' ? raw.length : (raw?.length ?? raw?.byteLength ?? null),
      });

      if (isBinary) {
        const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
        // Client may send audio before session is fully connected; buffer briefly.
        if (!session) {
          if (isStarting) {
            pendingAudio.push(buf);
            if (pendingAudio.length > 50) pendingAudio.shift();
            return;
          }
          return send({ type: 'error', error: 'Need start payload before audio (no session). Click Start again after refresh.' });
        }
        // Send as base64 to Gemini SDK.
        session.sendRealtimeInput({
          audio: { data: buf.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
        });
        return;
      }

      const text = typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8');
      const msg = JSON.parse(text);
      console.log('[server] WS message', msg?.type);

      if (msg.type === 'start') {
        if (session || isStarting) {
          // Ignore duplicate start requests.
          send({ type: 'status', status: 'connected' });
          return;
        }
        console.log('[server] starting Gemini Live session');
        isStarting = true;
        lastStartPayload = msg.payload || null;
        console.log('[server] start payload received', {
          hasTitle: !!lastStartPayload?.videoTitle,
          hasSummary: !!lastStartPayload?.summary,
          vocabCount: Array.isArray(lastStartPayload?.vocabulary) ? lastStartPayload.vocabulary.length : 0,
          nativeLang: lastStartPayload?.nativeLang,
          targetLang: lastStartPayload?.targetLang,
          level: lastStartPayload?.level,
        });
        if (!GEMINI_API_KEY) {
          send({ type: 'error', error: 'Server missing GEMINI_API_KEY' });
          return closeWith(1011, 'server missing api key');
        }

        const ai = createAi();
        const systemInstruction = buildSystemInstruction(msg.payload || {});

        // Let the client know we're working (useful for debugging).
        send({ type: 'status', status: 'connecting' });

        session = await ai.live.connect({
          model: GEMINI_LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
            systemInstruction,
          },
          callbacks: {
            onopen: () => {
              console.log('[server] Gemini Live connected');
              send({ type: 'status', status: 'connected' });
            },
            onmessage: (m) => {
              // Don't spam huge logs; just mark receipt.
              if (m?.setupComplete) console.log('[server] Gemini setupComplete');
              // Only forward serializable parts (avoid class methods).
              send({
                type: 'live',
                setupComplete: m.setupComplete ?? null,
                serverContent: m.serverContent ?? null,
                toolCall: m.toolCall ?? null,
                toolCallCancellation: m.toolCallCancellation ?? null,
                usageMetadata: m.usageMetadata ?? null,
                goAway: m.goAway ?? null,
                sessionResumptionUpdate: m.sessionResumptionUpdate ?? null,
                voiceActivityDetectionSignal: m.voiceActivityDetectionSignal ?? null,
                text: m.text ?? null,
                data: m.data ?? null,
              });
            },
            onerror: (e) => {
              console.log('[server] Gemini Live error', e?.message || e);
              send({ type: 'error', error: e?.message || 'live error' });
            },
            onclose: (e) => {
              console.log('[server] Gemini Live closed', e?.code, e?.reason);
              send({ type: 'status', status: 'closed', code: e?.code, reason: e?.reason });
            },
          },
        });
        isStarting = false;

        // Flush any audio chunks that arrived while we were connecting.
        if (pendingAudio.length) {
          console.log('[server] flushing queued audio', pendingAudio.length);
          while (pendingAudio.length) {
            const chunk = pendingAudio.shift();
            try {
              session.sendRealtimeInput({
                audio: { data: chunk.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
              });
            } catch {}
          }
        }

        // Force an initial turn so the tutor starts immediately.
        try {
          session.sendClientContent({
            turns: [
              {
                role: 'user',
                parts: [{ text: 'Please introduce yourself and start the conversation immediately.' }],
              },
            ],
            turnComplete: true,
          });
        } catch (e) {
          console.warn('failed to send initial clientContent', e);
        }

        return;
      }

      if (!session) return send({ type: 'error', error: 'Live session not started yet' });

      if (msg.type === 'text') {
        const { text } = msg.payload || {};
        if (!text) return;
        session.sendClientContent({
          turns: [{ role: 'user', parts: [{ text }] }],
          turnComplete: true,
        });
        return;
      }

      if (msg.type === 'stop') {
        try {
          session.close();
        } catch {}
        session = null;
        return closeWith(1000, 'stopped');
      }
    } catch (err) {
      console.error('ws message error', err);
      send({ type: 'error', error: 'Invalid message' });
    }
  });

  ws.on('error', (e) => {
    console.log('[server] WS client error', e?.message || e);
  });

  ws.on('close', () => {
    console.log('[server] WS /live closed');
    isClosed = true;
    try {
      session?.close();
    } catch {}
    session = null;
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Bilibala server listening on http://${HOST}:${PORT}`);
  console.log(`(Allowed for 0.0.0.0: accepting external connections)`);
});