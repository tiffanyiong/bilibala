# Stripe Local Development Setup

## Prerequisites
- Stripe account (test mode): https://dashboard.stripe.com
- Stripe CLI installed locally

---

## Step 1: Create a Stripe Account

1. Go to https://dashboard.stripe.com and sign up / sign in
2. Make sure you're in **Test mode** (toggle at the top right of the dashboard)

---

## Step 2: Get Your API Secret Key

1. In Stripe Dashboard, go to **Developers** > **API keys**
2. Copy the **Secret key** — it starts with `sk_test_`
3. Add it to `.env.local`:
   ```
   STRIPE_SECRET_KEY=sk_test_your_key_here
   ```

---

## Step 3: Create the "Bilibala Pro" Product & Get Price IDs

1. In Stripe Dashboard, go to **Products** > **Add Product**
2. Fill in:
   - **Name**: Bilibala Pro
   - **Description**: (optional) Pro subscription for Bilibala
3. Under **Price information**, add the **monthly** price:
   - Pricing model: Standard
   - Price: **$9.00**
   - Billing period: **Monthly** (Recurring)
   - Click **Add product** (or **Save**)
4. After creating, click into the product. In the **Pricing** section, you'll see the price row. The **API ID** column shows the Price ID starting with `price_` — copy it.
5. Add another price for **annual**:
   - Click **Add another price** on the same product
   - Price: **$84.00**
   - Billing period: **Yearly** (Recurring)
   - Save, then copy that `price_` ID too

   > **Important**: You need the `price_` IDs (e.g. `price_1Abc123...`), NOT the `prod_` product IDs.

6. Add both to `.env.local`:
   ```
   STRIPE_PRO_PRICE_ID=price_your_monthly_price_id
   STRIPE_PRO_ANNUAL_PRICE_ID=price_your_annual_price_id
   ```

---

## Step 4: Install Stripe CLI (macOS, no Xcode needed)

Homebrew may fail if Xcode is outdated. Use the direct binary download instead:

```bash
# Download binary directly (skip Homebrew)
curl -L "https://github.com/stripe/stripe-cli/releases/download/v1.34.0/stripe_1.34.0_mac-os_arm64.tar.gz" -o /tmp/stripe.tar.gz
tar -xzf /tmp/stripe.tar.gz -C /tmp
sudo cp /tmp/stripe /usr/local/bin/stripe

# Verify installation
stripe version
```

---

## Step 5: Login to Stripe CLI

```bash
stripe login
```

This opens a browser window to authenticate with your Stripe account. Follow the prompts and confirm.

---

## Step 6: Run the Stripe Webhook Listener

```bash
stripe listen --forward-to localhost:3001/api/subscriptions/webhook
```

When it starts, it prints something like:
```
> Ready! Your webhook signing secret is whsec_abc123def456... (^C to quit)
```

Copy that `whsec_...` value and add it to `.env.local`:
```
STRIPE_WEBHOOK_SECRET=whsec_your_signing_secret_here
```

**Keep this terminal running** while you test. The listener forwards Stripe events to your local server.

---

## Step 7: Run the SQL Migration

Before testing, you need the `usage_history` table and helper functions in Supabase:

1. Open your **Supabase Dashboard** > **SQL Editor**
2. Copy the contents of `supabase/migrations/001_usage_history.sql`
3. Paste and run it

This creates:
- `usage_history` table with RLS policies
- `get_monthly_usage_count()` and `get_all_monthly_usage()` PostgreSQL functions
- RLS policies for `user_subscriptions` table

---

## Step 8: Start the App

You need 3 terminals running simultaneously:

### Terminal 1: Stripe webhook listener (from Step 6)
```bash
stripe listen --forward-to localhost:3001/api/subscriptions/webhook
```

### Terminal 2: Backend server
```bash
npm run server
```

### Terminal 3: Frontend dev server
```bash
npm run dev
```

---

## Step 9: Test the Checkout Flow

1. Open the app in your browser (e.g. `http://localhost:5173`)
2. **Sign in** to your account
3. Click your **avatar** (top right) > **Subscription Plan**
4. Choose **Monthly** or **Annual**, then click **Upgrade to Pro**
5. Stripe Checkout page opens. Use the test card:
   - Card number: `4242 4242 4242 4242`
   - Expiry: any future date (e.g. `12/30`)
   - CVC: any 3 digits (e.g. `123`)
   - Name & address: anything
6. Click **Subscribe** / **Pay**
7. You should be redirected back to the app with a success banner
8. Check your `stripe listen` terminal — you should see events like:
   ```
   --> checkout.session.completed [evt_...]
   --> customer.subscription.created [evt_...]
   ```
9. Check your Supabase `user_subscriptions` table — the user's `tier` should now be `pro`

---

## Environment Variables Summary

All env vars go in `.env.local` (root of project). The server loads from `.env.local` first, then falls back to `server/.env`.

| Variable | Where to find it | Example |
|---|---|---|
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API > service_role key | `eyJhbG...` |
| `STRIPE_SECRET_KEY` | Stripe > Developers > API keys > Secret key | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Output of `stripe listen` command | `whsec_...` |
| `STRIPE_PRO_PRICE_ID` | Stripe > Products > Bilibala Pro > Monthly price API ID | `price_...` |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | Stripe > Products > Bilibala Pro > Annual price API ID | `price_...` |

---

## Test Cards Reference

| Card Number | Behavior |
|---|---|
| `4242 4242 4242 4242` | Payment succeeds |
| `4000 0000 0000 3220` | Requires 3D Secure authentication |
| `4000 0000 0000 9995` | Payment fails (insufficient funds) |
| `4000 0000 0000 0341` | Payment fails (card declined) |

---

## Troubleshooting

### "Not configured" error when clicking Upgrade
- Make sure all Stripe env vars are set in `.env.local`
- Restart the backend server after changing env vars

### Webhook events not reaching server
- Make sure `stripe listen` is running and shows "Ready!"
- Make sure the `STRIPE_WEBHOOK_SECRET` in `.env.local` matches the one from `stripe listen`
- The webhook secret changes every time you restart `stripe listen` — update `.env.local` and restart the server if needed

### Subscription not updating in Supabase after checkout
- Check the `stripe listen` terminal for errors (red lines)
- Check the backend server terminal for error logs
- Verify the SQL migration has been run (the `usage_history` table and RLS policies must exist)

### "No such price" error
- Make sure you're using `price_` IDs, not `prod_` IDs
- Verify the prices exist in your Stripe Dashboard under the product

---

## Resetting a User to Free Tier (for testing)

After testing a subscription, the user stays on Pro. To reset back to free for re-testing:

### Option 1: SQL in Supabase
Run this in **Supabase Dashboard > SQL Editor**:

```sql
UPDATE public.user_subscriptions
SET tier = 'free',
    subscription_status = 'canceled',
    stripe_subscription_id = NULL,
    updated_at = now()
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL_HERE');
```

Replace `YOUR_EMAIL_HERE` with the test user's email.

### Option 2: Cancel in Stripe Dashboard
1. Go to Stripe Dashboard > **Subscriptions**
2. Find the test subscription
3. Click **Cancel subscription** > **Cancel immediately**
4. The webhook will fire and downgrade the user in Supabase automatically

After either option, refresh the app — the user will be back on the free tier and can test the upgrade flow again.
