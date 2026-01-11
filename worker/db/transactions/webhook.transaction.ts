/**
 * Webhook Transaction Handlers
 *
 * Complex atomic operations for payment webhooks.
 * All operations wrapped in transactions to ensure data consistency.
 */

import type { DB } from '../index';
import {
  findUserByEmail,
  createPaymentTransaction,
  upsertSubscription,
  updateSubscriptionPeriods,
  cancelSubscription,
  expireSubscription,
  refundPaymentTransaction,
  getSubscriptionBySolidgateId,
  getPaymentTransactionBySolidgateOrderId,
  logWebhookEvent,
} from '../services/payment.service';

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
 * Handle payment success with atomic transaction
 *
 * Ensures webhook logging and payment record creation happen atomically.
 *
 * @param db - Drizzle database instance
 * @param payload - Solidgate webhook payload
 * @param rawBody - Raw webhook body for logging
 * @returns User ID
 */
export async function handlePaymentSuccessTransaction(
  db: DB,
  payload: SolidgateWebhookPayload,
  rawBody: string
): Promise<string> {
  return await db.transaction(async (tx) => {
    // 1. Log webhook event for idempotency
    await logWebhookEvent(tx as any, {
      id: crypto.randomUUID(),
      eventId: `${payload.event}-${payload.order.order_id}`,
      eventType: payload.event,
      eventData: rawBody,
    });

    // 2. Find user
    const user = await findUserByEmail(tx as any, payload.order.customer.email);
    if (!user) {
      throw new Error(`User not found: ${payload.order.customer.email}`);
    }

    // 3. Create payment transaction
    await createPaymentTransaction(tx as any, {
      id: crypto.randomUUID(),
      userId: user.id,
      amount: payload.order.amount,
      currency: payload.order.currency,
      solidgateOrderId: payload.order.order_id,
      status: 'completed',
    });

    // All operations succeeded atomically
    return user.id;
  });
}

/**
 * Handle subscription created with atomic transaction
 *
 * Ensures webhook logging and subscription creation happen atomically.
 *
 * @param db - Drizzle database instance
 * @param payload - Solidgate webhook payload
 * @param rawBody - Raw webhook body for logging
 * @returns User ID
 */
export async function handleSubscriptionCreatedTransaction(
  db: DB,
  payload: SolidgateWebhookPayload,
  rawBody: string
): Promise<string> {
  if (!payload.order.subscription) {
    throw new Error('No subscription data in payload');
  }

  return await db.transaction(async (tx) => {
    // 1. Log webhook event
    await logWebhookEvent(tx as any, {
      id: crypto.randomUUID(),
      eventId: `${payload.event}-${payload.order.order_id}`,
      eventType: payload.event,
      eventData: rawBody,
    });

    // 2. Find user
    const user = await findUserByEmail(tx as any, payload.order.customer.email);
    if (!user) {
      throw new Error(`User not found: ${payload.order.customer.email}`);
    }

    // 3. Ensure subscription data exists
    if (!payload.order.subscription) {
      throw new Error('Subscription data missing from webhook payload');
    }

    // 4. Upsert subscription (handles duplicate events gracefully)
    await upsertSubscription(tx as any, {
      id: crypto.randomUUID(),
      userId: user.id,
      planId: payload.order.subscription.plan_id,
      solidgateOrderId: payload.order.order_id,
      solidgateSubscriptionId: payload.order.subscription.id,
      status: 'active',
      currentPeriodStart: payload.order.subscription.current_period_start,
      currentPeriodEnd: payload.order.subscription.current_period_end,
    });

    return user.id;
  });
}

/**
 * Handle subscription renewed with atomic transaction
 *
 * @param db - Drizzle database instance
 * @param payload - Solidgate webhook payload
 * @param rawBody - Raw webhook body for logging
 * @returns User ID or null if subscription not found
 */
export async function handleSubscriptionRenewedTransaction(
  db: DB,
  payload: SolidgateWebhookPayload,
  rawBody: string
): Promise<string | null> {
  if (!payload.order.subscription) {
    throw new Error('No subscription data in payload');
  }

  const subscriptionData = payload.order.subscription;

  return await db.transaction(async (tx) => {
    // 1. Log webhook event
    await logWebhookEvent(tx as any, {
      id: crypto.randomUUID(),
      eventId: `${payload.event}-${payload.order.order_id}`,
      eventType: payload.event,
      eventData: rawBody,
    });

    // 2. Update subscription periods
    await updateSubscriptionPeriods(tx as any, subscriptionData.id, {
      currentPeriodStart: subscriptionData.current_period_start,
      currentPeriodEnd: subscriptionData.current_period_end,
    });

    // 3. Get user ID for cache invalidation
    const subscription = await getSubscriptionBySolidgateId(
      tx as any,
      subscriptionData.id
    );

    return subscription?.userId ?? null;
  });
}

/**
 * Handle subscription canceled with atomic transaction
 *
 * @param db - Drizzle database instance
 * @param payload - Solidgate webhook payload
 * @param rawBody - Raw webhook body for logging
 * @returns User ID or null if subscription not found
 */
export async function handleSubscriptionCanceledTransaction(
  db: DB,
  payload: SolidgateWebhookPayload,
  rawBody: string
): Promise<string | null> {
  if (!payload.order.subscription) {
    throw new Error('No subscription data in payload');
  }

  const subscriptionData = payload.order.subscription;

  return await db.transaction(async (tx) => {
    // 1. Log webhook event
    await logWebhookEvent(tx as any, {
      id: crypto.randomUUID(),
      eventId: `${payload.event}-${payload.order.order_id}`,
      eventType: payload.event,
      eventData: rawBody,
    });

    // 2. Cancel subscription
    await cancelSubscription(tx as any, subscriptionData.id);

    // 3. Get user ID for cache invalidation
    const subscription = await getSubscriptionBySolidgateId(
      tx as any,
      subscriptionData.id
    );

    return subscription?.userId ?? null;
  });
}

/**
 * Handle subscription expired with atomic transaction
 *
 * @param db - Drizzle database instance
 * @param payload - Solidgate webhook payload
 * @param rawBody - Raw webhook body for logging
 * @returns User ID or null if subscription not found
 */
export async function handleSubscriptionExpiredTransaction(
  db: DB,
  payload: SolidgateWebhookPayload,
  rawBody: string
): Promise<string | null> {
  if (!payload.order.subscription) {
    throw new Error('No subscription data in payload');
  }

  const subscriptionData = payload.order.subscription;

  return await db.transaction(async (tx) => {
    // 1. Log webhook event
    await logWebhookEvent(tx as any, {
      id: crypto.randomUUID(),
      eventId: `${payload.event}-${payload.order.order_id}`,
      eventType: payload.event,
      eventData: rawBody,
    });

    // 2. Expire subscription
    await expireSubscription(tx as any, subscriptionData.id);

    // 3. Get user ID for cache invalidation
    const subscription = await getSubscriptionBySolidgateId(
      tx as any,
      subscriptionData.id
    );

    return subscription?.userId ?? null;
  });
}

/**
 * Handle refund success with atomic transaction
 *
 * @param db - Drizzle database instance
 * @param payload - Solidgate webhook payload
 * @param rawBody - Raw webhook body for logging
 * @returns User ID or null if transaction not found
 */
export async function handleRefundSuccessTransaction(
  db: DB,
  payload: SolidgateWebhookPayload,
  rawBody: string
): Promise<string | null> {
  return await db.transaction(async (tx) => {
    // 1. Log webhook event
    await logWebhookEvent(tx as any, {
      id: crypto.randomUUID(),
      eventId: `${payload.event}-${payload.order.order_id}`,
      eventType: payload.event,
      eventData: rawBody,
    });

    // 2. Refund payment transaction
    await refundPaymentTransaction(tx as any, payload.order.order_id);

    // 3. Get user ID for cache invalidation
    const transaction = await getPaymentTransactionBySolidgateOrderId(
      tx as any,
      payload.order.order_id
    );

    return transaction?.userId ?? null;
  });
}
