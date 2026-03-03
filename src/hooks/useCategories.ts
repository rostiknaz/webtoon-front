/**
 * Categories Hook
 *
 * TanStack Query for category list.
 * Cached 24 hours to match KV TTL — categories rarely change.
 */

import { useQuery, queryOptions } from '@tanstack/react-query';
import { getCategories } from '../api';

/**
 * Query options factory for categories — usable in route loaders for preloading
 */
export function categoriesQueryOptions() {
  return queryOptions({
    queryKey: ['categories'] as const,
    queryFn: getCategories,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours — match KV cache TTL
  });
}

/**
 * Hook for fetching all categories
 */
export function useCategories() {
  return useQuery(categoriesQueryOptions());
}
