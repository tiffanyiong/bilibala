-- Migration 021: Fix TOKEN_REFRESHED causing unexpected logouts + Session limit boundary bug
-- Problem 1: When token refreshes, registerSession() is called again with same session_id
--            But register_session counts this existing session towards the limit,
--            causing it to delete the oldest session even though we're just updating an existing one
-- Problem 2: Pro users with exactly 3 devices get logged out when condition uses >=
--            Example: 3 devices active, limit = 3
--            v_current_count (3) >= v_limit (3) → TRUE → oldest device logged out ❌
-- Solution: Check if session_id already exists BEFORE counting + Change >= to > for boundary case

SET search_path = public;

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
  v_existing_session BOOLEAN;
BEGIN
  -- Get session limit for user
  v_limit := public.get_session_limit(p_user_id);

  -- FIRST: Clean up truly stale sessions (>7 days old)
  DELETE FROM public.active_sessions
  WHERE user_id = p_user_id
    AND last_active_at < NOW() - INTERVAL '7 days';

  -- Check if this session_id already exists (token refresh scenario)
  SELECT EXISTS (
    SELECT 1 FROM public.active_sessions
    WHERE session_id = p_session_id
  ) INTO v_existing_session;

  -- If this is a new session (not a refresh), enforce device limit
  IF NOT v_existing_session THEN
    -- Get current active session count
    v_current_count := public.get_active_session_count(p_user_id);

    -- If OVER limit (not at limit), remove oldest session(s) to make room
    v_logged_out_sessions := ARRAY[]::TEXT[];
    WHILE v_current_count > v_limit LOOP  -- Changed from >= to > for boundary case
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
  ELSE
    -- Token refresh - no sessions were logged out
    v_logged_out_sessions := ARRAY[]::TEXT[];
  END IF;

  -- Insert new session or update existing one
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
  SET
    last_active_at = NOW(),
    expires_at = EXCLUDED.expires_at; -- Update expiry on token refresh

  -- Return result
  RETURN jsonb_build_object(
    'success', true,
    'session_limit', v_limit,
    'logged_out_sessions', v_logged_out_sessions,
    'logged_out_count', array_length(v_logged_out_sessions, 1),
    'is_refresh', v_existing_session
  );
END;
$$;

COMMENT ON FUNCTION public.register_session IS 'Registers a new session or refreshes existing one. Only enforces device limits when EXCEEDING the limit (not when at the limit).';
