# Subscription Plan Feature - Implementation Plan

## Overview
Implement a subscription system with tiered access, payment processing, and user management.

---

## Cost Analysis & Research

### 1. Service Pricing (as of January 2026)

#### Gemini API Pricing
| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| Gemini 2.0 Flash (text/image) | $0.10 | $0.40 |
| Gemini 2.0 Flash (audio) | $0.70 | $0.40 |
| **Gemini Live API (audio)** | $3.00 | $12.00 |

*Source: [Google AI Pricing](https://ai.google.dev/pricing)*

#### Supadata Pricing (YouTube Transcripts)
| Plan | Credits/month | Price |
|------|--------------|-------|
| Free | 100 | $0 |
| Basic | 300 | $5/mo |
| Pro | 3,000 | $17/mo |
| Mega | 30,000 | $47/mo |

*1 credit = 1 video transcript fetch*
*Source: [Supadata Pricing](https://supadata.ai/pricing)*

#### Supabase Pricing
| Plan | Database | Storage | MAUs | Price |
|------|----------|---------|------|-------|
| Free | 500 MB | 1 GB | 50K | $0 |
| Pro | 8 GB | 100 GB | 100K | $25/mo |

*Source: [Supabase Pricing](https://supabase.com/pricing)*

#### Vercel Pricing
| Plan | Bandwidth | Price |
|------|-----------|-------|
| Hobby | 100 GB | $0 (non-commercial) |
| Pro | 1 TB | $20/user/mo |

*Source: [Vercel Pricing](https://vercel.com/pricing)*

---

### 2. Cost Per User Action

| Action | Gemini Cost | Supadata | Total Est. |
|--------|-------------|----------|------------|
| **Video Analysis (new)** | ~$0.001 | 1 credit | ~$0.001 + 1 credit |
| **Video Analysis (cached)** | $0 | 0 | ~$0 |
| **Speech Analysis** | ~$0.002-0.005 | 0 | ~$0.003 |
| **Conversation Hints** | ~$0.0002 | 0 | ~$0.0002 |
| **Video Search** | ~$0.0005 | 0 | ~$0.0005 |
| **AI Tutor (10 min live)** | ~$0.50-1.50 | 0 | **~$1.00** |

**Key Insight: AI Tutor (Live Conversation) is the most expensive feature!**
- Uses Gemini Live API with audio input ($3/1M) and audio output ($12/1M)
- A 10-minute session can cost $0.50-$1.50 depending on conversation length

---

### 3. Monthly Cost Scenarios

#### Scenario A: Light Free User
- 3 videos analyzed
- 5 practice sessions (speech analysis)
- No AI Tutor

| Item | Cost |
|------|------|
| 3 video analyses | $0.003 + 3 Supadata credits |
| 5 speech analyses | $0.015 |
| **Total** | **~$0.02** |

#### Scenario B: Active Pro User
- 10 videos analyzed
- 20 practice sessions
- 5 AI Tutor sessions (10 min each)

| Item | Cost |
|------|------|
| 10 video analyses | $0.01 + 10 Supadata credits |
| 20 speech analyses | $0.06 |
| 5 AI Tutor sessions | $5.00 |
| **Total** | **~$5.07** |

#### Scenario C: Heavy Pro User
- 30 videos analyzed
- 60 practice sessions
- 20 AI Tutor sessions (10 min each)

| Item | Cost |
|------|------|
| 30 video analyses | $0.03 + 30 Supadata credits |
| 60 speech analyses | $0.18 |
| 20 AI Tutor sessions | $20.00 |
| **Total** | **~$20.21** |

---

### 4. Fixed Monthly Costs (Infrastructure)

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Supabase | Pro | $25 |
| Vercel | Pro | $20 |
| Supadata | Pro (3,000 credits) | $17 |
| **Total Fixed** | | **$62/month** |

*Note: Can start with free tiers initially, upgrade as user base grows*

---

### 5. Pricing Recommendation

Based on cost analysis:

| Tier | Price | Your Cost/User | Margin |
|------|-------|----------------|--------|
| **Free** | $0 | ~$0.02 | Loss leader |
| **Pro** | $9-12/mo | ~$5-10 | ~$2-7 profit |
| **BYOK (future)** | $5/mo | ~$0 API cost | $5 profit |

**Recommended: $9/month for Pro** (or $7/month annual)
- Covers average user cost (~$5)
- Provides margin for infrastructure
- Competitive with market ($7-15 for language apps)

---

## Finalized Subscription Tiers

### Free Tier ($0)
| Feature | Limit | Notes |
|---------|-------|-------|
| Videos per month | 3 | New video analyses |
| Practice sessions | 5/month | Speech recording + AI feedback |
| AI Tutor | NO | Most expensive feature |
| AI feedback | YES (5 total) | Included in practice sessions |
| PDF export | NO | Pro feature |
| Video library | Up to 10 | Must remove videos to add more |

### Pro Tier ($9/month or $7/month annual)
| Feature | Limit | Notes |
|---------|-------|-------|
| Videos per month | Unlimited | |
| Practice sessions | Unlimited | |
| AI Tutor | 60 min/month | ~6 sessions × 10 min; 15 min max per session |
| AI feedback | Unlimited | |
| PDF export | YES | |
| Video library | Unlimited | |

### BYOK Tier - Future ($5/month)
| Feature | Limit | Notes |
|---------|-------|-------|
| All Pro features | Unlimited | |
| Uses user's own API key | - | User pays Gemini directly |

---

## Answers to Your Questions

### Video Library Limit (Free: Up to 10)
**Recommendation: Up to 10 is fine**
- Storage cost is minimal (Supabase)
- Encourages upgrade without being frustrating
- Users must remove existing videos to add new ones when at limit

### AI Feedback Limit (Free: 5 total)
**Recommendation: 5 per month (resets monthly)**
- Ties to the 5 practice sessions limit
- Each practice session = 1 AI feedback
- If they retry same question, still counts as 1 (per question, not per attempt)
- Alternative: 5 total ever (more restrictive, pushes upgrade faster)

---

## Technical Implementation

### 3.1 Database Schema

```sql
-- User subscriptions table
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Subscription details
  tier VARCHAR(20) NOT NULL DEFAULT 'free', -- 'free', 'pro', 'premium'
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'past_due', 'trialing'

  -- Stripe integration
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  stripe_price_id VARCHAR(255),

  -- Billing period
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,

  -- Usage tracking
  videos_used_this_period INTEGER DEFAULT 0,
  practice_sessions_this_period INTEGER DEFAULT 0,
  period_reset_date TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);

-- Usage history for analytics
CREATE TABLE usage_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- 'video_added', 'practice_session', 'pdf_export'
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.2 Backend API Endpoints

```
POST   /api/subscriptions/create-checkout    - Create Stripe checkout session
POST   /api/subscriptions/create-portal      - Create Stripe customer portal session
GET    /api/subscriptions/status             - Get current subscription status
POST   /api/subscriptions/webhook            - Stripe webhook handler

GET    /api/usage/current                    - Get current period usage
POST   /api/usage/check                      - Check if action is allowed
```

### 3.3 Stripe Integration

#### Required Stripe Setup
1. Create Stripe account (if not exists)
2. Create Products and Prices in Stripe Dashboard
3. Set up webhook endpoint
4. Configure webhook events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

#### Environment Variables
```env
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRO_PRICE_ID=price_xxx
STRIPE_PREMIUM_PRICE_ID=price_xxx
```

### 3.4 Frontend Components

#### SubscriptionPage (`src/features/subscription/`)
```
components/
  SubscriptionPage.tsx      - Main subscription management page
  PricingTable.tsx          - Display pricing tiers
  PlanCard.tsx              - Individual plan card
  CurrentPlanBadge.tsx      - Show current plan in UI
  UpgradeModal.tsx          - Upgrade prompt modal
  UsageMeter.tsx            - Show usage limits
```

#### Integration Points
- UserMenu: Link to subscription page
- Dashboard: Show upgrade prompts when hitting limits
- Video Library: Gate features based on tier
- Practice: Check usage limits before starting
- PDF Export: Check if feature is available

### 3.5 Feature Gating Logic

```typescript
// src/shared/hooks/useSubscription.ts
interface SubscriptionContext {
  tier: 'free' | 'pro';
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  usage: {
    videosUsed: number;
    videosLimit: number; // 3 for free, Infinity for pro
    practiceSessionsUsed: number;
    practiceSessionsLimit: number; // 5 for free, Infinity for pro
  };
  // Computed permissions
  canAddVideo: boolean;
  canStartPractice: boolean;
  canUseAiTutor: boolean; // Pro only
  canExportPdf: boolean; // Pro only
  isLoading: boolean;
}

// Usage in components
const { canExportPdf, canUseAiTutor, tier } = useSubscription();

if (!canExportPdf) {
  return <UpgradePrompt feature="PDF Export" requiredTier="pro" />;
}

if (!canUseAiTutor) {
  return <UpgradePrompt feature="AI Tutor" requiredTier="pro" />;
}
```

---

## Implementation Order

### Step 1: Database Setup
- [ ] Create subscription tables in Supabase
- [ ] Add RLS policies for security
- [ ] Create database functions for usage tracking

### Step 2: Stripe Setup
- [ ] Create Stripe account/products
- [ ] Set up price IDs
- [ ] Configure webhook endpoint

### Step 3: Backend API
- [ ] Implement checkout session creation
- [ ] Implement webhook handler
- [ ] Implement subscription status endpoint
- [ ] Implement usage tracking

### Step 4: Subscription Context
- [ ] Create useSubscription hook
- [ ] Add SubscriptionProvider to app
- [ ] Implement usage checking logic

### Step 5: UI Components
- [ ] Build PricingTable component
- [ ] Build SubscriptionPage
- [ ] Build UpgradeModal
- [ ] Build UsageMeter

### Step 6: Feature Gating
- [ ] Gate PDF export
- [ ] Gate video limits
- [ ] Gate practice session limits
- [ ] Add upgrade prompts

### Step 7: Testing
- [ ] Test checkout flow
- [ ] Test webhook handling
- [ ] Test subscription cancellation
- [ ] Test usage limits
- [ ] Test edge cases (expired, past_due, etc.)

---

## UI/UX Considerations

### Pricing Page Design
- Clean, Notion-style design matching app aesthetic
- Clear feature comparison table
- Highlight recommended plan
- Monthly/Annual toggle (if applicable)
- FAQ section

### Upgrade Prompts
- Non-intrusive but visible
- Show specific benefit of upgrading
- Easy one-click upgrade path
- Don't block critical actions entirely for free users

### Usage Display
- Show usage in profile/settings
- Progress bar for limits
- Warning when approaching limit
- Clear messaging when limit reached

---

## Security Considerations

- [ ] Verify webhook signatures from Stripe
- [ ] Use RLS to protect subscription data
- [ ] Never expose Stripe secret key to frontend
- [ ] Validate subscription status server-side for gated features
- [ ] Handle race conditions in usage tracking
- [ ] Log all subscription changes for audit

---

## Notes

- Start with Stripe Test Mode for development
- Consider offering a trial period for Pro tier
- Plan for handling failed payments gracefully
- Consider grandfathering early users

---

## Tier Change Behavior (Free ↔ Pro)

### What Gets Reset on Tier Changes

When a user upgrades (Free → Pro) or downgrades (Pro → Free), the system automatically resets their **monthly usage counters** to give them a fresh start with their new tier limits.

#### ✅ RESETS (Monthly Usage Counters)
These are automatically reset to 0 on any tier change:
- `video_monthly_usage` → 0
- `practice_session_monthly_usage` → 0
- `ai_tutor_monthly_minutes_used` → 0
- `usage_month` → Set to current month
- `usage_reset_at` → Set to current timestamp

**Why?** To prevent confusion and give users a clean slate with their new tier's limits.

#### ❌ DOES NOT RESET (Purchased Credits)
Purchased credits are **NEVER affected** by tier changes and remain available:
- `video_credits` (purchased video analysis credits)
- `practice_session_credits` (purchased practice session credits)
- `ai_tutor_credit_minutes` (purchased AI tutor minutes)

**Why?** Users paid for these credits, so they persist across tier changes.

#### ⏰ Daily Counters
- `practice_session_daily_usage` is NOT reset on tier change
- It continues to reset daily at UTC midnight as normal

### Examples

#### Example 1: Free → Pro Upgrade
```
Before (Free tier):
- video_monthly_usage: 2/3 used
- practice_session_daily_usage: 1/2 used today
- video_credits: 5 (purchased)

After (Pro tier):
✅ video_monthly_usage: 0/100 (reset to 0, fresh start with Pro limit)
⏰ practice_session_daily_usage: 1/2 (not reset, continues until UTC midnight)
💰 video_credits: 5 (preserved! purchased credits never expire)
```

#### Example 2: Pro → Free Downgrade
```
Before (Pro tier):
- video_monthly_usage: 45/100 used
- ai_tutor_monthly_minutes_used: 30/60 used
- practice_session_credits: 10 (purchased)

After (Free tier):
✅ video_monthly_usage: 0/3 (reset to 0, fresh start with Free limit)
✅ ai_tutor_monthly_minutes_used: 0 (reset, but free users can't use AI tutor anyway)
💰 practice_session_credits: 10 (preserved! can still use purchased credits)
```

### Implementation Details

This behavior is implemented in:
- **Stripe Webhooks** ([subscriptionRoutes.js](../server/routes/subscriptionRoutes.js))
  - `checkout.session.completed` (Free → Pro upgrade)
  - `customer.subscription.updated` (any tier change)
  - `customer.subscription.deleted` (Pro → Free downgrade)
- **Sync Endpoint** (`/api/subscriptions/sync`)
  - Manual sync also checks for tier changes and resets if needed

See [Migration 018](migrations/018_daily_practice_limit.md) and [Migration 019](migrations/019_billing_cycle_reset_for_pro.md) for more details.

---

## Next Steps

1. Confirm tier structure and pricing
2. Set up Stripe account
3. Begin implementation following the phases above
