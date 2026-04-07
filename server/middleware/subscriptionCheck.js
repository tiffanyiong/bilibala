import { supabaseAdmin, getUserFromToken } from '../services/supabaseAdmin.js';

// Tier limits (mirrored from src/shared/types/database.ts)
const TIER_LIMITS = {
  free: {
    videosPerMonth: 3,
    practiceSessionsPerDay: 5   // free tier uses daily limit for practice
  },
  pro: {
    videosPerMonth: 100,
    practiceSessionsPerDay: Infinity
  }
};

/**
 * Middleware to check if user has exceeded their subscription limits
 * Supports both authenticated and anonymous users
 *
 * @param {string} actionType - Type of action to check ('video_analysis' or 'practice_session')
 * @returns {Function} Express middleware
 */
export const checkSubscriptionLimit = (actionType) => {
  return async (req, res, next) => {
    try {
      // Try to get authenticated user (allows anonymous)
      const user = await getUserFromToken(req, { allowAnonymous: true });

      if (user) {
        // ==========================================
        // Authenticated User Check
        // ==========================================

        // Get user's subscription info
        const { data: sub, error: subError } = await supabaseAdmin
          .from('user_subscriptions')
          .select('tier, video_credits, practice_session_credits')
          .eq('user_id', user.id)
          .single();

        if (subError || !sub) {
          console.error(`[checkSubscriptionLimit] Failed to get subscription for user ${user.id}:`, subError);
          return res.status(500).json({ error: 'Failed to check subscription status' });
        }

        const tier = sub.tier || 'free';
        const videoCredits = sub.video_credits || 0;
        const practiceCredits = sub.practice_session_credits || 0;

        let currentUsage = 0;
        let limit = 0;

        if (actionType === 'video_analysis') {
          // Video analysis uses monthly usage
          const { data: usageData, error: usageError } = await supabaseAdmin
            .rpc('get_current_monthly_usage', { p_user_id: user.id });

          if (usageError) {
            console.error(`[checkSubscriptionLimit] Failed to get usage for user ${user.id}:`, usageError);
            return res.status(500).json({ error: 'Failed to check usage' });
          }

          const usage = usageData?.[0] || {};
          currentUsage = usage.videos_used || 0;
          limit = TIER_LIMITS[tier]?.videosPerMonth || 0;

        } else if (actionType === 'practice_session') {
          // Practice sessions use daily limit for all authenticated users (pro = Infinity)
          const { data: dailyUsage, error: dailyError } = await supabaseAdmin
            .rpc('get_current_daily_practice_usage', { p_user_id: user.id });

          if (dailyError) {
            console.error(`[checkSubscriptionLimit] Failed to get daily practice usage for user ${user.id}:`, dailyError);
            return res.status(500).json({ error: 'Failed to check usage' });
          }

          currentUsage = dailyUsage || 0;
          limit = TIER_LIMITS[tier]?.practiceSessionsPerDay ?? Infinity;
        }

        // Determine relevant credits for this action
        const relevantCredits = actionType === 'video_analysis' ? videoCredits : practiceCredits;

        // Check if limit exceeded (Infinity = unlimited). Credits allow exceeding the monthly/daily limit.
        if (limit !== Infinity && currentUsage >= limit && relevantCredits <= 0) {
          console.warn(`[checkSubscriptionLimit] LIMIT EXCEEDED | user: ${user.id} | tier: ${tier} | action: ${actionType} | usage: ${currentUsage}/${limit} | credits: ${relevantCredits}`);
          return res.status(429).json({
            error: 'SUBSCRIPTION_LIMIT_EXCEEDED',
            message: `Monthly ${actionType.replace('_', ' ')} limit reached (${limit}/${limit}).`,
            used: currentUsage,
            limit,
            tier,
            upgradeRequired: tier === 'free'
          });
        }

        console.log(`[checkSubscriptionLimit] ALLOWED | user: ${user.id} | tier: ${tier} | action: ${actionType} | usage: ${currentUsage}/${limit} | credits: ${relevantCredits}`);

        // Store user info for later use
        req.user = user;
        req.subscription = { tier, usage: currentUsage, limit, credits: relevantCredits };

      } else {
        // ==========================================
        // Anonymous User Check
        // ==========================================

        const fingerprintHash = req.body?.fingerprintHash;

        if (!fingerprintHash) {
          console.warn('[checkSubscriptionLimit] Missing fingerprint for anonymous request');
          return res.status(400).json({
            error: 'FINGERPRINT_REQUIRED',
            message: 'Browser fingerprint is required for anonymous users'
          });
        }

        // Get anonymous usage from browser_fingerprints table
        const { data: fingerprint, error: fpError } = await supabaseAdmin
          .from('browser_fingerprints')
          .select('monthly_usage_count, monthly_practice_count, usage_reset_month')
          .eq('fingerprint_hash', fingerprintHash)
          .single();

        if (fpError && fpError.code !== 'PGRST116') { // PGRST116 = not found (new user)
          console.error(`[checkSubscriptionLimit] Failed to get fingerprint ${fingerprintHash}:`, fpError);
          return res.status(500).json({ error: 'Failed to check usage' });
        }

        // Check if usage needs reset (new month)
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const usageResetMonth = fingerprint?.usage_reset_month;
        let currentUsage = 0;

        if (!fingerprint || usageResetMonth !== currentMonth) {
          // New user or new month - reset to 0
          currentUsage = 0;
        } else {
          // Use separate counters: practice_session uses monthly_practice_count, others use monthly_usage_count
          currentUsage = actionType === 'practice_session'
            ? (fingerprint.monthly_practice_count || 0)
            : (fingerprint.monthly_usage_count || 0);
        }

        // Anonymous limits (hardcoded for now, could move to app_config)
        const anonymousLimits = {
          video_analysis: 2,
          practice_session: 2
        };

        const limit = anonymousLimits[actionType] || 0;

        if (currentUsage >= limit) {
          console.warn(`[checkSubscriptionLimit] ANONYMOUS LIMIT EXCEEDED | fingerprint: ${fingerprintHash.slice(0, 8)}... | action: ${actionType} | usage: ${currentUsage}/${limit}`);
          return res.status(429).json({
            error: 'ANONYMOUS_LIMIT_EXCEEDED',
            message: `Anonymous users can only ${actionType.replace('_', ' ')} ${limit} times per month. Please sign in to continue.`,
            used: currentUsage,
            limit,
            signInRequired: true
          });
        }

        console.log(`[checkSubscriptionLimit] ALLOWED | anonymous fingerprint: ${fingerprintHash.slice(0, 8)}... | action: ${actionType} | usage: ${currentUsage}/${limit}`);

        // Store anonymous info for later use
        req.anonymous = { fingerprintHash, usage: currentUsage, limit };
      }

      // All checks passed - allow request
      next();

    } catch (error) {
      console.error('[checkSubscriptionLimit] Unexpected error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};
