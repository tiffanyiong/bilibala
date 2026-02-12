# Stripe Subscription Cleanup on User Deletion

## The Problem

When you delete a user from Supabase Dashboard:
- ✅ User deleted from database
- ❌ **Stripe subscription still active**
- ❌ User will be billed next month even though account is deleted
- ❌ No way to access the money or refund

---

## How Other Companies Handle This

### **Option 1: Cancel Immediately** (Netflix, Spotify)
- Delete account → Cancel Stripe subscription immediately
- User loses access instantly
- No refund for remaining days

### **Option 2: Cancel at Period End** (GitHub, Heroku)
- Delete account → Cancel Stripe subscription at end of billing period
- User keeps access until period ends
- More user-friendly, but harder to implement

### **Option 3: Require Cancellation First** (Some SaaS)
- User must cancel subscription before deleting account
- Prevents billing issues
- More friction for users

---

## Our Implementation: Automatic Cancellation via Queue

### **How It Works:**

```
User Deleted from Supabase Dashboard
         ↓
Trigger: cancel_stripe_on_user_delete()
         ↓
Add to stripe_cleanup_queue table
         ↓
Backend cron job (every 5 min)
         ↓
Call Stripe API to cancel subscription
         ↓
Mark as processed in queue
```

### **Why Use a Queue?**

Can't call Stripe API directly from Postgres trigger because:
- ❌ No HTTP client in Postgres
- ❌ Would block user deletion
- ❌ Error handling is difficult

Instead:
- ✅ Queue the cancellation request
- ✅ Backend processes it asynchronously
- ✅ Retries on failure
- ✅ Logs errors for debugging

---

## Database Schema

### `stripe_cleanup_queue` Table

```sql
CREATE TABLE stripe_cleanup_queue (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  action TEXT NOT NULL, -- 'cancel_subscription'
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP,
  processed_at TIMESTAMP,
  error TEXT
);
```

---

## Backend Cron Job

### File: `server/services/stripeCleanup.js`

```javascript
export function startStripeCleanup() {
  // Run immediately on startup
  processStripeCleanupQueue();

  // Then run every 5 minutes
  setInterval(() => {
    processStripeCleanupQueue();
  }, 5 * 60 * 1000);
}
```

### What It Does:

1. **Fetch pending tasks** from `stripe_cleanup_queue` (up to 50 at a time)
2. **For each task:**
   - Call `stripe.subscriptions.cancel()`
   - Mark as `processed = true`
   - Log any errors
3. **Repeat every 5 minutes**

---

## Migration 016

Adds:
- ✅ `stripe_cleanup_queue` table
- ✅ `cancel_stripe_on_user_delete()` trigger function
- ✅ Trigger on `auth.users` DELETE

Apply via Supabase SQL Editor:
```bash
# Copy contents of supabase/migrations/016_cancel_stripe_on_user_delete.sql
# Paste into Supabase Dashboard → SQL Editor → Run
```

---

## Testing

### Test User Deletion Flow:

1. **Create a test Pro user** with active Stripe subscription
2. **Delete user** from Supabase Dashboard → Authentication → Users
3. **Check queue**:
   ```sql
   SELECT * FROM stripe_cleanup_queue WHERE processed = false;
   ```
   Should see 1 pending task

4. **Wait 5 minutes** (or restart server to trigger immediately)
5. **Check queue again**:
   ```sql
   SELECT * FROM stripe_cleanup_queue WHERE processed = true;
   ```
   Should be marked as processed

6. **Verify in Stripe Dashboard**:
   - Go to Stripe Dashboard → Customers → Find customer
   - Subscription should be **Canceled**

---

## Monitoring

### Check Pending Tasks
```sql
SELECT * FROM stripe_cleanup_queue WHERE processed = false;
```

### Check Recent Errors
```sql
SELECT * FROM stripe_cleanup_queue WHERE error IS NOT NULL ORDER BY created_at DESC LIMIT 10;
```

### Check Processing Stats
```sql
SELECT
  action,
  processed,
  COUNT(*) as count
FROM stripe_cleanup_queue
GROUP BY action, processed;
```

---

## Troubleshooting

### **Queue not processing?**
1. Check server logs for `[Stripe Cleanup]` messages
2. Verify `STRIPE_SECRET_KEY` is set in environment
3. Restart server to trigger immediate processing

### **Stripe API errors?**
Common errors:
- `No such subscription` - Already cancelled manually
- `Invalid API key` - Check `STRIPE_SECRET_KEY`
- `Rate limit exceeded` - Too many requests, cron will retry

### **Manual cancellation?**
If cron fails, manually cancel in Stripe Dashboard or run:
```javascript
// In Stripe Dashboard → Developers → API Keys → Test your API
stripe.subscriptions.cancel('sub_xxxxx');
```

---

## Comparison: Other Approaches

| Approach | Pros | Cons |
|----------|------|------|
| **Queue + Cron** (Our approach) | ✅ Reliable<br>✅ Async<br>✅ Error handling | ⚠️ Slight delay (5 min) |
| **Postgres HTTP Extension** | ✅ Immediate | ❌ Complex setup<br>❌ Hard to debug |
| **Supabase Edge Function** | ✅ Built-in | ❌ Requires Supabase Pro<br>❌ Cold starts |
| **Manual Cancellation** | ✅ Simple | ❌ Easy to forget<br>❌ User gets billed |

---

## Future Improvements

- [ ] Add webhook to handle Stripe-initiated cancellations
- [ ] Send email notification when subscription is cancelled
- [ ] Add retry logic with exponential backoff
- [ ] Dashboard to view cleanup queue status
- [ ] Support for immediate vs end-of-period cancellation

---

## Summary

✅ **Before**: User deleted → Stripe subscription active → User billed
✅ **After**: User deleted → Queued → Cron cancels subscription within 5 min

This prevents unwanted billing while maintaining a clean audit trail!
