/**
 * Subscription Plans API Routes
 *
 * Handles all /api/plans endpoints
 */

import { Hono } from 'hono';
import { kvCache, buildCacheKey } from '../middleware/cache';
import { getActivePlans } from '../db/services/subscription.service';
import type { AppEnvWithDB } from '../db/types';

const plans = new Hono<AppEnvWithDB>();

/**
 * GET /api/plans
 *
 * Returns all active subscription plans
 * Cache: 7 days (pricing rarely changes)
 */
plans.get(
  '/',
  kvCache({
    ttl: 60 * 60 * 24 * 7, // 7 days
    cacheControl: 'public, max-age=86400', // Client cache 1 day
    keyGenerator: () => buildCacheKey('plans', 'all'),
  }),
  async (c) => {
    // Get Drizzle instance from context
    const db = c.get('db');

    // Query active plans using type-safe service
    const dbPlans = await getActivePlans(db);

    // Parse features field (stored as JSON text in DB)
    const plans = dbPlans.map((p) => {
      let features: unknown = p.features;
      if (typeof features === 'string') {
        try {
          features = JSON.parse(features);
        } catch {
          console.error('Failed to parse plan features for plan:', p.id);
          features = {};
        }
      }
      return { ...p, features };
    });

    return c.json({
      success: true,
      plans,
    });
  }
);

export default plans;
