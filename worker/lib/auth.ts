/**
 * Authentication and authorization helpers
 */

import { createCacheLayer } from '../../lib/cache';
import { createDrizzleClient } from '../db/index';
import { getSessionByToken, getUserSubscription } from '../db/services/auth.service';
import type { Bindings } from './types';

/**
 * Get user session from cookie
 */
export async function getUserSession(request: Request, env: Bindings) {
  try {
    const cookie = request.headers.get('cookie') || '';
    const sessionToken = cookie
      .split(';')
      .find((c) => c.trim().startsWith('webtoon_session='))
      ?.split('=')[1];

    if (!sessionToken) return null;

    // Try KV cache first
    const cached = await env.SESSIONS.get(`session:${sessionToken}`, 'json');
    if (cached) return cached;

    // Fallback to D1 using Drizzle
    const db = createDrizzleClient(env.DB);
    const session = await getSessionByToken(db, sessionToken);

    return session;
  } catch (error) {
    console.error('Session fetch error:', error);
    return null;
  }
}

/**
 * Check if user has active platform-wide subscription
 */
export async function checkUserSubscription(userId: string, env: Bindings): Promise<boolean> {
  const cache = createCacheLayer(env.CACHE);

  // Try cache first
  let subscription = await cache.subscriptions.getUserSubscription(userId);

  if (!subscription) {
    // Cache miss - query D1 using Drizzle
    const db = createDrizzleClient(env.DB);
    const dbSub = await getUserSubscription(db, userId);

    if (dbSub) {
      subscription = {
        status: dbSub.status,
        planId: '',
        planFeatures: { episodeAccess: 'all', adFree: true },
        currentPeriodEnd: dbSub.currentPeriodEnd ?? 0,
        hasAccess: true,
        cachedAt: Date.now(),
      };

      // Cache for 1 hour
      await cache.subscriptions.setUserSubscription(userId, subscription);
    }
  }

  return !!subscription;
}
