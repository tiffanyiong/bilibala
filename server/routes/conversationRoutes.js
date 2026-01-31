import { Router } from 'express';
import { Type } from '@google/genai';
import { createAi } from '../services/geminiService.js';
import { safeJsonParse } from '../utils/helpers.js';
import { config } from '../config/env.js';

const router = Router();

/**
 * POST /api/conversation-hints
 * Generates conversation hints for the user
 */
router.post('/conversation-hints', async (req, res) => {
  try {
    if (!config.gemini.apiKey) return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
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
      model: 'gemini-2.5-flash',
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

export default router;
