/**
 * Feed Hook
 *
 * TanStack Query infinite query for paginated clip feed.
 * Supports category filtering and NSFW toggle.
 */

import { useInfiniteQuery, infiniteQueryOptions } from '@tanstack/react-query';
import { getFeed } from '../api';

interface FeedOptions {
  category?: string;
  nsfw?: string;
}

/**
 * Query options factory for feed — usable in route loaders for preloading
 */
export function feedQueryOptions(options: FeedOptions = {}) {
  return infiniteQueryOptions({
    queryKey: ['feed', { category: options.category, nsfw: options.nsfw }] as const,
    queryFn: ({ pageParam }) =>
      getFeed({
        cursor: pageParam,
        category: options.category,
        nsfw: options.nsfw,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 2 * 60 * 1000, // 2 minutes — match KV cache TTL
  });
}

/**
 * Hook for infinite scroll feed with cursor pagination
 */
export function useFeed(options: FeedOptions = {}) {
  return useInfiniteQuery(feedQueryOptions(options));
}
