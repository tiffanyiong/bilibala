-- Migration 015: Remove Session Limit for Free Tier
-- Purpose: Allow free tier users unlimited concurrent sessions, keep pro tier at 3 devices

SET search_path = public;

-- Update get_session_limit function to return unlimited for free tier
CREATE OR REPLACE FUNCTION public.get_session_limit(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_limit INTEGER;
BEGIN
  -- Get user's subscription tier
  SELECT tier INTO v_tier
  FROM public.user_subscriptions
  WHERE user_id = p_user_id;

  -- Default to free if no subscription found
  IF v_tier IS NULL THEN
    v_tier := 'free';
  END IF;

  -- Set limits based on tier
  CASE v_tier
    WHEN 'free' THEN
      v_limit := 999999; -- Effectively unlimited for free tier
    WHEN 'pro' THEN
      v_limit := 3; -- 3 devices at a time for pro tier
    ELSE
      v_limit := 999999; -- Default to unlimited
  END CASE;

  RETURN v_limit;
END;
$$;

COMMENT ON FUNCTION public.get_session_limit IS 'Returns the concurrent session limit: unlimited for free tier, 3 for pro tier';
