# Migration 030: Fix Monthly Quota Reset by Account/Billing Cycle

**Date:** 2026-06-16
**Status:** Ready to apply

## Summary

Fixes monthly usage counters:

- `video_monthly_usage`
- `practice_session_monthly_usage`
- `ai_tutor_monthly_minutes_used`
- `usage_month`
- `usage_reset_at`

Credit balances are not reset:

- `video_credits`
- `practice_session_credits`
- `ai_tutor_credit_minutes`

## Why

Migration 019 reset Pro usage with `now() >= current_period_end`.
That can fail when Stripe webhooks or manual sync advance `current_period_end`
before the app reads usage. Once the period end moves into the future, the old
usage counters can remain forever.

It also made annual Pro users reset at the annual renewal date, even though the
product allowance is monthly.

Free users were still using calendar-month video resets. That meant a user who
signed up on June 30 could use 3 videos on June 30 and then receive 3 more on
July 1. Free video allowance now resets by account month instead.

## New Behavior

| Plan | Monthly quota reset |
| --- | --- |
| Free | Monthly anniversaries from `user_subscriptions.created_at` |
| Monthly Pro | When Stripe `current_period_start` advances to a new monthly period |
| Annual Pro | On monthly anniversaries from `current_period_start` |

Free practice/AI report remains daily and still resets with
`practice_session_daily_usage` / `usage_day`.

## Database Changes

Adds helper functions:

- `get_pro_quota_period_start(...)`
- `get_monthly_quota_period_start(...)`
- `should_reset_monthly_usage(...)`

Replaces:

- `get_current_monthly_usage(...)`
- `increment_monthly_usage(...)`
- `reset_monthly_usage(...)`

## Immediate Repair

The migration ends with a repair `UPDATE` that immediately resets rows whose
quota period is already stale. This is the data update that clears old counters
like February usage on June 16.

Equivalent repair query:

```sql
UPDATE public.user_subscriptions
SET video_monthly_usage = 0,
    practice_session_monthly_usage = 0,
    ai_tutor_monthly_minutes_used = 0,
    usage_month = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM'),
    usage_reset_at = COALESCE(
      public.get_pro_quota_period_start(billing_interval, current_period_start, current_period_end),
      public.get_monthly_quota_period_start(created_at),
      now()
    ),
    updated_at = now()
WHERE public.should_reset_monthly_usage(
  tier,
  billing_interval,
  current_period_start,
  current_period_end,
  usage_reset_at,
  usage_month,
  created_at
);
```
