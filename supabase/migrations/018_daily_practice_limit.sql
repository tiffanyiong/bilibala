-- Migration 018: Daily Practice Session Limit for Free Users
-- Changes practice sessions from 5/month to 2/day for free tier
-- Pro users continue to have unlimited practice sessions
-- Anonymous users are NOT affected by this change (they keep monthly limit)

-- 1. Add daily usage tracking columns to user_subscriptions
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS practice_session_daily_usage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS usage_day TEXT;

-- Initialize usage_day for existing rows to current UTC day
UPDATE public.user_subscriptions
SET usage_day = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')
WHERE usage_day IS NULL;

-- 2. Update get_current_monthly_usage function to also handle daily reset
-- This function now returns both monthly AND daily usage
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
  current_month TEXT := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  current_day TEXT := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  stored_month TEXT;
  stored_day TEXT;
BEGIN
  -- Get stored usage_month and usage_day
  SELECT us.usage_month, us.usage_day INTO stored_month, stored_day
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

  -- Auto-reset daily practice usage if day changed
  IF stored_day IS NULL OR stored_day <> current_day THEN
    UPDATE public.user_subscriptions
    SET practice_session_daily_usage = 0,
        usage_day = current_day,
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

-- 3. Create new function to get daily practice usage
CREATE OR REPLACE FUNCTION public.get_current_daily_practice_usage(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_day TEXT := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  stored_day TEXT;
  daily_usage INTEGER;
BEGIN
  -- Get stored usage_day
  SELECT us.usage_day, us.practice_session_daily_usage
  INTO stored_day, daily_usage
  FROM public.user_subscriptions us
  WHERE us.user_id = p_user_id;

  -- Auto-reset if day changed
  IF stored_day IS NULL OR stored_day <> current_day THEN
    UPDATE public.user_subscriptions
    SET practice_session_daily_usage = 0,
        usage_day = current_day,
        updated_at = now()
    WHERE user_id = p_user_id;
    RETURN 0;
  END IF;

  RETURN COALESCE(daily_usage, 0);
END;
$$;

-- 4. Update increment_monthly_usage to also handle daily practice increment
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
  current_month TEXT := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  current_day TEXT := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  stored_month TEXT;
  stored_day TEXT;
  new_value INTEGER;
BEGIN
  -- Get stored usage_month and usage_day
  SELECT us.usage_month, us.usage_day INTO stored_month, stored_day
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

  -- Auto-reset daily practice if day changed
  IF stored_day IS NULL OR stored_day <> current_day THEN
    UPDATE public.user_subscriptions
    SET practice_session_daily_usage = 0,
        usage_day = current_day,
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
    -- For practice sessions, increment BOTH monthly and daily counters
    UPDATE public.user_subscriptions
    SET practice_session_monthly_usage = COALESCE(practice_session_monthly_usage, 0) + p_amount,
        practice_session_daily_usage = COALESCE(practice_session_daily_usage, 0) + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING practice_session_daily_usage INTO new_value;

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

-- 5. Update reset_monthly_usage to also reset daily usage
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
      practice_session_daily_usage = 0,
      ai_tutor_monthly_minutes_used = 0,
      usage_month = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM'),
      usage_day = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- 6. Add app_config for daily practice limit
INSERT INTO public.app_config (key, value, description)
VALUES
  ('free_practice_sessions_per_day', '2', 'Max practice sessions per day for free tier')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, description = EXCLUDED.description;

-- Update the monthly config description to clarify it's no longer used for free tier
UPDATE public.app_config
SET description = 'DEPRECATED: Max practice sessions per month (now using daily limit for free tier)'
WHERE key = 'free_practice_sessions_per_month';
