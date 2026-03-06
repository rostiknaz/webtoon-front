/**
 * DownloadButton Component
 *
 * Glass-styled download button with loading state, lock overlay, and pricing gate.
 */

import { useCallback, useState } from 'react';
import { Check, Download, Loader2, Lock } from 'lucide-react';
import { useDownload } from '@/hooks/useDownload';
import { useCredits } from '@/hooks/useCredits';
import { useSubscription } from '@/hooks/useSubscription';
import { useDownloadedClips } from '@/hooks/useDownloadedClips';
import { useOptimizedSession } from '@/hooks/useOptimizedSession';
import { PricingDrawer } from './PricingDrawer';
import { cn } from '@/lib/utils';

interface DownloadButtonProps {
  clipId: string;
  className?: string;
}

export function DownloadButton({ clipId, className }: DownloadButtonProps) {
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

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    download(clipId);
  }, [loading, download, clipId]);

  return (
    <>
      <div className="relative inline-flex">
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className={cn(
            'flex items-center justify-center rounded-full p-2.5',
            'cursor-pointer',
            'bg-white/8 text-white/50 hover:bg-white/12 hover:text-white/70',
            'disabled:opacity-70',
            'transition-colors',
            className,
          )}
          aria-label={loading ? 'Downloading...' : alreadyDownloaded ? 'Re-download clip' : 'Download clip'}
        >
          {loading
            ? <Loader2 className="size-3.5 animate-spin" />
            : alreadyDownloaded
              ? <Check className="size-3.5 text-green-400" />
              : <Download className="size-3.5" />
          }
        </button>
        {showLock && (
          <Lock className="absolute -bottom-0.5 -right-0.5 w-3 h-3 text-white/50" strokeWidth={2} />
        )}
      </div>
      <PricingDrawer open={pricingOpen} onOpenChange={setPricingOpen} clipId={clipId} />
    </>
  );
}
