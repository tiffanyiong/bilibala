import { Router } from 'express';
import { Type } from '@google/genai';
import { createAi } from '../services/geminiService.js';
import { fetchVideoContext } from '../services/videoService.js';
import { extractVideoId, safeJsonParse } from '../utils/helpers.js';
import { config } from '../config/env.js';

const router = Router();

/**
 * POST /api/analyze-video-content
 * Analyzes video content and generates learning materials
 */
router.post('/analyze-video-content', async (req, res) => {
  try {
    if (!config.gemini.apiKey) return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
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
    - **Video Duration:** ${contextData.duration ? `${Math.floor(contextData.duration / 60)} minutes ${contextData.duration % 60} seconds` : 'Unknown'}

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

export default router;
