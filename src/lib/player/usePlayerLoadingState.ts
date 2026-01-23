/**
 * usePlayerLoadingState Hook
 *
 * A React hook that efficiently subscribes to a specific episode's loading state
 * using useSyncExternalStore for optimal performance.
 *
 * Benefits over the previous loadingStateVersion approach:
 * - More idiomatic React 18+ pattern
 * - Concurrent mode compatible
 * - Only re-renders when the specific episode's loading state changes
 * - No counter hack needed
 */

import { useSyncExternalStore } from "react";
import type { LRUPlayerCache } from "./LRUPlayerCache";

/**
 * Subscribe to a specific episode's loading state.
 *
 * @param cache - The LRU player cache instance
 * @param episodeId - The episode ID to track loading state for
 * @returns true if the episode is loading, false if ready to display
 *
 * @example
 * ```tsx
 * function VideoSlide({ episodeId }: { episodeId: string }) {
 *   const cache = usePlayerCache();
 *   const isLoading = usePlayerLoadingState(cache, episodeId);
 *
 *   return (
 *     <div>
 *       <VideoSkeleton isLoading={isLoading} />
 *       <div className="player-host" />
 *     </div>
 *   );
 * }
 * ```
 */
export function usePlayerLoadingState(
  cache: LRUPlayerCache,
  episodeId: string
): boolean {
  return useSyncExternalStore(
    // Subscribe to cache changes
    cache.subscribe,
    // Get current loading state for this episode
    () => {
      const cached = cache.get(episodeId);
      // If no player exists yet, consider it as loading (will show skeleton)
      if (!cached) return true;
      return cached.isLoading;
    },
    // Server snapshot (SSR) - always loading on server
    () => true
  );
}

/**
 * Subscribe to whether a player exists for an episode.
 *
 * @param cache - The LRU player cache instance
 * @param episodeId - The episode ID to check
 * @returns true if a player exists in cache for this episode
 */
export function useHasPlayer(
  cache: LRUPlayerCache,
  episodeId: string
): boolean {
  return useSyncExternalStore(
    cache.subscribe,
    () => cache.has(episodeId),
    () => false
  );
}

/**
 * Subscribe to cache size changes.
 * Useful for debugging displays.
 *
 * @param cache - The LRU player cache instance
 * @returns Current number of cached players
 */
export function useCacheSize(cache: LRUPlayerCache): number {
  return useSyncExternalStore(
    cache.subscribe,
    () => cache.size,
    () => 0
  );
}
