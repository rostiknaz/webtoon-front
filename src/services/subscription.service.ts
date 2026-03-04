/**
 * Subscription Service
 *
 * Hybrid approach for subscription status checking:
 * 1. First, read from signed cookie (instant, 0ms latency)
 * 2. If no cookie, fallback to API call (cached on server via KV)
 *
 * Benefits:
 * - Cookie check: $0 cost, 0ms latency for 90% of UI checks
 * - API fallback: Handles cases where cookie is missing/expired
 * - Server validates on sensitive operations (payments, premium content)
 */

import {
  hasActiveSubscription,
  getSubscriptionExpiry,
  getSubscriptionPlanId,
  hasSubscriptionCookie,
} from '@/lib/subscription-cookie';
import { getSubscriptionStatus } from '@/api';
import type { SubscriptionStatusResponse, PlanFeatures } from '@/types';

/**
 * Subscription data structure used throughout the app
 */
export interface SubscriptionData {
  hasSubscription: boolean;
  expiresAt: number; // Unix timestamp (seconds), 0 if no subscription
  planId: string | null;
  planFeatures: PlanFeatures | null;
  source: 'cookie' | 'api' | 'none';
}

/**
 * Default subscription data for users without subscription
 */
const NO_SUBSCRIPTION: SubscriptionData = {
  hasSubscription: false,
  expiresAt: 0,
  planId: null,
  planFeatures: null,
  source: 'none',
};

/**
 * Get subscription status from cookie (instant, no network call)
 *
 * @returns SubscriptionData from cookie or null if no cookie exists
 */
export function getSubscriptionFromCookie(): SubscriptionData | null {
  // Check if cookie exists first
  if (!hasSubscriptionCookie()) {
    return null;
  }

  const hasSubscription = hasActiveSubscription();
  const expiresAt = getSubscriptionExpiry();
  const planId = getSubscriptionPlanId();

  // Cookie exists - return data from it (active, expired, or no subscription)
  return {
    hasSubscription,
    expiresAt,
    planId,
    planFeatures: null, // Cookie doesn't store features
    source: 'cookie',
  };
}

/**
 * Get subscription status from API (server-side cache-first)
 *
 * @returns SubscriptionData from API
 */
export async function getSubscriptionFromApi(): Promise<SubscriptionData> {
  try {
    const response: SubscriptionStatusResponse = await getSubscriptionStatus();

    if (response.hasSubscription && response.subscription) {
      return {
        hasSubscription: true,
        expiresAt: response.subscription.currentPeriodEnd,
        planId: response.subscription.planId,
        planFeatures: response.subscription.planFeatures,
        source: 'api',
      };
    }

    return { ...NO_SUBSCRIPTION, source: 'api' };
  } catch (error) {
    console.error('Failed to fetch subscription status from API:', error);
    return NO_SUBSCRIPTION;
  }
}

/**
 * Get subscription status using hybrid approach
 *
 * Priority:
 * 1. Cookie (instant) - for UI gating, feature flags
 * 2. API (cached on server) - fallback when no cookie
 *
 * @param forceApi - Skip cookie check and always use API (for sensitive operations)
 * @returns SubscriptionData
 */
export async function getSubscription(forceApi = false): Promise<SubscriptionData> {
  // For sensitive operations, always use API
  if (forceApi) {
    return getSubscriptionFromApi();
  }

  // Try cookie first (instant, $0 cost)
  const cookieData = getSubscriptionFromCookie();
  if (cookieData !== null) {
    return cookieData;
  }

  // No cookie - fallback to API
  return getSubscriptionFromApi();
}

/**
 * Sync function to get subscription from cookie only
 * Use this for immediate UI rendering without async
 *
 * @returns SubscriptionData from cookie or default no-subscription state
 */
export function getSubscriptionSync(): SubscriptionData {
  const cookieData = getSubscriptionFromCookie();
  return cookieData ?? NO_SUBSCRIPTION;
}

/**
 * Check if subscription grants access (for UI gating)
 * Uses cookie-first approach for instant response
 *
 * @returns boolean
 */
export function hasSubscriptionAccess(): boolean {
  return hasActiveSubscription();
}

/**
 * Query key for subscription status (TanStack Query)
 */
export const subscriptionQueryKey = ['subscription-status'] as const;

/**
 * Query function for TanStack Query
 * Always calls the API to get fresh data (the cookie is used as
 * placeholderData in the hook, not here). The API response also
 * refreshes the cookie via Set-Cookie header.
 */
export async function fetchSubscriptionStatus(): Promise<SubscriptionData> {
  return getSubscriptionFromApi();
}
