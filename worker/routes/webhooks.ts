/**
 * Webhook Handlers
 *
 * Handles all /api/webhooks/* endpoints
 */

import { Hono } from 'hono';
import { createCacheLayer } from '../../lib/cache';
import {
  handlePaymentSuccessTransaction,
  handleCreditPackPaymentTransaction,
  handleSubscriptionCreatedTransaction,
  handleSubscriptionRenewedTransaction,
  handleSubscriptionCanceledTransaction,
  handleSubscriptionExpiredTransaction,
  handleRefundSuccessTransaction,
  type SolidgateWebhookPayload,
} from '../db/transactions/webhook.transaction';
import type { AppEnvWithDB } from '../db/types';

const webhooks = new Hono<AppEnvWithDB>();

/**
 * Verify Solidgate webhook signature using Web Crypto API
 */
async function verifySignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Parse hex signature into bytes for constant-time comparison
    const sigBytes = new Uint8Array(
      (signature.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16))
    );

    const payloadData = encoder.encode(payload);

    // crypto.subtle.verify uses constant-time comparison internally,
    // preventing timing attacks on the webhook secret
    return await crypto.subtle.verify('HMAC', key, sigBytes, payloadData);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
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
webhooks.post('/solidgate', async (c) => {
  try {
    const body = await c.req.text();
    const signature = c.req.header('x-solidgate-signature');

    if (!signature) {
      return c.text('Missing signature', 401);
    }

    // Verify webhook signature
    const isValid = await verifySignature(body, signature, c.env.SOLIDGATE_WEBHOOK_SECRET);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return c.text('Invalid signature', 401);
    }

    const payload: SolidgateWebhookPayload = JSON.parse(body);
    const db = c.get('db');
    const cache = createCacheLayer(c.env.CACHE);

    let userId: string | null = null;

    // Handle different event types with atomic transactions.
    // Idempotency is enforced by the UNIQUE constraint on webhookEvents.eventId
    // inside each transaction — duplicate webhooks will throw a constraint error.
    switch (payload.event) {
      case 'payment.success': {
        const metadata = payload.order?.order_metadata as { type?: string } | undefined;
        if (metadata?.type === 'credit_pack') {
          userId = await handleCreditPackPaymentTransaction(db, payload, body);
        } else {
          userId = await handlePaymentSuccessTransaction(db, payload, body);
        }
        break;
      }

      case 'subscription.created':
        userId = await handleSubscriptionCreatedTransaction(db, payload, body);
        break;

      case 'subscription.renewed':
        userId = await handleSubscriptionRenewedTransaction(db, payload, body);
        break;

      case 'subscription.canceled':
        userId = await handleSubscriptionCanceledTransaction(db, payload, body);
        break;

      case 'subscription.expired':
        userId = await handleSubscriptionExpiredTransaction(db, payload, body);
        break;

      case 'refund.success':
        userId = await handleRefundSuccessTransaction(db, payload, body);
        break;

      default:
        console.log(`Unhandled event type: ${payload.event}`);
    }

    // Invalidate user cache if userId was returned (parallel for performance)
    if (userId) {
      await Promise.all([
        cache.subscriptions.invalidateUserSubscription(userId),
        cache.userProfiles.invalidateUserProfile(userId),
      ]);
    }

    return c.text('OK', 200);
  } catch (error) {
    // UNIQUE constraint violation on webhookEvents.eventId = already processed (idempotent)
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      console.log('Webhook already processed (duplicate detected)');
      return c.text('OK', 200);
    }

    // Log full error server-side but never expose internals to caller
    console.error('Webhook error:', error);
    return c.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Webhook processing failed' } },
      500
    );
  }
});

export default webhooks;
