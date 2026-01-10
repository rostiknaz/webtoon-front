/**
 * Get subscription plans
 *
 * GET /api/plans
 * Returns: List of active subscription plans
 */

import { createCacheLayer } from '../../lib/cache';
import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  try {
    const cache = createCacheLayer(env.CACHE);

    // Try cache first
    const cachedPlans = await cache.plans.getAllPlans();
    if (cachedPlans) {
      return new Response(
        JSON.stringify({
          success: true,
          plans: cachedPlans.plans,
          cached: true,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Cache miss - query D1
    const dbPlans = await env.DB.prepare(
      `SELECT
         id,
         name,
         description,
         price,
         currency,
         billing_period as billingPeriod,
         trial_days as trialDays,
         features,
         solidgate_product_id as solidgateProductId
       FROM plans
       WHERE is_active = 1
       ORDER BY price ASC`
    ).all();

    const plans = dbPlans.results.map((p: any) => ({
      ...p,
      features: JSON.parse(p.features),
    }));

    // Cache for a week (pricing rarely changes)
    await cache.plans.setAllPlans({ plans });

    return new Response(
      JSON.stringify({
        success: true,
        plans,
        cached: false,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Plans fetch error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch plans',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
