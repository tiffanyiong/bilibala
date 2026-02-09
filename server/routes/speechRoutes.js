import { Type } from '@google/genai';
import { Router } from 'express';
import crypto from 'node:crypto';
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

    // Detect language-specific scoring framework
    const baseLang = (targetLang || 'English').split(/[\s(]/)[0];
    const isIELTS = baseLang === 'English';
    const isHSK = baseLang === 'Chinese';

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
      ${isIELTS ? `
      - ALSO provide feedback.breakdown with IELTS delivery sub-scores:
        { "framework": "ielts", "band_score": <0-9>, "fluency_coherence": <0-9>, "lexical_resource": <0-9>, "grammatical_range": <0-9>, "pronunciation": <0-9>, "band_descriptor": "..." }
        ALL 4 sub-scores MUST be non-zero. Even in delivery mode, evaluate each category:
        - fluency_coherence: How smoothly they delivered (pauses, hesitations, flow)
        - lexical_resource: How accurately they reproduced the vocabulary from the reference
        - grammatical_range: How correctly they produced the grammar structures when speaking aloud
        - pronunciation: Clarity, word stress, intonation
        Each sub-score should reflect what you hear — do NOT set any to 0.
      ` : isHSK ? `
      - ALSO provide feedback.breakdown with HSK delivery sub-scores:
        { "framework": "hsk", "hsk_level": <1-6>, "pronunciation_tones": <0-100>, "vocabulary_grammar": <0-100>, "fluency_coherence": <0-100>, "content_expressiveness": <0-100>, "level_descriptor": "..." }
        ALL 4 sub-scores MUST be non-zero. Even in delivery mode, evaluate each category:
        - pronunciation_tones: Tone accuracy and clarity when speaking aloud
        - vocabulary_grammar: How accurately they reproduced vocabulary and grammar structures
        - fluency_coherence: Smoothness, pacing, natural flow
        - content_expressiveness: Confidence, emotion, and expressiveness in delivery
        Each sub-score should reflect what you hear — do NOT set any to 0.
      ` : ''}

      ## IF FULL ANALYSIS MODE (new answer):
      - detected_framework: Detect their actual framework (STAR, PREP, MINTO, etc.)
      - Score from 0-100 (NOT 0-10!) based on CONTENT quality (structure, logic, language use)
        - Most attempts should score 50-80. Be encouraging!
      - improved_transcription: Generate a NEW fluent improved version
      - improved_structure: Generate proper restructured version
      - Feedback focuses on: content structure, argument quality, areas to improve
      - improvements array: Include language polish suggestions

      ${level === 'Easy' ? `
      LANGUAGE REQUIREMENTS:
      - Elaborations, headlines, and improved content: ALWAYS in ${targetLang || 'English'} (target language - this is what they practice)
      - Feedback, critiques, explanations: Write in ${nativeLang || 'English'} (native language - so they can understand WHY)
      ` : `
      Write all content in ${targetLang || 'English'}.
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
      - improved_structure.arguments[].elaboration: Model sentences/content to practice in ${targetLang || 'English'}
      - improvements[].original: Original phrase in ${targetLang || 'English'}
      - improvements[].improved: Improved phrase in ${targetLang || 'English'}

      📌 FIELDS THAT MUST BE IN ${nativeLang || 'English'} (native language for explanations):
      - structure.arguments[].critique: Write critique/explanation WHY in ${nativeLang || 'English'}
      - feedback.strengths[]: Write each strength in ${nativeLang || 'English'}
      - feedback.weaknesses[]: Write each weakness in ${nativeLang || 'English'}
      - feedback.suggestions[]: Write each suggestion in ${nativeLang || 'English'}
      - improvements[].explanation: Write explanation WHY in ${nativeLang || 'English'}
      - pronunciation.summary: Write summary in ${nativeLang || 'English'}
      - pronunciation.intonation.feedback: Write feedback in ${nativeLang || 'English'}
      - pronunciation.words[].feedback: Write word feedback in ${nativeLang || 'English'}

      ⚠️ DO NOT write critique, explanation, or feedback fields in ${targetLang || 'English'}. The beginner needs to understand these in their native language.
      ⚠️ ELABORATIONS must ALWAYS be in ${targetLang || 'English'} - they are model content for the learner to practice.
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
      - The "AI Improved" graph is a **LEARNING TOOL** and must display in targetLang, but the "critique" field for each point should be in nativeLang to explain WHY it's a strength or weakness when the learner's level is easy. For medium and hard levels, all fields can be in targetLang.
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
      - **Score:** Provide an integer from 0-100 based on the following encouraging rubric:

        **SCORING LEVELS:**
        - 90-100 (Mastery): The answer is logical, uses the framework perfectly, and has high fluency.
        - 75-89 (Solid): Clear structure with 1-2 minor logic gaps or pronunciation slips. (Target for most learners).
        - 60-74 (Steady): Good effort; the main point is clear even if the framework (e.g., STAR) is slightly messy.
        - 45-59 (Beginner): The user tried, but logic is fragmented. Focus feedback on 1 key improvement.
        - Below 45: Only used for completely off-topic or silent responses.

        **COACHING RULE:** If a user makes a brave attempt but struggles with grammar, do NOT penalize the score heavily. Prioritize "Communication Success" over "Perfect Grammar."

        **IMPORTANT:**
        A score of 7.5 is WRONG (that's 0-10 scale). Convert to 75.
        Be encouraging - focus on what they did well, not just what's missing.

      ${isIELTS ? `
      **IELTS SPEAKING BREAKDOWN (REQUIRED for English):**
      You are also an expert IELTS Speaking Examiner. You MUST provide a "breakdown" object inside the "feedback" field.
      
      **ADAPTIVE SCORING CRITERIA:**
      You must first analyze the **Question Complexity**:
      1. **Level 1 (Basic):** Daily life, personal preferences. (Target: Accuracy & Fluency).
      2. **Level 2 (Descriptive):** Describing events, people, or places. (Target: Narrative tenses & Adjectives).
      3. **Level 3 (Abstract):** Speculating, debating, or analyzing. (Target: High-level vocabulary & Complex logic).
      
      Then,
      Evaluate the response on the official IELTS band scale (0-9, in 0.5 increments) for each of these 4 equally weighted categories:

      1. **Fluency & Coherence (fluency_coherence):** Ability to speak without long pauses, logical flow, and use of cohesive devices like "however" or "consequently".
      2. **Lexical Resource (lexical_resource):** Range and precision of vocabulary. Look for idiomatic expressions and less common words for higher scores.
      3. **Grammatical Range & Accuracy (grammatical_range):** Use of complex structures (conditionals, relative clauses) and the number of errors.
      4. **Pronunciation (pronunciation):** Clarity of speech, use of intonation, and correct word stress.

      **Scoring Penalty Rule:**
      - If the user provides "Level 1" vocabulary (e.g., "good," "happy," "a lot") for a "Level 3" question, **Lexical Resource** must be capped at 5.5, even if they are perfectly fluent.
      - For "Level 3" questions, higher scores (7.0+) REQUIRE speculative language ("I would argue," "It is highly probable") and complex connectors.
      
      **IELTS Band Reference:**
      - Band 9 (Expert): Fluent, accurate, idiomatic, full range of complex grammar, rare errors.
      - Band 8 (Very Good): Fully operational, occasional unsystematic inaccuracies, wide vocabulary for precise meaning.
      - Band 7 (Good): Operational command, occasional inaccuracies, handles complex language well.
      - Band 6 (Competent): Generally effective, some inaccuracies, mix of simple/complex sentences.
      - Band 5 (Modest): Partial command, maintains flow but relies on repetition and basic connectors.
      - Band 4 (Limited): Noticeable pauses, very basic vocabulary, frequent errors hinder communication.
      - Band 3 (Extremely Limited): Great difficulty, long pauses, can only convey general meaning.
      - Band 1-2: No ability / intermittent ability to use English beyond isolated words.

      **Calculate band_score** as the average of the 4 sub-scores, rounded to nearest 0.5.
      **CONSISTENCY RULE:** Band 7+ = Score 75+, Band 6 = ~65-74, Band 5 = ~55-64, Band 4 = ~45-54, Below 4 = below 45.   

      **CRITICAL: Each sub-score MUST be evaluated INDEPENDENTLY.** Do NOT give the same band score to all 4 categories — that is unrealistic. A speaker's fluency, vocabulary, grammar, and pronunciation are almost never at the same level. For example, a learner might have Band 7.0 fluency but Band 5.5 grammar. Differentiate based on what you actually hear.

      Output format for feedback.breakdown:
      { "framework": "ielts", "band_score": 6.5, "fluency_coherence": 7.0, "lexical_resource": 6.0, "grammatical_range": 5.5, "pronunciation": 7.5, "band_descriptor": "Competent User" }
      ` : isHSK ? `
      **HSK SPEAKING BREAKDOWN (REQUIRED for Chinese):**
      You are also an expert HSK Speaking (HSKK) examiner. You MUST provide a "breakdown" object inside the "feedback" field.

      Evaluate the response for each of these 4 categories (0-100 each):

      1. **Pronunciation & Tones (pronunciation_tones):** Correct tones (1st-4th + neutral tone), initial/final sounds, tone sandhi accuracy.
      2. **Vocabulary & Grammar (vocabulary_grammar):** Range of vocabulary, correct measure words, sentence patterns, grammar structures.
      3. **Fluency & Coherence (fluency_coherence):** Natural flow, logical organization, use of connective words (因为、所以、虽然...但是).
      4. **Content & Expressiveness (content_expressiveness):** Relevance, depth of content, appropriate register, cultural awareness.

      **HSK Level Reference:**
      - Level 6 (Advanced/高级): Score 85+. Can express complex ideas fluently, discuss abstract topics.
      - Level 5 (Upper-Intermediate/中高级): Score 70-84. Can discuss a wide range of topics with good vocabulary.
      - Level 4 (Intermediate/中级): Score 55-69. Can communicate on common topics, express opinions.
      - Level 3 (Elementary/初级): Score 40-54. Can handle most basic daily conversations.
      - Level 2 (Beginner/入门): Score 25-39. Can communicate about simple daily topics.
      - Level 1 (Starter/起步): Score below 25. Can understand and use simple words.

      **Calculate hsk_level** from the average of the 4 sub-scores mapped to 1-6 scale.
      **CONSISTENCY RULE:** The 0-100 score should match the hsk_level mapping above.

      **CRITICAL: Each sub-score MUST be evaluated INDEPENDENTLY.** Do NOT give the same score to all 4 categories — that is unrealistic. A speaker's tones, vocabulary, fluency, and expressiveness are almost never at the same level. For example, a learner might score 75 on fluency but 50 on pronunciation/tones. Differentiate based on what you actually hear.

      Output format for feedback.breakdown:
      { "framework": "hsk", "hsk_level": 4, "pronunciation_tones": 55, "vocabulary_grammar": 60, "fluency_coherence": 70, "content_expressiveness": 50, "level_descriptor": "Intermediate (中级)" }
      ` : ''}

      - **Gap Analysis:** Explain why the new structure is better.

      # TASK 5: PRONUNCIATION & INTONATION ANALYSIS 
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
                suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                ...((isIELTS || isHSK) ? {
                  breakdown: {
                    type: Type.OBJECT,
                    properties: {
                      framework: { type: Type.STRING, enum: ['ielts', 'hsk'] },
                      // IELTS fields
                      band_score: { type: Type.NUMBER },
                      fluency_coherence: { type: Type.NUMBER },
                      lexical_resource: { type: Type.NUMBER },
                      grammatical_range: { type: Type.NUMBER },
                      pronunciation: { type: Type.NUMBER },
                      band_descriptor: { type: Type.STRING },
                      // HSK fields
                      hsk_level: { type: Type.NUMBER },
                      pronunciation_tones: { type: Type.NUMBER },
                      vocabulary_grammar: { type: Type.NUMBER },
                      content_expressiveness: { type: Type.NUMBER },
                      level_descriptor: { type: Type.STRING },
                    },
                    required: isIELTS
                      ? ['framework', 'band_score', 'fluency_coherence', 'lexical_resource', 'grammatical_range', 'pronunciation', 'band_descriptor']
                      : ['framework', 'hsk_level', 'pronunciation_tones', 'vocabulary_grammar', 'fluency_coherence', 'content_expressiveness', 'level_descriptor']
                  }
                } : {})
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

    // BREAKDOWN NORMALIZATION: Validate and clamp language-specific sub-scores
    if (json.feedback?.breakdown?.framework === 'ielts') {
      const b = json.feedback.breakdown;
      const clampBand = (v) => Math.max(0, Math.min(9, Math.round((v || 0) * 2) / 2));
      b.band_score = clampBand(b.band_score);
      b.fluency_coherence = clampBand(b.fluency_coherence);
      b.lexical_resource = clampBand(b.lexical_resource);
      b.grammatical_range = clampBand(b.grammatical_range);
      b.pronunciation = clampBand(b.pronunciation);
      // Safety net: if any sub-score is 0, estimate from band_score (AI should never return 0)
      const ieltsSubs = ['fluency_coherence', 'lexical_resource', 'grammatical_range', 'pronunciation'];
      for (const key of ieltsSubs) {
        if (b[key] === 0 && b.band_score > 0) {
          b[key] = Math.max(1, clampBand(b.band_score + (Math.random() > 0.5 ? 0.5 : -0.5)));
          console.warn(`[analyze-speech] IELTS ${key} was 0, estimated as ${b[key]} from band_score ${b.band_score}`);
        }
      }
      console.log(`[analyze-speech] IELTS breakdown: band=${b.band_score}, FC=${b.fluency_coherence}, LR=${b.lexical_resource}, GR=${b.grammatical_range}, P=${b.pronunciation}`);
    }
    if (json.feedback?.breakdown?.framework === 'hsk') {
      const b = json.feedback.breakdown;
      const clamp100 = (v) => Math.max(0, Math.min(100, Math.round(v || 0)));
      b.hsk_level = Math.max(1, Math.min(6, Math.round((b.hsk_level || 1) * 2) / 2));
      b.pronunciation_tones = clamp100(b.pronunciation_tones);
      b.vocabulary_grammar = clamp100(b.vocabulary_grammar);
      b.fluency_coherence = clamp100(b.fluency_coherence);
      b.content_expressiveness = clamp100(b.content_expressiveness);
      // Safety net: if any sub-score is 0, estimate from overall score (AI should never return 0)
      const overallScore = json.feedback.score || 50;
      const hskSubs = ['pronunciation_tones', 'vocabulary_grammar', 'fluency_coherence', 'content_expressiveness'];
      for (const key of hskSubs) {
        if (b[key] === 0) {
          b[key] = Math.max(10, Math.round(overallScore * (0.85 + Math.random() * 0.3)));
          b[key] = Math.min(100, b[key]);
          console.warn(`[analyze-speech] HSK ${key} was 0, estimated as ${b[key]} from overall score ${overallScore}`);
        }
      }
      console.log(`[analyze-speech] HSK breakdown: level=${b.hsk_level}, PT=${b.pronunciation_tones}, VG=${b.vocabulary_grammar}, FC=${b.fluency_coherence}, CE=${b.content_expressiveness}`);
    }

    console.log(`[analyze-speech] Successfully parsed response, score: ${json.feedback?.score}, framework: ${json.detected_framework}${json.detected_framework === 'PRACTICE_DELIVERY' ? ' (retake/delivery mode)' : ''}${json.feedback?.breakdown ? `, breakdown: ${json.feedback.breakdown.framework}` : ''}`);
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
