/**
 * Like Mutation Hook with Optimistic Updates
 *
 * Handles episode likes with:
 * - Zustand store for liked state (global, persisted, cross-component sync)
 * - TanStack Query mutations for API calls
 * - Optimistic cache updates for series stats
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { likeEpisode, unlikeEpisode } from '@/api';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import type { SeriesMetadata } from '@/types';

/**
 * Hook for liking/unliking episodes with optimistic updates.
 * Uses Zustand store for cross-component sync (e.g., HybridVideoPlayer
 * and EpisodeSidebar see the same like state).
 */
export function useLikeMutation(episodeId: string) {
  const queryClient = useQueryClient();
  const isLiked = usePreferencesStore((s) => s.likedEpisodes[episodeId]);
  const setLiked = usePreferencesStore((s) => s.setLiked);

  // Update all series caches that contain this episode
  const updateCache = (delta: number) => {
    const queries = queryClient.getQueriesData<SeriesMetadata>({ queryKey: ['serial'] });
    for (const [queryKey, data] of queries) {
      if (!data?.episodes.some((ep) => ep._id === episodeId)) continue;

      queryClient.setQueryData<SeriesMetadata>(queryKey, {
        ...data,
        episodes: data.episodes.map((ep) =>
          ep._id === episodeId ? { ...ep, likes: Math.max(0, (ep.likes ?? 0) + delta) } : ep
        ),
      });
    }
  };

  const likeMutation = useMutation({
    mutationFn: () => likeEpisode(episodeId),
    onMutate: () => {
      setLiked(episodeId, true);
      updateCache(1);
    },
    onError: () => {
      setLiked(episodeId, false);
      updateCache(-1);
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: () => unlikeEpisode(episodeId),
    onMutate: () => {
      setLiked(episodeId, false);
      updateCache(-1);
    },
    onError: () => {
      setLiked(episodeId, true);
      updateCache(1);
    },
  });

  const toggleLike = useCallback(() => {
    if (likeMutation.isPending || unlikeMutation.isPending) return;
    if (isLiked) {
      unlikeMutation.mutate();
    } else {
      likeMutation.mutate();
    }
  }, [isLiked, likeMutation, unlikeMutation]);

  return {
    isLiked,
    toggleLike,
    isLoading: likeMutation.isPending || unlikeMutation.isPending,
  };
}
