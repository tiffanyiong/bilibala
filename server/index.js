import { GoogleGenAI, Modality, Type } from '@google/genai';
import { Supadata } from '@supadata/js';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Innertube, UniversalCache } from 'youtubei.js';

// Load env from server/.env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3001);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-2.5-flash-native-audio-preview-12-2025';
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION;
const SUPADATA_API_KEY = process.env.SUPADATA_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('Missing GEMINI_API_KEY in server environment.');
}
if (!SUPADATA_API_KEY) {
  console.error('Missing SUPADATA_API_KEY in server environment.');
}

function createAi() {
  return new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    httpOptions: GEMINI_API_VERSION ? { apiVersion: GEMINI_API_VERSION } : undefined,
  });
}

function buildSystemInstruction({ videoTitle, summary, vocabulary, nativeLang, targetLang, level }) {
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
  if (t.startsWith('```')) {
    t = t.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  }
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
app.use(express.json({ limit: '50mb' }));
app.use(cors({ origin: true, credentials: true }));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

function extractVideoId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=))([\w-]{11})/);
  return match ? match[1] : null;
}

// --- HELPER: Fetch Transcript via Innertube (Fallback) ---
async function fetchTranscriptWithInnertube(videoId) {
  try {
      console.log(`[server] Fetching transcript fallback for ${videoId}...`);
      const yt = await Innertube.create({ cache: new UniversalCache(false) });
      const info = await yt.getInfo(videoId);
      
      const tracks = info.captions?.caption_tracks;
      if (!tracks || tracks.length === 0) return [];

      let selectedTrack = tracks.find(t => t.language_code === 'en');
      if (!selectedTrack) selectedTrack = tracks.find(t => t.language_code.startsWith('en'));
      if (!selectedTrack) selectedTrack = tracks[0];

      console.log(`[server] Fallback track: ${selectedTrack.name.text} (${selectedTrack.language_code})`);
      const transcriptData = await info.getTranscript(selectedTrack.base_url);

      if (transcriptData?.transcript?.content?.body?.initial_segments) {
          return transcriptData.transcript.content.body.initial_segments.map(seg => ({
              text: seg.snippet.text,
              duration: Number(seg.duration_ms),
              offset: Number(seg.start_ms)
          }));
      }
      return [];
  } catch (error) {
      console.warn(`[server] Innertube fallback failed: ${error.message}`);
      return [];
  }
}

// --- HELPER: Fetch Metadata & Transcript Context (Innertube + Supadata) ---
async function fetchVideoContext(videoId) {
  console.log(`[server] Fetching context for ${videoId}...`);
  try {
      // 1. Duration (Innertube)
      const yt = await Innertube.create({ cache: new UniversalCache(false) });
      const info = await yt.getInfo(videoId);
      const duration = info.basic_info.duration || 0;
      
      // 2. Transcript (Supadata)
      let transcriptText = '';
      let transcriptSegments = [];
      try {
          console.log('[server] Requesting transcript from Supadata...');
          const supadata = new Supadata({ apiKey: SUPADATA_API_KEY });
          const result = await supadata.transcript({
              url: `https://www.youtube.com/watch?v=${videoId}`,
              text: false, // Must be false to get segments/timestamps for the UI
              mode: 'native' // Request existing transcript for immediate response (HTTP 200)
          });

          let content = null;
          if (result.jobId) {
              console.log(`[server] Supadata job started: ${result.jobId}`);
              let status = 'queued';
              let attempts = 0;
              while (status !== 'completed' && status !== 'failed' && attempts < 30) {
                  await new Promise(r => setTimeout(r, 1000));
                  const job = await supadata.transcript.getJobStatus(result.jobId);
                  status = job.status;
                  if (status === 'completed') {
                      content = job.content;
                  } else if (status === 'failed') {
                      console.error(`[server] Supadata job failed: ${job.error}`);
                  }
                  attempts++;
              }
          } else {
              content = (result.content !== undefined) ? result.content : result;
          }

          if (Array.isArray(content)) {
              // 1. Normalize Supadata segments (offset is ms, duration is ms)
              const rawSegments = content.map(s => ({
                  text: s.text,
                  offset: (typeof s.offset === 'number') ? s.offset : ((s.start || 0) * 1000),
                  duration: (typeof s.duration === 'number') ? s.duration : ((s.end - s.start) * 1000)
              }));

              // 2. Merge into sentence-like chunks
              const merged = [];
              let buffer = null;

              for (const seg of rawSegments) {
                  if (!buffer) {
                      buffer = { ...seg };
                      continue;
                  }

                  const gap = seg.offset - (buffer.offset + buffer.duration);
                  const text = buffer.text.trim();
                  const hasPunctuation = /[.!?]$/.test(text);
                  const isLong = text.length > 60; 
                  const isTooLong = text.length > 200;
                  const isBigGap = gap > 1500;

                  if ((hasPunctuation && isLong) || isTooLong || isBigGap) {
                      merged.push(buffer);
                      buffer = { ...seg };
                  } else {
                      buffer.text += ' ' + seg.text;
                      buffer.duration = (seg.offset + seg.duration) - buffer.offset;
                  }
              }
              if (buffer) merged.push(buffer);

              transcriptSegments = merged;
              transcriptText = transcriptSegments.map(s => s.text).join(' ');
          } else if (typeof content === 'string') {
              transcriptText = content;
          }
          
          console.log(`[server] Supadata transcript received. Segments: ${transcriptSegments.length}`);
      } catch (e) {
          console.warn(`[server] Supadata failed: ${e.message}`);
      }

      // FALLBACK: If Supadata failed or returned no segments, try Innertube
      if (transcriptSegments.length === 0) {
          transcriptSegments = await fetchTranscriptWithInnertube(videoId);
          if (transcriptSegments.length > 0) {
              transcriptText = transcriptSegments.map(s => s.text).join(' ');
              console.log(`[server] Fallback transcript received. Segments: ${transcriptSegments.length}`);
          }
      }

      return { duration, transcriptText, transcriptSegments };
  } catch (e) {
      console.warn(`[server] Context fetch failed: ${e.message}`);
      return { duration: 0, transcriptText: '', transcriptSegments: [] };
  }
}

// REST: analyze video content
app.post('/api/analyze-video-content', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
    const { videoTitle, videoUrl, nativeLang, targetLang, level } = req.body || {};
    const ai = createAi();

    const videoId = videoUrl ? extractVideoId(videoUrl) : null;
    console.log(`[server] Analyzing video content for: ${videoTitle} (${videoId}) using Gemini 3`);

    // Fetch context (Duration + Transcript if possible) to fix timestamps
    let contextData = { duration: 0, transcriptText: '' };
    if (videoId) {
        contextData = await fetchVideoContext(videoId);
    }

    // Dynamic topic count based on duration (approx 1 topic per 3 mins, min 3, max 15)
    const durationMin = contextData.duration ? contextData.duration / 60 : 10;
    const targetTopicCount = Math.max(3, Math.min(15, Math.ceil(durationMin / 3)));

    const prompt = `
    You are an expert Linguistic Content Generator for a language learning app.
    Your task is to analyze a YouTube video transcript and generate learning materials tailored to a specific proficiency level.

    # Context
    - **Video Title:** "${videoTitle}"
    - **Target Level:** ${level.toUpperCase()}
    - **User's Native Language:** ${nativeLang}
    - **Target Language:** ${targetLang}
    - **Video Duration:** ${contextData.duration ? `${Math.floor(contextData.duration/60)} minutes ${contextData.duration%60} seconds` : 'Unknown'}

    # CRITICAL CONSTRAINT: SOURCE OF TRUTH
    - You must ONLY select vocabulary words that **explicitly appear** in the provided transcript.
    - **DO NOT** generate related words that are not spoken in the video.
    - For the "context_sentence", you must extract the **exact sentence** from the transcript where the word is used.

    # Level-Specific Instructions (CRITICAL)

    ### IF LEVEL IS "EASY" (Beginner):
    - **Vocabulary:** Extract **High-Frequency / Basic words** (CEFR A1/A2) from the video. Focus on concrete nouns and verbs.
    - **Summary:** Write simple, short sentences focusing on the main plot/idea.
    - **Practice Topics:** Generate questions about **personal preferences** or **simple descriptions** (e.g., "Do you like...?", "What is...?").
    - **Outline:** Keep it very brief (3-5 key moments).

    ### IF LEVEL IS "MEDIUM" (Intermediate):
    - **Vocabulary:** Extract **Collocations, Phrasal Verbs, and Idioms** (CEFR B1/B2) from the video. (e.g., instead of "rain", extract "heavy rain").
    - **Summary:** Write in a narrative style, focusing on the flow of the story.
    - **Practice Topics:** Generate questions about **storytelling** or **experiences** (e.g., "Describe a time when...", "Why did the speaker...?").
    - **Outline:** Moderate detail (5-8 sections).

    ### IF LEVEL IS "HARD" (Advanced):
    - **Vocabulary:** Extract **Nuanced, Abstract, or Professional words** (CEFR C1/C2) from the video. Focus on specific terminology or emotional nuance.
    - **Summary:** Write an analytical summary focusing on arguments and underlying themes.
    - **Practice Topics:** Generate **Debate / Critical Thinking** questions (e.g., "What is your stance on...?", "Critique the speaker's argument.").
    - **Outline:** Detailed logic flow (8-10 sections).

    # Task Requirements

    1.  **Summary:** Write a summary in ${targetLang} based on the level rules above. Provide a full translation in ${nativeLang}.
    2.  **Vocabulary:** Identify 8-10 key items based on the level rules. For each, provide:
        - Definition (in ${targetLang})
        - Context Sentence (Direct quote or adapted from video)
        - Translation of the word itself (in ${nativeLang})
        - Translation of the definition (in ${nativeLang})
        - Translation of the context sentence (in ${nativeLang})
    3.  **Practice Topics (Mission Data):** Generate ${targetTopicCount} specific discussion cards. For EACH card, you must provide:
        - **Topic Name:** A short tag (e.g., "Work-Life Balance")
        - **Question:** A specific question for the user to answer.
        - **Target Words:** Select 3 words (from the video or relevant to the topic) that the user MUST try to use in their answer.
    4.  **Outline:** A chronological breakdown with timestamps. TIMESTAMPS MUST BE ACCURATE and within the video duration (${contextData.duration}s).

    # Output Format
    Return ONLY valid JSON with this structure:
    {
      "summary": {
        "target_text": "...",
        "native_text": "..."
      },
      "vocabulary": [
        {
          "word": "...",
          "word_translation": "...",
          "definition": "...",
          "context_sentence": "...",
          "definition_translation": "...",
          "native_context_translation": "..."
        }
      ],
      "practice_topics": [
        {
          "topic_name": "...",
          "question": "...",
          "suggested_target_words": ["word1", "word2", "word3"]
        }
      ],
      "outline": [
        {
          "time": "MM:SS",
          "title": "...",
          "description": "..."
        }
      ]
    }

    # Input Transcript
    ${contextData.transcriptText ? contextData.transcriptText.slice(0, 50000) : ''}
    `.trim();

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
                type: Type.OBJECT,
                properties: {
                    target_text: { type: Type.STRING },
                    native_text: { type: Type.STRING }
                },
                required: ['target_text', 'native_text']
            },
            vocabulary: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  word_translation: { type: Type.STRING },
                  definition: { type: Type.STRING },
                  context_sentence: { type: Type.STRING },
                  definition_translation: { type: Type.STRING },
                  native_context_translation: { type: Type.STRING },
                },
                required: ['word', 'word_translation', 'definition', 'context_sentence', 'definition_translation', 'native_context_translation'],
              },
            },
            practice_topics: {
              type: Type.ARRAY,
              items: { 
                  type: Type.OBJECT,
                  properties: {
                      topic_name: { type: Type.STRING },
                      question: { type: Type.STRING },
                      suggested_target_words: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ['topic_name', 'question', 'suggested_target_words']
              }
            },
            outline: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        time: { type: Type.STRING },
                        title: { type: Type.STRING },
                        description: { type: Type.STRING }
                    },
                    required: ['time', 'title', 'description']
                }
            }
          },
          required: ['summary', 'vocabulary', 'practice_topics', 'outline'],
        },
      },
    });

    // Robust response handling
    let candidates = response.candidates;
    if (!candidates && response.data) candidates = response.data.candidates;
    
    if (!candidates || !candidates[0] || !candidates[0].content || !candidates[0].content.parts) {
        console.error('[server] Gemini response missing candidates:', JSON.stringify(response, null, 2));
        throw new Error('Gemini response missing candidates');
    }

    const json = safeJsonParse(candidates[0].content.parts[0].text);
    
    // Map new structure to old frontend structure to avoid breaking changes
    const mappedResponse = {
        summary: json.summary?.target_text || '',
        translatedSummary: json.summary?.native_text || '',
        topics: (json.outline || []).map(o => ({
            title: o.title,
            translatedTitle: "", 
            description: o.description,
            translatedDescription: "", 
            timestamp: o.time
        })),
        vocabulary: (json.vocabulary || []).map(v => ({
            word: v.word,
            translatedWord: v.word_translation,
            definition: v.definition,
            translatedDefinition: v.definition_translation,
            context: v.context_sentence,
            translatedContext: v.native_context_translation
        })),
        discussionTopics: (json.practice_topics || []).map(t => ({
            topic: t.topic_name,
            question: t.question,
            targetWords: t.suggested_target_words || []
        })),
        transcript: contextData.transcriptSegments || []
    };

    res.json(mappedResponse);
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

    // Robust response handling
    let candidates = response.candidates;
    if (!candidates && response.data) candidates = response.data.candidates;

    if (!candidates || !candidates[0] || !candidates[0].content || !candidates[0].content.parts) {
        console.error('[server] Gemini hints response missing candidates:', JSON.stringify(response, null, 2));
        throw new Error('Gemini hints response missing candidates');
    }

    const data = safeJsonParse(candidates[0].content.parts[0].text);
    res.json({ hints: data.hints || [] });
  } catch (err) {
    console.error('conversation-hints failed', err);
    res.status(500).json({ hints: [] });
  }
});

// REST: analyze speech (Multi-Framework + Recursive Depth + Mirror Logic)
app.post('/api/analyze-speech', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
    const { audioData, topic, question, level } = req.body || {};
    
    if (!audioData) return res.status(400).json({ error: 'No audio data provided' });

    const ai = createAi();
    
    // NOTE: Using single quotes for 'sub_points' inside the prompt to avoid JS template literal errors.
    const prompt = `
      You are an expert Communication Coach.
      Your goal is to compare the User's ACTUAL speech (The Mirror) vs. an OPTIMAL version (The Architect).

      # Context
      - **Topic:** "${topic}"
      - **Question:** "${question}"
      - **User Level:** ${level}

      # FRAMEWORK DEFINITIONS
      1. **MINTO (Logical):** Conclusion -> Arguments -> Evidence. (Best for: Debates, Analysis)
      2. **STAR (Behavioral):** Situation -> Task -> Action -> Result. (Best for: "Tell me a time when...", Stories)
      3. **PREP (Impromptu):** Point -> Reason -> Example -> Point. (Best for: Short answers, Simple opinions)
      4. **GOLDEN CIRCLE (Vision):** Why (Values) -> How (Process) -> What (Result). (Best for: Self-Intro, "Why do you want this job?")
      5. **W-S-N (Reflection):** What? (Facts) -> So What? (Insights) -> Now What? (Actions). (Best for: "What did you learn?", Summaries)

      # TASK 1: THE MIRROR (Analyze User's "My Logic")
      **GOAL:** Reflect the user's speech EXACTLY as they spoke it.
      
      **CRITICAL RULES FOR "MY LOGIC":**
      1. **STRICT FIRST-PERSON ("I"):** You MUST use "I" / "My" to represent the user. NEVER use "She", "He", or "The speaker".
      2. **CHRONOLOGICAL MAPPING:** Map the nodes in the **exact order** the user mentioned them.
      3. **DETECT FRAMEWORK:** Analyze the user's attempt. Did they try to tell a story (STAR)? Did they try to make a point (PREP)?
      4. **NARRATIVE DEPTH (Vertical Nesting):** - If the user describes a sequence where A led to B led to C, **DO NOT** list them as sibling arguments.
         - **NEST THEM** using 'sub_points'.
         - Example: "I felt stressed" (Parent) -> "So I called a friend" (Sub-point) -> "She helped me" (Sub-point).

      # TASK 2: THE ARCHITECT (Generate "AI Improved")
      **GOAL:** Reorganize the user's raw thoughts into the **BEST SUITED** framework for this specific Question.
      
      **ACTIONS BY FRAMEWORK:**

      ### A. FOR NARRATIVES (STAR):
      - **Structure:** Vertical Chain (Tree Trunk).
      - **Rules:**
        - Create **ONE** main "Situation" node.
        - Nest "Task" inside Situation.
        - Nest "Action" inside Task.
        - Nest "Result" inside Action.
      - **Goal:** clearly show the sequence of events.

      ### B. FOR LOGIC & DEBATE (MINTO / PREP):
      - **Structure:** Horizontal Hierarchy (Pyramid).
      - **Rules:**
        - Create distinct Top-Level Arguments (MECE).
        - **Do NOT** nest distinct reasons inside each other. They are siblings.
        - Nest 'Evidence' or 'Examples' inside their respective Argument.
      
      ### C. FOR VISION & INTRO (GOLDEN CIRCLE):
      - **Structure:** Vertical Concentric.
      - **Rules:**
        - Main Node: "Why" (Purpose/Belief).
        - Sub_point: "How" (Process/Strengths).
        - Sub_point: "What" (Role/Outcome).

      ### D. FOR REFLECTION (W-S-N):
      - **Structure:** Vertical Chain.
      - **Rules:**
        - Main Node: "What?" (Observation).
        - Sub_point: "So What?" (Insight).
        - Sub_point: "Now What?" (Action).

      # TASK 3: COACHING FEEDBACK
      - **Gap Analysis:** "You used Minto, but for a story, STAR is better."
      - **Specific Critique:** "You started with 'Action' but forgot the 'Result'. Add the outcome."

      # Output Requirements
      Generate a JSON response:
      - **NO EMPTY STRINGS**: Ensure all fields contain actual text.
      
      Format:
      {
        "transcription": "...",
        "detected_framework": "...",
        "structure": {
          "conclusion": "...",
          "arguments": [
            {
              "point": "...",
              "status": "strong",
              "type": "story",
              "sub_points": [ ...nested arguments... ],
              "evidence": ["..."],
              "critique": "..."
            }
          ]
        },
        "improved_structure": {
          "recommended_framework": "...",
          "conclusion": "...",
          "arguments": [
            {
              "headline": "...",
              "elaboration": "...",
              "sub_points": [ ...nested arguments... ],
              "type": "story",
              "evidence": ["..."]
            }
          ]
        },
        // ... feedback ...
      }
    `.trim();

    // Reusable Schema Definition for Recursive Nodes
    const argumentSchemaProperties = {
        point: { type: Type.STRING },
        status: { type: Type.STRING, enum: ["strong", "weak", "irrelevant", "missing"] },
        type: { type: Type.STRING, enum: ["fact", "story", "opinion"] },
        evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
        critique: { type: Type.STRING },
        // RECURSION: Add sub_points here
        sub_points: { 
            type: Type.ARRAY, 
            items: { 
                type: Type.OBJECT,
                properties: {
                    point: { type: Type.STRING },
                    status: { type: Type.STRING },
                    type: { type: Type.STRING },
                    evidence: { type: Type.ARRAY, items: { type: Type.STRING } }
                } 
            } 
        }
    };

    const improvedArgumentSchemaProperties = {
        headline: { type: Type.STRING },
        elaboration: { type: Type.STRING },
        type: { type: Type.STRING, enum: ["fact", "story", "opinion"] },
        evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
        // RECURSION: Add sub_points here
        sub_points: { 
            type: Type.ARRAY, 
            items: { 
                 type: Type.OBJECT,
                 properties: {
                    headline: { type: Type.STRING },
                    elaboration: { type: Type.STRING },
                    type: { type: Type.STRING },
                    evidence: { type: Type.ARRAY, items: { type: Type.STRING } }
                 }
            } 
        }
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // UPDATED to Gemini 3
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'audio/mp3', data: audioData } }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcription: { type: Type.STRING },
            detected_framework: { type: Type.STRING, enum: ["MINTO", "STAR", "PREP", "GOLDEN_CIRCLE", "WSN"] },
            structure: {
              type: Type.OBJECT,
              properties: {
                conclusion: { type: Type.STRING },
                arguments: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: argumentSchemaProperties,
                    required: ['point', 'status', 'type', 'evidence']
                  }
                }
              },
              required: ['conclusion', 'arguments']
            },
            improved_structure: {
              type: Type.OBJECT,
              properties: {
                recommended_framework: { type: Type.STRING, enum: ["MINTO", "STAR", "PREP", "GOLDEN_CIRCLE", "WSN"] },
                conclusion: { type: Type.STRING },
                arguments: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: improvedArgumentSchemaProperties,
                    required: ['headline', 'elaboration', 'type', 'evidence']
                  }
                }
              },
              required: ['recommended_framework', 'conclusion', 'arguments']
            },
            feedback: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ['score', 'strengths', 'weaknesses', 'suggestions']
            },
            improvements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  original: { type: Type.STRING },
                  improved: { type: Type.STRING },
                  explanation: { type: Type.STRING }
                },
                required: ['original', 'improved', 'explanation']
              }
            }
          },
          required: ['transcription', 'detected_framework', 'structure', 'improved_structure', 'feedback', 'improvements']
        }
      }
    });

    let candidates = response.candidates;
    if (!candidates && response.data) candidates = response.data.candidates;
    
    if (!candidates || !candidates[0] || !candidates[0].content || !candidates[0].content.parts) {
        throw new Error('Gemini response missing candidates');
    }

    const json = safeJsonParse(candidates[0].content.parts[0].text);
    res.json(json);

  } catch (err) {
    console.error('analyze-speech failed', err);
    res.status(500).json({ error: 'Failed to analyze speech' });
  }
});
// ------- end of anlyze-speech


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
