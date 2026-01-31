import { Innertube, UniversalCache } from 'youtubei.js';
import { Supadata } from '@supadata/js';
import { config } from '../config/env.js';

// Map app language names to ISO 639-1 codes for Supadata API
const LANGUAGE_TO_ISO = {
  'English': 'en',
  'Spanish': 'es',
  'French': 'fr',
  'German': 'de',
  'Portuguese': 'pt',
  'Japanese': 'ja',
  'Korean': 'ko',
  'Chinese': 'zh',
  'Hindi': 'hi',
  'Italian': 'it',
  'Russian': 'ru',
  'Arabic': 'ar',
  'Indonesian': 'id',
  'Turkish': 'tr',
  'Vietnamese': 'vi'
};

/**
 * Fetch video metadata and transcript using Innertube (duration) and Supadata (transcript)
 * @param {string} videoId - YouTube video ID
 * @param {string} targetLang - Target language for transcript (e.g., 'English', 'Spanish')
 * @throws {Error} If transcript cannot be fetched
 */
export async function fetchVideoContext(videoId, targetLang = 'English') {
  const langCode = LANGUAGE_TO_ISO[targetLang] || 'en';
  console.log(`[server] Fetching context for ${videoId} (lang: ${langCode})...`);

  // 1. Duration (Innertube)
  let duration = 0;
  try {
    const yt = await Innertube.create({ cache: new UniversalCache(false) });
    const info = await yt.getInfo(videoId);
    duration = info.basic_info.duration || 0;
  } catch (e) {
    console.warn(`[server] Failed to get video duration: ${e.message}`);
  }

  // 2. Transcript (Supadata only - no fallback)
  let transcriptText = '';
  let transcriptSegments = [];
  let transcriptLang = null;

  console.log('[server] Requesting transcript from Supadata...');
  const supadata = new Supadata({ apiKey: config.supadata.apiKey });

  let result = await supadata.transcript({
    url: `https://www.youtube.com/watch?v=${videoId}`,
    lang: langCode,
    text: false
  });

  // Check if Supadata returned an error response
  if (result.error) {
    console.error(`[server] Supadata error: ${result.error} - ${result.message}`);
    throw new Error('Unable to get transcript for this video. Please try a different video.');
  }

  let content = null;
  if (result && result.jobId) {
    console.log(`[server] Supadata job started: ${result.jobId}`);
    let status = 'queued';
    let attempts = 0;
    while (status !== 'completed' && status !== 'failed' && attempts < 30) {
      await new Promise(r => setTimeout(r, 1000));
      const job = await supadata.transcript.getJobStatus(result.jobId);
      status = job.status;
      if (status === 'completed') {
        content = job.content;
      } else if (status === 'failed') {
        console.error(`[server] Supadata job failed: ${job.error}`);
        throw new Error('Unable to get transcript for this video. Please try a different video.');
      }
      attempts++;
    }
    // Timeout after 30 attempts
    if (status !== 'completed') {
      throw new Error('Transcript request timed out. Please try again.');
    }
  } else if (result) {
    content = (result.content !== undefined) ? result.content : result;
  }

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
    transcriptLang = result?.lang || null;
    console.log(`[server] Supadata transcript received. Segments: ${transcriptSegments.length}, lang: ${transcriptLang || 'unknown'}`);
  } else if (typeof content === 'string' && content.trim()) {
    transcriptText = content;
    transcriptLang = result?.lang || null;
  } else {
    // No transcript content
    throw new Error('Unable to get transcript for this video. Please try a different video.');
  }

  return { duration, transcriptText, transcriptSegments, transcriptLang };
}
