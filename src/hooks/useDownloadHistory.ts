/**
 * Hook for paginated download history using TanStack Query infinite queries.
 * Enabled only when authenticated.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { getDownloadHistory } from '@/api';
import { useOptimizedSession } from '@/hooks/useOptimizedSession';

export const downloadHistoryQueryKey = ['download-history'] as const;

export function useDownloadHistory() {
  const { data: session } = useOptimizedSession();
  const isAuthenticated = !!session;

  return useInfiniteQuery({
    queryKey: [...downloadHistoryQueryKey, session?.user?.id],
    queryFn: ({ pageParam }) => getDownloadHistory(pageParam, 20),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000,
  });
}
