# Changelog

## [Unreleased] - 2026-01-21

### Added

#### Practice Session Database Integration
- **Direct Analysis Linking**: Practice sessions now directly link to their source video analysis
  - Added `analysis_id` column to `practice_sessions` table
  - Enables querying all practice sessions for a specific analyzed video
  - Prepares codebase for Video Library feature

#### Audio Recording Storage
- **Persistent Audio Playback**: User recordings are now saved to Supabase Storage
  - `uploadPracticeAudio()` function uploads recordings to `practice-recordings` bucket
  - Audio URLs saved to `practice_sessions.audio_url` field
  - Users can replay their recordings from practice history

### Changed

- **Database Types** (`src/shared/types/database.ts`):
  - Added `analysis_id: string | null` to `DbPracticeSession`
  - Added `analysis_id?: string | null` to `InsertPracticeSession`

- **PracticeSession Component** (`src/features/practice/components/PracticeSession.tsx`):
  - Added `analysisId?: string | null` prop
  - Now passes `analysis_id` when saving practice sessions

- **App.tsx**:
  - Added `currentAnalysisId` state to track active analysis
  - Sets `currentAnalysisId` when loading from cache or saving new analysis
  - Passes `analysisId` prop to `PracticeSession` component
  - Resets `currentAnalysisId` when navigating to landing page

### Database Migration Required

```sql
-- Add analysis_id column to practice_sessions
ALTER TABLE public.practice_sessions
ADD COLUMN analysis_id uuid NULL
REFERENCES cached_analyses(id) ON DELETE SET NULL;

-- Add index for efficient querying
CREATE INDEX idx_practice_sessions_analysis
ON public.practice_sessions(analysis_id);
```

### Supabase Storage Setup Required

Create a `practice-recordings` bucket with public access for audio playback.

---

## [Unreleased] - 2026-01-16

### Added

#### Database Integration (Phase 1 + 2)
- **Video Caching System**: Analyses are now cached in Supabase to save AI API costs
  - New `global_videos` table stores video metadata (youtube_id, title)
  - New `cached_analyses` table stores AI analysis results
  - Cache hits return instantly without calling the AI API
  - Cache key: video_id + level + target_lang + native_lang

- **Anonymous Usage Tracking**: Browser fingerprinting to limit free usage
  - New `browser_fingerprints` table tracks anonymous user usage
  - 3 free analyses per calendar month for anonymous users
  - Usage resets automatically on the 1st of each month
  - Cached results don't count against the usage limit

- **Practice Topics Storage**: Topics extracted and saved for future Quick Start feature
  - New `practice_topics` table stores topics from analyses
  - New `topic_questions` table stores questions per topic

#### New Components
- `UsageLimitModal` - Shows when anonymous user reaches 3/month limit
  - Displays usage progress bar
  - Shows reset date (next month)
  - "Sign in for More Access" button to open auth modal

#### New Services
- `src/shared/services/database.ts` - Supabase CRUD operations
  - `getOrCreateVideo()` - Get or create video record
  - `getCachedAnalysis()` - Check cache for existing analysis
  - `saveCachedAnalysis()` - Save new analysis to cache
  - `savePracticeTopicsFromAnalysis()` - Extract and save topics
  - `dbAnalysisToContentAnalysis()` - Convert DB format to app format

- `src/shared/services/usageTracking.ts` - Anonymous usage tracking
  - `checkAnonymousUsageLimit()` - Check if user can analyze
  - `recordAnonymousUsage()` - Record new usage
  - `getUsageDisplayInfo()` - Get formatted info for UI

- `src/shared/services/fingerprint.ts` - Browser fingerprinting
  - Uses FingerprintJS library for consistent identification
  - `getFingerprint()` - Get or generate fingerprint hash
  - `getCurrentMonth()` - Get current month string for reset tracking

#### New Types
- `src/shared/types/database.ts` - Database row types
  - `DbGlobalVideo`, `DbCachedAnalysis`, `DbPracticeTopic`, `DbTopicQuestion`
  - `AnalysisContent` - JSONB structure for cached content

### Changed

- **App.tsx**: Refactored video analysis flow
  - Usage limit check happens BEFORE loading state (user stays on landing page if blocked)
  - Integrated cache-first approach for video analysis
  - Added usage recording for anonymous users on cache miss

- **Layout.tsx**: Fixed auth modal state management
  - Changed from ternary to OR logic for combining internal/external modal state
  - Both `UserMenu` and `UsageLimitModal` can now properly open the auth modal

### Fixed

- Auth modal not opening when clicking "Sign in" from UsageLimitModal
- Usage limit modal only showing once per session

### Dependencies

- Added `@fingerprintjs/fingerprintjs` for browser fingerprinting

---

## Database Schema

### Tables Created

```sql
-- Video metadata
CREATE TABLE global_videos (
  id UUID PRIMARY KEY,
  youtube_id TEXT UNIQUE NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ
);

-- Cached AI analyses
CREATE TABLE cached_analyses (
  id UUID PRIMARY KEY,
  video_id UUID REFERENCES global_videos(id),
  level TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  native_lang TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ,
  UNIQUE(video_id, level, target_lang, native_lang)
);

-- Browser fingerprints for anonymous tracking
CREATE TABLE browser_fingerprints (
  id UUID PRIMARY KEY,
  fingerprint_hash TEXT UNIQUE NOT NULL,
  monthly_usage_count INTEGER DEFAULT 0,
  usage_reset_month TEXT,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);

-- Practice topics for Quick Start feature
CREATE TABLE practice_topics (
  id UUID PRIMARY KEY,
  analysis_id UUID REFERENCES cached_analyses(id),
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ
);

-- Questions per topic
CREATE TABLE topic_questions (
  id UUID PRIMARY KEY,
  topic_id UUID REFERENCES practice_topics(id),
  question TEXT NOT NULL,
  created_at TIMESTAMPTZ
);
```

### RLS Policies

All tables have Row Level Security policies allowing anonymous access for:
- SELECT on all tables
- INSERT on all tables (for caching and tracking)
