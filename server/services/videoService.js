import { Supadata, SupadataError } from '@supadata/js';
import { Innertube, UniversalCache } from 'youtubei.js';
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
 * 輔助函數：將過長的字幕段落切分成較小的句子，並插值計算時間戳
 * 這是修復 "單一巨大字幕塊" 的關鍵
 */
function splitLongSegment(segment, maxLen = 150) {
  const text = segment.text;
  // 如果本身就不長，直接回傳
  if (!text || text.length <= maxLen) return [segment];

  const results = [];
  // 正則表達式：依據標點符號 (. ! ?) 切分，同時保留標點符號
  // 如果沒有標點，就直接回傳原句（或你可以選擇強制按字數切，但按標點較自然）
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  
  let currentChunk = '';
  // 起始時間
  let currentStartTime = segment.offset; 
  // 估算每個字元佔用的時間 (平均值)，用來推算切分後的 offset
  const charDuration = segment.duration / (text.length || 1); 

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    // 如果當前累積的 chunk 加上這一句會太長，就先切一刀
    if (currentChunk.length + trimmed.length > maxLen && currentChunk.length > 0) {
      const chunkDuration = currentChunk.length * charDuration;
      
      results.push({
        text: currentChunk.trim(),
        offset: Math.floor(currentStartTime),
        duration: Math.floor(chunkDuration)
      });

      // 更新下一段的起始時間
      currentStartTime += chunkDuration;
      currentChunk = '';
    }
    
    // 累積句子
    currentChunk += (currentChunk ? ' ' : '') + trimmed;
  }

  // 把剩下的部分推入
  if (currentChunk.length > 0) {
    results.push({
      text: currentChunk.trim(),
      offset: Math.floor(currentStartTime),
      duration: Math.floor((segment.offset + segment.duration) - currentStartTime)
    });
  }

  return results;
}


/**
 * Decode HTML entities in text (e.g., &amp;#39; -> ', &quot; -> ", &amp; -> &)
 */
function decodeHTMLEntities(text) {
  if (!text) return text;
  return text
    .replace(/&amp;#39;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

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
    // 1. Normalize Supadata segments (offset is ms, duration is ms) and decode HTML entities
    const rawSegments = content.map(s => ({
      text: decodeHTMLEntities(s.text),
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

      // Count sentences in buffer (approximate)
      const sentenceCount = (text.match(/[.!?]+/g) || []).length;

      // Check for punctuation at end
      const hasSentenceEnd = /[.!?]$/.test(text);
      const hasCommaOrColon = /[,;:]$/.test(text);
      const isTooLong = text.length > 150;
      const isBigGap = gap > 1500;

      // Break if:
      // 1. Has 1+ complete sentence (.!?) - break after each sentence, OR
      // 2. Has comma/semicolon/colon AND buffer is getting long (100+), OR
      // 3. Text exceeds 150 chars - safety limit, OR
      // 4. Big pause (1.5+ seconds) - natural speaker break
      const shouldBreak =
        (hasSentenceEnd && sentenceCount >= 1) ||
        (hasCommaOrColon && text.length > 100) ||
        isTooLong ||
        isBigGap;

      if (shouldBreak) {
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

  // Final Safety Check for Duration
  if (duration === 0) duration = 600; // 預設 10 分鐘，避免除以零錯誤
  
  return { duration, transcriptText, transcriptSegments, transcriptLang, transcriptLangMismatch: !!langMismatch };
}
