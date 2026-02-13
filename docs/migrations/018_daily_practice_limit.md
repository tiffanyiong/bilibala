# Migration 018: Daily Practice Session Limit for Free Users

**Date:** 2026-02-12
**Status:** ✅ Implemented

## Summary
Changes free tier practice sessions from **5 sessions per month** to **2 sessions per day** (resets daily at UTC midnight).

## Problem
The monthly limit of 5 practice sessions was too restrictive and didn't align with daily learning habits. Users wanted to practice more frequently but in smaller amounts.

## Solution
- Add daily usage tracking columns to `user_subscriptions` table
- Create new database function `get_current_daily_practice_usage()` for daily tracking
- Update `increment_monthly_usage()` to also increment daily counter for practice sessions
- Update client-side logic to check daily limit for free users
- Pro users continue to have unlimited practice sessions

## Changes

### Database Schema
Added to `user_subscriptions` table:
- `practice_session_daily_usage INTEGER DEFAULT 0` — Daily practice session counter
- `usage_day TEXT` — Tracks current day (YYYY-MM-DD format in UTC)

### Database Functions

#### New Function: `get_current_daily_practice_usage(p_user_id UUID)`
- Returns current day's practice session usage
- Auto-resets to 0 if day has changed (UTC timezone)
- Used by frontend to check daily limit

#### Updated Function: `increment_monthly_usage()`
- Now also increments `practice_session_daily_usage` when `p_action_type = 'practice_session'`
- Auto-resets daily counter if day changed

#### Updated Function: `get_current_monthly_usage()`
- Now also handles daily reset for practice sessions
- Auto-resets `practice_session_daily_usage` if day changed

#### Updated Function: `reset_monthly_usage()`
- Now also resets `practice_session_daily_usage` and `usage_day`

### App Config
Added new config key:
```sql
('free_practice_sessions_per_day', '2', 'Max practice sessions per day for free tier')
```

Updated existing config:
```sql
('free_practice_sessions_per_month', '5', 'DEPRECATED: Max practice sessions per month (now using daily limit for free tier)')
```

### Frontend Changes

#### `src/shared/types/database.ts`
- Added `practiceSessionsDailyUsed: number` to `MonthlyUsage` interface
- Added `practiceSessionsPerDay: 2` to `TIER_LIMITS.free`
- Added `practiceSessionsPerDay: Infinity` to `TIER_LIMITS.pro`

#### `src/shared/services/subscriptionDatabase.ts`
- Added `getDailyPracticeUsage(userId)` function to fetch daily usage

#### `src/shared/context/SubscriptionContext.tsx`
- Updated to fetch and track daily practice usage
- Updated `canStartPractice` logic:
  - **Free tier**: Check daily limit (2/day), fallback to credits
  - **Pro tier**: Unlimited
- Updated `recordAction` for 'practice_session':
  - Free tier: Increment both monthly and daily counters
  - Pro tier: Only increment monthly counter (daily is Infinity)
- Display limit now shows daily limit (2) for free tier instead of monthly (5)

## Behavior

### Free Tier Users
- **Limit**: 2 practice sessions per day
- **Reset**: Every day at 00:00 UTC
- **Credits**: Can use purchased practice session credits when daily limit exhausted
- **Display**: Usage shown as "X/2 today" instead of "X/5 this month"

### Pro Tier Users
- **Limit**: Unlimited
- **No change**: Pro users not affected by this migration

### Anonymous Users
- **No change**: Anonymous users keep monthly limit (tracked via browser fingerprints)
- This migration only affects authenticated free users

## Reset Logic
- **Daily reset time**: 00:00 UTC (midnight UTC)
- **Timezone**: UTC (consistent worldwide, no daylight saving time issues)
- **Auto-reset**: Database functions automatically reset `practice_session_daily_usage` when `usage_day` changes

## Migration Steps

### 1. Run Migration SQL
```bash
# Apply migration 018 to production
psql -f supabase/migrations/018_daily_practice_limit.sql
```

### 2. Deploy Backend
No backend changes required (uses existing functions)

### 3. Deploy Frontend
Deploy updated frontend with new daily limit logic

### 4. Verify
- Check that free users see "2 per day" limit
- Test that counter resets at UTC midnight
- Verify Pro users still have unlimited
- Confirm credits work when daily limit exhausted

## Rollback Plan
If needed, rollback by:
1. Revert frontend to use monthly limit
2. Remove daily columns (optional, not urgent):
```sql
ALTER TABLE user_subscriptions DROP COLUMN practice_session_daily_usage;
ALTER TABLE user_subscriptions DROP COLUMN usage_day;
```

## Notes
- This change only affects **authenticated free users**
- **Pro users** are unaffected (still unlimited)
- **Anonymous users** keep monthly tracking via `browser_fingerprints` table
- Daily reset uses UTC timezone for consistency (no DST issues)
- Existing free user monthly usage counters are preserved for reporting purposes
