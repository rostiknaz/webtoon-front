/**
 * FeedOverlay Component
 *
 * Right-side action column for the vertical feed.
 * Buttons: heart (with count), download (primary accent, with count), share, filter.
 * No creator profile button — creator name is tappable in FeedSlide metadata.
 */

import { memo, useCallback } from 'react';
import { Heart, Download, Share2, SlidersHorizontal } from 'lucide-react';

const formatCount = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
};

const BUTTON_BASE = 'flex items-center justify-center w-10 h-10 rounded-full transition-all';
const BUTTON_GLASS = `${BUTTON_BASE} bg-white/8 backdrop-blur-2xl border border-white/5 text-white/75 hover:bg-white/12 hover:text-white/90`;
const BUTTON_ACCENT = `${BUTTON_BASE} bg-primary/15 border border-primary/12 text-primary hover:bg-primary/22`;

const getFilterButtonClass = (active: boolean) =>
  `${BUTTON_BASE} backdrop-blur-2xl border ${
    active
      ? 'bg-white/15 border-white/10 text-white/90'
      : 'bg-white/8 border-white/5 text-white/75 hover:bg-white/12 hover:text-white/90'
  }`;

export interface FeedOverlayProps {
  likeCount: number;
  downloadCount: number;
  onFilterTap?: () => void;
  activeCategoryName?: string;
}

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

export const FeedOverlay = memo(function FeedOverlay({
  likeCount,
  downloadCount,
  onFilterTap,
  activeCategoryName,
}: FeedOverlayProps) {
  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ url: window.location.href });
      } catch {
        // User cancelled or share failed
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
    }
  }, []);

  return (
    <div
      className="absolute right-3.5 bottom-[120px] flex flex-col items-center gap-5 z-20"
      onClick={stopPropagation}
    >
      {/* Heart with count */}
      <div className="flex flex-col items-center gap-[3px]">
        <button type="button" className={BUTTON_GLASS} aria-label="Like">
          <Heart className="w-[18px] h-[18px]" strokeWidth={1.5} />
        </button>
        <span className="text-[10px] font-medium text-white/45 tracking-[0.01em]">
          {formatCount(likeCount)}
        </span>
      </div>

      {/* Download — primary accent */}
      <div className="flex flex-col items-center gap-[3px]">
        <button type="button" className={BUTTON_ACCENT} aria-label="Download">
          <Download className="w-[18px] h-[18px]" strokeWidth={1.5} />
        </button>
        <span className="text-[10px] font-medium text-white/45 tracking-[0.01em]">
          {formatCount(downloadCount)}
        </span>
      </div>

      {/* Share */}
      <button type="button" onClick={handleShare} className={BUTTON_GLASS} aria-label="Share">
        <Share2 className="w-[18px] h-[18px]" strokeWidth={1.5} />
      </button>

      {/* Filter — opens category drawer */}
      {onFilterTap && (
        <div className="flex flex-col items-center gap-[3px]">
          <button
            type="button"
            onClick={onFilterTap}
            className={getFilterButtonClass(!!activeCategoryName)}
            aria-label="Filter"
          >
            <SlidersHorizontal className="w-[18px] h-[18px]" strokeWidth={1.5} />
          </button>
          {activeCategoryName && (
            <span className="text-[10px] font-medium text-white/60 tracking-[0.01em]">
              {activeCategoryName}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
