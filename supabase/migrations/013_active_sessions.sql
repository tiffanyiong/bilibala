-- Migration 013: Active Sessions Table for Concurrent Device Limits
-- Purpose: Track active user sessions to enforce device limits and prevent account sharing

SET search_path = public;

-- Create active_sessions table
CREATE TABLE IF NOT EXISTS public.active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Session identification
  session_id TEXT NOT NULL, -- Supabase session ID
  device_fingerprint TEXT NOT NULL,

  -- Device metadata
  user_agent TEXT,
  ip_address INET,
  device_info JSONB DEFAULT '{}'::jsonb,

  -- Session timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Unique constraint: one row per session_id
  UNIQUE(session_id)
);

-- Create indexes for fast lookups
CREATE INDEX idx_active_sessions_user_id ON public.active_sessions(user_id);
CREATE INDEX idx_active_sessions_last_active ON public.active_sessions(last_active_at);
CREATE INDEX idx_active_sessions_device_fingerprint ON public.active_sessions(device_fingerprint);

-- Enable RLS
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.active_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON public.active_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.active_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON public.active_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function: Get concurrent session limit based on subscription tier
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
      v_limit := 1; -- 1 device at a time
    WHEN 'pro' THEN
      v_limit := 3; -- 3 devices at a time
    ELSE
      v_limit := 1; -- Default to free tier limit
  END CASE;

  RETURN v_limit;
END;
$$;

-- Function: Get active session count for a user
CREATE OR REPLACE FUNCTION public.get_active_session_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count non-expired sessions that were active in the last 24 hours
  SELECT COUNT(*) INTO v_count
  FROM public.active_sessions
  WHERE user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > NOW())
    AND last_active_at > NOW() - INTERVAL '24 hours';

  RETURN v_count;
END;
$$;

-- Function: Register a new session (auto-logout oldest if over limit)
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

  -- Get current active session count
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

-- Function: Update session last_active timestamp
CREATE OR REPLACE FUNCTION public.update_session_activity(p_session_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.active_sessions
  SET last_active_at = NOW()
  WHERE session_id = p_session_id;

  RETURN FOUND;
END;
$$;

-- Function: Remove session (on logout or expiry)
CREATE OR REPLACE FUNCTION public.remove_session(p_session_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.active_sessions
  WHERE session_id = p_session_id;

  RETURN FOUND;
END;
$$;

-- Function: Cleanup expired sessions (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete expired sessions or sessions inactive for more than 7 days
  DELETE FROM public.active_sessions
  WHERE expires_at < NOW()
    OR last_active_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- Comments
COMMENT ON TABLE public.active_sessions IS 'Tracks active user sessions to enforce concurrent device limits';
COMMENT ON FUNCTION public.get_session_limit IS 'Returns the concurrent session limit based on user subscription tier';
COMMENT ON FUNCTION public.register_session IS 'Registers a new session and auto-logouts oldest session if over limit';
COMMENT ON FUNCTION public.update_session_activity IS 'Updates the last_active_at timestamp for a session';
COMMENT ON FUNCTION public.remove_session IS 'Removes a session from tracking';
COMMENT ON FUNCTION public.cleanup_expired_sessions IS 'Cleanup job to remove expired/stale sessions';
