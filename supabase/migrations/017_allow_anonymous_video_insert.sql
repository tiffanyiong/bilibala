-- ==============================================================================
-- Migration 017: Allow Anonymous Users to Insert Videos
-- ==============================================================================
--
-- PROBLEM:
-- Anonymous users cannot save analyzed videos to the database because the
-- global_videos table has an RLS policy that only allows authenticated users
-- to insert videos. This means:
-- 1. Anonymous user analyzes a video
-- 2. getOrCreateVideo() fails to create the video (RLS blocks it)
-- 3. saveCachedAnalysis() is skipped (no video_id)
-- 4. The analysis is lost and not cached
--
-- SOLUTION:
-- Change the INSERT policy on global_videos to allow anonymous users to insert.
-- This is safe because:
-- - Videos are public data (YouTube IDs + metadata)
-- - UNIQUE constraint on youtube_id prevents duplicates
-- - No sensitive user data is stored in this table
-- ==============================================================================

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Authenticated users can insert videos" ON public.global_videos;

-- Drop if it already exists (idempotent)
DROP POLICY IF EXISTS "Anyone can insert videos" ON public.global_videos;

-- Create a new permissive policy that allows anyone (including anonymous) to insert videos
CREATE POLICY "Anyone can insert videos" ON public.global_videos
  FOR INSERT WITH CHECK (true);

-- Also allow anyone to insert cached analyses (they're public too)
-- This ensures anonymous users can save their analysis results
DROP POLICY IF EXISTS "Authenticated users can insert analyses" ON public.cached_analyses;

-- Drop if it already exists (idempotent)
DROP POLICY IF EXISTS "Anyone can insert analyses" ON public.cached_analyses;

CREATE POLICY "Anyone can insert analyses" ON public.cached_analyses
  FOR INSERT WITH CHECK (true);
