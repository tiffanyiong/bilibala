import { LRUCache } from 'lru-cache';
import { supabaseAdmin } from './supabaseAdmin.js';

// LRU Cache configuration for explore videos
// Max 100 entries (language × level combinations), 5 minute TTL
const exploreCache = new LRUCache({
  max: 100,
  ttl: 5 * 60 * 1000, // 5 minutes
});

/**
 * Generate cache key for explore query
 */
function getCacheKey(targetLang, nativeLang, level) {
  return `explore:${targetLang}:${nativeLang}:${level}`;
}

/**
 * Check if a string is a valid YouTube video ID (11 characters, alphanumeric with - and _)
 */
function isValidYoutubeId(id) {
  if (!id || typeof id !== 'string') return false;
  // YouTube IDs are exactly 11 characters: alphanumeric, dash, underscore
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

/**
 * Transform database rows to ExploreVideo format
 * Filters out invalid entries (no youtube_id, invalid youtube_id format, no title)
 */
function transformToExploreVideos(data) {
  return (data || [])
    .filter((item) => {
      // Must have global_videos data
      if (!item.global_videos) return false;

      const video = item.global_videos;

      // Must have a valid YouTube ID
      if (!isValidYoutubeId(video.youtube_id)) return false;

      // Must have a real title (not empty, not just whitespace)
      if (!video.title || video.title.trim().length === 0) return false;

      return true;
    })
    .map((item) => ({
      analysisId: item.id,
      level: item.level,
      targetLang: item.target_lang,
      nativeLang: item.native_lang,
      analyzedAt: item.created_at,
      videoId: item.global_videos.id,
      youtubeId: item.global_videos.youtube_id,
      title: item.global_videos.title,
      thumbnailUrl: item.global_videos.thumbnail_url,
      viewCount: item.global_videos.view_count || 0,
      channelName: item.global_videos.channel_name,
    }));
}

/**
 * Get explore videos with personalization + popular backfill
 * Results are cached for 5 minutes per language/level/nativeLang combination
 *
 * @param {string} targetLang - Target language (e.g., 'English')
 * @param {string} nativeLang - User's native language (e.g., 'Korean')
 * @param {string} level - Difficulty level ('Easy', 'Medium', 'Hard')
 * @param {number} limit - Max videos to return (default 8)
 * @returns {Promise<{videos: ExploreVideo[], cached: boolean}>}
 */
export async function getExploreVideos(targetLang, nativeLang, level, limit = 8) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured');
  }

  // Check cache first
  const cacheKey = getCacheKey(targetLang, nativeLang, level);
  const cachedResult = exploreCache.get(cacheKey);

  if (cachedResult) {
    console.log(`[Explore] Cache hit for: ${targetLang} / ${nativeLang} / ${level}`);
    return { videos: cachedResult, cached: true };
  }

  console.log(`[Explore] Cache miss, querying DB for: ${targetLang} / ${nativeLang} / ${level}`);

  // Step 1: Get personalized matches (same target_lang, native_lang AND level)
  // Use !inner join to only get records with valid global_videos
  const { data: personalized, error: pError } = await supabaseAdmin
    .from('cached_analyses')
    .select(`
      id,
      level,
      target_lang,
      native_lang,
      created_at,
      global_videos!inner (
        id,
        youtube_id,
        title,
        thumbnail_url,
        view_count,
        channel_name
      )
    `)
    .eq('target_lang', targetLang)
    .eq('native_lang', nativeLang)
    .eq('level', level)
    .not('global_videos.title', 'is', null)
    .neq('global_videos.title', '')
    .order('created_at', { ascending: false })
    .limit(limit * 2);

  if (pError) {
    console.error('[Explore] Error fetching personalized videos:', pError);
    throw new Error('Failed to fetch explore videos');
  }

  const personalizedVideos = transformToExploreVideos(personalized);

  // Deduplicate by youtubeId (keep first occurrence = most recent)
  const seenYoutubeIds = new Set();
  const uniquePersonalized = personalizedVideos.filter((v) => {
    if (seenYoutubeIds.has(v.youtubeId)) return false;
    seenYoutubeIds.add(v.youtubeId);
    return true;
  });

  let result = uniquePersonalized.slice(0, limit);

  // No backfill with other native languages — showing videos in the wrong native language
  // would give users translated content they can't read. If there are no cached analyses
  // for this nativeLang/targetLang/level combination, return empty so the explore section
  // is hidden on the frontend.

  // Final safety check: ensure no duplicate youtubeIds in result
  const finalSeenIds = new Set();
  result = result.filter((v) => {
    if (finalSeenIds.has(v.youtubeId)) return false;
    finalSeenIds.add(v.youtubeId);
    return true;
  });

  // Store in cache
  exploreCache.set(cacheKey, result);
  console.log(`[Explore] Cached ${result.length} videos for ${nativeLang}/${targetLang}/${level}. Cache size: ${exploreCache.size}`);

  return { videos: result, cached: false };
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: exploreCache.size,
    max: exploreCache.max,
    ttl: exploreCache.ttl,
  };
}

/**
 * Clear the explore cache (useful for admin/debugging)
 */
export function clearCache() {
  exploreCache.clear();
  console.log('[Explore] Cache cleared');
}
