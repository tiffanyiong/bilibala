-- Migration 027: Add page visit tracking to browser_fingerprints
-- Track landing page visits separately from video analysis usage

SET search_path = public;

-- Add columns to track page visits and link to users
ALTER TABLE public.browser_fingerprints
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS page_visit_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_page_visit_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_page_visit_at TIMESTAMPTZ;

-- Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_browser_fingerprints_user_id ON public.browser_fingerprints(user_id);

-- Create index for page visit analytics
CREATE INDEX IF NOT EXISTS idx_browser_fingerprints_first_visit ON public.browser_fingerprints(first_page_visit_at);
CREATE INDEX IF NOT EXISTS idx_browser_fingerprints_last_visit ON public.browser_fingerprints(last_page_visit_at);

-- Comments
COMMENT ON COLUMN public.browser_fingerprints.user_id IS 'Links fingerprint to user after signup (NULL for anonymous)';
COMMENT ON COLUMN public.browser_fingerprints.page_visit_count IS 'Number of sessions/visits from this device';
COMMENT ON COLUMN public.browser_fingerprints.first_page_visit_at IS 'First time this device visited the app';
COMMENT ON COLUMN public.browser_fingerprints.last_page_visit_at IS 'Most recent visit from this device';

-- Note: This allows tracking the full user journey:
-- 1. Anonymous visit (user_id = NULL)
-- 2. Video analysis (monthly_usage_count++)
-- 3. User signs up (user_id set)
-- 4. Return visits (page_visit_count++)
