# Migration 020: Fix Aggressive Session Cleanup

## Problem
Migration 016 introduced a 24-hour auto-cleanup of sessions to prevent "ghost sessions" from accumulating. However, this is **too aggressive** and causes legitimate users to be randomly logged out.

### How the bug manifests:
1. User logs in and uses the app normally
2. User closes laptop or doesn't use app for 24+ hours
3. The `register_session()` function (called on every app load) deletes sessions older than 24h
4. The session check (runs every 30s) detects the session is missing
5. User is **silently logged out** with no warning

### Root cause:
The 24-hour cleanup period is too short. The original design had a 7-day cleanup period for good reason - users might not use the app every single day.

## Solution
Change the auto-cleanup period from 24 hours to **7 days**, matching the original cron job cleanup period.

This still prevents ghost sessions from accumulating indefinitely, but won't aggressively log out users who take a day or two off from using the app.

## Changes
- Updated `register_session()` function to use `INTERVAL '7 days'` instead of `INTERVAL '24 hours'`
- Updated function comment to reflect the change

## Testing
1. Log in to the app
2. Wait 24+ hours (or manually update `last_active_at` in database to be 25 hours ago)
3. Reload the app
4. **Expected**: User remains logged in (session not deleted)
5. **Before this fix**: User would be silently logged out

## Related
- Migration 016: Introduced the 24-hour cleanup (too aggressive)
- Migration 013: Original session management with 7-day cron cleanup
- AuthContext.tsx: Session validity check runs every 30s
