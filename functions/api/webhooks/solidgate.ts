/**
 * Solidgate Webhook Handler
 *
 * POST /api/webhooks/solidgate
 *
 * Handles payment and subscription events from Solidgate:
 * - payment.success - Payment successful
 * - subscription.created - New subscription
 * - subscription.renewed - Subscription renewed
 * - subscription.canceled - Subscription canceled
 * - subscription.expired - Subscription expired
 * - refund.success - Refund processed
 */

import { createCacheLayer } from '../../../lib/cache';
import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  SOLIDGATE_WEBHOOK_SECRET: string;
}

interface SolidgateWebhookPayload {
  event: string;
  order: {
    order_id: string;
    status: string;
    amount: number;
    currency: string;
    customer: {
      email: string;
      [key: string]: any;
    };
    subscription?: {
      id: string;
      status: string;
      plan_id: string;
      current_period_start: number;
      current_period_end: number;
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Verify Solidgate webhook signature using Web Crypto API
 */
async function verifySignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    // Convert secret string to Uint8Array
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);

    // Import the secret as a CryptoKey for HMAC
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Sign the payload
    const payloadData = encoder.encode(payload);
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, payloadData);

    // Convert signature to hex string
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const expectedSignature = signatureArray
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return signature === expectedSignature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    // Get raw body and signature
    const body = await request.text();
    const signature = request.headers.get('x-solidgate-signature');

    if (!signature) {
      return new Response('Missing signature', { status: 401 });
    }

    // Verify webhook signature
    if (!verifySignature(body, signature, env.SOLIDGATE_WEBHOOK_SECRET)) {
      console.error('Invalid webhook signature');
      return new Response('Invalid signature', { status: 401 });
    }

    const payload: SolidgateWebhookPayload = JSON.parse(body);
    const cache = createCacheLayer(env.CACHE);

    // Log webhook event
    await env.DB.prepare(
      `INSERT INTO webhook_events (id, provider, event_type, payload, processed, created_at)
       VALUES (?, ?, ?, ?, ?, unixepoch())`
    )
      .bind(
        crypto.randomUUID(),
        'solidgate',
        payload.event,
        body,
        0 // Not processed yet
      )
      .run();

    // Handle different event types
    switch (payload.event) {
      case 'payment.success':
        await handlePaymentSuccess(payload, env, cache);
        break;

      case 'subscription.created':
        await handleSubscriptionCreated(payload, env, cache);
        break;

      case 'subscription.renewed':
        await handleSubscriptionRenewed(payload, env, cache);
        break;

      case 'subscription.canceled':
        await handleSubscriptionCanceled(payload, env, cache);
        break;

      case 'subscription.expired':
        await handleSubscriptionExpired(payload, env, cache);
        break;

      case 'refund.success':
        await handleRefundSuccess(payload, env, cache);
        break;

      default:
        console.log(`Unhandled event type: ${payload.event}`);
    }

    // Mark webhook as processed
    await env.DB.prepare(
      `UPDATE webhook_events SET processed = 1 WHERE payload = ?`
    )
      .bind(body)
      .run();

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);

    return new Response(
      JSON.stringify({
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

/**
 * Handle successful payment
 */
async function handlePaymentSuccess(
  payload: SolidgateWebhookPayload,
  env: Env,
  cache: ReturnType<typeof createCacheLayer>
) {
  const { order } = payload;

  // Find user by email
  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(order.customer.email)
    .first();

  if (!user) {
    console.error('User not found for payment:', order.customer.email);
    return;
  }

  // Record payment transaction
  await env.DB.prepare(
    `INSERT INTO payment_transactions
     (id, user_id, amount, currency, provider, provider_transaction_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())`
  )
    .bind(
      crypto.randomUUID(),
      user.id,
      order.amount,
      order.currency,
      'solidgate',
      order.order_id,
      'completed'
    )
    .run();

  // Invalidate user subscription cache
  await cache.subscriptions.invalidateUserSubscription(user.id as string);
  await cache.userProfiles.invalidateUserProfile(user.id as string);
}

/**
 * Handle subscription created
 */
async function handleSubscriptionCreated(
  payload: SolidgateWebhookPayload,
  env: Env,
  cache: ReturnType<typeof createCacheLayer>
) {
  const { order } = payload;
  const subscription = order.subscription;

  if (!subscription) return;

  // Find user by email
  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(order.customer.email)
    .first();

  if (!user) {
    console.error('User not found for subscription:', order.customer.email);
    return;
  }

  // Create or update subscription
  await env.DB.prepare(
    `INSERT INTO subscriptions
     (id, user_id, plan_id, solidgate_order_id, solidgate_subscription_id,
      status, current_period_start, current_period_end, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
     ON CONFLICT(solidgate_subscription_id) DO UPDATE SET
       status = excluded.status,
       current_period_start = excluded.current_period_start,
       current_period_end = excluded.current_period_end,
       updated_at = unixepoch()`
  )
    .bind(
      crypto.randomUUID(),
      user.id,
      subscription.plan_id,
      order.order_id,
      subscription.id,
      'active',
      subscription.current_period_start,
      subscription.current_period_end
    )
    .run();

  // Invalidate caches
  await cache.subscriptions.invalidateUserSubscription(user.id as string);
  await cache.userProfiles.invalidateUserProfile(user.id as string);
}

/**
 * Handle subscription renewed
 */
async function handleSubscriptionRenewed(
  payload: SolidgateWebhookPayload,
  env: Env,
  cache: ReturnType<typeof createCacheLayer>
) {
  const { order } = payload;
  const subscription = order.subscription;

  if (!subscription) return;

  // Update subscription period
  await env.DB.prepare(
    `UPDATE subscriptions SET
       current_period_start = ?,
       current_period_end = ?,
       updated_at = unixepoch()
     WHERE solidgate_subscription_id = ?`
  )
    .bind(
      subscription.current_period_start,
      subscription.current_period_end,
      subscription.id
    )
    .run();

  // Get user ID to invalidate cache
  const sub = await env.DB.prepare(
    'SELECT user_id FROM subscriptions WHERE solidgate_subscription_id = ?'
  )
    .bind(subscription.id)
    .first();

  if (sub) {
    await cache.subscriptions.invalidateUserSubscription(sub.user_id as string);
    await cache.userProfiles.invalidateUserProfile(sub.user_id as string);
  }
}

/**
 * Handle subscription canceled
 */
async function handleSubscriptionCanceled(
  payload: SolidgateWebhookPayload,
  env: Env,
  cache: ReturnType<typeof createCacheLayer>
) {
  const { order } = payload;
  const subscription = order.subscription;

  if (!subscription) return;

  // Update subscription status
  await env.DB.prepare(
    `UPDATE subscriptions SET
       status = 'canceled',
       canceled_at = unixepoch(),
       updated_at = unixepoch()
     WHERE solidgate_subscription_id = ?`
  )
    .bind(subscription.id)
    .run();

  // Get user ID to invalidate cache
  const sub = await env.DB.prepare(
    'SELECT user_id FROM subscriptions WHERE solidgate_subscription_id = ?'
  )
    .bind(subscription.id)
    .first();

  if (sub) {
    await cache.subscriptions.invalidateUserSubscription(sub.user_id as string);
    await cache.userProfiles.invalidateUserProfile(sub.user_id as string);
  }
}

/**
 * Handle subscription expired
 */
async function handleSubscriptionExpired(
  payload: SolidgateWebhookPayload,
  env: Env,
  cache: ReturnType<typeof createCacheLayer>
) {
  const { order } = payload;
  const subscription = order.subscription;

  if (!subscription) return;

  // Update subscription status
  await env.DB.prepare(
    `UPDATE subscriptions SET
       status = 'expired',
       ended_at = unixepoch(),
       updated_at = unixepoch()
     WHERE solidgate_subscription_id = ?`
  )
    .bind(subscription.id)
    .run();

  // Get user ID to invalidate cache
  const sub = await env.DB.prepare(
    'SELECT user_id FROM subscriptions WHERE solidgate_subscription_id = ?'
  )
    .bind(subscription.id)
    .first();

  if (sub) {
    await cache.subscriptions.invalidateUserSubscription(sub.user_id as string);
    await cache.userProfiles.invalidateUserProfile(sub.user_id as string);
  }
}

/**
 * Handle refund success
 */
async function handleRefundSuccess(
  payload: SolidgateWebhookPayload,
  env: Env,
  cache: ReturnType<typeof createCacheLayer>
) {
  const { order } = payload;

  // Update transaction status
  await env.DB.prepare(
    `UPDATE payment_transactions SET
       status = 'refunded',
       updated_at = unixepoch()
     WHERE provider_transaction_id = ?`
  )
    .bind(order.order_id)
    .run();

  // Get user ID to invalidate cache
  const transaction = await env.DB.prepare(
    'SELECT user_id FROM payment_transactions WHERE provider_transaction_id = ?'
  )
    .bind(order.order_id)
    .first();

  if (transaction) {
    await cache.userProfiles.invalidateUserProfile(transaction.user_id as string);
  }
}
