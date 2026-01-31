import { Innertube, UniversalCache } from 'youtubei.js';
import { Supadata, SupadataError } from '@supadata/js';
import { config } from '../config/env.js';

// Map app display language names to Supadata-compatible language codes
// Supadata accepts ISO 639-1 codes and BCP 47 tags (e.g., zh-CN, zh-TW)
// Keys must match the `name` field from LANGUAGES in src/shared/constants.ts
const LANGUAGE_TO_SUPADATA = {
  'English': 'en',
  'Spanish (Español)': 'es',
  'French (Français)': 'fr',
  'German (Deutsch)': 'de',
  'Portuguese (Português)': 'pt',
  'Japanese (日本語)': 'ja',
  'Korean (한국어)': 'ko',
  'Chinese (Mandarin - 中文)': 'zh-Hans',
  'Hindi (हिन्दी)': 'hi',
  'Italian (Italiano)': 'it',
  'Russian (Русский)': 'ru',
  'Arabic (العربية)': 'ar',
  'Indonesian (Bahasa Indonesia)': 'id',
  'Turkish (Türkçe)': 'tr',
  'Vietnamese (Tiếng Việt)': 'vi'
};

/**
 * Fetch video metadata and transcript using Innertube (duration) and Supadata (transcript)
 * @param {string} videoId - YouTube video ID
 * @param {string} targetLang - Target language for transcript (e.g., 'English', 'Spanish')
 * @throws {Error} If transcript cannot be fetched
 */
export async function fetchVideoContext(videoId, targetLang = 'English') {
  const langCode = LANGUAGE_TO_SUPADATA[targetLang] || 'en';
  console.log(`[server] Fetching context for ${videoId} (lang: ${langCode})...`);

  // 1. Duration (Innertube)
  let duration = 0;
  try {
    const yt = await Innertube.create({ cache: new UniversalCache(false) });
    const info = await yt.getInfo(videoId);
    duration = info.basic_info.duration || 0;
    console.log(`[server] Video duration: ${duration}s`);
  } catch (e) {
    console.warn(`[server] Failed to get video duration: ${e.message}`);
  }

  // 2. Transcript (Supadata native mode: only fetches existing captions, no AI generation)
  let transcriptText = '';
  let transcriptSegments = [];
  let transcriptLang = null;

  const supadata = new Supadata({ apiKey: config.supadata.apiKey });
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  console.log(`[server] Requesting transcript from Supadata (mode=native, lang=${langCode})...`);

  let result;
  try {
    result = await supadata.transcript({
      url: videoUrl,
      lang: langCode,
      text: false,
      mode: 'native'
    });
  } catch (e) {
    if (e instanceof SupadataError) {
      console.error(`[server] Supadata error [${e.error}]: ${e.message} | details: ${e.details}`);
      if (e.error === 'transcript-unavailable') {
        throw new Error('This video does not have subtitles/captions available. Please choose a video with captions enabled.');
      }
      throw new Error('Something went wrong fetching the transcript. Please try again later.');
    }
    throw e;
  }

  const availableLangs = result?.availableLangs || [];
  transcriptLang = result?.lang || null;
  console.log(`[server] Supadata response: lang=${transcriptLang}, availableLangs=${JSON.stringify(availableLangs)}`);

  // Detect language mismatch (e.g., requested zh-Hans but got en)
  const langMismatch = transcriptLang && !transcriptLang.startsWith(langCode.split('-')[0]) && langCode.split('-')[0] !== transcriptLang.split('-')[0];
  if (langMismatch) {
    console.warn(`[server] Language mismatch: requested ${langCode}, got ${transcriptLang}. Available: ${availableLangs.join(', ')}`);
  }

  let content = (result && result.content !== undefined) ? result.content : result;

  if (Array.isArray(content) && content.length > 0) {
    // 1. Normalize Supadata segments (offset is ms, duration is ms)
    const rawSegments = content.map(s => ({
      text: s.text,
      offset: (typeof s.offset === 'number') ? s.offset : ((s.start || 0) * 1000),
      duration: (typeof s.duration === 'number') ? s.duration : ((s.end - s.start) * 1000)
    }));

    // 2. Merge into sentence-like chunks
    const merged = [];
    let buffer = null;

    for (const seg of rawSegments) {
      if (!buffer) {
        buffer = { ...seg };
        continue;
      }

      const gap = seg.offset - (buffer.offset + buffer.duration);
      const text = buffer.text.trim();
      const hasPunctuation = /[.!?]$/.test(text);
      const isLong = text.length > 60;
      const isTooLong = text.length > 200;
      const isBigGap = gap > 1500;

      if ((hasPunctuation && isLong) || isTooLong || isBigGap) {
        merged.push(buffer);
        buffer = { ...seg };
      } else {
        buffer.text += ' ' + seg.text;
        buffer.duration = (seg.offset + seg.duration) - buffer.offset;
      }
    }
    if (buffer) merged.push(buffer);

    transcriptSegments = merged;
    transcriptText = transcriptSegments.map(s => s.text).join(' ');
    console.log(`[server] Supadata transcript received. Segments: ${transcriptSegments.length}, lang: ${transcriptLang || 'unknown'}`);
  } else if (typeof content === 'string' && content.trim()) {
    transcriptText = content;
  } else {
    // No transcript content
    throw new Error('This video does not have subtitles/captions available. Please choose a video with captions enabled.');
  }

  return { duration, transcriptText, transcriptSegments, transcriptLang, transcriptLangMismatch: !!langMismatch };
}
