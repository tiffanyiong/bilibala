import { getCurrentMonth, getFingerprint } from './fingerprint';
import { supabase } from './supabaseClient';

const FREE_LIMIT = 2;
const FREE_PRACTICE_LIMIT = 2;

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
 * Check anonymous practice session limit against browser_fingerprints table
 */
export async function checkAnonymousPracticeLimit(): Promise<UsageStatus> {
  const fingerprint = await getFingerprint();
  const currentMonth = getCurrentMonth();

  const { data, error } = await supabase
    .from('browser_fingerprints')
    .select('practice_session_count, practice_reset_month')
    .eq('fingerprint_hash', fingerprint)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[UsageTracking] Error checking practice limit:', error);
  }

  let used = 0;
  if (data) {
    if (data.practice_reset_month === currentMonth) {
      used = data.practice_session_count || 0;
    }
  }

  return {
    allowed: used < FREE_PRACTICE_LIMIT,
    used,
    limit: FREE_PRACTICE_LIMIT,
    remaining: Math.max(0, FREE_PRACTICE_LIMIT - used)
  };
}

/**
 * Record anonymous practice session usage in browser_fingerprints table
 */
export async function recordAnonymousPractice(): Promise<void> {
  const fingerprint = await getFingerprint();
  const currentMonth = getCurrentMonth();

  const { data: existing, error: fetchError } = await supabase
    .from('browser_fingerprints')
    .select('id, practice_session_count, practice_reset_month')
    .eq('fingerprint_hash', fingerprint)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('[UsageTracking] Error fetching fingerprint for practice:', fetchError);
  }

  if (existing) {
    let newCount = 1;
    if (existing.practice_reset_month === currentMonth) {
      newCount = (existing.practice_session_count || 0) + 1;
    }

    const { error } = await supabase
      .from('browser_fingerprints')
      .update({
        practice_session_count: newCount,
        practice_reset_month: currentMonth,
        last_seen_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    if (error) {
      console.error('[UsageTracking] Error updating practice usage:', error);
    }
  } else {
    const { error } = await supabase
      .from('browser_fingerprints')
      .insert({
        fingerprint_hash: fingerprint,
        practice_session_count: 1,
        practice_reset_month: currentMonth,
        monthly_usage_count: 0,
        usage_reset_month: currentMonth,
        last_seen_at: new Date().toISOString()
      });

    if (error) {
      console.error('[UsageTracking] Error inserting practice usage:', error);
    }
  }
}

/**
 * Track page visit (landing page) - called once per session
 * Uses sessionStorage to prevent duplicate tracking during same session
 */
export async function trackPageVisit(userId?: string): Promise<void> {
  // Check if already tracked this session
  const sessionTracked = sessionStorage.getItem('page_visit_tracked');
  if (sessionTracked) {
    console.log('[Analytics] Page visit already tracked this session');
    return;
  }

  try {
    const fingerprint = await getFingerprint();
    const now = new Date().toISOString();

    // Check if fingerprint exists in DB
    const { data: existing, error: fetchError } = await supabase
      .from('browser_fingerprints')
      .select('id, page_visit_count, user_id')
      .eq('fingerprint_hash', fingerprint)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[Analytics] Error fetching fingerprint:', fetchError);
      return;
    }

    if (existing) {
      // Update existing fingerprint
      const updateData: any = {
        page_visit_count: (existing.page_visit_count || 0) + 1,
        last_page_visit_at: now,
        last_seen_at: now
      };

      // Link to user if signed in and not already linked
      if (userId && !existing.user_id) {
        updateData.user_id = userId;
      }

      const { error } = await supabase
        .from('browser_fingerprints')
        .update(updateData)
        .eq('id', existing.id);

      if (error) {
        console.error('[Analytics] Error updating page visit:', error);
      }
    } else {
      // New visitor - insert fingerprint
      const { error } = await supabase
        .from('browser_fingerprints')
        .insert({
          fingerprint_hash: fingerprint,
          user_id: userId || null,
          page_visit_count: 1,
          first_page_visit_at: now,
          last_page_visit_at: now,
          first_seen_at: now,
          last_seen_at: now,
          monthly_usage_count: 0,
          usage_reset_month: getCurrentMonth()
        });

      if (error) {
        console.error('[Analytics] Error inserting page visit:', error);
      }
    }

    // Mark as tracked for this session
    sessionStorage.setItem('page_visit_tracked', 'true');
    console.log('[Analytics] Page visit tracked successfully');
  } catch (error) {
    console.error('[Analytics] Error tracking page visit:', error);
  }
}

/**
 * Get usage info formatted for UI display
 */
export async function getUsageDisplayInfo(): Promise<UsageDisplayInfo> {
  const status = await checkAnonymousUsageLimit();

  // Calculate reset date (one month from today)
  const now = new Date();
  const resetDateObj = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const resetDate = resetDateObj.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric'
  });

  return {
    ...status,
    resetDate
  };
}
