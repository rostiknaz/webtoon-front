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
  type ReactNode,
} from 'react';
import Player from 'xgplayer';
import HlsPlugin from 'xgplayer-hls';
import 'xgplayer/dist/index.min.css';

const MAX_CACHED_PLAYERS = 5;

interface CachedPlayer {
  player: Player;
  container: HTMLElement;
  currentTime: number;
  episodeId: string;
  hlsUrl: string;
}

interface VideoPlayerCacheContextValue {
  /** Initialize player in a host element (for Swiper slides) */
  initPlayerInHost: (
    episodeId: string,
    hlsUrl: string,
    hostElement: HTMLElement
  ) => { player: Player; isNew: boolean };

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

  /** Get cache stats for debugging */
  getCacheStats: () => { size: number; maxSize: number; episodeIds: string[] };
}

const VideoPlayerCacheContext = createContext<VideoPlayerCacheContextValue | null>(null);

/**
 * Default xgplayer configuration for HLS streaming
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
    closePauseVideoFocus: true,
    closePlayVideoFocus: true,
    fitVideoSize: 'fixWidth',
    cssFullscreen: false,
    fluid: false,
    miniprogress: true,
    videoInit: true,
    mobile: {
      gestureX: true,
      gestureY: false, // Disable to not interfere with Swiper
      disableGesture: false,
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
  ) => {
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

    // Evict oldest if at capacity (protect the new episode)
    evictOldest(episodeId);

    // Create new player in the host element
    const player = new Player(createPlayerConfig(hostElement, hlsUrl));

    // Add to cache
    const cached: CachedPlayer = {
      player,
      container: hostElement,
      currentTime: 0,
      episodeId,
      hlsUrl,
    };
    cacheRef.current.set(episodeId, cached);
    orderRef.current.push(episodeId);

    return { player, isNew: true };
  }, [evictOldest]);

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

    // Evict oldest if at capacity
    evictOldest(episodeId);

    // Create player (will start loading manifest and first segment due to videoInit: true)
    const player = new Player(createPlayerConfig(hostElement, hlsUrl));

    // Add to cache
    const cached: CachedPlayer = {
      player,
      container: hostElement,
      currentTime: 0,
      episodeId,
      hlsUrl,
    };
    cacheRef.current.set(episodeId, cached);
    orderRef.current.push(episodeId);
  }, [evictOldest]);

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
    cacheRef.current.forEach((cached) => {
      if (cached.player && !cached.player.paused) {
        cached.player.pause();
      }
    });
  }, []);

  // Play a specific player
  const playPlayer = useCallback(async (episodeId: string) => {
    const cached = cacheRef.current.get(episodeId);
    if (cached?.player) {
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

  // Get cache stats
  const getCacheStats = useCallback(() => ({
    size: cacheRef.current.size,
    maxSize: MAX_CACHED_PLAYERS,
    episodeIds: Array.from(cacheRef.current.keys()),
  }), []);

  const value: VideoPlayerCacheContextValue = {
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
    getCacheStats,
  };

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
