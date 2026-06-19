-- Migration 031: Separate anonymous practice reset tracking
-- Anonymous video analysis and practice usage have independent counters, so they
-- need independent reset-month markers. Sharing usage_reset_month can keep an
-- old practice count active after video usage updates the current month.

ALTER TABLE public.browser_fingerprints
  ADD COLUMN IF NOT EXISTS practice_reset_month text;

UPDATE public.browser_fingerprints
SET practice_reset_month = usage_reset_month
WHERE practice_reset_month IS NULL
  AND COALESCE(monthly_practice_count, 0) > 0;

COMMENT ON COLUMN public.browser_fingerprints.practice_reset_month
  IS 'YYYY-MM of last anonymous practice usage reset for monthly_practice_count.';
