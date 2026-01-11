/**
 * Plans Service
 *
 * Type-safe database queries for subscription plans
 */

import { eq } from 'drizzle-orm';
import type { DB } from '../index';
import { plans } from '../../../db/schema';

/**
 * Get all active subscription plans
 */
export async function getActivePlans(db: DB) {
  const result = await db
    .select({
      id: plans.id,
      name: plans.name,
      description: plans.description,
      price: plans.price,
      currency: plans.currency,
      billingPeriod: plans.billingPeriod,
      trialDays: plans.trialDays,
      features: plans.features,
    })
    .from(plans)
    .where(eq(plans.isActive, true))
    .all();

  return result;
}

/**
 * Get a single plan by ID
 */
export async function getPlanById(db: DB, planId: string) {
  const result = await db
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
    .where(eq(plans.id, planId))
    .limit(1);

  return result[0] || null;
}
