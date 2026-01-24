/**
 * VideoPlayerCache Context - Hybrid Approach
 *
 * Provides player caching with LRU eviction for use with Swiper or standalone.
 *
 * Features:
 * 1. LRU eviction (max 3 players) for memory management
 * 2. Position saving/restoration for seamless resume
 * 3. Works with Swiper slides (initPlayerInHost) or standalone containers
 * 4. Prevents m3u8 reloads when switching back to cached episodes
 * 5. Uses useSyncExternalStore for efficient React re-renders
 */

import {
  createContext,
  useContext,
  useRef,
  useCallback,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import Player, { Events } from "xgplayer";
import HlsJsPlugin from "xgplayer-hls.js";
import "xgplayer/dist/index.min.css";

import {
  LRUPlayerCache,
  usePlayerLoadingState,
  type CachedPlayer,
} from "@/lib/player";

/**
 * Reduced from 5 to 3 to minimize Cloudflare Stream bandwidth costs.
 * Each cached player buffers video segments, so fewer players = less streaming.
 * 3 players covers: current + prev + next (optimal for smooth swiping)
 */
const MAX_CACHED_PLAYERS = 3;

/**
 * Check if the browser supports native HLS playback
 * Safari and iOS support HLS natively without MSE
 * Result is cached since browser capability doesn't change during session
 */
const supportsNativeHls = (() => {
  let cached: boolean | null = null;
  return (): boolean => {
    if (cached === null) {
      const video = document.createElement("video");
      cached = video.canPlayType("application/vnd.apple.mpegurl") !== "";
    }
    return cached;
  };
})();

/**
 * Static player configuration - cached at module level to avoid object recreation.
 * Dynamic properties (el, url) are merged in createPlayerConfig().
 */
const STATIC_PLAYER_CONFIG = {
  autoplay: false, // Let caller control autoplay
  loop: false,
  defaultPlaybackRate: 1,
  playsinline: true,
  "x5-video-player-type": "h5",
  "x5-video-orientation": "portrait",
  "webkit-playsinline": true,
  closeVideoClick: true, // Disable xgplayer's click - we handle it via container onClick
  closeVideoDblclick: true,
  closePauseVideoFocus: false, // Keep controls visible when paused
  closePlayVideoFocus: true,
  fitVideoSize: "fixWidth",
  cssFullscreen: false,
  fluid: false,
  miniprogress: true,
  videoInit: true,
  // Controls configuration - always show when not playing
  controls: {
    initShow: true, // Show controls on initial load
  },
  mobile: {
    gestureX: true,
    gestureY: false, // Disable to not interfere with Swiper
    disableGesture: false,
  },
  // White styling to match control icons
  commonStyle: {
    playedColor: "rgba(255, 255, 255, 0.9)", // Progress played color
    cachedColor: "rgba(255, 255, 255, 0.35)", // Buffered/cached color
    progressColor: "rgba(255, 255, 255, 0.2)", // Progress bar background
    volumeColor: "rgba(255, 255, 255, 0.9)", // Volume bar color
    sliderBtnStyle: {
      background: "#ffffff",
      boxShadow: "0 0 10px rgba(255, 255, 255, 0.4)",
    },
  },
} as const;

/**
 * HLS.js plugin configuration for non-native HLS browsers.
 * Cached at module level to avoid recreation.
 * Note: Not using `as const` because xgplayer expects mutable plugin array.
 */
const HLS_PLUGIN_CONFIG = {
  plugins: [HlsJsPlugin],
  hlsJsPlugin: {
    maxBufferLength: 10, // Reduced from 30 to minimize bandwidth
    maxMaxBufferLength: 20, // Reduced from 60
    enableWorker: true,
    // Fragment loading configuration
    fragLoadingMaxRetry: 6,
    fragLoadingRetryDelay: 1000,
    fragLoadingMaxRetryTimeout: 64000,
  },
};

interface VideoPlayerCacheContextValue {
  /** Initialize player in a host element (for Swiper slides). Returns null if initialization fails. */
  initPlayerInHost: (
    episodeId: string,
    hlsUrl: string,
    hostElement: HTMLElement
  ) => { player: Player; isNew: boolean } | null;

  /** Preload player without playing (for smooth transitions) */
  preloadPlayer: (
    episodeId: string,
    hlsUrl: string,
    hostElement: HTMLElement
  ) => void;

  /** Check if a player exists for the given episode */
  hasPlayer: (episodeId: string) => boolean;

  /** Get a cached player by episode ID */
  getCachedPlayer: (episodeId: string) => CachedPlayer | undefined;

  /** Save the current playback position for an episode */
  savePosition: (episodeId: string) => void;

  /** Get the saved position for an episode */
  getSavedPosition: (episodeId: string) => number;

  /** Restore saved position for an episode */
  restorePosition: (episodeId: string) => void;

  /** Set the active episode */
  setActiveEpisode: (episodeId: string) => void;

  /** Get the active episode ID */
  activeEpisodeId: string | null;

  /** Pause all players except the specified one */
  pauseOthers: (activeEpisodeId: string) => void;

  /** Pause all players */
  pauseAll: () => void;

  /** Play a specific player */
  playPlayer: (episodeId: string) => Promise<void>;

  /** Destroy all cached players (cleanup) */
  destroyAll: () => void;

  /** Remove a specific player from cache (for handling stale references) */
  removePlayer: (episodeId: string) => void;

  /** Get cache stats for debugging */
  getCacheStats: () => { size: number; maxSize: number; episodeIds: string[] };
}

const VideoPlayerCacheContext =
  createContext<VideoPlayerCacheContextValue | null>(null);

/**
 * Separate context for the raw cache instance.
 * This allows hooks like useIsEpisodeLoading to access the cache directly
 * for useSyncExternalStore without coupling to the full context.
 */
const PlayerCacheInstanceContext = createContext<LRUPlayerCache | null>(null);

/**
 * Create xgplayer configuration
 * Uses cached static config to avoid object recreation on every player init.
 * Only dynamic properties (el, url) and conditional HLS plugin are merged.
 */
function createPlayerConfig(
  container: HTMLElement,
  hlsUrl: string
): ConstructorParameters<typeof Player>[0] {
  // Merge static config with dynamic properties
  // Use HLS.js plugin only when native HLS is NOT supported (Chrome, Firefox, etc.)
  // Safari and iOS support HLS natively and should use native playback for better compatibility
  return {
    ...STATIC_PLAYER_CONFIG,
    el: container,
    url: hlsUrl,
    ...(supportsNativeHls() ? {} : HLS_PLUGIN_CONFIG),
  };
}

export function VideoPlayerCacheProvider({
  children,
}: {
  children: ReactNode;
}) {
  // LRU cache instance - persists across renders
  // Using useMemo with empty deps to create a stable singleton instance
  const cache = useMemo(() => new LRUPlayerCache(MAX_CACHED_PLAYERS), []);

  // Use state for active episode to trigger re-renders when it changes
  const [activeEpisodeId, setActiveEpisodeIdState] = useState<string | null>(
    null
  );

  // Ref to track active episode (for event handlers to access current value)
  const activeEpisodeIdRef = useRef<string | null>(null);

  // Track episodes that should auto-play when ready
  const pendingAutoPlayRef = useRef<Set<string>>(new Set());

  /**
   * Hide xgplayer's enter spinner (shown before first play).
   * Called when autoplay is blocked to show video poster/first frame instead of spinner.
   */
  const hidePlayerSpinner = useCallback((player: Player) => {
    const container = player.root;
    if (!container) return;

    // Hide xgplayer's enter spinner
    const spinner = container.querySelector('.xgplayer-enter-spinner') as HTMLElement;
    if (spinner) {
      spinner.style.display = 'none';
    }
  }, []);

  /**
   * Try to play video with muted autoplay (most reliable for autoplay).
   * Muted autoplay is allowed by most browsers without user interaction.
   * User can unmute via player controls after video starts.
   */
  const tryPlayWithFallback = useCallback(
    async (player: Player, episodeId: string) => {
      const video = player.video as HTMLVideoElement | undefined;

      // Start muted for reliable autoplay (Chrome/Safari policy)
      // User can unmute via player controls
      if (video) {
        video.muted = true;
      }

      try {
        await player.play();

        // Mobile Safari may silently block autoplay even when promise resolves
        // Check if video is actually playing - if still paused, autoplay was blocked
        if (video?.paused) {
          // Autoplay silently blocked - hide skeleton to show video element
          // User can tap to play
          if (activeEpisodeIdRef.current === episodeId) {
            cache.update(episodeId, { isLoading: false });
          }
        }

        // Hide xgplayer spinner explicitly
        // Safari with native HLS may not auto-hide the spinner
        hidePlayerSpinner(player);
      } catch {
        // Even muted autoplay blocked - hide spinner, show first frame
        // This can happen in strict browser contexts (e.g., Playwright without user gesture)
        if (activeEpisodeIdRef.current === episodeId) {
          cache.update(episodeId, { isLoading: false });
          hidePlayerSpinner(player);
        }
      }
    },
    [cache, hidePlayerSpinner]
  );

  /**
   * Setup loading event listeners on a player.
   * Returns a cleanup function to remove all listeners when player is destroyed.
   */
  const setupLoadingEvents = useCallback(
    (player: Player, episodeId: string): (() => void) => {
      const setLoading = (isLoading: boolean) => {
        const cached = cache.get(episodeId);
        if (!cached) return;

        // Only allow hiding skeleton (isLoading: false) for the ACTIVE episode
        // This prevents preloaded episodes from hiding their skeleton prematurely
        if (!isLoading && activeEpisodeIdRef.current !== episodeId) {
          return;
        }

        if (cached.isLoading !== isLoading) {
          // Update via cache.update which triggers subscribers (useSyncExternalStore)
          cache.update(episodeId, { isLoading });
        }
      };

      // Store listener references for cleanup
      const onLoadStart = () => setLoading(true);
      const onWaiting = () => setLoading(true);
      const onCanPlay = () => {
        // Auto-play if this episode is pending autoplay
        if (pendingAutoPlayRef.current.has(episodeId)) {
          pendingAutoPlayRef.current.delete(episodeId);
          tryPlayWithFallback(player, episodeId);
        }
      };
      const onPlaying = () => {
        setLoading(false);
        // Also hide xgplayer's enter spinner - Safari with native HLS may not auto-hide it
        hidePlayerSpinner(player);
      };

      let hasHiddenSkeleton = false;
      const onTimeUpdate = () => {
        if (!hasHiddenSkeleton && activeEpisodeIdRef.current === episodeId) {
          hasHiddenSkeleton = true;
          setLoading(false);
        }
      };

      // Register event listeners
      player.on(Events.LOAD_START, onLoadStart);
      player.on(Events.WAITING, onWaiting);
      player.on(Events.CANPLAY, onCanPlay);
      player.on(Events.PLAYING, onPlaying);
      player.on(Events.TIME_UPDATE, onTimeUpdate);

      // Return cleanup function to remove all listeners
      return () => {
        player.off(Events.LOAD_START, onLoadStart);
        player.off(Events.WAITING, onWaiting);
        player.off(Events.CANPLAY, onCanPlay);
        player.off(Events.PLAYING, onPlaying);
        player.off(Events.TIME_UPDATE, onTimeUpdate);
      };
    },
    [cache, tryPlayWithFallback, hidePlayerSpinner]
  );

  /**
   * Create or retrieve a player from cache.
   * Unified internal method used by both initPlayerInHost and preloadPlayer.
   */
  const createOrGetPlayer = useCallback(
    (
      episodeId: string,
      hlsUrl: string,
      hostElement: HTMLElement,
      options: { returnResult: boolean }
    ): { player: Player; isNew: boolean } | null => {
      const existing = cache.get(episodeId);

      if (existing) {
        // Mark as recently used
        cache.touch(episodeId);

        // Check if URL changed
        if (existing.hlsUrl !== hlsUrl) {
          existing.player.src = hlsUrl;
          cache.update(episodeId, { hlsUrl });
        }

        return options.returnResult
          ? { player: existing.player, isNew: false }
          : null;
      }

      // Skip if host already has video content
      if (hostElement.querySelector("video")) {
        return null;
      }

      try {
        // Create new player in the host element
        const player = new Player(createPlayerConfig(hostElement, hlsUrl));

        // Setup loading event listeners and get cleanup function
        const cleanup = setupLoadingEvents(player, episodeId);

        // Create cached player entry with cleanup function
        const cachedPlayer: CachedPlayer = {
          player,
          container: hostElement,
          currentTime: 0,
          episodeId,
          hlsUrl,
          isLoading: true, // New players start in loading state
          cleanup, // Store cleanup function for proper teardown
        };

        // Add to cache (handles eviction automatically, protects active episode)
        cache.set(
          episodeId,
          cachedPlayer,
          activeEpisodeIdRef.current ?? undefined
        );

        return options.returnResult ? { player, isNew: true } : null;
      } catch (error) {
        // Log error in development, fail gracefully in production
        if (import.meta.env.DEV) {
          console.error(
            `Failed to initialize player for episode ${episodeId}:`,
            error
          );
        }
        return null;
      }
    },
    [cache, setupLoadingEvents]
  );

  // Initialize player in a host element (for Swiper slides)
  const initPlayerInHost = useCallback(
    (
      episodeId: string,
      hlsUrl: string,
      hostElement: HTMLElement
    ): { player: Player; isNew: boolean } | null => {
      return createOrGetPlayer(episodeId, hlsUrl, hostElement, {
        returnResult: true,
      });
    },
    [createOrGetPlayer]
  );

  // Preload player without playing (for smooth transitions)
  const preloadPlayer = useCallback(
    (episodeId: string, hlsUrl: string, hostElement: HTMLElement) => {
      createOrGetPlayer(episodeId, hlsUrl, hostElement, { returnResult: false });
    },
    [createOrGetPlayer]
  );

  // Check if player exists
  const hasPlayer = useCallback(
    (episodeId: string) => {
      return cache.has(episodeId);
    },
    [cache]
  );

  // Get cached player
  const getCachedPlayer = useCallback(
    (episodeId: string) => {
      return cache.get(episodeId);
    },
    [cache]
  );

  // Save position
  const savePosition = useCallback(
    (episodeId: string) => {
      const cached = cache.get(episodeId);
      if (cached?.player) {
        cache.update(episodeId, {
          currentTime: cached.player.currentTime || 0,
        });
      }
    },
    [cache]
  );

  // Get saved position
  const getSavedPosition = useCallback(
    (episodeId: string) => {
      const cached = cache.get(episodeId);
      return cached?.currentTime || 0;
    },
    [cache]
  );

  // Restore saved position
  const restorePosition = useCallback(
    (episodeId: string) => {
      const cached = cache.get(episodeId);
      if (cached?.player && cached.currentTime > 0) {
        cached.player.currentTime = cached.currentTime;
      }
    },
    [cache]
  );

  // Set active episode
  const setActiveEpisode = useCallback(
    (episodeId: string) => {
      setActiveEpisodeIdState(episodeId);
      activeEpisodeIdRef.current = episodeId;

      // Reset loading state for the newly active episode
      // This ensures skeleton shows until video is actually playing visible content
      const cached = cache.get(episodeId);
      if (cached) {
        cache.update(episodeId, { isLoading: true });
      }
    },
    [cache]
  );

  // Pause all except specified
  const pauseOthers = useCallback(
    (activeId: string) => {
      cache.forEach((cached, id) => {
        if (id !== activeId && cached.player && !cached.player.paused) {
          cached.player.pause();
        }
      });
    },
    [cache]
  );

  // Pause all players
  const pauseAll = useCallback(() => {
    // Clear any pending autoplay requests
    pendingAutoPlayRef.current.clear();

    cache.forEach((cached) => {
      if (cached.player && !cached.player.paused) {
        cached.player.pause();
      }
    });
  }, [cache]);

  // Play a specific player
  const playPlayer = useCallback(
    async (episodeId: string) => {
      const cached = cache.get(episodeId);
      if (!cached?.player) return;

      // Get the underlying video element to check readiness
      const video = cached.player.video as HTMLVideoElement | undefined;
      const isVideoReady = video && video.readyState >= 3; // HAVE_FUTURE_DATA or higher

      // If player is loading but video is actually ready (CANPLAY already fired during preload),
      // we can play immediately - don't wait for CANPLAY again since it won't fire
      if (cached.isLoading && !isVideoReady) {
        pendingAutoPlayRef.current.add(episodeId);
        return;
      }

      // Video is ready to play - try to play with fallback to muted autoplay
      await tryPlayWithFallback(cached.player, episodeId);
    },
    [cache, tryPlayWithFallback]
  );

  // Destroy all players
  const destroyAll = useCallback(() => {
    cache.destroyAll();
    setActiveEpisodeIdState(null);
    activeEpisodeIdRef.current = null;
  }, [cache]);

  // Remove a specific player from cache (for handling stale references)
  const removePlayer = useCallback(
    (episodeId: string) => {
      cache.delete(episodeId);
    },
    [cache]
  );

  // Get cache stats
  const getCacheStats = useCallback(
    () => ({
      size: cache.size,
      maxSize: cache.capacity,
      episodeIds: cache.keys(),
    }),
    [cache]
  );

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value = useMemo<VideoPlayerCacheContextValue>(
    () => ({
      initPlayerInHost,
      preloadPlayer,
      hasPlayer,
      getCachedPlayer,
      savePosition,
      getSavedPosition,
      restorePosition,
      setActiveEpisode,
      activeEpisodeId,
      pauseOthers,
      pauseAll,
      playPlayer,
      destroyAll,
      removePlayer,
      getCacheStats,
    }),
    [
      initPlayerInHost,
      preloadPlayer,
      hasPlayer,
      getCachedPlayer,
      savePosition,
      getSavedPosition,
      restorePosition,
      setActiveEpisode,
      activeEpisodeId,
      pauseOthers,
      pauseAll,
      playPlayer,
      destroyAll,
      removePlayer,
      getCacheStats,
    ]
  );

  return (
    <PlayerCacheInstanceContext.Provider value={cache}>
      <VideoPlayerCacheContext.Provider value={value}>
        {children}
      </VideoPlayerCacheContext.Provider>
    </PlayerCacheInstanceContext.Provider>
  );
}

/**
 * Access the video player cache operations.
 * Use this for player lifecycle management (init, preload, play, pause, etc.)
 */
export function useVideoPlayerCache() {
  const context = useContext(VideoPlayerCacheContext);
  if (!context) {
    throw new Error(
      "useVideoPlayerCache must be used within VideoPlayerCacheProvider"
    );
  }
  return context;
}

/**
 * Access the raw cache instance for hooks that use useSyncExternalStore.
 * @internal - Prefer using useIsEpisodeLoading instead
 */
export function usePlayerCacheInstance() {
  const cache = useContext(PlayerCacheInstanceContext);
  if (!cache) {
    throw new Error(
      "usePlayerCacheInstance must be used within VideoPlayerCacheProvider"
    );
  }
  return cache;
}

/**
 * Check if an episode is currently loading/buffering.
 * Uses useSyncExternalStore for efficient re-renders - only re-renders
 * when this specific episode's loading state changes.
 *
 * @param episodeId - The episode ID to check
 * @returns true if the episode is loading, false if ready to display
 *
 * @example
 * ```tsx
 * function EpisodeSlide({ episodeId }: { episodeId: string }) {
 *   const isLoading = useIsEpisodeLoading(episodeId);
 *   return <VideoSkeleton isLoading={isLoading} />;
 * }
 * ```
 */
export function useIsEpisodeLoading(episodeId: string): boolean {
  const cache = usePlayerCacheInstance();
  return usePlayerLoadingState(cache, episodeId);
}
