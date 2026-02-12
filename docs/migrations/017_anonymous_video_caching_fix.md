# Migration 017: Anonymous Video Caching Fix

## Problem

Anonymous users were analyzing videos but the results **weren't being saved to the database**. This meant:

1. ❌ No caching for anonymous users
2. ❌ Every analysis costs money (Gemini API call)
3. ❌ Future users (anonymous or authenticated) couldn't benefit from cached results
4. ❌ Database remained empty despite usage

## Root Cause

The `global_videos` and `cached_analyses` tables had **Row Level Security (RLS) policies** that only allowed **authenticated users** to INSERT:

```sql
-- Old restrictive policies
CREATE POLICY "Authenticated users can insert videos" ON public.global_videos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can insert analyses" ON public.cached_analyses
  FOR INSERT TO authenticated WITH CHECK (true);
```

### What Happened (Before Fix)

1. Anonymous user analyzes a video
2. Analysis completes successfully via Gemini API ✅
3. App tries to save video: `getOrCreateVideo(videoId, title)`
4. **RLS blocks INSERT** because user is not authenticated ❌
5. `getOrCreateVideo()` returns `null`
6. `saveCachedAnalysis()` is skipped (no video_id)
7. Analysis is **lost** and not cached ❌
8. Next user who analyzes same video pays for AI analysis again 💸

## Solution

Change RLS policies to allow **anyone** (including anonymous users) to INSERT into these tables:

```sql
-- New permissive policies (Migration 017)
CREATE POLICY "Anyone can insert videos" ON public.global_videos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can insert analyses" ON public.cached_analyses
  FOR INSERT WITH CHECK (true);
```

### Why This Is Safe

- ✅ **Videos are public data** (YouTube IDs + metadata from public API)
- ✅ **UNIQUE constraint** on `youtube_id` prevents duplicates
- ✅ **No sensitive user data** stored in these tables
- ✅ **Anonymous analyses benefit everyone** (shared cache)
- ✅ **created_by** field still tracks who created it (NULL for anonymous)

### What Happens (After Fix)

1. Anonymous user analyzes a video
2. Analysis completes successfully via Gemini API ✅
3. App saves video: `getOrCreateVideo(videoId, title)` ✅
4. **RLS allows INSERT** for anonymous users ✅
5. `getOrCreateVideo()` returns video object
6. `saveCachedAnalysis()` saves the analysis ✅
7. Analysis is **cached in database** ✅
8. Next user gets instant cached results (no API cost) 💰

## Status

✅ **Already deployed to production** (manually applied via Supabase Dashboard)

The migration file `supabase/migrations/017_allow_anonymous_video_insert.sql` documents the change for:
- Version control
- Future database rebuilds
- Team knowledge sharing

## Files Modified

- ✅ `supabase/migrations/017_allow_anonymous_video_insert.sql` - Migration script
- ✅ `docs/migrations/production_full_schema.sql` - Updated to reflect current state
- ✅ `MEMORY.md` - Documented the gotcha for future reference

## Related Code

- [src/shared/services/database.ts:38-84](../../src/shared/services/database.ts#L38-L84) - `getOrCreateVideo()` function
- [src/shared/services/database.ts:245-284](../../src/shared/services/database.ts#L245-L284) - `saveCachedAnalysis()` function
- [src/App.tsx:1108-1170](../../src/App.tsx#L1108-L1170) - Video analysis save flow
