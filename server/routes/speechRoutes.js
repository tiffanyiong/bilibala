import crypto from 'node:crypto';
import { Type } from '@google/genai';
import { Router } from 'express';
import { config } from '../config/env.js';
import { getConfigNumber } from '../services/configService.js';
import { createAi } from '../services/geminiService.js';
import { supabaseAdmin } from '../services/supabaseAdmin.js';
import { safeJsonParse } from '../utils/helpers.js';

const router = Router();

/**
 * POST /api/analyze-speech
 * Analyzes user speech audio and provides structured feedback
 */
router.post('/analyze-speech', async (req, res) => {
  try {
    if (!config.gemini.apiKey) return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
    const { audioData, topic, question, level, targetLang, nativeLang, referenceTranscript } = req.body || {};

    if (!audioData) return res.status(400).json({ error: 'No audio data provided' });

    // RETAKE MODE: If referenceTranscript is provided, user is practicing the improved version
    // Focus on delivery scoring, not content restructuring
    const isRetakeMode = !!referenceTranscript;

    const ai = createAi();

    // NOTE: Using single quotes for 'sub_points' inside the prompt to avoid JS template literal errors.

    // RETAKE MODE PROMPT: AI detects if user is practicing reference OR giving new answer
    const retakePrompt = `
      You are an expert Communication & Delivery Coach.

      # Context
      - **Topic:** "${topic}"
      - **Question:** "${question}"
      - **User Level:** ${level}
      - **Target Language:** ${targetLang || 'English'}
      - **Native Language:** ${nativeLang || 'English'}

      # PREVIOUS AI-IMPROVED SPEECH (Reference):
      "${referenceTranscript}"

      # CRITICAL: DETECT USER'S INTENT
      First, transcribe what the user said. Then COMPARE their speech to the reference above.

      **DETECTION CRITERIA:**
      - If user's speech is SIMILAR to the reference (>60% content overlap, same main ideas, similar structure):
        → They are PRACTICING the AI-improved version → Use DELIVERY MODE
      - If user's speech is DIFFERENT (new ideas, different structure, substantially different content):
        → They are trying their OWN NEW ANSWER → Use FULL ANALYSIS MODE

      ---

      ## IF DELIVERY MODE (practicing the reference):
      - detected_framework: "PRACTICE_DELIVERY"
      - Score from 0-100 (NOT 0-10!) based on DELIVERY quality:
        - 85-100: Excellent delivery - smooth, confident, matches reference well
        - 70-84: Good delivery - mostly smooth, minor hesitations
        - 55-69: Developing - noticeable pauses, some words missed
        - Below 55: Needs more practice
      - improved_transcription: Keep the SAME as the reference (they're already practicing the ideal)
      - Feedback focuses on: pacing, pronunciation, confidence, missed/added words
      - Do NOT restructure or re-improve the content
      - improvements array: empty (no language polish needed)
      - IMPORTANT: Do NOT mention "PRACTICE_DELIVERY" or framework names in feedback text - just give natural delivery feedback

      ## IF FULL ANALYSIS MODE (new answer):
      - detected_framework: Detect their actual framework (STAR, PREP, MINTO, etc.)
      - Score from 0-100 (NOT 0-10!) based on CONTENT quality (structure, logic, language use)
        - Most attempts should score 50-80. Be encouraging!
      - improved_transcription: Generate a NEW fluent improved version
      - improved_structure: Generate proper restructured version
      - Feedback focuses on: content structure, argument quality, areas to improve
      - improvements array: Include language polish suggestions

      ${level === 'Easy' ? `
      Write all feedback in ${nativeLang || 'English'} (the learner's native language) so they can understand.
      ` : `
      Write all feedback in ${targetLang || 'English'}.
      `}

      # Output Format:
      Use the standard schema. The key difference:
      - DELIVERY MODE: detected_framework = "PRACTICE_DELIVERY", keep reference as improved_transcription
      - FULL ANALYSIS MODE: detected_framework = actual framework, generate new improved_transcription
    `.trim();

    const prompt = isRetakeMode ? retakePrompt : `
      You are an expert Communication Coach.
      Your goal is to compare the User's ACTUAL speech (The Mirror) vs. an OPTIMAL version (The Architect).

      # Context
      - **Topic:** "${topic}"
      - **Question:** "${question}"
      - **User Level:** ${level}
      - **Target Language:** ${targetLang || 'English'}
      - **Native Language:** ${nativeLang || 'English'}

      # CRITICAL LANGUAGE REQUIREMENT - READ CAREFULLY
      ${level === 'Easy' ? `
      ⚠️ IMPORTANT: This is a BEGINNER learning ${targetLang || 'English'}. Their NATIVE language is ${nativeLang || 'English'}.

      ALL EXPLANATORY TEXT must be written in ${nativeLang || 'English'} so the beginner can understand.

      FIELD-BY-FIELD LANGUAGE REQUIREMENTS:

      📌 FIELDS THAT MUST BE IN ${targetLang || 'English'} (the language being learned):
      - transcription: Keep as-is (user's actual speech)
      - structure.conclusion: User's main point in ${targetLang || 'English'}
      - structure.arguments[].point: User's argument points in ${targetLang || 'English'}
      - improved_structure.conclusion: Improved conclusion in ${targetLang || 'English'}
      - improved_structure.arguments[].headline: Step headlines in ${targetLang || 'English'}
      - improvements[].original: Original phrase in ${targetLang || 'English'}
      - improvements[].improved: Improved phrase in ${targetLang || 'English'}

      📌 FIELDS THAT MUST BE IN ${nativeLang || 'English'} (native language for explanations):
      - structure.arguments[].critique: Write critique in ${nativeLang || 'English'}
      - improved_structure.arguments[].elaboration: Write elaboration/explanation in ${nativeLang || 'English'}
      - feedback.strengths[]: Write each strength in ${nativeLang || 'English'}
      - feedback.weaknesses[]: Write each weakness in ${nativeLang || 'English'}
      - feedback.suggestions[]: Write each suggestion in ${nativeLang || 'English'}
      - improvements[].explanation: Write explanation WHY in ${nativeLang || 'English'}
      - pronunciation.summary: Write summary in ${nativeLang || 'English'}
      - pronunciation.intonation.feedback: Write feedback in ${nativeLang || 'English'}
      - pronunciation.words[].feedback: Write word feedback in ${nativeLang || 'English'}

      ⚠️ DO NOT write critique, elaboration, explanation, or feedback fields in ${targetLang || 'English'}. The beginner needs to understand these in their native language.
      ` : `
      FOR INTERMEDIATE/ADVANCED LEVEL:
      ALL text content in your response MUST be in ${targetLang || 'English'}. This includes:
      - conclusion (both in structure and improved_structure) MUST be in ${targetLang || 'English'}.
      - All argument points, headlines, elaborations, critiques, and evidence MUST be in ${targetLang || 'English'}.
      - All feedback (strengths, weaknesses, suggestions) MUST be in ${targetLang || 'English'}.
      - All improvement suggestions (original, improved, explanation) MUST be in ${targetLang || 'English'}
      - Pronunciation feedback (summary, intonation feedback, word-level feedback) MUST be in ${targetLang || 'English'}
      - The transcription field must remain as-is (user's actual speech)
      `}

      # FRAMEWORK DEFINITIONS
      1. **MINTO (Logical):** Conclusion -> Arguments -> Evidence.
      2. **STAR (Behavioral):** Situation -> Task -> Action -> Result.
      3. **PREP (Impromptu):** Point -> Reason -> Example -> Point.
      4. **GOLDEN CIRCLE (Vision):** Why -> How -> What.
      5. **W-S-N (Reflection):** What? -> So What? -> Now What?
      6. **SCQA (Problem-Solving):** Situation -> Complication -> Question -> Answer.

      # TASK 1: THE MIRROR (Analyze User's "My Logic")
      **GOAL:** Extract and display the user's EXACT words from their speech - DO NOT polish or rewrite.

      **CRITICAL RULES FOR "MY LOGIC":**
      1. **EXTRACT EXACT QUOTES:** Each node's "point" field MUST be a direct quote or close extraction from the user's transcription. Preserve their exact wording, grammar (even if imperfect), and vocabulary. This reflects their real language level.
      2. **NO POLISHING:** Do NOT summarize, rephrase, or improve the user's words. If they said "I go to school yesterday", keep it as is - don't correct to "I went to school yesterday".
      3. **FRAMEWORK FLOW ORDER:** Arrange the extracted quotes to match the detected framework's flow:
         - PREP: Point (opening statement) → Reason (why) → Example (story/evidence) → Point (conclusion)
         - STAR: Situation → Task → Action → Result
         - GOLDEN_CIRCLE: Why → How → What
         - WSN: What → So What → Now What
         - MINTO: Conclusion → Arguments → Evidence
         - SCQA: Situation → Complication → Question → Answer
      4. **TYPE DEFINITIONS:**
         - **FACT:** Only for objective truths (e.g. "The sun is hot").
         - **OPINION:** Personal preferences, habits, or feelings (e.g. "I like sleep", "I feel happy").
         - **STORY:** Narrative events.
      5. **NARRATIVE DEPTH:** Nest sequential events (A->B->C) using 'sub_points'.

      # TASK 2: THE ARCHITECT (Generate "AI Improved")
      **GOAL:** Reorganize the thoughts into the BEST SUITED framework.

      **CRITICAL INSTRUCTION FOR LEARNERS:**
      - The "AI Improved" graph is a **LEARNING TOOL**.
      - **Headline:** A short summary of the step (e.g., "The Situation").
      - **Elaboration:** The **EXACT MODEL SENTENCE** the user *should have used*.
        - *Bad Elaboration:* "Explain the context of the podcast."
        - *Good Elaboration:* "Start by setting the scene: 'Back in college, I was invited to a podcast...'"
      - **Integration:** If the user had good points (like "sleep" and "music"), INTEGRATE them into the main flow or keeping them as a strong "Strategy" branch before the story.

      **ACTIONS BY FRAMEWORK:**
      - **STAR:** Situation -> Task -> Action -> Result.
      - **PREP:** Point -> Reason -> Example (The Story) -> Point.
      - **SCQA:** Situation (context) -> Complication (problem) -> Question (what to do?) -> Answer (solution).

      # TASK 3: IMPROVED TRANSCRIPTION (Fluent Speech Version)
      **GOAL:** Write out the COMPLETE improved speech as a fluent, natural paragraph that the user can read aloud.

      **CRITICAL REQUIREMENTS:**
      - Combine the improved_structure (conclusion + all arguments with their elaborations) into ONE flowing speech
      - Remove all framework labels (no "Situation:", "Task:", "Action:", "Result:", etc.) in the improved transcription - it should read like a natural story or explanation, not a structured outline.
      - Write it as if YOU are delivering the speech or a story naturally - smooth transitions between ideas
      - Detect the user's language level - use vocabulary and grammar that matches their current level, but with improvements. Don't make it too advanced or it won't be useful for practice.
      - Native speakers often use simple words but in a well-organized way. Focus on clarity and natural flow, not just fancy vocabulary.
      - Similar to how a skilled coach would help a learner rephrase their thoughts into a more natural and effective way of speaking, while still keeping it at an appropriate level for the learner.
      - Keep the same content/meaning as improved_structure, just reorganized for natural delivery
      - This should sound like a polished, rehearsed response the user can practice reading

      **Example transformation:**
      - BAD (structured): "Situation: Solo Wedding Shoot Challenge. As a solo photographer... Task: Managing Equipment Alone. My main task was..."
      - GOOD (fluent): "As a solo photographer, I once found myself in a challenging situation - managing an entire wedding shoot by myself. My main task was to handle all aspects of the photography..."

      # TASK 4: COACHING FEEDBACK
      - **Score:** Provide a score from 0 to 100 (MUST be an integer between 0-100, NOT 0-10).

        **SCORING GUIDELINES (be encouraging, not harsh):**
        - 85-100: Excellent - Well-structured, clear communication, minor polish needed
        - 70-84: Good - Solid attempt with clear ideas, some structure improvements possible
        - 55-69: Developing - Ideas present but organization needs work
        - 40-54: Needs Work - Significant structure/clarity issues
        - Below 40: Major issues - Very unclear or off-topic

        **IMPORTANT:** Most learners who attempt to answer should score 50-80.
        A score of 7.5 is WRONG (that's 0-10 scale). Convert to 75.
        Be encouraging - focus on what they did well, not just what's missing.

      - **Gap Analysis:** Explain why the new structure is better.

      # TASK 5: PRONUNCIATION & INTONATION ANALYSIS (POC)
      Listen carefully to HOW the user speaks, not just WHAT they say.

      **Analyze:**
      1. **Word-level pronunciation:** Identify 5-10 key words from the transcription. For each:
         - Rate as "good" (clear, native-like), "needs-work" (understandable but accented), or "unclear" (hard to understand)
         - Provide brief feedback for words that need work (e.g., "stress the first syllable", "soften the 'r' sound")
      2. **Overall pronunciation:** Rate as "native-like", "clear", "accented", or "needs-work"
      3. **Intonation pattern:** Classify as "natural" (good rhythm/melody), "flat" (monotone), "monotone" (no variation), or "overly-expressive"
         - Provide specific feedback (e.g., "Try rising intonation at the end of questions")
      4. **Summary:** One sentence summarizing the pronunciation quality and main area to improve

      # Output Requirements
      Generate a JSON response:
      - **NO EMPTY STRINGS**.

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
              "type": "fact" | "story" | "opinion",
              "sub_points": [ ... ],
              "evidence": ["..."],
              "critique": "..."
            }
          ]
        },
        "improved_structure": {
          "recommended_framework": "...",
          "conclusion": "The Ideal Conclusion",
          "arguments": [
            {
              "headline": "Step 1: The Situation",
              "elaboration": "Use this phrase: 'During my college years, I faced a significant challenge...'",
              "sub_points": [ ... ],
              "type": "story",
              "evidence": ["..."]
            }
          ]
        },
        "improved_transcription": "The complete, fluent speech combining all improved_structure elements into a natural, readable paragraph without framework labels...",
        "feedback": { ... },
        "improvements": [ ... ],
        "pronunciation": {
          "overall": "clear",
          "words": [
            { "word": "example", "status": "good" },
            { "word": "difficult", "status": "needs-work", "feedback": "Stress the second syllable: dif-FI-cult" }
          ],
          "intonation": {
            "pattern": "natural",
            "feedback": "Good use of rising intonation on questions."
          },
          "summary": "Clear pronunciation overall. Focus on word stress for multi-syllable words."
        }
      }
    `.trim();

    // Reusable Schema Definition for Recursive Nodes
    const argumentSchemaProperties = {
        point: { type: Type.STRING },
        status: { type: Type.STRING, enum: ["strong", "weak", "irrelevant", "missing"] },
        type: { type: Type.STRING, enum: ["fact", "story", "opinion"] },
        evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
        critique: { type: Type.STRING }, // Critique for Top Level
        // RECURSION: Add sub_points here
        sub_points: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    point: { type: Type.STRING },
                    status: { type: Type.STRING },
                    type: { type: Type.STRING },
                    evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
                    critique: { type: Type.STRING }
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

    console.log('[analyze-speech] Starting Gemini API call...');
    const startTime = Date.now();

    const TIMEOUT_MS = getConfigNumber('speech_analysis_timeout_seconds', 150) * 1000;
    const MAX_RETRIES = 1;     // 1 retry after initial attempt

    const callGemini = () => {
      return Promise.race([
        ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                { inlineData: { mimeType: 'audio/webm', data: audioData } }
              ]
            }
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcription: { type: Type.STRING },
            detected_framework: { type: Type.STRING, enum: ["MINTO", "STAR", "PREP", "GOLDEN_CIRCLE", "WSN", "SCQA", "PRACTICE_DELIVERY"] },
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
                recommended_framework: { type: Type.STRING, enum: ["MINTO", "STAR", "PREP", "GOLDEN_CIRCLE", "WSN", "SCQA", "PRACTICE_DELIVERY"] },
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
            improved_transcription: { type: Type.STRING },
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
            },
            // POC: Pronunciation Analysis
            pronunciation: {
              type: Type.OBJECT,
              properties: {
                overall: { type: Type.STRING, enum: ['native-like', 'clear', 'accented', 'needs-work'] },
                words: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      word: { type: Type.STRING },
                      status: { type: Type.STRING, enum: ['good', 'needs-work', 'unclear'] },
                      feedback: { type: Type.STRING }
                    },
                    required: ['word', 'status']
                  }
                },
                intonation: {
                  type: Type.OBJECT,
                  properties: {
                    pattern: { type: Type.STRING, enum: ['natural', 'flat', 'monotone', 'overly-expressive'] },
                    feedback: { type: Type.STRING }
                  },
                  required: ['pattern', 'feedback']
                },
                summary: { type: Type.STRING }
              },
              required: ['overall', 'words', 'intonation', 'summary']
            }
          },
          required: ['transcription', 'detected_framework', 'structure', 'improved_structure', 'improved_transcription', 'feedback', 'improvements', 'pronunciation']
        }
      }
    }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Gemini API timeout after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)
        )
      ]);
    };

    let response;
    let lastError;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[analyze-speech] Retry attempt ${attempt}...`);
        }
        response = await callGemini();
        break; // success
      } catch (err) {
        lastError = err;
        console.warn(`[analyze-speech] Attempt ${attempt + 1} failed: ${err.message}`);
        if (attempt >= MAX_RETRIES) {
          throw lastError;
        }
      }
    }

    console.log(`[analyze-speech] Gemini API call completed in ${Date.now() - startTime}ms`);

    let candidates = response.candidates;
    if (!candidates && response.data) candidates = response.data.candidates;

    if (!candidates || !candidates[0] || !candidates[0].content || !candidates[0].content.parts) {
        console.error('[analyze-speech] Response missing candidates:', JSON.stringify(response, null, 2));
        throw new Error('Gemini response missing candidates');
    }

    const json = safeJsonParse(candidates[0].content.parts[0].text);

    // SCORE NORMALIZATION: Fix AI returning 0-10 scale instead of 0-100
    // Only normalize if score has decimals (like 7.5) - this indicates 0-10 scale
    // A legitimate low score like 5/100 or 8/100 won't have decimals
    if (json.feedback?.score !== undefined) {
      const originalScore = json.feedback.score;
      const hasDecimals = originalScore % 1 !== 0;

      // Only normalize if: has decimals AND is in 0-10 range (clear sign of wrong scale)
      if (hasDecimals && originalScore > 0 && originalScore <= 10) {
        json.feedback.score = Math.round(originalScore * 10);
        console.log(`[analyze-speech] Normalized score from ${originalScore} (0-10 scale) to ${json.feedback.score} (0-100 scale)`);
      }
      // Clamp to 0-100 range and ensure integer
      json.feedback.score = Math.max(0, Math.min(100, Math.round(json.feedback.score)));
    }

    console.log(`[analyze-speech] Successfully parsed response, score: ${json.feedback?.score}, framework: ${json.detected_framework}${json.detected_framework === 'PRACTICE_DELIVERY' ? ' (retake/delivery mode)' : ''}`);
    res.json(json);

  } catch (err) {
    const isTimeout = err.message?.includes('timeout');
    console.error(`[analyze-speech] Failed${isTimeout ? ' (timeout)' : ''}:`, err.message || err);
    res.status(isTimeout ? 504 : 500).json({
      error: isTimeout ? 'Analysis took too long. Please try again.' : 'Failed to analyze speech',
      details: err.message
    });
  }
});

// Language code mapping for Google Cloud TTS (Standard voices - $4/1M chars, Female)
const TTS_VOICE_MAP = {
  'English': { code: 'en-US', voice: 'en-US-Standard-C' },      // Female
  'Spanish': { code: 'es-ES', voice: 'es-ES-Standard-A' },      // Female
  'French': { code: 'fr-FR', voice: 'fr-FR-Standard-A' },       // Female
  'German': { code: 'de-DE', voice: 'de-DE-Standard-A' },       // Female
  'Portuguese': { code: 'pt-BR', voice: 'pt-BR-Standard-A' },   // Female
  'Japanese': { code: 'ja-JP', voice: 'ja-JP-Standard-A' },     // Female
  'Korean': { code: 'ko-KR', voice: 'ko-KR-Standard-A' },       // Female
  'Chinese': { code: 'cmn-CN', voice: 'cmn-CN-Standard-A' },    // Female
  'Hindi': { code: 'hi-IN', voice: 'hi-IN-Standard-A' },        // Female
  'Italian': { code: 'it-IT', voice: 'it-IT-Standard-A' },      // Female
  'Russian': { code: 'ru-RU', voice: 'ru-RU-Standard-A' },      // Female
  'Arabic': { code: 'ar-XA', voice: 'ar-XA-Standard-A' },       // Female
  'Indonesian': { code: 'id-ID', voice: 'id-ID-Standard-A' },   // Female
  'Turkish': { code: 'tr-TR', voice: 'tr-TR-Standard-A' },      // Female
  'Vietnamese': { code: 'vi-VN', voice: 'vi-VN-Standard-A' },   // Female
};

// Generate a hash for cache key (use sanitized language name for path)
function getTTSCacheKey(text, language) {
  // Extract just the English part of language name (e.g., "Japanese (日本語)" -> "japanese")
  const sanitizedLang = language.split(/[\s(]/)[0].toLowerCase();
  const hash = crypto.createHash('md5').update(`${language}:${text}`).digest('hex');
  return `${sanitizedLang}/${hash}.mp3`;
}

/**
 * POST /api/tts
 * Text-to-speech using Google Cloud TTS with Supabase caching
 */
router.post('/tts', async (req, res) => {
  try {
    // Use dedicated TTS API key if available, otherwise fall back to Gemini key
    const apiKey = config.google?.ttsApiKey || config.gemini.apiKey;
    if (!apiKey) return res.status(500).json({ error: 'Server missing API key (GOOGLE_TTS_API_KEY or GEMINI_API_KEY)' });

    const { text, language } = req.body || {};
    if (!text) return res.status(400).json({ error: 'No text provided' });

    // Extract base language name (e.g., "Chinese (Mandarin - 中文)" -> "Chinese")
    const baseLang = language.split(/[\s(]/)[0];
    const voiceConfig = TTS_VOICE_MAP[baseLang] || TTS_VOICE_MAP['English'];
    console.log(`[tts] Language: "${language}" -> baseLang: "${baseLang}" -> voice: ${voiceConfig.voice}`);
    const cacheKey = getTTSCacheKey(text, language);

    // Try to get cached audio from Supabase
    if (supabaseAdmin) {
      try {
        const { data: existingFile, error: cacheError } = await supabaseAdmin.storage
          .from('tts-cache')
          .createSignedUrl(cacheKey, 3600); // 1 hour signed URL

        if (!cacheError && existingFile?.signedUrl) {
          console.log(`[tts] Cache hit for "${text}" (${language})`);
          return res.json({ audioUrl: existingFile.signedUrl, cached: true });
        }
        // Cache miss is normal, just continue to Google TTS
      } catch (cacheErr) {
        console.log(`[tts] Cache check skipped (bucket may not exist): ${cacheErr.message}`);
        // Continue to Google TTS
      }
    }

    // Cache miss - call Google TTS
    console.log(`[tts] Cache miss, calling Google TTS for "${text}" (${language})`);
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: voiceConfig.code,
            name: voiceConfig.voice,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 0.95,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[tts] Google TTS error:', errorData);
      return res.status(response.status).json({
        error: 'TTS request failed',
        details: errorData.error?.message || 'Unknown error'
      });
    }

    const data = await response.json();
    const audioContent = data.audioContent; // Base64 encoded MP3

    // Store in Supabase cache (async, don't wait)
    if (supabaseAdmin && audioContent) {
      const audioBuffer = Buffer.from(audioContent, 'base64');
      supabaseAdmin.storage
        .from('tts-cache')
        .upload(cacheKey, audioBuffer, {
          contentType: 'audio/mpeg',
          upsert: true,
        })
        .then(({ error }) => {
          if (error) console.error('[tts] Cache upload failed:', error.message);
          else console.log(`[tts] Cached "${text}" (${language})`);
        });
    }

    res.json({ audioContent, cached: false });

  } catch (err) {
    console.error('[tts] Failed:', err.message || err);
    res.status(500).json({ error: 'TTS failed', details: err.message });
  }
});

export default router;
