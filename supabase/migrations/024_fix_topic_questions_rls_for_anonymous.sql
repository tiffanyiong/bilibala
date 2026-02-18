-- Migration 024: Fix RLS for topic_questions to allow anonymous read access
-- Problem: Anonymous users can analyze videos but can't see practice topics
-- because getTopicIdsWithQuestionsAtLevel() can't query topic_questions

SET search_path = public;

-- ============================================
-- Enable RLS on topic_questions (if not already enabled)
-- ============================================
ALTER TABLE public.topic_questions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Drop existing policies (if any)
-- ============================================
DROP POLICY IF EXISTS "Allow anonymous read public questions" ON public.topic_questions;
DROP POLICY IF EXISTS "Allow authenticated read public questions" ON public.topic_questions;
DROP POLICY IF EXISTS "Users can manage their own questions" ON public.topic_questions;

-- ============================================
-- New RLS Policies
-- ============================================

-- 1. Allow ANYONE (including anonymous) to read PUBLIC questions
-- This is safe because is_public=true questions are intentionally public content
CREATE POLICY "Allow read public questions to all"
  ON public.topic_questions
  FOR SELECT
  TO authenticated, anon
  USING (is_public = true);

-- 2. Authenticated users can INSERT/UPDATE/DELETE their own questions
CREATE POLICY "Users can manage own questions"
  ON public.topic_questions
  FOR ALL
  TO authenticated
  USING (
    -- For SELECT/UPDATE/DELETE: user must own the analysis
    EXISTS (
      SELECT 1 FROM public.cached_analyses ca
      WHERE ca.id = topic_questions.analysis_id
      AND ca.created_by = auth.uid()
    )
  )
  WITH CHECK (
    -- For INSERT: user must own the analysis
    EXISTS (
      SELECT 1 FROM public.cached_analyses ca
      WHERE ca.id = topic_questions.analysis_id
      AND ca.created_by = auth.uid()
    )
  );

-- ============================================
-- Comments
-- ============================================
COMMENT ON POLICY "Allow read public questions to all" ON public.topic_questions
  IS 'Allows anyone (including anonymous users) to read public practice questions. Required for displaying practice topics after video analysis.';

COMMENT ON POLICY "Users can manage own questions" ON public.topic_questions
  IS 'Authenticated users can insert/update/delete questions linked to their own analyses.';
