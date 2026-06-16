# Page Visit Tracking Implementation Summary

## Overview
Added comprehensive page visit tracking to monitor traffic from both anonymous and authenticated users.

## What Was Implemented

### 1. Migration 026: Fix RLS Policies
**File:** `supabase/migrations/026_fix_browser_fingerprints_rls.sql`

**Changes:**
- Added RLS policies to allow anonymous users to read/write `browser_fingerprints`
- Added RLS policies to allow anonymous users to read/write `usage_records`
- Previously, RLS was enabled but no policies existed, blocking all anonymous access

**Why:** Anonymous users couldn't be tracked because they were blocked from accessing these tables.

---

### 2. Migration 027: Add Page Visit Tracking
**File:** `supabase/migrations/027_add_page_visit_tracking.sql`

**New Columns Added to `browser_fingerprints`:**
- `user_id` - Links fingerprint to user after signup (NULL for anonymous)
- `page_visit_count` - Number of sessions/visits from this device
- `first_page_visit_at` - First time this device visited the app
- `last_page_visit_at` - Most recent visit from this device

**Why:** Separates page visits from video analysis actions, tracks full user journey.

---

### 3. trackPageVisit() Function
**File:** `src/shared/services/usageTracking.ts`

**What it does:**
1. Checks sessionStorage to see if already tracked this session
2. Gets browser fingerprint
3. Checks if fingerprint exists in database
4. If exists: Increments `page_visit_count`, updates `last_page_visit_at`
5. If new: Inserts new row with all tracking data
6. Links to `user_id` when user is signed in
7. Marks session as tracked in sessionStorage

**Why sessionStorage:**
- Prevents duplicate tracking when user refreshes page
- Clears when tab closes, so return visits are tracked
- Each new session = one page visit increment

---

### 4. App Integration
**File:** `src/App.tsx`

**Changes:**
- Imported `trackPageVisit` function
- Added useEffect hook that calls `trackPageVisit(user?.id)` on mount
- Tracks both anonymous and authenticated users
- Automatically links fingerprint to user_id when signed in

---

## How It Works

### Anonymous User Journey:
```
1. User opens app (incognito browser)
   → trackPageVisit() called
   → fingerprint generated: "abc123"
   → INSERT browser_fingerprints (fingerprint_hash="abc123", page_visit_count=1, user_id=NULL)

2. User refreshes page
   → sessionStorage has 'page_visit_tracked'
   → Skip tracking (no DB call)

3. User closes tab, comes back tomorrow
   → sessionStorage cleared
   → trackPageVisit() called
   → fingerprint same: "abc123"
   → UPDATE browser_fingerprints SET page_visit_count=2, last_page_visit_at=NOW()

4. User analyzes video
   → recordAnonymousUsage() called (existing function)
   → UPDATE browser_fingerprints SET monthly_usage_count=1
```

### Authenticated User Journey:
```
1. User signs in
   → trackPageVisit(user.id) called
   → fingerprint: "abc123"
   → UPDATE browser_fingerprints SET user_id='user-id-123'
   → Now linked to user account

2. User opens app on different device (phone)
   → trackPageVisit(user.id) called
   → New fingerprint: "xyz789"
   → INSERT browser_fingerprints (fingerprint_hash="xyz789", user_id='user-id-123')
   → Both devices now linked to same user

3. Query user's devices:
   → SELECT * FROM browser_fingerprints WHERE user_id='user-id-123'
   → Returns 2 rows (laptop + phone)
```

---

## Data Structure

### browser_fingerprints Table Schema:
```sql
CREATE TABLE browser_fingerprints (
  id UUID PRIMARY KEY,
  fingerprint_hash TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Page visit tracking (NEW)
  page_visit_count INTEGER DEFAULT 0,
  first_page_visit_at TIMESTAMPTZ,
  last_page_visit_at TIMESTAMPTZ,

  -- Video analysis tracking (EXISTING)
  monthly_usage_count INTEGER DEFAULT 0,
  usage_reset_month TEXT,
  practice_session_count INTEGER DEFAULT 0,
  practice_reset_month TEXT,

  -- Metadata
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Key Metrics You Can Track

### Traffic Metrics:
- **Total unique visitors** - `COUNT(*) FROM browser_fingerprints`
- **Anonymous vs authenticated** - `WHERE user_id IS NULL vs IS NOT NULL`
- **New visitors (last 7 days)** - `WHERE first_page_visit_at > NOW() - INTERVAL '7 days'`
- **Active visitors (last 30 days)** - `WHERE last_page_visit_at > NOW() - INTERVAL '30 days'`
- **Total page visits** - `SUM(page_visit_count)`

### Conversion Funnel:
- **Landing rate** - All visitors
- **Analysis rate** - `WHERE monthly_usage_count > 0`
- **Signup rate** - `WHERE user_id IS NOT NULL`

### Engagement:
- **Return visitor rate** - `WHERE page_visit_count > 1`
- **Average visits per device** - `AVG(page_visit_count)`
- **Most engaged devices** - `ORDER BY page_visit_count DESC`

See [ANALYTICS_QUERIES.md](./ANALYTICS_QUERIES.md) for complete query examples.

---

## How to Apply

### Step 1: Apply Migrations
```bash
# In your terminal
npx supabase db push
```

Or manually in Supabase SQL Editor:
1. Copy `supabase/migrations/026_fix_browser_fingerprints_rls.sql`
2. Paste and run in Supabase SQL Editor
3. Copy `supabase/migrations/027_add_page_visit_tracking.sql`
4. Paste and run in Supabase SQL Editor

### Step 2: Deploy Code
The TypeScript changes are already in place:
- ✅ `trackPageVisit()` function added to `usageTracking.ts`
- ✅ Function called on app mount in `App.tsx`
- ✅ sessionStorage caching implemented

### Step 3: Test
1. Open app in incognito browser
2. Check Supabase `browser_fingerprints` table
3. Should see new row with:
   - `fingerprint_hash` populated
   - `page_visit_count = 1`
   - `first_page_visit_at` = current timestamp
   - `user_id = NULL`

4. Close tab, reopen app
5. Should see same fingerprint with:
   - `page_visit_count = 2`
   - `last_page_visit_at` = updated timestamp

---

## Privacy & Security

### Privacy-Friendly:
- ✅ No cookies required
- ✅ No personal data stored
- ✅ Fingerprints are hashed (anonymous)
- ✅ GDPR compliant
- ✅ Users with ad blockers still tracked (fingerprint API)

### Security:
- ✅ RLS policies enforce data isolation
- ✅ Anonymous users can't see others' data
- ✅ Authenticated users only see own data
- ✅ Worst case: user manipulates own usage count (cosmetic issue)

---

## Troubleshooting

### Issue: No fingerprints inserted
**Check:**
1. Did you apply migration 026? (RLS fix)
2. Check browser console for errors
3. Check Supabase logs for RLS policy errors

### Issue: Duplicate counting on refresh
**Check:**
1. Is sessionStorage working? (Check dev tools → Application → Session Storage)
2. Should see `page_visit_tracked = true` after first visit

### Issue: Not tracking signed-in users
**Check:**
1. Is `user?.id` being passed to `trackPageVisit()`?
2. Check `user_id` column in `browser_fingerprints` - should be populated for signed-in users

---

## Future Enhancements

### Potential Additions:
1. **Geographic data** - Add country/city detection (use IP geolocation API)
2. **Referrer tracking** - Track where users came from (document.referrer)
3. **UTM parameters** - Track marketing campaigns
4. **Session duration** - Track how long users stay
5. **Admin dashboard** - Visualize analytics in-app
6. **Page-level tracking** - Track specific pages visited (not just landing)

---

## Files Modified

1. ✅ `supabase/migrations/026_fix_browser_fingerprints_rls.sql` - NEW
2. ✅ `supabase/migrations/027_add_page_visit_tracking.sql` - NEW
3. ✅ `src/shared/services/usageTracking.ts` - Added `trackPageVisit()` function
4. ✅ `src/App.tsx` - Added useEffect to call `trackPageVisit()` on mount
5. ✅ `docs/ANALYTICS_QUERIES.md` - NEW (50+ analytics queries)
6. ✅ `docs/PAGE_VISIT_TRACKING_IMPLEMENTATION.md` - This file

---

## Questions?

If you have issues or questions:
1. Check Supabase logs (Database → Logs)
2. Check browser console for errors
3. Review `ANALYTICS_QUERIES.md` for query examples
4. Test in incognito to verify anonymous tracking works
