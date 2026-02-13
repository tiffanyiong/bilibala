-- Migration 019: Use Billing Cycle for Pro User Usage Reset
-- Pro users' usage now resets based on their Stripe billing period (current_period_end)
-- Free users continue to reset on calendar months (1st of each month)

-- Update get_current_monthly_usage to use billing period for Pro users
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
  user_tier TEXT;
  period_end TIMESTAMPTZ;
  should_reset_monthly BOOLEAN := false;
BEGIN
  -- Get user's tier, usage tracking, and billing period
  SELECT us.tier, us.usage_month, us.usage_day, us.current_period_end
  INTO user_tier, stored_month, stored_day, period_end
  FROM public.user_subscriptions us
  WHERE us.user_id = p_user_id;

  -- Determine if monthly usage should reset
  IF user_tier = 'pro' AND period_end IS NOT NULL THEN
    -- Pro users: reset when billing period ends (current_period_end has passed)
    should_reset_monthly := now() >= period_end;
  ELSE
    -- Free users: reset on calendar month change
    should_reset_monthly := stored_month IS NULL OR stored_month <> current_month;
  END IF;

  -- Auto-reset monthly usage if needed
  IF should_reset_monthly THEN
    UPDATE public.user_subscriptions
    SET video_monthly_usage = 0,
        practice_session_monthly_usage = 0,
        ai_tutor_monthly_minutes_used = 0,
        usage_month = current_month,
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  -- Auto-reset daily practice usage if day changed (applies to free tier only)
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

-- Update increment_monthly_usage to use billing period for Pro users
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
  user_tier TEXT;
  period_end TIMESTAMPTZ;
  should_reset_monthly BOOLEAN := false;
  new_value INTEGER;
BEGIN
  -- Get user's tier, usage tracking, and billing period
  SELECT us.tier, us.usage_month, us.usage_day, us.current_period_end
  INTO user_tier, stored_month, stored_day, period_end
  FROM public.user_subscriptions us
  WHERE us.user_id = p_user_id;

  -- Determine if monthly usage should reset
  IF user_tier = 'pro' AND period_end IS NOT NULL THEN
    -- Pro users: reset when billing period ends
    should_reset_monthly := now() >= period_end;
  ELSE
    -- Free users: reset on calendar month change
    should_reset_monthly := stored_month IS NULL OR stored_month <> current_month;
  END IF;

  -- Auto-reset monthly usage if needed
  IF should_reset_monthly THEN
    UPDATE public.user_subscriptions
    SET video_monthly_usage = 0,
        practice_session_monthly_usage = 0,
        ai_tutor_monthly_minutes_used = 0,
        usage_month = current_month,
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  -- Auto-reset daily practice if day changed (free tier only)
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
