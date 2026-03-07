/**
 * Purchase Return Hook
 *
 * Handles URL query params after returning from Solidgate payment page.
 * - ?purchase=success&clipId=xxx → wait for credits, auto-download clip
 * - ?purchase=subscription-success&clipId=xxx → wait for subscription, auto-download clip
 * - ?purchase=failed → show error toast, re-open pricing drawer
 *
 * Uses exponential backoff polling to reduce network requests.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { creditsQueryKey, useCredits } from '@/hooks/useCredits';
import { useDownload } from '@/hooks/useDownload';
import { subscriptionQueryKey } from '@/services/subscription.service';

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

/** Max time to poll for credits/subscription after payment return (ms) */
const POLL_TIMEOUT_MS = 15_000;
/** Initial poll interval before exponential backoff (ms) */
const INITIAL_POLL_INTERVAL_MS = 500;
/** Max poll interval (ms) */
const MAX_POLL_INTERVAL_MS = 8000;

/**
 * Exponential backoff polling helper.
 * Reduces network requests from ~8 to ~5 max by increasing delay between attempts.
 */
async function pollWithBackoff(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
  checkComplete: () => boolean,
  timeoutMs: number
): Promise<void> {
  const start = Date.now();
  let attempts = 0;

  const poll = async (): Promise<void> => {
    if (Date.now() - start > timeoutMs) {
      return; // Timeout reached
    }

    attempts++;
    await queryClient.invalidateQueries({ queryKey });

    if (checkComplete()) {
      return; // Success - stop polling
    }

    // Exponential backoff: 500ms, 1s, 2s, 4s, 8s
    const delay = Math.min(INITIAL_POLL_INTERVAL_MS * Math.pow(2, attempts - 1), MAX_POLL_INTERVAL_MS);
    setTimeout(poll, delay);
  };

  await poll();
}

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

      // Poll with exponential backoff until credits arrive
      void pollWithBackoff(
        queryClient,
        creditsQueryKey,
        () => totalCredits > 0 || !pendingClipId.current,
        POLL_TIMEOUT_MS
      );

      return;
    }

    if (status === 'subscription-success') {
      // Invalidate subscription cache to pick up webhook-created subscription
      queryClient.invalidateQueries({ queryKey: subscriptionQueryKey });

      if (clipId) {
        pendingClipId.current = clipId;
        toast.success('Subscription activated! Downloading your clip...');
      } else {
        toast.success('Subscription activated! Enjoy unlimited downloads');
      }

      // Poll subscription status with exponential backoff
      void pollWithBackoff(
        queryClient,
        subscriptionQueryKey,
        () => {
          const sub = queryClient.getQueryData(subscriptionQueryKey);
          return !!(sub as any)?.hasSubscription || !pendingClipId.current;
        },
        POLL_TIMEOUT_MS
      );

      return;
    }
  }, [queryClient, totalCredits]);

  // Auto-download when credits arrive after purchase
  useEffect(() => {
    if (!pendingClipId.current || totalCredits <= 0) return;

    const clipId = pendingClipId.current;
    pendingClipId.current = null;
    download(clipId);
  }, [totalCredits, download]);
}
