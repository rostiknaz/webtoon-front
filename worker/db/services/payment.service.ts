/**
 * Payment Service
 *
 * Payment transactions and webhook event handling
 */

import { eq, sql } from 'drizzle-orm';
import { users, subscriptions, paymentTransactions, webhookEvents } from '../../../db/schema';
import type { DB } from '../index';

/**
 * Find user by email
 *
 * @param db - Drizzle database instance
 * @param email - User email address
 * @returns User data or null if not found
 */
export async function findUserByEmail(db: DB, email: string) {
  const result = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Create payment transaction record
 *
 * @param db - Drizzle database instance
 * @param data - Transaction data
 */
export async function createPaymentTransaction(
  db: DB,
  data: {
    id: string;
    userId: string;
    amount: number;
    currency: string;
    solidgateOrderId: string;
    status: string;
  }
) {
  return await db.insert(paymentTransactions).values({
    id: data.id,
    userId: data.userId,
    amount: data.amount,
    currency: data.currency,
    solidgateOrderId: data.solidgateOrderId,
    status: data.status,
  });
}

/**
 * Upsert subscription (insert or update on conflict)
 *
 * @param db - Drizzle database instance
 * @param data - Subscription data
 */
export async function upsertSubscription(
  db: DB,
  data: {
    id: string;
    userId: string;
    planId: string;
    solidgateOrderId: string;
    solidgateSubscriptionId: string;
    status: string;
    currentPeriodStart?: number;
    currentPeriodEnd?: number;
  }
) {
  const periodStart = data.currentPeriodStart ? new Date(data.currentPeriodStart * 1000) : undefined;
  const periodEnd = data.currentPeriodEnd ? new Date(data.currentPeriodEnd * 1000) : undefined;

  return await db
    .insert(subscriptions)
    .values({
      id: data.id,
      userId: data.userId,
      planId: data.planId,
      solidgateOrderId: data.solidgateOrderId,
      solidgateSubscriptionId: data.solidgateSubscriptionId,
      status: data.status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    })
    .onConflictDoUpdate({
      target: subscriptions.solidgateSubscriptionId,
      set: {
        status: data.status,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      },
    });
}

/**
 * Update subscription periods (for renewals)
 *
 * @param db - Drizzle database instance
 * @param solidgateSubscriptionId - Solidgate subscription ID
 * @param data - Period data
 */
export async function updateSubscriptionPeriods(
  db: DB,
  solidgateSubscriptionId: string,
  data: {
    currentPeriodStart: number;
    currentPeriodEnd: number;
  }
) {
  return await db
    .update(subscriptions)
    .set({
      currentPeriodStart: new Date(data.currentPeriodStart * 1000),
      currentPeriodEnd: new Date(data.currentPeriodEnd * 1000),
    })
    .where(eq(subscriptions.solidgateSubscriptionId, solidgateSubscriptionId));
}

/**
 * Cancel subscription
 *
 * @param db - Drizzle database instance
 * @param solidgateSubscriptionId - Solidgate subscription ID
 */
export async function cancelSubscription(db: DB, solidgateSubscriptionId: string) {
  return await db
    .update(subscriptions)
    .set({
      status: 'canceled',
      canceledAt: sql`unixepoch()`,
      updatedAt: sql`unixepoch()`,
    })
    .where(eq(subscriptions.solidgateSubscriptionId, solidgateSubscriptionId));
}

/**
 * Expire subscription
 *
 * @param db - Drizzle database instance
 * @param solidgateSubscriptionId - Solidgate subscription ID
 */
export async function expireSubscription(db: DB, solidgateSubscriptionId: string) {
  return await db
    .update(subscriptions)
    .set({
      status: 'expired',
      endedAt: sql`unixepoch()`,
      updatedAt: sql`unixepoch()`,
    })
    .where(eq(subscriptions.solidgateSubscriptionId, solidgateSubscriptionId));
}

/**
 * Refund payment transaction
 *
 * @param db - Drizzle database instance
 * @param solidgateOrderId - Solidgate order ID
 */
export async function refundPaymentTransaction(db: DB, solidgateOrderId: string) {
  return await db
    .update(paymentTransactions)
    .set({
      status: 'refunded',
    })
    .where(eq(paymentTransactions.solidgateOrderId, solidgateOrderId));
}

/**
 * Get subscription by Solidgate ID
 *
 * @param db - Drizzle database instance
 * @param solidgateSubscriptionId - Solidgate subscription ID
 * @returns Subscription or null
 */
export async function getSubscriptionBySolidgateId(
  db: DB,
  solidgateSubscriptionId: string
) {
  const result = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(eq(subscriptions.solidgateSubscriptionId, solidgateSubscriptionId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get payment transaction by Solidgate order ID
 *
 * @param db - Drizzle database instance
 * @param solidgateOrderId - Solidgate order ID
 * @returns Transaction or null
 */
export async function getPaymentTransactionBySolidgateOrderId(
  db: DB,
  solidgateOrderId: string
) {
  const result = await db
    .select({ userId: paymentTransactions.userId })
    .from(paymentTransactions)
    .where(eq(paymentTransactions.solidgateOrderId, solidgateOrderId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Log webhook event for idempotency and audit trail
 *
 * @param db - Drizzle database instance
 * @param data - Webhook event data
 */
export async function logWebhookEvent(
  db: DB,
  data: {
    id: string;
    eventId: string;
    eventType: string;
    eventData: string;
  }
) {
  return await db.insert(webhookEvents).values({
    id: data.id,
    eventId: data.eventId,
    eventType: data.eventType,
    eventData: data.eventData,
  });
}

/**
 * Mark webhook event as processed
 *
 * @param db - Drizzle database instance
 * @param eventId - Solidgate event ID (used to match event)
 */
export async function markWebhookProcessed(db: DB, eventId: string) {
  return await db
    .update(webhookEvents)
    .set({ processedAt: sql`unixepoch()` })
    .where(eq(webhookEvents.eventId, eventId));
}
