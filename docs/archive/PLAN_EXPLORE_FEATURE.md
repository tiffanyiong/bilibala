# Explore Feature Implementation Plan

## Overview
Add a horizontal carousel "Explore" section on the landing page showing analyzed videos from other users. Videos are personalized by the user's selected target language and level, with popular videos as backfill.

---

## 1. New Type Definition

**File:** `src/shared/types/database.ts`

Add a new interface for explore videos (simpler than `VideoHistoryItem` - no user-specific fields):

```typescript
// For Explore section on landing page (public videos)
export interface ExploreVideo {
  // From cached_analyses
  analysisId: string;
  level: string;
  targetLang: string;
  nativeLang: string;
  analyzedAt: string;

  // From global_videos
  videoId: string;
  youtubeId: string;
  title: string;
  thumbnailUrl: string | null;
  viewCount: number;
  channelName: string | null;
}
```

---

## 2. Database Functions

**File:** `src/shared/services/database.ts`

Add two new functions:

### 2a. `getExploreVideos` - Main function with personalization + backfill

```typescript
/**
 * Get explore videos for landing page
 * Priority: 1) Matching target_lang + level, 2) Popular videos as backfill
 */
export async function getExploreVideos(
  targetLang: string,
  level: string,
  limit: number = 8
): Promise<ExploreVideo[]> {
  // Step 1: Get personalized matches (same target_lang AND level)
  const { data: personalized, error: pError } = await supabase
    .from('cached_analyses')
    .select(`
      id,
      level,
      target_lang,
      native_lang,
      created_at,
      global_videos (
        id,
        youtube_id,
        title,
        thumbnail_url,
        view_count,
        channel_name
      )
    `)
    .eq('target_lang', targetLang)
    .eq('level', level)
    .order('created_at', { ascending: false })
    .limit(limit);

  const personalizedVideos = transformToExploreVideos(personalized || []);

  // Step 2: If not enough, backfill with popular videos (any language/level)
  if (personalizedVideos.length < limit) {
    const existingYoutubeIds = personalizedVideos.map(v => v.youtubeId);
    const needed = limit - personalizedVideos.length;

    const { data: popular } = await supabase
      .from('cached_analyses')
      .select(`
        id,
        level,
        target_lang,
        native_lang,
        created_at,
        global_videos!inner (
          id,
          youtube_id,
          title,
          thumbnail_url,
          view_count,
          channel_name
        )
      `)
      .order('global_videos(view_count)', { ascending: false })
      .limit(needed + existingYoutubeIds.length); // Fetch extra to account for filtering

    // Filter out duplicates and take what we need
    const backfillVideos = transformToExploreVideos(popular || [])
      .filter(v => !existingYoutubeIds.includes(v.youtubeId))
      .slice(0, needed);

    return [...personalizedVideos, ...backfillVideos];
  }

  return personalizedVideos;
}

// Helper to transform DB response to ExploreVideo[]
function transformToExploreVideos(data: any[]): ExploreVideo[] {
  return data
    .filter((item: any) => item.global_videos)
    .map((item: any) => ({
      analysisId: item.id,
      level: item.level,
      targetLang: item.target_lang,
      nativeLang: item.native_lang,
      analyzedAt: item.created_at,
      videoId: item.global_videos.id,
      youtubeId: item.global_videos.youtube_id,
      title: item.global_videos.title || 'Untitled Video',
      thumbnailUrl: item.global_videos.thumbnail_url,
      viewCount: item.global_videos.view_count || 0,
      channelName: item.global_videos.channel_name,
    }));
}
```

---

## 3. ExploreCard Component

**File:** `src/features/explore/components/ExploreCard.tsx` (NEW)

A simpler card variant optimized for the horizontal carousel:

```typescript
interface ExploreCardProps {
  video: ExploreVideo;
  onClick: () => void;
}

// Features:
// - Fixed width (240px) for horizontal scroll
// - Thumbnail with hover scale effect
// - Title (truncated, 2 lines max)
// - Language badge + Level badge
// - View count indicator (small)
// - No favorite/delete buttons (public, not in library)
```

**Styling:**
- Card: `w-60 flex-shrink-0 bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group`
- Thumbnail: `aspect-video bg-stone-100` with `group-hover:scale-105`
- Content: `p-3` (slightly smaller padding)
- Badges: `inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-600`

Also create `ExploreCardSkeleton` for loading state.

---

## 4. ExploreCarousel Component

**File:** `src/features/explore/components/ExploreCarousel.tsx` (NEW)

The horizontal scrolling carousel container:

```typescript
interface ExploreCarouselProps {
  targetLang: string;
  level: string;
  onVideoSelect: (analysisId: string) => void;
}

// Features:
// - Fetches videos on mount and when targetLang/level changes
// - Horizontal scroll with overflow-x-auto
// - Optional scroll buttons (left/right arrows) for desktop
// - Smooth scroll behavior
// - Loading skeleton state (4-6 skeleton cards)
// - Empty state if no videos available
// - Section header: "Explore Videos" or "Start Learning"
```

**Structure:**
```tsx
<div className="space-y-4">
  {/* Header */}
  <div className="flex items-center justify-between">
    <h3 className="text-lg font-semibold text-stone-700">Explore Videos</h3>
    <p className="text-xs text-stone-400">From other learners</p>
  </div>

  {/* Carousel */}
  <div className="relative">
    {/* Left scroll button (optional, desktop only) */}
    <div
      ref={scrollRef}
      className="flex gap-4 overflow-x-auto pb-2 scroll-smooth scrollbar-hide"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {isLoading ? (
        Array(4).fill(0).map((_, i) => <ExploreCardSkeleton key={i} />)
      ) : videos.length > 0 ? (
        videos.map(video => (
          <ExploreCard
            key={video.analysisId}
            video={video}
            onClick={() => onVideoSelect(video.analysisId)}
          />
        ))
      ) : (
        <EmptyState />
      )}
    </div>
    {/* Right scroll button (optional, desktop only) */}
  </div>
</div>
```

**Scroll Buttons (Optional Enhancement):**
- Show only on desktop when content overflows
- Left/right chevron icons
- Scroll by ~240px (one card width) on click

---

## 5. Landing Page Integration

**File:** `src/App.tsx`

### 5a. Add import
```typescript
import ExploreCarousel from './features/explore/components/ExploreCarousel';
```

### 5b. Add handler function
```typescript
const handleExploreVideoSelect = async (analysisId: string) => {
  // Similar to loadFromLibrary but for explore videos
  setAppState(AppState.LOADING);
  setLoadingText('Loading video...');

  try {
    const analysis = await getCachedAnalysisById(analysisId);
    if (!analysis) throw new Error('Video not found');

    // Load the video data
    setVideoData({
      id: analysis.global_videos.youtube_id,
      url: `https://www.youtube.com/watch?v=${analysis.global_videos.youtube_id}`,
      title: analysis.global_videos.title || 'Untitled',
    });

    // Load the analysis content
    setContentAnalysis(dbAnalysisToContentAnalysis(analysis));
    setCurrentAnalysisId(analysisId);
    setLevel(analysis.level);
    setTargetLang(analysis.target_lang);
    setNativeLang(analysis.native_lang);

    setAppState(AppState.DASHBOARD);

    // Update URL for shareability
    window.history.pushState({}, '', `/${analysisId}`);

    // Increment view count
    await incrementVideoView(analysis.video_id);
  } catch (err) {
    console.error('Error loading explore video:', err);
    setErrorMsg('Failed to load video');
    setAppState(AppState.LANDING);
  }
};
```

### 5c. Add ExploreCarousel to landing page JSX
After the form card (line 1137), add:

```tsx
{/* Explore Section */}
<div className="w-full max-w-3xl mt-8">
  <ExploreCarousel
    targetLang={targetLang}
    level={level}
    onVideoSelect={handleExploreVideoSelect}
  />
</div>
```

**Note:** Use `max-w-3xl` (wider than the form's `max-w-xl`) to give the carousel more room.

---

## 6. File Structure

```
src/features/explore/
├── components/
│   ├── ExploreCarousel.tsx    # Main carousel container
│   ├── ExploreCard.tsx        # Individual video card
│   └── index.ts               # Exports
└── index.ts                   # Feature exports
```

---

## 7. Styling Details

### Carousel Scrollbar Hide (Tailwind)
Add to `index.css` or use inline styles:
```css
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

### Card Badges
- Language badge: `bg-blue-50 text-blue-600`
- Level badges:
  - Easy: `bg-green-50 text-green-600`
  - Medium: `bg-amber-50 text-amber-600`
  - Hard: `bg-red-50 text-red-600`

### Hover Effects
- Card shadow lift: `hover:shadow-md hover:-translate-y-0.5`
- Thumbnail zoom: `group-hover:scale-105 transition-transform duration-300`

---

## 8. Implementation Order

1. **Types** - Add `ExploreVideo` interface to `database.ts`
2. **Database** - Add `getExploreVideos()` and `transformToExploreVideos()`
3. **ExploreCard** - Create card component with skeleton
4. **ExploreCarousel** - Create carousel with fetch logic
5. **App.tsx** - Add handler and integrate carousel
6. **CSS** - Add scrollbar-hide utility if needed
7. **Test** - Verify on landing page with different language/level selections

---

## 9. Edge Cases to Handle

- **No videos exist** - Show friendly empty state ("No videos yet. Be the first!")
- **Loading state** - Show 4 skeleton cards
- **Error fetching** - Log error, show empty state (don't break landing page)
- **Language/level change** - Re-fetch videos with debounce (300ms)
- **Click while loading** - Disable cards during fetch

---

## 10. Future Enhancements (Not in Scope)

- "See All" link to dedicated explore page
- Category/topic filters
- Infinite scroll or pagination
- Featured videos section (using `is_featured` flag)
- "Recently added" vs "Most popular" tabs
