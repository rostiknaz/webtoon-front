/**
 * Creator Clips Hook
 *
 * TanStack Query for creator's own clips with smart polling:
 * refetchInterval active only when clips in 'processing' status exist.
 */

import { useQuery, queryOptions } from '@tanstack/react-query';
import { getCreatorClips } from '../api';

export function creatorClipsQueryOptions() {
  return queryOptions({
    queryKey: ['clips', 'mine'] as const,
    queryFn: getCreatorClips,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useCreatorClips() {
  const query = useQuery({
    ...creatorClipsQueryOptions(),
    // Poll every 5s when any clip is still processing
    refetchInterval: (query) => {
      const hasProcessing = query.state.data?.clips.some(
        (clip) => clip.status === 'processing',
      );
      return hasProcessing ? 5000 : false;
    },
  });

  return query;
}
