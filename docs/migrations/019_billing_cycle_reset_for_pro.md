# Migration 019: Billing Cycle Reset for Pro Users

**Date:** 2026-02-12
**Status:** ✅ Implemented

## Summary
Changes Pro users' monthly usage reset from **calendar months** to **billing cycles** (based on their Stripe subscription period). Free users continue to reset on calendar months.

## Problem
Previously, ALL users (free and pro) had their monthly limits reset on the 1st of every month at UTC midnight. This didn't align with Pro users' actual billing dates, which could be any day of the month depending on when they subscribed.

## Solution
- Pro users' usage now resets based on `current_period_end` from their Stripe subscription
- Free users continue to reset on calendar months (1st of each month)
- Frontend displays correct reset date/time for each tier

## Changes

### Database Functions

#### Updated Function: `get_current_monthly_usage()`
- Now checks user's tier before determining reset logic
- **Pro users**: Resets when `now() >= current_period_end` (billing period ended)
- **Free users**: Resets when calendar month changes (stored_month != current_month)

#### Updated Function: `increment_monthly_usage()`
- Same tier-based reset logic as above
- Ensures usage counters reset at the right time before incrementing

### Frontend Changes

#### `SubscriptionPage.tsx`
- Updated `getMonthlyResetInfo(tier, periodEnd)` to accept tier and period end date
- **Free tier**: Shows next month's 1st at UTC midnight in user's local time
- **Pro tier**: Shows `current_period_end` date in user's local time
- Displays reset info for Video Analysis and AI Tutor

## Behavior

### Free Tier Users
- **Reset**: 1st of every month at UTC midnight (no change)
- **Display**: "Resets Mar 1 at 4:00 PM PST"

### Pro Tier Users
- **Reset**: Based on billing cycle (when subscription renews)
- **Examples**:
  - Subscribed Feb 15 → Resets every 15th
  - Subscribed Jan 3 → Resets every 3rd
- **Display**: "Resets Feb 15 at 2:30 PM PST" (actual billing renewal time)

## Examples

### Scenario 1: Pro user subscribed on Feb 15, 2026 at 2:30 PM UTC
- **Current period end**: Mar 15, 2026 at 2:30 PM UTC
- **Reset display (PST user)**: "Resets Mar 15 at 6:30 AM PST"
- **Usage resets**: When Mar 15, 2026 2:30 PM UTC arrives

### Scenario 2: Free user
- **Reset**: Always Mar 1, 2026 at 12:00 AM UTC
- **Reset display (PST user)**: "Resets Mar 1 at 4:00 PM PST" (Feb 28 in PST)
- **Usage resets**: When calendar month changes

## Migration Steps

1. **Run migration SQL**:
```bash
psql -f supabase/migrations/019_billing_cycle_reset_for_pro.sql
```

2. **Deploy frontend** with updated reset display logic

3. **Verify**:
   - Check Pro users see their actual billing renewal date
   - Check Free users still see calendar month reset
   - Test that usage resets at the correct time for both tiers

## Important Notes
- Pro users need valid `current_period_end` in database (from Stripe webhook)
- If `current_period_end` is NULL, falls back to calendar month reset
- Reset time is stored in UTC, displayed in user's local timezone
- This change does NOT affect when Stripe charges users (that's still controlled by Stripe)

## Edge Cases Handled
- Pro user with missing `current_period_end` → Falls back to calendar month reset
- Pro user downgrades to Free → Switches to calendar month reset immediately
- Free user upgrades to Pro → Switches to billing cycle reset after Stripe webhook updates `current_period_end`
