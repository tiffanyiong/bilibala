import { getCurrentMonth, getFingerprint } from './fingerprint';
import { supabase } from './supabaseClient';

const FREE_LIMIT = 3;

// 1. Base status for logic checks (date is optional)
export interface UsageStatus {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetDate?: string;
}

// 2. Type for UI Display (date is REQUIRED)
export interface UsageDisplayInfo extends UsageStatus {
  resetDate: string;
}

/**
 * Check anonymous usage limit against browser_fingerprints table
 */
export async function checkAnonymousUsageLimit(): Promise<UsageStatus> {
  const fingerprint = await getFingerprint();
  const currentMonth = getCurrentMonth();

  const { data, error } = await supabase
    .from('browser_fingerprints')
    .select('monthly_usage_count, usage_reset_month')
    .eq('fingerprint_hash', fingerprint)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found (new user), other errors should be logged
    console.error('[UsageTracking] Error checking usage limit:', error);
  }

  let used = 0;
  if (data) {
    // Check if it's the same month, otherwise count resets to 0
    if (data.usage_reset_month === currentMonth) {
      used = data.monthly_usage_count || 0;
    }
  }

  return {
    allowed: used < FREE_LIMIT,
    used,
    limit: FREE_LIMIT,
    remaining: Math.max(0, FREE_LIMIT - used)
  };
}

/**
 * Record anonymous usage in browser_fingerprints table
 */
export async function recordAnonymousUsage(): Promise<void> {
  const fingerprint = await getFingerprint();
  const currentMonth = getCurrentMonth();

  // Check if fingerprint exists
  const { data: existing, error: fetchError } = await supabase
    .from('browser_fingerprints')
    .select('id, monthly_usage_count, usage_reset_month')
    .eq('fingerprint_hash', fingerprint)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('[UsageTracking] Error fetching fingerprint:', fetchError);
  }

  if (existing) {
    // Fingerprint exists - update it
    let newCount = 1;
    if (existing.usage_reset_month === currentMonth) {
      // Same month, increment
      newCount = (existing.monthly_usage_count || 0) + 1;
    }
    // Different month or first usage this month, reset to 1

    const { error } = await supabase
      .from('browser_fingerprints')
      .update({
        monthly_usage_count: newCount,
        usage_reset_month: currentMonth,
        last_seen_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    if (error) {
      console.error('[UsageTracking] Error updating usage:', error);
    }
  } else {
    // New fingerprint - insert
    const { error } = await supabase
      .from('browser_fingerprints')
      .insert({
        fingerprint_hash: fingerprint,
        monthly_usage_count: 1,
        usage_reset_month: currentMonth,
        last_seen_at: new Date().toISOString()
      });

    if (error) {
      console.error('[UsageTracking] Error inserting usage:', error);
    }
  }
}

/**
 * Get usage info formatted for UI display
 */
export async function getUsageDisplayInfo(): Promise<UsageDisplayInfo> {
  const status = await checkAnonymousUsageLimit();

  // Calculate reset date (first of next month)
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const resetDate = nextMonth.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric'
  });

  return {
    ...status,
    resetDate
  };
}
