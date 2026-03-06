/**
 * Purchase Return Hook
 *
 * Handles URL query params after returning from Solidgate payment page.
 * - ?purchase=success&clipId=xxx → wait for credits, auto-download clip
 * - ?purchase=failed → show error toast, re-open pricing drawer
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { creditsQueryKey, useCredits } from '@/hooks/useCredits';
import { useDownload } from '@/hooks/useDownload';

function getAndClearPurchaseParams(): { status: string | null; clipId: string | null } {
  const url = new URL(window.location.href);
  const status = url.searchParams.get('purchase');
  const clipId = url.searchParams.get('clipId');

  if (status) {
    url.searchParams.delete('purchase');
    url.searchParams.delete('clipId');
    window.history.replaceState({}, '', url.pathname + url.search);
  }

  return { status, clipId };
}

interface UsePurchaseReturnOptions {
  onFailed?: () => void;
}

/** Max time to poll for credits after payment return (ms) */
const POLL_TIMEOUT = 15_000;
/** Interval between credit balance polls (ms) */
const POLL_INTERVAL = 2_000;

export function usePurchaseReturn(options: UsePurchaseReturnOptions = {}) {
  const queryClient = useQueryClient();
  const { totalCredits } = useCredits();
  const { download } = useDownload();
  const processed = useRef(false);
  const pendingClipId = useRef<string | null>(null);
  const onFailedRef = useRef(options.onFailed);
  useEffect(() => { onFailedRef.current = options.onFailed; });

  // On mount, check for purchase return params
  useEffect(() => {
    if (processed.current) return;

    const { status, clipId } = getAndClearPurchaseParams();
    if (!status) return;

    processed.current = true;

    if (status === 'failed') {
      toast.error('Payment failed — no credits charged');
      onFailedRef.current?.();
      return;
    }

    if (status === 'success') {
      // Force refetch credits to pick up webhook-granted balance
      queryClient.invalidateQueries({ queryKey: creditsQueryKey });

      if (clipId) {
        pendingClipId.current = clipId;
        toast.success('Credits added! Downloading your clip...');
      } else {
        toast.success('Credits added to your account!');
      }

      // Poll for credits in case webhook hasn't processed yet
      const start = Date.now();
      const poll = setInterval(() => {
        if (Date.now() - start > POLL_TIMEOUT || !pendingClipId.current) {
          clearInterval(poll);
          return;
        }
        queryClient.invalidateQueries({ queryKey: creditsQueryKey });
      }, POLL_INTERVAL);

      return () => clearInterval(poll);
    }
  }, [queryClient]);

  // Auto-download when credits arrive after purchase
  useEffect(() => {
    if (!pendingClipId.current || totalCredits <= 0) return;

    const clipId = pendingClipId.current;
    pendingClipId.current = null;
    download(clipId);
  }, [totalCredits, download]);
}
