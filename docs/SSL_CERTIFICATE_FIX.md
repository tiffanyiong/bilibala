# SSL Certificate Error Fix - Stripe Cleanup Cron Job

## Problem
The Stripe cleanup cron job was failing with the following error:
```
[Stripe Cleanup] Error fetching queue: {
  message: 'TypeError: fetch failed',
  details: 'Error: certificate has expired (CERT_HAS_EXPIRED)'
}
```

This occurred when the Node.js server (running on Railway) attempted to connect to Supabase.

## Root Cause
This is typically caused by one of the following:
1. **Expired SSL certificates in the Node.js environment** - Railway's container may have outdated CA certificates
2. **Network/TLS handshake issues** - Transient network errors during SSL negotiation
3. **Railway infrastructure issues** - Temporary SSL certificate chain validation failures

## Solution Implemented

### 1. Added Retry Logic with Exponential Backoff
Modified [stripeCleanup.js](../server/services/stripeCleanup.js) to automatically retry failed Supabase queries:

- **Max retries**: 3 attempts
- **Backoff strategy**: Exponential (1s → 2s → 4s)
- **Retryable errors**: Certificate errors, network failures, timeouts

The retry logic specifically handles:
- `certificate has expired`
- `CERT_HAS_EXPIRED`
- `fetch failed`
- `ECONNRESET`
- `ETIMEDOUT`
- Generic network errors

### 2. Enhanced Error Logging
Added detailed error logging to help diagnose SSL/TLS issues:
```javascript
if (fetchError.message?.includes('certificate') || fetchError.message?.includes('CERT_')) {
  console.error('[Stripe Cleanup] SSL/TLS certificate error detected. This may be due to:');
  console.error('  - Expired SSL certificates on the server');
  console.error('  - Network/firewall blocking HTTPS connections');
  console.error('  - Railway deployment SSL certificate issues');
  console.error('  - Check SUPABASE_URL is correct and accessible');
}
```

### 3. Optimized Supabase Client Configuration
Updated [supabaseAdmin.js](../server/services/supabaseAdmin.js) to use optimal settings:
- Disabled auto-refresh tokens (not needed for server-side)
- Disabled session persistence (not needed for admin client)
- Uses native Node.js 20+ fetch with default SSL/TLS settings

## Verification Steps

### 1. Check Railway Logs
After deployment, monitor Railway logs for:
```bash
[Stripe Cleanup] Starting periodic cleanup (every 5 minutes)
[Stripe Cleanup] No pending tasks
# OR
[Stripe Cleanup] Processing X tasks
[Stripe Cleanup] Completed: X processed, 0 errors
```

### 2. Test Supabase Connection
If errors persist, verify Supabase connectivity:
```bash
# SSH into Railway container (or run locally)
curl -I https://your-project.supabase.co
```

### 3. Check Environment Variables
Ensure these are set in Railway:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your service role key (not anon key)
- `STRIPE_SECRET_KEY` - Your Stripe secret key

## Alternative Solutions (If Issue Persists)

### Option 1: Update Node.js SSL Certificate Store
Add to [railway.json](../railway.json):
```json
{
  "build": {
    "buildCommand": "npm install && npm run build"
  },
  "deploy": {
    "startCommand": "NODE_OPTIONS='--use-openssl-ca' npm start",
    "healthcheckPath": "/healthz",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Option 2: Force SSL Certificate Update (Railway)
Add a build hook to update CA certificates:
```json
{
  "build": {
    "buildCommand": "apt-get update && apt-get install -y ca-certificates && npm install && npm run build"
  }
}
```

### Option 3: Increase Retry Attempts
If the issue is intermittent, increase max retries in [stripeCleanup.js:72](../server/services/stripeCleanup.js#L72):
```javascript
const { data: pendingTasks, error: fetchError } = await retrySupabaseQuery(
  () => supabaseAdmin.from('stripe_cleanup_queue')...,
  5, // Increase from 3 to 5
  2000 // Increase base delay from 1s to 2s
);
```

### Option 4: Contact Railway Support
If none of the above work, this may be a Railway infrastructure issue. Contact support with:
- Project ID
- Timestamp of errors
- Full error logs from Railway dashboard

## Related Files
- [server/services/stripeCleanup.js](../server/services/stripeCleanup.js) - Main cleanup logic
- [server/services/supabaseAdmin.js](../server/services/supabaseAdmin.js) - Supabase client config
- [server/index.js](../server/index.js) - Cron job initialization
- [railway.json](../railway.json) - Railway deployment config

## Testing Locally
To test the cleanup cron locally:
```bash
# Set environment variables
export SUPABASE_URL=your_url
export SUPABASE_SERVICE_ROLE_KEY=your_key
export STRIPE_SECRET_KEY=your_key

# Start server
npm run dev:server

# Watch logs for cleanup activity (runs every 5 minutes)
```

## Monitoring
The cron job runs every 5 minutes. To monitor:
1. Check Railway logs for `[Stripe Cleanup]` entries
2. Query `stripe_cleanup_queue` table for unprocessed entries
3. Set up Supabase alerts for errors in the queue

## Success Criteria
✅ No SSL certificate errors in logs
✅ Pending cleanup tasks are processed within 5-10 minutes
✅ `processed_at` timestamp updates in `stripe_cleanup_queue` table
✅ Subscriptions are successfully cancelled in Stripe dashboard
