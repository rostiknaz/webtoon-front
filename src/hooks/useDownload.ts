/**
 * Download Hook
 *
 * TanStack Query mutation for downloading clips.
 * Handles credit deduction, file download trigger, toast notifications,
 * and per-clip loading state tracking.
 */

import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { downloadClip } from '@/api';
import { creditsQueryKey } from '@/hooks/useCredits';
import { useSubscription } from '@/hooks/useSubscription';
import { useHaptic } from '@/hooks/useHaptic';
import type { DownloadClipResponse } from '@/types';

/**
 * Trigger browser download via hidden anchor element
 */
function triggerFileDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function useDownload() {
  const queryClient = useQueryClient();
  const { data: subscription } = useSubscription();
  const haptic = useHaptic();
  // Track which clips are currently downloading to prevent double-tap
  const downloadingClips = useRef(new Set<string>());

  const mutation = useMutation({
    mutationFn: downloadClip,
    onSuccess: (data: DownloadClipResponse, clipId: string) => {
      // Trigger file download
      triggerFileDownload(data.downloadUrl, `clip-${clipId}.mp4`);

      // Haptic feedback
      haptic.success();

      // Invalidate credits cache to reflect new balance
      queryClient.invalidateQueries({ queryKey: creditsQueryKey });

      // Toast message based on state
      if (data.alreadyDownloaded) {
        toast.success('Already in your downloads');
      } else if (subscription?.hasSubscription) {
        toast.success('Downloaded! Commercial use included — Unlimited');
      } else {
        const remaining = data.creditsRemaining + data.freeDownloadsRemaining;
        toast.success(`Downloaded! Commercial use included — ${remaining} credits left`);
      }
    },
    onError: (error: Error, clipId: string) => {
      haptic.error();

      // Parse error message for insufficient credits
      if (error.message.includes('Insufficient credits')) {
        toast.error('No credits remaining');
      } else {
        toast.error('Download failed', {
          action: {
            label: 'Retry',
            onClick: () => download(clipId),
          },
        });
      }
    },
    onSettled: (_data, _error, clipId: string) => {
      downloadingClips.current.delete(clipId);
    },
  });

  const download = useCallback(
    (clipId: string) => {
      // Prevent double-tap
      if (downloadingClips.current.has(clipId)) return;
      downloadingClips.current.add(clipId);
      mutation.mutate(clipId);
    },
    [mutation],
  );

  const isDownloading = useCallback(
    (clipId: string) => downloadingClips.current.has(clipId) || (mutation.isPending && mutation.variables === clipId),
    [mutation.isPending, mutation.variables],
  );

  return {
    download,
    isDownloading,
    isPending: mutation.isPending,
  };
}
