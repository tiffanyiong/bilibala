# Session Limits & Anti-Account-Sharing

## Overview
Bilibala now enforces concurrent device limits to prevent account sharing abuse while allowing legitimate multi-device usage.

## Device Limits by Tier
- **Free Tier**: 1 device at a time
- **Pro Tier**: 3 devices at a time

## How It Works

### 1. Session Registration
When a user signs in:
- Device fingerprint is generated using FingerprintJS
- Session is registered in `active_sessions` table with:
  - Session ID (Supabase access token)
  - Device fingerprint
  - User agent
  - IP address
  - Device metadata
  - Expiration timestamp

### 2. Auto-Logout Mechanism
When a user exceeds their device limit:
- The **oldest active session** is automatically logged out
- User on that device sees: "You have been logged out because this account is now active on another device"
- The new device session is registered successfully

### 3. Session Monitoring
Active sessions are monitored via:
- **Session validity check**: Every 30 seconds
  - Checks if session still exists in `active_sessions` table
  - If removed (logged out), forces local logout
- **Heartbeat**: Every 5 minutes
  - Updates `last_active_at` timestamp
  - Keeps session marked as active

### 4. Session Cleanup
Stale sessions are removed when:
- User explicitly logs out
- Session expires (from Supabase)
- Session inactive for 7+ days (automatic cleanup)

## Database Schema

### Table: `active_sessions`
```sql
CREATE TABLE active_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT UNIQUE,
  device_fingerprint TEXT,
  user_agent TEXT,
  ip_address INET,
  device_info JSONB,
  created_at TIMESTAMP,
  last_active_at TIMESTAMP,
  expires_at TIMESTAMP
);
```

### Key Functions
- `get_session_limit(user_id)` - Returns 1 for free, 3 for pro
- `get_active_session_count(user_id)` - Counts active sessions
- `register_session(...)` - Registers session, auto-logouts oldest if over limit
- `update_session_activity(session_id)` - Updates heartbeat
- `remove_session(session_id)` - Removes session on logout
- `cleanup_expired_sessions()` - Cleanup job for stale sessions

## API Endpoints

### POST `/api/sessions/register`
Register a new session (called on SIGNED_IN event)
```json
{
  "sessionId": "access_token",
  "deviceFingerprint": "abc123...",
  "userAgent": "Mozilla/5.0...",
  "ipAddress": "192.168.1.1",
  "deviceInfo": { "language": "en-US" },
  "expiresAt": "2026-02-12T10:00:00Z"
}
```

Response:
```json
{
  "success": true,
  "sessionLimit": 3,
  "loggedOutSessions": ["old_token"],
  "loggedOutCount": 1
}
```

### POST `/api/sessions/heartbeat`
Update session activity (called every 5 minutes)
```json
{ "sessionId": "access_token" }
```

### POST `/api/sessions/check`
Check if session is still valid (called every 30 seconds)
```json
{ "sessionId": "access_token" }
```

Response:
```json
{ "valid": true }
```

### POST `/api/sessions/remove`
Remove session (called on logout)
```json
{ "sessionId": "access_token" }
```

### GET `/api/sessions/active`
Get all active sessions for user
Response:
```json
{
  "sessions": [...],
  "count": 2,
  "limit": 3
}
```

## Frontend Implementation

### AuthContext Changes
[src/shared/context/AuthContext.tsx](../src/shared/context/AuthContext.tsx)

New functionality:
- `registerSession()` - Registers session on login
- `checkSessionValidity()` - Checks every 30s if session still valid
- `sendHeartbeat()` - Sends heartbeat every 5 min
- `removeSession()` - Removes session on logout

Auto-logout flow:
1. Session validity check fails (session not in DB)
2. Local Supabase auth.signOut() called
3. User sees alert notification
4. Intervals cleared

## Testing Instructions

### Test 1: Single Device (Free User)
1. Sign in as free user on Device A
2. Verify session is registered
3. Stay logged in and active
4. ✅ Should remain logged in

### Test 2: Device Limit Exceeded (Free User)
1. Sign in as free user on Device A (Chrome)
2. Open incognito/private window (Device B)
3. Sign in with same account on Device B
4. ✅ Device A should be auto-logged out within 30 seconds
5. ✅ Device A should show alert: "You have been logged out..."
6. ✅ Device B should remain logged in

### Test 3: Multi-Device (Pro User)
1. Upgrade to Pro tier
2. Sign in on Device A (Chrome)
3. Sign in on Device B (Firefox)
4. Sign in on Device C (Safari)
5. ✅ All 3 devices should remain logged in
6. Sign in on Device D (Edge)
7. ✅ Device A (oldest) should be auto-logged out
8. ✅ Devices B, C, D should remain logged in

### Test 4: Manual Logout
1. Sign in on 2 devices
2. Click "Sign Out" on Device A
3. ✅ Session should be removed from `active_sessions`
4. ✅ Device A should be logged out
5. ✅ Device B should remain logged in

### Test 5: Session Expiry
1. Sign in on Device A
2. Wait for session to expire (or manually delete from `active_sessions`)
3. ✅ Within 30 seconds, Device A should auto-logout
4. ✅ Alert should be shown

## Database Migration

Run migration 013:
```bash
# Apply migration to Supabase
supabase db push

# Or apply manually via Supabase Dashboard → SQL Editor
# Copy contents of supabase/migrations/013_active_sessions.sql
```

## Monitoring

Check active sessions in Supabase:
```sql
-- View all active sessions
SELECT
  u.email,
  s.device_fingerprint,
  s.user_agent,
  s.ip_address,
  s.created_at,
  s.last_active_at
FROM active_sessions s
JOIN auth.users u ON u.id = s.user_id
ORDER BY s.last_active_at DESC;

-- Count sessions per user
SELECT
  user_id,
  COUNT(*) as session_count
FROM active_sessions
GROUP BY user_id
HAVING COUNT(*) > 1;
```

## Security Considerations

✅ **RLS Enabled**: Users can only see/modify their own sessions
✅ **Device Fingerprinting**: Uses FingerprintJS for browser/device identification
✅ **Fallback ID**: localStorage fallback if fingerprinting blocked
✅ **Server-Side Validation**: All session checks happen server-side
✅ **Auto-Cleanup**: Stale sessions removed after 7 days
✅ **Graceful Degradation**: If API fails, user stays logged in (no false logouts)

## Future Enhancements

- [ ] Add "Manage Devices" page in settings
- [ ] Allow users to manually revoke sessions
- [ ] Show device names/locations in UI
- [ ] Email notification on new device login
- [ ] Option to "Trust this device for 30 days"
- [ ] Admin dashboard to monitor session abuse

## Troubleshooting

### User reports being logged out unexpectedly
1. Check `active_sessions` table for their user_id
2. Check if session_id matches current access_token
3. Check `last_active_at` timestamp (should be recent)
4. Check subscription tier and session limit

### Session not being removed on logout
1. Check if `remove_session()` is being called
2. Check RLS policies on `active_sessions`
3. Check server logs for errors

### Device limit not enforced
1. Verify `get_session_limit()` returns correct value
2. Check `user_subscriptions.tier` is correct
3. Check `register_session()` is being called on SIGNED_IN
