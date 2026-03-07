/**
 * Payment Service
 *
 * Read-only queries used by webhook transaction handlers.
 * Write operations are handled atomically via db.batch() in webhook.transaction.ts.
 */

import { eq } from 'drizzle-orm';
import { users, subscriptions, paymentTransactions, webhookEvents } from '../../../db/schema';
import type { DB } from '../index';

/** Find user by email — returns { id, email } or null */
export async function findUserByEmail(db: DB, email: string) {
  const result = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return result[0] ?? null;
}

/** Get subscription by Solidgate ID — returns { userId } or null */
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

/** Get payment transaction by Solidgate order ID — returns { userId } or null */
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
 * Get original payment webhook event by order ID.
 *
 * Used by refund handler to look up the original payment.success event
 * and extract order_metadata (e.g., credit pack details).
 */
export async function getOriginalPaymentWebhookEvent(
  db: DB,
  orderId: string
): Promise<{ eventData: string } | null> {
  const result = await db
    .select({ eventData: webhookEvents.eventData })
    .from(webhookEvents)
    .where(eq(webhookEvents.eventId, `payment.success-${orderId}`))
    .limit(1);

  return result[0] ?? null;
}
