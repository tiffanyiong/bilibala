-- ============================================
-- CREDIT SYSTEM
-- Add credit columns for pay-as-you-go purchases
-- ============================================

-- Add credit columns to user_subscriptions
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS ai_tutor_credit_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS practice_session_credits INTEGER DEFAULT 0;

-- Comment for documentation
COMMENT ON COLUMN public.user_subscriptions.ai_tutor_credit_minutes IS 'Purchased AI tutor minutes (from credit packs, never expires, does not reset monthly)';
COMMENT ON COLUMN public.user_subscriptions.practice_session_credits IS 'Purchased practice session credits (from starter pack, never expires, does not reset monthly)';

-- ============================================
-- HELPER FUNCTION: Deduct AI Tutor Credits
-- Called when a user uses AI tutor and has credits
-- Returns the number of minutes actually deducted from credits
-- ============================================

CREATE OR REPLACE FUNCTION public.deduct_ai_tutor_credits(
  p_user_id UUID,
  p_minutes INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_credits INTEGER;
  to_deduct INTEGER;
BEGIN
  -- Get current credit balance
  SELECT ai_tutor_credit_minutes INTO current_credits
  FROM public.user_subscriptions
  WHERE user_id = p_user_id;

  IF current_credits IS NULL OR current_credits <= 0 THEN
    RETURN 0;
  END IF;

  -- Calculate how much to deduct (can't deduct more than available)
  to_deduct := LEAST(current_credits, p_minutes);

  -- Deduct credits
  UPDATE public.user_subscriptions
  SET ai_tutor_credit_minutes = ai_tutor_credit_minutes - to_deduct,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN to_deduct;
END;
$$;

-- ============================================
-- HELPER FUNCTION: Deduct Practice Session Credits
-- Called when a free user uses a practice session and has credits
-- Returns 1 if deducted, 0 if no credits available
-- ============================================

CREATE OR REPLACE FUNCTION public.deduct_practice_credits(
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
  SELECT practice_session_credits INTO current_credits
  FROM public.user_subscriptions
  WHERE user_id = p_user_id;

  IF current_credits IS NULL OR current_credits <= 0 THEN
    RETURN 0;
  END IF;

  -- Deduct 1 credit
  UPDATE public.user_subscriptions
  SET practice_session_credits = practice_session_credits - 1,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN 1;
END;
$$;

-- ============================================
-- HELPER FUNCTION: Add Credits (called by webhook)
-- ============================================

CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
  p_ai_tutor_minutes INTEGER DEFAULT 0,
  p_practice_sessions INTEGER DEFAULT 0
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
    updated_at = now()
  WHERE user_id = p_user_id;

  -- If no row was updated, create one
  IF NOT FOUND THEN
    INSERT INTO public.user_subscriptions (
      user_id,
      tier,
      ai_tutor_credit_minutes,
      practice_session_credits
    )
    VALUES (
      p_user_id,
      'free',
      p_ai_tutor_minutes,
      p_practice_sessions
    );
  END IF;
END;
$$;
