-- Migration 012: Add monthly usage columns to user_subscriptions
-- Separates monthly usage tracking (resets each month) from purchased credits (never expire).
-- These columns become the source of truth for monthly usage; usage_history is kept as audit log.

-- 1. Add monthly usage counter columns
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS video_monthly_usage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS practice_session_monthly_usage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_tutor_monthly_minutes_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS usage_month TEXT;

-- Initialize usage_month for existing rows to current month
UPDATE public.user_subscriptions
SET usage_month = to_char(now(), 'YYYY-MM')
WHERE usage_month IS NULL;

-- 2. Function: get_current_monthly_usage
-- Returns monthly usage values, auto-resets if the month has changed.
CREATE OR REPLACE FUNCTION public.get_current_monthly_usage(p_user_id UUID)
RETURNS TABLE(
  videos_used INTEGER,
  practice_sessions_used INTEGER,
  ai_tutor_minutes_used INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month TEXT := to_char(now(), 'YYYY-MM');
  stored_month TEXT;
BEGIN
  -- Get stored usage_month
  SELECT us.usage_month INTO stored_month
  FROM public.user_subscriptions us
  WHERE us.user_id = p_user_id;

  -- Auto-reset if month changed
  IF stored_month IS NULL OR stored_month <> current_month THEN
    UPDATE public.user_subscriptions
    SET video_monthly_usage = 0,
        practice_session_monthly_usage = 0,
        ai_tutor_monthly_minutes_used = 0,
        usage_month = current_month,
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(us.video_monthly_usage, 0),
    COALESCE(us.practice_session_monthly_usage, 0),
    COALESCE(us.ai_tutor_monthly_minutes_used, 0)
  FROM public.user_subscriptions us
  WHERE us.user_id = p_user_id;
END;
$$;

-- 3. Function: increment_monthly_usage
-- Increments the appropriate monthly usage column. Auto-resets if month changed.
-- Returns the new value of the incremented column.
CREATE OR REPLACE FUNCTION public.increment_monthly_usage(
  p_user_id UUID,
  p_action_type TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month TEXT := to_char(now(), 'YYYY-MM');
  stored_month TEXT;
  new_value INTEGER;
BEGIN
  -- Get stored usage_month
  SELECT us.usage_month INTO stored_month
  FROM public.user_subscriptions us
  WHERE us.user_id = p_user_id;

  -- Auto-reset if month changed
  IF stored_month IS NULL OR stored_month <> current_month THEN
    UPDATE public.user_subscriptions
    SET video_monthly_usage = 0,
        practice_session_monthly_usage = 0,
        ai_tutor_monthly_minutes_used = 0,
        usage_month = current_month,
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  -- Increment the appropriate column
  IF p_action_type = 'video_analysis' THEN
    UPDATE public.user_subscriptions
    SET video_monthly_usage = COALESCE(video_monthly_usage, 0) + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING video_monthly_usage INTO new_value;

  ELSIF p_action_type = 'practice_session' THEN
    UPDATE public.user_subscriptions
    SET practice_session_monthly_usage = COALESCE(practice_session_monthly_usage, 0) + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING practice_session_monthly_usage INTO new_value;

  ELSIF p_action_type = 'ai_tutor' THEN
    UPDATE public.user_subscriptions
    SET ai_tutor_monthly_minutes_used = COALESCE(ai_tutor_monthly_minutes_used, 0) + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING ai_tutor_monthly_minutes_used INTO new_value;

  ELSE
    -- Unknown action type, return 0
    new_value := 0;
  END IF;

  RETURN COALESCE(new_value, 0);
END;
$$;

-- 4. Function: reset_monthly_usage
-- Resets all monthly counters to 0. Called on plan upgrade.
CREATE OR REPLACE FUNCTION public.reset_monthly_usage(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_subscriptions
  SET video_monthly_usage = 0,
      practice_session_monthly_usage = 0,
      ai_tutor_monthly_minutes_used = 0,
      usage_month = to_char(now(), 'YYYY-MM'),
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;
