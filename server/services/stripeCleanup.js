import Stripe from 'stripe';
import { config } from '../config/env.js';
import { supabaseAdmin } from './supabaseAdmin.js';

const stripe = config.stripe.secretKey
  ? new Stripe(config.stripe.secretKey)
  : null;

/**
 * Retry a Supabase query with exponential backoff
 * Handles transient SSL/network errors that may occur on Railway
 */
async function retrySupabaseQuery(queryFn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await queryFn();

      // Supabase returns errors in the response, not as exceptions
      if (result.error) {
        const errorMessage = result.error.message || JSON.stringify(result.error);

        // Check if it's a retryable error (SSL, network, timeout)
        const isRetryable =
          errorMessage.includes('certificate') ||
          errorMessage.includes('CERT_') ||
          errorMessage.includes('fetch failed') ||
          errorMessage.includes('ECONNRESET') ||
          errorMessage.includes('ETIMEDOUT') ||
          errorMessage.includes('network');

        if (isRetryable && attempt < maxRetries) {
          lastError = result.error;
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`[Stripe Cleanup] Retry ${attempt}/${maxRetries} after ${delay}ms due to: ${errorMessage}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      return result;
    } catch (error) {
      // Handle actual exceptions (rare with Supabase client)
      lastError = error;
      if (attempt === maxRetries) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`[Stripe Cleanup] Retry ${attempt}/${maxRetries} after ${delay}ms due to exception: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // If all retries failed, return the last error response
  return { data: null, error: lastError };
}

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
    // Get pending cleanup tasks with retry logic for transient SSL errors
    const { data: pendingTasks, error: fetchError } = await retrySupabaseQuery(
      () => supabaseAdmin
        .from('stripe_cleanup_queue')
        .select('*')
        .eq('processed', false)
        .order('created_at', { ascending: true })
        .limit(50), // Process 50 at a time
      3, // max retries
      1000 // base delay 1s
    );

    if (fetchError) {
      console.error('[Stripe Cleanup] Error fetching queue:', {
        message: fetchError.message || 'Unknown error',
        details: fetchError.details || '',
        hint: fetchError.hint || '',
        code: fetchError.code || '',
      });

      // If it's a certificate error, log additional details
      if (fetchError.message?.includes('certificate') || fetchError.message?.includes('CERT_')) {
        console.error('[Stripe Cleanup] SSL/TLS certificate error detected. This may be due to:');
        console.error('  - Expired SSL certificates on the server');
        console.error('  - Network/firewall blocking HTTPS connections');
        console.error('  - Railway deployment SSL certificate issues');
        console.error('  - Check SUPABASE_URL is correct and accessible');
      }

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
          await stripe.subscriptions.cancel(
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
