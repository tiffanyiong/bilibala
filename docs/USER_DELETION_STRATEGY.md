# User Deletion Strategy: Hard Delete vs Soft Delete

## Current Implementation: Hard Delete ❌

When a user is deleted from Supabase Dashboard:
- User permanently removed from `auth.users`
- All user data deleted via `ON DELETE CASCADE`
- No way to recover or audit

---

## Recommended: Soft Delete with Anonymization ✅

### How It Works

1. **User requests deletion** (or admin deletes from dashboard)
2. **Immediate anonymization** (GDPR compliant):
   - Email → `deleted_1707638400_abc123@deleted.local`
   - Password → NULL
   - Name/metadata → Cleared
   - `deleted_at` → Current timestamp
3. **Session logout**: All active sessions removed
4. **Keep for audit**:
   - Usage history (for analytics)
   - Cached analyses (for reuse by other users)
   - Subscription history (for Stripe billing)
   - Created content (with `created_by` intact)
5. **Hard delete after 30 days**: Permanent removal from database

---

## Comparison Table

| Feature | Hard Delete | Soft Delete |
|---------|-------------|-------------|
| **GDPR Compliant** | ✅ Immediately | ✅ After anonymization |
| **Audit Trail** | ❌ Lost forever | ✅ Preserved |
| **Stripe History** | ❌ Lost | ✅ Preserved |
| **Analytics** | ❌ Can't analyze churn | ✅ Can analyze why users left |
| **Account Recovery** | ❌ Impossible | ✅ Within 30 days |
| **Prevent Re-signup** | ❌ Can re-register with same email | ✅ Blocked until hard-delete |
| **Database Size** | ✅ Smaller | ⚠️ Grows (cleaned after 30 days) |
| **Query Complexity** | ✅ Simple | ⚠️ Need to filter `deleted_at IS NULL` |
| **Implementation** | ✅ Simple | ⚠️ More complex |

---

## Implementation: Soft Delete

### Migration 015

Run [015_soft_delete_users.sql](../supabase/migrations/015_soft_delete_users.sql) to add:
- `deleted_at` column to `user_subscriptions`
- `soft_delete_user(user_id)` function
- `cleanup_old_deleted_users()` function (for cron job)

### Usage

#### From Supabase Dashboard
Instead of deleting user, run:
```sql
SELECT soft_delete_user('USER_ID_HERE');
```

#### From Backend API
Create an endpoint:
```javascript
// server/routes/subscriptionRoutes.js
router.delete('/users/:userId', async (req, res) => {
  const { data, error } = await supabaseAdmin.rpc('soft_delete_user', {
    p_user_id: req.params.userId
  });

  if (error) return res.status(500).json({ error });
  res.json(data);
});
```

#### Cleanup Job (Cron)
Run daily to hard-delete users after 30 days:
```sql
SELECT cleanup_old_deleted_users();
```

Or set up Supabase cron job:
```sql
SELECT cron.schedule(
  'cleanup-deleted-users',
  '0 2 * * *', -- 2 AM daily
  $$SELECT cleanup_old_deleted_users()$$
);
```

---

## What Gets Anonymized

### Immediate (On Soft Delete)
- ✅ Email → `deleted_<timestamp>_<random>@deleted.local`
- ✅ Password → NULL (can't log in)
- ✅ Name/Avatar → Cleared
- ✅ Active sessions → Deleted (logged out everywhere)

### What's Preserved (30 days)
- ✅ User ID (for foreign key references)
- ✅ Usage history (for analytics)
- ✅ Subscription/billing history (for Stripe)
- ✅ Created content (analyses, topics, questions)
- ✅ Practice sessions (anonymized)

### After 30 Days
- ❌ Everything permanently deleted
- ❌ `created_by` references → NULL

---

## GDPR Compliance

### Right to Erasure (Article 17)
✅ **Compliant**: PII is anonymized immediately
- Email, name, password → Removed within seconds
- No way to identify the person
- Keeps aggregated/anonymized data for business purposes

### Right to Data Portability (Article 20)
Before deletion, user can export their data:
```sql
-- Export user data
SELECT * FROM usage_history WHERE user_id = 'USER_ID';
SELECT * FROM practice_sessions WHERE user_id = 'USER_ID';
```

### Retention Period
- **Active users**: Indefinite
- **Soft-deleted users**: 30 days (anonymized)
- **Hard-deleted users**: Permanent removal

---

## Migration Path

### Option A: Apply Now (Recommended)
1. Run migration 015
2. Update Supabase Dashboard deletion workflow to use `soft_delete_user()`
3. Set up daily cron job for cleanup
4. Update RLS policies to exclude deleted users

### Option B: Keep Hard Delete
1. Run migration 014 to fix `cached_analyses` constraint
2. Continue with hard delete from Supabase Dashboard
3. Accept that audit trail is lost

---

## Recommendation

**Use Soft Delete** if:
- ✅ You want to analyze why users churn
- ✅ You need audit trails for billing/compliance
- ✅ You want to allow account recovery
- ✅ You want to prevent abuse (ban + prevent re-signup)

**Use Hard Delete** if:
- ✅ You have very few users (testing phase)
- ✅ You don't need analytics
- ✅ You want simplest implementation
- ✅ Database size is a major concern

---

## Next Steps

1. **Decide**: Hard delete or soft delete?
2. **If Hard Delete**: Run [migration 014](../supabase/migrations/014_fix_user_deletion_constraints.sql)
3. **If Soft Delete**: Run [migration 015](../supabase/migrations/015_soft_delete_users.sql)
4. **Set up cron job** (if soft delete)
5. **Update RLS policies** to exclude deleted users

---

## Testing

### Test Soft Delete
```sql
-- 1. Create test user (do this via Supabase Dashboard)
-- 2. Soft delete
SELECT soft_delete_user('TEST_USER_ID');

-- 3. Verify email is anonymized
SELECT email FROM auth.users WHERE id = 'TEST_USER_ID';
-- Should return: deleted_1707638400_abc123@deleted.local

-- 4. Verify can't log in
-- Try logging in with original email → Should fail

-- 5. Verify data preserved
SELECT * FROM usage_history WHERE user_id = 'TEST_USER_ID';
-- Should return data

-- 6. Test hard delete after 30 days (simulate)
UPDATE user_subscriptions SET deleted_at = NOW() - INTERVAL '31 days' WHERE user_id = 'TEST_USER_ID';
SELECT cleanup_old_deleted_users();
-- Should return 1

-- 7. Verify user is gone
SELECT * FROM auth.users WHERE id = 'TEST_USER_ID';
-- Should return 0 rows
```

