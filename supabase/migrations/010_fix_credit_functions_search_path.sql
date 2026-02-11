-- Fix: Add SET search_path = public to all credit functions
-- SECURITY DEFINER functions need explicit search_path to work correctly in Supabase

CREATE OR REPLACE FUNCTION public.deduct_ai_tutor_credits(
  p_user_id UUID,
  p_minutes INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_credits INTEGER;
  to_deduct INTEGER;
BEGIN
  SELECT ai_tutor_credit_minutes INTO current_credits
  FROM public.user_subscriptions WHERE user_id = p_user_id;

  IF current_credits IS NULL OR current_credits <= 0 THEN RETURN 0; END IF;

  to_deduct := LEAST(current_credits, p_minutes);

  UPDATE public.user_subscriptions
  SET ai_tutor_credit_minutes = ai_tutor_credit_minutes - to_deduct, updated_at = now()
  WHERE user_id = p_user_id;

  RETURN to_deduct;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_practice_credits(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_credits INTEGER;
BEGIN
  SELECT practice_session_credits INTO current_credits
  FROM public.user_subscriptions WHERE user_id = p_user_id;

  IF current_credits IS NULL OR current_credits <= 0 THEN RETURN 0; END IF;

  UPDATE public.user_subscriptions
  SET practice_session_credits = practice_session_credits - 1, updated_at = now()
  WHERE user_id = p_user_id;

  RETURN 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_video_credits(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_credits INTEGER;
BEGIN
  SELECT video_credits INTO current_credits
  FROM public.user_subscriptions WHERE user_id = p_user_id;

  IF current_credits IS NULL OR current_credits <= 0 THEN RETURN 0; END IF;

  UPDATE public.user_subscriptions
  SET video_credits = video_credits - 1, updated_at = now()
  WHERE user_id = p_user_id;

  RETURN 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
  p_ai_tutor_minutes INTEGER DEFAULT 0,
  p_practice_sessions INTEGER DEFAULT 0,
  p_video_credits INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.user_subscriptions
  SET
    ai_tutor_credit_minutes = ai_tutor_credit_minutes + p_ai_tutor_minutes,
    practice_session_credits = practice_session_credits + p_practice_sessions,
    video_credits = video_credits + p_video_credits,
    updated_at = now()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_subscriptions (
      user_id, tier, ai_tutor_credit_minutes, practice_session_credits, video_credits
    ) VALUES (
      p_user_id, 'free', p_ai_tutor_minutes, p_practice_sessions, p_video_credits
    );
  END IF;
END;
$$;
