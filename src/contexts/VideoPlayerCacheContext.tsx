/**
 * VideoPlayerCache Context - Hybrid Approach
 *
 * Provides player caching with LRU eviction for use with Swiper or standalone.
 *
 * Features:
 * 1. LRU eviction (max 5 players) for memory management
 * 2. Position saving/restoration for seamless resume
 * 3. Works with Swiper slides (initPlayerInHost) or standalone containers
 * 4. Prevents m3u8 reloads when switching back to cached episodes
 */

import {
  createContext,
  useContext,
  useRef,
  useCallback,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import Player, { Events } from 'xgplayer';
import HlsPlugin from 'xgplayer-hls';
import 'xgplayer/dist/index.min.css';

const MAX_CACHED_PLAYERS = 5;

interface CachedPlayer {
  player: Player;
  container: HTMLElement;
  currentTime: number;
  episodeId: string;
  hlsUrl: string;
  isLoading: boolean;
}

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

  /** Check if an episode is currently loading/buffering */
  isEpisodeLoading: (episodeId: string) => boolean;

  /** Loading state change counter (for triggering re-renders) */
  loadingStateVersion: number;
}

const VideoPlayerCacheContext = createContext<VideoPlayerCacheContextValue | null>(null);

/**
 * Brand colors from design system for player styling
 */
const PLAYER_COLORS = {
  primary: 'hsl(10, 85%, 58%)',      // Orange-red brand color
  primaryLight: 'hsl(10, 85%, 68%)', // Lighter variant for gradients
  accent: 'hsl(280, 75%, 60%)',      // Purple accent
  muted: 'hsl(240, 10%, 25%)',       // Muted background
  mutedLight: 'hsl(240, 10%, 35%)',  // Lighter muted for cached
};

/**
 * Default xgplayer configuration for HLS streaming
 * Styled to match the premium design system
 */
function createPlayerConfig(container: HTMLElement, hlsUrl: string): ConstructorParameters<typeof Player>[0] {
  return {
    el: container,
    url: hlsUrl,
    autoplay: false, // Let caller control autoplay
    loop: false,
    defaultPlaybackRate: 1,
    playsinline: true,
    'x5-video-player-type': 'h5',
    'x5-video-orientation': 'portrait',
    'webkit-playsinline': true,
    closeVideoClick: true, // Disable xgplayer's click - we handle it via container onClick
    closeVideoDblclick: true,
    closePauseVideoFocus: false, // Keep controls visible when paused
    closePlayVideoFocus: true,
    fitVideoSize: 'fixWidth',
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
    // Premium styling to match brand design system
    commonStyle: {
      playedColor: PLAYER_COLORS.primary,      // Progress played color
      cachedColor: PLAYER_COLORS.mutedLight,   // Buffered/cached color
      progressColor: PLAYER_COLORS.muted,      // Progress bar background
      volumeColor: PLAYER_COLORS.primary,      // Volume bar color
      sliderBtnStyle: {
        background: PLAYER_COLORS.primary,
        boxShadow: `0 0 12px ${PLAYER_COLORS.primary}`,
      },
    },
    // Use HLS plugin for MSE-based playback (creates blob: URLs instead of exposing m3u8)
    plugins: [HlsPlugin],
    hls: {
      maxBufferLength: 30,
      retryCount: 3,
      retryDelay: 1000,
      // MSE config for blob URL playback
      preferMMS: false, // Use standard MediaSource, not ManagedMediaSource
    },
  };
}

export function VideoPlayerCacheProvider({ children }: { children: ReactNode }) {
  const cacheRef = useRef<Map<string, CachedPlayer>>(new Map());
  const orderRef = useRef<string[]>([]);

  // Use state for active episode to trigger re-renders when it changes
  const [activeEpisodeId, setActiveEpisodeIdState] = useState<string | null>(null);

  // Loading state version - increment to trigger re-renders when loading state changes
  const [loadingStateVersion, setLoadingStateVersion] = useState(0);

  // Track episodes that should auto-play when ready
  const pendingAutoPlayRef = useRef<Set<string>>(new Set());

  // Setup loading event listeners on a player
  const setupLoadingEvents = useCallback((player: Player, episodeId: string) => {
    const setLoading = (isLoading: boolean) => {
      const cached = cacheRef.current.get(episodeId);
      if (cached && cached.isLoading !== isLoading) {
        cached.isLoading = isLoading;
        setLoadingStateVersion(v => v + 1);
      }
    };

    // Loading started
    player.on(Events.LOAD_START, () => setLoading(true));
    player.on(Events.WAITING, () => setLoading(true));

    // Loading complete - auto-play if this episode was queued for autoplay
    player.on(Events.CANPLAY, () => {
      setLoading(false);

      // Auto-play if this episode is pending autoplay
      if (pendingAutoPlayRef.current.has(episodeId)) {
        pendingAutoPlayRef.current.delete(episodeId);
        player.play().catch(() => {
          // Autoplay blocked by browser policy - this is expected
        });
      }
    });
    player.on(Events.PLAYING, () => setLoading(false));
  }, []);

  // Evict oldest player when at capacity (LRU)
  const evictOldest = useCallback((protectedId?: string) => {
    while (cacheRef.current.size >= MAX_CACHED_PLAYERS && orderRef.current.length > 0) {
      // Find oldest that isn't protected
      const oldestIdx = orderRef.current.findIndex(id => id !== protectedId);
      if (oldestIdx === -1) break;

      const oldestId = orderRef.current[oldestIdx];
      orderRef.current.splice(oldestIdx, 1);

      const cached = cacheRef.current.get(oldestId);
      if (cached) {
        // Save position before destroying
        cached.currentTime = cached.player.currentTime || 0;
        cached.player.destroy();
        // Clear container contents but keep the container in DOM
        // (container is managed by parent component like HybridVideoPlayer)
        while (cached.container.firstChild) {
          cached.container.removeChild(cached.container.firstChild);
        }
        cacheRef.current.delete(oldestId);
      }
    }
  }, []);

  // Initialize player in a host element (for Swiper slides)
  const initPlayerInHost = useCallback((
    episodeId: string,
    hlsUrl: string,
    hostElement: HTMLElement
  ): { player: Player; isNew: boolean } | null => {
    const existing = cacheRef.current.get(episodeId);

    if (existing) {
      // Move to end of order (most recently used)
      orderRef.current = orderRef.current.filter(id => id !== episodeId);
      orderRef.current.push(episodeId);

      // Check if URL changed
      if (existing.hlsUrl !== hlsUrl) {
        existing.player.src = hlsUrl;
        existing.hlsUrl = hlsUrl;
      }

      return { player: existing.player, isNew: false };
    }

    try {
      // Create new player in the host element FIRST
      const player = new Player(createPlayerConfig(hostElement, hlsUrl));

      // Only evict AFTER successful creation (don't destroy working players if new one fails)
      evictOldest(episodeId);

      // Add to cache with initial loading state
      const cached: CachedPlayer = {
        player,
        container: hostElement,
        currentTime: 0,
        episodeId,
        hlsUrl,
        isLoading: true, // New players start in loading state
      };
      cacheRef.current.set(episodeId, cached);
      orderRef.current.push(episodeId);

      // Setup loading event listeners
      setupLoadingEvents(player, episodeId);

      return { player, isNew: true };
    } catch (error) {
      // Log error in development, fail gracefully in production
      if (import.meta.env.DEV) {
        console.error(`Failed to initialize player for episode ${episodeId}:`, error);
      }
      return null;
    }
  }, [evictOldest, setupLoadingEvents]);

  // Preload player without playing (for smooth transitions)
  const preloadPlayer = useCallback((
    episodeId: string,
    hlsUrl: string,
    hostElement: HTMLElement
  ) => {
    // Skip if already cached
    if (cacheRef.current.has(episodeId)) {
      // Just update LRU order
      orderRef.current = orderRef.current.filter(id => id !== episodeId);
      orderRef.current.push(episodeId);
      return;
    }

    // Skip if host already has content
    if (hostElement.querySelector('video')) {
      return;
    }

    try {
      // Create player FIRST (will start loading manifest and first segment due to videoInit: true)
      const player = new Player(createPlayerConfig(hostElement, hlsUrl));

      // Only evict AFTER successful creation (don't destroy working players if new one fails)
      evictOldest(episodeId);

      // Add to cache with initial loading state
      const cached: CachedPlayer = {
        player,
        container: hostElement,
        currentTime: 0,
        episodeId,
        hlsUrl,
        isLoading: true, // New players start in loading state
      };
      cacheRef.current.set(episodeId, cached);
      orderRef.current.push(episodeId);

      // Setup loading event listeners
      setupLoadingEvents(player, episodeId);
    } catch (error) {
      // Preload failures are non-critical, log in development only
      if (import.meta.env.DEV) {
        console.warn(`Failed to preload player for episode ${episodeId}:`, error);
      }
    }
  }, [evictOldest, setupLoadingEvents]);

  // Check if player exists
  const hasPlayer = useCallback((episodeId: string) => {
    return cacheRef.current.has(episodeId);
  }, []);

  // Get cached player
  const getCachedPlayer = useCallback((episodeId: string) => {
    return cacheRef.current.get(episodeId);
  }, []);

  // Save position
  const savePosition = useCallback((episodeId: string) => {
    const cached = cacheRef.current.get(episodeId);
    if (cached?.player) {
      cached.currentTime = cached.player.currentTime || 0;
    }
  }, []);

  // Get saved position
  const getSavedPosition = useCallback((episodeId: string) => {
    const cached = cacheRef.current.get(episodeId);
    return cached?.currentTime || 0;
  }, []);

  // Restore saved position
  const restorePosition = useCallback((episodeId: string) => {
    const cached = cacheRef.current.get(episodeId);
    if (cached?.player && cached.currentTime > 0) {
      cached.player.currentTime = cached.currentTime;
    }
  }, []);

  // Set active episode
  const setActiveEpisode = useCallback((episodeId: string) => {
    setActiveEpisodeIdState(episodeId);
  }, []);

  // Pause all except specified
  const pauseOthers = useCallback((activeId: string) => {
    cacheRef.current.forEach((cached, id) => {
      if (id !== activeId && cached.player && !cached.player.paused) {
        cached.player.pause();
      }
    });
  }, []);

  // Pause all players
  const pauseAll = useCallback(() => {
    // Clear any pending autoplay requests
    pendingAutoPlayRef.current.clear();

    cacheRef.current.forEach((cached) => {
      if (cached.player && !cached.player.paused) {
        cached.player.pause();
      }
    });
  }, []);

  // Play a specific player
  const playPlayer = useCallback(async (episodeId: string) => {
    const cached = cacheRef.current.get(episodeId);
    if (!cached?.player) return;

    // If player is still loading, queue the play request for when CANPLAY fires
    if (cached.isLoading) {
      pendingAutoPlayRef.current.add(episodeId);
      return;
    }

    // Player is ready, play immediately
    try {
      await cached.player.play();
    } catch (err) {
      // These are expected browser behaviors, not errors:
      // - "interrupted by a new load request" = rapid navigation
      // - "interrupted by a call to pause()" = slide transition
      // - "user didn't interact" = autoplay policy
      // Only log in development for debugging
      if (import.meta.env.DEV) {
        console.debug('Play prevented:', (err as Error).message);
      }
    }
  }, []);

  // Destroy all players
  const destroyAll = useCallback(() => {
    cacheRef.current.forEach((cached) => {
      cached.player.destroy();
    });
    cacheRef.current.clear();
    orderRef.current = [];
    setActiveEpisodeIdState(null);
  }, []);

  // Remove a specific player from cache (for handling stale references)
  const removePlayer = useCallback((episodeId: string) => {
    const cached = cacheRef.current.get(episodeId);
    if (cached) {
      // Don't destroy here - caller may have already destroyed or wants to handle it
      cacheRef.current.delete(episodeId);
      orderRef.current = orderRef.current.filter(id => id !== episodeId);
    }
  }, []);

  // Get cache stats
  const getCacheStats = useCallback(() => ({
    size: cacheRef.current.size,
    maxSize: MAX_CACHED_PLAYERS,
    episodeIds: Array.from(cacheRef.current.keys()),
  }), []);

  // Check if an episode is currently loading
  const isEpisodeLoading = useCallback((episodeId: string) => {
    const cached = cacheRef.current.get(episodeId);
    // If no player exists yet, consider it as loading (will show skeleton)
    if (!cached) return true;
    return cached.isLoading;
  }, []);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value = useMemo<VideoPlayerCacheContextValue>(() => ({
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
    isEpisodeLoading,
    loadingStateVersion,
  }), [
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
    isEpisodeLoading,
    loadingStateVersion,
  ]);

  return (
    <VideoPlayerCacheContext.Provider value={value}>
      {children}
    </VideoPlayerCacheContext.Provider>
  );
}

export function useVideoPlayerCache() {
  const context = useContext(VideoPlayerCacheContext);
  if (!context) {
    throw new Error('useVideoPlayerCache must be used within VideoPlayerCacheProvider');
  }
  return context;
}
