# API Rate Limiting & Subscription Enforcement

This document describes the rate limiting and subscription enforcement system implemented to protect backend APIs from abuse and control costs.

## Overview

The system uses a **two-layer defense strategy**:

1. **Layer 1: Subscription Limit Enforcement** - Checks monthly usage quotas based on user tier
2. **Layer 2: Rate Limiting** - Prevents burst attacks and abuse

---

## Layer 1: Subscription Limit Enforcement

### Implementation

- **Middleware**: `server/middleware/subscriptionCheck.js`
- **Function**: `checkSubscriptionLimit(actionType)`
- **Applied to**: Expensive operations (video analysis, practice sessions)

### How It Works

#### For Authenticated Users

1. Fetches user's subscription tier from `user_subscriptions` table
2. Gets current monthly usage from `get_current_monthly_usage()` RPC
3. Compares usage against tier limits from `TIER_LIMITS` constant
4. Returns `429 SUBSCRIPTION_LIMIT_EXCEEDED` if limit reached

#### For Anonymous Users

1. Checks browser fingerprint from request body
2. Gets usage from `browser_fingerprints` table
3. Compares against hardcoded anonymous limits (2 videos/month, 2 practice sessions/month)
4. Returns `429 ANONYMOUS_LIMIT_EXCEEDED` if limit reached

### Tier Limits

| Tier | Videos/Month | Practice Sessions/Month |
|------|--------------|------------------------|
| Anonymous | 2 | 2 |
| Free | 3 | 5 |
| Pro | 100 | Unlimited |

### Error Response Format

```json
{
  "error": "SUBSCRIPTION_LIMIT_EXCEEDED",
  "message": "Monthly video_analysis limit reached (3/3).",
  "used": 3,
  "limit": 3,
  "tier": "free",
  "upgradeRequired": true
}
```

### Logging

```
[checkSubscriptionLimit] ALLOWED | user: abc123 | tier: pro | action: video_analysis | usage: 45/100
[checkSubscriptionLimit] LIMIT EXCEEDED | user: xyz789 | tier: free | action: practice_session | usage: 5/5
[checkSubscriptionLimit] ALLOWED | anonymous fingerprint: 12345678... | action: video_analysis | usage: 1/2
```

---

## Layer 2: Rate Limiting

### Implementation

- **Package**: `express-rate-limit` v8.2.1
- **Utilities**: `server/middleware/rateLimiters.js`
- **Strategy**: Per-user/fingerprint/IP key generation

### Rate Limit Configuration

#### Main APIs (User-triggered)

| Endpoint | Window | Max Requests | Purpose |
|----------|--------|--------------|---------|
| `/api/analyze-video-content` | 5 min | 15 | Expensive Gemini + Supadata API (3 requests per video for Easy/Medium/Hard levels = 5 videos max) |
| `/api/analyze-speech` | 10 min | 30 | Expensive Gemini API (called per question) |
| `/api/generate-question` | 1 min | 5 | Lightweight Gemini API |
| `/api/conversation-hints` | 1 min | 5 | AI Tutor "rescue ring" |
| `/api/search-videos` | 1 min | 10 | Lightweight Gemini API |

#### Sub-APIs (Auto-triggered)

| Endpoint | Window | Max Requests | Purpose |
|----------|--------|--------------|---------|
| `/api/fetch-transcript` | 5 min | 5 | Called before video analysis |
| `/api/match-topics` | 5 min | 10 | Called after video analysis |
| `/api/tts` | 1 min | 30 | Practice session word pronunciation |

### Key Generation Logic

Rate limits are applied per unique key:

1. **Priority 1**: User ID (for authenticated users)
2. **Priority 2**: Fingerprint hash (for anonymous users)
3. **Priority 3**: IP address (fallback)

```javascript
keyGenerator: (req) => {
  if (req.user?.id) return `user:${req.user.id}`;
  if (req.body?.fingerprintHash) return `fingerprint:${req.body.fingerprintHash}`;
  return `ip:${req.ip}`;
}
```

### Error Response Format

```json
{
  "error": "RATE_LIMIT",
  "message": "Too many video analysis requests. Please wait 5 minutes before trying again.",
  "retryAfter": 300
}
```

### Logging

```
[RateLimit] BLOCKED | key: user:abc123 | endpoint: /api/analyze-video-content | window: 300000ms | max: 3
[RateLimit] BLOCKED | key: fingerprint:12345678... | endpoint: /api/tts | window: 60000ms | max: 30
```

---

## Protected Endpoints Summary

### 🔒 Subscription Check + Rate Limit

These endpoints check both monthly usage and rate limits:

- `POST /api/analyze-video-content`
  - Subscription: Anonymous 2/month, Free 3/month, Pro 100/month
  - Rate limit: 15 requests per 5 minutes (allows 5 videos, each analyzed at 3 difficulty levels)

- `POST /api/analyze-speech`
  - Subscription: Anonymous 2/month, Free 5/month, Pro unlimited
  - Rate limit: 30 requests per 10 minutes

### ⚡ Rate Limit Only

These endpoints only have rate limits:

- `POST /api/fetch-transcript` - 5 requests per 5 minutes
- `POST /api/match-topics` - 10 requests per 5 minutes
- `POST /api/tts` - 30 requests per minute
- `POST /api/generate-question` - 5 requests per minute
- `POST /api/conversation-hints` - 5 requests per minute
- `POST /api/search-videos` - 10 requests per minute

### ✅ No Protection (Already Protected)

- WebSocket `/live` - Already has session-based time limits in `liveHandler.js`

---

## Why Sub-APIs Don't Have Subscription Checks

**Q: Why don't `/api/fetch-transcript` and `/api/match-topics` check subscription limits?**

A: These are automatically triggered by main APIs (`analyze-video-content`), so they inherit the main API's subscription limits. Adding subscription checks would:

1. **Cause double-counting**: User analyzes 1 video → counts as 2 (transcript + analysis)
2. **Break user experience**: Main API passes, but sub-API fails due to separate limit
3. **Unnecessary complexity**: Rate limits already prevent abuse

Rate limits on sub-APIs are intentionally **more lenient** than main APIs to allow for:
- Retries after failures
- Progressive loading (fetch transcript first, then analyze)
- Multiple calls per main operation (match-topics may be called 2-3 times)

---

## Testing

### Manual Testing

Use the provided test script:

```bash
node test-rate-limit.js
```

This will:
1. Test TTS endpoint (30 requests per minute limit)
2. Test Generate Question endpoint (5 requests per minute limit)
3. Report success/failure rates

### Expected Behavior

**For authenticated users:**
```bash
# First 15 requests within 5 minutes - ALLOWED (5 videos × 3 levels each)
curl -X POST http://localhost:3000/api/analyze-video-content -H "Authorization: Bearer TOKEN" -d '...'
# ✅ 200 OK

# 16th request within 5 minutes - RATE LIMITED
curl -X POST http://localhost:3000/api/analyze-video-content -H "Authorization: Bearer TOKEN" -d '...'
# ❌ 429 Rate Limit
```

**For anonymous users:**
```bash
# First 2 requests this month - ALLOWED
curl -X POST http://localhost:3000/api/analyze-video-content -d '{"fingerprintHash": "abc123", ...}'
# ✅ 200 OK

# 3rd request this month - SUBSCRIPTION LIMIT EXCEEDED
curl -X POST http://localhost:3000/api/analyze-video-content -d '{"fingerprintHash": "abc123", ...}'
# ❌ 429 Subscription Limit Exceeded
```

---

## Monitoring

### Key Logs to Monitor

1. **Subscription limits hit**:
   ```
   [checkSubscriptionLimit] LIMIT EXCEEDED | user: ... | tier: free | action: video_analysis | usage: 3/3
   ```

2. **Rate limits hit**:
   ```
   [RateLimit] BLOCKED | key: user:... | endpoint: /api/analyze-video-content | window: 300000ms | max: 3
   ```

3. **Anonymous abuse patterns**:
   ```
   [checkSubscriptionLimit] ANONYMOUS LIMIT EXCEEDED | fingerprint: 12345678... | action: video_analysis | usage: 2/2
   ```

### Recommended Alerts

- Alert if same fingerprint hits anonymous limit 10+ times/day (possible fingerprint spoofing)
- Alert if rate limit is hit 100+ times/hour on expensive endpoints (possible DDoS)
- Alert if subscription limit errors spike 5x above baseline (possible legitimate user frustration)

---

## Cost Protection Analysis

### Before Protection

- ❌ Anonymous user could analyze unlimited videos (cost: unbounded)
- ❌ Attacker could spam 1000 requests/second (cost: $100+/hour)
- ❌ No defense against direct API calls bypassing frontend

### After Protection

- ✅ Anonymous user limited to 2 videos/month (cost: ~$0.006/user with 3 levels)
- ✅ Attacker limited to 15 requests per 5 minutes (cost: max $0.18/hour)
- ✅ All endpoints protected, even if called directly

**Maximum monthly cost from abuse:**
- Anonymous: 200 unique devices × 2 videos × 3 levels × $0.001 = $1.20
- Rate limit bypass: 15 req/5min × 60min/hr × 24hr × 30 days × $0.001 = $6.48
- **Total exposure: ~$8/month** (vs unlimited before)

---

## Future Improvements

1. **Dynamic rate limits**: Store limits in `app_config` table for runtime adjustment
2. **Redis backend**: For multi-server deployments, use Redis instead of in-memory
3. **IP reputation**: Block known bad IPs automatically
4. **Graduated rate limits**: Pro users get higher rate limits than Free users
5. **Burst allowance**: Allow short bursts (e.g., 5 requests instant, then 1/min)

---

## Files Modified

- `server/middleware/rateLimiters.js` (new)
- `server/middleware/subscriptionCheck.js` (new)
- `server/routes/videoRoutes.js` (modified)
- `server/routes/speechRoutes.js` (modified)
- `server/routes/conversationRoutes.js` (modified)
- `package.json` (added express-rate-limit dependency)

---

## References

- [express-rate-limit Documentation](https://github.com/express-rate-limit/express-rate-limit)
- [Subscription Plan Documentation](./SUBSCRIPTION_PLAN.md)
- [Usage Tracking Documentation](../memory/subscription-and-usage.md)
