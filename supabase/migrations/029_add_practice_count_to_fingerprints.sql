-- Migration 029: Add separate monthly_practice_count to browser_fingerprints
-- Previously, checkAnonymousPracticeLimit was reading monthly_usage_count (video analyses),
-- causing anonymous users to be blocked from practice after analyzing 2 videos.
-- This adds a dedicated counter for practice sessions.

ALTER TABLE public.browser_fingerprints
  ADD COLUMN IF NOT EXISTS monthly_practice_count integer DEFAULT 0;
