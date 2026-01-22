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
import { ArrowLeft, Heart, Share2, List } from "lucide-react";
import { Button } from "./ui/button";
import { Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useVideoPlayerCache } from "@/contexts/VideoPlayerCacheContext";
import { PlayerErrorBoundary } from "./ErrorBoundary";
import type Player from "xgplayer";
import "xgplayer/dist/index.min.css";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCreative, Virtual } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
// Use bundle CSS - includes all module styles (effect-creative, navigation, pagination, etc.)
// Individual module CSS imports have Vite 7 compatibility issues with exports field conditions
import "swiper/css/bundle";

// Utility functions - moved outside component to avoid recreation
const formatNumber = (num?: number) => {
  if (!num) return "0";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

// Stable event handler to stop propagation (prevents click bubbling to video)
const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

interface HybridVideoPlayerProps {
  episodes: Episode[];
  initialIndex: number;
  seriesTitle: string;
  onEpisodeChange: (index: number) => void;
  onLockedEpisode: () => void;
  onShowEpisodes?: () => void;
}

interface EpisodeSlideProps {
  episode: Episode;
  index: number;
  totalEpisodes: number;
  seriesTitle: string;
  showControls: boolean;
  isLiked: boolean;
  cacheStats?: { size: number; maxSize: number };
  onToggleLike: (episodeId: string) => void; // Accept episodeId to avoid inline arrow in parent
  onVideoClick: () => void;
  onLockedEpisode: () => void;
  onShowEpisodes?: () => void;
}

/**
 * Memoized slide component to prevent unnecessary re-renders
 * Only re-renders when its specific props change
 */
const EpisodeSlide = memo(function EpisodeSlide({
  episode,
  index,
  totalEpisodes,
  seriesTitle,
  showControls,
  isLiked,
  cacheStats,
  onToggleLike,
  onVideoClick,
  onLockedEpisode,
  onShowEpisodes,
}: EpisodeSlideProps) {
  return (
    <div
      className="relative w-full h-full"
      onClick={episode.isLocked ? undefined : onVideoClick}
    >
      {/* Video content */}
      <div className="w-full h-full flex items-center justify-center">
        {episode.isLocked ? (
          <div className="flex flex-col items-center justify-center text-white">
            <h2 className="text-xl font-bold mb-2">Episode is locked</h2>
            <p className="text-gray-400 mb-4">Subscribe to unlock</p>
            <Button onClick={onLockedEpisode}>Subscribe</Button>
          </div>
        ) : (
          <div
            className="player-host w-full h-full"
            data-episode-id={episode._id}
          />
        )}
      </div>

      {/* Episode indicator */}
      <div className="absolute top-4 right-4 z-50 bg-black/60 px-3 py-1 rounded-full text-white text-sm">
        {index + 1} / {totalEpisodes}
        {import.meta.env.DEV && cacheStats && (
          <span className="ml-2 text-xs text-gray-400">
            (cached: {cacheStats.size}/{cacheStats.maxSize})
          </span>
        )}
      </div>

      {/* TikTok-style Floating Action Buttons */}
      <div
        className={`custom-controls absolute bottom-24 md:bottom-32 right-4 flex flex-col gap-4 z-50 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={stopPropagation}
      >
        {/* Like Button */}
        <div className="flex flex-col items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleLike(episode._id)}
            className={`h-12 w-12 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-all ${
              isLiked ? "text-red-500" : "text-white"
            }`}
          >
            <Heart className={`h-6 w-6 ${isLiked ? "fill-current" : ""}`} />
          </Button>
          <span className="text-white text-xs font-semibold drop-shadow-lg">
            {formatNumber(episode.views ? Math.floor(episode.views / 10) : 4500)}
          </span>
        </div>

        {/* Episodes Button - Mobile only */}
        {onShowEpisodes && (
          <div className="flex flex-col items-center gap-1 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={onShowEpisodes}
              className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white"
            >
              <List className="h-6 w-6" />
            </Button>
            <span className="text-white text-xs font-semibold drop-shadow-lg">
              Episodes
            </span>
          </div>
        )}

        {/* Share Button */}
        <div className="flex flex-col items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white"
          >
            <Share2 className="h-6 w-6" />
          </Button>
          <span className="text-white text-xs font-semibold drop-shadow-lg">
            Share
          </span>
        </div>
      </div>

      {/* Top Info Bar */}
      <div
        className={`custom-controls absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 md:p-6 z-50 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={stopPropagation}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:text-primary hover:bg-white/10"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h3 className="text-white font-medium text-sm md:text-base">
                {seriesTitle}
              </h3>
              <p className="text-gray-300 text-xs md:text-sm">
                Episode {episode.episodeNumber || index + 1}
                {episode.title && ` - ${episode.title}`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export function HybridVideoPlayer({
  episodes,
  initialIndex,
  seriesTitle,
  onEpisodeChange,
  onLockedEpisode,
  onShowEpisodes,
}: HybridVideoPlayerProps) {
  // Track likes per episode
  const [likedEpisodes, setLikedEpisodes] = useState<Record<string, boolean>>({});
  const [showControls, setShowControls] = useState(true);

  const swiperRef = useRef<SwiperType | null>(null);
  // Track which players have had events set up (per component instance)
  const playersWithEventsRef = useRef(new WeakSet<Player>());

  // Use the cache context for player management
  const cache = useVideoPlayerCache();

  // Toggle like for a specific episode
  const toggleLike = useCallback((episodeId: string) => {
    setLikedEpisodes(prev => ({
      ...prev,
      [episodeId]: !prev[episodeId]
    }));
  }, []);

  // Check if current player is paused
  const isPlayerPaused = useCallback(() => {
    if (!cache.activeEpisodeId) return true;
    const cached = cache.getCachedPlayer(cache.activeEpisodeId);
    return !cached?.player || cached.player.paused;
  }, [cache]);

  // Handle mouse enter - show controls (desktop)
  const handleMouseEnter = useCallback(() => {
    setShowControls(true);
  }, []);

  // Handle mouse leave - hide controls if playing (desktop)
  const handleMouseLeave = useCallback(() => {
    if (!isPlayerPaused()) {
      setShowControls(false);
    }
  }, [isPlayerPaused]);

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

  // Get HLS URL for the episode
  const getHlsUrl = useCallback((ep: Episode) => {
    if (ep.videoId) {
      return `https://customer-9u10nm8oora2n5zb.cloudflarestream.com/${ep.videoId}/manifest/video.m3u8`;
    }
    return "https://customer-9u10nm8oora2n5zb.cloudflarestream.com/e173ed29029287118d810abce2ea35c5/manifest/video.m3u8";
  }, []);

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
        // Player exists - restore position and play
        const cached = cache.getCachedPlayer(episode._id);
        if (cached) {
          setupPlayerEvents(cached.player, slideIndex);
          cache.restorePosition(episode._id);
          cache.playPlayer(episode._id);
        }
        return;
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

  // Pre-cache adjacent episodes during idle time
  const preloadAdjacentEpisodes = useCallback(
    (swiper: SwiperType, currentIndex: number) => {
      // Use requestIdleCallback for non-blocking preload
      const preload = () => {
        // Preload next episode
        if (currentIndex + 1 < episodes.length) {
          preloadEpisode(swiper, currentIndex + 1);
        }
        // Preload previous episode
        if (currentIndex - 1 >= 0) {
          preloadEpisode(swiper, currentIndex - 1);
        }
      };

      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(preload, { timeout: 2000 });
      } else {
        // Fallback for Safari
        setTimeout(preload, 100);
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

          // Pre-init adjacent episodes (virtual slides pre-renders them via addSlidesBefore/After)
          preloadEpisode(swiper, swiper.activeIndex + 1);
          preloadEpisode(swiper, swiper.activeIndex - 1);
        }
      });
    },
    [episodes, cache, initPlayer, preloadEpisode]
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

  // Handle slide change end - play the preloaded episode (for swipe gestures)
  const handleSlideChangeTransitionEnd = useCallback(
    (swiper: SwiperType) => {
      const newIndex = swiper.activeIndex;
      onEpisodeChange(newIndex);

      const episode = episodes[newIndex];
      if (episode) {
        cache.setActiveEpisode(episode._id);

        // IMPORTANT: With Virtual Slides, when jumping to distant slides (e.g., from 1 to 12),
        // the DOM elements may not exist yet when this callback fires.
        // Virtual slides renders asynchronously, so we need to retry until the element appears.
        const tryInitPlayer = (retries = 0) => {
          // Guard against destroyed swiper instance
          if (!swiper?.el) return;

          // Find active slide by episode ID (works with virtual slides)
          const activeSlide = swiper.el.querySelector(
            `[data-episode-id="${episode._id}"]`
          ) as HTMLElement;

          if (activeSlide) {
            // initPlayer will either play cached player or create new one if needed
            initPlayer(activeSlide, newIndex);
            // Pre-cache adjacent episodes during idle time for next transitions
            preloadAdjacentEpisodes(swiper, newIndex);
          } else if (retries < 5) {
            // Virtual slides may need more time to render after programmatic slideTo
            // Retry with increasing delay (16ms, 32ms, 48ms, 64ms, 80ms)
            setTimeout(() => tryInitPlayer(retries + 1), 16);
          }
        };

        // Start with requestAnimationFrame to sync with render
        requestAnimationFrame(() => tryInitPlayer(0));
      }
    },
    [episodes, cache, initPlayer, onEpisodeChange, preloadAdjacentEpisodes]
  );


  // Navigate to specific episode (called from parent via initialIndex change)
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

    // Navigate to the new slide
    swiper.slideTo(initialIndex);

    // IMPORTANT: Swiper's onSlideChangeTransitionEnd doesn't fire reliably when
    // slideTo() is called during React re-renders. We need to manually initialize
    // the player after the transition completes.
    const episode = episodes[initialIndex];
    if (episode && !episode.isLocked) {
      cache.setActiveEpisode(episode._id);

      // Wait for transition to complete and virtual slides to render
      const tryInitPlayer = (retries = 0) => {
        if (!swiper?.el) return;

        const activeSlide = swiper.el.querySelector(
          `[data-episode-id="${episode._id}"]`
        ) as HTMLElement;

        if (activeSlide) {
          initPlayer(activeSlide, initialIndex);
          preloadAdjacentEpisodes(swiper, initialIndex);
        } else if (retries < 10) {
          // More retries since we're not waiting for transition event
          setTimeout(() => tryInitPlayer(retries + 1), 50);
        }
      };

      // Wait for transition animation to complete (speed is 280ms)
      setTimeout(() => {
        requestAnimationFrame(() => tryInitPlayer(0));
      }, 300);
    }
  }, [initialIndex, episodes, cache, initPlayer, preloadAdjacentEpisodes]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Save position of current episode
      if (cache.activeEpisodeId) {
        cache.savePosition(cache.activeEpisodeId);
      }
    };
  }, [cache]);

  // Debug: show cache stats only in dev (avoid unnecessary object creation in production)
  const cacheStats = import.meta.env.DEV ? cache.getCacheStats() : undefined;

  return (
    <div
      className="hybrid-video-player relative w-full h-full bg-black overflow-hidden"
      data-controls-visible={showControls}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Swiper
        direction="vertical"
        slidesPerView={1}
        // TikTok-style animation (Option A from UX research)
        speed={280}                    // Faster, snappier than 350
        threshold={3}                  // More responsive to touch
        touchRatio={1.2}              // Slightly more sensitive
        resistanceRatio={0.65}        // Subtle bounce at edges
        followFinger={true}           // Real-time finger tracking
        shortSwipes={true}            // Quick flicks work
        longSwipesRatio={0.3}         // Easier to complete swipe
        watchSlidesProgress
        onSwiper={handleSwiperInit}
        onSlideChangeTransitionStart={handleSlideChangeTransitionStart}
        onSlideChangeTransitionEnd={handleSlideChangeTransitionEnd}
        initialSlide={initialIndex}
        modules={[EffectCreative, Virtual]}
        effect="creative"
        creativeEffect={{
          perspective: true,          // Enable 3D perspective (distance set via CSS)
          prev: {
            translate: [0, "-100%", -80],  // Slight Z depth for outgoing
            scale: 0.96,                    // Scale down outgoing slide
            opacity: 0.5,                   // Fade outgoing slide
          },
          next: {
            translate: [0, "100%", 0],
            scale: 1,
            opacity: 0,
          },
        }}
        // Virtual slides - only render slides in/near viewport for 100+ episode performance
        virtual={{
          enabled: true,
          addSlidesBefore: 2, // Pre-render 2 slides before active for smooth backward swipe
          addSlidesAfter: 2,  // Pre-render 2 slides after active for smooth forward swipe
        }}
        className="w-full h-full"
        style={{ perspective: "1200px" }}  // 3D perspective distance for depth effect
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
                showControls={showControls}
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
