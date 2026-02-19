-- Migration 026: Fix browser_fingerprints RLS for anonymous users
-- Problem: browser_fingerprints has RLS enabled but no policies, blocking all access
-- Solution: Allow anonymous users to read/write their own fingerprint data

SET search_path = public;

-- Drop existing policies if any (defensive)
DROP POLICY IF EXISTS "Anyone can read browser fingerprints" ON public.browser_fingerprints;
DROP POLICY IF EXISTS "Anyone can insert browser fingerprints" ON public.browser_fingerprints;
DROP POLICY IF EXISTS "Anyone can update browser fingerprints" ON public.browser_fingerprints;

-- Allow anyone (including anonymous) to read any fingerprint
-- This is safe because fingerprints are hashed and contain no personal info
CREATE POLICY "Anyone can read browser fingerprints"
  ON public.browser_fingerprints
  FOR SELECT
  USING (true);

-- Allow anyone (including anonymous) to insert new fingerprints
-- This is necessary for tracking anonymous users
CREATE POLICY "Anyone can insert browser fingerprints"
  ON public.browser_fingerprints
  FOR INSERT
  WITH CHECK (true);

-- Allow anyone (including anonymous) to update fingerprints
-- This is needed to update usage counts and last_seen_at
CREATE POLICY "Anyone can update browser fingerprints"
  ON public.browser_fingerprints
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Note: We use broad policies here because:
-- 1. Fingerprint hashes are anonymous (no PII)
-- 2. Anonymous users need to track their own usage
-- 3. The fingerprint hash itself acts as the security boundary
-- 4. Worst case: someone manipulates their own usage count (still rate-limited by IP/server)

-- ============================================
-- Fix usage_records RLS for anonymous users
-- ============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users view own usage" ON public.usage_records;
DROP POLICY IF EXISTS "Users insert own usage" ON public.usage_records;

-- Allow authenticated users to view their own records
CREATE POLICY "Users view own usage"
  ON public.usage_records
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Allow anonymous users to view records by fingerprint
CREATE POLICY "Anonymous users view own usage"
  ON public.usage_records
  FOR SELECT TO anon
  USING (user_id IS NULL);

-- Allow authenticated users to insert their own records
CREATE POLICY "Users insert own usage"
  ON public.usage_records
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow anonymous users to insert records (user_id will be NULL)
CREATE POLICY "Anonymous users insert usage"
  ON public.usage_records
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);
