-- Migration 022: Fix session limit enforcement logic
-- Problem: When Pro user has exactly 3 devices, 4th device can log in without kicking anyone out
--
-- Current buggy logic (migration 021):
--   1. Device D tries to log in (new session)
--   2. v_current_count = 3 (existing devices A, B, C)
--   3. Check: 3 > 3 → FALSE → Don't remove any session
--   4. INSERT device D → Now 4 devices logged in! ❌
--
-- Root cause: We check `v_current_count > v_limit` BEFORE inserting the new session
--             So when exactly at limit, we don't remove anything
--
-- Solution: When registering a NEW session (not refresh), we need to ensure:
--           current_count + 1 <= limit  →  current_count < limit
--           If current_count >= limit, we must remove oldest session(s)

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

    -- To add a NEW session, we need: current + 1 <= limit
    -- Which means: current >= limit → need to remove session(s)
    --
    -- Example: Pro user (limit = 3)
    --   - 2 devices active: 2 >= 3 → FALSE → Can add 3rd device directly ✓
    --   - 3 devices active: 3 >= 3 → TRUE  → Must remove 1 device before adding 4th ✓
    --   - 4 devices active: 4 >= 3 → TRUE  → Must remove 2 devices (shouldn't happen, but safe)
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

COMMENT ON FUNCTION public.register_session IS 'Registers a new session or updates existing one. For NEW sessions: enforces limit by removing oldest session(s) when current >= limit. For token refreshes: no limit enforcement.';
