import Stripe from 'stripe';
import { config } from '../config/env.js';
import { supabaseAdmin } from './supabaseAdmin.js';

const stripe = config.stripe.secretKey
  ? new Stripe(config.stripe.secretKey)
  : null;

/**
 * Event-driven approach: Listen to database changes instead of polling
 * More efficient - only runs when a user is actually deleted
 */
export function setupStripeCleanupListener() {
  if (!stripe || !supabaseAdmin) {
    console.log('[Stripe Cleanup] Stripe or Supabase not configured');
    return;
  }

  console.log('[Stripe Cleanup] Setting up real-time listener');

  // Subscribe to new rows in stripe_cleanup_queue
  const subscription = supabaseAdmin
    .channel('stripe_cleanup_channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'stripe_cleanup_queue',
      },
      async (payload) => {
        console.log('[Stripe Cleanup] New cleanup task:', payload.new.id);
        await processTask(payload.new);
      }
    )
    .subscribe();

  console.log('[Stripe Cleanup] Real-time listener active');
}

async function processTask(task) {
  try {
    if (task.action === 'cancel_subscription' && task.stripe_subscription_id) {
      // Cancel the subscription
      await stripe.subscriptions.cancel(task.stripe_subscription_id, {
        prorate: false,
      });

      console.log(`[Stripe Cleanup] Cancelled subscription ${task.stripe_subscription_id}`);

      // Mark as processed
      await supabaseAdmin
        .from('stripe_cleanup_queue')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq('id', task.id);
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
  }
}
