# Video Library Feature - Implementation Plan (Revised v2)

## Overview
Create a Video Library feature that allows users to view their analyzed video history and access their speaking practice feedback reports.

---

## Design Principles

> **RULE**: All UI must be responsive for desktop, tablet, and mobile views. The style must always be clean, aesthetic, and user-friendly.

- **Desktop**: 3-column grid (3x3 cards visible)
- **Tablet**: 2-column grid
- **Mobile**: 1-column grid (stacked cards)
- **Consistent spacing, typography, and color palette across all breakpoints**

---

## UI Design

### 1. Access Point
- **Location**: User menu dropdown → "Video" button
- **Behavior**: Opens Video Library as a modal/slide-over panel

### 2. Video Library Modal - Grid Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  📚 My Video Library                                           [X]   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 🔍 Search videos... (AI-powered)                                      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Filters:  [All] [English] [Chinese] [Easy] [Medium] [Hard]                 │
│                                                                             │
│  ───────────────────────────────────────────────────────────────────────    │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │              │
│  │ │   🎬        │ │  │ │   🎬        │ │  │ │   🎬        │ │              │
│  │ │  thumbnail  │ │  │ │  thumbnail  │ │  │ │  thumbnail  │ │              │
│  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │              │
│  │ Video Title...  │  │ Another Title.. │  │ Third Video... │              │
│  │ English • Easy  │  │ Chinese • Med   │  │ English • Hard │              │
│  │ Dec 15, 2024    │  │ Dec 10, 2024    │  │ Dec 5, 2024    │              │
│  │                 │  │                 │  │                 │              │
│  │ [🎤 3 Reports]  │  │                 │  │ [🎤 1 Report]  │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │              │
│  │ │   🎬        │ │  │ │   🎬        │ │  │ │   🎬        │ │              │
│  │ │  thumbnail  │ │  │ │  thumbnail  │ │  │ │  thumbnail  │ │              │
│  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │              │
│  │ Fourth Video..  │  │ Fifth Video...  │  │ Sixth Video... │              │
│  │ Spanish • Easy  │  │ English • Med   │  │ French • Easy  │              │
│  │ Nov 28, 2024    │  │ Nov 25, 2024    │  │ Nov 20, 2024   │              │
│  │                 │  │ [🎤 2 Reports]  │  │                 │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Responsive Grid:**
```css
/* Desktop: 3 columns */
grid-template-columns: repeat(3, 1fr)

/* Tablet (md): 2 columns */
@media (max-width: 1024px) {
  grid-template-columns: repeat(2, 1fr)
}

/* Mobile (sm): 1 column */
@media (max-width: 640px) {
  grid-template-columns: 1fr
}
```

**Key Points:**
- Grid layout with responsive columns
- Each card: thumbnail (top), title, language, level, date
- Practice Reports badge only shown if user has sessions
- Click card → Navigate to analyzed video dashboard
- Click badge → Navigate to Practice Reports

---

### 3. AI-Powered Search

The search uses AI to understand natural language queries and find relevant videos.

**How it works:**
1. User types query (e.g., "videos about cooking" or "my Japanese lessons")
2. Frontend sends query to backend API
3. Backend uses AI (Gemini) to:
   - Parse the query intent
   - Generate semantic search against video titles/summaries
   - Filter by language/level if mentioned in query
4. Return matched videos sorted by relevance

**Example queries:**
- "cooking tutorials" → Finds videos with cooking-related titles
- "beginner Chinese" → Filters to Chinese + Easy level
- "videos from last week" → Filters by date
- "grammar lessons" → Semantic match on content

**Backend endpoint:**
```
POST /api/search-videos
{
  "query": "cooking tutorials",
  "userId": "uuid"
}
```

**Fallback:** If AI search fails, fall back to simple text search on title.

---

### 4. Practice Reports Page

When user clicks "🎤 X Practice Reports" badge:

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  [← Back]          Practice Reports              [X]     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Video: "How to Learn a Language Fast"                          │
│  English • Easy                                                 │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  📝 Daily Routine                                       │    │
│  │  Dec 15, 2024 at 3:45 PM                                │    │
│  │                                                         │    │
│  │  "I wake up at 7am and then I have breakfast..."        │    │
│  │                                                         │    │
│  │                                    [View Full Report →] │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  📝 Travel Experiences                                  │    │
│  │  Dec 14, 2024 at 2:30 PM                                │    │
│  │                                                         │    │
│  │  "Last summer I went to Japan with my family..."        │    │
│  │                                                         │    │
│  │                                    [View Full Report →] │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Each card shows:**
- Topic name
- Date & time
- Transcription snippet (first ~50 chars)
- "View Full Report" button

---

### 5. Full Report View (PyramidFeedback)

When user clicks "View Full Report":
- Opens the **same PyramidFeedback component** used after practice
- Shows the communication graph, AI feedback, language polish, transcription
- Audio playback if available
- User can see exactly what they said and how AI analyzed it

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  [← Back to Reports]                              [X]    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│                    Communication Logic                          │
│                   Detected: MINTO PYRAMID                       │
│                                                                 │
│              [My Logic]  [AI Improved]                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  │              ┌─────────────┐                            │    │
│  │              │  Conclusion │                            │    │
│  │              └──────┬──────┘                            │    │
│  │         ┌───────────┼───────────┐                       │    │
│  │    ┌────┴────┐ ┌────┴────┐ ┌────┴────┐                  │    │
│  │    │ Point 1 │ │ Point 2 │ │ Point 3 │                  │    │
│  │    └─────────┘ └─────────┘ └─────────┘                  │    │
│  │                                                         │    │
│  │              [ReactFlow Graph]                          │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ─── Language Polish & Alternatives ───                         │
│                                                                 │
│  ─── Coach's Feedback ───                                       │
│  ✓ Strengths    △ Areas for Improvement    💡 Tips              │
│                                                                 │
│  ─── Transcription ───                                          │
│  [🔊 Play Recording]                                            │
│  "Your transcribed text here..."                                │
│                                                                 │
│             [GREAT JOB!]  (stamp)                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Flow Summary

```
User Menu
    │
    ▼
📚 Video Library Modal (Grid View)
    │
    ├─── Click video card ───────────────► Dashboard (analyzed video)
    │                                       - Video player
    │                                       - Transcript
    │                                       - Vocabulary
    │                                       - AI Tutor
    │                                       - Practice Topics
    │
    └─── Click "🎤 Practice Reports" ───► Practice Reports Page
                                              │
                                              └─► Full Report (PyramidFeedback)
                                                  - Communication graph
                                                  - AI feedback
                                                  - Audio playback
                                                  - Transcription
```

---

## Data Model

### Database Schema: `user_library`

```sql
create table public.user_library (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  analysis_id uuid not null,
  is_favorite boolean null default false,
  practice_count integer null default 0,
  last_score integer null,
  last_accessed_at timestamp with time zone null default timezone ('utc'::text, now()),
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint user_library_pkey primary key (id),
  constraint user_library_user_id_analysis_id_key unique (user_id, analysis_id),
  constraint user_library_analysis_id_fkey foreign KEY (analysis_id) references cached_analyses (id) on delete CASCADE,
  constraint user_library_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_user_library_user on public.user_library using btree (user_id, last_accessed_at desc) TABLESPACE pg_default;
```

**Relationships:**
- `user_library` → `cached_analyses` → `global_videos`
- `user_library.analysis_id` links to the specific analysis (which includes language/level)
- `cached_analyses.video_id` links to the actual video

### Types

```typescript
// Database row type for user_library
interface DbUserLibrary {
  id: string;
  user_id: string;
  analysis_id: string;
  is_favorite: boolean;
  practice_count: number;
  last_score: number | null;
  last_accessed_at: string;
  created_at: string;
}

// Insert type for user_library
type InsertUserLibrary = {
  user_id: string;
  analysis_id: string;
  is_favorite?: boolean;
  practice_count?: number;
  last_score?: number | null;
};

// Combined type for UI display (joins user_library + cached_analyses + global_videos)
interface VideoHistoryItem {
  // From user_library
  libraryId: string;
  isFavorite: boolean;
  practiceCount: number;
  lastScore: number | null;
  lastAccessedAt: string;

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
}
```

### Database Functions

```typescript
// Add video to user's library (called when user analyzes a video)
async function addToUserLibrary(
  userId: string,
  analysisId: string
): Promise<DbUserLibrary | null>

// Get user's video library with full details
async function getUserVideoLibrary(userId: string): Promise<VideoHistoryItem[]>

// Update last_accessed_at when user opens a video
async function updateLibraryAccess(
  userId: string,
  analysisId: string
): Promise<void>

// Toggle favorite status
async function toggleLibraryFavorite(
  userId: string,
  libraryId: string
): Promise<void>

// Update practice count and last score after practice session
async function updateLibraryPracticeStats(
  userId: string,
  analysisId: string,
  score: number
): Promise<void>

// Get practice sessions for a specific analysis
async function getPracticeSessionsForAnalysis(
  userId: string,
  analysisId: string
): Promise<DbPracticeSession[]>

// AI-powered search for videos in user's library
async function searchUserLibrary(
  userId: string,
  query: string
): Promise<VideoHistoryItem[]>

// Remove video from library
async function removeFromLibrary(
  userId: string,
  libraryId: string
): Promise<void>
```

### Query Example: Get User's Video Library

```sql
SELECT
  ul.id as library_id,
  ul.is_favorite,
  ul.practice_count,
  ul.last_score,
  ul.last_accessed_at,
  ca.id as analysis_id,
  ca.level,
  ca.target_lang,
  ca.native_lang,
  ca.created_at as analyzed_at,
  gv.id as video_id,
  gv.youtube_id,
  gv.title,
  gv.thumbnail_url
FROM user_library ul
JOIN cached_analyses ca ON ul.analysis_id = ca.id
JOIN global_videos gv ON ca.video_id = gv.id
WHERE ul.user_id = $user_id
ORDER BY ul.last_accessed_at DESC;
```

---

## Component Structure

```
src/
├── features/
│   └── library/
│       └── components/
│           ├── VideoLibraryModal.tsx    # Main modal with grid view
│           ├── VideoCard.tsx            # Individual video card (grid item)
│           ├── PracticeReportsModal.tsx # List of practice sessions
│           ├── PracticeReportCard.tsx   # Single practice session card
│           ├── SearchBar.tsx            # AI-powered search input
│           └── FilterBar.tsx            # Language/level filter pills
```

---

## Codebase Compatibility Notes

### Existing Infrastructure ✅
- `DbCachedAnalysis`, `DbGlobalVideo`, `DbPracticeSession` types exist
- `saveCachedAnalysis()`, `savePracticeSession()` functions exist
- App.tsx already has `savedAnalysis.id` available when saving
- Server uses Express with modular routes

### Linking Practice Sessions to Analysis
Practice sessions link to analysis through `practice_topics`:
```
practice_sessions.topic_id → practice_topics.id → practice_topics.analysis_id
```

Query to get practice sessions for an analysis:
```sql
SELECT ps.* FROM practice_sessions ps
JOIN practice_topics pt ON ps.topic_id = pt.id
WHERE pt.analysis_id = $analysisId AND ps.user_id = $userId
ORDER BY ps.created_at DESC
```

---

## Known Issues & Considerations

### 1. Missing `analysisId` in PracticeSession Component
**Issue**: `PracticeSession` component doesn't receive `analysisId` as a prop.
**Impact**: Cannot call `updateLibraryPracticeStats()` after practice.
**Solution**:
- Add `analysisId?: string` prop to `PracticeSessionProps`
- Pass it from App.tsx when rendering `<PracticeSession />`
- Store `currentAnalysisId` in App.tsx state

### 2. Practice Sessions Without `topic_id`
**Issue**: If a user's practice session has `topic_id = null`, we can't link it back to an analysis.
**Impact**: Those sessions won't appear in "Practice Reports" for a video.
**Solution**:
- Ensure `topic.topicId` is always passed when starting practice
- For historical data with null `topic_id`, those reports may be orphaned

### 3. Cached Analysis Access - No Library Entry
**Issue**: When user loads a video from cache (previously analyzed by someone else), there's no `user_library` entry for them.
**Impact**: Video won't appear in their library.
**Solution**:
- Call `addToUserLibrary()` when loading from cache too (not just fresh analysis)
- Use upsert to avoid duplicates

### 4. Supabase Nested Joins
**Issue**: Need to verify Supabase JS client supports nested foreign key joins for `getUserVideoLibrary()`.
**Impact**: May need to use raw SQL via `.rpc()` instead of `.select()`.
**Solution**:
- Test with Supabase client first
- Fallback: Create a database function/view if needed:
```sql
CREATE VIEW user_library_with_videos AS
SELECT ... FROM user_library ul
JOIN cached_analyses ca ON ul.analysis_id = ca.id
JOIN global_videos gv ON ca.video_id = gv.id;
```

### 5. AI Search Rate Limits
**Issue**: Calling Gemini API for every search query may hit rate limits or add latency.
**Impact**: Slow search experience, potential API costs.
**Solution**:
- Debounce search input (300-500ms)
- Cache recent search results
- Use simple text search for short queries (<3 chars)
- Fallback to text search if AI fails

### 6. PyramidFeedback Component Dependency on Props
**Issue**: `PyramidFeedback` expects `onRetry` and `startRetake` props for retake functionality.
**Impact**: When viewing historical reports, retake doesn't make sense.
**Solution**:
- Make these props optional in PyramidFeedback
- Pass `readOnly={true}` prop to hide retake button
- Or create a `PyramidFeedbackReadOnly` wrapper

### 7. Audio URL Expiration
**Issue**: Supabase Storage URLs may expire depending on bucket settings.
**Impact**: Old recordings may become unplayable.
**Solution**:
- Ensure `practice-recordings` bucket uses public URLs (no expiration)
- Or regenerate signed URLs when fetching practice sessions

### 8. Large Video Library Performance
**Issue**: Users with many videos may experience slow load times.
**Impact**: Poor UX for power users.
**Solution**:
- Implement pagination (load 20 at a time)
- Add "Load more" button or infinite scroll
- Index already exists: `idx_user_library_user (user_id, last_accessed_at desc)`

### 9. Modal State Management
**Issue**: Multiple nested modals (Library → Reports → Full Report) need proper state management.
**Impact**: Back button behavior, closing modals correctly.
**Solution**:
- Use a single modal with internal "view" state
- Or use a modal stack pattern
- Handle browser back button with hash routing

### 10. Anonymous Users
**Issue**: Anonymous users can analyze videos but won't have library entries.
**Impact**: They lose access to videos after refresh.
**Solution**:
- Current behavior is fine (localStorage persistence still works)
- Video Library feature is only for logged-in users
- Show "Sign in to save your videos" prompt in UserMenu

---

## Implementation Steps

### Phase 1: Database Layer
1. Add `DbUserLibrary`, `InsertUserLibrary`, and `VideoHistoryItem` types to database.ts
2. Add `addToUserLibrary()` function (upsert - don't duplicate)
3. Add `getUserVideoLibrary()` function (with Supabase nested select)
4. Add `updateLibraryAccess()` function
5. Add `updateLibraryPracticeStats()` function
6. Add `getPracticeSessionsForAnalysis()` function (join through practice_topics)
7. Add `removeFromLibrary()` function

### Phase 2: Auto-Add to Library
8. Update App.tsx to call `addToUserLibrary()` when a video is analyzed (for logged-in users)
9. Also call `addToUserLibrary()` when loading from cache (user re-visits video)
10. Pass `analysisId` to PracticeSession component for stats tracking
11. Update PracticeSession to call `updateLibraryPracticeStats()` after practice

### Phase 3: Video Library UI
12. Create `VideoLibraryModal.tsx` with responsive grid
13. Create `VideoCard.tsx` (grid card component)
14. Create `FilterBar.tsx` (filter pills)
15. Wire up UserMenu to open VideoLibraryModal

### Phase 4: AI Search
16. Create `SearchBar.tsx` component
17. Create backend endpoint `POST /api/search-videos` in new `searchRoutes.js`
18. Implement AI search logic with Gemini
19. Add fallback to simple text search
20. Register routes in `server/index.js`

### Phase 5: Practice Reports
21. Create `PracticeReportsModal.tsx`
22. Create `PracticeReportCard.tsx`
23. Reuse existing `PyramidFeedback` component for full report view

### Phase 6: Navigation
24. Update App.tsx to handle "Continue to Video" flow (load video from library)
25. Call `updateLibraryAccess()` when user opens a video from library
26. Add state for modals

### Phase 7: Polish
27. Empty states (no videos, no practice sessions, no search results)
28. Loading states and skeletons
29. Mobile/tablet responsive testing
30. Animations and transitions

---

## Responsive Design Specs

### Video Card
```tsx
// Grid container
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">

// Card
<div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer">
  {/* Thumbnail - 16:9 aspect ratio */}
  <div className="aspect-video bg-stone-100">
    <img src={thumbnailUrl} className="w-full h-full object-cover" />
  </div>

  {/* Content */}
  <div className="p-4">
    <h3 className="font-medium text-stone-800 truncate text-sm md:text-base">{title}</h3>
    <p className="text-xs md:text-sm text-stone-500 mt-1">{targetLang} • {level}</p>
    <p className="text-xs text-stone-400 mt-0.5">{formattedDate}</p>

    {/* Practice Reports Badge */}
    {practiceCount > 0 && (
      <button
        onClick={(e) => { e.stopPropagation(); onViewReports(); }}
        className="mt-3 text-xs text-stone-600 hover:text-stone-800 flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-full"
      >
        🎤 {practiceCount} Report{practiceCount > 1 ? 's' : ''}
      </button>
    )}
  </div>
</div>
```

### Modal Sizes
- **Desktop**: `max-w-5xl` (960px)
- **Tablet**: `max-w-3xl` (768px)
- **Mobile**: Full screen with padding

### Breakpoints (Tailwind)
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

---

## AI Search Implementation

### Backend Route
```javascript
// server/routes/searchRoutes.js

router.post('/search-videos', async (req, res) => {
  const { query, userId } = req.body;

  // 1. Get user's videos from DB
  const userVideos = await getUserVideoHistory(userId);

  // 2. Use Gemini to find relevant videos
  const prompt = `
    Given this search query: "${query}"
    And these video titles: ${userVideos.map(v => v.title).join(', ')}

    Return a JSON array of video titles that match the query,
    ordered by relevance. Consider semantic meaning, not just keyword matching.

    If the query mentions a language (e.g., "Chinese videos"), filter by that language.
    If the query mentions a level (e.g., "beginner"), filter by that level.
    If the query mentions a time (e.g., "last week"), consider the date.
  `;

  const result = await gemini.generateContent(prompt);
  // Parse and return matched videos
});
```

### Fallback Search
```typescript
// Simple text search fallback
function simpleSearch(videos: VideoHistoryItem[], query: string): VideoHistoryItem[] {
  const lowerQuery = query.toLowerCase();
  return videos.filter(v =>
    v.title.toLowerCase().includes(lowerQuery) ||
    v.targetLang.toLowerCase().includes(lowerQuery) ||
    v.level.toLowerCase().includes(lowerQuery)
  );
}
```

---

## Color Palette (Existing)
- Background: `#FAF9F6` (cream)
- Cards: `white`
- Borders: `stone-200`
- Text: `stone-800`, `stone-500`, `stone-400`
- Accent: `stone-800`

---

## Files to Create/Modify

### New Files (7)
- `src/features/library/components/VideoLibraryModal.tsx`
- `src/features/library/components/VideoCard.tsx`
- `src/features/library/components/PracticeReportsModal.tsx`
- `src/features/library/components/PracticeReportCard.tsx`
- `src/features/library/components/SearchBar.tsx`
- `src/features/library/components/FilterBar.tsx`
- `server/routes/searchRoutes.js` (AI search endpoint)

### Modified Files (4)
- `src/shared/services/database.ts` (add query functions)
- `src/shared/types/database.ts` (add VideoHistoryItem type)
- `src/shared/components/UserMenu.tsx` (wire up modal open)
- `src/App.tsx` (add handler to load video from library)
- `server/index.js` (register search routes)

---

## Notes for Future UI Changes

The component structure is designed to be modular:
- `VideoCard.tsx` can be easily restyled or replaced
- Grid layout can be changed by modifying container classes
- Card content order can be rearranged within the component
- Filter/search components are separate and reusable
