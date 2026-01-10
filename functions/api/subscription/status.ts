/**
 * Get detailed subscription status
 *
 * GET /api/subscription/status
 * Returns: Full subscription details including plan info
 */

import { requireAuth } from '../../../lib/auth.server';
import { createCacheLayer } from '../../../lib/cache';
import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  CACHE: KVNamespace;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    // Require authentication
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult; // Return 401 if not authenticated
    }

    const { user } = authResult;
    const cache = createCacheLayer(env.CACHE);

    // Try cache first
    let subscription = await cache.subscriptions.getUserSubscription(user.id);

    if (!subscription) {
      // Cache miss - query D1
      const dbSub = await env.DB.prepare(
        `SELECT
           s.id,
           s.status,
           s.plan_id,
           s.current_period_start,
           s.current_period_end,
           s.trial_start,
           s.trial_end,
           s.solidgate_subscription_id,
           s.created_at,
           p.name as plan_name,
           p.price as plan_price,
           p.currency as plan_currency,
           p.billing_period as plan_billing_period,
           p.features as plan_features
         FROM subscriptions s
         JOIN plans p ON s.plan_id = p.id
         WHERE s.user_id = ?
         ORDER BY s.created_at DESC
         LIMIT 1`
      )
        .bind(user.id)
        .first();

      if (dbSub) {
        const features = JSON.parse(dbSub.plan_features as string);
        subscription = {
          id: dbSub.id,
          status: dbSub.status as string,
          planId: dbSub.plan_id as string,
          planName: dbSub.plan_name,
          planPrice: dbSub.plan_price,
          planCurrency: dbSub.plan_currency,
          planBillingPeriod: dbSub.plan_billing_period,
          planFeatures: features,
          currentPeriodStart: dbSub.current_period_start,
          currentPeriodEnd: dbSub.current_period_end,
          trialStart: dbSub.trial_start,
          trialEnd: dbSub.trial_end,
          solidgateSubscriptionId: dbSub.solidgate_subscription_id,
          hasAccess: features.episodeAccess === 'all',
          cachedAt: Date.now(),
        };

        // Cache for next request
        await cache.subscriptions.setUserSubscription(user.id, subscription);
      }
    }

    if (!subscription) {
      return new Response(
        JSON.stringify({
          hasSubscription: false,
          subscription: null,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        hasSubscription: true,
        subscription,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Subscription status error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to get subscription status',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
