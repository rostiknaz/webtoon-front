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
  getOriginalPaymentWebhookEvent,
} from '../services/payment.service';

// ==================== Types ====================

interface SolidgateSubscription {
  id: string;
  status: string;
  plan_id: string;
  current_period_start: number;
  current_period_end: number;
}

interface SolidgateOrder {
  order_id: string;
  status: string;
  amount: number;
  currency: string;
  customer: { email: string };
  order_metadata?: Record<string, unknown>;
  subscription?: SolidgateSubscription;
}

export interface SolidgateWebhookPayload {
  event: string;
  order: SolidgateOrder;
}

export interface WebhookResult {
  userId: string | null;
  creditsReversed?: number | null;
}

// ==================== Helpers ====================

/** Build a webhook event insert statement (reused in every handler) */
function webhookEventInsert(db: DB, payload: SolidgateWebhookPayload, rawBody: string) {
  return db.insert(webhookEvents).values({
    id: crypto.randomUUID(),
    eventId: `${payload.event}-${payload.order.order_id}`,
    eventType: payload.event,
    eventData: rawBody,
  });
}

/** Convert Unix timestamp (seconds) to Date, or undefined if falsy */
function epochToDate(epoch: number | undefined): Date | undefined {
  return epoch ? new Date(epoch * 1000) : undefined;
}

// ==================== Transaction Handlers ====================

/** Handle generic payment success (non-credit-pack) */
export async function handlePaymentSuccessTransaction(
  db: DB,
  payload: SolidgateWebhookPayload,
  rawBody: string
): Promise<string> {
  const user = await findUserByEmail(db, payload.order.customer.email);
  if (!user) {
    throw new Error(`User not found: ${payload.order.customer.email}`);
  }

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

/** Handle credit pack payment — increments balance + adds ledger entry */
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

  const user = await findUserByEmail(db, payload.order.customer.email);
  if (!user) {
    throw new Error(`User not found: ${payload.order.customer.email}`);
  }

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

/** Handle subscription created — upserts subscription record */
export async function handleSubscriptionCreatedTransaction(
  db: DB,
  payload: SolidgateWebhookPayload,
  rawBody: string
): Promise<string> {
  if (!payload.order.subscription) {
    throw new Error('No subscription data in payload');
  }

  const user = await findUserByEmail(db, payload.order.customer.email);
  if (!user) {
    throw new Error(`User not found: ${payload.order.customer.email}`);
  }

  const sub = payload.order.subscription;

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
        currentPeriodStart: epochToDate(sub.current_period_start),
        currentPeriodEnd: epochToDate(sub.current_period_end),
      })
      .onConflictDoUpdate({
        target: subscriptions.solidgateSubscriptionId,
        set: {
          status: 'active',
          currentPeriodStart: epochToDate(sub.current_period_start),
          currentPeriodEnd: epochToDate(sub.current_period_end),
        },
      }),
  ]);

  return user.id;
}

/** Handle subscription renewed — updates period dates */
export async function handleSubscriptionRenewedTransaction(
  db: DB,
  payload: SolidgateWebhookPayload,
  rawBody: string
): Promise<string | null> {
  if (!payload.order.subscription) {
    throw new Error('No subscription data in payload');
  }

  const sub = payload.order.subscription;
  const subscription = await getSubscriptionBySolidgateId(db, sub.id);

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

/** Handle subscription canceled — marks status as canceled */
export async function handleSubscriptionCanceledTransaction(
  db: DB,
  payload: SolidgateWebhookPayload,
  rawBody: string
): Promise<string | null> {
  if (!payload.order.subscription) {
    throw new Error('No subscription data in payload');
  }

  const sub = payload.order.subscription;
  const subscription = await getSubscriptionBySolidgateId(db, sub.id);

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

/** Handle subscription expired — marks status as expired */
export async function handleSubscriptionExpiredTransaction(
  db: DB,
  payload: SolidgateWebhookPayload,
  rawBody: string
): Promise<string | null> {
  if (!payload.order.subscription) {
    throw new Error('No subscription data in payload');
  }

  const sub = payload.order.subscription;
  const subscription = await getSubscriptionBySolidgateId(db, sub.id);

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
 * Handle refund success — reverses credits if original was a credit pack.
 *
 * Looks up the original payment.success webhook to determine if it was a credit pack.
 * If the original webhook hasn't been processed yet (out-of-order delivery),
 * throws to trigger a 500 so Solidgate retries later.
 */
export async function handleRefundSuccessTransaction(
  db: DB,
  payload: SolidgateWebhookPayload,
  rawBody: string
): Promise<WebhookResult> {
  // Parallel fetch: D1 read replication allows simultaneous reads to different replicas
  const [transaction, originalEvent] = await Promise.all([
    getPaymentTransactionBySolidgateOrderId(db, payload.order.order_id),
    getOriginalPaymentWebhookEvent(db, payload.order.order_id),
  ]);

  let creditAmount: number | null = null;

  // Payment exists but webhook event missing — out-of-order delivery, retry later
  if (transaction && !originalEvent) {
    throw new Error(`Original payment webhook event not found for order ${payload.order.order_id}, will retry`);
  }

  if (originalEvent) {
    try {
      const originalPayload = JSON.parse(originalEvent.eventData) as SolidgateWebhookPayload;
      const metadata = originalPayload.order?.order_metadata as { type?: string; credits?: number } | undefined;
      if (metadata?.type === 'credit_pack' && metadata.credits != null && metadata.credits > 0) {
        creditAmount = metadata.credits;
      }
    } catch {
      // Unparseable eventData — treat as non-credit-pack refund
    }
  }

  if (creditAmount && transaction?.userId) {
    // Credit pack refund: reverse credits + add refund ledger entry.
    // D1's SQLite serializes writes at the row level, so the inline
    // MAX(balance - credits, 0) is safe against concurrent deductions.
    await db.batch([
      webhookEventInsert(db, payload, rawBody),
      db
        .update(paymentTransactions)
        .set({ status: 'refunded' })
        .where(eq(paymentTransactions.solidgateOrderId, payload.order.order_id)),
      db
        .update(credits)
        .set({
          balance: sql`MAX(${credits.balance} - ${creditAmount}, 0)`,
          updatedAt: sql`(unixepoch())`,
        })
        .where(eq(credits.userId, transaction.userId)),
      db.insert(creditTransactions).values({
        userId: transaction.userId,
        amount: -creditAmount,
        type: 'refund',
      }),
    ]);
  } else {
    // Non-credit-pack refund: just mark as refunded
    await db.batch([
      webhookEventInsert(db, payload, rawBody),
      db
        .update(paymentTransactions)
        .set({ status: 'refunded' })
        .where(eq(paymentTransactions.solidgateOrderId, payload.order.order_id)),
    ]);
  }

  return { userId: transaction?.userId ?? null, creditsReversed: creditAmount };
}
