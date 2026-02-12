import { Type } from '@google/genai';
import { Router } from 'express';
import { config } from '../config/env.js';
import { createAi } from '../services/geminiService.js';
import { fetchVideoContext } from '../services/videoService.js';
import { extractVideoId, safeJsonParse } from '../utils/helpers.js';


/**
 * Helper function to retry Gemini API calls on network failure
 */
async function generateWithRetry(ai, modelName, params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[Gemini] API call to ${modelName} (attempt ${i + 1}/${retries})`);
      return await ai.models.generateContent({
        model: modelName,
        ...params
      });
    } catch (err) {
      const isLastAttempt = i === retries - 1;
      const isNetworkError = err.message.includes('fetch failed') || err.message.includes('timeout');

      if (isLastAttempt || !isNetworkError) {
        throw err;
      }

      console.warn(`[Gemini] Request failed (attempt ${i + 1}/${retries}). Retrying in ${(i + 1) * 1000}ms... Error: ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, (i + 1) * 1000)); // Exponential backoff
    }
  }
}


const router = Router();
const FAST_MODEL = 'gemini-2.5-flash';
const PRO_MODEL = 'gemini-3-flash-preview';

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

    let contextData = { duration: 0, transcriptText: '', transcriptSegments: [] };
    if (videoId) {
      contextData = await fetchVideoContext(videoId, targetLang);
    }

    // --- 新增：將 Segments 轉換為帶時間戳的文本 ---
    // 這樣 Gemini 才能知道哪一段話是在哪一秒說的
    const formattedTranscript = (contextData.transcriptSegments || [])
      .map(s => {
        const totalSeconds = Math.floor(s.offset / 1000);

        // 計算 小時, 分鐘, 秒
        const hh = Math.floor(totalSeconds / 3600);
        const mm = Math.floor((totalSeconds % 3600) / 60);
        const ss = totalSeconds % 60;

        // 如果有小時，格式化為 [HH:MM:SS]，否則 [MM:SS]
        // 這樣 AI 在處理長影片時不會困惑
        const timestamp = hh > 0 
          ? `[${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}]`
          : `[${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}]`;
          
        return `${timestamp} ${s.text}`;
      })
      .join('\n');

      

    const durationMin = contextData.duration ? contextData.duration / 60 : 10;
    
    // --- 修改：總時長字串也同步支援小時格式 ---
    const totalDurationH = Math.floor(contextData.duration / 3600);
    const totalDurationM = Math.floor((contextData.duration % 3600) / 60);
    const totalDurationS = Math.floor(contextData.duration % 60);

   const totalDurationStr = totalDurationH > 0
      ? `${totalDurationH}:${String(totalDurationM).padStart(2, '0')}:${String(totalDurationS).padStart(2, '0')}`
      : `${totalDurationM}:${String(totalDurationS).padStart(2, '0')}`;
    const targetTopicCount = Math.max(3, Math.min(15, Math.ceil(durationMin / 3)));

    // 這裡我們給出一個建議範圍，而不是死板的數字
    // 例如：短影片 3-5 個章節，長影片 8-20 個章節
    const minTopics = Math.max(5, Math.ceil(durationMin / 10)); 
    const maxTopics = Math.max(9, Math.ceil(durationMin / 3));


    const prompt = `
    You are an expert Linguistic Content Generator for a language learning app.
    Your task is to analyze a YouTube video transcript and generate learning materials tailored to a specific proficiency level in different languages (e.g. Chinese, English).
    

    # Context
    - **Video Title:** "${videoTitle}"
    - **Target Level:** ${level.toUpperCase()}
    - **User's Native Language:** ${nativeLang}
    - **Target Language:** ${targetLang}
    - **Video Duration:** ${contextData.duration ? `${Math.floor(contextData.duration / 60)} minutes ${contextData.duration % 60} seconds` : 'Unknown'}

    # CRITICAL: SEMANTIC TOPIC SEGMENTATION (IMPORTANT)
    - **Do NOT simply split the video by fixed time intervals** (e.g., do not just chop it every 5 minutes).
    - **Goal:** Identify natural topic shifts. 
      - Example: If the speaker talks about "Wedding Prep" for 10 minutes, that is ONE outline point. If they then talk about "Hawaii Trip" for 4 minutes, that is the NEXT point.
    - **Constraints:**
      1. **Coverage:** You must still cover the **entire video** from 00:00 to ${totalDurationStr}. The final outline point must reflect the video's conclusion.
      2. **Quantity:** Generate between ${minTopics} and ${maxTopics} outline points, depending on how many distinct topics are actually discussed.
      3. **Timestamps:** Use the [MM:SS] markers in the text to identify exactly when the topic *starts*. The timestamp for each outline point should correspond to the first mention of that topic.

    # CRITICAL CONSTRAINT: SOURCE OF TRUTH
    - You must ONLY select vocabulary words that **explicitly appear** in the provided transcript.
    - **DO NOT** generate related words that are not spoken in the video.
    - For the "context_sentence", you must extract the **exact sentence** from the transcript where the word is used.

    # Level-Specific Instructions (CRITICAL)

    ### IF LEVEL IS "EASY" (Beginner):
    - **Vocabulary:** Focus on **"Keywords" & "Common Phrases"**.
      1. **High-Frequency Keywords:** Extract words that represent the **core topic** and are **repeated frequently** in the video (e.g., in a cooking video, "ingredients" or "stir" are essential, even if they are B1 level).
      2. **Simple Chunks:** Include very common **phrasal verbs** or **simple idioms** that are easy to visualize (e.g., "figure out", "give up", "piece of cake", "keep in mind").
      3. **Avoid:** Do NOT pick ultra-basic words (like "is", "the", "good") unless they are used in a unique phrase.
    - **Summary:** Write simple, short sentences focusing on the main plot/idea.
    - **Practice Topics:** Generate questions about **personal preferences** or **simple descriptions** (e.g., "Do you like...?", "What is...?").
    - **Outline:** Focus only on major plot points. Ignore minor details.

    ### IF LEVEL IS "MEDIUM" (Intermediate):
    - **Vocabulary: ** Focus on **"Natural Flow" & "Collocations"**.
      1. **Collocations:** Extract word pairs that naturally go together (e.g., instead of just "decision", extract "**make a** decision"; instead of "risk", extract "take a risk").
      2. **Functional Phrasal Verbs:** Focus on B1/B2 phrasal verbs that change the meaning of the verb (e.g., "look forward to", "run out of", "bring up").
      3. **Descriptive Adjectives:** Words that describe feelings or atmosphere (e.g., "awkward", "impressive").
    - **Summary:** Write in a narrative style, focusing on the flow of the story.
    - **Practice Topics:** Generate questions about **storytelling** or **experiences** (e.g., "Describe a time when...", "Why did the speaker...?").
    - **Outline:** Moderate detail.

    ### IF LEVEL IS "HARD" (Advanced):
    - **Vocabulary:** Focus on **"Nuance" & "Sophistication"**.
      1. **Precision Words:** Extract C1/C2 words that convey a very specific meaning or tone (e.g., instead of "change", use "fluctuate" or "transform"; instead of "bad", use "detrimental").
      2. **Abstract Concepts:** Words relating to ideas, theories, or complex emotions.
      3. **Cultural/Rhetorical Idioms:** Idioms or metaphors that require cultural context or are less common.
    - **Summary:** Write an analytical summary focusing on arguments and underlying themes.
    - **Practice Topics:** Generate **Debate / Critical Thinking** questions (e.g., "What is your stance on...?", "Critique the speaker's argument.").
    - **Outline:** Detailed logic flow.

    # Task Requirements

    1.  **Summary:** Write a summary in ${targetLang} based on the level rules above. 
        - **Translation:** Provide a full translation in ${nativeLang}.
          - **CRITICAL:** Use **natural, conversational, and spoken-style language** (e.g., if ${nativeLang} is Chinese, use "口語化、通順的中文", avoid "翻譯腔" or overly academic terms).
          - **For EASY Level:** The translation MUST be simple and direct, as if explaining to a friend.
    2.  **Vocabulary:** Identify key items based on the level rules and the length of the video or transcript. For each, provide:
        - Definition (in ${targetLang})
        - Context Sentence (Direct quote or adapted from video)
        **Translations (in ${nativeLang}):**
          - **Word:** The most common, natural equivalent.
          - **Definition:** Translate the meaning clearly. **Avoid complex dictionary language.** Use simple words to explain.
          - **Context:** Translate the sentence so it sounds like something a real person would say in daily life.


    3.  **Practice Topics (Mission Data):** Generate ${targetTopicCount} specific discussion cards. ALL topic names, questions, and target words MUST be written in ${targetLang}. For EACH card, you must provide:
        - **Topic Name:** A short tag in ${targetLang} (e.g., if target is Chinese: "工作与生活平衡", if English: "Work-Life Balance")
          - Must be unique across all topic names. If two topics are very similar, modify one to be more specific.
        - **Category:** A broad category for the topic in ${targetLang} (e.g., "Career", "Travel", "Daily Life", "Technology", "Culture", "Health", "Education", "Relationships", "Entertainment", "Society")
        - **Question:** A specific question in ${targetLang} for the user to answer.
        - **Target Words:** Select 3 words in ${targetLang} (from the video or relevant to the topic) that the user MUST try to use in their answer.
   
    4.  **Outline:** A chronological breakdown based on **topic shifts**. 
        - Use the [MM:SS] markers from the transcript.
        - Ensure the outline covers the full duration.

    5.  **Video Category:** Pick the single most fitting category for this video overall (e.g., "Career", "Travel", "Daily Life", "Technology", "Culture", "Health", "Education", "Relationships", "Entertainment", "Society").
    
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
          "category": "...",
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
      ],
      "video_category": "..."
    }

    # Input Transcript
    ${formattedTranscript ? formattedTranscript.slice(0, 200000) : ''}
    `.trim();
    console.log(`[analyze-video-content] Sending prompt to Gemini | video: ${videoId || videoTitle}`);

    const response = await generateWithRetry(ai, PRO_MODEL, {
      model: PRO_MODEL,
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
                  category: { type: Type.STRING },
                  question: { type: Type.STRING },
                  suggested_target_words: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['topic_name', 'category', 'question', 'suggested_target_words']
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
            },
            video_category: { type: Type.STRING }
          },
          required: ['summary', 'vocabulary', 'practice_topics', 'outline', 'video_category'],
        },
      },
    });
    console
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
        category: t.category || null,
        question: t.question,
        targetWords: t.suggested_target_words || []
      })),
      videoCategory: json.video_category || null,
      transcript: contextData.transcriptSegments || [],
      transcriptLang: contextData.transcriptLang || null,
      transcriptLangMismatch: contextData.transcriptLangMismatch || false
    };

    res.json(mappedResponse);
    console.log(`[analyze-video-content] Analysis completed | video: ${videoId} (${videoTitle})`);
  } catch (err) {
    console.error(`[analyze-video-content] Failed for video: ${videoId || videoTitle}`, err);
    // Pass through specific error messages (e.g., transcript errors)
    const errorMessage = err.message || 'Failed to analyze video content';
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * POST /api/search-videos
 * AI-powered semantic search for user's video library
 */
router.post('/search-videos', async (req, res) => {
  try {
    if (!config.gemini.apiKey) return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });

    const { query, videos } = req.body || {};

    if (!query || !videos || !Array.isArray(videos)) {
      return res.status(400).json({ error: 'Missing query or videos array' });
    }

    if (videos.length === 0) {
      return res.json({ matchedVideoIds: [] });
    }

    const ai = createAi();

    // Build a concise representation of each video for the AI
    const videoSummaries = videos.map((v, idx) => ({
      idx,
      id: v.libraryId,
      title: v.title,
      targetLang: v.targetLang,
      level: v.level,
      // Include summary and topics if available from the analysis
      summary: v.summary || '',
      topics: v.topics || [],
      vocabulary: v.vocabulary || []
    }));

    const prompt = `
    You are a search assistant for a language learning video library.

    # User's Search Query
    "${query}"

    # Available Videos
    ${JSON.stringify(videoSummaries, null, 2)}

    # Task
    Analyze the user's search query and find ALL videos that match. Consider:
    - Video title matches (direct or semantic)
    - Topic/subject matter relevance
    - Language or level if mentioned
    - Vocabulary or concepts if relevant

    Be generous with matches - if a video could reasonably be relevant, include it.
    Return the indices (idx) of matching videos, sorted by relevance (most relevant first).

    If no videos match at all, return an empty array.

    # Output
    Return ONLY a JSON object with this structure:
    {
      "matchedIndices": [0, 2, 5]  // Array of idx values, or empty array
    }
    `.trim();

    const response = await generateWithRetry(ai, FAST_MODEL, {
      model: FAST_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchedIndices: {
              type: Type.ARRAY,
              items: { type: Type.NUMBER }
            }
          },
          required: ['matchedIndices']
        }
      }
    });

    let candidates = response.candidates;
    if (!candidates && response.data) candidates = response.data.candidates;

    if (!candidates || !candidates[0] || !candidates[0].content || !candidates[0].content.parts) {
      console.error('[server] Search response missing candidates');
      // Fall back to returning all videos
      return res.json({ matchedVideoIds: videos.map(v => v.libraryId) });
    }

    const json = safeJsonParse(candidates[0].content.parts[0].text);

    // Map indices back to library IDs
    const matchedVideoIds = (json.matchedIndices || [])
      .filter(idx => idx >= 0 && idx < videos.length)
      .map(idx => videos[idx].libraryId);

    res.json({ matchedVideoIds });
  } catch (err) {
    console.error('search-videos failed', err);
    // On error, don't block the user - return all videos
    res.json({ matchedVideoIds: req.body?.videos?.map(v => v.libraryId) || [] });
  }
});

/**
 * POST /api/match-topics
 * AI-powered semantic matching of new topics against existing canonical topics.
 * Used during video analysis to deduplicate similar topics (e.g., "jobs" ≈ "work & career").
 */
router.post('/match-topics', async (req, res) => {
  try {
    const { newTopics, existingTopics, targetLang } = req.body || {};

    if (!newTopics || !Array.isArray(newTopics)) {
      return res.status(400).json({ error: 'Missing newTopics array' });
    }

    // If no existing topics to match against, everything is new
    if (!existingTopics || existingTopics.length === 0) {
      return res.json({
        matches: newTopics.map(t => ({ new_topic: t, match: null, confidence: 0 }))
      });
    }

    if (!config.gemini.apiKey) return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
    const ai = createAi();

    const prompt = `
    You are a topic-matching assistant for a language learning app.

    Given a list of NEW topics from a video analysis and a list of EXISTING canonical topics (all in ${targetLang || 'the same language'}),
    You must filter out those topics that are not in ${targetLang} and then
    determine which new topics match existing ones (semantically the same discussion theme). 

    Rules:
    - Ignore non-target-language topics: if a topic is not in ${targetLang}, treat it as NO MATCH.
    - Match only if the topics would lead to the same type of discussion and is in ${targetLang}.
    - "jobs" and "work & career" = MATCH
    - "travel fears" and "adventure anxiety" = MATCH
    - "city life" and "food culture" = NO MATCH (too different)
    - If no existing topic matches, set match to null

    NEW TOPICS: ${JSON.stringify(newTopics)}
    EXISTING TOPICS: ${JSON.stringify(existingTopics.map(t => ({ id: t.id, topic: t.topic })))}
    
    For each new topic, return whether it matches an existing topic and your confidence level.
    Only match if confidence >= 0.8.
    `.trim();

    const response = await generateWithRetry(ai, FAST_MODEL, {
      model: FAST_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  new_topic: { type: Type.STRING },
                  matched_id: { type: Type.STRING, nullable: true },
                  confidence: { type: Type.NUMBER }
                },
                required: ['new_topic', 'confidence']
              }
            }
          },
          required: ['results']
        }
      }
    });

    let candidates = response.candidates;
    if (!candidates && response.data) candidates = response.data.candidates;

    if (!candidates || !candidates[0]?.content?.parts) {
      throw new Error('Gemini response missing candidates');
    }

    const json = safeJsonParse(candidates[0].content.parts[0].text);

    // Filter: only accept matches with confidence >= 0.8
    const matches = (json.results || []).map(m => ({
      new_topic: m.new_topic,
      match: m.confidence >= 0.8 ? (m.matched_id || null) : null,
      confidence: m.confidence
    }));

    res.json({ matches });
  } catch (err) {
    console.error('match-topics failed:', err);
    // Graceful degradation: treat all as new
    res.json({
      matches: (req.body?.newTopics || []).map(t => ({
        new_topic: t, match: null, confidence: 0
      }))
    });
  }
});

/**
 * POST /api/generate-question
 * AI-generates a new practice question for a given topic based on video content + user level.
 * Limited to 3 AI-generated questions per topic (enforced by frontend).
 */
router.post('/generate-question', async (req, res) => {
  try {
    if (!config.gemini.apiKey) return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });

    const { topicName, targetLang, nativeLang, level, videoSummary, existingQuestions } = req.body || {};

    if (!topicName || !targetLang || !level) {
      return res.status(400).json({ error: 'Missing topicName, targetLang, or level' });
    }

    const ai = createAi();

    const prompt = `
    You are a language learning question generator.

    Generate ONE new practice question for a speaking exercise.

    # Context
    - **Topic:** "${topicName}"
    - **Target Language:** ${targetLang}
    - **User's Native Language:** ${nativeLang || 'English'}
    - **Proficiency Level:** ${level.toUpperCase()}
    ${videoSummary ? `- **Video Summary:** ${videoSummary}` : ''}

    # Existing Questions (DO NOT repeat these)
    ${existingQuestions && existingQuestions.length > 0 ? existingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n') : 'None yet.'}

    # Level Guidelines
    - EASY: Personal preferences, simple descriptions (e.g., "Do you like...?", "What is...?")
    - MEDIUM: Storytelling, experiences (e.g., "Describe a time when...", "Why do you think...?")
    - HARD: Debate, critical thinking (e.g., "What is your stance on...?", "Critique the idea that...")

    # Requirements
    - The question MUST be in ${targetLang}
    - It must be different from existing questions
    - It must be relevant to the topic "${topicName}"
    - Select 3 target words the user should try to use in their answer (in ${targetLang})

    Return a JSON object with the question and target words.
    `.trim();

    const response = await generateWithRetry(ai, FAST_MODEL, {
      model: FAST_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            target_words: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['question', 'target_words']
        }
      }
    });

    let candidates = response.candidates;
    if (!candidates && response.data) candidates = response.data.candidates;

    if (!candidates || !candidates[0]?.content?.parts) {
      throw new Error('Gemini response missing candidates');
    }

    const json = safeJsonParse(candidates[0].content.parts[0].text);

    res.json({
      question: json.question,
      targetWords: json.target_words || [],
      difficultyLevel: level // Return the level the question was generated for
    });
  } catch (err) {
    console.error('generate-question failed:', err);
    res.status(500).json({ error: 'Failed to generate question' });
  }
});

export default router;
