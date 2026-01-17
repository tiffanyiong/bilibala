/**
 * Usage Service
 * Handles usage tracking and limits for both anonymous and authenticated users.
 *
 * - Anonymous users: Tracked by browser fingerprint in `browser_fingerprints` table
 * - Free users: Tracked in `user_subscriptions` table
 * - Pro/Admin users: Unlimited access
 * - Flex users: Credit-based system
 */

import { supabase } from './supabaseClient';
import { getFingerprint, getCurrentMonth } from './fingerprint';

// Types
export type UserTier = 'free' | 'pro' | 'flex' | 'admin';

export interface UsageInfo {
  allowed: boolean;
  tier: UserTier | 'anonymous';
  usageCount: number;
  usageLimit: number;
  remaining: number;
  creditsBalance?: number;
  resetDate: string;
}

export interface UsageCheckResult {
  allowed: boolean;
  usageInfo: UsageInfo;
  fingerprintId?: string;
}

const FREE_LIMIT = 3;

/**
 * Get the reset date (first of next month) formatted for display
 */
function getResetDateDisplay(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Check if a user (or anonymous fingerprint) can perform an action.
 * Does NOT increment usage - call recordUsage() after successful action.
 */
export async function checkUsageLimit(userId?: string): Promise<UsageCheckResult> {
  const currentMonth = getCurrentMonth();
  const resetDate = getResetDateDisplay();

  if (userId) {
    // Authenticated user - check user_subscriptions
    return checkUserUsage(userId, currentMonth, resetDate);
  } else {
    // Anonymous user - check by fingerprint
    return checkFingerprintUsage(currentMonth, resetDate);
  }
}

/**
 * Check usage for authenticated user
 */
async function checkUserUsage(
  userId: string,
  currentMonth: string,
  resetDate: string
): Promise<UsageCheckResult> {
  try {
    const { data, error } = await supabase.rpc('get_user_usage', {
      p_user_id: userId,
      p_current_month: currentMonth
    });

    if (error) {
      console.error('Error checking user usage:', error);
      // Fail open - allow access on error
      return {
        allowed: true,
        usageInfo: {
          allowed: true,
          tier: 'free',
          usageCount: 0,
          usageLimit: FREE_LIMIT,
          remaining: FREE_LIMIT,
          resetDate
        }
      };
    }

    const result = data?.[0];

    if (!result) {
      // No subscription record, treat as new free user
      return {
        allowed: true,
        usageInfo: {
          allowed: true,
          tier: 'free',
          usageCount: 0,
          usageLimit: FREE_LIMIT,
          remaining: FREE_LIMIT,
          resetDate
        }
      };
    }

    const tier = result.tier as UserTier;

    // Pro and Admin have unlimited access
    if (tier === 'pro' || tier === 'admin') {
      return {
        allowed: true,
        usageInfo: {
          allowed: true,
          tier,
          usageCount: -1,
          usageLimit: -1,
          remaining: -1,
          resetDate
        }
      };
    }

    // Flex tier uses credits
    if (tier === 'flex') {
      const hasCredits = result.credits_balance > 0;
      return {
        allowed: hasCredits,
        usageInfo: {
          allowed: hasCredits,
          tier: 'flex',
          usageCount: -1,
          usageLimit: -1,
          remaining: -1,
          creditsBalance: result.credits_balance,
          resetDate
        }
      };
    }

    // Free tier
    const usageCount = result.usage_count || 0;
    const remaining = Math.max(0, FREE_LIMIT - usageCount);

    return {
      allowed: usageCount < FREE_LIMIT,
      usageInfo: {
        allowed: usageCount < FREE_LIMIT,
        tier: 'free',
        usageCount,
        usageLimit: FREE_LIMIT,
        remaining,
        resetDate
      }
    };
  } catch (err) {
    console.error('Error in checkUserUsage:', err);
    // Fail open
    return {
      allowed: true,
      usageInfo: {
        allowed: true,
        tier: 'free',
        usageCount: 0,
        usageLimit: FREE_LIMIT,
        remaining: FREE_LIMIT,
        resetDate
      }
    };
  }
}

/**
 * Check usage for anonymous user by fingerprint
 */
async function checkFingerprintUsage(
  currentMonth: string,
  resetDate: string
): Promise<UsageCheckResult> {
  try {
    const fingerprint = await getFingerprint();

    const { data, error } = await supabase.rpc('get_fingerprint_usage', {
      p_fingerprint_hash: fingerprint,
      p_current_month: currentMonth
    });

    if (error) {
      console.error('Error checking fingerprint usage:', error);
      // Fail open
      return {
        allowed: true,
        usageInfo: {
          allowed: true,
          tier: 'anonymous',
          usageCount: 0,
          usageLimit: FREE_LIMIT,
          remaining: FREE_LIMIT,
          resetDate
        }
      };
    }

    const result = data?.[0];

    if (!result) {
      // New fingerprint
      return {
        allowed: true,
        usageInfo: {
          allowed: true,
          tier: 'anonymous',
          usageCount: 0,
          usageLimit: FREE_LIMIT,
          remaining: FREE_LIMIT,
          resetDate
        }
      };
    }

    return {
      allowed: result.allowed,
      usageInfo: {
        allowed: result.allowed,
        tier: 'anonymous',
        usageCount: result.usage_count,
        usageLimit: FREE_LIMIT,
        remaining: result.remaining,
        resetDate
      }
    };
  } catch (err) {
    console.error('Error in checkFingerprintUsage:', err);
    // Fail open
    return {
      allowed: true,
      usageInfo: {
        allowed: true,
        tier: 'anonymous',
        usageCount: 0,
        usageLimit: FREE_LIMIT,
        remaining: FREE_LIMIT,
        resetDate
      }
    };
  }
}

/**
 * Record usage after successful action.
 * This increments the usage counter.
 */
export async function recordUsage(
  userId?: string,
  actionType: string = 'video_analysis',
  metadata?: {
    videoId?: string;
    analysisId?: string;
    wasCached?: boolean;
  }
): Promise<{ success: boolean; fingerprintId?: string }> {
  const currentMonth = getCurrentMonth();

  if (userId) {
    return recordUserUsage(userId, currentMonth, actionType, metadata);
  } else {
    return recordFingerprintUsage(currentMonth, actionType, metadata);
  }
}

/**
 * Record usage for authenticated user
 */
async function recordUserUsage(
  userId: string,
  currentMonth: string,
  actionType: string,
  metadata?: {
    videoId?: string;
    analysisId?: string;
    wasCached?: boolean;
  }
): Promise<{ success: boolean }> {
  try {
    // Increment usage count
    const { data, error } = await supabase.rpc('check_and_increment_user_usage', {
      p_user_id: userId,
      p_current_month: currentMonth
    });

    if (error) {
      console.error('Error recording user usage:', error);
      return { success: false };
    }

    // Log the usage record
    await supabase.from('usage_records').insert({
      user_id: userId,
      action_type: actionType,
      video_id: metadata?.videoId || null,
      analysis_id: metadata?.analysisId || null,
      was_cached: metadata?.wasCached || false,
      credits_used: data?.[0]?.tier === 'flex' ? 1 : 0
    });

    return { success: true };
  } catch (err) {
    console.error('Error in recordUserUsage:', err);
    return { success: false };
  }
}

/**
 * Record usage for anonymous user
 */
async function recordFingerprintUsage(
  currentMonth: string,
  actionType: string,
  metadata?: {
    videoId?: string;
    analysisId?: string;
    wasCached?: boolean;
  }
): Promise<{ success: boolean; fingerprintId?: string }> {
  try {
    const fingerprint = await getFingerprint();

    // Increment usage count
    const { data, error } = await supabase.rpc('check_and_increment_fingerprint_usage', {
      p_fingerprint_hash: fingerprint,
      p_current_month: currentMonth
    });

    if (error) {
      console.error('Error recording fingerprint usage:', error);
      return { success: false };
    }

    const result = data?.[0];
    const fingerprintId = result?.fingerprint_id;

    // Log the usage record
    if (fingerprintId) {
      await supabase.from('usage_records').insert({
        fingerprint_id: fingerprintId,
        action_type: actionType,
        video_id: metadata?.videoId || null,
        analysis_id: metadata?.analysisId || null,
        was_cached: metadata?.wasCached || false
      });
    }

    return { success: true, fingerprintId };
  } catch (err) {
    console.error('Error in recordFingerprintUsage:', err);
    return { success: false };
  }
}

/**
 * Get display info for usage limit modal
 */
export function formatUsageForDisplay(usageInfo: UsageInfo): {
  used: number;
  limit: number;
  remaining: number;
  resetDate: string;
  tierDisplay: string;
  isUnlimited: boolean;
} {
  const isUnlimited = usageInfo.tier === 'pro' || usageInfo.tier === 'admin';

  let tierDisplay: string;
  switch (usageInfo.tier) {
    case 'admin':
      tierDisplay = 'Admin';
      break;
    case 'pro':
      tierDisplay = 'Pro';
      break;
    case 'flex':
      tierDisplay = 'Pay-as-you-go';
      break;
    case 'free':
      tierDisplay = 'Free';
      break;
    default:
      tierDisplay = 'Guest';
  }

  return {
    used: isUnlimited ? 0 : usageInfo.usageCount,
    limit: isUnlimited ? -1 : usageInfo.usageLimit,
    remaining: isUnlimited ? -1 : usageInfo.remaining,
    resetDate: usageInfo.resetDate,
    tierDisplay,
    isUnlimited
  };
}
