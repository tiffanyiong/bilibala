# Changelog

## [Unreleased] - 2026-03-09

### Added

#### Multi-Level Video Analysis with Background Processing
- **Automatic multi-level analysis**: When a video is analyzed at one difficulty level (Easy/Medium/Hard), the other 2 levels are automatically analyzed in the background
  - Primary level analysis completes first and shows dashboard immediately
  - Background analyses run for remaining levels without blocking UI
  - Transcript is fetched once and reused for all 3 levels (efficient!)
  - Each level gets separate cached analysis with level-specific content:
    - **Easy**: High-frequency keywords, simple phrases, basic questions
    - **Medium**: Collocations, functional phrases, storytelling questions
    - **Hard**: Precision vocabulary, abstract concepts, debate questions
  - Files changed:
    - `src/App.tsx` - Added `availableLevels` and `levelAnalysisIds` state, `analyzeRemainingLevels()` function
    - `src/shared/services/geminiService.ts` - Reuses transcript data for background analyses
  - Database impact: Each video can have up to 3 cached analyses (one per level)

#### Level Switching UI
- **Interactive level selector**: Users can switch between difficulty levels instantly (no re-analysis needed)
  - Dropdown appears in header (desktop) and mobile badges showing available levels
  - Only shows dropdown when 2+ levels are available
  - Shows "Loading..." for levels still being analyzed in background
  - Instant content switching when clicking different level
  - Files added:
    - `src/shared/components/LevelSelector.tsx` - New component for level dropdown
  - Files changed:
    - `src/shared/components/Layout.tsx` - Integrated level selector into header
    - `src/App.tsx` - Added `handleLevelChange()` to switch between levels

#### URL-Based Level Persistence
- **Level query parameter**: URLs now include difficulty level for shareability and navigation
  - Format: `/{analysisId}?level=Easy` or `?level=Medium` or `?level=Hard`
  - Shared links preserve the difficulty level
  - Browser back/forward navigation preserves level
  - URL updates when switching levels via dropdown
  - Deep linking works: visiting `/{analysisId}?level=Hard` loads Hard analysis if it exists
  - Files changed:
    - `src/App.tsx` - Updated `parsePathRoute()` to extract level from query params, updated all `pushState`/`replaceState` calls
    - All video loading paths (new analysis, cached, explore, library) respect URL level parameter

#### Smart Cache Detection for Multi-Level
- **Automatic level availability check**: When loading a video, system checks which difficulty levels are already cached
  - On explore page: Checks all 3 levels, triggers background analysis for missing ones
  - From library: Checks all 3 levels, triggers background analysis for missing ones
  - From cached analysis: Checks all 3 levels, shows available levels in dropdown
  - URL with specific level: Loads that level if cached, falls back to default level
  - Console logs show: `[Cache Check] Available levels: Easy, Medium, Hard`
  - Files changed: `src/App.tsx` - Updated `handleStart()`, `handleExploreVideoSelect()`, `handleLoadFromLibrary()`

### Changed

#### Rate Limiting Optimization for Multi-Level Analysis
- **Increased video analysis rate limit**: Adjusted rate limit to accommodate background multi-level analysis
  - Before: 5 requests per 5 minutes
  - After: **15 requests per 5 minutes** (allows 5 complete videos, each with 3 levels)
  - Each video triggers 3 requests (Easy + Medium + Hard), so 15 requests = 5 videos max per 5-minute window
  - Prevents rate limit conflicts during background analysis
  - Files changed:
    - `server/middleware/rateLimiters.js` - Updated `videoAnalysisLimiter` from 5 → 15 requests
    - `docs/RATE_LIMITING.md` - Updated documentation with new limits and cost calculations
  - Cost impact: Maximum abuse exposure increased from ~$2/month to ~$8/month (still acceptable)

## [Previous Release] - 2026-02-11

### Changed

#### Logging Improvements
- **Session ID Storage Optimization**: Reduced session ID storage by 97%
  - Now extracting short UUID from JWT instead of storing full token
  - Before: Storing full JWT access_token (~1,398 characters) as `session_id`
  - After: Extracting Supabase's `session_id` claim from JWT payload (36 characters)
  - Storage impact: 700 bytes → 36 bytes per session (19x smaller)
  - Log readability: Session logs now show readable UUIDs instead of multi-line JWT tokens
  - Behavior unchanged: Same session tracking logic, just more efficient storage
  - Added `extractSessionId()` helper function with fallback for JWT decoding errors
  - Files changed: `src/shared/context/AuthContext.tsx`

- **Enhanced Contextual Logging**: All major operations now include context identifiers for easy tracking
  - **Session logs** (frontend):
    - `[Session] Registered: { sessionId, deviceFingerprint, sessionLimit }`
    - `[Session] Valid: { sessionId }`
    - `[Session] Heartbeat sent: { sessionId }`
    - `[Session] Removed: { sessionId }`
  - **Video analysis logs** (backend):
    - `[analyze-video-content] Sending prompt to Gemini | video: ${videoId}`
    - `[analyze-video-content] Analysis completed | video: ${videoId} (${videoTitle})`
  - **Speech analysis logs** (backend):
    - `[analyze-speech] Starting analysis | topic: "${topic}" | level: ${level}`
    - `[analyze-speech] Analysis completed in ${duration}ms | topic: "${topic}"`
  - **Gemini retry logs** (backend):
    - `[Gemini] API call to ${model} (attempt ${n}/${total})`
    - `[Gemini] Request failed (attempt ${n}/${total}). Retrying in ${delay}ms...`
  - **Translation logs** (backend):
    - `[translate-ui-labels] Translation completed in ${duration}ms | cache key: ${key}`
  - Files changed: `server/routes/videoRoutes.js`, `server/routes/speechRoutes.js`, `server/routes/translationRoutes.js`
  - Documentation: `docs/SESSION_LOGGING.md`, `docs/LOGGING_STRATEGY.md`

### Fixed

#### Transcript Segmentation & Display Quality
- **HTML entity decoding**: Transcript text now properly displays apostrophes, quotes, and special characters
  - Added `decodeHTMLEntities()` function to convert `&amp;#39;` → `'`, `&quot;` → `"`, `&amp;` → `&`, etc.
  - Applied to all transcript segments from Supadata API before merging
  - Files changed: `server/services/videoService.js`
- **Improved sentence segmentation**: Transcript entries now break at natural linguistic boundaries (1-2 sentences per entry)
  - Before: Long multi-sentence paragraphs that were hard to follow
  - After: Shorter, digestible segments that end at complete thoughts
  - Breaking logic:
    - Breaks after sentence-ending punctuation (`.!?`)
    - Breaks at commas/semicolons/colons when buffer exceeds 100 chars
    - Safety limit reduced from 250 → 150 chars
    - Pause threshold reduced from 2000ms → 1500ms
  - Files changed: `server/services/videoService.js`
- **Note**: Changes only apply to newly processed videos (cached analyses unaffected)

#### Stripe Cleanup Resilience
- **SSL certificate error handling**: Added retry logic with exponential backoff to handle transient SSL/TLS errors
  - Fixes intermittent `CERT_HAS_EXPIRED` errors on Railway deployment when connecting to Supabase
  - 3 retries with 1s → 2s → 4s delays for network/SSL errors
  - Enhanced error logging to identify certificate issues
  - Files changed: `server/services/stripeCleanup.js`
- **Supabase client optimization**: Disabled unnecessary auth features for admin client
  - Set `autoRefreshToken: false` and `persistSession: false` for service role client
  - Files changed: `server/services/supabaseAdmin.js`

### Added

#### Database-Driven Language Configuration
- **App config system**: Language availability now controlled via database instead of hardcoded constants
  - Separate configs for "I SPEAK" (native) and "I'M LEARNING" (target) language dropdowns
  - Update language lists without code deployments - just run SQL in Supabase
  - Auto-excludes selected language from the opposite dropdown (e.g., selecting "English" in "I'M LEARNING" removes it from "I SPEAK")
  - Files added:
    - `supabase/migrations/015_app_config.sql` - App config table, functions, and initial seed
    - `server/routes/configRoutes.js` - Public API endpoints for app config
    - `src/shared/hooks/useAppConfig.ts` - React hook to fetch enabled languages from backend
    - `docs/APP_CONFIG.md` - Complete guide for managing app configuration
    - Updated `server/index.js` to mount config routes
    - Updated `src/features/explore/components/LandingFormCard.tsx` to use dynamic language lists
  - New database table: `app_config` (stores key-value config with TEXT values, comma-separated for arrays)
  - Database functions: `get_app_config()`, `update_app_config()`
  - Config keys: `enabled_target_languages`, `enabled_native_languages`
  - Format: Comma-separated language codes (e.g., `'English,Chinese,Japanese'`)

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
