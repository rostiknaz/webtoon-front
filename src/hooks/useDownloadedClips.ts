/**
 * Hook to track which clips the current user has downloaded.
 * Returns a Set for O(1) lookup and a helper to check individual clips.
 */

import { useQuery } from '@tanstack/react-query';
import { getMyDownloadIds } from '@/api';
import { useOptimizedSession } from '@/hooks/useOptimizedSession';

export const downloadedClipsQueryKey = ['downloaded-clips'] as const;

export function useDownloadedClips() {
  const { data: session } = useOptimizedSession();
  const isAuthenticated = !!session;

  const query = useQuery({
    queryKey: downloadedClipsQueryKey,
    queryFn: getMyDownloadIds,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  const downloadedSet = new Set(query.data ?? []);

  return {
    isDownloaded: (clipId: string) => downloadedSet.has(clipId),
    isLoading: query.isPending,
  };
}
