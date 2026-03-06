/**
 * DownloadHistory Component
 *
 * Displays paginated list of downloaded clips with metadata.
 * Includes re-download button and license link per item.
 * Shows empty state when no downloads exist.
 */

import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useDownloadHistory } from '@/hooks/useDownloadHistory';
import { useDownload } from '@/hooks/useDownload';
import { LicenseDrawer } from './LicenseDrawer';
import { Download, FileText, Loader2 } from 'lucide-react';
import { MotionButton, buttonAnimations } from '@/components/ui/motion-button';
import { formatRelativeDate } from '@/lib/date-utils';
import type { DownloadHistoryItem } from '@/types';

interface DownloadHistoryRowProps {
  item: DownloadHistoryItem;
  download: (clipId: string) => void;
  isDownloading: (clipId: string) => boolean;
}

function DownloadHistoryRow({ item, download, isDownloading }: DownloadHistoryRowProps) {
  const [licenseOpen, setLicenseOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-3 py-3">
        {/* Thumbnail */}
        <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
          {item.thumbnailUrl ? (
            <img
              src={item.thumbnailUrl}
              alt={item.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
              <Download className="h-5 w-5" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.title}</p>
          <p className="text-xs text-muted-foreground truncate">{item.creatorName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-muted-foreground">{formatRelativeDate(item.downloadDate)}</span>
            <span className="text-[11px] text-muted-foreground">·</span>
            <span className="text-[11px] text-muted-foreground">
              {item.creditCost === 0 ? 'Free' : `${item.creditCost} credit`}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => setLicenseOpen(true)}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label="View license"
          >
            <FileText className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => download(item.clipId)}
            disabled={isDownloading(item.clipId)}
            className="p-2 text-primary hover:text-primary/80 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Re-download clip"
          >
            {isDownloading(item.clipId) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <LicenseDrawer
        open={licenseOpen}
        onOpenChange={setLicenseOpen}
        clipTitle={item.title}
        downloadDate={item.downloadDate}
      />
    </>
  );
}

export function DownloadHistory() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
  } = useDownloadHistory();
  const { download, isDownloading } = useDownload();

  const allDownloads = data?.pages.flatMap((page) => page.downloads) ?? [];

  if (isPending) {
    return (
      <div className="space-y-3 py-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div className="h-12 w-12 rounded-lg bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (allDownloads.length === 0) {
    return (
      <div className="text-center py-8">
        <Download className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground mb-3">No downloads yet</p>
        <Link
          to="/browse"
          className="text-sm text-primary hover:underline cursor-pointer"
        >
          Browse clips
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y divide-border/50">
        {allDownloads.map((item) => (
          <DownloadHistoryRow key={item.clipId} item={item} download={download} isDownloading={isDownloading} />
        ))}
      </div>

      {hasNextPage && (
        <MotionButton
          variant="ghost"
          size="sm"
          className="w-full mt-2"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          {...buttonAnimations.press}
        >
          {isFetchingNextPage ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          {isFetchingNextPage ? 'Loading...' : 'Load more'}
        </MotionButton>
      )}
    </div>
  );
}
