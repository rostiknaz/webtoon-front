/**
 * Credits Hook
 *
 * TanStack Query hook for fetching credit balance from the API.
 * Uses the credit cookie as initial data for instant display,
 * then background-refetches from the API for accuracy.
 *
 * This ensures admin-side balance changes propagate to the client
 * without requiring a sign-out/sign-in cycle.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCreditsBalance } from '@/api';
import { useOptimizedSession } from '@/hooks/useOptimizedSession';
import { parseCreditCookie } from '@/lib/credit-cookie';

export const creditsQueryKey = ['credits'] as const;

export function useCredits() {
  const { data: session } = useOptimizedSession();
  const isAuthenticated = !!session;

  // Memoize cookie parsing — only re-parse when auth state changes
  // Avoids O(n) cookie iteration + base64 + JSON.parse on every render
  const cookieData = useMemo(
    () => (isAuthenticated ? parseCreditCookie() : null),
    [isAuthenticated]
  );

  const query = useQuery({
    queryKey: creditsQueryKey,
    queryFn: getCreditsBalance,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes — matches architecture doc
    refetchOnWindowFocus: true, // catch admin changes on tab focus
    placeholderData: cookieData
      ? { balance: cookieData.bal, freeDownloads: cookieData.free }
      : undefined,
  });

  const balance = query.data?.balance ?? cookieData?.bal ?? 0;
  const freeDownloads = query.data?.freeDownloads ?? cookieData?.free ?? 0;
  const totalCredits = balance + freeDownloads;

  return {
    balance,
    freeDownloads,
    totalCredits,
    isLoading: query.isPending && !cookieData,
  };
}
