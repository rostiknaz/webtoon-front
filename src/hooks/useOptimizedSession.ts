/**
 * Optimized Session Hook
 *
 * Custom session management that avoids API calls for guests.
 * Checks for session cookie existence before fetching session data.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/auth.client';
import { mightHaveSession } from '@/lib/cookies';

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

/**
 * Optimized session hook that skips API calls when no session cookie exists
 *
 * Flow:
 * 1. Check if session_data cookie exists (synchronous, ~0ms)
 * 2. If no cookie → return guest state immediately (no API call)
 * 3. If cookie exists → fetch session from API
 *
 * This prevents the get-session API call for guest users.
 */
export function useOptimizedSession() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['session'],
    queryFn: async (): Promise<SessionData | null> => {
      const result = await authClient.getSession();
      return result.data;
    },
    // Only fetch if session cookie might exist
    enabled: mightHaveSession(),
    // Cache session for 5 minutes (matches cookie cache)
    staleTime: 5 * 60 * 1000,
    // Don't refetch on window focus for performance
    refetchOnWindowFocus: false,
    // Keep previous data during refetch
    placeholderData: (prev) => prev,
  });

  return {
    data: query.data ?? null,
    isPending: query.isPending && mightHaveSession(),
    error: query.error,
    refetch: async () => {
      // Invalidate and refetch
      await queryClient.invalidateQueries({ queryKey: ['session'] });
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
