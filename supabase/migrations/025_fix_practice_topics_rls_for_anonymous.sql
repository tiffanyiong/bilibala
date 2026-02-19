-- Migration 025: Fix RLS for practice_topics to allow anonymous read access
-- Problem: Anonymous users need to read practice topics to display Quick Start

SET search_path = public;

-- ============================================
-- Enable RLS on practice_topics (if not already enabled)
-- ============================================
ALTER TABLE public.practice_topics ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Drop existing policies (if any)
-- ============================================
DROP POLICY IF EXISTS "Allow anonymous read practice topics" ON public.practice_topics;
DROP POLICY IF EXISTS "Allow authenticated read practice topics" ON public.practice_topics;
DROP POLICY IF EXISTS "Users can manage practice topics" ON public.practice_topics;

-- ============================================
-- New RLS Policies
-- ============================================

-- 1. Allow ANYONE (including anonymous) to read ALL practice topics
-- Safe because practice topics are content metadata, not user-specific data
CREATE POLICY "Allow read practice topics to all"
  ON public.practice_topics
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- 2. Only AUTHENTICATED users can INSERT/UPDATE/DELETE
-- (Topics are created during video analysis, which requires auth in some flows)
CREATE POLICY "Authenticated can manage practice topics"
  ON public.practice_topics
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Comments
-- ============================================
COMMENT ON POLICY "Allow read practice topics to all" ON public.practice_topics
  IS 'Allows anyone (including anonymous users) to read practice topics. Required for displaying Quick Start after video analysis.';

COMMENT ON POLICY "Authenticated can manage practice topics" ON public.practice_topics
  IS 'Only authenticated users can create/update/delete practice topics.';
