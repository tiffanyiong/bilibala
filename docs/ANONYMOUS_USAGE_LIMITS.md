# Anonymous Usage Limits

How Bilibala tracks and enforces usage limits for non-logged-in users.

---

## Overview

Anonymous users are identified by a **browser fingerprint** (via FingerprintJS). Each fingerprint maps to a row in `browser_fingerprints` and has independent monthly counters for video analyses and practice sessions.

---

## Limits

| Action | Limit | Counter column |
|--------|-------|----------------|
| Video analysis | 2/month | `monthly_usage_count` |
| Practice session | 2/month | `monthly_practice_count` |

Limits are configured in `app_config` table:
- `anonymous_video_limit` = 2
- `anonymous_practice_limit` = 2

> **These are independent.** Analyzing 2 videos does NOT block practice sessions, and vice versa.

---

## Fingerprint Stability

FingerprintJS free tier (`^5.0.1`) can return slightly different `visitorId` values between page reloads on the same device, which caused the wrong DB row to get incremented.

**Fix (fingerprint.ts):** The first generated hash is persisted to `localStorage` under `bilibala_device_id`. On subsequent calls, the stored value is returned directly without re-running FingerprintJS. This keeps the fingerprint stable across page reloads and sessions.

```
First visit:   FingerprintJS.get() → save to localStorage → use hash
Later visits:  read from localStorage → use hash (skip FingerprintJS)
```

**Fallback:** If FingerprintJS throws (e.g. blocked by privacy extension), a `fallback_<uuid>` is generated and stored in `localStorage` instead. Fallback IDs are identified by the `fallback_` prefix and are never confused with real FingerprintJS hashes.

**Incognito behavior:** FingerprintJS generates the **same hash** for the same device/browser even in incognito, because it uses hardware/browser signals rather than cookies. This is intentional — it prevents users from bypassing limits by opening incognito windows. `localStorage` is cleared when incognito closes, but FingerprintJS will regenerate the same hash on the next visit.

---

## How Limits Are Enforced

Enforcement happens at **two layers**:

### 1. Client-side (pre-check before UI transition)

In `usageTracking.ts`:
- `checkAnonymousUsageLimit()` — reads `monthly_usage_count`, called before video analysis
- `checkAnonymousPracticeLimit()` — reads `monthly_practice_count`, called before starting a practice session

If limit exceeded → `UsageLimitModal` is shown with context-aware copy (video vs practice).

### 2. Server-side (enforced on API call)

In `server/middleware/subscriptionCheck.js`:
- `checkSubscriptionLimit('video_analysis')` — reads `monthly_usage_count`
- `checkSubscriptionLimit('practice_session')` — reads `monthly_practice_count`

The server uses **separate counters** per action type:
```js
currentUsage = actionType === 'practice_session'
  ? (fingerprint.monthly_practice_count || 0)
  : (fingerprint.monthly_usage_count || 0);
```

Anonymous requests must include `fingerprintHash` in the request body. Missing fingerprint → `400 FINGERPRINT_REQUIRED`.

---

## How Counters Are Incremented

| Counter | Incremented by | Where |
|---------|---------------|-------|
| `monthly_usage_count` | `recordAnonymousUsage()` | Client, after successful video analysis |
| `monthly_practice_count` | `recordAnonymousPractice()` | Client, after speech analysis result received |

Both functions in `usageTracking.ts` share `usage_reset_month` (format: `YYYY-MM`) for monthly reset tracking. When the current month doesn't match `usage_reset_month`, the counter resets to 0.

---

## UsageLimitModal

The modal (`src/shared/components/UsageLimitModal.tsx`) accepts a `type` prop:
- `type="video"` — shows "You've used all N free analyses this month"
- `type="practice"` — shows "You've used all N free practice sessions this month"

The counter shown in the modal matches the triggered limit type (not always video analysis count).

---

## Background Analysis — Anonymous Users

When an anonymous user loads a video from Explore that is missing Medium/Hard levels, background analysis is **skipped**. Only authenticated users trigger background analysis for missing levels.

This prevents `FINGERPRINT_REQUIRED` errors from `analyzeRemainingLevels` firing without a valid session.

---

## browser_fingerprints Column Reference

See [DATABASE.md](DATABASE.md#9-browser_fingerprints) for the full column breakdown, including the distinction between `monthly_practice_count` (anonymous limit checks) and `practice_session_count` (authenticated user monthly usage queries).
