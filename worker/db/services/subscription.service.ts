/**
 * Subscription & Plans Service
 *
 * Type-safe queries for subscription plans
 */

import { eq, asc } from 'drizzle-orm';
import { plans } from '../../../db/schema';
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
