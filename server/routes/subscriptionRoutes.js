import express from 'express';
import Stripe from 'stripe';
import { config } from '../config/env.js';
import { supabaseAdmin, getUserFromToken } from '../services/supabaseAdmin.js';
import { getAllConfig, getConfigNumber } from '../services/configService.js';

const router = express.Router();

// Initialize Stripe
const stripe = config.stripe.secretKey
  ? new Stripe(config.stripe.secretKey)
  : null;

// ============================================
// POST /api/subscriptions/create-checkout
// Create a Stripe Checkout session for Pro subscription
// ============================================
router.post('/subscriptions/create-checkout', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { priceType = 'monthly' } = req.body;
    const priceId = priceType === 'annual'
      ? config.stripe.proAnnualPriceId
      : config.stripe.proPriceId;

    if (!priceId) {
      return res.status(500).json({ error: 'Stripe price ID not configured' });
    }

    // Check if user already has a Stripe customer ID
    const { data: subscription } = await supabaseAdmin
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    let customerId = subscription?.stripe_customer_id;

    // Create or retrieve Stripe customer
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID
      await supabaseAdmin
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          tier: 'free',
        }, { onConflict: 'user_id' });
    }

    // Create checkout session
    const origin = req.body?.origin || req.headers.origin || 'http://localhost:3000';
    console.log('[Pro Checkout] Origin detection:', {
      bodyOrigin: req.body?.origin,
      headerOrigin: req.headers.origin,
      finalOrigin: origin,
      successUrl: `${origin}/subscription?success=true`,
    });
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/subscription?success=true`,
      cancel_url: `${origin}/subscription?canceled=true`,
      metadata: {
        supabase_user_id: user.id,
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ============================================
// POST /api/subscriptions/create-credit-checkout
// Create a Stripe Checkout session for credit pack purchase (one-time payment)
// ============================================
router.post('/subscriptions/create-credit-checkout', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { packType = 'starter' } = req.body; // 'starter' or 'topup'

    // Determine price ID based on pack type
    let priceId;
    if (packType === 'topup') {
      priceId = config.stripe.topupPriceId;
    } else {
      priceId = config.stripe.starterPackPriceId;
    }

    if (!priceId) {
      return res.status(500).json({ error: `Stripe price ID for ${packType} not configured` });
    }

    // For topup, verify user is Pro (optional: you can allow anyone to buy credits)
    if (packType === 'topup') {
      const { data: subscription } = await supabaseAdmin
        .from('user_subscriptions')
        .select('tier')
        .eq('user_id', user.id)
        .single();

      if (subscription?.tier !== 'pro') {
        return res.status(400).json({ error: 'Top-up is only available for Pro users. Use Starter Pack instead.' });
      }
    }

    // Check if user already has a Stripe customer ID
    const { data: subscription } = await supabaseAdmin
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    let customerId = subscription?.stripe_customer_id;

    // Create or retrieve Stripe customer
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID
      await supabaseAdmin
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          tier: 'free',
        }, { onConflict: 'user_id' });
    }

    // Create checkout session for one-time payment
    const origin = req.body?.origin || req.headers.origin || 'http://localhost:3000';
    console.log('[Credit Checkout] Origin detection:', {
      bodyOrigin: req.body?.origin,
      headerOrigin: req.headers.origin,
      finalOrigin: origin,
      successUrl: `${origin}/subscription?credit_success=true&pack=${packType}`,
    });
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment', // One-time payment, not subscription
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/subscription?credit_success=true&pack=${packType}`,
      cancel_url: `${origin}/subscription?canceled=true`,
      metadata: {
        supabase_user_id: user.id,
        pack_type: packType, // 'starter' or 'topup'
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating credit checkout session:', error);
    res.status(500).json({ error: 'Failed to create credit checkout session' });
  }
});

// ============================================
// POST /api/subscriptions/create-portal
// Create a Stripe Customer Portal session (manage billing)
// ============================================
router.post('/subscriptions/create-portal', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: subscription } = await supabaseAdmin
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (!subscription?.stripe_customer_id) {
      return res.status(400).json({ error: 'No billing account found' });
    }

    const origin = req.body?.origin || req.headers.origin || 'http://localhost:5173';
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${origin}/subscription`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// ============================================
// GET /api/subscriptions/status
// Get current subscription status
// ============================================
router.get('/subscriptions/status', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { data: subscription, error } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error?.code === 'PGRST116' || !subscription) {
      // No subscription found - return default free tier
      return res.json({
        tier: 'free',
        status: 'active',
        currentPeriodEnd: null,
        aiTutorCreditMinutes: 0,
        practiceSessionCredits: 0,
      });
    }

    if (error) {
      throw error;
    }

    res.json({
      tier: subscription.tier,
      status: subscription.subscription_status || 'active',
      currentPeriodEnd: subscription.current_period_end,
      stripeCustomerId: subscription.stripe_customer_id,
      aiTutorCreditMinutes: subscription.ai_tutor_credit_minutes || 0,
      practiceSessionCredits: subscription.practice_session_credits || 0,
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({ error: 'Failed to fetch subscription status' });
  }
});

// ============================================
// POST /api/subscriptions/sync
// Sync subscription status directly from Stripe
// (Fallback for missed webhooks)
// ============================================
router.post('/subscriptions/sync', async (req, res) => {
  try {
    if (!stripe || !supabaseAdmin) {
      return res.status(500).json({ error: 'Not configured' });
    }

    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's Stripe customer ID from database
    const { data: userSub } = await supabaseAdmin
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (!userSub?.stripe_customer_id) {
      return res.json({ synced: false, message: 'No Stripe customer found' });
    }

    // Fetch active subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: userSub.stripe_customer_id,
      status: 'all',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      // No subscription found in Stripe - ensure user is on free tier
      await supabaseAdmin
        .from('user_subscriptions')
        .update({
          tier: 'free',
          subscription_status: 'none',
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      return res.json({ synced: true, tier: 'free', status: 'none' });
    }

    // Get the most recent subscription
    const subscription = subscriptions.data[0];
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';

    // Safely convert timestamps (handle null/undefined)
    const periodStart = subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000).toISOString()
      : null;
    const periodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;

    // Update database with current Stripe status
    const billingInterval = subscription.items?.data?.[0]?.plan?.interval || 'month';
    const updateData = {
      tier: isActive ? 'pro' : 'free',
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      billing_interval: billingInterval,
      updated_at: new Date().toISOString(),
    };
    if (periodStart) updateData.current_period_start = periodStart;
    if (periodEnd) updateData.current_period_end = periodEnd;

    await supabaseAdmin
      .from('user_subscriptions')
      .update(updateData)
      .eq('user_id', user.id);

    console.log('[Sync] Updated subscription for user:', user.id, { tier: isActive ? 'pro' : 'free', status: subscription.status });

    res.json({
      synced: true,
      tier: isActive ? 'pro' : 'free',
      status: subscription.status,
      currentPeriodEnd: periodEnd,
    });
  } catch (error) {
    console.error('Error syncing subscription:', error);
    res.status(500).json({ error: 'Failed to sync subscription' });
  }
});

// ============================================
// GET /api/config/app
// Return public app configuration (no auth required)
// ============================================
router.get('/config/app', (_req, res) => {
  res.json(getAllConfig());
});

// ============================================
// POST /api/subscriptions/webhook
// Stripe webhook handler
// ============================================
router.post('/subscriptions/webhook', async (req, res) => {
  if (!stripe || !supabaseAdmin) {
    return res.status(500).json({ error: 'Not configured' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      config.stripe.webhookSecret
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.supabase_user_id;
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;
        const customerId = typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id;
        const packType = session.metadata?.pack_type; // 'starter' or 'topup' for credit purchases

        console.log('[Webhook] checkout.session.completed', { userId, subscriptionId, customerId, mode: session.mode, packType });

        // Handle one-time credit pack purchase
        if (session.mode === 'payment' && userId && packType) {
          try {
            // Determine credits to add based on pack type (from config)
            let aiTutorMinutesToAdd = 0;
            let practiceSessionsToAdd = 0;
            let videoCreditsToAdd = 0;

            if (packType === 'starter') {
              // Starter Pack credits from config
              videoCreditsToAdd = getConfigNumber('starter_pack_video_credits', 15);
              aiTutorMinutesToAdd = getConfigNumber('starter_pack_ai_tutor_minutes', 30);
              practiceSessionsToAdd = getConfigNumber('starter_pack_practice_sessions', 30);
            } else if (packType === 'topup') {
              // Top-up credits from config
              videoCreditsToAdd = getConfigNumber('topup_video_credits', 10);
              aiTutorMinutesToAdd = getConfigNumber('topup_ai_tutor_minutes', 15);
            }

            // Add credits using the database function
            const { error: rpcError } = await supabaseAdmin.rpc('add_credits', {
              p_user_id: userId,
              p_ai_tutor_minutes: aiTutorMinutesToAdd,
              p_practice_sessions: practiceSessionsToAdd,
              p_video_credits: videoCreditsToAdd,
            });

            if (rpcError) {
              console.error('[Webhook] Error adding credits via RPC:', rpcError);
              // Fallback: direct update (note: this doesn't increment, just sets)
              await supabaseAdmin
                .from('user_subscriptions')
                .upsert({
                  user_id: userId,
                  stripe_customer_id: customerId,
                  tier: 'free', // Don't change tier for credit purchase
                  ai_tutor_credit_minutes: aiTutorMinutesToAdd,
                  practice_session_credits: practiceSessionsToAdd,
                  video_credits: videoCreditsToAdd,
                  updated_at: new Date().toISOString(),
                }, {
                  onConflict: 'user_id',
                });
            } else {
              console.log('[Webhook] Successfully added credits:', { userId, packType, videoCreditsToAdd, aiTutorMinutesToAdd, practiceSessionsToAdd });
            }
          } catch (err) {
            console.error('[Webhook] Error processing credit purchase:', err.message);
          }
          break;
        }

        // Handle subscription checkout (existing logic)
        if (userId && subscriptionId) {
          try {
            const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
            const billingInterval = stripeSubscription.items?.data?.[0]?.plan?.interval || 'month';
            const periodStart = new Date(stripeSubscription.current_period_start * 1000).toISOString();
            const periodEnd = new Date(stripeSubscription.current_period_end * 1000).toISOString();

            console.log('[Webhook] checkout subscription data:', {
              userId,
              subscriptionId,
              billingInterval,
              periodStart,
              periodEnd,
              rawStart: stripeSubscription.current_period_start,
              rawEnd: stripeSubscription.current_period_end,
            });

            // Use update first (row should already exist from signup trigger)
            const { data: updateData, error: updateError } = await supabaseAdmin
              .from('user_subscriptions')
              .update({
                tier: 'pro',
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                subscription_status: 'active',
                billing_interval: billingInterval,
                current_period_start: periodStart,
                current_period_end: periodEnd,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId)
              .select();

            if (updateError) {
              console.error('[Webhook] Update failed, trying upsert:', updateError);
              const { error: upsertError } = await supabaseAdmin
                .from('user_subscriptions')
                .upsert({
                  user_id: userId,
                  tier: 'pro',
                  stripe_customer_id: customerId,
                  stripe_subscription_id: subscriptionId,
                  subscription_status: 'active',
                  billing_interval: billingInterval,
                  current_period_start: periodStart,
                  current_period_end: periodEnd,
                  updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id' });

              if (upsertError) {
                console.error('[Webhook] Upsert also failed:', upsertError);
              }
            } else {
              console.log('[Webhook] Successfully upgraded user to pro:', userId, 'rows affected:', updateData?.length);
            }
          } catch (err) {
            console.error('[Webhook] Error processing checkout:', err.message);
          }
        } else {
          console.warn('[Webhook] checkout.session.completed missing userId or subscriptionId:', { userId, subscriptionId });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Find user by Stripe customer ID
        let { data: userSub } = await supabaseAdmin
          .from('user_subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();

        // Fallback: look up via Stripe customer metadata (handles race condition
        // where customer.subscription.created fires before checkout.session.completed
        // has saved the stripe_customer_id)
        if (!userSub && stripe) {
          try {
            const customer = await stripe.customers.retrieve(customerId);
            const metaUserId = customer?.metadata?.supabase_user_id;
            if (metaUserId) {
              // Save the stripe_customer_id so future lookups work
              await supabaseAdmin
                .from('user_subscriptions')
                .update({ stripe_customer_id: customerId })
                .eq('user_id', metaUserId);
              userSub = { user_id: metaUserId };
              console.log('[Webhook] Resolved user via Stripe customer metadata:', metaUserId);
            }
          } catch (err) {
            console.error('[Webhook] Error looking up Stripe customer:', err.message);
          }
        }

        if (userSub) {
          const isActive = subscription.status === 'active' || subscription.status === 'trialing';
          const billingInterval = subscription.items?.data?.[0]?.plan?.interval || 'month';
          const periodStart = new Date(subscription.current_period_start * 1000).toISOString();
          const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

          console.log(`[Webhook] ${event.type} - updating user:`, userSub.user_id, {
            isActive, billingInterval, periodStart, periodEnd,
            rawStart: subscription.current_period_start,
            rawEnd: subscription.current_period_end,
          });

          const { data: updateData, error: updateError } = await supabaseAdmin
            .from('user_subscriptions')
            .update({
              tier: isActive ? 'pro' : 'free',
              subscription_status: subscription.status,
              billing_interval: billingInterval,
              current_period_start: periodStart,
              current_period_end: periodEnd,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userSub.user_id)
            .select();

          if (updateError) {
            console.error('[Webhook] Error updating subscription:', updateError);
          } else {
            console.log(`[Webhook] ${event.type} - updated user:`, userSub.user_id, 'rows:', updateData?.length, 'period_end:', updateData?.[0]?.current_period_end);
          }
        } else {
          console.warn(`[Webhook] ${event.type} - could not find user for customer:`, customerId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { data: userSub } = await supabaseAdmin
          .from('user_subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (userSub) {
          await supabaseAdmin
            .from('user_subscriptions')
            .update({
              tier: 'free',
              subscription_status: 'canceled',
              current_period_end: null,
              billing_interval: null,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userSub.user_id);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        const { data: userSub } = await supabaseAdmin
          .from('user_subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (userSub) {
          await supabaseAdmin
            .from('user_subscriptions')
            .update({
              subscription_status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userSub.user_id);
        }
        break;
      }

      default:
        // Unhandled event type
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

export default router;
