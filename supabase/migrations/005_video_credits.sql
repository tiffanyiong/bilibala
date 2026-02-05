-- ============================================
-- VIDEO CREDITS SYSTEM
-- Add video credit column for pay-as-you-go purchases
-- ============================================

-- Add video_credits column to user_subscriptions
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS video_credits INTEGER DEFAULT 0;

-- Comment for documentation
COMMENT ON COLUMN public.user_subscriptions.video_credits IS 'Purchased video analysis credits (from credit packs, never expires, does not reset monthly)';

-- ============================================
-- HELPER FUNCTION: Deduct Video Credits
-- Called when a user analyzes a video and has exceeded monthly limit
-- Returns 1 if deducted, 0 if no credits available
-- ============================================

CREATE OR REPLACE FUNCTION public.deduct_video_credits(
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_credits INTEGER;
BEGIN
  -- Get current credit balance
  SELECT video_credits INTO current_credits
  FROM public.user_subscriptions
  WHERE user_id = p_user_id;

  IF current_credits IS NULL OR current_credits <= 0 THEN
    RETURN 0;
  END IF;

  -- Deduct 1 credit
  UPDATE public.user_subscriptions
  SET video_credits = video_credits - 1,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN 1;
END;
$$;

-- ============================================
-- UPDATE: Add Credits Function (now includes video credits)
-- ============================================

CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
  p_ai_tutor_minutes INTEGER DEFAULT 0,
  p_practice_sessions INTEGER DEFAULT 0,
  p_video_credits INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_subscriptions
  SET
    ai_tutor_credit_minutes = ai_tutor_credit_minutes + p_ai_tutor_minutes,
    practice_session_credits = practice_session_credits + p_practice_sessions,
    video_credits = video_credits + p_video_credits,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- If no row was updated, create one
  IF NOT FOUND THEN
    INSERT INTO public.user_subscriptions (
      user_id,
      tier,
      ai_tutor_credit_minutes,
      practice_session_credits,
      video_credits
    )
    VALUES (
      p_user_id,
      'free',
      p_ai_tutor_minutes,
      p_practice_sessions,
      p_video_credits
    );
  END IF;
END;
$$;

-- ============================================
-- Add config values to app_config
-- ============================================

-- Pro tier config
INSERT INTO public.app_config (key, value, description)
VALUES ('pro_videos_per_month', '100', 'Max video analyses per month for Pro tier')
ON CONFLICT (key) DO UPDATE SET value = '100', updated_at = now();

-- Starter Pack config
INSERT INTO public.app_config (key, value, description)
VALUES ('starter_pack_video_credits', '15', 'Video credits in Starter Pack')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_config (key, value, description)
VALUES ('starter_pack_ai_tutor_minutes', '30', 'AI Tutor minutes in Starter Pack')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_config (key, value, description)
VALUES ('starter_pack_practice_sessions', '30', 'Practice sessions in Starter Pack')
ON CONFLICT (key) DO NOTHING;

-- Top-up Pack config
INSERT INTO public.app_config (key, value, description)
VALUES ('topup_video_credits', '10', 'Video credits in Top-up Pack')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_config (key, value, description)
VALUES ('topup_ai_tutor_minutes', '15', 'AI Tutor minutes in Top-up Pack')
ON CONFLICT (key) DO NOTHING;

-- Prices (for UI display only - actual charges come from Stripe)
INSERT INTO public.app_config (key, value, description)
VALUES ('pro_monthly_price', '9', 'Pro monthly price in USD (display only)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_config (key, value, description)
VALUES ('pro_annual_price', '7', 'Pro annual price per month in USD (display only)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_config (key, value, description)
VALUES ('pro_annual_total', '84', 'Pro annual total price in USD (display only)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_config (key, value, description)
VALUES ('starter_pack_price', '5', 'Starter Pack price in USD (display only)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_config (key, value, description)
VALUES ('topup_price', '3', 'Top-up Pack price in USD (display only)')
ON CONFLICT (key) DO NOTHING;
