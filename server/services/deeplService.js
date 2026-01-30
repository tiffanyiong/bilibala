import { LRUCache } from 'lru-cache';
import { config } from '../config/env.js';

// LRU Cache configuration
// Max 3000 entries, no TTL (keep until evicted)
const translationCache = new LRUCache({
  max: 3000,
});

// DeepL language code mapping
// Maps our app's language names (from LANGUAGES constant) to DeepL's language codes
// Note: DeepL Free tier does NOT support Arabic, Hindi, Indonesian, Turkish, Vietnamese
const DEEPL_LANG_CODES = {
  'English': 'EN',
  'Spanish (Español)': 'ES',
  'French (Français)': 'FR',
  'German (Deutsch)': 'DE',
  'Portuguese (Português)': 'PT-BR',
  'Japanese (日本語)': 'JA',
  'Korean (한국어)': 'KO',
  'Chinese (Mandarin - 中文)': 'ZH',
  'Chinese (Cantonese - 粵語)': 'ZH',
  'Italian (Italiano)': 'IT',
  'Russian (Русский)': 'RU',
};

// Max characters allowed per translation request
const MAX_CHARS = 150;

/**
 * Get DeepL language code from app language name
 * Returns null if the language is not supported by DeepL
 */
function getDeepLCode(language) {
  return DEEPL_LANG_CODES[language] || null;
}

/**
 * Generate cache key for a translation
 */
function getCacheKey(text, sourceLang, targetLang) {
  return `${text.toLowerCase().trim()}:${sourceLang}:${targetLang}`;
}

/**
 * Translate text using DeepL API with LRU caching
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language (app format, e.g., 'English')
 * @param {string} targetLang - Target language (app format, e.g., 'Chinese (Mandarin - 中文)')
 * @returns {Promise<{translation: string, cached: boolean}>}
 */
export async function translateText(text, sourceLang, targetLang) {
  // Validate text length
  if (!text || text.trim().length === 0) {
    throw new Error('Text is required');
  }

  if (text.length > MAX_CHARS) {
    throw new Error(`Text too long. Maximum ${MAX_CHARS} characters allowed.`);
  }

  // Check if API key is configured
  if (!config.deepl.apiKey) {
    throw new Error('DeepL API key not configured');
  }

  const sourceCode = getDeepLCode(sourceLang);
  const targetCode = getDeepLCode(targetLang);

  // Check if languages are supported by DeepL
  if (!sourceCode || !targetCode) {
    throw new Error('LANGUAGE_NOT_SUPPORTED');
  }

  // Same language, no translation needed
  if (sourceCode === targetCode) {
    return { translation: text, cached: true };
  }

  // Check cache first
  const cacheKey = getCacheKey(text, sourceCode, targetCode);
  const cachedTranslation = translationCache.get(cacheKey);

  if (cachedTranslation) {
    console.log(`[DeepL] Cache hit for: "${text.substring(0, 30)}..."`);
    return { translation: cachedTranslation, cached: true };
  }

  // Call DeepL API
  console.log(`[DeepL] Cache miss, calling API for: "${text.substring(0, 30)}..."`);

  const response = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${config.deepl.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [text],
      source_lang: sourceCode,
      target_lang: targetCode,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[DeepL] API error:', response.status, errorText);

    if (response.status === 456) {
      throw new Error('QUOTA_EXCEEDED');
    }
    if (response.status === 403) {
      throw new Error('DeepL API key is invalid');
    }
    throw new Error(`DeepL API error: ${response.status}`);
  }

  const data = await response.json();
  const translation = data.translations?.[0]?.text;

  if (!translation) {
    throw new Error('No translation returned from DeepL');
  }

  // Store in cache
  translationCache.set(cacheKey, translation);
  console.log(`[DeepL] Cached translation. Cache size: ${translationCache.size}`);

  return { translation, cached: false };
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: translationCache.size,
    max: translationCache.max,
  };
}

export { MAX_CHARS };
