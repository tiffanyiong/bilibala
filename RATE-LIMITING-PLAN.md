# 🚦 Rate Limiting Strategy for Bilibala

**Date**: 2026-02-18
**Status**: Planning Document

---

## 🎯 Goals

1. **Protect API costs**: Prevent abuse of expensive AI endpoints (Gemini, Google TTS)
2. **Ensure fair usage**: Stop individual users from monopolizing resources
3. **Maintain UX**: Don't block legitimate users with aggressive limits
4. **Prevent spam/bots**: Block malicious actors attempting to abuse free tier

---

## 📊 Current State

### Frontend-Only Limits (Not Enforced on Backend!)

Currently, usage limits are **only enforced in the frontend**:

| User Type | Video Analysis | Practice Sessions | AI Tutor |
|-----------|---------------|------------------|----------|
| Anonymous | 2/month (frontend) | 2/month (frontend) | Not allowed |
| Free | 5/month (Supabase) | Unlimited | Credits only |
| Pro | Unlimited | Unlimited | 60 min/month + credits |

**Problem**: Anyone can bypass frontend limits by calling APIs directly via Postman/curl!

### Current Protection Mechanisms

1. ✅ **Anonymous tracking**: `browser_fingerprints` table (bypassable)
2. ✅ **Authenticated limits**: `user_subscriptions` + `get_all_monthly_usage()` (enforced server-side for AI tutor only)
3. ❌ **No rate limiting**: APIs can be called unlimited times per second/minute

---

## 🔴 Critical Vulnerabilities

### 1. No Backend Enforcement for Anonymous Users

```javascript
// Current code (App.tsx line ~1100)
const usageStatus = await checkAnonymousUsageLimit();
if (!usageStatus.allowed) {
  alert('You've reached your free limit!');
  return; // ❌ This only runs in the browser!
}

// API call still goes through if user bypasses frontend
await analyzeVideoContent(...);
```

**Attack**: User opens browser console, calls `fetch('/api/analyze-video-content', {...})` in a loop

### 2. No Rate Limiting on Expensive Endpoints

**Most expensive APIs** (cost per call):
1. `/api/analyze-video-content` - ~$0.05-0.15 (large video transcript analysis)
2. `/api/analyze-speech` - ~$0.02-0.05 (audio transcription + analysis)
3. `/api/conversation-hints` - ~$0.01-0.03 (AI tutor hints)
4. `/api/tts` - ~$0.001-0.01 (Google TTS, cached after first call)
5. `/api/fetch-transcript` - ~$0 (YouTube API, free)
6. `/api/generate-question` - ~$0.01-0.02 (AI generation)

**Attack**: Spam these endpoints 1000x/minute → $50-150 in API costs

### 3. No Protection Against Distributed Attacks

- Single IP can create unlimited fingerprints using incognito/VPN
- No CAPTCHA or human verification
- No IP-based tracking or blocking

---

## ✅ Proposed Solution: Multi-Layer Rate Limiting

### Layer 1: IP-Based Rate Limiting (DDoS Protection)

**Library**: `express-rate-limit`

```javascript
// Apply to ALL API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 min per IP
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);
```

**Purpose**: Block spam bots, prevent single IP from overwhelming server

### Layer 2: Endpoint-Specific Rate Limiting (Cost Protection)

**Apply stricter limits to expensive AI endpoints**:

```javascript
// High-cost endpoints
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // Max 3 requests per minute per IP
  message: 'AI endpoint rate limit exceeded. Please wait before trying again.',
  skipSuccessfulRequests: false,
});

// Apply to expensive endpoints
router.post('/analyze-video-content', aiLimiter, async (req, res) => {...});
router.post('/analyze-speech', aiLimiter, async (req, res) => {...});
router.post('/conversation-hints', aiLimiter, async (req, res) => {...});
```

**Purpose**: Prevent rapid-fire abuse of expensive AI calls

### Layer 3: Backend Enforcement of Monthly Limits

**Enforce frontend limits on the backend** using middleware:

```javascript
// Middleware: Check anonymous monthly limit
async function enforceAnonymousLimit(req, res, next) {
  // Only check for anonymous users (no auth header)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next(); // Authenticated users bypass this check
  }

  // Get fingerprint from request (from client header or IP)
  const fingerprint = req.headers['x-fingerprint'] || req.ip;
  const currentMonth = new Date().toISOString().slice(0, 7); // "2026-02"

  const { data } = await supabase
    .from('browser_fingerprints')
    .select('monthly_usage_count, usage_reset_month')
    .eq('fingerprint_hash', fingerprint)
    .single();

  const used = (data?.usage_reset_month === currentMonth) ? data.monthly_usage_count : 0;
  const FREE_LIMIT = 2;

  if (used >= FREE_LIMIT) {
    return res.status(429).json({
      error: 'Monthly limit exceeded',
      message: 'You have reached your free monthly limit. Sign up to continue!',
      limit: FREE_LIMIT,
      used,
    });
  }

  next();
}

// Apply to anonymous-allowed endpoints
router.post('/analyze-video-content', enforceAnonymousLimit, async (req, res) => {...});
```

**Purpose**: Enforce monthly limits server-side (can't be bypassed by client)

### Layer 4: User-Based Rate Limiting (Authenticated)

**Track per-user limits in database** (already implemented for AI tutor):

```javascript
// Middleware: Check authenticated user's monthly limit
async function enforceUserLimit(req, res, next) {
  const user = await getUserFromToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('tier')
    .eq('user_id', user.id)
    .single();

  if (subscription?.tier === 'pro') {
    return next(); // Pro users have no limits
  }

  // Check free user's monthly usage
  const usage = await getMonthlyUsage(user.id);
  const FREE_USER_LIMIT = 5;

  if (usage.videoAnalysisCount >= FREE_USER_LIMIT) {
    return res.status(429).json({
      error: 'Monthly limit exceeded',
      message: 'You have reached your free monthly limit. Upgrade to Pro for unlimited access!',
      limit: FREE_USER_LIMIT,
      used: usage.videoAnalysisCount,
    });
  }

  next();
}
```

**Purpose**: Enforce tier-based limits (free vs pro)

---

## 📦 Implementation Plan

### Phase 1: Basic IP Rate Limiting (High Priority)

**Goal**: Stop spam bots and DDoS attacks

**Tasks**:
1. Install `express-rate-limit`: `npm install express-rate-limit`
2. Add global API limiter (100 req / 15 min per IP)
3. Add AI endpoint limiter (3 req / 1 min per IP)
4. Test with Postman (should get 429 after limit)

**Files to modify**:
- `server/index.js` - Add global limiter
- `server/routes/videoRoutes.js` - Add to analyze endpoints
- `server/routes/speechRoutes.js` - Add to analyze/tts endpoints
- `server/routes/conversationRoutes.js` - Add to hints endpoint

**Deployment**: Can deploy immediately, no breaking changes

---

### Phase 2: Backend Monthly Limit Enforcement (Medium Priority)

**Goal**: Prevent frontend bypass for anonymous users

**Tasks**:
1. Create middleware: `enforceAnonymousLimit(req, res, next)`
2. Pass fingerprint from frontend via header: `x-fingerprint`
3. Query `browser_fingerprints` table server-side
4. Return 429 if limit exceeded
5. Record usage server-side (currently only frontend records it)

**Files to modify**:
- `server/middleware/usageLimits.js` (new file)
- `server/routes/videoRoutes.js` - Add middleware to analyze endpoints
- `server/routes/speechRoutes.js` - Add middleware to analyze endpoint
- `src/shared/services/geminiService.ts` - Send fingerprint in headers

**Database changes**: None (already tracked in `browser_fingerprints`)

**Migration needed**: No

---

### Phase 3: Authenticated User Limits (Low Priority)

**Goal**: Enforce free tier limits server-side

**Tasks**:
1. Create middleware: `enforceUserLimit(req, res, next)`
2. Query `user_subscriptions` + usage tables
3. Return 429 if free user exceeded 5/month
4. Allow pro users unlimited

**Files to modify**:
- `server/middleware/usageLimits.js` - Add user limit function
- `server/routes/videoRoutes.js` - Add middleware to analyze endpoints

**Database changes**: None (already tracked in `usage_history`)

**Migration needed**: No

---

### Phase 4: Advanced Protection (Future)

**Optional enhancements**:

1. **Redis-based rate limiting** (for distributed systems)
   - Current: In-memory limits reset when server restarts
   - Redis: Persistent limits across multiple server instances

2. **CAPTCHA for high-risk actions**
   - Add reCAPTCHA before video analysis for new users
   - Bypass if user has verified account

3. **IP reputation scoring**
   - Block known VPN/proxy IPs
   - Flag suspicious patterns (same IP, many fingerprints)

4. **Adaptive rate limiting**
   - Increase limits for trusted users (pro members, long-time users)
   - Decrease limits for flagged IPs

---

## 🎯 Recommended Rate Limits

### Global API Limit (All Endpoints)

| Window | Max Requests | Applies To |
|--------|--------------|------------|
| 15 min | 100 | Per IP |

### AI Endpoint Limits (High Cost)

| Endpoint | Window | Max Requests | Cost/Call |
|----------|--------|--------------|-----------|
| `/api/analyze-video-content` | 1 min | 2 | ~$0.10 |
| `/api/analyze-speech` | 1 min | 3 | ~$0.03 |
| `/api/conversation-hints` | 1 min | 10 | ~$0.02 |
| `/api/generate-question` | 1 min | 5 | ~$0.01 |
| `/api/tts` | 1 min | 20 | ~$0.001 (cached) |

### Monthly Limits (Backend-Enforced)

| User Type | Video Analysis | Practice Sessions | AI Tutor |
|-----------|---------------|------------------|----------|
| Anonymous | 2/month | 2/month | Not allowed |
| Free | 5/month | Unlimited | Credits only |
| Pro | Unlimited | Unlimited | 60 min/month + credits |

---

## 🧪 Testing Plan

### Test Cases

1. **IP rate limiting**:
   - Send 101 requests in 15 min → Should get 429 on request #101
   - Wait 15 min → Should allow requests again

2. **AI endpoint limiting**:
   - Send 3 analyze-video requests in 1 min → Should get 429 on request #4
   - Wait 1 min → Should allow requests again

3. **Anonymous monthly limit**:
   - Analyze 2 videos as anonymous → Should succeed
   - Try 3rd video → Should get 429 with upgrade prompt
   - Sign up → Should reset limit to 5/month

4. **Bypass attempt**:
   - Call API directly via Postman (no frontend) → Should still enforce limits
   - Change fingerprint in header → Should still count toward IP limit

5. **Authenticated users**:
   - Free user: Analyze 5 videos → 6th should fail
   - Pro user: Analyze 100 videos → All should succeed

---

## 📝 Error Response Format

### Rate Limit Exceeded (429)

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please wait before trying again.",
  "retryAfter": 60,
  "limit": {
    "window": "1 minute",
    "max": 3,
    "current": 3
  }
}
```

### Monthly Limit Exceeded (429)

```json
{
  "error": "Monthly limit exceeded",
  "message": "You have reached your free monthly limit (2/2). Sign up to get 5 videos per month!",
  "limit": 2,
  "used": 2,
  "resetDate": "2026-03-01",
  "upgradeUrl": "/pricing"
}
```

---

## 🔐 Security Considerations

### Fingerprint Spoofing

**Risk**: User can change `x-fingerprint` header to bypass limits

**Mitigation**:
- Also track by IP address (can't easily change)
- Use server-side fingerprinting (user-agent + IP + headers)
- Require CAPTCHA if suspicious pattern detected

### VPN/Proxy Abuse

**Risk**: User rotates VPN IPs to get unlimited free tier

**Mitigation**:
- Detect and block known VPN/datacenter IPs
- Require email verification for free tier
- Add CAPTCHA for new fingerprints

### Distributed Attacks

**Risk**: Botnet with 1000+ IPs attacks simultaneously

**Mitigation**:
- Use Cloudflare or similar CDN with DDoS protection
- Add WAF rules to block suspicious patterns
- Monitor and alert on unusual traffic spikes

---

## 💰 Cost Analysis

### Current Risk (No Limits)

**Worst case scenario**: Malicious user spams APIs

- 1000 video analyses x $0.10 = $100
- 1000 speech analyses x $0.03 = $30
- Total damage: **$130 per hour** if completely unprotected

### After Rate Limiting

**With IP limits (3 req/min for AI endpoints)**:

- Max damage per IP: 3 req/min x 60 min x $0.10 = $18/hour
- Even with 10 IPs: $180/hour (but easily detectable and blockable)

**With backend monthly limits**:

- Anonymous: 2 videos x $0.10 = $0.20 per user per month
- Free: 5 videos x $0.10 = $0.50 per user per month
- Even 1000 abusers: $500/month (manageable)

---

## ✅ Success Metrics

1. **Cost reduction**: Monthly AI costs stay within budget
2. **Legitimate usage**: Real users not blocked (< 1% false positives)
3. **Attack prevention**: Spam attempts blocked within 1 minute
4. **Conversion**: Anonymous → Free → Pro funnel remains healthy

---

## 📚 Resources

- **express-rate-limit docs**: https://github.com/express-rate-limit/express-rate-limit
- **Cloudflare rate limiting**: https://developers.cloudflare.com/waf/rate-limiting-rules/
- **Redis rate limiting**: https://github.com/wyattjoh/rate-limit-redis

---

**Next Steps**: Which phase should we implement first?

1. ⚡ **Phase 1** (IP rate limiting) - Quick win, immediate protection
2. 🛡️ **Phase 2** (Backend monthly limits) - Closes frontend bypass vulnerability
3. 📊 **Phase 3** (User limits) - Enforces tier-based restrictions
