-- Remove legacy columns from user_subscriptions that are no longer used
-- monthly_usage_count / usage_reset_month: replaced by usage_history table + get_all_monthly_usage()
-- credits_balance: replaced by ai_tutor_credit_minutes, practice_session_credits, video_credits

ALTER TABLE public.user_subscriptions DROP COLUMN IF EXISTS monthly_usage_count;
ALTER TABLE public.user_subscriptions DROP COLUMN IF EXISTS usage_reset_month;
ALTER TABLE public.user_subscriptions DROP COLUMN IF EXISTS credits_balance;

-- Also drop the legacy SQL functions that used these columns
DROP FUNCTION IF EXISTS public.check_and_increment_user_usage(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_user_usage(UUID, TEXT);
