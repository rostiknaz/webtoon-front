/**
 * Subscription API Routes
 *
 * Handles user subscription checking, status, and Solidgate subscription purchase.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { getActivePlans, getPlanById } from '../db/services/plans.service';
import type { AppEnvWithDB } from '../db/types';
import { Errors } from '../lib/errors';
import { subscribeBodySchema, validationHook } from '../lib/schemas';
import { createPaymentLink } from '../lib/solidgate';
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
 * Always sets/refreshes the subscription cookie to sync client state.
 */
subscription.get('/status', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ hasSubscription: false });
  }

  const cachedSub = await getCachedSubscription(c.get('cache'), c.get('db'), userId);

  // Always set cookie to sync client state (even when no subscription)
  const subCookie = await createSubCookie(
    cachedSub?.hasAccess ? cachedSub.currentPeriodEnd : 0,
    cachedSub?.planId ?? null,
    c.env.BETTER_AUTH_SECRET,
    c.env.BETTER_AUTH_URL
  );

  if (cachedSub?.hasAccess) {
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

  return c.json({ hasSubscription: false }, 200, { 'Set-Cookie': subCookie });
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
 * Creates a Solidgate payment link for recurring subscription billing.
 * Does NOT create subscription directly — that happens via subscription.created webhook.
 */
subscription.post(
  '/subscribe',
  zValidator('json', subscribeBodySchema, validationHook),
  async (c) => {
    const userId = c.get('userId');
    if (!userId) {
      throw Errors.unauthorized();
    }

    const { planId, clipId } = c.req.valid('json');
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

    const session = c.get('session');
    const email = session?.user?.email;
    if (!email) {
      throw Errors.unauthorized();
    }

    const baseUrl = c.env.BETTER_AUTH_URL;
    const clipParam = clipId ? `&clipId=${encodeURIComponent(clipId)}` : '';
    const successUrl = `${baseUrl}/?purchase=subscription-success${clipParam}`;
    const failUrl = `${baseUrl}/?purchase=failed`;

    const paymentUrl = await createPaymentLink(c.env, {
      orderId: crypto.randomUUID(),
      amount: Math.round(plan.price * 100), // Convert dollars to cents
      currency: plan.currency,
      customerEmail: email,
      orderDescription: `${plan.name} Subscription`,
      orderMetadata: {
        type: 'subscription',
        plan_id: planId,
        user_id: userId,
        clip_id: clipId ?? '',
      },
      successUrl,
      failUrl,
      subscription: { product_id: plan.solidgateProductId },
    });

    return c.json({ paymentUrl });
  }
);

export default subscription;
