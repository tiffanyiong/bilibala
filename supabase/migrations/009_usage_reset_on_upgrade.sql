-- Migration: Reset monthly usage when user upgrades from free to pro
-- Adds usage_reset_at column to user_subscriptions
-- Updates get_all_monthly_usage() to only count usage after the reset point
-- NOTE: This does NOT affect purchased credits (video_credits, ai_tutor_credit_minutes, etc.)

-- 1. Add usage_reset_at column
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS usage_reset_at TIMESTAMPTZ;

-- 2. Update get_all_monthly_usage() to respect usage_reset_at
CREATE OR REPLACE FUNCTION public.get_all_monthly_usage(p_user_id UUID)
RETURNS TABLE(
  videos_used INTEGER,
  practice_sessions_used INTEGER,
  ai_tutor_minutes_used INTEGER,
  pdf_exports_used INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cutoff TIMESTAMPTZ;
  reset_at TIMESTAMPTZ;
BEGIN
  -- Get the user's usage_reset_at timestamp (set on plan upgrade)
  SELECT us.usage_reset_at INTO reset_at
  FROM public.user_subscriptions us
  WHERE us.user_id = p_user_id;

  -- Use the later of: start of current month OR usage_reset_at
  cutoff := date_trunc('month', now());
  IF reset_at IS NOT NULL AND reset_at > cutoff THEN
    cutoff := reset_at;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN action_type = 'video_analysis' THEN 1 ELSE 0 END), 0)::INTEGER,
    COALESCE(SUM(CASE WHEN action_type = 'practice_session' THEN 1 ELSE 0 END), 0)::INTEGER,
    COALESCE(SUM(CASE WHEN action_type = 'ai_tutor' THEN (metadata->>'minutes_used')::INTEGER ELSE 0 END), 0)::INTEGER,
    COALESCE(SUM(CASE WHEN action_type = 'pdf_export' THEN 1 ELSE 0 END), 0)::INTEGER
  FROM public.usage_history
  WHERE user_id = p_user_id
    AND created_at >= cutoff;
END;
$$;
