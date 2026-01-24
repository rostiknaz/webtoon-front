import { queryOptions } from "@tanstack/react-query"
import { getSeriesMetadataBySlug } from "../api"

/**
 * Query options for series metadata by slug
 *
 * Caching strategy for high traffic (500K-1M users/day):
 * - staleTime: 5 minutes - data considered fresh, no refetch
 * - gcTime: 30 minutes - keep in memory even when unused
 * - refetchOnMount: false - don't refetch if data exists
 * - refetchOnWindowFocus: false - don't refetch on tab focus
 *
 * Combined with server-side KV caching (24h for core, 1min for stats),
 * this reduces API calls by ~80% while keeping data reasonably fresh.
 *
 * Note: isLocked and hlsUrl are computed at render time based on subscription status.
 */
export default function getSeriesMetadataQueryOptions(slug: string) {
    return queryOptions({
        queryKey: ["serial", slug],
        queryFn: () => getSeriesMetadataBySlug(slug),
        // Data is fresh for 5 minutes - no refetch during this time
        staleTime: 5 * 60 * 1000,
        // Keep in cache for 30 minutes even if component unmounts
        gcTime: 30 * 60 * 1000,
        // Don't refetch when component mounts if we have data
        refetchOnMount: false,
        // Don't refetch when user returns to tab
        refetchOnWindowFocus: false,
    })
}