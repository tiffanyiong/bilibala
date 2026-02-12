# Session Logging Reference

All session-related log statements now include the `sessionId` for easy tracking and debugging.

## Frontend Logs (AuthContext.tsx)

### 1. Session Registration
```javascript
[Session] Registered: { sessionId: 'fbffe94a-aa6a-4127-966d-19e451a68076', deviceFingerprint: '5940f23e...', sessionLimit: 3 }
```
**When:** User logs in or page loads with existing session
**Location:** `registerSession()` function

**With auto-logout:**
```javascript
[Session] Registered: { sessionId: 'fbffe94a-aa6a-4127-966d-19e451a68076', deviceFingerprint: '5940f23e...', sessionLimit: 3 }
[Session] 1 older session(s) were automatically logged out due to device limit (3)
```

---

### 2. Session Validity Check
```javascript
[Session] Valid: { sessionId: 'fbffe94a-aa6a-4127-966d-19e451a68076' }
```
**When:** Every 30 seconds (background check)
**Location:** `checkSessionValidity()` function

**When invalidated:**
```javascript
[Session] Invalidated: { sessionId: 'fbffe94a-aa6a-4127-966d-19e451a68076', reason: 'session_logout' }
```

---

### 3. Session Heartbeat
```javascript
[Session] Heartbeat sent: { sessionId: 'fbffe94a-aa6a-4127-966d-19e451a68076' }
```
**When:** Every 5 minutes (keeps session active)
**Location:** `sendHeartbeat()` function

---

### 4. Session Removal
```javascript
[Session] Removed: { sessionId: 'fbffe94a-aa6a-4127-966d-19e451a68076' }
```
**When:** User logs out
**Location:** `removeSession()` function

---

## Backend Logs (sessionRoutes.js)

### 1. Session Registration (Server)
```javascript
[Session] Registered session for user: d16e853e-b125-4566-ade0-f6153ec47908 {
  sessionId: 'fbffe94a-aa6a-4127-966d-19e451a68076',
  deviceFingerprint: '5940f23e650ee9906577ad76c11a8f81',
  loggedOutCount: 0,
  sessionLimit: 3
}
```
**When:** Server processes session registration
**Location:** `POST /api/sessions/register`

---

### 2. Session Removal (Server)
```javascript
[Session] Removed session: fbffe94a-aa6a-4127-966d-19e451a68076 for user: d16e853e-b125-4566-ade0-f6153ec47908
```
**When:** Server processes session removal
**Location:** `POST /api/sessions/remove`

---

### 3. User Deleted
```javascript
[Session] User no longer exists in database, invalidating session
```
**When:** Session check detects user was deleted
**Location:** `POST /api/sessions/check`

---

## Error Logs

### JWT Extraction Errors
```javascript
[Session] Invalid JWT format, using access_token as fallback
```
**When:** JWT doesn't have expected structure
**Location:** `extractSessionId()` function

```javascript
[Session] No session_id found in JWT, using access_token as fallback
```
**When:** JWT payload doesn't contain `session_id` claim
**Location:** `extractSessionId()` function

```javascript
[Session] Failed to extract session_id from JWT: [error details]
```
**When:** JSON parsing or base64 decoding fails
**Location:** `extractSessionId()` function

---

### Network Errors
```javascript
[Session] Failed to register session: [error details]
```
**When:** Registration API call fails
**Location:** `registerSession()` function

```javascript
[Session] Failed to check session validity: [error details]
```
**When:** Validity check API call fails
**Location:** `checkSessionValidity()` function

```javascript
[Session] Failed to send heartbeat: [error details]
```
**When:** Heartbeat API call fails
**Location:** `sendHeartbeat()` function

```javascript
[Session] Failed to remove session: [error details]
```
**When:** Remove API call fails
**Location:** `removeSession()` function

---

## Log Flow Examples

### Happy Path: User Login
```
1. [Frontend] [Session] Registered: { sessionId: 'fbffe94a...', deviceFingerprint: '5940f23e...', sessionLimit: 3 }
2. [Backend]  [Session] Registered session for user: d16e853e... { sessionId: 'fbffe94a...', deviceFingerprint: '5940f23e...', loggedOutCount: 0, sessionLimit: 3 }
3. [Frontend] [Session] Valid: { sessionId: 'fbffe94a...' } (every 30s)
4. [Frontend] [Session] Heartbeat sent: { sessionId: 'fbffe94a...' } (every 5 min)
```

---

### User Exceeds Device Limit
```
1. [Frontend] [Session] Registered: { sessionId: 'abc123...', deviceFingerprint: 'device1...', sessionLimit: 1 }
2. [Backend]  [Session] Registered session for user: d16e853e... { sessionId: 'abc123...', deviceFingerprint: 'device1...', loggedOutCount: 0, sessionLimit: 1 }

   [User opens app on second device]

3. [Frontend] [Session] Registered: { sessionId: 'def456...', deviceFingerprint: 'device2...', sessionLimit: 1 }
4. [Backend]  [Session] Registered session for user: d16e853e... { sessionId: 'def456...', deviceFingerprint: 'device2...', loggedOutCount: 1, sessionLimit: 1 }
5. [Frontend] [Session] 1 older session(s) were automatically logged out due to device limit (1)

   [First device checks validity]

6. [Frontend] [Session] Invalidated: { sessionId: 'abc123...', reason: 'session_logout' }
   [Alert shown to user]
```

---

### User Logout
```
1. [Frontend] [Session] Removed: { sessionId: 'fbffe94a...' }
2. [Backend]  [Session] Removed session: fbffe94a... for user: d16e853e...
```

---

## Debugging Tips

### Find all logs for a specific session:
```bash
# Grep server logs
grep "fbffe94a-aa6a-4127-966d-19e451a68076" logs/*.log

# Browser console filter
[Session] fbffe94a
```

### Track session lifecycle:
1. **Registration** → Look for `[Session] Registered:`
2. **Activity** → Look for `[Session] Heartbeat sent:` every 5 min
3. **Validation** → Look for `[Session] Valid:` every 30s
4. **Termination** → Look for `[Session] Removed:` or `[Session] Invalidated:`

### Common Issues:

**Session keeps getting invalidated:**
- Check if user is logging in on multiple devices
- Verify device limit (free=1, pro=3)
- Look for `loggedOutCount > 0` in registration logs

**No heartbeats showing:**
- User might be inactive
- Check if `heartbeatIntervalRef` is running
- Verify 5-minute interval

**Seeing full JWT instead of UUID:**
- JWT extraction failed
- Look for warning logs from `extractSessionId()`
- Fallback behavior is working (no action needed)

---

## Session ID Format

**New format (after optimization):**
- UUID v4 format: `fbffe94a-aa6a-4127-966d-19e451a68076`
- Length: 36 characters
- Source: Extracted from JWT `session_id` claim

**Old format (legacy):**
- Full JWT: `eyJhbGciOiJFUzI1NiIs...` (1,398+ characters)
- Only appears if JWT extraction fails (fallback)

---

## Summary

✅ All session operations log the `sessionId`
✅ Easy to track session lifecycle
✅ Clear error messages with context
✅ Consistent format across frontend/backend

You can now grep/filter logs by session ID to debug specific user sessions!
