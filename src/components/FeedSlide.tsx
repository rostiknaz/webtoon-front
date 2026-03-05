/**
 * FeedSlide Component
 *
 * Memoized slide for a single clip in the vertical feed.
 * Each slide gets a stable brand gradient variant based on clip ID hash.
 * Bottom padding accounts for 52px bottom nav bar.
 */

import { memo } from 'react';
import { Eye } from 'lucide-react';
import type { FeedClip } from '../types';

const formatCount = (num: number) => {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
};

const GRADIENT_COUNT = 5;

/** Stable hash → gradient index from clip ID. Same clip always gets same color. */
const getGradientIndex = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % GRADIENT_COUNT;
};

export interface FeedSlideProps {
  clip: FeedClip;
  onCreatorTap: (creatorId: string) => void;
  categoryName?: string;
  showNsfwIndicator?: boolean;
}

export const FeedSlide = memo(function FeedSlide({
  clip,
  onCreatorTap,
  categoryName,
  showNsfwIndicator,
}: FeedSlideProps) {
  const gradientClass = `brand-gradient-${getGradientIndex(clip._id)}`;

  return (
    <div className="relative w-full h-full">
      {/* Brand gradient background — visible as loader or when no video */}
      <div className={`absolute inset-0 ${gradientClass}`} />

      {/* Video container — parent (FeedPlayer) manages <video> element */}
      <div
        className="video-host w-full h-full relative z-[1]"
        data-clip-id={clip._id}
      />

      {/* Bottom metadata overlay — padding-bottom: 66px to clear bottom nav */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-[66px] pt-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
        {/* Badges row */}
        <div className="flex gap-1.5 mb-2">
          {clip.seriesId !== null && clip.episodeNumber !== null && clip.seriesTotalEpisodes !== null && (
            <span className="inline-flex items-center rounded-[4px] bg-white/8 backdrop-blur-sm px-2 py-[3px] text-[10px] font-medium text-white/65 tracking-[0.02em]">
              {clip.episodeNumber} / {clip.seriesTotalEpisodes}
            </span>
          )}
          {categoryName && (
            <span className="inline-flex items-center rounded-[4px] bg-white/8 backdrop-blur-sm px-2 py-[3px] text-[10px] font-medium text-white/55 tracking-[0.02em]">
              {categoryName}
            </span>
          )}
          {showNsfwIndicator && clip.nsfwRating !== 'safe' && (
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-nsfw/15 backdrop-blur-sm px-2 py-[3px] text-[10px] font-semibold text-nsfw tracking-[0.02em]">
              <span className="block w-1.5 h-1.5 rounded-full bg-nsfw" />
              18+
            </span>
          )}
        </div>

        {/* Clip title — Space Grotesk 15/600 */}
        <h3 className="text-[15px] font-semibold text-white/92 leading-tight mb-[3px] tracking-[-0.01em]">
          {clip.title}
        </h3>

        {/* Creator name + duration */}
        <div className="text-[12px] text-white/40 font-normal">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCreatorTap(clip.creatorId);
            }}
            className="hover:text-white/60 transition-colors"
          >
            {clip.creatorName}
          </button>
          <span className="mx-1.5">·</span>
          <span className="inline-flex items-center gap-0.5">
            <Eye className="w-3 h-3" strokeWidth={1.5} />
            {formatCount(clip.views)}
          </span>
        </div>
      </div>
    </div>
  );
});
