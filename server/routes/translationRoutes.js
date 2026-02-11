import { Router } from 'express';
import { LRUCache } from 'lru-cache';
import { config } from '../config/env.js';
import { createAi } from '../services/geminiService.js';
import { safeJsonParse } from '../utils/helpers.js';

const router = Router();

// Cache for translated UI labels (keyed by language)
// Labels rarely change, so cache indefinitely (until server restart)
const labelCache = new LRUCache({
  max: 50, // Max 50 languages cached
});

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

    // Cache key includes label count to invalidate when new labels are added
    const labelCount = sourceLabels ? Object.keys(sourceLabels).length : 0;
    const cacheKey = `${language}-${labelCount}`;

    // Check cache first
    const cachedLabels = labelCache.get(cacheKey);
    if (cachedLabels) {
      console.log(`[translate-ui-labels] Cache hit for ${cacheKey}`);
      return res.json({ labels: cachedLabels, cached: true });
    }

    console.log(`[translate-ui-labels] Cache miss for ${cacheKey}, calling Gemini...`);
    const startTime = Date.now();
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
      "aiVoice": "AI Voice",
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
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
      }
    });

    console.log(`[translate-ui-labels] Gemini call completed in ${Date.now() - startTime}ms`);

    let candidates = response.candidates;
    if (!candidates && response.data) candidates = response.data.candidates;

    if (!candidates || !candidates[0] || !candidates[0].content || !candidates[0].content.parts) {
      throw new Error('No valid response from AI');
    }

    // Use safeJsonParse helper you already defined
    const labels = safeJsonParse(candidates[0].content.parts[0].text);

    // Cache the result for future requests
    labelCache.set(cacheKey, labels);
    console.log(`[translate-ui-labels] Cached labels for ${cacheKey}`);

    res.json({ labels, cached: false });
  } catch (err) {
    console.error('translate-ui-labels failed', err);
    res.status(500).json({ error: 'Failed to translate labels' });
  }
});

export default router;
