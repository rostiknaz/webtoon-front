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
  sort?: string;
  search?: string;
}

/**
 * Query options factory for feed — usable in route loaders for preloading
 */
export function feedQueryOptions(options: FeedOptions = {}) {
  return infiniteQueryOptions({
    queryKey: ['feed', { category: options.category, nsfw: options.nsfw, sort: options.sort, search: options.search }] as const,
    queryFn: ({ pageParam }) =>
      getFeed({
        cursor: pageParam,
        category: options.category,
        nsfw: options.nsfw,
        sort: options.sort,
        search: options.search,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    // No staleTime for search queries (instant freshness); 2 minutes for regular feed
    staleTime: options.search ? 0 : 2 * 60 * 1000,
  });
}

/**
 * Hook for infinite scroll feed with cursor pagination
 */
export function useFeed(options: FeedOptions = {}) {
  return useInfiniteQuery(feedQueryOptions(options));
}
