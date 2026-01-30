import { Router } from 'express';
import { translateText, getCacheStats, MAX_CHARS } from '../services/deeplService.js';

const router = Router();

/**
 * POST /api/translate/deepl
 * Translate text using DeepL API with LRU caching
 *
 * Request body:
 * - text: string (required, max 150 chars)
 * - sourceLang: string (required, e.g., 'English')
 * - targetLang: string (required, e.g., 'Chinese (Mandarin - 中文)')
 */
router.post('/translate/deepl', async (req, res) => {
  try {
    const { text, sourceLang, targetLang } = req.body;

    // Validate required fields
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    if (!sourceLang) {
      return res.status(400).json({ error: 'Source language is required' });
    }
    if (!targetLang) {
      return res.status(400).json({ error: 'Target language is required' });
    }

    // Validate text length
    if (text.length > MAX_CHARS) {
      return res.status(400).json({
        error: `Text too long. Maximum ${MAX_CHARS} characters allowed.`,
        maxChars: MAX_CHARS,
        currentLength: text.length,
      });
    }

    const result = await translateText(text, sourceLang, targetLang);

    res.json({
      translation: result.translation,
      cached: result.cached,
      sourceLang,
      targetLang,
    });
  } catch (err) {
    console.error('[DeepL Route] Translation failed:', err.message);

    if (err.message === 'QUOTA_EXCEEDED') {
      return res.status(429).json({
        error: 'Translation limit reached for this month. Please try again next month.',
        code: 'QUOTA_EXCEEDED',
      });
    }

    if (err.message === 'LANGUAGE_NOT_SUPPORTED') {
      return res.status(400).json({
        error: 'This language is not supported by the translation service.',
        code: 'LANGUAGE_NOT_SUPPORTED',
      });
    }

    res.status(500).json({ error: err.message || 'Translation failed' });
  }
});

/**
 * GET /api/translate/deepl/stats
 * Get cache statistics (for debugging/monitoring)
 */
router.get('/translate/deepl/stats', (_req, res) => {
  const stats = getCacheStats();
  res.json(stats);
});

export default router;
