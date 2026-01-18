/**
 * Subscription API Routes
 *
 * Handles user subscription checking and status endpoints
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { getUserSubscription } from '../db/services/subscription.service';
import { getActivePlans, getPlanById } from '../db/services/plans.service';
import { subscriptions } from '../../db/schema';
import type { AppEnvWithDB } from '../db/types';
import { Errors } from '../lib/errors';
import { subscribeBodySchema, validationHook } from '../lib/schemas';
import { createSubscriptionSetCookie } from '../lib/subscription-cookie';

/**
 * Check if a subscription is currently active
 */
function isSubscriptionActive(sub: { status: string; currentPeriodEnd: number | null }): boolean {
  return ['active', 'trial'].includes(sub.status) &&
    (!sub.currentPeriodEnd || sub.currentPeriodEnd > Date.now() / 1000);
}

const subscription = new Hono<AppEnvWithDB>();

/**
 * GET /api/subscription/plans
 *
 * Returns all active subscription plans
 *
 * Response: {
 *   plans: Array<{
 *     id: string,
 *     name: string,
 *     description: string,
 *     price: number,
 *     currency: string,
 *     billingPeriod: string,
 *     trialDays: number,
 *     features: object
 *   }>
 * }
 */
subscription.get('/plans', async (c) => {
  const db = c.get('db');
  const plans = await getActivePlans(db);

  // Parse features JSON for each plan
  const parsedPlans = plans.map((plan: typeof plans[0]) => ({
    ...plan,
    features: typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features,
  }));

  return c.json({ plans: parsedPlans });
});

/**
 * POST /api/subscription/subscribe
 *
 * Subscribe user to a plan (mock payment - skips actual payment processing)
 *
 * Request body: { planId: string }
 *
 * Response: {
 *   success: boolean,
 *   subscription: {
 *     id: string,
 *     planId: string,
 *     status: string,
 *     currentPeriodStart: number,
 *     currentPeriodEnd: number
 *   }
 * }
 */
subscription.post(
  '/subscribe',
  zValidator('json', subscribeBodySchema, validationHook),
  async (c) => {
    // Get session and cache from context (cached by middleware)
    const userId = c.get('userId');
    const cache = c.get('cache');

    if (!userId) {
      throw Errors.unauthorized();
    }

    const { planId } = c.req.valid('json');

    const db = c.get('db');

    // Verify plan exists
    const plan = await getPlanById(db, planId);
    if (!plan) {
      throw Errors.notFound('Plan', planId);
    }

    // Check for existing subscription (cache-first with stampede prevention)
    const existingSub = await cache.subscriptions.getOrFetchUserSubscription(
      userId,
      async () => {
        const subscription = await getUserSubscription(db, userId);
        if (subscription && isSubscriptionActive(subscription) && subscription.currentPeriodEnd) {
          return {
            status: subscription.status,
            planId: subscription.planId,
            planFeatures: subscription.planFeatures,
            currentPeriodEnd: subscription.currentPeriodEnd,
            hasAccess: true,
            cachedAt: Date.now(),
          };
        }
        return null;
      }
    );

    if (existingSub?.hasAccess) {
      throw Errors.conflict('User already has an active subscription');
    }

    // Calculate subscription dates
    const now = new Date();
    const hasTrial = plan.trialDays > 0;
    const trialEnd = hasTrial
      ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000)
      : null;

    // For monthly: 30 days, for yearly: 365 days
    const periodDays = plan.billingPeriod === 'yearly' ? 365 : 30;
    const periodStart = trialEnd || now;
    const periodEnd = new Date(periodStart.getTime() + periodDays * 24 * 60 * 60 * 1000);

    // Create subscription (mock - skip payment)
    const subscriptionId = crypto.randomUUID();
    await db.insert(subscriptions).values({
      id: subscriptionId,
      userId,
      planId,
      status: hasTrial ? 'trial' : 'active',
      solidgateOrderId: null, // Would be set after real payment
      solidgateSubscriptionId: null,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      trialStart: hasTrial ? now : null,
      trialEnd: trialEnd,
      canceledAt: null,
      endedAt: null,
    });

    // Set subscription in cache with TTL = subscription expiration time
    const expiresAt = Math.floor(periodEnd.getTime() / 1000);
    const ttlSeconds = expiresAt - Math.floor(Date.now() / 1000);
    await cache.subscriptions.setUserSubscription(userId, {
      status: hasTrial ? 'trial' : 'active',
      planId,
      planFeatures: typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features,
      currentPeriodEnd: expiresAt,
      hasAccess: true,
    }, ttlSeconds);

    // Invalidate user profile to force refresh on next request
    await cache.userProfiles.invalidateUserProfile(userId);
    const isSecure = c.env.BETTER_AUTH_URL.startsWith('https');
    const subCookie = await createSubscriptionSetCookie(
      expiresAt,
      planId,
      c.env.BETTER_AUTH_SECRET,
      isSecure
    );

    return c.json(
      {
        success: true,
        subscription: {
          id: subscriptionId,
          planId,
          status: hasTrial ? 'trial' : 'active',
          currentPeriodStart: Math.floor(periodStart.getTime() / 1000),
          currentPeriodEnd: Math.floor(periodEnd.getTime() / 1000),
          trialDays: plan.trialDays,
        },
      },
      200,
      { 'Set-Cookie': subCookie }
    );
  }
);

export default subscription;
