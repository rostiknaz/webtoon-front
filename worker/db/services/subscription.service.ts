/**
 * Subscription & Plans Service
 *
 * Type-safe queries for subscription plans and user subscriptions
 */

import { eq, asc, and, inArray } from 'drizzle-orm';
import { plans, subscriptions } from '../../../db/schema';
import type { DB } from '../index';

/**
 * Get all active subscription plans
 *
 * Returns active plans ordered by price (lowest to highest).
 * Plans include all features and Solidgate integration data.
 *
 * @param db - Drizzle database instance
 * @returns Array of active subscription plans
 */
export async function getActivePlans(db: DB) {
  return await db
    .select({
      id: plans.id,
      name: plans.name,
      description: plans.description,
      price: plans.price,
      currency: plans.currency,
      billingPeriod: plans.billingPeriod,
      trialDays: plans.trialDays,
      features: plans.features,
      solidgateProductId: plans.solidgateProductId,
    })
    .from(plans)
    .where(eq(plans.isActive, true))
    .orderBy(asc(plans.price));
}

/**
 * Full subscription data with plan details
 */
export interface UserSubscriptionData {
  status: string;
  planId: string;
  planName: string;
  planFeatures: any;
  currentPeriodStart: number | null;
  currentPeriodEnd: number | null;
  canceledAt: number | null;
}

/**
 * Get user's active subscription with plan details
 *
 * Joins subscriptions with plans to get full feature set
 *
 * @param db - Drizzle database instance
 * @param userId - User ID to check
 * @returns Subscription data or null if no active subscription
 */
export async function getUserSubscription(
  db: DB,
  userId: string
): Promise<UserSubscriptionData | null> {
  const result = await db
    .select({
      status: subscriptions.status,
      planId: subscriptions.planId,
      planName: plans.name,
      planFeatures: plans.features,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      canceledAt: subscriptions.canceledAt,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, ['active', 'trial', 'canceled']), // Include canceled (may still have access until period end)
      )
    )
    .orderBy(subscriptions.createdAt) // Get most recent
    .limit(1);

  if (!result[0]) return null;

  return {
    status: result[0].status,
    planId: result[0].planId,
    planName: result[0].planName,
    planFeatures: JSON.parse(result[0].planFeatures),
    currentPeriodStart: result[0].currentPeriodStart
      ? Math.floor(result[0].currentPeriodStart.getTime() / 1000)
      : null,
    currentPeriodEnd: result[0].currentPeriodEnd
      ? Math.floor(result[0].currentPeriodEnd.getTime() / 1000)
      : null,
    canceledAt: result[0].canceledAt
      ? Math.floor(result[0].canceledAt.getTime() / 1000)
      : null,
  };
}
