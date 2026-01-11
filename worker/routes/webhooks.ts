/**
 * Webhook Handlers
 *
 * Handles all /api/webhooks/* endpoints
 */

import { Hono } from 'hono';
import { createCacheLayer } from '../../lib/cache';
import { markWebhookProcessed } from '../db/services/payment.service';
import {
  handlePaymentSuccessTransaction,
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
      ['sign']
    );

    const payloadData = encoder.encode(payload);
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, payloadData);

    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const expectedSignature = signatureArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return signature === expectedSignature;
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

    // Handle different event types with atomic transactions
    switch (payload.event) {
      case 'payment.success':
        userId = await handlePaymentSuccessTransaction(db, payload, body);
        break;

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

    // Invalidate user cache if userId was returned
    if (userId) {
      await cache.subscriptions.invalidateUserSubscription(userId);
      await cache.userProfiles.invalidateUserProfile(userId);
    }

    // Mark webhook as processed
    await markWebhookProcessed(db, body);

    return c.text('OK', 200);
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json(
      {
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default webhooks;
