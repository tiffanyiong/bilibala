import Stripe from 'stripe';
import { config } from '../config/env.js';
import { supabaseAdmin } from './supabaseAdmin.js';

const stripe = config.stripe.secretKey
  ? new Stripe(config.stripe.secretKey)
  : null;

/**
 * Process Stripe cleanup queue - cancels subscriptions for deleted users
 * Should be run periodically via cron job
 */
export async function processStripeCleanupQueue() {
  if (!stripe || !supabaseAdmin) {
    console.error('[Stripe Cleanup] Stripe or Supabase not configured');
    return { processed: 0, errors: 0 };
  }

  try {
    // Get pending cleanup tasks
    const { data: pendingTasks, error: fetchError } = await supabaseAdmin
      .from('stripe_cleanup_queue')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(50); // Process 50 at a time

    if (fetchError) {
      console.error('[Stripe Cleanup] Error fetching queue:', fetchError);
      return { processed: 0, errors: 1 };
    }

    if (!pendingTasks || pendingTasks.length === 0) {
      console.log('[Stripe Cleanup] No pending tasks');
      return { processed: 0, errors: 0 };
    }

    console.log(`[Stripe Cleanup] Processing ${pendingTasks.length} tasks`);

    let processedCount = 0;
    let errorCount = 0;

    for (const task of pendingTasks) {
      try {
        if (task.action === 'cancel_subscription' && task.stripe_subscription_id) {
          // Cancel the subscription
          const subscription = await stripe.subscriptions.cancel(
            task.stripe_subscription_id,
            {
              // Cancel immediately, no proration
              prorate: false,
            }
          );

          console.log(`[Stripe Cleanup] Cancelled subscription ${task.stripe_subscription_id} for deleted user ${task.user_id}`);

          // Mark as processed
          await supabaseAdmin
            .from('stripe_cleanup_queue')
            .update({
              processed: true,
              processed_at: new Date().toISOString(),
            })
            .eq('id', task.id);

          processedCount++;
        } else if (task.action === 'delete_customer' && task.stripe_customer_id) {
          // Delete the customer (optional - usually keep for records)
          await stripe.customers.del(task.stripe_customer_id);

          console.log(`[Stripe Cleanup] Deleted customer ${task.stripe_customer_id}`);

          await supabaseAdmin
            .from('stripe_cleanup_queue')
            .update({
              processed: true,
              processed_at: new Date().toISOString(),
            })
            .eq('id', task.id);

          processedCount++;
        }
      } catch (error) {
        console.error(`[Stripe Cleanup] Error processing task ${task.id}:`, error.message);

        // Mark error
        await supabaseAdmin
          .from('stripe_cleanup_queue')
          .update({
            error: error.message,
          })
          .eq('id', task.id);

        errorCount++;
      }
    }

    console.log(`[Stripe Cleanup] Completed: ${processedCount} processed, ${errorCount} errors`);
    return { processed: processedCount, errors: errorCount };
  } catch (error) {
    console.error('[Stripe Cleanup] Fatal error:', error);
    return { processed: 0, errors: 1 };
  }
}

/**
 * Start periodic Stripe cleanup (runs every 5 minutes)
 */
export function startStripeCleanup() {
  if (!stripe) {
    console.log('[Stripe Cleanup] Stripe not configured, cleanup disabled');
    return;
  }

  console.log('[Stripe Cleanup] Starting periodic cleanup (every 5 minutes)');

  // Run immediately on startup
  processStripeCleanupQueue();

  // Then run every 5 minutes
  setInterval(() => {
    processStripeCleanupQueue();
  }, 5 * 60 * 1000); // 5 minutes
}
