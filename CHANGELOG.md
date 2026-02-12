# Changelog

## [Unreleased] - 2026-02-11

### Added

#### Session Management & Anti-Account-Sharing
- **Concurrent device limits**: Enforced device limits to prevent account sharing
  - Free tier: 1 device at a time
  - Pro tier: 3 devices at a time
  - Uses browser fingerprinting to identify devices
  - Oldest active session is automatically logged out when limit exceeded
  - User sees alert: "You have been logged out because this account is now active on another device"
  - Files added:
    - `supabase/migrations/013_active_sessions.sql` - Session tracking table and functions
    - `server/routes/sessionRoutes.js` - Session API endpoints (register, heartbeat, check, remove)
    - Updated `server/index.js` to mount session routes
    - Updated `src/shared/context/AuthContext.tsx` with session monitoring (checks validity every 30s, heartbeat every 5min)
  - New database table: `active_sessions` (tracks device fingerprint, IP, user agent, last_active_at)
  - Database functions: `get_session_limit()`, `register_session()`, `update_session_activity()`, `remove_session()`, `cleanup_expired_sessions()`

#### Automatic Stripe Subscription Cancellation
- **Stripe cleanup on user deletion**: User deletions from Supabase Dashboard now automatically cancel Stripe subscriptions
  - Queue-based system to handle async Stripe API calls
  - Cron job runs every 5 minutes to process pending cancellations
  - Prevents billing users after account deletion
  - Files added:
    - `supabase/migrations/016_cancel_stripe_on_user_delete.sql` - Cleanup queue and trigger
    - `server/services/stripeCleanup.js` - Cron job to process queue
    - Updated `server/index.js` to start cleanup cron on server boot
  - New database table: `stripe_cleanup_queue` (tracks pending Stripe cancellations)
  - Trigger: `cancel_stripe_on_user_delete()` fires before user deletion

### Fixed

#### User Deletion Constraints
- **Database foreign key fixes**: User deletion from Supabase Dashboard now works properly
  - Fixed `cached_analyses.created_by` constraint to use `ON DELETE SET NULL` (preserves expensive AI-generated analyses)
  - Migration 014 ensures all foreign keys have proper CASCADE or SET NULL behavior
  - Files added:
    - `supabase/migrations/014_fix_user_deletion_constraints.sql`
  - Previously blocked with error: "violates foreign key constraint cached_analyses_created_by_fkey"
  - Now: User deleted → analyses preserved with `created_by = NULL`

### Documentation

- Added `docs/SESSION_LIMITS.md` - Complete guide for session management feature
- Added `docs/USER_DELETION_STRATEGY.md` - Hard delete vs soft delete comparison
- Added `docs/STRIPE_SUBSCRIPTION_CLEANUP.md` - Stripe cancellation system explanation

---

## [Unreleased] - 2026-02-07

### Fixed

#### Landing Page Carousel Alignment (Desktop)
- **Card centering on swipe**: Form card and explore video cards now use consistent flex centering (`flex items-center justify-center`), fixing misalignment when swiping between cards
- **Horizontal padding**: Added `px-2 sm:px-4` to all card wrappers so content doesn't stretch edge-to-edge in the carousel slot
- Files changed: `CubeCarousel.tsx`, `LandingFormCard.tsx`

---

## [Unreleased] - 2026-02-06

### Added

#### Word Pronunciation TTS
- **Tap-to-speak word pills**: Pronunciation word pills (good/needs-work/unclear) now play audio via Google TTS when tapped
  - Reuses existing `useTTS` hook and `/api/tts` endpoint
  - Audio automatically cached to Supabase `tts-cache` storage bucket
  - Visual feedback: blue ring + animated soundbar equalizer while playing
  - Files changed: `PyramidFeedback.tsx`, `index.css`

### Changed

#### Translation Popup Improvements
- **Increased max translation characters**: 200 → 300 (both frontend and backend)
  - Files changed: `TranslationPopup.tsx`, `deeplService.js`
- **Mobile iOS positioning**: Translation popup now appears **below** the selection on touch devices to avoid overlapping with iOS native selection pills (Copy/Find). Desktop still shows above.
  - Files changed: `TranslationPopup.tsx`
- **Liquid glass design**: Translation popup and pronunciation word tooltips restyled with Apple-style glassmorphism (frosted blur, translucent gradient, soft shadows)
  - Files changed: `TranslationPopup.tsx`, `PyramidFeedback.tsx`

### Fixed

- **Translation language bug on report pages**: Navigating to practice reports from the library now correctly sets `nativeLang` and `targetLang` from the video data, so the translation popup translates to the correct language instead of always defaulting to English
  - Files changed: `App.tsx` (`handleExpandReports`)

---

## [Unreleased] - 2026-02-04

### Added

#### Level-Based UI Translations
- **Dynamic UI Language**: All UI labels on the video analysis page now translate based on difficulty level
  - Easy level: Labels display in user's native language
  - Medium/Hard level: Labels display in target language (immersive learning)

- **Translated Components**:
  - `ContentTabs.tsx`: Outline, Vocabulary, Transcript tabs; Summary heading; loading and mismatch messages
  - `TopicSelector.tsx`: Practice Topics heading and description
  - `App.tsx`: Favorite/Favorited, Save to Library, Start Conversation buttons
  - `PracticeReportDetailPage.tsx` & `PracticeReportsModal.tsx`: Feedback page headings (Topic, Question, Video, etc.)
  - `pdfExport.ts`: PDF export headings now translate based on level

- **New UI_TRANSLATIONS entries** (`src/shared/constants.ts`):
  - Added 21 new translation keys for all 16 supported languages
  - Keys: `outlineTab`, `vocabularyTab`, `transcriptTab`, `summary`, `practiceTopics`, `selectTopicDesc`, `selectTopic`, `favorite`, `favorited`, `saveToLibrary`, `startConversation`, `generatingContent`, `locateCurrent`, `topic`, `question`, `video`

- **Practice Report Detail Page Translations** (`PracticeReportDetailPage.tsx`):
  - Topic, Question, Video header labels now translate based on level
  - Easy level: displays in native language
  - Medium/Hard level: displays in target language

- **Performance Card Translations** (`PerformanceCard.tsx`):
  - Role badges (Explorer, Emerging Talent, etc.) now translate based on level
  - "Performing better than X% of learners" text now translates based on level
  - "NEXT MILESTONE" text now translates based on level
  - Added translations for all 15 supported languages

### Fixed

- **Safari Browser Compatibility for AI Tutor**:
  - Fixed hardcoded WebSocket URL (`ws://127.0.0.1:3001`) that prevented Safari from connecting
  - Now uses dynamic `getBackendWsOrigin()` which properly handles `wss://` for HTTPS pages
  - Added Safari-compatible audio MIME types (`audio/aac`, `audio/mpeg`) as fallbacks in AudioRecorder
  - Files changed: `LiveVoiceInterface.tsx`, `useLiveVoice.ts`, `AudioRecorder.tsx`

- **Easy Level Language Rules for AI-Generated Content** (`server/routes/speechRoutes.js`):
  - Graph critiques and elaborations now display in native language for Easy level
  - Word improvement explanations now display in native language for Easy level
  - Pronunciation feedback (summary, intonation, word-level) now displays in native language for Easy level
  - Clarified prompt to separate content language (target language) from feedback language (native language)

- **PDF Export Font Issues**:
  - Removed `→` arrow character that caused jsPDF to fall back to Courier font
  - Added `setFontForText()` helper for text-specific CJK font selection
  - Pronunciation analysis section now uses correct font based on content language

---

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
