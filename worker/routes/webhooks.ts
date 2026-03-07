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
  type WebhookResult,
} from '../db/transactions/webhook.transaction';
import type { AppEnvWithDB } from '../db/types';
import type { DB } from '../db/index';

const webhooks = new Hono<AppEnvWithDB>();

/**
 * Verify Solidgate webhook signature using Web Crypto API.
 * Uses crypto.subtle.verify for constant-time comparison (timing-attack safe).
 */
async function verifySignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = new Uint8Array(
      (signature.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16))
    );

    return await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payload));
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Route webhook event to the appropriate transaction handler.
 * Returns { userId, creditsReversed } for cache invalidation and logging.
 */
async function processWebhookEvent(
  db: DB,
  payload: SolidgateWebhookPayload,
  body: string
): Promise<WebhookResult> {
  switch (payload.event) {
    case 'payment.success': {
      const metadata = payload.order?.order_metadata as { type?: string } | undefined;
      const userId = metadata?.type === 'credit_pack'
        ? await handleCreditPackPaymentTransaction(db, payload, body)
        : await handlePaymentSuccessTransaction(db, payload, body);
      return { userId };
    }

    case 'subscription.created':
      return { userId: await handleSubscriptionCreatedTransaction(db, payload, body) };

    case 'subscription.renewed':
      return { userId: await handleSubscriptionRenewedTransaction(db, payload, body) };

    case 'subscription.canceled':
      return { userId: await handleSubscriptionCanceledTransaction(db, payload, body) };

    case 'subscription.expired':
      return { userId: await handleSubscriptionExpiredTransaction(db, payload, body) };

    case 'refund.success':
      return await handleRefundSuccessTransaction(db, payload, body);

    default:
      console.log(`Unhandled event type: ${payload.event}`);
      return { userId: null };
  }
}

/**
 * POST /api/webhooks/solidgate
 *
 * Handles payment and subscription events from Solidgate.
 * Idempotency enforced by UNIQUE constraint on webhookEvents.eventId.
 */
webhooks.post('/solidgate', async (c) => {
  const startTime = performance.now();
  let payload: SolidgateWebhookPayload | undefined;

  try {
    const body = await c.req.text();
    const signature = c.req.header('x-solidgate-signature');

    if (!signature) {
      return c.text('Missing signature', 401);
    }

    const isValid = await verifySignature(body, signature, c.env.SOLIDGATE_WEBHOOK_SECRET);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return c.text('Invalid signature', 401);
    }

    payload = JSON.parse(body);
    const db = c.get('db');
    const cache = createCacheLayer(c.env.CACHE);

    const result = await processWebhookEvent(db, payload!, body);

    // Fire-and-forget cache invalidation (don't block webhook response)
    // waitUntil() allows background work to complete after response is sent
    if (result.userId) {
      c.executionCtx.waitUntil(
        Promise.all([
          cache.subscriptions.invalidateUserSubscription(result.userId),
          cache.userProfiles.invalidateUserProfile(result.userId),
        ])
      );
    }

    console.log(JSON.stringify({
      webhook: true,
      event: payload!.event,
      orderId: payload!.order.order_id,
      userId: result.userId,
      ...(result.creditsReversed != null && { creditsReversed: result.creditsReversed }),
      processingTimeMs: Math.round(performance.now() - startTime),
    }));

    return c.text('OK', 200);
  } catch (error) {
    // UNIQUE constraint violation = already processed (idempotent)
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      console.log(JSON.stringify({
        webhook: true,
        event: payload?.event,
        orderId: payload?.order?.order_id,
        duplicate: true,
        processingTimeMs: Math.round(performance.now() - startTime),
      }));
      return c.text('OK', 200);
    }

    console.error(JSON.stringify({
      webhook: true,
      event: payload?.event,
      orderId: payload?.order?.order_id,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTimeMs: Math.round(performance.now() - startTime),
    }));
    return c.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Webhook processing failed' } },
      500
    );
  }
});

export default webhooks;
