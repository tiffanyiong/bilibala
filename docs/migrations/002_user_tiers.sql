-- ==============================================================================
-- BILIBALA DATABASE MIGRATION: User Tiers & Fingerprinting
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- ==============================================================================
-- 1. USER SUBSCRIPTIONS TABLE
-- Stores user tier and subscription information.
-- ==============================================================================
create table user_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique not null,

  -- Tier: 'free', 'pro', 'flex', 'admin'
  tier text not null default 'free',

  -- Monthly usage tracking (for free tier)
  monthly_usage_count integer default 0,
  usage_reset_month text,  -- '2024-01' format

  -- For Pro tier (Stripe subscription)
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,  -- 'active', 'canceled', 'past_due', 'trialing'
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,

  -- For Flex tier (credits system)
  credits_balance integer default 0,

  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Index for user lookups
create index idx_user_subscriptions_user on user_subscriptions(user_id);
create index idx_user_subscriptions_tier on user_subscriptions(tier);

-- ==============================================================================
-- 2. BROWSER FINGERPRINTS TABLE
-- Tracks anonymous users by browser fingerprint.
-- ==============================================================================
create table browser_fingerprints (
  id uuid default gen_random_uuid() primary key,
  fingerprint_hash text unique not null,

  -- Usage tracking
  monthly_usage_count integer default 0,
  usage_reset_month text,  -- '2024-01' format for easy monthly reset

  -- Metadata (for analytics, not for re-identification)
  first_seen_at timestamp with time zone default timezone('utc'::text, now()),
  last_seen_at timestamp with time zone default timezone('utc'::text, now())
);

-- Index for fingerprint lookups
create index idx_browser_fingerprints_hash on browser_fingerprints(fingerprint_hash);

-- ==============================================================================
-- 3. USAGE RECORDS TABLE
-- Detailed log of all usage (for analytics and auditing).
-- ==============================================================================
create table usage_records (
  id uuid default gen_random_uuid() primary key,

  -- User identification (one of these will be set)
  user_id uuid references auth.users(id) on delete cascade,
  fingerprint_id uuid references browser_fingerprints(id) on delete cascade,

  -- What action was performed
  action_type text not null,  -- 'video_analysis', 'practice_session', 'voice_chat'

  -- Reference to the content (optional)
  video_id uuid references global_videos(id) on delete set null,
  analysis_id uuid references cached_analyses(id) on delete set null,

  -- Was this a cache hit or fresh analysis?
  was_cached boolean default false,

  -- Credits used (for flex tier)
  credits_used integer default 0,

  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Indexes for usage queries
create index idx_usage_records_user on usage_records(user_id, created_at desc);
create index idx_usage_records_fingerprint on usage_records(fingerprint_id, created_at desc);
create index idx_usage_records_action on usage_records(action_type, created_at desc);

-- ==============================================================================
-- 4. HELPER FUNCTIONS
-- ==============================================================================

-- Get or create fingerprint record, increment usage
create or replace function check_and_increment_fingerprint_usage(
  p_fingerprint_hash text,
  p_current_month text
)
returns table(
  allowed boolean,
  usage_count integer,
  fingerprint_id uuid
) as $$
declare
  v_fingerprint browser_fingerprints%rowtype;
  v_limit integer := 3;
begin
  -- Try to get existing fingerprint
  select * into v_fingerprint
  from browser_fingerprints
  where fingerprint_hash = p_fingerprint_hash;

  if v_fingerprint.id is null then
    -- Create new fingerprint record
    insert into browser_fingerprints (fingerprint_hash, monthly_usage_count, usage_reset_month, last_seen_at)
    values (p_fingerprint_hash, 1, p_current_month, now())
    returning * into v_fingerprint;

    return query select true, 1, v_fingerprint.id;
    return;
  end if;

  -- Check if we need to reset the month
  if v_fingerprint.usage_reset_month is null or v_fingerprint.usage_reset_month != p_current_month then
    -- New month, reset count
    update browser_fingerprints
    set monthly_usage_count = 1,
        usage_reset_month = p_current_month,
        last_seen_at = now()
    where id = v_fingerprint.id;

    return query select true, 1, v_fingerprint.id;
    return;
  end if;

  -- Same month, check limit
  if v_fingerprint.monthly_usage_count >= v_limit then
    -- Update last seen but don't increment
    update browser_fingerprints
    set last_seen_at = now()
    where id = v_fingerprint.id;

    return query select false, v_fingerprint.monthly_usage_count, v_fingerprint.id;
    return;
  end if;

  -- Increment usage
  update browser_fingerprints
  set monthly_usage_count = monthly_usage_count + 1,
      last_seen_at = now()
  where id = v_fingerprint.id;

  return query select true, v_fingerprint.monthly_usage_count + 1, v_fingerprint.id;
end;
$$ language plpgsql security definer;

-- Check fingerprint usage without incrementing
create or replace function get_fingerprint_usage(
  p_fingerprint_hash text,
  p_current_month text
)
returns table(
  allowed boolean,
  usage_count integer,
  remaining integer
) as $$
declare
  v_fingerprint browser_fingerprints%rowtype;
  v_limit integer := 3;
  v_count integer;
begin
  select * into v_fingerprint
  from browser_fingerprints
  where fingerprint_hash = p_fingerprint_hash;

  if v_fingerprint.id is null then
    -- New fingerprint, full quota available
    return query select true, 0, v_limit;
    return;
  end if;

  -- Check if different month (quota reset)
  if v_fingerprint.usage_reset_month is null or v_fingerprint.usage_reset_month != p_current_month then
    return query select true, 0, v_limit;
    return;
  end if;

  v_count := coalesce(v_fingerprint.monthly_usage_count, 0);

  return query select
    v_count < v_limit,
    v_count,
    greatest(0, v_limit - v_count);
end;
$$ language plpgsql security definer;

-- Check and increment user subscription usage
create or replace function check_and_increment_user_usage(
  p_user_id uuid,
  p_current_month text
)
returns table(
  allowed boolean,
  usage_count integer,
  tier text,
  credits_remaining integer
) as $$
declare
  v_sub user_subscriptions%rowtype;
  v_limit integer := 3;
begin
  -- Get or create subscription record
  select * into v_sub
  from user_subscriptions
  where user_id = p_user_id;

  if v_sub.id is null then
    -- Create default free subscription
    insert into user_subscriptions (user_id, tier, monthly_usage_count, usage_reset_month)
    values (p_user_id, 'free', 1, p_current_month)
    returning * into v_sub;

    return query select true, 1, 'free'::text, 0;
    return;
  end if;

  -- Admin and Pro have unlimited access
  if v_sub.tier in ('admin', 'pro') then
    -- Check if pro subscription is still active
    if v_sub.tier = 'pro' and v_sub.subscription_status != 'active' then
      -- Downgrade to free tier behavior
      null; -- Fall through to free tier logic
    else
      return query select true, -1, v_sub.tier, -1;
      return;
    end if;
  end if;

  -- Flex tier uses credits
  if v_sub.tier = 'flex' then
    if v_sub.credits_balance > 0 then
      update user_subscriptions
      set credits_balance = credits_balance - 1,
          updated_at = now()
      where id = v_sub.id;

      return query select true, -1, 'flex'::text, v_sub.credits_balance - 1;
      return;
    else
      return query select false, 0, 'flex'::text, 0;
      return;
    end if;
  end if;

  -- Free tier logic
  -- Check if we need to reset the month
  if v_sub.usage_reset_month is null or v_sub.usage_reset_month != p_current_month then
    update user_subscriptions
    set monthly_usage_count = 1,
        usage_reset_month = p_current_month,
        updated_at = now()
    where id = v_sub.id;

    return query select true, 1, v_sub.tier, 0;
    return;
  end if;

  -- Same month, check limit
  if v_sub.monthly_usage_count >= v_limit then
    return query select false, v_sub.monthly_usage_count, v_sub.tier, 0;
    return;
  end if;

  -- Increment usage
  update user_subscriptions
  set monthly_usage_count = monthly_usage_count + 1,
      updated_at = now()
  where id = v_sub.id;

  return query select true, v_sub.monthly_usage_count + 1, v_sub.tier, 0;
end;
$$ language plpgsql security definer;

-- Get user usage info without incrementing
create or replace function get_user_usage(p_user_id uuid, p_current_month text)
returns table(
  tier text,
  usage_count integer,
  usage_limit integer,
  credits_balance integer,
  subscription_status text
) as $$
declare
  v_sub user_subscriptions%rowtype;
  v_limit integer := 3;
  v_count integer;
begin
  select * into v_sub
  from user_subscriptions
  where user_id = p_user_id;

  if v_sub.id is null then
    -- No subscription record, treat as new free user
    return query select 'free'::text, 0, v_limit, 0, null::text;
    return;
  end if;

  -- Reset count if new month
  if v_sub.usage_reset_month is null or v_sub.usage_reset_month != p_current_month then
    v_count := 0;
  else
    v_count := coalesce(v_sub.monthly_usage_count, 0);
  end if;

  -- Return based on tier
  if v_sub.tier in ('admin', 'pro') then
    return query select v_sub.tier, -1, -1, -1, v_sub.subscription_status;
  elsif v_sub.tier = 'flex' then
    return query select v_sub.tier, -1, -1, coalesce(v_sub.credits_balance, 0), null::text;
  else
    return query select v_sub.tier, v_count, v_limit, 0, null::text;
  end if;
end;
$$ language plpgsql security definer;

-- ==============================================================================
-- 5. ROW LEVEL SECURITY
-- ==============================================================================

alter table user_subscriptions enable row level security;
alter table browser_fingerprints enable row level security;
alter table usage_records enable row level security;

-- User subscriptions: users can only see their own
create policy "Users view own subscription"
on user_subscriptions for select
to authenticated
using (auth.uid() = user_id);

-- Allow insert for new users (handled by function)
create policy "Service can manage subscriptions"
on user_subscriptions for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Browser fingerprints: only service functions can access (security definer)
-- No direct access policies needed

-- Usage records: users can see their own
create policy "Users view own usage"
on usage_records for select
to authenticated
using (auth.uid() = user_id);

create policy "Users insert own usage"
on usage_records for insert
to authenticated
with check (auth.uid() = user_id);

-- Allow anonymous fingerprint-based usage via service functions
-- (handled by security definer functions)

-- ==============================================================================
-- 6. AUTO-CREATE SUBSCRIPTION ON USER SIGNUP (TRIGGER)
-- ==============================================================================

create or replace function handle_new_user_subscription()
returns trigger as $$
begin
  insert into public.user_subscriptions (user_id, tier)
  values (new.id, 'free')
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Trigger on auth.users insert
create or replace trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute function handle_new_user_subscription();

-- ==============================================================================
-- DONE! Run this migration after 001_initial_schema.sql
-- ==============================================================================
