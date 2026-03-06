/**
 * Webhook Transaction Handlers
 *
 * Complex atomic operations for payment webhooks.
 * Uses db.batch() for atomic writes (D1 Sessions API doesn't support SQL transactions).
 * Pattern: reads first, then batch all writes atomically.
 */

import { eq, sql } from 'drizzle-orm';
import {
  credits,
  creditTransactions,
  subscriptions,
  paymentTransactions,
  webhookEvents,
} from '../../../db/schema';
import type { DB } from '../index';
import {
  findUserByEmail,
  getSubscriptionBySolidgateId,
  getPaymentTransactionBySolidgateOrderId,
} from '../services/payment.service';

/** Build a webhook event insert statement (reused in every handler) */
function webhookEventInsert(db: DB, payload: SolidgateWebhookPayload, rawBody: string) {
  return db.insert(webhookEvents).values({
    id: crypto.randomUUID(),
    eventId: `${payload.event}-${payload.order.order_id}`,
    eventType: payload.event,
    eventData: rawBody,
  });
}

/**
 * Solidgate webhook payload structure
 */
export interface SolidgateWebhookPayload {
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
 * Handle payment success atomically
 *
 * Reads user first, then batches webhook log + payment record.
 */
export async function handlePaymentSuccessTransaction(
  db: DB,
  payload: SolidgateWebhookPayload,
  rawBody: string
): Promise<string> {
  // Read: find user
  const user = await findUserByEmail(db, payload.order.customer.email);
  if (!user) {
    throw new Error(`User not found: ${payload.order.customer.email}`);
  }

  // Batch: webhook log + payment record
  await db.batch([
    webhookEventInsert(db, payload, rawBody),
    db.insert(paymentTransactions).values({
      id: crypto.randomUUID(),
      userId: user.id,
      amount: payload.order.amount,
      currency: payload.order.currency,
      solidgateOrderId: payload.order.order_id,
      status: 'completed',
    }),
  ]);

  return user.id;
}

/**
 * Handle subscription created atomically
 *
 * Reads user first, then batches webhook log + subscription upsert.
 */
export async function handleSubscriptionCreatedTransaction(
  db: DB,
  payload: SolidgateWebhookPayload,
  rawBody: string
): Promise<string> {
  if (!payload.order.subscription) {
    throw new Error('No subscription data in payload');
  }

  // Read: find user
  const user = await findUserByEmail(db, payload.order.customer.email);
  if (!user) {
    throw new Error(`User not found: ${payload.order.customer.email}`);
  }

  const sub = payload.order.subscription;
  const periodStart = sub.current_period_start
    ? new Date(sub.current_period_start * 1000)
    : undefined;
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000)
    : undefined;

  // Batch: webhook log + subscription upsert
  await db.batch([
    webhookEventInsert(db, payload, rawBody),
    db
      .insert(subscriptions)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        planId: sub.plan_id,
        solidgateOrderId: payload.order.order_id,
        solidgateSubscriptionId: sub.id,
        status: 'active',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      })
      .onConflictDoUpdate({
        target: subscriptions.solidgateSubscriptionId,
        set: {
          status: 'active',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
      }),
  ]);

  return user.id;
}

/**
 * Handle subscription renewed atomically
 *
 * Reads subscription for userId first, then batches webhook log + period update.
 */
export async function handleSubscriptionRenewedTransaction(
  db: DB,
  payload: SolidgateWebhookPayload,
  rawBody: string
): Promise<string | null> {
  if (!payload.order.subscription) {
    throw new Error('No subscription data in payload');
  }

  const sub = payload.order.subscription;

  // Read: get userId for cache invalidation
  const subscription = await getSubscriptionBySolidgateId(db, sub.id);

  // Batch: webhook log + period update
  await db.batch([
    webhookEventInsert(db, payload, rawBody),
    db
      .update(subscriptions)
      .set({
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      })
      .where(eq(subscriptions.solidgateSubscriptionId, sub.id)),
  ]);

  return subscription?.userId ?? null;
}

/**
 * Handle subscription canceled atomically
 *
 * Reads subscription for userId first, then batches webhook log + cancel.
 */
export async function handleSubscriptionCanceledTransaction(
  db: DB,
  payload: SolidgateWebhookPayload,
  rawBody: string
): Promise<string | null> {
  if (!payload.order.subscription) {
    throw new Error('No subscription data in payload');
  }

  const sub = payload.order.subscription;

  // Read: get userId for cache invalidation
  const subscription = await getSubscriptionBySolidgateId(db, sub.id);

  // Batch: webhook log + cancel
  await db.batch([
    webhookEventInsert(db, payload, rawBody),
    db
      .update(subscriptions)
      .set({
        status: 'canceled',
        canceledAt: sql`unixepoch()`,
        updatedAt: sql`unixepoch()`,
      })
      .where(eq(subscriptions.solidgateSubscriptionId, sub.id)),
  ]);

  return subscription?.userId ?? null;
}

/**
 * Handle subscription expired atomically
 *
 * Reads subscription for userId first, then batches webhook log + expire.
 */
export async function handleSubscriptionExpiredTransaction(
  db: DB,
  payload: SolidgateWebhookPayload,
  rawBody: string
): Promise<string | null> {
  if (!payload.order.subscription) {
    throw new Error('No subscription data in payload');
  }

  const sub = payload.order.subscription;

  // Read: get userId for cache invalidation
  const subscription = await getSubscriptionBySolidgateId(db, sub.id);

  // Batch: webhook log + expire
  await db.batch([
    webhookEventInsert(db, payload, rawBody),
    db
      .update(subscriptions)
      .set({
        status: 'expired',
        endedAt: sql`unixepoch()`,
        updatedAt: sql`unixepoch()`,
      })
      .where(eq(subscriptions.solidgateSubscriptionId, sub.id)),
  ]);

  return subscription?.userId ?? null;
}

/**
 * Handle refund success atomically
 *
 * Reads payment transaction for userId first, then batches webhook log + refund.
 */
export async function handleRefundSuccessTransaction(
  db: DB,
  payload: SolidgateWebhookPayload,
  rawBody: string
): Promise<string | null> {
  // Read: get userId for cache invalidation
  const transaction = await getPaymentTransactionBySolidgateOrderId(
    db,
    payload.order.order_id
  );

  // Batch: webhook log + refund
  await db.batch([
    webhookEventInsert(db, payload, rawBody),
    db
      .update(paymentTransactions)
      .set({ status: 'refunded' })
      .where(eq(paymentTransactions.solidgateOrderId, payload.order.order_id)),
  ]);

  return transaction?.userId ?? null;
}

/**
 * Handle credit pack payment atomically
 *
 * Reads user first, then batches webhook log + payment + credit increment + ledger entry.
 */
export async function handleCreditPackPaymentTransaction(
  db: DB,
  payload: SolidgateWebhookPayload,
  rawBody: string,
): Promise<string> {
  const metadata = payload.order.order_metadata as {
    type: string;
    pack_id: string;
    credits: number;
    user_id: string;
    clip_id?: string;
  };

  // Read: find user
  const user = await findUserByEmail(db, payload.order.customer.email);
  if (!user) {
    throw new Error(`User not found: ${payload.order.customer.email}`);
  }

  // Batch: webhook log + payment + credit increment + ledger entry
  await db.batch([
    webhookEventInsert(db, payload, rawBody),
    db.insert(paymentTransactions).values({
      id: crypto.randomUUID(),
      userId: user.id,
      amount: payload.order.amount,
      currency: payload.order.currency,
      solidgateOrderId: payload.order.order_id,
      status: 'completed',
    }),
    db
      .insert(credits)
      .values({
        userId: user.id,
        balance: metadata.credits,
        freeDownloadsRemaining: 0,
      })
      .onConflictDoUpdate({
        target: credits.userId,
        set: {
          balance: sql`${credits.balance} + ${metadata.credits}`,
          updatedAt: sql`(unixepoch())`,
        },
      }),
    db.insert(creditTransactions).values({
      userId: user.id,
      amount: metadata.credits,
      type: 'purchase',
    }),
  ]);

  return user.id;
}
