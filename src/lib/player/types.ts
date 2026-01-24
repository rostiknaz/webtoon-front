/**
 * Player Types
 *
 * Shared type definitions for the video player cache system.
 */

import type Player from "xgplayer";

/**
 * Represents a cached video player instance with its associated metadata.
 */
export interface CachedPlayer {
  /** The xgplayer instance */
  player: Player;
  /** The DOM container element hosting the player */
  container: HTMLElement;
  /** Saved playback position in seconds */
  currentTime: number;
  /** Unique episode identifier */
  episodeId: string;
  /** HLS manifest URL */
  hlsUrl: string;
  /** Whether the player is currently loading/buffering */
  isLoading: boolean;
  /** Cleanup function to remove event listeners when player is destroyed */
  cleanup?: () => void;
}

/**
 * Callback type for cache state change notifications.
 * Used by React to subscribe to cache updates via useSyncExternalStore.
 */
export type CacheSubscriber = () => void;

/**
 * Options for creating or retrieving a player from cache.
 */
export interface PlayerCreationOptions {
  /** Whether to trigger autoplay after creation */
  autoplay?: boolean;
  /** Callback when player state changes (loading, playing, etc.) */
  onLoadingChange?: (episodeId: string, isLoading: boolean) => void;
}
