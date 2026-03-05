/**
 * DownloadButton Component
 *
 * Primary accent-colored download button with loading state.
 * Only primary-colored element per UX-12.
 */

import { useCallback } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useDownload } from '@/hooks/useDownload';
import { cn } from '@/lib/utils';

interface DownloadButtonProps {
  clipId: string;
  className?: string;
}

export function DownloadButton({ clipId, className }: DownloadButtonProps) {
  const { download, isDownloading } = useDownload();
  const loading = isDownloading(clipId);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    download(clipId);
  }, [loading, download, clipId]);

  return (
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
      aria-label={loading ? 'Downloading...' : 'Download clip'}
    >
      {loading
        ? <Loader2 className="size-3.5 animate-spin" />
        : <Download className="size-3.5" />
      }
    </button>
  );
}
