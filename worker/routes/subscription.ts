/**
 * Subscription API Routes
 *
 * Handles user subscription checking and status endpoints
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { getActivePlans, getPlanById } from '../db/services/plans.service';
import { subscriptions } from '../../db/schema';
import type { AppEnvWithDB } from '../db/types';
import { Errors } from '../lib/errors';
import { subscribeBodySchema, validationHook } from '../lib/schemas';
import {
  getCachedSubscription,
  createSubCookie,
  parsePlanFeatures,
} from '../lib/subscription-helpers';

const subscription = new Hono<AppEnvWithDB>();

/**
 * GET /api/subscription/status
 *
 * Returns user's current subscription status (cache-first with D1 fallback)
 * Also sets/refreshes the subscription cookie if user has active subscription.
 */
subscription.get('/status', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ hasSubscription: false });
  }

  const cachedSub = await getCachedSubscription(c.get('cache'), c.get('db'), userId);

  if (cachedSub?.hasAccess) {
    const subCookie = await createSubCookie(
      cachedSub.currentPeriodEnd,
      cachedSub.planId,
      c.env.BETTER_AUTH_SECRET,
      c.env.BETTER_AUTH_URL
    );

    return c.json(
      {
        hasSubscription: true,
        subscription: {
          status: cachedSub.status,
          planId: cachedSub.planId,
          currentPeriodEnd: cachedSub.currentPeriodEnd,
          planFeatures: cachedSub.planFeatures,
        },
      },
      200,
      { 'Set-Cookie': subCookie }
    );
  }

  return c.json({ hasSubscription: false });
});

/**
 * GET /api/subscription/plans
 *
 * Returns all active subscription plans
 */
subscription.get('/plans', async (c) => {
  const plans = await getActivePlans(c.get('db'));

  const parsedPlans = plans.map((plan) => ({
    ...plan,
    features: parsePlanFeatures(plan.features),
  }));

  return c.json({ plans: parsedPlans });
});

/**
 * POST /api/subscription/subscribe
 *
 * Subscribe user to a plan (mock payment - skips actual payment processing)
 */
subscription.post(
  '/subscribe',
  zValidator('json', subscribeBodySchema, validationHook),
  async (c) => {
    const userId = c.get('userId');
    if (!userId) {
      throw Errors.unauthorized();
    }

    const { planId } = c.req.valid('json');
    const db = c.get('db');
    const cache = c.get('cache');

    // Verify plan exists
    const plan = await getPlanById(db, planId);
    if (!plan) {
      throw Errors.notFound('Plan', planId);
    }

    // Check for existing active subscription
    const existingSub = await getCachedSubscription(cache, db, userId);
    if (existingSub?.hasAccess) {
      throw Errors.conflict('User already has an active subscription');
    }

    // Calculate subscription dates
    const now = new Date();
    const hasTrial = plan.trialDays > 0;
    const trialEnd = hasTrial
      ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000)
      : null;

    const periodDays =
      plan.billingPeriod === 'yearly' ? 365 :
      plan.billingPeriod === 'weekly' ? 7 : 30;
    const periodStart = trialEnd || now;
    const periodEnd = new Date(periodStart.getTime() + periodDays * 24 * 60 * 60 * 1000);
    const status = hasTrial ? 'trial' : 'active';

    // Create subscription in D1
    const subscriptionId = crypto.randomUUID();
    await db.insert(subscriptions).values({
      id: subscriptionId,
      userId,
      planId,
      status,
      solidgateOrderId: null,
      solidgateSubscriptionId: null,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      trialStart: hasTrial ? now : null,
      trialEnd,
      canceledAt: null,
      endedAt: null,
    });

    // Update cache
    const expiresAt = Math.floor(periodEnd.getTime() / 1000);
    const ttlSeconds = expiresAt - Math.floor(Date.now() / 1000);
    await cache.subscriptions.setUserSubscription(userId, {
      status,
      planId,
      planFeatures: parsePlanFeatures(plan.features),
      currentPeriodEnd: expiresAt,
      hasAccess: true,
    }, ttlSeconds);

    await cache.userProfiles.invalidateUserProfile(userId);

    // Create cookie
    const subCookie = await createSubCookie(
      expiresAt,
      planId,
      c.env.BETTER_AUTH_SECRET,
      c.env.BETTER_AUTH_URL
    );

    return c.json(
      {
        success: true,
        subscription: {
          id: subscriptionId,
          planId,
          status,
          currentPeriodStart: Math.floor(periodStart.getTime() / 1000),
          currentPeriodEnd: expiresAt,
          trialDays: plan.trialDays,
        },
      },
      200,
      { 'Set-Cookie': subCookie }
    );
  }
);

export default subscription;
