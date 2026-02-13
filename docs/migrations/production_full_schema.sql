-- ==============================================================================
-- BILIBALA PRODUCTION DATABASE - COMPLETE SCHEMA
-- Run this in Supabase SQL Editor for a fresh production database.
-- Order matters: tables are created in dependency order.
--
-- Includes all migrations: 001-018
-- Latest updates:
--   - Migration 015: Free tier unlimited sessions, Pro tier 3 devices
--   - Migration 016: Ghost session cleanup fix
--   - Migration 017: Allow anonymous users to insert videos & analyses
--   - Migration 018: Daily practice limit for free users (2/day instead of 5/month)
-- ==============================================================================

-- ==============================================================================
-- 1. TABLES
-- ==============================================================================

-- 1a. global_videos (no dependencies)
CREATE TABLE IF NOT EXISTS public.global_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id TEXT NOT NULL UNIQUE,
  title TEXT,
  thumbnail_url TEXT,
  duration_sec INTEGER,
  channel_name TEXT,
  view_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 1b. cached_analyses (depends on global_videos, auth.users)
CREATE TABLE IF NOT EXISTS public.cached_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES public.global_videos(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  native_lang TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  summary TEXT,
  translated_summary TEXT,
  content JSONB NOT NULL,
  transcript_lang_mismatch BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  UNIQUE(video_id, level, target_lang, native_lang)
);

-- 1c. practice_topics (no FK dependencies after migration 003 dropped analysis_id)
CREATE TABLE IF NOT EXISTS public.practice_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  category TEXT,
  difficulty_level TEXT,
  target_words TEXT[],
  source_type TEXT DEFAULT 'standalone',
  normalized_topic TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  practice_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  UNIQUE(normalized_topic, target_lang)
);

-- 1d. topic_questions (depends on practice_topics, auth.users, cached_analyses)
CREATE TABLE IF NOT EXISTS public.topic_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.practice_topics(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  source_type TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  analysis_id UUID REFERENCES public.cached_analyses(id) ON DELETE SET NULL,
  difficulty_level TEXT,
  is_public BOOLEAN DEFAULT true,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 1e. user_preferences (depends on auth.users)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  native_lang TEXT DEFAULT 'English',
  target_lang TEXT DEFAULT 'English',
  default_level TEXT DEFAULT 'Medium',
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 1f. user_library (depends on auth.users, cached_analyses)
CREATE TABLE IF NOT EXISTS public.user_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES public.cached_analyses(id) ON DELETE CASCADE,
  is_favorite BOOLEAN DEFAULT false,
  practice_count INTEGER DEFAULT 0,
  last_score INTEGER,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  UNIQUE(user_id, analysis_id)
);

-- 1g. practice_sessions (depends on auth.users, practice_topics, topic_questions, cached_analyses)
CREATE TABLE IF NOT EXISTS public.practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES public.cached_analyses(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES public.practice_topics(id) ON DELETE SET NULL,
  question_id UUID REFERENCES public.topic_questions(id) ON DELETE SET NULL,
  topic_text TEXT NOT NULL,
  question_text TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  native_lang TEXT NOT NULL,
  level TEXT NOT NULL,
  audio_url TEXT,
  recording_duration_sec INTEGER,
  transcription TEXT,
  score INTEGER,
  feedback_data JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 1h. user_vocabulary (depends on auth.users, cached_analyses)
CREATE TABLE IF NOT EXISTS public.user_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES public.cached_analyses(id) ON DELETE SET NULL,
  word TEXT NOT NULL,
  translated_word TEXT,
  definition TEXT,
  translated_definition TEXT,
  context TEXT,
  translated_context TEXT,
  status TEXT DEFAULT 'new',
  notes TEXT,
  target_lang TEXT NOT NULL,
  native_lang TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  UNIQUE(user_id, word, target_lang)
);

-- 1i. user_subscriptions (depends on auth.users)
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  billing_interval TEXT DEFAULT 'month',
  cancel_at_period_end BOOLEAN DEFAULT false,
  ai_tutor_credit_minutes INTEGER DEFAULT 0,
  practice_session_credits INTEGER DEFAULT 0,
  video_credits INTEGER DEFAULT 0,
  video_monthly_usage INTEGER DEFAULT 0,
  practice_session_monthly_usage INTEGER DEFAULT 0,
  practice_session_daily_usage INTEGER DEFAULT 0,
  ai_tutor_monthly_minutes_used INTEGER DEFAULT 0,
  usage_month TEXT,
  usage_day TEXT,
  usage_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 1j. browser_fingerprints (no dependencies)
CREATE TABLE IF NOT EXISTS public.browser_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint_hash TEXT UNIQUE NOT NULL,
  monthly_usage_count INTEGER DEFAULT 0,
  usage_reset_month TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  last_seen_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 1k. usage_records (depends on auth.users, browser_fingerprints, global_videos, cached_analyses)
CREATE TABLE IF NOT EXISTS public.usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint_id UUID REFERENCES public.browser_fingerprints(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  video_id UUID REFERENCES public.global_videos(id) ON DELETE SET NULL,
  analysis_id UUID REFERENCES public.cached_analyses(id) ON DELETE SET NULL,
  was_cached BOOLEAN DEFAULT false,
  credits_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 1l. app_config (no dependencies)
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1m. usage_history (depends on auth.users)
CREATE TABLE IF NOT EXISTS public.usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 1n. active_sessions (depends on auth.users) - Migration 013
CREATE TABLE IF NOT EXISTS public.active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  user_agent TEXT,
  ip_address INET,
  device_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(session_id)
);

-- ==============================================================================
-- 2. INDEXES
-- ==============================================================================

-- global_videos
CREATE INDEX IF NOT EXISTS idx_global_videos_view_count ON public.global_videos(view_count DESC);

-- cached_analyses
CREATE INDEX IF NOT EXISTS idx_cached_analyses_lang_level ON public.cached_analyses(target_lang, level);

-- practice_topics
CREATE INDEX IF NOT EXISTS idx_practice_topics_popular ON public.practice_topics(practice_count DESC);
CREATE INDEX IF NOT EXISTS idx_practice_topics_category ON public.practice_topics(category);

-- topic_questions
CREATE INDEX IF NOT EXISTS idx_topic_questions_topic ON public.topic_questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_questions_analysis ON public.topic_questions(analysis_id);

-- user_library
CREATE INDEX IF NOT EXISTS idx_user_library_user ON public.user_library(user_id);

-- practice_sessions
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user ON public.practice_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_topic ON public.practice_sessions(topic_id);

-- user_vocabulary
CREATE INDEX IF NOT EXISTS idx_user_vocabulary_user ON public.user_vocabulary(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vocabulary_status ON public.user_vocabulary(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_vocabulary_lang ON public.user_vocabulary(user_id, target_lang);

-- user_subscriptions
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tier ON public.user_subscriptions(tier);

-- browser_fingerprints
CREATE INDEX IF NOT EXISTS idx_browser_fingerprints_hash ON public.browser_fingerprints(fingerprint_hash);

-- usage_records
CREATE INDEX IF NOT EXISTS idx_usage_records_user ON public.usage_records(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_records_fingerprint ON public.usage_records(fingerprint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_records_action ON public.usage_records(action_type, created_at DESC);

-- usage_history
CREATE INDEX IF NOT EXISTS idx_usage_history_user_id ON public.usage_history(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_history_user_action ON public.usage_history(user_id, action_type);
CREATE INDEX IF NOT EXISTS idx_usage_history_created_at ON public.usage_history(created_at);

-- active_sessions
CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id ON public.active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_last_active ON public.active_sessions(last_active_at);
CREATE INDEX IF NOT EXISTS idx_active_sessions_device_fingerprint ON public.active_sessions(device_fingerprint);

-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.global_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cached_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.browser_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_history ENABLE ROW LEVEL SECURITY;

-- ---- PUBLIC TABLES (readable by all, insertable by authenticated) ----

-- global_videos
CREATE POLICY "Anyone can read videos" ON public.global_videos
  FOR SELECT USING (true);
CREATE POLICY "Anyone can insert videos" ON public.global_videos
  FOR INSERT WITH CHECK (true);

-- cached_analyses
CREATE POLICY "Anyone can read analyses" ON public.cached_analyses
  FOR SELECT USING (true);
CREATE POLICY "Anyone can insert analyses" ON public.cached_analyses
  FOR INSERT WITH CHECK (true);

-- practice_topics
CREATE POLICY "Anyone can read active topics" ON public.practice_topics
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert topics" ON public.practice_topics
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update topics" ON public.practice_topics
  FOR UPDATE TO authenticated USING (true);

-- topic_questions
CREATE POLICY "Anyone can read public questions" ON public.topic_questions
  FOR SELECT USING (is_public = true OR created_by = auth.uid());
CREATE POLICY "Authenticated users can insert questions" ON public.topic_questions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own questions" ON public.topic_questions
  FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Users can delete own questions" ON public.topic_questions
  FOR DELETE TO authenticated USING (created_by = auth.uid());

-- app_config
CREATE POLICY "Anyone can read config" ON public.app_config
  FOR SELECT USING (true);

-- ---- PRIVATE TABLES (owner only) ----

-- user_preferences
CREATE POLICY "Users manage own preferences" ON public.user_preferences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- user_library
CREATE POLICY "Users manage own library" ON public.user_library
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- practice_sessions
CREATE POLICY "Users view own sessions" ON public.practice_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sessions" ON public.practice_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- user_vocabulary
CREATE POLICY "Users manage own vocabulary" ON public.user_vocabulary
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- user_subscriptions
CREATE POLICY "Users view own subscription" ON public.user_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own subscription" ON public.user_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own subscription" ON public.user_subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- usage_records
CREATE POLICY "Users view own usage" ON public.usage_records
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own usage" ON public.usage_records
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- usage_history
CREATE POLICY "Users view own usage history" ON public.usage_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own usage history" ON public.usage_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- active_sessions
CREATE POLICY "Users can view own sessions" ON public.active_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.active_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.active_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON public.active_sessions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- browser_fingerprints: no direct access policies (managed by security definer functions)

-- ==============================================================================
-- 4. FUNCTIONS
-- ==============================================================================

-- ---- Auto-create subscription on signup ----

CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, tier)
  VALUES (new.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---- Video view counter ----

CREATE OR REPLACE FUNCTION public.increment_video_view(video_id_input UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.global_videos
  SET view_count = view_count + 1
  WHERE id = video_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---- Topic practice counter ----

CREATE OR REPLACE FUNCTION public.increment_topic_practice(topic_id_input UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.practice_topics
  SET practice_count = practice_count + 1
  WHERE id = topic_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---- Question use counter ----

CREATE OR REPLACE FUNCTION public.increment_question_use(question_id_input UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.topic_questions
  SET use_count = use_count + 1
  WHERE id = question_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---- Vocabulary updated_at trigger function ----

CREATE OR REPLACE FUNCTION public.update_vocabulary_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---- App config updated_at trigger function ----

CREATE OR REPLACE FUNCTION public.update_app_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---- Fingerprint usage (anonymous users) ----

CREATE OR REPLACE FUNCTION public.check_and_increment_fingerprint_usage(
  p_fingerprint_hash TEXT,
  p_current_month TEXT
)
RETURNS TABLE(allowed BOOLEAN, usage_count INTEGER, fingerprint_id UUID) AS $$
DECLARE
  v_fingerprint public.browser_fingerprints%ROWTYPE;
  v_limit INTEGER := 3;
BEGIN
  SELECT * INTO v_fingerprint
  FROM public.browser_fingerprints
  WHERE fingerprint_hash = p_fingerprint_hash;

  IF v_fingerprint.id IS NULL THEN
    INSERT INTO public.browser_fingerprints (fingerprint_hash, monthly_usage_count, usage_reset_month, last_seen_at)
    VALUES (p_fingerprint_hash, 1, p_current_month, now())
    RETURNING * INTO v_fingerprint;
    RETURN QUERY SELECT true, 1, v_fingerprint.id;
    RETURN;
  END IF;

  IF v_fingerprint.usage_reset_month IS NULL OR v_fingerprint.usage_reset_month != p_current_month THEN
    UPDATE public.browser_fingerprints
    SET monthly_usage_count = 1, usage_reset_month = p_current_month, last_seen_at = now()
    WHERE id = v_fingerprint.id;
    RETURN QUERY SELECT true, 1, v_fingerprint.id;
    RETURN;
  END IF;

  IF v_fingerprint.monthly_usage_count >= v_limit THEN
    UPDATE public.browser_fingerprints SET last_seen_at = now() WHERE id = v_fingerprint.id;
    RETURN QUERY SELECT false, v_fingerprint.monthly_usage_count, v_fingerprint.id;
    RETURN;
  END IF;

  UPDATE public.browser_fingerprints
  SET monthly_usage_count = monthly_usage_count + 1, last_seen_at = now()
  WHERE id = v_fingerprint.id;
  RETURN QUERY SELECT true, v_fingerprint.monthly_usage_count + 1, v_fingerprint.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---- Get fingerprint usage (read-only) ----

CREATE OR REPLACE FUNCTION public.get_fingerprint_usage(
  p_fingerprint_hash TEXT,
  p_current_month TEXT
)
RETURNS TABLE(allowed BOOLEAN, usage_count INTEGER, remaining INTEGER) AS $$
DECLARE
  v_fingerprint public.browser_fingerprints%ROWTYPE;
  v_limit INTEGER := 3;
  v_count INTEGER;
BEGIN
  SELECT * INTO v_fingerprint
  FROM public.browser_fingerprints
  WHERE fingerprint_hash = p_fingerprint_hash;

  IF v_fingerprint.id IS NULL THEN
    RETURN QUERY SELECT true, 0, v_limit;
    RETURN;
  END IF;

  IF v_fingerprint.usage_reset_month IS NULL OR v_fingerprint.usage_reset_month != p_current_month THEN
    RETURN QUERY SELECT true, 0, v_limit;
    RETURN;
  END IF;

  v_count := COALESCE(v_fingerprint.monthly_usage_count, 0);
  RETURN QUERY SELECT v_count < v_limit, v_count, GREATEST(0, v_limit - v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---- Monthly usage count (usage_history) ----

CREATE OR REPLACE FUNCTION public.get_monthly_usage_count(
  p_user_id UUID,
  p_action_type TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  usage_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO usage_count
  FROM public.usage_history
  WHERE user_id = p_user_id
    AND action_type = p_action_type
    AND created_at >= date_trunc('month', now());
  RETURN usage_count;
END;
$$;

-- ---- Get all monthly usage ----

CREATE OR REPLACE FUNCTION public.get_all_monthly_usage(p_user_id UUID)
RETURNS TABLE(
  videos_used INTEGER,
  practice_sessions_used INTEGER,
  ai_tutor_minutes_used INTEGER,
  pdf_exports_used INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cutoff TIMESTAMPTZ;
  reset_at TIMESTAMPTZ;
BEGIN
  -- Get the user's usage_reset_at timestamp (set on plan upgrade)
  SELECT us.usage_reset_at INTO reset_at
  FROM public.user_subscriptions us
  WHERE us.user_id = p_user_id;

  -- Use the later of: start of current month OR usage_reset_at
  cutoff := date_trunc('month', now());
  IF reset_at IS NOT NULL AND reset_at > cutoff THEN
    cutoff := reset_at;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN action_type = 'video_analysis' THEN 1 ELSE 0 END), 0)::INTEGER,
    COALESCE(SUM(CASE WHEN action_type = 'practice_session' THEN 1 ELSE 0 END), 0)::INTEGER,
    COALESCE(SUM(CASE WHEN action_type = 'ai_tutor' THEN (metadata->>'minutes_used')::INTEGER ELSE 0 END), 0)::INTEGER,
    COALESCE(SUM(CASE WHEN action_type = 'pdf_export' THEN 1 ELSE 0 END), 0)::INTEGER
  FROM public.usage_history
  WHERE user_id = p_user_id
    AND created_at >= cutoff;
END;
$$;

-- ---- Credit functions ----

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

-- ---- Session Management Functions (Migrations 013, 015, 016) ----

-- Get concurrent session limit based on subscription tier (Migration 015)
CREATE OR REPLACE FUNCTION public.get_session_limit(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tier TEXT;
  v_limit INTEGER;
BEGIN
  SELECT tier INTO v_tier FROM public.user_subscriptions WHERE user_id = p_user_id;
  IF v_tier IS NULL THEN v_tier := 'free'; END IF;

  CASE v_tier
    WHEN 'free' THEN v_limit := 999999; -- Unlimited for free tier
    WHEN 'pro' THEN v_limit := 3; -- 3 devices for pro tier
    ELSE v_limit := 999999;
  END CASE;

  RETURN v_limit;
END;
$$;

-- Get active session count for a user
CREATE OR REPLACE FUNCTION public.get_active_session_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.active_sessions
  WHERE user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > NOW())
    AND last_active_at > NOW() - INTERVAL '24 hours';
  RETURN v_count;
END;
$$;

-- Register a new session (auto-logout oldest if over limit) (Migration 016 - with ghost session cleanup)
CREATE OR REPLACE FUNCTION public.register_session(
  p_user_id UUID,
  p_session_id TEXT,
  p_device_fingerprint TEXT,
  p_user_agent TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_device_info JSONB DEFAULT '{}'::jsonb,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_limit INTEGER;
  v_current_count INTEGER;
  v_oldest_session_id TEXT;
  v_logged_out_sessions TEXT[];
BEGIN
  v_limit := public.get_session_limit(p_user_id);

  -- Clean up stale sessions (>24 hours old) to prevent ghost sessions
  DELETE FROM public.active_sessions
  WHERE user_id = p_user_id AND last_active_at < NOW() - INTERVAL '24 hours';

  v_current_count := public.get_active_session_count(p_user_id);
  v_logged_out_sessions := ARRAY[]::TEXT[];

  WHILE v_current_count >= v_limit LOOP
    SELECT session_id INTO v_oldest_session_id
    FROM public.active_sessions
    WHERE user_id = p_user_id AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY last_active_at ASC LIMIT 1;

    IF v_oldest_session_id IS NOT NULL THEN
      DELETE FROM public.active_sessions WHERE session_id = v_oldest_session_id;
      v_logged_out_sessions := array_append(v_logged_out_sessions, v_oldest_session_id);
      v_current_count := v_current_count - 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO public.active_sessions (
    user_id, session_id, device_fingerprint, user_agent, ip_address, device_info, expires_at
  ) VALUES (
    p_user_id, p_session_id, p_device_fingerprint, p_user_agent, p_ip_address::INET, p_device_info, p_expires_at
  )
  ON CONFLICT (session_id) DO UPDATE SET last_active_at = NOW();

  RETURN jsonb_build_object(
    'success', true,
    'session_limit', v_limit,
    'logged_out_sessions', v_logged_out_sessions,
    'logged_out_count', array_length(v_logged_out_sessions, 1)
  );
END;
$$;

-- Update session last_active timestamp
CREATE OR REPLACE FUNCTION public.update_session_activity(p_session_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.active_sessions SET last_active_at = NOW() WHERE session_id = p_session_id;
  RETURN FOUND;
END;
$$;

-- Remove session (on logout or expiry)
CREATE OR REPLACE FUNCTION public.remove_session(p_session_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.active_sessions WHERE session_id = p_session_id;
  RETURN FOUND;
END;
$$;

-- Cleanup expired sessions (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.active_sessions
  WHERE expires_at < NOW() OR last_active_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- ==============================================================================
-- 5. TRIGGERS
-- ==============================================================================

-- Auto-create subscription on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- Auto-update vocabulary updated_at
DROP TRIGGER IF EXISTS user_vocabulary_updated_at ON public.user_vocabulary;
CREATE TRIGGER user_vocabulary_updated_at
  BEFORE UPDATE ON public.user_vocabulary
  FOR EACH ROW EXECUTE FUNCTION public.update_vocabulary_timestamp();

-- Auto-update app_config updated_at
DROP TRIGGER IF EXISTS app_config_updated_at ON public.app_config;
CREATE TRIGGER app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.update_app_config_timestamp();

-- ==============================================================================
-- 6. SEED DATA (app_config)
-- ==============================================================================

INSERT INTO public.app_config (key, value, description) VALUES
  ('ai_tutor_session_max_minutes', '40', 'Max minutes per single AI tutor session'),
  ('ai_tutor_monthly_max_minutes', '60', 'Max AI tutor minutes per month for pro users'),
  ('ai_tutor_warning_before_end_seconds', '60', 'Seconds before session limit to show countdown warning'),
  ('free_videos_per_month', '3', 'Max video analyses per month for free tier'),
  ('free_practice_sessions_per_month', '5', 'Max practice sessions per month for free tier'),
  ('free_video_library_max', '10', 'Max videos in library for free tier'),
  ('anonymous_video_limit', '2', 'Max video analyses per month for anonymous users'),
  ('anonymous_practice_limit', '2', 'Max practice sessions per month for anonymous users'),
  ('practice_recording_max_seconds', '240', 'Max recording duration in seconds for practice sessions'),
  ('speech_analysis_timeout_seconds', '150', 'Timeout in seconds for Gemini speech analysis API call'),
  ('pro_videos_per_month', '100', 'Max video analyses per month for Pro tier'),
  ('starter_pack_video_credits', '15', 'Video credits in Starter Pack'),
  ('starter_pack_ai_tutor_minutes', '30', 'AI Tutor minutes in Starter Pack'),
  ('starter_pack_practice_sessions', '30', 'Practice sessions in Starter Pack'),
  ('topup_video_credits', '10', 'Video credits in Top-up Pack'),
  ('topup_ai_tutor_minutes', '15', 'AI Tutor minutes in Top-up Pack'),
  ('pro_monthly_price', '9', 'Pro monthly price in USD (display only)'),
  ('pro_annual_price', '7', 'Pro annual price per month in USD (display only)'),
  ('pro_annual_total', '84', 'Pro annual total price in USD (display only)'),
  ('starter_pack_price', '5', 'Starter Pack price in USD (display only)'),
  ('topup_price', '3', 'Top-up Pack price in USD (display only)')
ON CONFLICT (key) DO NOTHING;

-- ==============================================================================
-- 7. STORAGE BUCKETS (create manually in Supabase Dashboard or run below)
-- ==============================================================================

-- practice-recordings: public bucket for user audio recordings
INSERT INTO storage.buckets (id, name, public) VALUES ('practice-recordings', 'practice-recordings', true)
ON CONFLICT (id) DO NOTHING;

-- tts-cache: private bucket for text-to-speech cached audio
INSERT INTO storage.buckets (id, name, public) VALUES ('tts-cache', 'tts-cache', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for practice-recordings
CREATE POLICY "Users can upload own recordings" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'practice-recordings' AND (storage.foldername(name))[1] = auth.uid()::TEXT);

CREATE POLICY "Anyone can read practice recordings" ON storage.objects
  FOR SELECT USING (bucket_id = 'practice-recordings');

-- Storage policies for tts-cache (server-side only via service role, no user policies needed)

-- Add billing_interval column to distinguish monthly vs annual subscriptions
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS billing_interval text DEFAULT 'month';

-- Add a comment for documentation
COMMENT ON COLUMN public.user_subscriptions.billing_interval IS 'Stripe billing interval: month or year';


-- Allow authenticated users to delete their own practice sessions
CREATE POLICY "Users delete own sessions" ON public.practice_sessions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- practice session favorites:
-- Add is_favorited column to practice_sessions
ALTER TABLE public.practice_sessions
  ADD COLUMN is_favorited BOOLEAN NOT NULL DEFAULT false;

-- Allow authenticated users to update their own practice sessions (for toggling favorite)
CREATE POLICY "Users update own sessions" ON public.practice_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ==============================================================================
-- DONE! Your production database is ready.
-- ==============================================================================
