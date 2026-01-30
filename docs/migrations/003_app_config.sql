-- ==============================================================================
-- BILIBALA DATABASE MIGRATION: App Configuration Table
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- ==============================================================================
-- 1. APP CONFIG TABLE
-- Key-value store for application configuration.
-- Change values directly in Supabase Table Editor — no code changes needed.
-- ==============================================================================
create table if not exists app_config (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamp with time zone default now()
);

-- Enable RLS: anyone can read, only service role can write
alter table app_config enable row level security;

create policy "Anyone can read config"
  on app_config for select
  using (true);

-- ==============================================================================
-- 2. SEED DEFAULT VALUES
-- ==============================================================================
insert into app_config (key, value, description) values
  -- AI Tutor session limits
  ('ai_tutor_session_max_minutes', '40', 'Max minutes per single AI tutor session'),
  ('ai_tutor_monthly_max_minutes', '60', 'Max AI tutor minutes per month for pro users'),
  ('ai_tutor_warning_before_end_seconds', '60', 'Seconds before session limit to show countdown warning'),

  -- Free tier limits
  ('free_videos_per_month', '3', 'Max video analyses per month for free tier'),
  ('free_practice_sessions_per_month', '5', 'Max practice sessions per month for free tier'),
  ('free_video_library_max', '10', 'Max videos in library for free tier'),

  -- Anonymous user limits
  ('anonymous_video_limit', '2', 'Max video analyses per month for anonymous users'),
  ('anonymous_practice_limit', '2', 'Max practice sessions per month for anonymous users')
on conflict (key) do nothing;

-- ==============================================================================
-- 3. AUTO-UPDATE updated_at ON CHANGES
-- ==============================================================================
create or replace function update_app_config_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger app_config_updated_at
  before update on app_config
  for each row
  execute function update_app_config_timestamp();
