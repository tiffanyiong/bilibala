# Frontend Authentication Fix

**Date**: 2026-02-18
**Issue**: API endpoints were protected on the backend, but frontend was not sending JWT tokens

---

## ✅ What Was Fixed

After adding authentication checks to the backend API endpoints, the frontend was still calling these APIs **without sending the Authorization header**, causing all requests to fail with `401 Unauthorized`.

This has now been fixed by updating all frontend code to include the JWT token in API calls.

---

## 📝 Changed Files

### Backend (API Protection)
1. ✅ [server/routes/videoRoutes.js](server/routes/videoRoutes.js) - 5 endpoints protected
2. ✅ [server/routes/speechRoutes.js](server/routes/speechRoutes.js) - 2 endpoints protected
3. ✅ [server/routes/conversationRoutes.js](server/routes/conversationRoutes.js) - 1 endpoint protected

### Frontend (Authentication Headers Added)

#### 1. [src/shared/services/geminiService.ts](src/shared/services/geminiService.ts)
**4 functions updated to accept `accessToken` parameter:**
- ✅ `fetchTranscript(videoUrl, targetLang, accessToken?)`
- ✅ `analyzeVideoContent(..., accessToken?)`
- ✅ `generateConversationHints(..., accessToken?)`
- ✅ `searchVideos(query, videos, accessToken?)`

**Changes:**
```typescript
// Before
headers: { 'Content-Type': 'application/json' }

// After
headers: {
  'Content-Type': 'application/json',
  ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
}
```

#### 2. [src/App.tsx](src/App.tsx)
**Changes:**
- ✅ Added `session` to `useAuth()` destructuring
- ✅ Pass `session?.access_token` to:
  - `fetchTranscript()` - Line ~1107
  - `analyzeVideoContent()` - Line ~1123
  - `fetch('/api/generate-question')` - Line ~878
  - `savePracticeTopicsFromAnalysis()` - Line ~1193

#### 3. [src/features/practice/components/PracticeSession.tsx](src/features/practice/components/PracticeSession.tsx)
**Changes:**
- ✅ Added `session` to `useAuth()` destructuring (Line 111)
- ✅ Pass `session?.access_token` to `fetch('/api/analyze-speech')` (Line 259)

#### 4. [src/features/library/components/VideoLibraryPage.tsx](src/features/library/components/VideoLibraryPage.tsx)
**Changes:**
- ✅ Added `session` to `useAuth()` destructuring (Line 19)
- ✅ Pass `session?.access_token` to `searchVideos()` (Line 90)

#### 5. [src/features/live-voice/components/LiveVoiceInterface.tsx](src/features/live-voice/components/LiveVoiceInterface.tsx)
**Changes:**
- ✅ Import `useAuth` hook
- ✅ Added `session` from `useAuth()` (Line 69)
- ✅ Pass `session?.access_token` to `generateConversationHints()` (Line 191)

#### 6. [src/features/live-voice/hooks/useLiveVoice.ts](src/features/live-voice/hooks/useLiveVoice.ts)
**Changes:**
- ✅ Add `accessToken?: string` to `UseLiveVoiceConfig` interface (Line 30)
- ✅ Destructure `accessToken` from config (Line 82)
- ✅ Pass `accessToken` to `generateConversationHints()` (Line 674)

#### 7. [src/features/live-voice/components/FloatingTutorWindow.tsx](src/features/live-voice/components/FloatingTutorWindow.tsx)
**Changes:**
- ✅ Added `session` to `useAuth()` destructuring (Line 88)
- ✅ Pass `session?.access_token` to `useLiveVoice()` config (Line 111)

#### 8. [src/shared/services/database.ts](src/shared/services/database.ts)
**Changes:**
- ✅ Add `accessToken?: string` parameter to `savePracticeTopicsFromAnalysis()` (Line 353)
- ✅ Pass `accessToken` to `fetch('/api/match-topics')` (Line 388)

---

## 🔄 Authentication Flow

### How It Works Now

1. **User logs in** → Supabase returns JWT token in `session.access_token`
2. **Frontend stores session** → `AuthContext` manages session state
3. **API calls include token** → All protected APIs receive `Authorization: Bearer <token>` header
4. **Backend validates token** → `getUserFromToken(req)` verifies JWT
5. **Request processed** → If valid, API executes; if invalid, returns `401 Unauthorized`

### Token Lifecycle

```typescript
// AuthContext provides session to all components
const { session } = useAuth();

// All API calls now include the token
fetch('/api/analyze-speech', {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}`,
  },
  // ...
})
```

---

## ✅ Testing

### Before Fix
```bash
# All API calls failed with:
{"error":"Unauthorized"}
```

### After Fix
```bash
# API calls succeed with valid session
# Returns actual data or appropriate error messages
```

### How to Test

1. **Login to the app** (creates session with valid JWT token)
2. **Try any feature that uses AI APIs**:
   - Analyze a video → Should work ✅
   - Practice speaking → Should work ✅
   - Search library → Should work ✅
   - AI tutor → Should work ✅
3. **Check browser DevTools Network tab**:
   - All API calls should have `Authorization: Bearer <token>` header
   - Status should be `200 OK` (not `401`)

---

## 🎯 What This Fixes

### Issue
After adding backend authentication, the app showed:
- ❌ "Unauthorized" errors on all AI features
- ❌ Practice sessions couldn't analyze speech
- ❌ Video analysis failed
- ❌ AI tutor couldn't generate hints

### Solution
All frontend code now:
- ✅ Gets JWT token from `AuthContext`
- ✅ Includes `Authorization: Bearer <token>` header in all API calls
- ✅ Works seamlessly with backend authentication

---

## 🚀 Deployment

### Before Deployment
- [x] Backend authentication added
- [x] Frontend updated to send tokens
- [x] Tested locally

### Deployment Steps
```bash
# 1. Commit all frontend changes
git add src/
git commit -m "🔐 Add JWT authentication to frontend API calls

- Pass session.access_token to all protected API endpoints
- Update geminiService functions to accept accessToken
- Update all components using AI APIs
- Fixes 401 Unauthorized errors after backend auth was added"

# 2. Push to Railway (auto-deploys both frontend and backend)
git push origin main
```

---

## 📊 Impact

### Before (Backend Auth Only)
- 🔴 Backend: Protected ✅
- 🔴 Frontend: No tokens ❌
- 🔴 Result: All API calls fail with 401

### After (Full Auth Flow)
- 🟢 Backend: Protected ✅
- 🟢 Frontend: Sends tokens ✅
- 🟢 Result: Full authentication flow working ✅

---

## 🔒 Security Status

**Authentication**: ✅ Complete
- Backend validates all AI API requests
- Frontend sends JWT tokens
- Only authenticated users can use AI features

**Rate Limiting**: ⚠️ Not yet implemented (recommended next step)
**Usage Tracking**: ✅ Already implemented
**WebSocket Auth**: ⚠️ Needs improvement (userId can be spoofed)

---

## 📌 Notes

1. **Optional tokens**: All `accessToken` parameters are optional (`accessToken?: string`)
   - This allows functions to work even if session is not yet loaded
   - Backend will return 401 if token is missing or invalid

2. **Token refresh**: Handled automatically by Supabase Auth
   - `AuthContext` manages token refresh
   - All API calls use the latest token from `session.access_token`

3. **Anonymous users**: Currently not supported for AI features
   - All AI endpoints require authentication
   - Consider adding rate-limited anonymous access in the future

---

**Status**: ✅ Complete and ready for deployment
