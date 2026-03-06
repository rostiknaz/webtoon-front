/**
 * EpisodeSlide Component
 *
 * Memoized slide component for the HybridVideoPlayer.
 * Handles individual episode display, controls, and interactions.
 */

import type { Episode } from "../types.ts";
import { ArrowLeft, Heart, Share2, List } from "lucide-react";
import { Button } from "./ui/button";
import { MotionButton, buttonAnimations } from "./ui/motion-button";
import { Link } from "@tanstack/react-router";
import { useState, useRef, useCallback, memo } from "react";
import { useDoubleTap } from "@/hooks/useDoubleTap";
import { useHaptic } from "@/hooks/useHaptic";
import { HeartAnimation } from "./HeartAnimation";
import { formatCompact } from "@/lib/format";

// Stable event handler to stop propagation (prevents click bubbling to video)
const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

export interface EpisodeSlideProps {
  episode: Episode;
  index: number;
  totalEpisodes: number;
  seriesTitle: string;
  isLiked: boolean;
  cacheStats?: { size: number; maxSize: number };
  onToggleLike: (episodeId: string) => void;
  onVideoClick: () => void;
  onLockedEpisode: () => void;
  onShowEpisodes?: () => void;
}

/**
 * Memoized slide component to prevent unnecessary re-renders
 * Only re-renders when its specific props change
 */
export const EpisodeSlide = memo(function EpisodeSlide({
  episode,
  index,
  totalEpisodes,
  seriesTitle,
  isLiked,
  cacheStats,
  onToggleLike,
  onVideoClick,
  onLockedEpisode,
  onShowEpisodes,
}: EpisodeSlideProps) {
  // Haptic feedback for like interactions
  const haptic = useHaptic();

  // Ref for like button to get its position for flying heart animation
  const likeButtonRef = useRef<HTMLButtonElement>(null);

  // Heart animation state for double-tap like
  const [heartAnimation, setHeartAnimation] = useState<{
    show: boolean;
    x: number;
    y: number;
    targetPosition: { x: number; y: number } | null;
  }>({ show: false, x: 0, y: 0, targetPosition: null });

  // Double-tap detection for Instagram-style like
  const { handlers: doubleTapHandlers } = useDoubleTap({
    onDoubleTap: (position) => {
      // Get like button position for flying animation
      let targetPosition: { x: number; y: number } | null = null;
      if (likeButtonRef.current) {
        const rect = likeButtonRef.current.getBoundingClientRect();
        targetPosition = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      }

      // Show heart animation with target position
      setHeartAnimation({
        show: true,
        x: position.x,
        y: position.y,
        targetPosition,
      });

      // Only toggle like if not already liked (Instagram behavior)
      if (!isLiked) {
        onToggleLike(episode._id);
        // Haptic feedback for mobile (medium intensity for like action)
        haptic.medium();
      }
    },
    onSingleTap: onVideoClick,
    threshold: 300,
  });

  const handleHeartAnimationComplete = useCallback(() => {
    setHeartAnimation((prev) => ({ ...prev, show: false }));
  }, []);

  return (
    <div
      className="relative w-full h-full"
      {...(episode.isLocked ? {} : doubleTapHandlers)}
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
          /* Player host - xgplayer will be mounted here */
          <div
            className="player-host w-full h-full bg-background"
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
        className="custom-controls absolute bottom-24 md:bottom-32 right-4 flex flex-col gap-4 z-50"
        onClick={stopPropagation}
      >
        {/* Like Button */}
        <div className="flex flex-col items-center gap-1">
          <MotionButton
            ref={likeButtonRef}
            variant="ghost"
            size="icon"
            onClick={() => {
              onToggleLike(episode._id);
              // Haptic feedback: medium for like, light for unlike
              if (isLiked) {
                haptic.light();
              } else {
                haptic.medium();
              }
            }}
            className={`h-12 w-12 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-all ${
              isLiked ? "text-red-500" : "text-white"
            }`}
            {...buttonAnimations.iconPulse}
          >
            <Heart className={`h-6 w-6 ${isLiked ? "fill-current" : ""}`} />
          </MotionButton>
          <span className="text-white text-xs font-semibold drop-shadow-lg">
            {formatCompact(episode.views ? Math.floor(episode.views / 10) : 4500)}
          </span>
        </div>

        {/* Episodes Button - Mobile only */}
        {onShowEpisodes && (
          <div className="flex flex-col items-center gap-1 md:hidden">
            <MotionButton
              variant="ghost"
              size="icon"
              onClick={onShowEpisodes}
              className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white"
              {...buttonAnimations.iconPulse}
            >
              <List className="h-6 w-6" />
            </MotionButton>
            <span className="text-white text-xs font-semibold drop-shadow-lg">
              Episodes
            </span>
          </div>
        )}

        {/* Share Button */}
        <div className="flex flex-col items-center gap-1">
          <MotionButton
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white"
            {...buttonAnimations.iconPulse}
          >
            <Share2 className="h-6 w-6" />
          </MotionButton>
          <span className="text-white text-xs font-semibold drop-shadow-lg">
            Share
          </span>
        </div>
      </div>

      {/* Top Info Bar */}
      <div
        className="custom-controls absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 md:p-6 z-50"
        onClick={stopPropagation}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <MotionButton
                variant="ghost"
                size="icon"
                className="text-white hover:text-primary hover:bg-white/10"
                {...buttonAnimations.press}
              >
                <ArrowLeft className="h-5 w-5" />
              </MotionButton>
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

      {/* Double-tap heart animation - flies to like button */}
      <HeartAnimation
        show={heartAnimation.show}
        x={heartAnimation.x}
        y={heartAnimation.y}
        targetPosition={heartAnimation.targetPosition}
        onComplete={handleHeartAnimationComplete}
      />
    </div>
  );
});
