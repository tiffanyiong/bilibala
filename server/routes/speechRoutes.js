import { Router } from 'express';
import { Type } from '@google/genai';
import { createAi } from '../services/geminiService.js';
import { safeJsonParse } from '../utils/helpers.js';
import { config } from '../config/env.js';

const router = Router();

/**
 * POST /api/analyze-speech
 * Analyzes user speech audio and provides structured feedback
 */
router.post('/analyze-speech', async (req, res) => {
  try {
    if (!config.gemini.apiKey) return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
    const { audioData, topic, question, level, targetLang, nativeLang } = req.body || {};

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
      - **Target Language:** ${targetLang || 'English'}
      - **Native Language:** ${nativeLang || 'Chinese (Mandarin - 中文)'}

      # CRITICAL LANGUAGE REQUIREMENT
      ${level === 'Easy' ? `
      FOR BEGINNER (EASY) LEVEL:
      - Graph content (conclusion, argument points, headlines, elaborations, critiques, evidence) MUST be in ${targetLang || 'English'}
      - Coach's Feedback (strengths, weaknesses, suggestions) MUST be in ${nativeLang || 'English)'} to help beginners understand better
      - Word improvements (original, improved, explanation) MUST be in ${targetLang || 'English'}
      - The transcription field must remain as-is (user's actual speech in ${targetLang || 'English'})
      ` : `
      FOR INTERMEDIATE/ADVANCED LEVEL:
      ALL text content in your response MUST be in ${targetLang || 'English'}. This includes:
      - conclusion (both in structure and improved_structure) MUST be in ${targetLang || 'English'}.
      - All argument points, headlines, elaborations, critiques, and evidence MUST be in ${targetLang || 'English'}.
      - All feedback (strengths, weaknesses, suggestions) MUST be in ${targetLang || 'English'}.
      - All improvement suggestions (original, improved, explanation) MUST be in ${targetLang || 'English'}
      - The transcription field must remain as-is (user's actual speech)
      `}

      # FRAMEWORK DEFINITIONS
      1. **MINTO (Logical):** Conclusion -> Arguments -> Evidence.
      2. **STAR (Behavioral):** Situation -> Task -> Action -> Result.
      3. **PREP (Impromptu):** Point -> Reason -> Example -> Point.
      4. **GOLDEN CIRCLE (Vision):** Why -> How -> What.
      5. **W-S-N (Reflection):** What? -> So What? -> Now What?

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

      # TASK 3: COACHING FEEDBACK
      - **Score:** Provide a score from 0 to 100 based on overall speech quality, structure, clarity, and language use.
      - **Gap Analysis:** Explain why the new structure is better.

      # TASK 4: PRONUNCIATION & INTONATION ANALYSIS (POC)
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

    const response = await ai.models.generateContent({
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
          required: ['transcription', 'detected_framework', 'structure', 'improved_structure', 'feedback', 'improvements', 'pronunciation']
        }
      }
    });

    console.log(`[analyze-speech] Gemini API call completed in ${Date.now() - startTime}ms`);

    let candidates = response.candidates;
    if (!candidates && response.data) candidates = response.data.candidates;

    if (!candidates || !candidates[0] || !candidates[0].content || !candidates[0].content.parts) {
        console.error('[analyze-speech] Response missing candidates:', JSON.stringify(response, null, 2));
        throw new Error('Gemini response missing candidates');
    }

    const json = safeJsonParse(candidates[0].content.parts[0].text);
    console.log(`[analyze-speech] Successfully parsed response, score: ${json.feedback?.score}`);
    res.json(json);

  } catch (err) {
    console.error('[analyze-speech] Failed:', err.message || err);
    res.status(500).json({ error: 'Failed to analyze speech', details: err.message });
  }
});

export default router;
