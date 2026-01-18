/**
 * Linked Accounts Hook
 *
 * Uses React Query to fetch and cache linked OAuth accounts.
 * Prevents duplicate API calls from React StrictMode.
 */

import { useQuery } from '@tanstack/react-query';
import { authClient } from '@/lib/auth.client';

interface LinkedAccount {
  id: string;
  provider: string;
  createdAt?: Date;
}

/**
 * Hook to fetch linked OAuth accounts with caching
 *
 * Benefits:
 * - Deduplicates concurrent requests (fixes StrictMode double-fetch)
 * - Caches results for 5 minutes
 * - Only fetches when user is authenticated
 */
export function useLinkedAccounts(isAuthenticated: boolean) {
  return useQuery({
    queryKey: ['linked-accounts'],
    queryFn: async (): Promise<LinkedAccount[]> => {
      const result = await authClient.listAccounts();
      if (!result.data) return [];

      return result.data.map((acc) => ({
        id: acc.id,
        provider: acc.providerId,
        createdAt: acc.createdAt,
      }));
    },
    // Only fetch if user is authenticated
    enabled: isAuthenticated,
    // Cache for 5 minutes - linked accounts rarely change
    staleTime: 5 * 60 * 1000,
    // Keep showing previous data during refetch
    placeholderData: (prev) => prev,
  });
}
