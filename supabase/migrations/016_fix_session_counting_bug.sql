-- Migration 016: Fix Session Counting Bug
-- Purpose: Fix inconsistency where old sessions (>24h) aren't counted but also aren't deleted
-- This causes unexpected logouts when old sessions accumulate

SET search_path = public;

-- Update register_session to cleanup old sessions BEFORE counting
CREATE OR REPLACE FUNCTION public.register_session(
  p_user_id UUID,
  p_session_id TEXT,
  p_device_fingerprint TEXT,
  p_user_agent TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_device_info JSONB DEFAULT '{}'::jsonb,
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
  v_current_count INTEGER;
  v_oldest_session_id TEXT;
  v_logged_out_sessions TEXT[];
BEGIN
  -- Get session limit for user
  v_limit := public.get_session_limit(p_user_id);

  -- FIRST: Clean up stale sessions (>24 hours old) to prevent ghost sessions
  DELETE FROM public.active_sessions
  WHERE user_id = p_user_id
    AND last_active_at < NOW() - INTERVAL '24 hours';

  -- NOW: Get current active session count (should match actual table count)
  v_current_count := public.get_active_session_count(p_user_id);

  -- If at or over limit, remove oldest session(s)
  v_logged_out_sessions := ARRAY[]::TEXT[];
  WHILE v_current_count >= v_limit LOOP
    -- Find oldest session
    SELECT session_id INTO v_oldest_session_id
    FROM public.active_sessions
    WHERE user_id = p_user_id
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY last_active_at ASC
    LIMIT 1;

    -- Delete it
    IF v_oldest_session_id IS NOT NULL THEN
      DELETE FROM public.active_sessions
      WHERE session_id = v_oldest_session_id;

      v_logged_out_sessions := array_append(v_logged_out_sessions, v_oldest_session_id);
      v_current_count := v_current_count - 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  -- Insert new session
  INSERT INTO public.active_sessions (
    user_id,
    session_id,
    device_fingerprint,
    user_agent,
    ip_address,
    device_info,
    expires_at
  ) VALUES (
    p_user_id,
    p_session_id,
    p_device_fingerprint,
    p_user_agent,
    p_ip_address::INET,
    p_device_info,
    p_expires_at
  )
  ON CONFLICT (session_id) DO UPDATE
  SET last_active_at = NOW();

  -- Return result
  RETURN jsonb_build_object(
    'success', true,
    'session_limit', v_limit,
    'logged_out_sessions', v_logged_out_sessions,
    'logged_out_count', array_length(v_logged_out_sessions, 1)
  );
END;
$$;

COMMENT ON FUNCTION public.register_session IS 'Registers a new session, cleans up stale sessions first, then auto-logouts oldest session if over limit';
