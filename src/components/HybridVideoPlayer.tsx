/**
 * HybridVideoPlayer Component
 *
 * Combines Swiper for smooth animations with VideoPlayerCacheContext for:
 * - LRU memory management (max 5 players)
 * - Position saving/restoration
 * - Cross-component state access
 *
 * Best of both approaches:
 * - Swiper: GPU-accelerated transitions, native swipe gestures
 * - Context: Memory-bounded caching, position persistence
 */

import type { Episode } from "../types.ts";
import { useState, useEffect, useRef, useCallback } from "react";
import { useVideoPlayerCache } from "@/contexts/VideoPlayerCacheContext";
import { PlayerErrorBoundary } from "./ErrorBoundary";
import { EpisodeSlide } from "./EpisodeSlide";
import type Player from "xgplayer";
import "xgplayer/dist/index.min.css";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCreative, Virtual } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
// Use bundle CSS - includes all module styles (effect-creative, navigation, pagination, etc.)
// Individual module CSS imports have Vite 7 compatibility issues with exports field conditions
import "swiper/css/bundle";

// R2 CDN base URL for self-hosted video streaming (FREE egress!)
// Fallback provided since VITE_ vars are replaced at build time and may not be available in CI/CD
const R2_CDN_URL = import.meta.env.VITE_R2_CDN_URL || 'https://pub-e8eb9b2155904feeb0e7c5e0712a87e2.r2.dev';

/**
 * Video format configuration
 *
 * 'mp4' - Direct MP4 streaming (better quality, simpler pipeline)
 *         Best for: short videos, quality-critical content, simpler infrastructure
 *
 * 'hls' - HLS adaptive streaming (bandwidth efficient, adaptive quality)
 *         Best for: longer videos, variable network conditions, bandwidth savings
 *
 * Toggle via VITE_VIDEO_FORMAT env var or change default here for quick testing
 */
type VideoFormat = 'mp4' | 'hls';
const VIDEO_FORMAT: VideoFormat = (import.meta.env.VITE_VIDEO_FORMAT as VideoFormat) || 'mp4';

interface HybridVideoPlayerProps {
  episodes: Episode[];
  initialIndex: number;
  seriesSlug: string; // URL-safe identifier for R2 video paths
  seriesTitle: string;
  onEpisodeChange: (index: number) => void;
  onLockedEpisode: () => void;
  onShowEpisodes?: () => void;
}

export function HybridVideoPlayer({
  episodes,
  initialIndex,
  seriesSlug,
  seriesTitle,
  onEpisodeChange,
  onLockedEpisode,
  onShowEpisodes,
}: HybridVideoPlayerProps) {
  // Track likes per episode
  const [likedEpisodes, setLikedEpisodes] = useState<Record<string, boolean>>({});

  const swiperRef = useRef<SwiperType | null>(null);
  // Track which players have had events set up (per component instance)
  const playersWithEventsRef = useRef(new WeakSet<Player>());
  // Track pending player initialization to cancel on rapid swipes
  const pendingInitRef = useRef<number | null>(null);
  // Track pending MutationObserver for long jumps (cleanup on rapid swipes)
  const pendingObserverRef = useRef<MutationObserver | null>(null);
  // Track pending preload to defer until current episode is ready
  const pendingPreloadRef = useRef<number | null>(null);
  // Track if current episode is ready for preloading adjacent episodes
  const currentEpisodeReadyRef = useRef<boolean>(false);

  // Use the cache context for player management
  const cache = useVideoPlayerCache();

  // Toggle like for a specific episode
  const toggleLike = useCallback((episodeId: string) => {
    setLikedEpisodes(prev => ({
      ...prev,
      [episodeId]: !prev[episodeId]
    }));
  }, []);

  // Handle click on video area to toggle play/pause
  const handleVideoClick = useCallback(() => {
    if (!cache.activeEpisodeId) return;
    const cached = cache.getCachedPlayer(cache.activeEpisodeId);
    if (!cached?.player) return;

    if (cached.player.paused) {
      cached.player.play();
    } else {
      cached.player.pause();
    }
  }, [cache]);

  /**
   * Generate video URL for the episode based on VIDEO_FORMAT config
   *
   * MP4 path: {seriesSlug}/ep_{paddedEpisodeNumber}/video.mp4
   * HLS path: {seriesSlug}/ep_{paddedEpisodeNumber}/manifest.m3u8
   */
  const getVideoUrl = useCallback((ep: Episode) => {
    const paddedEp = ep.episodeNumber.toString().padStart(2, '0');
    const basePath = `${R2_CDN_URL}/${seriesSlug}/ep_${paddedEp}`;

    return VIDEO_FORMAT === 'mp4'
      ? `${basePath}/video.mp4`
      : `${basePath}/manifest.m3u8`;
  }, [seriesSlug]);

  // Generate poster URL for the episode - shows immediately while HLS loads
  // Path: {seriesSlug}/ep_{paddedEpisodeNumber}/poster.jpg
  const getPosterUrl = useCallback((ep: Episode) => {
    const paddedEp = ep.episodeNumber.toString().padStart(2, '0');
    return `${R2_CDN_URL}/${seriesSlug}/ep_${paddedEp}/poster.jpg`;
  }, [seriesSlug]);

  // Setup player event listeners (only once per player)
  const setupPlayerEvents = useCallback(
    (player: Player, episodeIndex: number) => {
      if (playersWithEventsRef.current.has(player)) return;
      playersWithEventsRef.current.add(player);

      // Handle video end - play next episode
      player.on("ended", () => {
        // Reset position to start so swiping back doesn't immediately trigger ended again
        player.currentTime = 0;

        if (swiperRef.current && episodeIndex < episodes.length - 1) {
          swiperRef.current.slideNext();
        }
      });
    },
    [episodes]
  );

  // Initialize or get cached player for a slide
  const initPlayer = useCallback(
    (slideEl: HTMLElement, slideIndex: number) => {
      if (!slideEl) return;

      const episode = episodes[slideIndex];
      if (!episode) return;

      // Check if episode is locked
      if (episode.isLocked) {
        onLockedEpisode();
        return;
      }

      const hlsUrl = getVideoUrl(episode);
      // slideEl could be the player-host itself (when found by data-episode-id query)
      // or a parent element containing it - handle both cases
      const host = slideEl.classList.contains('player-host')
        ? slideEl
        : (slideEl.querySelector(".player-host") as HTMLElement);
      if (!host) return;

      // Check if player already exists using context
      if (cache.hasPlayer(episode._id)) {
        const cached = cache.getCachedPlayer(episode._id);
        if (cached) {
          // IMPORTANT: Check if the cached player's container matches the current host
          // Virtual Slides may have destroyed and re-created the slide element,
          // leaving the cache with a stale reference to a detached DOM node
          const isCacheStale = cached.container !== host || !cached.container.isConnected;

          if (isCacheStale) {
            // Destroy the old player and remove from cache
            cached.player.destroy();
            cache.removePlayer(episode._id);
            // Don't return - fall through to create new player in the new host
          } else {
            // Cache is valid - restore position and play
            setupPlayerEvents(cached.player, slideIndex);
            cache.restorePosition(episode._id);
            cache.playPlayer(episode._id);
            return;
          }
        }
      }

      // Check if host already has video (player was created)
      if (host.querySelector("video")) {
        // Player exists in DOM but not in cache (shouldn't happen)
        return;
      }

      // Create new player using context
      // Both xgplayer's poster and EpisodeSlide's instant poster use the same URL
      // The browser will cache the image, so xgplayer can display it instantly
      const posterUrl = getPosterUrl(episode);
      const result = cache.initPlayerInHost(
        episode._id,
        hlsUrl,
        host,
        posterUrl
      );

      // Handle initialization failure gracefully
      if (!result) {
        if (import.meta.env.DEV) {
          console.warn(`Failed to initialize player for episode ${episode._id}`);
        }
        return;
      }

      const { player, isNew } = result;

      if (isNew) {
        setupPlayerEvents(player, slideIndex);
      }

      cache.playPlayer(episode._id);
    },
    [episodes, getVideoUrl, getPosterUrl, onLockedEpisode, cache, setupPlayerEvents]
  );

  // Preload a player without playing (for smooth transitions)
  // With virtual slides, we find slides by data-episode-id since swiper.slides order changes
  const preloadEpisode = useCallback(
    (swiper: SwiperType, slideIndex: number) => {
      if (slideIndex < 0 || slideIndex >= episodes.length) return;

      const episode = episodes[slideIndex];
      if (!episode || episode.isLocked) return;

      // Guard against destroyed swiper instance (can happen with async callbacks)
      if (!swiper?.el) return;

      // Find slide by episode ID (works with virtual slides)
      const slideEl = swiper.el.querySelector(
        `[data-episode-id="${episode._id}"]`
      ) as HTMLElement;
      if (!slideEl) return;

      const host = slideEl.querySelector(".player-host") as HTMLElement;
      if (!host) return;

      const hlsUrl = getVideoUrl(episode);
      const posterUrl = getPosterUrl(episode);
      cache.preloadPlayer(episode._id, hlsUrl, host, posterUrl);
    },
    [episodes, getVideoUrl, getPosterUrl, cache]
  );

  /**
   * Deferred preloading strategy - prioritizes current episode loading:
   * 1. Current episode loads with full priority (large buffers)
   * 2. Adjacent episodes preload AFTER current has enough data
   * 3. Preloaded episodes use minimal buffers to reduce bandwidth competition
   *
   * This ensures the current episode loads as fast as possible.
   */
  const preloadAdjacentEpisodes = useCallback(
    (swiper: SwiperType, currentIndex: number) => {
      // Cancel any pending preload from previous slide
      if (pendingPreloadRef.current) {
        clearTimeout(pendingPreloadRef.current);
        pendingPreloadRef.current = null;
      }

      // Reset ready state for new episode
      currentEpisodeReadyRef.current = false;

      const doPreload = () => {
        if (!swiper?.el) return;

        // NEXT episode: Most important for swipe UX
        if (currentIndex + 1 < episodes.length) {
          preloadEpisode(swiper, currentIndex + 1);
        }

        // PREVIOUS episode: For swiping back
        if (currentIndex - 1 >= 0) {
          preloadEpisode(swiper, currentIndex - 1);
        }

        // NEXT+1 episode: During idle time
        if (currentIndex + 2 < episodes.length) {
          if ('requestIdleCallback' in window) {
            window.requestIdleCallback(
              () => preloadEpisode(swiper, currentIndex + 2),
              { timeout: 2000 }
            );
          } else {
            setTimeout(() => preloadEpisode(swiper, currentIndex + 2), 500);
          }
        }
      };

      // Get current episode's player to check readiness
      const episode = episodes[currentIndex];
      if (!episode) return;

      const cached = cache.getCachedPlayer(episode._id);
      const video = cached?.player?.video as HTMLVideoElement | undefined;

      // If video is already ready (HAVE_FUTURE_DATA or higher), preload immediately
      if (video && video.readyState >= 3) {
        currentEpisodeReadyRef.current = true;
        doPreload();
        return;
      }

      // Otherwise, wait for current episode to have enough data before preloading
      // This gives current episode bandwidth priority
      // Use a short delay (300ms) as fallback if CANPLAY doesn't fire
      pendingPreloadRef.current = window.setTimeout(() => {
        currentEpisodeReadyRef.current = true;
        doPreload();
      }, 300);

      // Also listen for CANPLAY to preload sooner if possible
      if (cached?.player) {
        const onCanPlay = () => {
          if (!currentEpisodeReadyRef.current) {
            currentEpisodeReadyRef.current = true;
            if (pendingPreloadRef.current) {
              clearTimeout(pendingPreloadRef.current);
              pendingPreloadRef.current = null;
            }
            doPreload();
          }
          cached.player.off('canplay', onCanPlay);
        };
        cached.player.on('canplay', onCanPlay);
      }
    },
    [episodes, preloadEpisode, cache]
  );

  // Handle swiper init
  const handleSwiperInit = useCallback(
    (swiper: SwiperType) => {
      swiperRef.current = swiper;

      const episode = episodes[swiper.activeIndex];
      if (!episode) return;

      // IMPORTANT: With Virtual Slides, the DOM elements aren't rendered yet when onSwiper fires.
      // We need to wait for the next animation frame to ensure the slides are in the DOM.
      requestAnimationFrame(() => {
        // Guard against destroyed swiper instance (component unmounted during rAF)
        if (!swiper?.el) return;

        // Find active slide by episode ID (works with virtual slides)
        const activeSlide = swiper.el.querySelector(
          `[data-episode-id="${episode._id}"]`
        ) as HTMLElement;

        if (activeSlide) {
          cache.setActiveEpisode(episode._id);
          initPlayer(activeSlide, swiper.activeIndex);

          // Smart preload: next immediately, previous delayed
          // This saves bandwidth on initial load while maintaining UX
          preloadAdjacentEpisodes(swiper, swiper.activeIndex);
        }
      });
    },
    [episodes, cache, initPlayer, preloadAdjacentEpisodes]
  );

  // Handle slide change - PRIMARY handler for player initialization
  // With Virtual Slides, onSlideChange fires before DOM is updated for distant jumps.
  // Uses MutationObserver for reliable DOM detection on long jumps.
  const handleSlideChange = useCallback(
    (swiper: SwiperType) => {
      // Cancel any pending initialization from previous rapid swipes
      if (pendingInitRef.current) {
        clearTimeout(pendingInitRef.current);
        pendingInitRef.current = null;
      }
      // Disconnect any pending MutationObserver from previous long jump
      if (pendingObserverRef.current) {
        pendingObserverRef.current.disconnect();
        pendingObserverRef.current = null;
      }

      const newIndex = swiper.activeIndex;
      const prevIndex = swiper.previousIndex;
      onEpisodeChange(newIndex);

      const episode = episodes[newIndex];
      if (!episode || episode.isLocked) return;

      cache.setActiveEpisode(episode._id);

      // Check if this is a long jump (> 2 episodes)
      const isLongJump = Math.abs(newIndex - (prevIndex ?? 0)) > 2;

      // Try to find and initialize the player
      const tryInitPlayer = () => {
        if (!swiper?.el) return false;

        const activeSlide = swiper.el.querySelector(
          `[data-episode-id="${episode._id}"]`
        ) as HTMLElement;

        const playerHost = activeSlide?.querySelector('.player-host') as HTMLElement;

        if (activeSlide && playerHost?.isConnected) {
          initPlayer(activeSlide, newIndex);
          preloadAdjacentEpisodes(swiper, newIndex);
          return true;
        }
        return false;
      };

      // For long jumps, use MutationObserver for reliable DOM detection
      if (isLongJump) {
        // First, try immediately (Virtual Slides may have updated in transitionStart)
        if (tryInitPlayer()) return;

        // Use MutationObserver to wait for DOM
        const observer = new MutationObserver(() => {
          if (tryInitPlayer()) {
            observer.disconnect();
            pendingObserverRef.current = null;
            if (pendingInitRef.current) {
              clearTimeout(pendingInitRef.current);
              pendingInitRef.current = null;
            }
          }
        });

        observer.observe(swiper.el, {
          childList: true,
          subtree: true,
        });
        pendingObserverRef.current = observer;

        // Timeout fallback - disconnect observer after 1 second
        pendingInitRef.current = window.setTimeout(() => {
          observer.disconnect();
          pendingObserverRef.current = null;
          // Last attempt
          tryInitPlayer();
        }, 1000);
      } else {
        // For short swipes, simple polling is sufficient
        const poll = (retries = 0) => {
          if (tryInitPlayer()) {
            pendingInitRef.current = null;
            return;
          }
          if (retries < 10) {
            pendingInitRef.current = window.setTimeout(() => poll(retries + 1), 20);
          }
        };

        // Start after a frame to let Virtual Slides update DOM
        requestAnimationFrame(() => poll(0));
      }
    },
    [episodes, cache, initPlayer, onEpisodeChange, preloadAdjacentEpisodes]
  );

  // Handle slide change start - save position and preload target
  const handleSlideChangeTransitionStart = useCallback(
    (swiper: SwiperType) => {
      // Save position of previous episode
      const prevIndex = swiper.previousIndex;
      if (prevIndex !== undefined && prevIndex >= 0 && prevIndex < episodes.length) {
        const prevEpisode = episodes[prevIndex];
        if (prevEpisode && !prevEpisode.isLocked) {
          cache.savePosition(prevEpisode._id);
        }
      }

      // Pause all players during transition - gives bandwidth to new episode
      cache.pauseAll();

      // For long jumps (> 2 episodes), force Virtual Slides to update immediately
      // This ensures the target slide DOM exists before we try to init the player
      const targetIndex = swiper.activeIndex;
      const jumpDistance = Math.abs(targetIndex - (prevIndex ?? 0));

      if (jumpDistance > 2 && swiper.virtual) {
        // Force immediate virtual slides update for long jumps
        swiper.virtual.update(true);
      }

      // Try to preload target episode during transition (if DOM exists)
      // For long jumps, DOM may not exist yet - handleSlideChange will handle it
      preloadEpisode(swiper, targetIndex);
    },
    [episodes, cache, preloadEpisode]
  );

  // Navigate to specific episode (called from parent via initialIndex change)
  // Player initialization is handled by handleSlideChange when slideTo triggers onSlideChange
  useEffect(() => {
    const swiper = swiperRef.current;
    if (!swiper || swiper.activeIndex === initialIndex) return;

    // Save position of current episode before navigating
    const prevIndex = swiper.activeIndex;
    const prevEpisode = episodes[prevIndex];
    if (prevEpisode && !prevEpisode.isLocked) {
      cache.savePosition(prevEpisode._id);
    }
    cache.pauseAll();

    // Navigate to the new slide - handleSlideChange will initialize the player
    swiper.slideTo(initialIndex);
  }, [initialIndex, episodes, cache]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel pending player initialization
      if (pendingInitRef.current) {
        clearTimeout(pendingInitRef.current);
      }
      // Disconnect any pending MutationObserver
      if (pendingObserverRef.current) {
        pendingObserverRef.current.disconnect();
      }
      // Cancel pending preload
      if (pendingPreloadRef.current) {
        clearTimeout(pendingPreloadRef.current);
      }
      // Save position of current episode
      if (cache.activeEpisodeId) {
        cache.savePosition(cache.activeEpisodeId);
      }
    };
  }, [cache]);

  // Debug: show cache stats only in dev (avoid unnecessary object creation in production)
  const cacheStats = import.meta.env.DEV ? cache.getCacheStats() : undefined;

  // Note: Skeleton loading disabled - video player handles its own loading state via xgplayer

  return (
    <div className="hybrid-video-player relative w-full h-full bg-black overflow-hidden">
      <Swiper
        direction="vertical"
        slidesPerView={1}
        // Premium swipe feel - smooth and elegant
        speed={380}                    // Slightly slower for premium feel
        threshold={5}                  // Intentional swipe required
        touchRatio={1}                 // Natural touch response
        resistanceRatio={0.7}          // Satisfying edge resistance
        followFinger={true}            // Real-time finger tracking
        shortSwipes={true}             // Quick flicks still work
        longSwipesRatio={0.35}         // Balanced swipe completion threshold
        longSwipesMs={250}             // Time for long swipe detection
        touchStartPreventDefault={false} // Better scroll handling
        watchSlidesProgress
        onSwiper={handleSwiperInit}
        onSlideChange={handleSlideChange}
        onSlideChangeTransitionStart={handleSlideChangeTransitionStart}
        initialSlide={initialIndex}
        modules={[EffectCreative, Virtual]}
        effect="creative"
        creativeEffect={{
          perspective: true,
          limitProgress: 2,            // Smoother multi-slide transitions
          shadowPerProgress: true,     // Dynamic shadow based on progress
          prev: {
            translate: [0, "-100%", -150],   // Deeper Z for cinematic depth
            scale: 0.88,                      // More noticeable scale for depth
            opacity: 0.4,                     // Elegant fade
            shadow: true,                     // Drop shadow for depth
          },
          next: {
            translate: [0, "100%", 0],
            scale: 1,
            opacity: 0.6,                     // Slight fade for incoming slide
          },
        }}
        // Virtual slides - only render slides in/near viewport for 100+ episode performance
        virtual={{
          enabled: true,
          addSlidesBefore: 2,
          addSlidesAfter: 2,
        }}
        className="premium-swiper w-full h-full"
        style={{ perspective: "1000px" }}
      >
        {episodes.map((episode, index) => (
          <SwiperSlide
            key={episode._id}
            data-episode-id={episode._id}
            virtualIndex={index}
            className={episode.isLocked ? "locked" : ""}
          >
            <PlayerErrorBoundary episodeId={episode._id}>
              <EpisodeSlide
                episode={episode}
                index={index}
                totalEpisodes={episodes.length}
                seriesTitle={seriesTitle}
                isLiked={!!likedEpisodes[episode._id]}
                cacheStats={cacheStats}
                onToggleLike={toggleLike}
                onVideoClick={handleVideoClick}
                onLockedEpisode={onLockedEpisode}
                onShowEpisodes={onShowEpisodes}
              />
            </PlayerErrorBoundary>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
