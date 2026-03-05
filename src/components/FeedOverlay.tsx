/**
 * FeedOverlay Component
 *
 * Right-side action column for the vertical feed.
 * Buttons: heart (with count), download (with count + lock overlay), share, filter.
 */

import { memo, useCallback, useState } from 'react';
import { Heart, Download, Check, Loader2, Share2, SlidersHorizontal, Lock } from 'lucide-react';
import { useDownload } from '@/hooks/useDownload';
import { useOptimizedSession } from '@/hooks/useOptimizedSession';
import { useCredits } from '@/hooks/useCredits';
import { useSubscription } from '@/hooks/useSubscription';
import { useDownloadedClips } from '@/hooks/useDownloadedClips';
import { PricingDrawer } from './PricingDrawer';

// Constants - defined once, reused across all instances
const BUTTON_BASE = 'flex items-center justify-center w-10 h-10 rounded-full transition-all';
const BUTTON_GLASS = `${BUTTON_BASE} bg-white/8 backdrop-blur-2xl border border-white/5 text-white/75 hover:bg-white/12 hover:text-white/90`;
const AVATAR_BASE = 'flex items-center justify-center w-9 h-9 rounded-full bg-white/8 border-[1.5px] border-white/12 text-[13px] font-semibold text-white/70 mb-1';

// Helper functions - extracted outside component to avoid recreation on every render
function formatCount(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}

function stopPropagation(e: React.MouseEvent): void {
  e.stopPropagation();
}

function getFilterButtonClass(active: boolean): string {
  return `${BUTTON_BASE} backdrop-blur-2xl border ${
    active
      ? 'bg-white/15 border-white/10 text-white/90'
      : 'bg-white/8 border-white/5 text-white/75 hover:bg-white/12 hover:text-white/90'
  }`;
}

export interface FeedOverlayProps {
  clipId: string;
  likeCount: number;
  downloadCount: number;
  creatorName?: string;
  onCreatorTap?: () => void;
  onFilterTap?: () => void;
  activeCategoryName?: string;
  onAuthRequired?: () => void;
}

export const FeedOverlay = memo(function FeedOverlay({
  clipId,
  likeCount,
  downloadCount,
  creatorName,
  onCreatorTap,
  onFilterTap,
  activeCategoryName,
  onAuthRequired,
}: FeedOverlayProps) {
  const [pricingOpen, setPricingOpen] = useState(false);
  const handleNeedsCredits = useCallback(() => setPricingOpen(true), []);
  const { download, isDownloading } = useDownload({
    onNeedsCredits: handleNeedsCredits,
  });
  const { data: session } = useOptimizedSession();
  const isAuthenticated = !!session;
  const { totalCredits } = useCredits();
  const { data: subscription } = useSubscription();
  const { isDownloaded } = useDownloadedClips();
  const loading = isDownloading(clipId);
  const alreadyDownloaded = isDownloaded(clipId);
  const showLock = isAuthenticated && totalCredits === 0 && !subscription?.hasSubscription && !alreadyDownloaded;

  const handleDownload = useCallback(() => {
    if (!isAuthenticated) {
      onAuthRequired?.();
      return;
    }
    download(clipId);
  }, [isAuthenticated, onAuthRequired, download, clipId]);

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
    <>
      <div
        className="absolute right-3.5 bottom-[120px] flex flex-col items-center gap-5 z-20"
        onClick={stopPropagation}
      >
        {/* Creator avatar */}
        {creatorName && (
          <button type="button" onClick={onCreatorTap} className={AVATAR_BASE} aria-label={`View ${creatorName}'s profile`}>
            {creatorName.charAt(0).toUpperCase()}
          </button>
        )}

        {/* Heart with count */}
        <div className="flex flex-col items-center gap-[3px]">
          <button type="button" className={BUTTON_GLASS} aria-label="Like">
            <Heart className="w-[18px] h-[18px]" strokeWidth={1.5} />
          </button>
          <span className="text-[10px] font-medium text-white/45 tracking-[0.01em]">
            {formatCount(likeCount)}
          </span>
        </div>

        {/* Download with lock overlay */}
        <div className="flex flex-col items-center gap-[3px]">
          <div className="relative">
            <button type="button" onClick={handleDownload} className={BUTTON_GLASS} aria-label={alreadyDownloaded ? 'Re-download' : 'Download'} disabled={loading}>
              {loading
                ? <Loader2 className="w-[18px] h-[18px] animate-spin" strokeWidth={1.5} />
                : alreadyDownloaded
                  ? <Check className="w-[18px] h-[18px] text-green-400" strokeWidth={1.5} />
                  : <Download className="w-[18px] h-[18px]" strokeWidth={1.5} />
              }
            </button>
            {showLock && (
              <Lock className="absolute -bottom-0.5 -right-0.5 w-3 h-3 text-white/50" strokeWidth={2} />
            )}
          </div>
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

      <PricingDrawer open={pricingOpen} onOpenChange={setPricingOpen} />
    </>
  );
});
