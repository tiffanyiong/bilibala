# Changelog

## Subscription & Usage Limits (January 2026)

### Stripe Subscription Integration
- Added `/api/subscriptions/sync` endpoint to sync subscription status directly from Stripe (fallback for missed webhooks)
- Smart conditional sync on app load: only calls Stripe API when user has `stripe_customer_id` but is on `free` tier (indicates a potential missed webhook)
- Auto-sync on `?success=true` checkout redirect
- Null-safe timestamp handling to prevent `RangeError: Invalid time value`

### Usage Limits for Anonymous Users
- **AI Tutor**: Blocked entirely for non-logged-in users — shows login modal immediately
- **Practice Sessions**: 2 free sessions per month for anonymous users, tracked via browser fingerprint (`practice_session_count` in `browser_fingerprints` table)
- **Video Analysis**: 2 free analyses per month for anonymous users (reduced from 3)
- Retake/re-record button in practice sessions enforces the anonymous limit — shows login modal when limit is reached
- No usage carry-over when an anonymous user signs up (fresh free tier limits)

### Database Changes
- Added `practice_session_count` and `practice_reset_month` columns to `browser_fingerprints` table

### Subscription Page & Profile Page
- Consistent "Pro only" pill/badge styling across UsageMeter in both SubscriptionPage and ProfilePage
- Added Stripe sync on subscription page checkout return

### Auth Modal
- Removed "Sign in with magic link" option

### Usage Limit Modal
- Reset date now shows one month from today (e.g., "February 28") instead of the first of next month

### Admin Dashboard (Planned)
- Feature spec documented in `docs/admin-dashboard.md`
- Includes: admin role, requireAdmin middleware, user list API, per-user Stripe sync, dashboard UI

### Files Changed
- `server/routes/subscriptionRoutes.js` — sync endpoint
- `src/shared/context/SubscriptionContext.tsx` — smart sync, refreshSubscription, syncWithStripe
- `src/shared/services/usageTracking.ts` — anonymous practice limit tracking, reset date fix
- `src/App.tsx` — AI Tutor and practice session gate for anonymous users
- `src/features/practice/components/PracticeSession.tsx` — anonymous practice recording, onRequireAuth prop
- `src/features/practice/components/PyramidFeedback.tsx` — retake button anonymous limit check
- `src/shared/components/AuthModal.tsx` — removed magic link
- `src/shared/components/UsageLimitModal.tsx` — usage limit modal for anonymous users
- `src/features/subscription/components/SubscriptionPage.tsx` — Pro only pill, Stripe sync
- `src/features/profile/components/ProfilePage.tsx` — Pro only pill
- `docs/admin-dashboard.md` — admin dashboard spec

---

## Video Library Feature (January 2026)

### Overview
Implemented a comprehensive video library system allowing users to manage, search, filter, and review their practice videos and reports.

### Components Added

#### VideoLibraryPage (`src/features/library/components/VideoLibraryPage.tsx`)
- Main page for browsing user's video history
- Full library management interface
- Fetches user videos from database on mount
- Responsive grid layout (1/2/3/4 columns based on screen size)
- Skeleton loading states during data fetch
- Empty states with contextual messages
- Error handling with retry capability

#### VideoCard (`src/features/library/components/VideoCard.tsx`)
- Individual video display with YouTube thumbnail (16:9 aspect ratio)
- Shows: Title, language badge, level badge, last accessed date
- Practice report count badge
- Actions: View reports button, favorite toggle (heart icon), delete option
- Delete confirmation modal with warning
- Responsive sizing for mobile/tablet/desktop
- Smooth hover effects and transitions

#### FilterBar (`src/features/library/components/FilterBar.tsx`)
- Dynamic language filtering (populated from user's videos)
- Difficulty level filtering (Easy, Medium, Hard)
- Favorites-only toggle with heart icon
- Sort options (Newest first / Oldest first)
- "All" reset button with visual active states
- Filters can be combined independently

#### PracticeReportsModal (`src/features/library/components/PracticeReportsModal.tsx`)
- Modal to view practice reports for each video
- List of practice sessions with dates
- Click to expand to full report detail
- PDF export functionality

#### PracticeReportDetailPage (`src/features/library/components/PracticeReportDetailPage.tsx`)
- Full-page report detail view
- Complete practice analysis display
- PDF export with "Export PDF" button
- Back navigation to reports list

### Features Implemented

#### AI-Powered Search
- Debounced search (500ms delay) for video titles and metadata
- Uses Gemini API via `searchVideos()` function
- Maintains search result relevance ordering
- Clear search button with loading spinner
- Real-time search feedback

#### Video Filtering & Sorting
- Filter by language (dynamically populated)
- Filter by difficulty level (Easy/Medium/Hard)
- Filter by favorites only
- Sort by date (newest/oldest first)
- All filters work independently and can be combined

#### Favorite Management
- Toggle favorite status with heart icon on cards
- Visual feedback (red filled heart when favorited)
- Filter view to show favorites only
- Optimistic UI updates (immediate visual feedback)
- Persisted to database

#### Library Management
- Remove videos from library with confirmation dialog
- Track and display practice report count per video
- Display last accessed date
- Automatic thumbnail loading from YouTube

#### PDF Export (Enhanced)
- Notion-style clean design
- Chinese font support (Noto Sans SC, LXGW WenKai)
- Duck logo + "Bilibala" branding on each page
- Page numbers at bottom right
- Responsive graph node text sizing
- Elaboration text in improved structure nodes
- Topic-based filename: `{topic}-report-{date}.pdf`
- Sections: Your Response, Language Polish, Strengths, Areas for Improvement, Actionable Tips, Logic Structure graphs

### Database Schema Updates
- Added `is_favorite` field to user_videos table
- Added video use count tracking
- Practice session linking to videos

### Navigation
- Video Library accessible from UserMenu dropdown
- URL routing: `/library` for main library page
- URL routing: `/[analysisId]/reports` for practice reports
- URL routing: `/[analysisId]/reports/[sessionId]` for report detail

### Assets Added
- `public/fonts/NotoSansSC-Regular.ttf` (10.5 MB) - Chinese font for PDF
- `public/fonts/LXGWWenKai-Regular.ttf` (19 MB) - Fallback Chinese font

---

## Vocabulary Feature (Deferred)
- Menu item hidden in UserMenu
- Will be implemented in future release
- Note: Need to remove star icon from analyzed video page when implementing
