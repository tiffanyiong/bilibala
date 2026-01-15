import { Innertube, UniversalCache } from 'youtubei.js';
import { Supadata } from '@supadata/js';
import { config } from '../config/env.js';

/**
 * Fetch transcript using Innertube (Fallback method)
 */
export async function fetchTranscriptWithInnertube(videoId) {
  try {
    console.log(`[server] Fetching transcript fallback for ${videoId}...`);
    const yt = await Innertube.create({ cache: new UniversalCache(false) });
    const info = await yt.getInfo(videoId);

    const tracks = info.captions?.caption_tracks;
    if (!tracks || tracks.length === 0) return [];

    let selectedTrack = tracks.find(t => t.language_code === 'en');
    if (!selectedTrack) selectedTrack = tracks.find(t => t.language_code.startsWith('en'));
    if (!selectedTrack) selectedTrack = tracks[0];

    console.log(`[server] Fallback track: ${selectedTrack.name.text} (${selectedTrack.language_code})`);
    const transcriptData = await info.getTranscript(selectedTrack.base_url);

    if (transcriptData?.transcript?.content?.body?.initial_segments) {
      return transcriptData.transcript.content.body.initial_segments.map(seg => ({
        text: seg.snippet.text,
        duration: Number(seg.duration_ms),
        offset: Number(seg.start_ms)
      }));
    }
    return [];
  } catch (error) {
    console.warn(`[server] Innertube fallback failed: ${error.message}`);
    return [];
  }
}

/**
 * Fetch video metadata and transcript using both Innertube and Supadata
 */
export async function fetchVideoContext(videoId) {
  console.log(`[server] Fetching context for ${videoId}...`);
  try {
    // 1. Duration (Innertube)
    const yt = await Innertube.create({ cache: new UniversalCache(false) });
    const info = await yt.getInfo(videoId);
    const duration = info.basic_info.duration || 0;

    // 2. Transcript (Supadata)
    let transcriptText = '';
    let transcriptSegments = [];
    try {
      console.log('[server] Requesting transcript from Supadata...');
      const supadata = new Supadata({ apiKey: config.supadata.apiKey });
      const result = await supadata.transcript({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        text: false, // Must be false to get segments/timestamps for the UI
        mode: 'native' // Request existing transcript for immediate response (HTTP 200)
      });

      let content = null;
      if (result.jobId) {
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
          }
          attempts++;
        }
      } else {
        content = (result.content !== undefined) ? result.content : result;
      }

      if (Array.isArray(content)) {
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
      } else if (typeof content === 'string') {
        transcriptText = content;
      }

      console.log(`[server] Supadata transcript received. Segments: ${transcriptSegments.length}`);
    } catch (e) {
      console.warn(`[server] Supadata failed: ${e.message}`);
    }

    // FALLBACK: If Supadata failed or returned no segments, try Innertube
    if (transcriptSegments.length === 0) {
      transcriptSegments = await fetchTranscriptWithInnertube(videoId);
      if (transcriptSegments.length > 0) {
        transcriptText = transcriptSegments.map(s => s.text).join(' ');
        console.log(`[server] Fallback transcript received. Segments: ${transcriptSegments.length}`);
      }
    }

    return { duration, transcriptText, transcriptSegments };
  } catch (e) {
    console.warn(`[server] Context fetch failed: ${e.message}`);
    return { duration: 0, transcriptText: '', transcriptSegments: [] };
  }
}
