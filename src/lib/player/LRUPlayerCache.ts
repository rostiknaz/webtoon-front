/**
 * LRU Player Cache
 *
 * A Least Recently Used (LRU) cache for video player instances.
 * Automatically evicts oldest players when capacity is reached.
 *
 * Features:
 * - O(1) get/set operations via Map
 * - LRU eviction with protected ID support
 * - Observer pattern for React integration (useSyncExternalStore)
 * - Proper cleanup of evicted player resources
 * - Version tracking for efficient React re-renders
 */

import type { CachedPlayer, CacheSubscriber } from "./types";

export class LRUPlayerCache {
  private cache = new Map<string, CachedPlayer>();
  private order: string[] = [];
  private readonly maxSize: number;
  private subscribers = new Set<CacheSubscriber>();

  /**
   * Version number that increments on every state change.
   * Used by useSyncExternalStore to detect changes efficiently.
   */
  private version = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  /**
   * Get the current version number.
   * Useful for React's useSyncExternalStore to create stable snapshots.
   */
  getVersion(): number {
    return this.version;
  }

  /**
   * Get a cached player by episode ID.
   */
  get(episodeId: string): CachedPlayer | undefined {
    return this.cache.get(episodeId);
  }

  /**
   * Check if a player exists in cache.
   */
  has(episodeId: string): boolean {
    return this.cache.has(episodeId);
  }

  /**
   * Add or update a player in the cache.
   * Automatically handles LRU ordering and eviction.
   *
   * @param episodeId - Unique episode identifier
   * @param player - The cached player data
   * @param protectedId - Optional ID to protect from eviction (usually the active episode)
   */
  set(episodeId: string, player: CachedPlayer, protectedId?: string): void {
    // Remove from old position if exists (for LRU update)
    this.removeFromOrder(episodeId);

    // Add to end (most recently used)
    this.order.push(episodeId);
    this.cache.set(episodeId, player);

    // Evict if over capacity
    this.evictIfNeeded(protectedId);

    this.notify();
  }

  /**
   * Update LRU order without modifying the cached data.
   * Call this when accessing a cached player to mark it as recently used.
   */
  touch(episodeId: string): void {
    if (!this.cache.has(episodeId)) return;

    this.removeFromOrder(episodeId);
    this.order.push(episodeId);
    // No notify needed - order change doesn't affect React state
  }

  /**
   * Update a property of a cached player.
   * Triggers subscriber notification for React re-renders.
   */
  update(
    episodeId: string,
    updates: Partial<Pick<CachedPlayer, "isLoading" | "currentTime" | "hlsUrl">>
  ): void {
    const cached = this.cache.get(episodeId);
    if (!cached) return;

    let changed = false;
    if (updates.isLoading !== undefined && cached.isLoading !== updates.isLoading) {
      cached.isLoading = updates.isLoading;
      changed = true;
    }
    if (updates.currentTime !== undefined) {
      cached.currentTime = updates.currentTime;
      // Don't notify for currentTime updates (too frequent)
    }
    if (updates.hlsUrl !== undefined && cached.hlsUrl !== updates.hlsUrl) {
      cached.hlsUrl = updates.hlsUrl;
      changed = true;
    }

    if (changed) {
      this.notify();
    }
  }

  /**
   * Remove a player from cache without destroying it.
   * The caller is responsible for cleanup if needed.
   */
  delete(episodeId: string): CachedPlayer | undefined {
    const cached = this.cache.get(episodeId);
    if (cached) {
      this.cache.delete(episodeId);
      this.removeFromOrder(episodeId);
      this.notify();
    }
    return cached;
  }

  /**
   * Remove and destroy a player, cleaning up its container.
   */
  destroy(episodeId: string): void {
    const cached = this.cache.get(episodeId);
    if (cached) {
      this.destroyPlayer(cached);
      this.cache.delete(episodeId);
      this.removeFromOrder(episodeId);
      this.notify();
    }
  }

  /**
   * Destroy all cached players and clear the cache.
   */
  destroyAll(): void {
    this.cache.forEach((cached) => {
      this.destroyPlayer(cached);
    });
    this.cache.clear();
    this.order = [];
    this.notify();
  }

  /**
   * Iterate over all cached players.
   */
  forEach(callback: (cached: CachedPlayer, episodeId: string) => void): void {
    this.cache.forEach(callback);
  }

  /**
   * Get all episode IDs in cache (for debugging).
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get current cache size.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get maximum cache size.
   */
  get capacity(): number {
    return this.maxSize;
  }

  /**
   * Subscribe to cache changes.
   * Returns an unsubscribe function.
   *
   * Compatible with React's useSyncExternalStore.
   */
  subscribe = (callback: CacheSubscriber): (() => void) => {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  };

  /**
   * Get a snapshot of the cache state for React.
   * Returns a stable reference if nothing changed.
   *
   * Compatible with React's useSyncExternalStore.
   */
  getSnapshot = (): Map<string, CachedPlayer> => {
    return this.cache;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Private methods
  // ─────────────────────────────────────────────────────────────────────────────

  private removeFromOrder(episodeId: string): void {
    const index = this.order.indexOf(episodeId);
    if (index !== -1) {
      this.order.splice(index, 1);
    }
  }

  private evictIfNeeded(protectedId?: string): void {
    while (this.cache.size > this.maxSize && this.order.length > 0) {
      // Find oldest that isn't protected
      const oldestIdx = this.order.findIndex((id) => id !== protectedId);
      if (oldestIdx === -1) break;

      const oldestId = this.order[oldestIdx];
      const cached = this.cache.get(oldestId);

      if (cached) {
        // Save position before destroying
        cached.currentTime = cached.player.currentTime || 0;
        this.destroyPlayer(cached);
      }

      this.cache.delete(oldestId);
      this.order.splice(oldestIdx, 1);
    }
  }

  private destroyPlayer(cached: CachedPlayer): void {
    // Call cleanup function to remove event listeners before destroying player
    // This prevents memory leaks from orphaned event handlers
    if (cached.cleanup) {
      try {
        cached.cleanup();
      } catch {
        // Cleanup error shouldn't prevent player destruction
      }
    }

    try {
      cached.player.destroy();
    } catch {
      // Player may already be destroyed
    }

    // Clear container contents but keep the container in DOM
    // (container is managed by parent component like HybridVideoPlayer)
    this.clearContainer(cached.container);
  }

  private clearContainer(container: HTMLElement): void {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  }

  private notify(): void {
    // Increment version for useSyncExternalStore compatibility
    this.version++;

    this.subscribers.forEach((callback) => {
      try {
        callback();
      } catch {
        // Subscriber error shouldn't break the cache
      }
    });
  }
}
