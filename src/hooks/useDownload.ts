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
import { creditsQueryKey, useCredits } from '@/hooks/useCredits';
import { downloadedClipsQueryKey } from '@/hooks/useDownloadedClips';
import { useSubscription } from '@/hooks/useSubscription';
import { useHaptic } from '@/hooks/useHaptic';
import type { DownloadClipResponse } from '@/types';

function getDownloadToastMessage(
  data: DownloadClipResponse,
  hasSubscription: boolean,
): string {
  if (data.alreadyDownloaded) return 'Already in your downloads';
  if (hasSubscription) return 'Downloaded! Commercial use included — Unlimited';
  if (
    data.freeDownloadsRemaining === 0 &&
    data.creditCost > 0 &&
    data.creditsRemaining > 0
  ) {
    return 'Last free download used! Get more credits to continue downloading';
  }
  const remaining = data.creditsRemaining + data.freeDownloadsRemaining;
  return `Downloaded! Commercial use included — ${remaining} credits left`;
}

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

interface UseDownloadOptions {
  onNeedsCredits?: () => void;
}

export function useDownload(options: UseDownloadOptions = {}) {
  const queryClient = useQueryClient();
  const { data: subscription } = useSubscription();
  const { totalCredits, freeDownloads } = useCredits();
  const haptic = useHaptic();
  const { onNeedsCredits } = options;
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

      // Optimistically add clip to downloaded set
      queryClient.setQueryData<string[]>(downloadedClipsQueryKey, (old) =>
        old ? (old.includes(clipId) ? old : [...old, clipId]) : [clipId],
      );

      // Toast message based on state
      toast.success(getDownloadToastMessage(data, !!subscription?.hasSubscription));
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

      // Pre-flight: if no credits and no subscription, open pricing drawer
      if (totalCredits === 0 && !subscription?.hasSubscription && onNeedsCredits) {
        onNeedsCredits();
        return;
      }

      downloadingClips.current.add(clipId);
      mutation.mutate(clipId);
    },
    [mutation, totalCredits, subscription, onNeedsCredits],
  );

  // Stable callback - only checks ref, no re-render on mutation state change
  const isDownloading = useCallback(
    (clipId: string) => downloadingClips.current.has(clipId),
    [],
  );

  return {
    download,
    isDownloading,
    isPending: mutation.isPending,
  };
}
