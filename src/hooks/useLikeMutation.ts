/**
 * Like Mutation Hook with Optimistic Updates
 *
 * Handles episode likes with:
 * - localStorage persistence for liked state
 * - Optimistic cache updates (finds series cache dynamically)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { likeEpisode, unlikeEpisode } from '@/api';
import type { SeriesMetadata } from '@/types';

const LIKES_STORAGE_KEY = 'webtoon_liked_episodes';

function getLikedEpisodes(): Set<string> {
  try {
    const stored = localStorage.getItem(LIKES_STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveLikedEpisodes(liked: Set<string>): void {
  try {
    localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify([...liked]));
  } catch {}
}

/**
 * Hook for liking/unliking episodes with optimistic updates
 */
export function useLikeMutation(episodeId: string) {
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    setIsLiked(getLikedEpisodes().has(episodeId));
  }, [episodeId]);

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
      setIsLiked(true);
      updateCache(1);
      const liked = getLikedEpisodes();
      liked.add(episodeId);
      saveLikedEpisodes(liked);
    },
    onError: () => {
      setIsLiked(false);
      updateCache(-1);
      const liked = getLikedEpisodes();
      liked.delete(episodeId);
      saveLikedEpisodes(liked);
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: () => unlikeEpisode(episodeId),
    onMutate: () => {
      setIsLiked(false);
      updateCache(-1);
      const liked = getLikedEpisodes();
      liked.delete(episodeId);
      saveLikedEpisodes(liked);
    },
    onError: () => {
      setIsLiked(true);
      updateCache(1);
      const liked = getLikedEpisodes();
      liked.add(episodeId);
      saveLikedEpisodes(liked);
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
