-- Migration 028: Add IP Address to browser_fingerprints Table
-- Purpose: Track IP addresses for anonymous users (rate limiting, abuse prevention, analytics)
-- Related: active_sessions already tracks IP for authenticated users

SET search_path = public;

-- Add ip_address column to browser_fingerprints (nullable - not required)
ALTER TABLE public.browser_fingerprints
  ADD COLUMN IF NOT EXISTS ip_address INET NULL,
  ADD COLUMN IF NOT EXISTS last_ip_at TIMESTAMPTZ NULL;

-- Create index for IP-based queries (rate limiting by IP)
CREATE INDEX IF NOT EXISTS idx_browser_fingerprints_ip_address
  ON public.browser_fingerprints(ip_address)
  WHERE ip_address IS NOT NULL;

-- Create index for recent IP changes (security monitoring)
CREATE INDEX IF NOT EXISTS idx_browser_fingerprints_last_ip
  ON public.browser_fingerprints(last_ip_at)
  WHERE last_ip_at IS NOT NULL;

-- Comments
COMMENT ON COLUMN public.browser_fingerprints.ip_address IS 'Most recent IP address from this device (NULL if not captured yet)';
COMMENT ON COLUMN public.browser_fingerprints.last_ip_at IS 'When the IP address was last updated (NULL if not captured yet)';

-- Note: Privacy considerations
-- 1. IP addresses are PII under GDPR/CCPA
-- 2. Used only for security (rate limiting, abuse prevention)
-- 3. Optional field - NULL if IP not available or not captured
-- 4. Users should be informed in privacy policy

-- Use case examples:
-- 1. Rate limiting: Block IP with too many fingerprints in short time
-- 2. Fraud detection: Flag when single IP creates many "anonymous" users
-- 3. Analytics: Understand geographic distribution of anonymous users
-- 4. Security: Detect VPN/proxy abuse for free tier
