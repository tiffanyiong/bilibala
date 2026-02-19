# API Authentication Test Guide

## ✅ Protected Endpoints (All require authentication)

### Test 1: Video Analysis APIs (videoRoutes.js)

#### Test without authentication (should fail with 401):
```bash
# Test 1.1: Fetch Transcript
curl -X POST http://localhost:3000/api/fetch-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "https://youtube.com/watch?v=test",
    "targetLang": "English"
  }'
# Expected: {"error":"Unauthorized"}

# Test 1.2: Analyze Video Content
curl -X POST http://localhost:3000/api/analyze-video-content \
  -H "Content-Type: application/json" \
  -d '{
    "videoTitle": "Test",
    "videoUrl": "https://youtube.com/watch?v=test",
    "nativeLang": "English",
    "targetLang": "Chinese",
    "level": "easy"
  }'
# Expected: {"error":"Unauthorized"}

# Test 1.3: Search Videos
curl -X POST http://localhost:3000/api/search-videos \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test",
    "videos": []
  }'
# Expected: {"error":"Unauthorized"}

# Test 1.4: Match Topics
curl -X POST http://localhost:3000/api/match-topics \
  -H "Content-Type: application/json" \
  -d '{
    "newTopics": ["test"],
    "existingTopics": [],
    "targetLang": "English"
  }'
# Expected: {"error":"Unauthorized"}

# Test 1.5: Generate Question
curl -X POST http://localhost:3000/api/generate-question \
  -H "Content-Type: application/json" \
  -d '{
    "topicName": "test",
    "targetLang": "English",
    "level": "easy"
  }'
# Expected: {"error":"Unauthorized"}
```

### Test 2: Speech APIs (speechRoutes.js)

```bash
# Test 2.1: Analyze Speech
curl -X POST http://localhost:3000/api/analyze-speech \
  -H "Content-Type: application/json" \
  -d '{
    "audioData": "base64encodedaudio",
    "topic": "test",
    "question": "test",
    "level": "easy",
    "targetLang": "English"
  }'
# Expected: {"error":"Unauthorized"}

# Test 2.2: TTS (Text-to-Speech)
curl -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello World",
    "language": "English"
  }'
# Expected: {"error":"Unauthorized"}
```

### Test 3: Conversation APIs (conversationRoutes.js)

```bash
# Test 3.1: Conversation Hints
curl -X POST http://localhost:3000/api/conversation-hints \
  -H "Content-Type: application/json" \
  -d '{
    "lastAiQuestion": "What is your name?",
    "targetLang": "English",
    "level": "easy"
  }'
# Expected: {"error":"Unauthorized"}
```

---

## ✅ Test with Valid Authentication

To test with a valid JWT token, you need to:

1. Login to your app and get the access token from browser DevTools:
   - Open DevTools → Application → Local Storage
   - Find `sb-<project-id>-auth-token`
   - Copy the `access_token` value

2. Use the token in API calls:

```bash
# Replace YOUR_JWT_TOKEN with actual token
curl -X POST http://localhost:3000/api/analyze-video-content \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "videoTitle": "Test",
    "videoUrl": "https://youtube.com/watch?v=test",
    "nativeLang": "English",
    "targetLang": "Chinese",
    "level": "easy"
  }'
# Expected: Should process normally (may fail due to invalid video, but won't return 401)
```

---

## 📊 Summary of Protected Endpoints

| Endpoint | Method | File | Status |
|----------|--------|------|--------|
| `/api/fetch-transcript` | POST | videoRoutes.js | 🔒 Protected |
| `/api/analyze-video-content` | POST | videoRoutes.js | 🔒 Protected |
| `/api/search-videos` | POST | videoRoutes.js | 🔒 Protected |
| `/api/match-topics` | POST | videoRoutes.js | 🔒 Protected |
| `/api/generate-question` | POST | videoRoutes.js | 🔒 Protected |
| `/api/analyze-speech` | POST | speechRoutes.js | 🔒 Protected |
| `/api/tts` | POST | speechRoutes.js | 🔒 Protected |
| `/api/conversation-hints` | POST | conversationRoutes.js | 🔒 Protected |

**Total: 8 high-cost AI endpoints now protected** ✅

---

## 🔍 How to Verify in Production

After deploying to Railway:

```bash
# Test production endpoint (should return 401)
curl -X POST https://mybilibala.com/api/analyze-video-content \
  -H "Content-Type: application/json" \
  -d '{
    "videoTitle": "Test",
    "videoUrl": "https://youtube.com/watch?v=test",
    "nativeLang": "English",
    "targetLang": "Chinese",
    "level": "easy"
  }'
```

Expected response:
```json
{"error":"Unauthorized"}
```

---

## 🎯 Next Steps (Optional Improvements)

1. **Add Rate Limiting** - Install `express-rate-limit`
2. **Add Usage Tracking** - Log AI API calls in `usage_history` table
3. **Add WebSocket Authentication** - Secure `/live` endpoint
4. **Add Cost Monitoring** - Track estimated API costs per user

---

## ✅ Security Checklist

- [x] videoRoutes.js - All 5 endpoints protected
- [x] speechRoutes.js - All 2 endpoints protected
- [x] conversationRoutes.js - All 1 endpoint protected
- [ ] Add rate limiting (recommended)
- [ ] Add usage tracking (recommended)
- [ ] WebSocket authentication (high priority)
- [ ] Cost monitoring alerts (recommended)
