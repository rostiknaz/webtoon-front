/**
 * FeedPlayer Component
 *
 * Main feed swipe player using Swiper.js with EffectCreative and Virtual modules.
 * Uses native <video> for short clips (no xgplayer dependency).
 * Implements infinite scroll by triggering onLoadMore when near end of loaded clips.
 * Integrates swipe gate: shows registration card overlay after N swipes for anonymous users.
 */

import { useCallback, useRef, useMemo, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCreative, Virtual } from 'swiper/modules';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css/bundle';

import { FeedSlide } from './FeedSlide';
import { FeedOverlay } from './FeedOverlay';
import { RegistrationCard } from './RegistrationCard';
import { useSwipeGate } from '@/hooks/useSwipeGate';
import { getSignedVideoUrlSync, prefetchVideoTokens, R2_CDN_URL } from '@/lib/video-url';
import type { FeedClip, CategoryItem } from '../types';

// Helper extracted outside component to avoid recreation on every render
function extractR2Path(videoUrl: string): string {
  return videoUrl.replace(R2_CDN_URL + '/', '');
}

const GATE_TRANSITION = { type: 'spring' as const, stiffness: 300, damping: 30 };
const SWIPER_STYLE = { perspective: '1000px' } as const;

interface FeedPlayerProps {
  clips: FeedClip[];
  onLoadMore: () => void;
  hasMore: boolean;
  onCreatorTap: (creatorId: string) => void;
  categories?: CategoryItem[];
  onFilterTap?: () => void;
  activeCategoryName?: string;
  showNsfwIndicator?: boolean;
}

export function FeedPlayer({
  clips,
  onLoadMore,
  hasMore,
  onCreatorTap,
  categories,
  onFilterTap,
  activeCategoryName,
  showNsfwIndicator,
}: FeedPlayerProps) {
  const swiperRef = useRef<SwiperType | null>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const shouldReduceMotion = useReducedMotion() ?? false;

  const {
    shouldShowGate,
    incrementSwipeCount,
    markGateShown,
    markRegistered,
    isAuthenticated,
  } = useSwipeGate();

  // Prefetch video tokens for initial clips
  useEffect(() => {
    const paths = clips.slice(0, 5).map((clip) => {
      if (!clip.videoUrl) return null;
      return extractR2Path(clip.videoUrl);
    }).filter(Boolean) as string[];
    if (paths.length > 0) prefetchVideoTokens(paths);
  }, [clips]);

  // Clean up stale video refs when clips change (e.g. category filter)
  const clipIds = useMemo(() => new Set(clips.map((c) => c._id)), [clips]);
  useEffect(() => {
    for (const [id, video] of videoRefs.current) {
      if (!clipIds.has(id)) {
        video.pause();
        video.removeAttribute('src');
        video.load(); // release network resources
        videoRefs.current.delete(id);
      }
    }
  }, [clipIds]);

  // Build category lookup map for O(1) name resolution
  const categoryMap = useMemo(() => {
    if (!categories) return new Map<string, string>();
    return new Map(categories.map((c) => [c.id, c.name]));
  }, [categories]);

  const getCategoryName = useCallback(
    (clip: FeedClip) => {
      if (clip.categoryIds.length === 0) return undefined;
      return categoryMap.get(clip.categoryIds[0]);
    },
    [categoryMap],
  );

  // Play a clip's video element
  const playClip = useCallback((clipId: string) => {
    const video = videoRefs.current.get(clipId);
    if (video) {
      video.play().catch(() => {
        // Autoplay blocked — expected on some browsers
      });
    }
  }, []);

  // Pause a clip's video element
  const pauseClip = useCallback((clipId: string) => {
    const video = videoRefs.current.get(clipId);
    if (video) {
      video.pause();
    }
  }, []);

  // Ensure video element exists in the slide's video-host
  // Use ref to access current clips without adding to deps (avoids callback recreation)
  const clipsRef = useRef(clips);
  clipsRef.current = clips;

  const ensureVideoElement = useCallback(
    (swiper: SwiperType, index: number) => {
      const currentClips = clipsRef.current;
      if (index < 0 || index >= currentClips.length) return;
      const clip = currentClips[index];
      if (!clip) return;

      // Already have a video ref for this clip
      if (videoRefs.current.has(clip._id)) return;

      // Find the slide's video-host container
      const slideEl = swiper.el?.querySelector(`[data-clip-id="${clip._id}"]`) as HTMLElement;
      if (!slideEl) return;

      // Don't create duplicate video elements
      if (slideEl.querySelector('video')) return;

      const video = document.createElement('video');
      if (clip.videoUrl) {
        const r2Path = extractR2Path(clip.videoUrl);
        video.src = getSignedVideoUrlSync(r2Path, R2_CDN_URL);
      }
      if (clip.thumbnailUrl) video.poster = clip.thumbnailUrl;
      video.muted = true;
      video.playsInline = true;
      video.loop = true;
      video.preload = 'metadata';
      video.className = 'h-full w-full object-cover';
      slideEl.appendChild(video);
      videoRefs.current.set(clip._id, video);
    },
    [], // No dependencies - uses ref for current clips
  );

  const handleSwiperInit = useCallback(
    (swiper: SwiperType) => {
      swiperRef.current = swiper;

      // Wait for Virtual slides to render
      requestAnimationFrame(() => {
        if (!swiper?.el) return;
        const clip = clipsRef.current[swiper.activeIndex];
        if (!clip) return;

        ensureVideoElement(swiper, swiper.activeIndex);
        playClip(clip._id);

        // Preload adjacent
        ensureVideoElement(swiper, swiper.activeIndex + 1);
      });
    },
    [ensureVideoElement, playClip], // clips removed - uses ref
  );

  const handleSlideChange = useCallback(
    (swiper: SwiperType) => {
      const currentIndex = swiper.activeIndex;
      const currentClips = clipsRef.current;
      const currentClip = currentClips[currentIndex];
      const previousClip = currentClips[swiper.previousIndex];

      // Track swipe count for gate logic (only for anonymous users)
      if (!isAuthenticated) {
        incrementSwipeCount();
      }

      // Pause previous
      if (previousClip && previousClip._id !== currentClip?._id) {
        pauseClip(previousClip._id);
      }

      // Ensure video and play current
      if (currentClip) {
        ensureVideoElement(swiper, currentIndex);
        playClip(currentClip._id);
      }

      // Preload next slide
      ensureVideoElement(swiper, currentIndex + 1);

      // Infinite scroll: trigger load more when within 5 clips of end
      const remaining = currentClips.length - currentIndex;
      if (remaining <= 5 && hasMore) {
        onLoadMore();
      }
    },
    [hasMore, onLoadMore, ensureVideoElement, playClip, pauseClip, isAuthenticated, incrementSwipeCount], // clips removed - uses ref
  );

  if (clips.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white/50">
        No clips available
      </div>
    );
  }

  return (
    <div className="feed-player relative w-full h-full bg-black overflow-hidden">
      <Swiper
        direction="vertical"
        slidesPerView={1}
        speed={380}
        threshold={5}
        touchRatio={1}
        resistanceRatio={0.7}
        followFinger={true}
        shortSwipes={true}
        longSwipesRatio={0.35}
        longSwipesMs={250}
        touchStartPreventDefault={false}
        allowTouchMove={!shouldShowGate}
        watchSlidesProgress
        onSwiper={handleSwiperInit}
        onSlideChange={handleSlideChange}
        modules={[EffectCreative, Virtual]}
        effect="creative"
        creativeEffect={{
          perspective: true,
          limitProgress: 2,
          shadowPerProgress: true,
          prev: {
            translate: [0, '-100%', -150],
            scale: 0.88,
            opacity: 0.4,
            shadow: true,
          },
          next: {
            translate: [0, '100%', 0],
            scale: 1,
            opacity: 0.6,
          },
        }}
        virtual={{
          enabled: true,
          addSlidesBefore: 2,
          addSlidesAfter: 2,
        }}
        className="w-full h-full"
        style={SWIPER_STYLE}
      >
        {clips.map((clip, index) => (
          <SwiperSlide key={clip._id} virtualIndex={index}>
            <FeedSlide
              clip={clip}
              onCreatorTap={onCreatorTap}
              categoryName={getCategoryName(clip)}
              showNsfwIndicator={showNsfwIndicator}
            />
            <FeedOverlay
              clipId={clip._id}
              likeCount={clip.likes}
              downloadCount={clip.downloadCount}
              creatorName={clip.creatorName}
              onCreatorTap={() => onCreatorTap(clip.creatorId)}
              onFilterTap={onFilterTap}
              activeCategoryName={activeCategoryName}
            />
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Registration gate overlay — slides up from bottom like the next video */}
      <AnimatePresence>
        {shouldShowGate && (
          shouldReduceMotion ? (
            <div
              key="registration-gate"
              className="absolute inset-0 z-50"
              data-testid="registration-gate"
            >
              <RegistrationCard
                onDismiss={markGateShown}
                onRegistered={markRegistered}
              />
            </div>
          ) : (
            <motion.div
              key="registration-gate"
              className="absolute inset-0 z-50"
              data-testid="registration-gate"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={GATE_TRANSITION}
            >
              <RegistrationCard
                onDismiss={markGateShown}
                onRegistered={markRegistered}
              />
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
}
