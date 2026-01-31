import express from 'express';
import { getExploreVideos, getCacheStats } from '../services/exploreService.js';

const router = express.Router();

/**
 * GET /api/explore
 * Get explore videos for the landing page
 *
 * Query params:
 * - targetLang: string (required) - Target language e.g., 'English'
 * - level: string (required) - Difficulty level ('Easy', 'Medium', 'Hard')
 * - limit: number (optional) - Max videos to return (default 8, max 20)
 *
 * Response:
 * - videos: ExploreVideo[]
 * - cached: boolean
 */
router.get('/explore', async (req, res) => {
  try {
    const { targetLang, level, limit: limitParam } = req.query;

    // Validate required params
    if (!targetLang || !level) {
      return res.status(400).json({
        error: 'Missing required parameters: targetLang and level',
      });
    }

    // Validate level
    const validLevels = ['Easy', 'Medium', 'Hard'];
    if (!validLevels.includes(level)) {
      return res.status(400).json({
        error: `Invalid level. Must be one of: ${validLevels.join(', ')}`,
      });
    }

    // Parse and validate limit
    let limit = 8;
    if (limitParam) {
      limit = parseInt(limitParam, 10);
      if (isNaN(limit) || limit < 1) limit = 8;
      if (limit > 20) limit = 20;
    }

    const result = await getExploreVideos(targetLang, level, limit);

    res.json({
      videos: result.videos,
      cached: result.cached,
    });
  } catch (error) {
    console.error('[Explore API] Error:', error);
    res.status(500).json({
      error: 'Failed to fetch explore videos',
    });
  }
});

/**
 * GET /api/explore/stats
 * Get cache statistics (for debugging/monitoring)
 */
router.get('/explore/stats', (_req, res) => {
  const stats = getCacheStats();
  res.json(stats);
});

export default router;
