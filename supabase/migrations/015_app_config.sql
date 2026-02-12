-- Migration 015: App Configuration Table
-- This table stores global app configuration settings that can be updated without code changes

CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can read app config)
CREATE POLICY "Allow public read access to app config"
  ON public.app_config
  FOR SELECT
  USING (true);

-- Only admins can update (we'll manage this via Supabase dashboard or direct SQL)
-- No insert/update/delete policies - managed via SQL/dashboard only

-- Function to get app config by key
CREATE OR REPLACE FUNCTION public.get_app_config(config_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config_value TEXT;
BEGIN
  SELECT value INTO config_value
  FROM public.app_config
  WHERE key = config_key;

  RETURN config_value;
END;
$$;

-- Function to update app config (for admin use)
CREATE OR REPLACE FUNCTION public.update_app_config(
  config_key TEXT,
  config_value TEXT,
  config_description TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.app_config (key, value, description, updated_at)
  VALUES (config_key, config_value, config_description, NOW())
  ON CONFLICT (key)
  DO UPDATE SET
    value = config_value,
    description = COALESCE(config_description, public.app_config.description),
    updated_at = NOW();
END;
$$;

-- Seed initial configuration
-- Enabled target languages (languages available for learning)
INSERT INTO public.app_config (key, value, description) VALUES
(
  'enabled_target_languages',
  'English,Chinese',
  'Comma-separated list of language codes enabled for target language selection (languages users can learn). Must match language names in LANGUAGES constant.'
)
ON CONFLICT (key) DO NOTHING;

-- Optional: Add other app configs here in the future
-- Examples:
-- - max_video_duration
-- - maintenance_mode
-- - feature_flags
-- - rate_limits

COMMENT ON TABLE public.app_config IS 'Global application configuration settings managed via database';
COMMENT ON COLUMN public.app_config.key IS 'Unique configuration key identifier';
COMMENT ON COLUMN public.app_config.value IS 'Configuration value stored as JSONB for flexibility';
COMMENT ON COLUMN public.app_config.description IS 'Human-readable description of what this config does';
