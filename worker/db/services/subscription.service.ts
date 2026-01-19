/**
 * Subscription & Plans Service
 *
 * Type-safe queries for subscription plans and user subscriptions
 */

import { eq, asc, desc } from 'drizzle-orm';
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
  /** Computed: true if subscription grants access (not expired by time) */
  hasAccess: boolean;
}

/**
 * Check if subscription grants access based on expiration time
 * Access is purely time-based, status is informational only
 */
export function subscriptionHasAccess(currentPeriodEnd: number | null): boolean {
  if (!currentPeriodEnd) return false;
  return currentPeriodEnd > Math.floor(Date.now() / 1000);
}

/**
 * Get user's most recent subscription with plan details
 *
 * Returns the most recent subscription regardless of status.
 * Access is determined by time (hasAccess field), not status.
 *
 * @param db - Drizzle database instance
 * @param userId - User ID to check
 * @returns Subscription data or null if no subscription exists
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
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt)) // Get most recent first
    .limit(1);

  if (!result[0]) return null;

  const currentPeriodEnd = result[0].currentPeriodEnd
    ? Math.floor(result[0].currentPeriodEnd.getTime() / 1000)
    : null;

  return {
    status: result[0].status,
    planId: result[0].planId,
    planName: result[0].planName,
    planFeatures: JSON.parse(result[0].planFeatures),
    currentPeriodStart: result[0].currentPeriodStart
      ? Math.floor(result[0].currentPeriodStart.getTime() / 1000)
      : null,
    currentPeriodEnd,
    canceledAt: result[0].canceledAt
      ? Math.floor(result[0].canceledAt.getTime() / 1000)
      : null,
    hasAccess: subscriptionHasAccess(currentPeriodEnd),
  };
}

/**
 * Get user's active subscription (with access) for caching
 *
 * Only returns subscription if it currently grants access (not expired).
 * Used by cache layer to avoid caching expired subscriptions.
 *
 * @param db - Drizzle database instance
 * @param userId - User ID to check
 * @returns Subscription data or null if no active subscription
 */
export async function getUserActiveSubscription(
  db: DB,
  userId: string
): Promise<UserSubscriptionData | null> {
  const subscription = await getUserSubscription(db, userId);
  if (!subscription || !subscription.hasAccess) return null;
  return subscription;
}
