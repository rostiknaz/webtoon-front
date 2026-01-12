/**
 * Subscription API Routes
 *
 * Handles user subscription checking and status endpoints
 */

import { Hono } from 'hono';
import { createCacheLayer } from '../../lib/cache';
import { getUserSubscription } from '../db/services/subscription.service';
import { getActivePlans, getPlanById } from '../db/services/plans.service';
import { subscriptions } from '../../db/schema';
import type { AppEnvWithDB } from '../db/types';

const subscription = new Hono<AppEnvWithDB>();

/**
 * GET /api/subscription/check
 *
 * Returns boolean indicating if user has active subscription
 * Used by frontend to quickly check access without full details
 *
 * Response: { hasSubscription: boolean }
 */
subscription.get('/check', async (c) => {
  try {
    // Get session from Better Auth
    const auth = c.get('auth');
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session?.user?.id) {
      return c.json({ hasSubscription: false });
    }

    const userId = session.user.id;
    const cache = createCacheLayer(c.env.CACHE);

    // Try cache first
    let cachedSub = await cache.subscriptions.getUserSubscription(userId);

    if (cachedSub) {
      return c.json({ hasSubscription: cachedSub.hasAccess });
    }

    // Cache miss - query D1
    const db = c.get('db');
    const dbSub = await getUserSubscription(db, userId);

    const hasSubscription = !!dbSub &&
      ['active', 'trial'].includes(dbSub.status) &&
      (!dbSub.currentPeriodEnd || dbSub.currentPeriodEnd > Date.now() / 1000);

    // Cache for 1 hour
    if (dbSub) {
      await cache.subscriptions.setUserSubscription(userId, {
        status: dbSub.status,
        planId: dbSub.planId,
        planFeatures: dbSub.planFeatures,
        currentPeriodEnd: dbSub.currentPeriodEnd || 0,
        hasAccess: hasSubscription,
        cachedAt: Date.now(),
      });
    }

    return c.json({ hasSubscription });
  } catch (error) {
    console.error('Subscription check error:', error);
    return c.json({ hasSubscription: false }, 500);
  }
});

/**
 * GET /api/subscription/status
 *
 * Returns full subscription details for authenticated user
 *
 * Response: {
 *   subscription: {
 *     status: string,
 *     planId: string,
 *     planName: string,
 *     currentPeriodStart: number,
 *     currentPeriodEnd: number,
 *     canceledAt: number | null,
 *     features: object
 *   } | null
 * }
 */
subscription.get('/status', async (c) => {
  try {
    // Get session from Better Auth
    const auth = c.get('auth');
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session?.user?.id) {
      return c.json({ subscription: null }, 401);
    }

    const userId = session.user.id;
    const cache = createCacheLayer(c.env.CACHE);

    // Try cache first
    let cachedSub = await cache.subscriptions.getUserSubscription(userId);

    if (cachedSub) {
      return c.json({
        subscription: {
          status: cachedSub.status,
          planId: cachedSub.planId,
          planFeatures: cachedSub.planFeatures,
          currentPeriodEnd: cachedSub.currentPeriodEnd,
          hasAccess: cachedSub.hasAccess,
        },
      });
    }

    // Cache miss - query D1
    const db = c.get('db');
    const dbSub = await getUserSubscription(db, userId);

    if (!dbSub) {
      return c.json({ subscription: null });
    }

    const hasAccess = ['active', 'trial'].includes(dbSub.status) &&
      (!dbSub.currentPeriodEnd || dbSub.currentPeriodEnd > Date.now() / 1000);

    // Cache for 1 hour
    await cache.subscriptions.setUserSubscription(userId, {
      status: dbSub.status,
      planId: dbSub.planId,
      planFeatures: dbSub.planFeatures,
      currentPeriodEnd: dbSub.currentPeriodEnd || 0,
      hasAccess,
      cachedAt: Date.now(),
    });

    return c.json({
      subscription: {
        status: dbSub.status,
        planId: dbSub.planId,
        planName: dbSub.planName,
        currentPeriodStart: dbSub.currentPeriodStart,
        currentPeriodEnd: dbSub.currentPeriodEnd,
        canceledAt: dbSub.canceledAt,
        features: dbSub.planFeatures,
        hasAccess,
      },
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    return c.json({ error: 'Failed to fetch subscription status' }, 500);
  }
});

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
  try {
    const db = c.get('db');
    const plans = await getActivePlans(db);

    // Parse features JSON for each plan
    const parsedPlans = plans.map((plan: typeof plans[0]) => ({
      ...plan,
      features: typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features,
    }));

    return c.json({ plans: parsedPlans });
  } catch (error) {
    console.error('Plans fetch error:', error);
    return c.json({ error: 'Failed to fetch plans' }, 500);
  }
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
subscription.post('/subscribe', async (c) => {
  try {
    // Get session from Better Auth
    const auth = c.get('auth');
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session?.user?.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = session.user.id;
    const body = await c.req.json<{ planId: string }>();
    const { planId } = body;

    if (!planId) {
      return c.json({ error: 'Plan ID is required' }, 400);
    }

    const db = c.get('db');

    // Verify plan exists
    const plan = await getPlanById(db, planId);
    if (!plan) {
      return c.json({ error: 'Plan not found' }, 404);
    }

    // Check if user already has an active subscription
    const existingSub = await getUserSubscription(db, userId);
    if (existingSub && ['active', 'trial'].includes(existingSub.status)) {
      return c.json({ error: 'User already has an active subscription' }, 400);
    }

    // Calculate subscription dates
    const now = new Date();
    const hasTrial = plan.trialDays > 0;
    const trialEnd = hasTrial ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000) : null;

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

    // Invalidate cache immediately to ensure fresh data on next request
    const cache = createCacheLayer(c.env.CACHE);
    await cache.subscriptions.invalidateUserSubscription(userId);
    await cache.userProfiles.invalidateUserProfile(userId);

    return c.json({
      success: true,
      subscription: {
        id: subscriptionId,
        planId,
        status: hasTrial ? 'trial' : 'active',
        currentPeriodStart: Math.floor(periodStart.getTime() / 1000),
        currentPeriodEnd: Math.floor(periodEnd.getTime() / 1000),
        trialDays: plan.trialDays,
      },
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    return c.json({ error: 'Failed to create subscription' }, 500);
  }
});

export default subscription;
