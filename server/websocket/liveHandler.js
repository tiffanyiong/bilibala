import { Modality } from '@google/genai';
import { createAi } from '../services/geminiService.js';
import { buildSystemInstruction } from '../utils/helpers.js';
import { config } from '../config/env.js';

/**
 * Sets up WebSocket connection handler for Gemini Live sessions
 * @param {WebSocketServer} wss - The WebSocket server instance
 */
export function setupLiveWebSocket(wss) {
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
          if (!config.gemini.apiKey) {
            send({ type: 'error', error: 'Server missing GEMINI_API_KEY' });
            return closeWith(1011, 'server missing api key');
          }

          const ai = createAi();
          const systemInstruction = buildSystemInstruction(msg.payload || {});

          // Let the client know we're working (useful for debugging).
          send({ type: 'status', status: 'connecting' });

          session = await ai.live.connect({
            model: config.gemini.liveModel,
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
}
