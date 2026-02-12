-- Migration 014: Fix User Deletion Constraints
-- Purpose: Ensure all foreign keys to auth.users have proper ON DELETE behavior

SET search_path = public;

-- ============================================
-- Fix cached_analyses.created_by constraint
-- ============================================
-- This was blocking user deletion with NO ACTION default

ALTER TABLE public.cached_analyses
  DROP CONSTRAINT IF EXISTS cached_analyses_created_by_fkey;

-- Use SET NULL to preserve analyses when user is deleted
ALTER TABLE public.cached_analyses
  ADD CONSTRAINT cached_analyses_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- ============================================
-- Check and fix any other tables missing CASCADE/SET NULL
-- ============================================

-- Fix practice_topics.created_by (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'practice_topics'
      AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.practice_topics
      DROP CONSTRAINT IF EXISTS practice_topics_created_by_fkey;

    ALTER TABLE public.practice_topics
      ADD CONSTRAINT practice_topics_created_by_fkey
      FOREIGN KEY (created_by)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Fix topic_questions.created_by (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topic_questions'
      AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.topic_questions
      DROP CONSTRAINT IF EXISTS topic_questions_created_by_fkey;

    ALTER TABLE public.topic_questions
      ADD CONSTRAINT topic_questions_created_by_fkey
      FOREIGN KEY (created_by)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- Verify all constraints are now safe
-- ============================================
COMMENT ON CONSTRAINT cached_analyses_created_by_fkey ON public.cached_analyses
  IS 'SET NULL on user deletion to preserve analyses';
