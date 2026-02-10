-- Add billing_interval column to distinguish monthly vs annual subscriptions
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS billing_interval text DEFAULT 'month';

-- Add a comment for documentation
COMMENT ON COLUMN public.user_subscriptions.billing_interval IS 'Stripe billing interval: month or year';
