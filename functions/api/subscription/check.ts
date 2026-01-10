/**
 * Check if user has active subscription
 *
 * GET /api/subscription/check
 * Returns: { hasSubscription: boolean }
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
        `SELECT s.status, s.plan_id, s.current_period_end, p.features
         FROM subscriptions s
         JOIN plans p ON s.plan_id = p.id
         WHERE s.user_id = ?
           AND s.status IN ('active', 'trial')
           AND (s.current_period_end IS NULL OR s.current_period_end > unixepoch())
         LIMIT 1`
      )
        .bind(user.id)
        .first();

      if (dbSub) {
        const features = JSON.parse(dbSub.features as string);
        subscription = {
          status: dbSub.status as string,
          planId: dbSub.plan_id as string,
          planFeatures: features,
          currentPeriodEnd: dbSub.current_period_end as number,
          hasAccess: features.episodeAccess === 'all',
          cachedAt: Date.now(),
        };

        // Cache for next check
        await cache.subscriptions.setUserSubscription(user.id, subscription);
      }
    }

    return new Response(
      JSON.stringify({
        hasSubscription: !!subscription,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Subscription check error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to check subscription',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
