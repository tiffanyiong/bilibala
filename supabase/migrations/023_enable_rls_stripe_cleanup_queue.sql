-- Migration 023: Enable RLS on stripe_cleanup_queue
-- Purpose: Fix security vulnerability - stripe_cleanup_queue is exposed to PostgREST but has no RLS

SET search_path = public;

-- ============================================
-- Enable RLS on stripe_cleanup_queue
-- ============================================
ALTER TABLE public.stripe_cleanup_queue ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies: Deny all direct access
-- ============================================
-- This table is only meant to be accessed by:
-- 1. SECURITY DEFINER triggers (which bypass RLS)
-- 2. Backend cron jobs using service role key (which bypasses RLS)
-- Regular users should never access this table directly via the API

-- Drop any existing policies first
DROP POLICY IF EXISTS "No direct access to stripe_cleanup_queue" ON public.stripe_cleanup_queue;

-- Create restrictive policy that denies all access
-- Note: SECURITY DEFINER functions will bypass this and work correctly
CREATE POLICY "No direct access to stripe_cleanup_queue"
  ON public.stripe_cleanup_queue
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- ============================================
-- Comments
-- ============================================
COMMENT ON POLICY "No direct access to stripe_cleanup_queue" ON public.stripe_cleanup_queue
  IS 'Prevents direct API access. Table is only accessible via SECURITY DEFINER triggers and backend service role.';
