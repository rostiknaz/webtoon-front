/**
 * Shared subscription helper functions
 *
 * Used by subscription routes and subscription-cookie-plugin
 */

import { getUserSubscription } from '../db/services/subscription.service';
import { createSubscriptionSetCookie } from './subscription-cookie';
import type { CacheLayer } from '../../lib/cache';
import type { DB } from '../db';

/** Plan features structure matching cache expectations */
export interface PlanFeatures {
  episodeAccess: string;
  adFree: boolean;
}

/**
 * Creates fetcher function for cache.subscriptions.getOrFetchUserSubscription
 */
export function createSubscriptionFetcher(db: DB, userId: string) {
  return async () => {
    const sub = await getUserSubscription(db, userId);
    if (sub?.hasAccess && sub.currentPeriodEnd) {
      return {
        status: sub.status,
        planId: sub.planId,
        planFeatures: sub.planFeatures,
        currentPeriodEnd: sub.currentPeriodEnd,
        hasAccess: true,
        cachedAt: Date.now(),
      };
    }
    return null;
  };
}

/**
 * Gets user's cached subscription using cache-first pattern
 */
export async function getCachedSubscription(cache: CacheLayer, db: DB, userId: string) {
  return cache.subscriptions.getOrFetchUserSubscription(
    userId,
    createSubscriptionFetcher(db, userId)
  );
}

/**
 * Creates subscription cookie for response
 */
export async function createSubCookie(
  expiresAt: number,
  planId: string | null,
  secret: string,
  authUrl: string
) {
  const isSecure = authUrl.startsWith('https');
  return createSubscriptionSetCookie(expiresAt, planId, secret, isSecure);
}

/**
 * Parses plan features from JSON string or returns as-is
 */
export function parsePlanFeatures(features: string | object): PlanFeatures {
  if (typeof features !== 'string') return features as PlanFeatures;
  try {
    return JSON.parse(features);
  } catch {
    console.error('Failed to parse plan features:', features?.slice(0, 100));
    return { episodeAccess: 'none', adFree: false };
  }
}
