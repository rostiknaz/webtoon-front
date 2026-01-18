/**
 * Optimized Session Hook
 *
 * React Query-based session management with automatic caching and deduplication.
 * Shares cache between components and route loaders to prevent duplicate API calls.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/auth.client';

interface SessionUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface SessionData {
  user: SessionUser;
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
}

/** Query key for session - shared between hook and prefetch */
export const sessionQueryKey = ['session'] as const;

/** Query function for fetching session */
export async function fetchSession(): Promise<SessionData | null> {
  const result = await authClient.getSession();
  return result.data ?? null;
}

/**
 * Optimized session hook using React Query
 *
 * Benefits:
 * - Automatic request deduplication (multiple components share one request)
 * - 5-minute cache (matches server-side cookie cache)
 * - Shared cache with route loaders via prefetchSession()
 */
export function useOptimizedSession() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: sessionQueryKey,
    queryFn: fetchSession,
    // Cache session for 5 minutes (matches server cookie cache)
    staleTime: 5 * 60 * 1000,
    // Don't refetch on window focus for performance
    refetchOnWindowFocus: false,
    // Keep previous data during refetch
    placeholderData: (prev) => prev,
  });

  return {
    data: query.data ?? null,
    isPending: query.isPending,
    error: query.error,
    refetch: async () => {
      // Invalidate and refetch
      await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      return query.refetch();
    },
  };
}

/**
 * Invalidate session cache (call after login/logout)
 */
export function useInvalidateSession() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['session'] });
  };
}
