# Logging Strategy Analysis

## Current State

### Session Logs ✅ (Already Optimized)
All session logs now include `sessionId` for tracking:
```javascript
[Session] Registered: { sessionId: 'fbffe94a-aa6a-4127-966d-19e451a68076', ... }
[Session] Valid: { sessionId: 'fbffe94a-aa6a-4127-966d-19e451a68076' }
[Session] Heartbeat sent: { sessionId: 'fbffe94a-aa6a-4127-966d-19e451a68076' }
```

---

## Other Major Operations

### 1. Video Analysis Logs
**Current:**
```javascript
[server] Analyzing video content for: ${videoTitle} (${videoId}) using Gemini 3
[analyze-video-content] Prompt constructed, sending to Gemini...
[analyze-video-content] Analysis completed successfully for video: ${videoTitle}
```

**Analysis:**
- ✅ Already includes `videoTitle` and `videoId`
- ⚠️ Middle log missing context (which video?)
- 🤔 Could add user context for debugging

**Recommendation:**
```javascript
[analyze-video-content] Starting analysis for: ${videoTitle} (${videoId})
[analyze-video-content] Sending prompt to Gemini for: ${videoId}
[analyze-video-content] Analysis completed for: ${videoId} in ${duration}ms
```

---

### 2. Speech Analysis Logs
**Current:**
```javascript
[analyze-speech] Starting Gemini API call...
[analyze-speech] Gemini API call completed in ${duration}ms
```

**Analysis:**
- ❌ No context about which question/topic
- ❌ Can't correlate logs if multiple users submit at once
- 🤔 No user identifier

**Recommendation:**
Add topic/question context:
```javascript
[analyze-speech] Starting analysis for topic: "${topic}" | question: "${question?.substring(0, 50)}..."
[analyze-speech] Completed in ${duration}ms | topic: "${topic}"
```

---

### 3. Translation Logs
**Current:**
```javascript
[translate-ui-labels] Cache miss for ${cacheKey}, calling Gemini...
[translate-ui-labels] Gemini call completed in ${duration}ms
```

**Analysis:**
- ✅ Includes cache key
- ⚠️ Second log doesn't include cache key for correlation
- ✅ Generally fine for debugging

**Recommendation:**
```javascript
[translate-ui-labels] Cache miss: ${cacheKey}, calling Gemini...
[translate-ui-labels] Completed: ${cacheKey} in ${duration}ms
```

---

### 4. Gemini API Logs
**Current:**
```javascript
[Gemini] Starting API call to ${modelName} with params: ${params}
```

**Analysis:**
- ✅ Includes model name
- ⚠️ No retry attempt number
- ⚠️ Params might be too verbose

**Recommendation:**
```javascript
[Gemini] API call to ${modelName} (attempt ${i + 1}/${retries})
// Only log params in verbose mode or if debugging
```

---

### 5. DeepL Translation Logs
**Current:**
```javascript
[DeepL] Cache hit for: "${text.substring(0, 30)}..."
[DeepL] Cache miss, calling API for: "${text.substring(0, 30)}..." (source: ${sourceCode || 'auto-detect'})
[DeepL] Cached translation. Cache size: ${translationCache.size}
```

**Analysis:**
- ✅ Excellent! Shows cache performance
- ✅ Shows text preview for context
- ✅ Shows cache size growth

**No changes needed** - this is a good example!

---

## Should You Add Request IDs Everywhere?

### When Request IDs Are Useful:

1. **Long-running operations** (video analysis, speech analysis)
   - Can correlate start/end logs
   - Can track progress through multiple steps
   - Can debug timeouts

2. **User-specific operations** (sessions, subscriptions)
   - Can filter logs by user
   - Can track user journeys
   - Can debug user-reported issues

3. **Concurrent operations** (multiple API calls)
   - Can distinguish between parallel requests
   - Can track performance per request

### When Request IDs Are Overkill:

1. **Cache lookups** (DeepL, config)
   - Short-lived operations
   - Already have cache keys for correlation
   - Not user-specific

2. **Simple CRUD operations**
   - Self-contained operations
   - Errors are immediate and obvious

---

## Recommendations

### High Priority (Implement These)

#### 1. Video Analysis - Add videoId to all logs
```diff
- console.log(`[analyze-video-content] Prompt constructed, sending to Gemini...`);
+ console.log(`[analyze-video-content] Sending prompt to Gemini for video: ${videoId || videoTitle}`);

- console.log(`[analyze-video-content] Analysis completed successfully for video: ${videoTitle}`);
+ console.log(`[analyze-video-content] Analysis completed for: ${videoId} (${videoTitle})`);
```

#### 2. Speech Analysis - Add topic context
```diff
- console.log('[analyze-speech] Starting Gemini API call...');
+ console.log(`[analyze-speech] Starting analysis | topic: "${topic}" | level: ${level}`);

- console.log(`[analyze-speech] Gemini API call completed in ${Date.now() - startTime}ms`);
+ console.log(`[analyze-speech] Completed in ${Date.now() - startTime}ms | topic: "${topic}"`);
```

#### 3. Gemini Retry - Add attempt number
```diff
- console.log(`[Gemini] Starting API call to ${modelName} with params:`, params);
+ console.log(`[Gemini] API call to ${modelName} (attempt ${i + 1}/${retries})`);
```

---

### Medium Priority (Nice to Have)

#### 4. Translation - Add cache key to completion log
```diff
- console.log(`[translate-ui-labels] Gemini call completed in ${Date.now() - startTime}ms`);
+ console.log(`[translate-ui-labels] Completed: ${cacheKey} in ${Date.now() - startTime}ms`);
```

---

### Low Priority (Optional)

#### 5. Add User Context to Major Operations
For debugging user-specific issues, you could add user IDs to logs:

```javascript
// In routes that require authentication
const userId = req.user?.id || 'anonymous';
console.log(`[analyze-video-content] Starting analysis for user: ${userId} | video: ${videoId}`);
```

**Pros:**
- Can filter logs by user
- Can track user patterns
- Can debug user-reported issues

**Cons:**
- Privacy concerns (PII in logs)
- Log retention policies
- More verbose logs

**Recommendation:** Only add if you have:
- Proper log anonymization/hashing
- Clear data retention policies
- User consent for logging

---

## Implementation Priority

### Do Now:
1. ✅ Session logs (already done)
2. 📝 Video analysis videoId consistency
3. 📝 Speech analysis topic context

### Do Later:
4. Gemini retry attempt numbers
5. Translation cache key in completion

### Don't Do (Unless Needed):
6. Request IDs for every operation
7. User IDs in logs (privacy concerns)
8. Verbose parameter logging

---

## Summary

**Current state:**
- ✅ Session logs are perfect (include sessionId)
- ⚠️ Video/speech logs could use better context
- ✅ DeepL logs are excellent examples

**Quick wins:**
1. Add `videoId` to all video analysis logs (5 min)
2. Add `topic` to speech analysis logs (5 min)
3. Add attempt number to Gemini retry logs (2 min)

**Total effort:** ~15 minutes for significant debugging improvements

---

## Example: Before vs After

### Before
```
[analyze-video-content] Prompt constructed, sending to Gemini...
[analyze-speech] Starting Gemini API call...
[Gemini] Starting API call to gemini-3-flash-preview with params: {...}
```

❌ Can't tell which video or speech analysis this is for

### After
```
[analyze-video-content] Sending prompt to Gemini for video: dQw4w9WgXcQ (Rick Astley - Never Gonna Give You Up)
[analyze-speech] Starting analysis | topic: "Travel" | level: medium
[Gemini] API call to gemini-3-flash-preview (attempt 1/3)
```

✅ Clear context for every operation
