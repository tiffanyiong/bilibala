# Session ID Investigation

## Problem
Currently storing the full Supabase JWT `access_token` as the `session_id` in the `active_sessions` table.
- **Length**: 600-800 characters
- **Example**: `eyJhbGciOi...<redacted JWT>...signature`

## Issue
- **Logs are noisy**: Session registration logs are unreadable
- **Storage inefficient**: 700 bytes per session vs 36 bytes for UUID (19x larger)
- **Unnecessary**: We already validate the JWT in `getUserFromToken()`, so storing the full token provides no additional security

---

## Supabase Session Object (v2.90.1)

According to [Supabase Auth Helpers documentation](https://supabase.com/docs/guides/auth/sessions), the session object contains:

```typescript
interface Session {
  access_token: string;        // JWT token (600-800 chars)
  token_type: 'bearer';
  expires_in: number;
  expires_at?: number;
  refresh_token: string;       // Refresh token (40-100 chars)
  user: User;                  // User object
}

interface User {
  id: string;                  // UUID (36 chars)
  aud: string;
  role: string;
  email?: string;
  // ... other properties
}
```

**Important**: Supabase sessions do NOT have a dedicated short `session_id` property (confusing, I know!). The JWT payload contains a `session_id` claim, but accessing it requires decoding the JWT.

---

## Proposed Solutions

### Option 1: Generate a UUID (RECOMMENDED ✅)
**Implementation:**
```javascript
import { randomUUID } from 'crypto'; // Built-in Node.js

const sessionId = randomUUID(); // e.g., "a3bb189e-8bf9-3888-9912-ace4e6543002"
```

**Pros:**
- ✅ Short (36 chars)
- ✅ Standard format
- ✅ No dependencies (built-in Node.js)
- ✅ Guaranteed unique

**Cons:**
- None

**Storage impact:** 700 bytes → 36 bytes (19x smaller)

---

### Option 2: Hash the access_token
**Implementation:**
```javascript
import { createHash } from 'crypto';

const sessionId = createHash('sha256')
  .update(session.access_token)
  .digest('hex'); // e.g., "a3bb189e8bf938889912ace4e6543002..."
```

**Pros:**
- ✅ Deterministic (same token = same hash)
- ✅ Secure (one-way hash)

**Cons:**
- ❌ Longer than UUID (64 chars)
- ❌ No practical benefit over UUID

**Storage impact:** 700 bytes → 64 bytes (11x smaller)

---

### Option 3: Decode JWT and use `session_id` claim
**Implementation:**
```javascript
import jwt from 'jsonwebtoken';

const decoded = jwt.decode(session.access_token);
const sessionId = decoded.session_id; // UUID from Supabase
```

**Pros:**
- ✅ Uses Supabase's internal session ID
- ✅ Short (36 chars)

**Cons:**
- ❌ Requires JWT decoding
- ❌ Adds dependency
- ❌ Supabase might change JWT structure

**Storage impact:** 700 bytes → 36 bytes (19x smaller)

---

## Recommendation

**Use Option 1: Generate a UUID** using Node.js built-in `crypto.randomUUID()`

### Why?
1. **Simple**: No dependencies, one line of code
2. **Efficient**: 19x smaller storage footprint
3. **Clean logs**: Readable session IDs in logs
4. **Standard**: UUIDs are universally recognized

### What changes?
Only need to update [src/shared/context/AuthContext.tsx:88](src/shared/context/AuthContext.tsx#L88):

```diff
+ import { randomUUID } from 'crypto'; // Add at top (for Node.js)
+ // OR for browser compatibility:
+ const randomUUID = () => self.crypto.randomUUID();

  const registerSession = async (session: Session) => {
+   const sessionId = randomUUID(); // Generate short UUID
+
    const response = await fetch(`${getBackendOrigin()}/api/sessions/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
-       'Authorization': `Bearer ${session.access_token}`,
+       'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
-       sessionId: session.access_token, // OLD: 700 chars
+       sessionId, // NEW: 36 chars
        deviceFingerprint,
        // ...
      }),
    });
  };
```

**Note:** Since this runs in the browser, use `self.crypto.randomUUID()` (available in all modern browsers) or polyfill for older browsers.

---

## Storage Impact

For a typical user base:

| Users | Sessions | Current Storage | With UUID | Savings |
|-------|----------|-----------------|-----------|---------|
| 100   | 300      | 210 KB          | 10.8 KB   | 95% |
| 1,000 | 3,000    | 2.1 MB          | 108 KB    | 95% |
| 10,000| 30,000   | 21 MB           | 1.08 MB   | 95% |

---

## Migration Plan

1. **Update frontend**: Change `sessionId` generation in `AuthContext.tsx`
2. **No database migration needed**: `session_id TEXT` column already accepts any string
3. **Backward compatible**: Old sessions will expire naturally (7 days auto-cleanup)
4. **Deploy**: Frontend change only, no backend changes needed

---

## Final Answer

**Yes, the session ID must be that long IF you keep using the JWT.** But you shouldn't—use a UUID instead. It's simpler, cleaner, and 19x more efficient.
