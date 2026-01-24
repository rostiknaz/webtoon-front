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

// R2 CDN base URL for self-hosted HLS streaming (FREE egress!)
// Fallback provided since VITE_ vars are replaced at build time and may not be available in CI/CD
const R2_CDN_URL = import.meta.env.VITE_R2_CDN_URL || 'https://pub-e8eb9b2155904feeb0e7c5e0712a87e2.r2.dev';

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

  // Generate HLS URL for the episode
  // Path: {seriesSlug}/ep_{paddedEpisodeNumber}/manifest.m3u8
  const getHlsUrl = useCallback((_ep: Episode) => {
    // TODO: Remove hardcoded ep_01 when all episodes are uploaded to R2
    return `${R2_CDN_URL}/${seriesSlug}/ep_01/manifest.m3u8`;

    // Original implementation:
    // const paddedEp = ep.episodeNumber.toString().padStart(2, '0');
    // return `${R2_CDN_URL}/${seriesSlug}/ep_${paddedEp}/manifest.m3u8`;
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

      const hlsUrl = getHlsUrl(episode);
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
      const result = cache.initPlayerInHost(
        episode._id,
        hlsUrl,
        host
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
    [episodes, getHlsUrl, onLockedEpisode, cache, setupPlayerEvents]
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

      const hlsUrl = getHlsUrl(episode);
      cache.preloadPlayer(episode._id, hlsUrl, host);
    },
    [episodes, getHlsUrl, cache]
  );

  /**
   * Aggressive preloading strategy optimized for R2's FREE egress:
   * - NEXT 2 episodes: Preload immediately for instant swipe transitions
   * - PREVIOUS episode: Preload immediately (no delay needed with free bandwidth)
   *
   * With free egress, we prioritize UX over bandwidth costs.
   */
  const preloadAdjacentEpisodes = useCallback(
    (swiper: SwiperType, currentIndex: number) => {
      // NEXT episode: Preload immediately - critical for TikTok-like UX
      if (currentIndex + 1 < episodes.length) {
        preloadEpisode(swiper, currentIndex + 1);
      }

      // NEXT+1 episode: Preload during idle time (free bandwidth!)
      if (currentIndex + 2 < episodes.length) {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(
            () => preloadEpisode(swiper, currentIndex + 2),
            { timeout: 1000 }
          );
        } else {
          // Safari fallback - use setTimeout
          setTimeout(() => preloadEpisode(swiper, currentIndex + 2), 100);
        }
      }

      // PREVIOUS episode: Preload immediately (free egress = no delay needed)
      if (currentIndex - 1 >= 0) {
        preloadEpisode(swiper, currentIndex - 1);
      }
    },
    [episodes.length, preloadEpisode]
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
  // We poll until the slide element exists (usually 1-2 iterations).
  const handleSlideChange = useCallback(
    (swiper: SwiperType) => {
      // Cancel any pending initialization from previous rapid swipes
      if (pendingInitRef.current) {
        clearTimeout(pendingInitRef.current);
        pendingInitRef.current = null;
      }

      const newIndex = swiper.activeIndex;
      onEpisodeChange(newIndex);

      const episode = episodes[newIndex];
      if (!episode || episode.isLocked) return;

      cache.setActiveEpisode(episode._id);

      // Poll for Virtual Slides to render the DOM element
      const tryInitPlayer = (retries = 0) => {
        if (!swiper?.el) return;

        const activeSlide = swiper.el.querySelector(
          `[data-episode-id="${episode._id}"]`
        ) as HTMLElement;

        const playerHost = activeSlide?.querySelector('.player-host') as HTMLElement;

        if (activeSlide && playerHost?.isConnected) {
          pendingInitRef.current = null;
          initPlayer(activeSlide, newIndex);
          preloadAdjacentEpisodes(swiper, newIndex);
        } else if (retries < 10) {
          // Fixed 20ms intervals, max 200ms total
          pendingInitRef.current = window.setTimeout(() => tryInitPlayer(retries + 1), 20);
        }
      };

      // Start after a frame to let Virtual Slides update DOM
      requestAnimationFrame(() => tryInitPlayer(0));
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

      // Pause all players during transition
      cache.pauseAll();

      // IMPORTANT: Preload the target episode NOW (during transition)
      // This gives the player time to initialize while the animation plays
      const targetIndex = swiper.activeIndex;
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
