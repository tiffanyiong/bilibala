# Subscription Plan Feature - Implementation Plan

## Overview
Implement a subscription system with tiered access, payment processing, and user management.

---

## Phase 1: Requirements Clarification

### Questions to Answer Before Implementation

1. **Authentication Status**
   - [ ] Is user authentication already set up? (Google OAuth, etc.)
   - [ ] What auth provider is being used? (Supabase Auth, Firebase, etc.)

2. **Payment Provider**
   - [ ] Which payment provider? (Stripe recommended)
   - [ ] What currencies to support?
   - [ ] What regions to support?

3. **Subscription Tiers**
   - [ ] What tiers? (e.g., Free, Pro, Premium)
   - [ ] What are the price points?
   - [ ] Monthly only or also annual billing?

4. **Feature Gating**
   - [ ] Which features are free vs paid?
   - [ ] Usage limits for free tier? (e.g., X videos/month, Y practice sessions)

---

## Phase 2: Proposed Subscription Tiers

### Tier Structure (Example)

| Feature | Free | Pro ($X/mo) | Premium ($Y/mo) |
|---------|------|-------------|-----------------|
| Videos per month | 3 | Unlimited | Unlimited |
| Practice sessions | 5/month | Unlimited | Unlimited |
| AI feedback | Basic | Full | Full + Priority |
| PDF export | No | Yes | Yes |
| Video library | Last 10 | Unlimited | Unlimited |
| Priority support | No | No | Yes |

---

## Phase 3: Technical Implementation

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
  tier: 'free' | 'pro' | 'premium';
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  usage: {
    videosUsed: number;
    videosLimit: number;
    practiceSessionsUsed: number;
    practiceSessionsLimit: number;
  };
  canAddVideo: boolean;
  canStartPractice: boolean;
  canExportPdf: boolean;
  isLoading: boolean;
}

// Usage in components
const { canExportPdf, tier } = useSubscription();

if (!canExportPdf) {
  return <UpgradePrompt feature="PDF Export" />;
}
```

---

## Phase 4: Implementation Order

### Step 1: Database Setup (Day 1)
- [ ] Create subscription tables in Supabase
- [ ] Add RLS policies for security
- [ ] Create database functions for usage tracking

### Step 2: Stripe Setup (Day 1-2)
- [ ] Create Stripe account/products
- [ ] Set up price IDs
- [ ] Configure webhook endpoint

### Step 3: Backend API (Day 2-3)
- [ ] Implement checkout session creation
- [ ] Implement webhook handler
- [ ] Implement subscription status endpoint
- [ ] Implement usage tracking

### Step 4: Subscription Context (Day 3)
- [ ] Create useSubscription hook
- [ ] Add SubscriptionProvider to app
- [ ] Implement usage checking logic

### Step 5: UI Components (Day 4-5)
- [ ] Build PricingTable component
- [ ] Build SubscriptionPage
- [ ] Build UpgradeModal
- [ ] Build UsageMeter

### Step 6: Feature Gating (Day 5-6)
- [ ] Gate PDF export
- [ ] Gate video limits
- [ ] Gate practice session limits
- [ ] Add upgrade prompts

### Step 7: Testing (Day 6-7)
- [ ] Test checkout flow
- [ ] Test webhook handling
- [ ] Test subscription cancellation
- [ ] Test usage limits
- [ ] Test edge cases (expired, past_due, etc.)

---

## Phase 5: UI/UX Considerations

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

## Phase 6: Security Considerations

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

## Next Steps

1. Confirm tier structure and pricing
2. Set up Stripe account
3. Begin implementation following the phases above
