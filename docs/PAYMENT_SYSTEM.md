# Payment System Documentation

## Overview

Bilibala uses Stripe for payment processing with two types of purchases:
1. **Subscriptions** (recurring) - Free and Pro tiers
2. **Credit Packs** (one-time) - Starter Pack and AI Tutor Top-up

---

## Subscription Tiers

### Free Tier
| Feature | Limit |
|---------|-------|
| Videos per month | 3 |
| Practice sessions | 5/month |
| AI Tutor | Not available |
| PDF Export | Not available |
| Video library | Last 3 videos |

### Pro Tier ($9/month or $84/year)
| Feature | Limit |
|---------|-------|
| Videos per month | Unlimited |
| Practice sessions | Unlimited |
| AI Tutor | 60 min/month |
| PDF Export | Available |
| Video library | Unlimited |

---

## Credit Packs (One-Time Purchases)

### Starter Pack - $5
- **Target:** Free tier users
- **Includes:**
  - 30 min AI Tutor credits
  - 30 practice session credits
- **Note:** Credits never expire

### AI Tutor Top-up - $3
- **Target:** Pro users who need more AI Tutor minutes
- **Includes:**
  - 30 min AI Tutor credits
- **Note:** Credits never expire, stack with monthly allowance

---

## Database Schema

### `user_subscriptions` Table

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | UUID | Primary key, links to auth.users |
| `tier` | TEXT | 'free' or 'pro' |
| `stripe_customer_id` | TEXT | Stripe customer ID (created on any purchase) |
| `stripe_subscription_id` | TEXT | Stripe subscription ID (only for Pro subscribers) |
| `subscription_status` | TEXT | 'active', 'canceled', 'trialing', 'past_due', etc. |
| `current_period_start` | TIMESTAMP | Subscription period start |
| `current_period_end` | TIMESTAMP | Subscription period end (renewal date) |
| `ai_tutor_credit_minutes` | INTEGER | Purchased AI Tutor credits (never expire) |
| `practice_session_credits` | INTEGER | Purchased practice credits (never expire) |

---

## User Scenarios & Database States

### Scenario 1: New User (Never Paid)
```
tier: 'free'
stripe_customer_id: NULL
stripe_subscription_id: NULL
subscription_status: 'active'
ai_tutor_credit_minutes: 0
practice_session_credits: 0
```

### Scenario 2: Free User → Bought Starter Pack
```
tier: 'free'                          ← stays free
stripe_customer_id: 'cus_xxx'         ← created
stripe_subscription_id: NULL          ← no subscription
subscription_status: 'active'
ai_tutor_credit_minutes: 30           ← added
practice_session_credits: 30          ← added
```

### Scenario 3: Free User → Upgraded to Pro
```
tier: 'pro'                           ← upgraded
stripe_customer_id: 'cus_xxx'
stripe_subscription_id: 'sub_xxx'     ← subscription created
subscription_status: 'active'
current_period_end: '2025-02-28'      ← renewal date
ai_tutor_credit_minutes: 0
practice_session_credits: 0
```

### Scenario 4: Pro User → Bought Top-up
```
tier: 'pro'
stripe_customer_id: 'cus_xxx'
stripe_subscription_id: 'sub_xxx'
subscription_status: 'active'
ai_tutor_credit_minutes: 30           ← added (stacks with 60 min/month)
practice_session_credits: 0
```

### Scenario 5: Pro User → Canceled Subscription
```
tier: 'free'                          ← downgraded after period ends
stripe_customer_id: 'cus_xxx'         ← kept
stripe_subscription_id: 'sub_xxx'     ← kept for records
subscription_status: 'canceled'       ← updated
ai_tutor_credit_minutes: 30           ← kept (purchased credits don't expire)
practice_session_credits: 0
```

### Scenario 6: Pro User → Bought Top-up → Then Canceled
```
tier: 'free'
stripe_customer_id: 'cus_xxx'
stripe_subscription_id: 'sub_xxx'
subscription_status: 'canceled'
ai_tutor_credit_minutes: 30           ← still available!
practice_session_credits: 0
```
**Note:** This user can still use AI Tutor with their purchased credits even on free tier.

---

## Subscription Status Values (Stripe)

| Status | Meaning | User Access |
|--------|---------|-------------|
| `active` | Paying, subscription running | Pro features |
| `trialing` | In free trial period | Pro features |
| `canceled` | User canceled, subscription ended | Free features |
| `past_due` | Payment failed, in retry period | Pro features (grace period) |
| `unpaid` | Payment failed, retries exhausted | Free features |
| `incomplete` | First payment didn't complete | Free features |

---

## Smart Sync Logic

The app includes a "smart sync" feature to handle missed webhooks. It only triggers when:

```javascript
const shouldSync =
  sub?.stripe_subscription_id &&      // Has a subscription ID (not just customer ID)
  sub?.subscription_status === 'active' && // Status shows active
  sub?.tier === 'free';               // But tier is free (mismatch!)
```

**Why these conditions?**

| Condition | Reason |
|-----------|--------|
| `stripe_subscription_id` exists | One-time purchases (Starter Pack) don't create subscription IDs |
| `subscription_status === 'active'` | Canceled subscriptions shouldn't trigger sync |
| `tier === 'free'` | Only sync if there's a mismatch |

**Scenarios that WON'T trigger sync:**
- Free user who bought Starter Pack (no `subscription_id`)
- Canceled Pro user (status is `canceled`, not `active`)
- Active Pro user (tier is already `pro`)

**Scenarios that WILL trigger sync:**
- User paid for Pro, webhook failed, database shows free but has active subscription

---

## Credit Usage Logic

### AI Tutor Minutes
1. Pro users get 60 min/month (resets monthly)
2. When using AI Tutor:
   - First, consume monthly allowance
   - When monthly exhausted, consume purchased credits
3. Credits never reset or expire

**Example:**
- Pro user has 60 min/month + 30 min credits
- Uses 70 min in a month:
  - 60 min from monthly → monthly remaining: 0
  - 10 min from credits → credits remaining: 20

### Practice Sessions (Free Tier)
1. Free users get 5/month (resets monthly)
2. When limit reached:
   - If has credits, consume 1 credit per session
   - If no credits, blocked (show upgrade modal)

---

## Webhook Events

### `checkout.session.completed`

**For Subscriptions (mode: 'subscription'):**
```javascript
{
  mode: 'subscription',
  subscription: 'sub_xxx',
  metadata: { supabase_user_id: 'uuid' }
}
// → Update tier to 'pro', save subscription_id
```

**For Credit Packs (mode: 'payment'):**
```javascript
{
  mode: 'payment',
  metadata: {
    supabase_user_id: 'uuid',
    pack_type: 'starter' | 'topup'
  }
}
// → Add credits, don't change tier
```

### `customer.subscription.updated`
- Fires when subscription status changes
- Updates `subscription_status`, `current_period_end`

### `customer.subscription.deleted`
- Fires when subscription is fully canceled (or immediately canceled for refunds)
- Updates tier to 'free', status to 'canceled'
- Clears `current_period_end` and `billing_interval` so the profile doesn't show a misleading "Access until" date

---

## Environment Variables

```bash
# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Subscription prices (recurring)
STRIPE_PRO_PRICE_ID=price_...        # Monthly $9
STRIPE_PRO_ANNUAL_PRICE_ID=price_... # Annual $84

# Credit pack prices (one-time)
STRIPE_STARTER_PACK_PRICE_ID=price_... # $5
STRIPE_TOPUP_PRICE_ID=price_...        # $3
```

---

## Testing Checklist

### Free User Tests
- [ ] Can view 3 videos
- [ ] Can do 5 practice sessions
- [ ] Cannot access AI Tutor (shows upgrade modal)
- [ ] Cannot export PDF (shows upgrade modal)
- [ ] Can buy Starter Pack
- [ ] After Starter Pack: can use AI Tutor with credits

### Pro User Tests
- [ ] Unlimited videos and practice
- [ ] 60 min/month AI Tutor
- [ ] Can export PDF
- [ ] Can buy Top-up
- [ ] Top-up credits stack with monthly allowance

### Cancellation Tests
- [ ] Canceled user keeps access until period end
- [ ] After period end, user becomes free tier
- [ ] Purchased credits remain after cancellation

### 48-Hour Refund Tests (Annual Only)
- [ ] Refunded user is immediately converted to free tier
- [ ] Profile shows "Free" with no "Access until" date
- [ ] Purchased credits (if any) remain after refund

---

## 48-Hour Money-Back Guarantee (Annual Plans Only)

First-time Annual Plan subscribers can request a full refund within **48 hours** of purchase by emailing support@bilibala.app. This does not apply to Monthly subscriptions or renewal charges.

### How to Process a Refund in Stripe

1. **Issue the refund:**
   - Go to [Stripe Dashboard → Payments](https://dashboard.stripe.com/payments)
   - Find the user's payment and click **Refund**
   - Select **Full refund**

2. **Cancel the subscription immediately:**
   - Go to [Stripe Dashboard → Subscriptions](https://dashboard.stripe.com/subscriptions)
   - Find the user's subscription and click **Cancel subscription**
   - Choose **"Immediately"** (NOT "At end of period")

3. **What happens automatically:**
   - Stripe fires a `customer.subscription.deleted` webhook
   - The webhook handler sets `tier = 'free'`, `subscription_status = 'canceled'`
   - `current_period_end` and `billing_interval` are cleared
   - The user immediately loses Pro access and sees "Free" on their profile

> **Important:** You must cancel **immediately** — not "at end of period". If you only cancel at period end, the user keeps Pro access for the rest of the year despite the refund.

### Two Types of Annual Cancellation

| Scenario | Stripe action | User sees | Access |
|----------|--------------|-----------|--------|
| **Normal cancel** (no refund) | Cancel at end of period | Amber "Canceled" badge + "Access until [date]" | Pro until period end |
| **48-hour refund** | Refund + Cancel immediately | "Free" (no date shown) | Free immediately |

### Webhook Tests
- [ ] Run `stripe listen --forward-to localhost:3001/api/subscriptions/webhook`
- [ ] Subscription purchase updates tier to 'pro'
- [ ] Credit purchase adds credits without changing tier
- [ ] Cancellation updates status correctly

---

## SQL Helpers

### Change user to free (for testing)
```sql
UPDATE public.user_subscriptions
SET tier = 'free',
    subscription_status = 'canceled',
    updated_at = now()
WHERE user_id = 'USER_UUID_HERE';
```

### Add credits manually (for testing)
```sql
UPDATE public.user_subscriptions
SET ai_tutor_credit_minutes = ai_tutor_credit_minutes + 30,
    updated_at = now()
WHERE user_id = 'USER_UUID_HERE';
```

### View user's subscription status
```sql
SELECT
  u.email,
  s.tier,
  s.subscription_status,
  s.stripe_subscription_id,
  s.ai_tutor_credit_minutes,
  s.practice_session_credits,
  s.current_period_end
FROM auth.users u
JOIN public.user_subscriptions s ON u.id = s.user_id
WHERE u.email = 'user@example.com';
```
