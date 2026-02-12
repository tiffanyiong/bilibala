# Session ID Storage Optimization

## Summary

Optimized session ID storage to reduce database size by 97% and improve log readability.

## Changes Made

### Before
```typescript
// Stored full JWT access_token as session_id
sessionId: session.access_token  // ~1,398 characters
```

**Log output:**
```
[Session] Registered session for user: d16e853e-b125-4566-ade0-f6153ec47908 {
  sessionId: 'eyJhbGciOiJFUzI1NiIsImtpZCI6IjFkNGZlNmU4LTZkMzUtNDg0MC05OTgxLTkxODRiZTcyZmYxZiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2x1a3JreHR4a2Jnc2l0ZmpzZnF6LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJkMTZlODUzZS1iMTI1LTQ1NjYtYWRlMC1mNjE1M2VjNDc5MDgiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzcwODgzNDM3LCJpYXQiOjE3NzA4Nzk4MzcsImVtYWlsIjoidGlmZmFueWlvbmc5MjRAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCIsImdvb2dsZSJdfSwidXNlcl9tZXRhZGF0YSI6eyJhdmF0YXJfdXJsIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jSTdUbGFzQUNadnhNbG9zT21OeXpiM0tIaTVKV2xxVWdFcENNMF84TFNqZkdNODdwWXY9czk2LWMiLCJlbWFpbCI6InRpZmZhbnlpb25nOTI0QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmdWxsX25hbWUiOiJUaWZmYW55IElvbmciLCJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJuYW1lIjoiVGlmZmFueSBJb25nIiwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jSTdUbGFzQUNadnhNbG9zT21OeXpiM0tIaTVKV2xxVWdFcENNMF84TFNqZkdNODdwWXY9czk2LWMiLCJwcm92aWRlcl9pZCI6IjExMDU4NTUyNDQ1NDY4MTg1MjQ2NSIsInN1YiI6IjExMDU4NTUyNDQ1NDY4MTg1MjQ2NSJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzcwODc5ODM3fV0sInNlc3Npb25faWQiOiJmYmZmZTk0YS1hYTZhLTQxMjctOTY2ZC0xOWU0NTFhNjgwNzYiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.RaTLAhOxdKIuhgGFV-0lJUsmSeGpyuLgETdIpT8lztv1P41wOwEd8eFOiyrGzTSZlvgQtsK0-3OdeK7rNfBLjg',
  deviceFingerprint: '5940f23e650ee9906577ad76c11a8f81',
  loggedOutCount: 0,
  sessionLimit: 3
}
```

### After
```typescript
// Extract session_id UUID from JWT payload
const sessionId = extractSessionId(session.access_token);  // 36 characters
```

**Log output (expected):**
```
[Session] Registered session for user: d16e853e-b125-4566-ade0-f6153ec47908 {
  sessionId: 'fbffe94a-aa6a-4127-966d-19e451a68076',
  deviceFingerprint: '5940f23e650ee9906577ad76c11a8f81',
  loggedOutCount: 0,
  sessionLimit: 3
}
```

## Implementation Details

### New Helper Function
```typescript
/**
 * Extract session_id from Supabase JWT token
 * Instead of storing the full JWT (1,398+ chars), we extract the session_id UUID (36 chars)
 * This provides 97% storage savings while maintaining the same behavior
 */
const extractSessionId = (accessToken: string): string => {
  try {
    // JWT structure: header.payload.signature
    const payloadBase64 = accessToken.split('.')[1];
    if (!payloadBase64) {
      console.warn('[Session] Invalid JWT format, using access_token as fallback');
      return accessToken;
    }

    // Decode base64 payload
    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson);

    // Return Supabase's session_id from the JWT payload
    if (payload.session_id) {
      return payload.session_id;
    }

    console.warn('[Session] No session_id found in JWT, using access_token as fallback');
    return accessToken;
  } catch (error) {
    console.error('[Session] Failed to extract session_id from JWT:', error);
    // Fallback to full access_token if decoding fails
    return accessToken;
  }
};
```

### Updated Functions
1. `registerSession()` - Line 112
2. `checkSessionValidity()` - Line 113
3. `sendHeartbeat()` - Line 150
4. `removeSession()` - Line 168

All now use `extractSessionId(session.access_token)` instead of `session.access_token` directly.

## Benefits

### Storage Savings
- **Per session**: 1,398 chars → 36 chars (97.4% reduction)
- **Per 1,000 sessions**: 1.4 MB → 36 KB (38x smaller)
- **Per 10,000 sessions**: 14 MB → 360 KB (38x smaller)

### Log Readability
- Before: Multi-line JWT tokens that are impossible to read
- After: Clean, readable UUIDs that can be easily searched/compared

### Behavior
- **No changes** to session tracking logic
- **Same behavior** with multiple tabs (shared session_id)
- **Same behavior** with device limits
- **Backward compatible**: Existing sessions will work (old JWTs in DB still valid until they expire)

## Error Handling

The `extractSessionId()` function includes robust error handling:

1. **Invalid JWT format**: Falls back to full access_token
2. **Missing session_id claim**: Falls back to full access_token
3. **JSON parse error**: Falls back to full access_token
4. **All errors logged**: Console warnings/errors for debugging

This ensures the app continues to function even if JWT structure changes or decoding fails.

## Testing Checklist

- [ ] User can log in successfully
- [ ] Session is registered (check logs for short UUID instead of long JWT)
- [ ] Multiple tabs share the same session (same session_id in logs)
- [ ] Session heartbeat works (updates `last_active_at`)
- [ ] Session validity check works (detects logged-out sessions)
- [ ] Logout removes session from database
- [ ] Device limits enforce correctly (free=1, pro=3)
- [ ] Database `active_sessions` table shows UUIDs, not JWTs

## Database Impact

### Migration Required?
**No.** The `session_id` column is already `TEXT` type, so it accepts both:
- Old format: Full JWT (~1,398 chars)
- New format: UUID (36 chars)

### Cleanup
Old sessions with full JWTs will be automatically cleaned up by:
1. 7-day inactivity cleanup (`cleanup_expired_sessions()`)
2. Natural expiration when users log out/re-login

## Files Changed

- `src/shared/context/AuthContext.tsx` - Added `extractSessionId()` helper and updated all session functions
- `CHANGELOG.md` - Documented the optimization
- `docs/SESSION_ID_OPTIMIZATION.md` - This file
- `docs/SESSION_ID_INVESTIGATION.md` - Full analysis of options
- `docs/SESSION_ID_EXPLAINED.md` - Explanation of what session_id tracks

## References

- JWT structure: https://jwt.io/
- Supabase session docs: https://supabase.com/docs/guides/auth/sessions
- Migration 013: `supabase/migrations/013_active_sessions.sql`
