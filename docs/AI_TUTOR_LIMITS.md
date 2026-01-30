# AI Tutor — Server-Side Time Limit Enforcement

## Overview

AI Tutor sessions are time-limited for Pro users. Limits are enforced **server-side** in the WebSocket handler so they cannot be bypassed by modifying frontend code.

## Configuration

Limits are stored in the `app_config` table in Supabase. To change them:

1. Open Supabase Dashboard > Table Editor > `app_config`
2. Edit the `value` column for the relevant key
3. Changes take effect within 5 minutes (server cache refresh interval)

| Key | Default | Description |
|-----|---------|-------------|
| `ai_tutor_session_max_minutes` | `40` | Max minutes per single session |
| `ai_tutor_monthly_max_minutes` | `60` | Max minutes per month (Pro tier) |
| `ai_tutor_warning_before_end_seconds` | `60` | Seconds before limit to show warning |
| `free_videos_per_month` | `3` | Videos per month for free tier |
| `free_practice_sessions_per_month` | `5` | Practice sessions per month for free tier |
| `free_video_library_max` | `10` | Max video library size for free tier |
| `anonymous_video_limit` | `2` | Monthly video limit for anonymous users |
| `anonymous_practice_limit` | `2` | Monthly practice limit for anonymous users |

## How It Works

### Session Start
1. Frontend sends `userId` in the WebSocket `start` payload
2. Server queries Supabase for the user's monthly `ai_tutor_minutes_used`
3. If remaining minutes <= 0, server rejects with error and closes (never connects to Gemini)
4. Server calculates effective cap: `min(sessionMaxSeconds, remainingMonthlySeconds)`
5. Server starts warning and limit timers

### During Session
- Server sends `{type: 'time_warning', secondsLeft: N}` when approaching the limit
- Frontend displays countdown (e.g., "0:45 remaining")

### Session End (Limit Reached)
1. Server sends `{type: 'session_limit', reason, durationSeconds}`
2. Server disconnects Gemini and closes WebSocket
3. Server records usage in `usage_history` table
4. Frontend shows end note: "Session limit reached" or "Monthly limit reached"

### Session End (User Stops)
1. Frontend sends `{type: 'stop'}`
2. Server records actual duration in `usage_history`
3. Server disconnects Gemini and closes WebSocket

## Security Model

| Concern | Mitigation |
|---------|-----------|
| User modifies frontend JS to skip timer | Server disconnects regardless |
| User never calls `recordAction` | Server records usage directly in DB |
| User keeps WebSocket open past limit | Server closes the connection |
| User starts session with 0 remaining | Server rejects before connecting to Gemini |

## Architecture

```
Frontend (display only)           Server (enforcement)
========================         ========================
Timer counts up (MM:SS)           Timer counts down to limit
Shows warning text                Sends time_warning message
Shows end note                    Sends session_limit message
handleStartSession guard          Rejects if remaining <= 0
recordAction (optimistic UI)      Records usage in Supabase
```

## Setup

1. Run `docs/migrations/003_app_config.sql` in Supabase SQL Editor
2. Restart the server
3. Verify: `curl http://localhost:3001/api/config/app`

## Files

### Server
- `server/services/supabaseAdmin.js` — shared Supabase admin client
- `server/services/configService.js` — cached config reader (refreshes every 5 min)
- `server/websocket/liveHandler.js` — enforcement logic, timers, usage recording
- `server/routes/subscriptionRoutes.js` — `GET /api/config/app` endpoint

### Frontend
- `src/shared/config/aiTutorConfig.ts` — fetches config from server, fallback defaults
- `src/features/live-voice/hooks/useLiveVoice.ts` — handles server messages
- `src/features/live-voice/components/FloatingTutorWindow.tsx` — sends userId

### Database
- `app_config` table — key/value config store
- `usage_history` table — usage records (written by server)
