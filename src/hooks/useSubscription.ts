/**
 * Subscription Hook
 *
 * Automatically fetches and caches subscription status when user is authenticated.
 * Acts as a "middleware" layer providing subscription data to components.
 */

import { useQuery } from '@tanstack/react-query';
import { authClient } from '@/lib/auth.client';
import { checkSubscription } from '@/api';

/**
 * Hook to get user's subscription status
 *
 * - Only fetches when user is authenticated
 * - Caches result for 5 minutes (staleTime)
 * - Automatically refetches on window focus
 * - Returns loading state and subscription data
 */
export function useSubscription() {
  const session = authClient.useSession();
  const isAuthenticated = !!session.data?.user;

  return useQuery({
    queryKey: ['subscription', session.data?.user?.id],
    queryFn: checkSubscription,
    // Only run query if user is authenticated
    enabled: isAuthenticated,
    // Cache for 10 minutes (matches KV cache TTL for consistency)
    staleTime: 10 * 60 * 1000,
    // Don't refetch on mount if we have cached data
    refetchOnMount: false,
    // Don't refetch on window focus - reduces unnecessary API calls
    // Subscription changes are rare and handled explicitly (after purchase)
    refetchOnWindowFocus: false,
    // Retry once on failure
    retry: 1,
    // Provide default value when not authenticated
    placeholderData: { hasSubscription: false },
  });
}
