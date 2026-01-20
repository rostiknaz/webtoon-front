/**
 * Subscription Hook - Hybrid Cookie/API Approach
 *
 * - Instant UI from signed cookie (0ms, $0 cost)
 * - Background sync via TanStack Query
 * - 90% cookie / 10% API split for cost optimization
 */

import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSubscriptionStatus,
  getSubscriptionSync,
  type SubscriptionData,
  subscriptionQueryKey,
} from '@/services/subscription.service';

interface UseSubscriptionOptions {
  /** Is user authenticated - API validation only runs when true */
  isAuthenticated?: boolean;
  /** API cache stale time in ms (default: 5 minutes) */
  staleTime?: number;
}

const DEFAULT_STALE_TIME = 5 * 60 * 1000;

const NO_SUBSCRIPTION: SubscriptionData = {
  hasSubscription: false,
  expiresAt: 0,
  planId: null,
  planFeatures: null,
  source: 'none',
};

/**
 * Get subscription status with hybrid cookie/API approach
 */
export function useSubscription(options: UseSubscriptionOptions = {}) {
  const { isAuthenticated = false, staleTime = DEFAULT_STALE_TIME } = options;
  const queryClient = useQueryClient();
  const [cookieVersion, setCookieVersion] = useState(0);

  // Instant data from cookie
  const cookieData = useMemo(() => getSubscriptionSync(), [cookieVersion]);

  // Background API validation - only when authenticated
  const apiQuery = useQuery({
    queryKey: subscriptionQueryKey,
    queryFn: fetchSubscriptionStatus,
    enabled: isAuthenticated,
    staleTime,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  // Merged data: API (validated) > Cookie (instant) > None
  const data = apiQuery.data?.source === 'api'
    ? apiQuery.data
    : cookieData.source !== 'none'
      ? cookieData
      : NO_SUBSCRIPTION;

  const source = apiQuery.data?.source === 'api'
    ? 'api'
    : cookieData.source === 'cookie'
      ? 'cookie'
      : 'none';

  // Re-read cookie and refetch API
  const refresh = useCallback(async (): Promise<SubscriptionData> => {
    setCookieVersion((v) => v + 1);

    if (isAuthenticated) {
      await queryClient.invalidateQueries({ queryKey: subscriptionQueryKey });
      return queryClient.fetchQuery({
        queryKey: subscriptionQueryKey,
        queryFn: fetchSubscriptionStatus,
      });
    }

    return getSubscriptionSync();
  }, [isAuthenticated, queryClient]);

  // Force fresh API validation
  const validateWithApi = useCallback((): Promise<SubscriptionData> => {
    return queryClient.fetchQuery({
      queryKey: subscriptionQueryKey,
      queryFn: fetchSubscriptionStatus,
      staleTime: 0,
    });
  }, [queryClient]);

  return {
    data,
    source,
    isPending: isAuthenticated && apiQuery.isPending && !cookieData.hasSubscription,
    isFetching: apiQuery.isFetching,
    error: apiQuery.error,
    refresh,
    validateWithApi,
  } as const;
}

/**
 * Imperative subscription check for user actions
 * (episode switching, playback start, premium content access)
 */
export function checkSubscriptionStatus() {
  const data = getSubscriptionSync();
  return {
    hasSubscription: data.hasSubscription,
    expiresAt: data.expiresAt,
    planId: data.planId,
    justExpired: data.expiresAt > 0 && !data.hasSubscription,
  };
}

/**
 * Hook to invalidate subscription cache
 */
export function useInvalidateSubscription() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: subscriptionQueryKey }),
    [queryClient]
  );
}
