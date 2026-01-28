-- ============================================
-- USAGE HISTORY TABLE
-- Tracks detailed usage per action type for subscription limits
-- ============================================

CREATE TABLE IF NOT EXISTS public.usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'video_analysis', 'practice_session', 'ai_tutor', 'pdf_export'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Indexes for fast lookups
CREATE INDEX idx_usage_history_user_id ON public.usage_history(user_id);
CREATE INDEX idx_usage_history_user_action ON public.usage_history(user_id, action_type);
CREATE INDEX idx_usage_history_created_at ON public.usage_history(created_at);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.usage_history ENABLE ROW LEVEL SECURITY;

-- Users can only read their own usage history
CREATE POLICY "Users can view own usage history"
  ON public.usage_history FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own usage records
CREATE POLICY "Users can insert own usage history"
  ON public.usage_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- RLS FOR user_subscriptions (if not already set)
-- ============================================

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription
CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own subscription (initial creation)
CREATE POLICY "Users can insert own subscription"
  ON public.user_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscription
CREATE POLICY "Users can update own subscription"
  ON public.user_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- HELPER FUNCTION: Count usage for current month
-- ============================================

CREATE OR REPLACE FUNCTION public.get_monthly_usage_count(
  p_user_id UUID,
  p_action_type TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  usage_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO usage_count
  FROM public.usage_history
  WHERE user_id = p_user_id
    AND action_type = p_action_type
    AND created_at >= date_trunc('month', now());

  RETURN usage_count;
END;
$$;

-- ============================================
-- HELPER FUNCTION: Get all usage counts for current month
-- ============================================

CREATE OR REPLACE FUNCTION public.get_all_monthly_usage(p_user_id UUID)
RETURNS TABLE(
  videos_used INTEGER,
  practice_sessions_used INTEGER,
  ai_tutor_minutes_used INTEGER,
  pdf_exports_used INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN action_type = 'video_analysis' THEN 1 ELSE 0 END), 0)::INTEGER AS videos_used,
    COALESCE(SUM(CASE WHEN action_type = 'practice_session' THEN 1 ELSE 0 END), 0)::INTEGER AS practice_sessions_used,
    COALESCE(SUM(CASE WHEN action_type = 'ai_tutor' THEN (metadata->>'minutes_used')::INTEGER ELSE 0 END), 0)::INTEGER AS ai_tutor_minutes_used,
    COALESCE(SUM(CASE WHEN action_type = 'pdf_export' THEN 1 ELSE 0 END), 0)::INTEGER AS pdf_exports_used
  FROM public.usage_history
  WHERE user_id = p_user_id
    AND created_at >= date_trunc('month', now());
END;
$$;
