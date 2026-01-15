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
  // Get userId and cache from context (cached by middleware)
  const userId = c.get('userId');
  const cache = c.get('cache');

  if (!userId) {
    return c.json({ hasSubscription: false });
  }

  // Try cache first
  const cachedSub = await cache.subscriptions.getUserSubscription(userId);

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
  // Get userId and cache from context (cached by middleware)
  const userId = c.get('userId');
  const cache = c.get('cache');

  if (!userId) {
    throw Errors.unauthorized();
  }

  // Try cache first
  const cachedSub = await cache.subscriptions.getUserSubscription(userId);

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

    // Check if user already has an active subscription
    const existingSub = await getUserSubscription(db, userId);
    if (existingSub && ['active', 'trial'].includes(existingSub.status)) {
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

    // Invalidate cache immediately to ensure fresh data on next request
    await cache.subscriptions.invalidateUserSubscription(userId);
    await cache.userProfiles.invalidateUserProfile(userId);

    // Set subscription cookie for client-side access checks
    const expiresAt = Math.floor(periodEnd.getTime() / 1000);
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
