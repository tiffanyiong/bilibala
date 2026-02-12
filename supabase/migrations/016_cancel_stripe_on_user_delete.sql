-- Migration 016: Cancel Stripe Subscription on User Delete
-- Purpose: Trigger webhook to cancel Stripe subscription when user is deleted

SET search_path = public;

-- ============================================
-- Step 1: Create cleanup queue table FIRST
-- ============================================
CREATE TABLE IF NOT EXISTS public.stripe_cleanup_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  action TEXT NOT NULL, -- 'cancel_subscription', 'delete_customer'
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_stripe_cleanup_queue_processed
  ON public.stripe_cleanup_queue(processed)
  WHERE processed = FALSE;

-- ============================================
-- Step 2: Function to queue Stripe cancellation when user is deleted
-- ============================================
CREATE OR REPLACE FUNCTION public.cancel_stripe_on_user_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stripe_subscription_id TEXT;
  v_stripe_customer_id TEXT;
BEGIN
  -- Get Stripe IDs before deletion
  SELECT stripe_subscription_id, stripe_customer_id
  INTO v_stripe_subscription_id, v_stripe_customer_id
  FROM public.user_subscriptions
  WHERE user_id = OLD.id;

  -- Log the deletion for manual Stripe cleanup
  -- Note: Can't call Stripe API directly from Postgres
  -- Instead, log to a cleanup table for backend cron job
  IF v_stripe_subscription_id IS NOT NULL THEN
    INSERT INTO public.stripe_cleanup_queue (
      user_id,
      stripe_customer_id,
      stripe_subscription_id,
      action,
      created_at
    ) VALUES (
      OLD.id,
      v_stripe_customer_id,
      v_stripe_subscription_id,
      'cancel_subscription',
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN OLD;
END;
$$;

-- ============================================
-- Step 3: Trigger - Before user is deleted, queue Stripe cleanup
-- ============================================
DROP TRIGGER IF EXISTS trigger_cancel_stripe_on_user_delete ON auth.users;

CREATE TRIGGER trigger_cancel_stripe_on_user_delete
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.cancel_stripe_on_user_delete();

-- ============================================
-- Step 4: Comments
-- ============================================
COMMENT ON TABLE public.stripe_cleanup_queue IS 'Queue for Stripe subscriptions to cancel when users are deleted. Processed by backend cron job.';
COMMENT ON FUNCTION public.cancel_stripe_on_user_delete IS 'Queues Stripe subscription cancellation before user deletion';
