import { Router } from 'express';
import { createAi } from '../services/geminiService.js';
import { safeJsonParse } from '../utils/helpers.js';
import { config } from '../config/env.js';

const router = Router();

/**
 * POST /api/translate-ui-labels
 * Translate UI labels based on user level and target language
 */
router.post('/translate-ui-labels', async (req, res) => {
  try {
    if (!config.gemini.apiKey) return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });

    // FIX 1: Extract 'sourceLabels' from request so frontend and backend stay synced
    const { language, isEasyLevel, sourceLabels } = req.body || {};

    if (!language) {
      return res.status(400).json({ error: 'Language is required' });
    }

    const ai = createAi();

    // FIX 2: Use the sourceLabels provided by frontend, or fallback to a default list if missing
    const labelsToTranslate = sourceLabels || {
      "communicationLogic": "Communication Logic",
      "detected": "Detected",
      "myLogic": "My Logic",
      "aiImproved": "AI Improved",
      "legend": "Legend",
      "strong": "Strong",
      "weak": "Weak",
      "elaboration": "Elaboration",
      "critique": "Critique",
      "languagePolish": "Language Polish & Alternatives",
      "original": "Original",
      "betterAlternative": "Better Alternative",
      "coachFeedback": "Coach's Feedback",
      "strengths": "Strengths",
      "areasForImprovement": "Areas for Improvement",
      "actionableTips": "Actionable Tips",
      "transcription": "Transcription",
      "yourRecording": "Your Recording",
      "recordAnswer": "Record Answer",
      "reviewAnswer": "Review Answer",
      "takeYourTime": "Take your time",
      "tapAnalyze": "Tap analyze when ready",
      "tryIncorporateFeedback": "Try to incorporate the feedback",
      "microphoneError": "Microphone Error",
      "retake": "Retake",
      "story": "Story",
      "fact": "Fact",
      "opinion": "Opinion"
    };

    // FIX 3: Changed "${nativeLang}" to "${language}" at the end.
    // nativeLang was undefined in this scope, causing the crash.
    const prompt = `Translate the following UI labels into ${language}. Return ONLY a JSON object with the translations, no additional text.

Labels to translate:
${JSON.stringify(labelsToTranslate, null, 2)}

Return the same JSON structure with values translated to ${language}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Ensure consistent model usage
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
      }
    });

    let candidates = response.candidates;
    if (!candidates && response.data) candidates = response.data.candidates;

    if (!candidates || !candidates[0] || !candidates[0].content || !candidates[0].content.parts) {
      throw new Error('No valid response from AI');
    }

    // Use safeJsonParse helper you already defined
    const labels = safeJsonParse(candidates[0].content.parts[0].text);

    res.json({ labels });
  } catch (err) {
    console.error('translate-ui-labels failed', err);
    res.status(500).json({ error: 'Failed to translate labels' });
  }
});

export default router;
