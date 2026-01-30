import { supabase } from './supabaseClient';
import {
  DbUserSubscription,
  MonthlyUsage,
  SubscriptionTier,
  TIER_LIMITS,
  UsageActionType,
} from '../types/database';

// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================

/**
 * Get or create user subscription record.
 * Every authenticated user gets a 'free' tier by default.
 */
export async function getOrCreateSubscription(
  userId: string
): Promise<DbUserSubscription | null> {
  // Try to get existing
  const { data: existing, error: fetchError } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing && !fetchError) {
    return existing as DbUserSubscription;
  }

  // Create new free subscription
  if (fetchError?.code === 'PGRST116' || !existing) {
    const { data: created, error: insertError } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        tier: 'free',
        subscription_status: 'active',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating subscription:', insertError);
      return null;
    }

    return created as DbUserSubscription;
  }

  console.error('Error fetching subscription:', fetchError);
  return null;
}

/**
 * Update subscription after Stripe webhook
 */
export async function updateSubscription(
  userId: string,
  updates: Partial<Pick<DbUserSubscription,
    'tier' | 'stripe_customer_id' | 'stripe_subscription_id' |
    'subscription_status' | 'current_period_start' | 'current_period_end'
  >>
): Promise<DbUserSubscription | null> {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating subscription:', error);
    return null;
  }

  return data as DbUserSubscription;
}

// ============================================
// USAGE TRACKING
// ============================================

/**
 * Record a usage action (video analysis, practice session, etc.)
 */
export async function recordUsage(
  userId: string,
  actionType: UsageActionType,
  metadata: Record<string, unknown> = {}
): Promise<boolean> {
  const { error } = await supabase
    .from('usage_history')
    .insert({
      user_id: userId,
      action_type: actionType,
      metadata,
    });

  if (error) {
    console.error('Error recording usage:', error);
    return false;
  }

  return true;
}

/**
 * Get current month's usage counts via RPC function
 */
export async function getMonthlyUsage(
  userId: string
): Promise<MonthlyUsage> {
  const defaultUsage: MonthlyUsage = {
    videosUsed: 0,
    practiceSessionsUsed: 0,
    aiTutorMinutesUsed: 0,
    pdfExportsUsed: 0,
  };

  const { data, error } = await supabase.rpc('get_all_monthly_usage', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error fetching monthly usage:', error);
    return defaultUsage;
  }

  if (data && data.length > 0) {
    const row = data[0];
    return {
      videosUsed: row.videos_used || 0,
      practiceSessionsUsed: row.practice_sessions_used || 0,
      aiTutorMinutesUsed: row.ai_tutor_minutes_used || 0,
      pdfExportsUsed: row.pdf_exports_used || 0,
    };
  }

  return defaultUsage;
}

/**
 * Deduct AI tutor credits from user's balance.
 * Called when user uses AI tutor and has credits.
 * Returns the number of minutes actually deducted.
 */
export async function deductAiTutorCredits(
  userId: string,
  minutes: number
): Promise<number> {
  const { data, error } = await supabase.rpc('deduct_ai_tutor_credits', {
    p_user_id: userId,
    p_minutes: minutes,
  });

  if (error) {
    console.error('Error deducting AI tutor credits:', error);
    return 0;
  }

  return data || 0;
}

/**
 * Deduct practice session credits from user's balance.
 * Called when free user uses a practice session and has credits.
 * Returns 1 if deducted, 0 if no credits available.
 */
export async function deductPracticeCredits(
  userId: string
): Promise<number> {
  const { data, error } = await supabase.rpc('deduct_practice_credits', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error deducting practice credits:', error);
    return 0;
  }

  return data || 0;
}

/**
 * Check if a specific action is allowed based on tier and usage
 */
export async function checkActionAllowed(
  userId: string,
  tier: SubscriptionTier,
  actionType: UsageActionType
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const limits = TIER_LIMITS[tier];
  const usage = await getMonthlyUsage(userId);

  switch (actionType) {
    case 'video_analysis':
      return {
        allowed: usage.videosUsed < limits.videosPerMonth,
        used: usage.videosUsed,
        limit: limits.videosPerMonth,
      };
    case 'practice_session':
      return {
        allowed: usage.practiceSessionsUsed < limits.practiceSessionsPerMonth,
        used: usage.practiceSessionsUsed,
        limit: limits.practiceSessionsPerMonth,
      };
    case 'ai_tutor':
      return {
        allowed: usage.aiTutorMinutesUsed < limits.aiTutorMinutesPerMonth,
        used: usage.aiTutorMinutesUsed,
        limit: limits.aiTutorMinutesPerMonth,
      };
    case 'pdf_export':
      return {
        allowed: limits.pdfExport,
        used: usage.pdfExportsUsed,
        limit: limits.pdfExport ? Infinity : 0,
      };
    default:
      return { allowed: false, used: 0, limit: 0 };
  }
}
