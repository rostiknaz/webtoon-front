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
import { useState, useEffect, useRef, useCallback } from "react";
import { useVideoPlayerCache } from "@/contexts/VideoPlayerCacheContext";
import type Player from "xgplayer";
import "xgplayer/dist/index.min.css";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCreative } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
// Use bundle CSS - includes all module styles (effect-creative, navigation, pagination, etc.)
// Individual module CSS imports have Vite 7 compatibility issues with exports field conditions
import "swiper/css/bundle";

// Track which players have had events set up
const playersWithEvents = new WeakSet<Player>();

interface HybridVideoPlayerProps {
  episodes: Episode[];
  initialIndex: number;
  seriesTitle: string;
  onEpisodeChange: (index: number) => void;
  onLockedEpisode: () => void;
  onShowEpisodes?: () => void;
}

export function HybridVideoPlayer({
  episodes,
  initialIndex,
  seriesTitle,
  onEpisodeChange,
  onLockedEpisode,
  onShowEpisodes,
}: HybridVideoPlayerProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const swiperRef = useRef<SwiperType | null>(null);

  // Use the cache context for player management
  const cache = useVideoPlayerCache();

  const formatNumber = (num?: number) => {
    if (!num) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

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
      if (playersWithEvents.has(player)) return;
      playersWithEvents.add(player);

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
      const host = slideEl.querySelector(".player-host") as HTMLElement;
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
      const { player, isNew } = cache.initPlayerInHost(
        episode._id,
        hlsUrl,
        host
      );

      if (isNew) {
        setupPlayerEvents(player, slideIndex);
      }

      // Play the new player (play event will hide controls)
      cache.playPlayer(episode._id);
    },
    [episodes, getHlsUrl, onLockedEpisode, cache, setupPlayerEvents]
  );

  // Preload a player without playing (for smooth transitions)
  const preloadEpisode = useCallback(
    (swiper: SwiperType, slideIndex: number) => {
      if (slideIndex < 0 || slideIndex >= episodes.length) return;

      const episode = episodes[slideIndex];
      if (!episode || episode.isLocked) return;

      const slideEl = swiper.slides[slideIndex] as HTMLElement;
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

      // Initialize player for the initial slide
      const activeSlide = swiper.slides[swiper.activeIndex] as HTMLElement;
      if (activeSlide) {
        const episode = episodes[swiper.activeIndex];
        if (episode) {
          cache.setActiveEpisode(episode._id);
          // initPlayer will play the video, play event will hide controls
          initPlayer(activeSlide, swiper.activeIndex);

          // Pre-init first 3 episodes (or adjacent) for instant switching
          const startIndex = swiper.activeIndex;
          for (let i = 0; i < 3 && startIndex + i < episodes.length; i++) {
            if (i === 0) continue; // Skip active (already initialized)
            preloadEpisode(swiper, startIndex + i);
          }
        }
      }
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

  // Handle slide change end - play the preloaded episode
  const handleSlideChangeTransitionEnd = useCallback(
    (swiper: SwiperType) => {
      const newIndex = swiper.activeIndex;
      onEpisodeChange(newIndex);

      const episode = episodes[newIndex];
      if (episode) {
        cache.setActiveEpisode(episode._id);

        // Player was preloaded during transition start - now just play it
        const activeSlide = swiper.slides[newIndex] as HTMLElement;
        if (activeSlide) {
          // initPlayer will either play cached player or create new one if needed
          initPlayer(activeSlide, newIndex);
        }

        // Pre-cache adjacent episodes during idle time for next transitions
        preloadAdjacentEpisodes(swiper, newIndex);
      }
    },
    [episodes, cache, initPlayer, onEpisodeChange, preloadAdjacentEpisodes]
  );


  // Navigate to specific episode (called from parent via initialIndex change)
  useEffect(() => {
    if (swiperRef.current && swiperRef.current.activeIndex !== initialIndex) {
      swiperRef.current.slideTo(initialIndex);
    }
  }, [initialIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Save position of current episode
      if (cache.activeEpisodeId) {
        cache.savePosition(cache.activeEpisodeId);
      }
    };
  }, [cache]);

  // Debug: show cache stats in dev
  const cacheStats = cache.getCacheStats();

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
        speed={350}
        resistanceRatio={0}
        watchSlidesProgress
        onSwiper={handleSwiperInit}
        onSlideChangeTransitionStart={handleSlideChangeTransitionStart}
        onSlideChangeTransitionEnd={handleSlideChangeTransitionEnd}
        initialSlide={initialIndex}
        modules={[EffectCreative]}
        effect="creative"
        creativeEffect={{
          prev: {
            translate: [0, "-100%", 0],
            opacity: 0,
          },
          next: {
            translate: [0, "100%", 0],
            opacity: 0,
          },
        }}
        className="w-full h-full"
      >
        {episodes.map((episode, index) => (
          <SwiperSlide
            key={`${episode._id}-${index}`}
            data-episode-id={episode._id}
            className={episode.isLocked ? "locked" : ""}
          >
            {/* Slide container - includes video + controls as one unit */}
            <div
              className="relative w-full h-full"
              onClick={episode.isLocked ? undefined : handleVideoClick}
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
                {index + 1} / {episodes.length}
                {import.meta.env.DEV && (
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
                onClick={(e) => e.stopPropagation()}
              >
                {/* Like Button */}
                <div className="flex flex-col items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsLiked(!isLiked)}
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
                onClick={(e) => e.stopPropagation()}
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
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
