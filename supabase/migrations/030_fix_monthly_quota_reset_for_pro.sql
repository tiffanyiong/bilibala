-- Migration 030: Fix Monthly Quota Resets for Pro Billing Intervals
--
-- Monthly usage counters are monthly allowances, not subscription-period counters.
-- This fixes two reset bugs:
-- 1. Monthly Pro: Stripe may advance current_period_start/current_period_end before
--    the app reads usage, so checking now() >= current_period_end can miss the reset.
-- 2. Annual Pro: current_period_end is a year away, but video/AI tutor allowances
--    still reset monthly.
-- 3. Free users should get 3 video analyses per account month, not per
--    calendar month. A June 16 signup resets on July 16.

CREATE OR REPLACE FUNCTION public.get_monthly_quota_period_start(
  p_anchor_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  months_elapsed INTEGER;
  quota_start TIMESTAMPTZ;
BEGIN
  IF p_anchor_start IS NULL THEN
    RETURN NULL;
  END IF;

  months_elapsed := GREATEST(
    0,
    (
      EXTRACT(YEAR FROM age(now(), p_anchor_start))::INTEGER * 12
      + EXTRACT(MONTH FROM age(now(), p_anchor_start))::INTEGER
    )
  );

  quota_start := p_anchor_start + make_interval(months => months_elapsed);

  -- Do not create a quota start beyond a known paid period.
  IF p_period_end IS NOT NULL AND quota_start >= p_period_end THEN
    RETURN p_period_end;
  END IF;

  RETURN quota_start;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pro_quota_period_start(
  p_billing_interval TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF p_period_start IS NULL THEN
    RETURN NULL;
  END IF;

  -- Monthly Stripe subscriptions already expose the current monthly period start.
  IF COALESCE(p_billing_interval, 'month') = 'month' THEN
    RETURN p_period_start;
  END IF;

  -- Annual subscriptions have a yearly Stripe period, but the product allowance
  -- is monthly. Use monthly anniversaries from the annual period start.
  RETURN public.get_monthly_quota_period_start(p_period_start, p_period_end);
END;
$$;

CREATE OR REPLACE FUNCTION public.should_reset_monthly_usage(
  p_tier TEXT,
  p_billing_interval TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_usage_reset_at TIMESTAMPTZ,
  p_usage_month TEXT,
  p_account_created_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  current_month TEXT := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  quota_start TIMESTAMPTZ;
BEGIN
  IF p_tier = 'pro' THEN
    quota_start := public.get_pro_quota_period_start(
      p_billing_interval,
      p_period_start,
      p_period_end
    );

    IF quota_start IS NOT NULL THEN
      RETURN p_usage_reset_at IS NULL OR p_usage_reset_at < quota_start;
    END IF;
  END IF;

  -- Free users get video/monthly allowances by account month, anchored to
  -- signup/subscription-row creation date. Example: June 16 -> July 16.
  IF p_tier = 'free' AND p_account_created_at IS NOT NULL THEN
    quota_start := public.get_monthly_quota_period_start(p_account_created_at);
    RETURN p_usage_reset_at IS NULL OR p_usage_reset_at < quota_start;
  END IF;

  -- Canceled users and rows missing anchor data fall back to calendar month.
  RETURN p_usage_month IS NULL OR p_usage_month <> current_month;
END;
$$;

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
  billing_interval_value TEXT;
  period_start TIMESTAMPTZ;
  period_end TIMESTAMPTZ;
  reset_at TIMESTAMPTZ;
  account_created_at TIMESTAMPTZ;
  quota_start TIMESTAMPTZ;
  should_reset_monthly BOOLEAN := false;
BEGIN
  SELECT
    us.tier,
    us.billing_interval,
    us.usage_month,
    us.usage_day,
    us.current_period_start,
    us.current_period_end,
    us.usage_reset_at,
    us.created_at
  INTO
    user_tier,
    billing_interval_value,
    stored_month,
    stored_day,
    period_start,
    period_end,
    reset_at,
    account_created_at
  FROM public.user_subscriptions us
  WHERE us.user_id = p_user_id;

  should_reset_monthly := public.should_reset_monthly_usage(
    user_tier,
    billing_interval_value,
    period_start,
    period_end,
    reset_at,
    stored_month,
    account_created_at
  );

  IF should_reset_monthly THEN
    quota_start := CASE
      WHEN user_tier = 'pro' THEN public.get_pro_quota_period_start(
        billing_interval_value,
        period_start,
        period_end
      )
      WHEN user_tier = 'free' THEN public.get_monthly_quota_period_start(account_created_at)
      ELSE NULL
    END;

    UPDATE public.user_subscriptions
    SET video_monthly_usage = 0,
        practice_session_monthly_usage = 0,
        ai_tutor_monthly_minutes_used = 0,
        usage_month = current_month,
        usage_reset_at = CASE
          WHEN quota_start IS NOT NULL THEN quota_start
          ELSE now()
        END,
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

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
  billing_interval_value TEXT;
  period_start TIMESTAMPTZ;
  period_end TIMESTAMPTZ;
  reset_at TIMESTAMPTZ;
  account_created_at TIMESTAMPTZ;
  quota_start TIMESTAMPTZ;
  should_reset_monthly BOOLEAN := false;
  new_value INTEGER;
BEGIN
  SELECT
    us.tier,
    us.billing_interval,
    us.usage_month,
    us.usage_day,
    us.current_period_start,
    us.current_period_end,
    us.usage_reset_at,
    us.created_at
  INTO
    user_tier,
    billing_interval_value,
    stored_month,
    stored_day,
    period_start,
    period_end,
    reset_at,
    account_created_at
  FROM public.user_subscriptions us
  WHERE us.user_id = p_user_id;

  should_reset_monthly := public.should_reset_monthly_usage(
    user_tier,
    billing_interval_value,
    period_start,
    period_end,
    reset_at,
    stored_month,
    account_created_at
  );

  IF should_reset_monthly THEN
    quota_start := CASE
      WHEN user_tier = 'pro' THEN public.get_pro_quota_period_start(
        billing_interval_value,
        period_start,
        period_end
      )
      WHEN user_tier = 'free' THEN public.get_monthly_quota_period_start(account_created_at)
      ELSE NULL
    END;

    UPDATE public.user_subscriptions
    SET video_monthly_usage = 0,
        practice_session_monthly_usage = 0,
        ai_tutor_monthly_minutes_used = 0,
        usage_month = current_month,
        usage_reset_at = CASE
          WHEN quota_start IS NOT NULL THEN quota_start
          ELSE now()
        END,
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  IF stored_day IS NULL OR stored_day <> current_day THEN
    UPDATE public.user_subscriptions
    SET practice_session_daily_usage = 0,
        usage_day = current_day,
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  IF p_action_type = 'video_analysis' THEN
    UPDATE public.user_subscriptions
    SET video_monthly_usage = COALESCE(video_monthly_usage, 0) + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING video_monthly_usage INTO new_value;

  ELSIF p_action_type = 'practice_session' THEN
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
    new_value := 0;
  END IF;

  RETURN COALESCE(new_value, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_monthly_usage(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month TEXT := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  current_day TEXT := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  user_tier TEXT;
  billing_interval_value TEXT;
  period_start TIMESTAMPTZ;
  period_end TIMESTAMPTZ;
  account_created_at TIMESTAMPTZ;
  quota_start TIMESTAMPTZ;
BEGIN
  SELECT us.tier, us.billing_interval, us.current_period_start, us.current_period_end, us.created_at
  INTO user_tier, billing_interval_value, period_start, period_end, account_created_at
  FROM public.user_subscriptions us
  WHERE us.user_id = p_user_id;

  quota_start := CASE
    WHEN user_tier = 'pro' THEN public.get_pro_quota_period_start(
      billing_interval_value,
      period_start,
      period_end
    )
    WHEN user_tier = 'free' THEN public.get_monthly_quota_period_start(account_created_at)
    ELSE NULL
  END;

  UPDATE public.user_subscriptions
  SET video_monthly_usage = 0,
      practice_session_monthly_usage = 0,
      practice_session_daily_usage = 0,
      ai_tutor_monthly_minutes_used = 0,
      usage_month = current_month,
      usage_day = current_day,
      usage_reset_at = CASE
        WHEN quota_start IS NOT NULL THEN quota_start
        ELSE now()
      END,
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Repair rows that are already stale at migration time.
UPDATE public.user_subscriptions
SET video_monthly_usage = 0,
    practice_session_monthly_usage = 0,
    ai_tutor_monthly_minutes_used = 0,
    usage_month = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM'),
    usage_reset_at = COALESCE(
      CASE
        WHEN tier = 'pro' THEN public.get_pro_quota_period_start(
          billing_interval,
          current_period_start,
          current_period_end
        )
        WHEN tier = 'free' THEN public.get_monthly_quota_period_start(created_at)
        ELSE NULL
      END,
      now()
    ),
    updated_at = now()
WHERE public.should_reset_monthly_usage(
  tier,
  billing_interval,
  current_period_start,
  current_period_end,
  usage_reset_at,
  usage_month,
  created_at
);
