/**
 * Upload Pipeline Hook
 *
 * Manages the full clip upload lifecycle as a state machine:
 * idle -> validating -> uploading -> completing -> moderating -> done | error
 *
 * Uses XMLHttpRequest for upload progress tracking (fetch doesn't support it).
 * Polls clip status during moderation step until AI scan completes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { initClipUpload, completeClipUpload, retryClipUpload, getClipStatus } from '@/api';
import type { UploadInitInput, UploadCompleteResponse } from '@/types';

export type UploadStep = 'idle' | 'validating' | 'uploading' | 'completing' | 'moderating' | 'done' | 'error';

export interface UploadState {
  step: UploadStep;
  clipId: string | null;
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
  result: UploadCompleteResponse | null;
  moderationStatus: string | null;
  error: string | null;
}

const INITIAL_STATE: UploadState = {
  step: 'idle',
  clipId: null,
  progress: 0,
  bytesTransferred: 0,
  totalBytes: 0,
  result: null,
  moderationStatus: null,
  error: null,
};

const MODERATION_POLL_INTERVAL = 3000;
const MODERATION_POLL_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export function useClipUpload() {
  const [state, setState] = useState<UploadState>(INITIAL_STATE);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  const seriesIdRef = useRef<string | undefined>(undefined);
  const queryClient = useQueryClient();

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Clean up polling on unmount
  useEffect(() => cleanup, [cleanup]);

  const reset = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    cleanup();
    setState(INITIAL_STATE);
  }, [cleanup]);

  const uploadToR2 = useCallback((presignedUrl: string, file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setState((prev) => {
            const newProgress = Math.round((e.loaded / e.total) * 100);
            // Skip re-render if progress hasn't meaningfully changed
            if (prev.progress === newProgress) return prev;
            return {
              ...prev,
              progress: newProgress,
              bytesTransferred: e.loaded,
              totalBytes: e.total,
            };
          });
        }
      };

      xhr.onload = () => {
        xhrRef.current = null;
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        xhrRef.current = null;
        reject(new Error('Network error during upload'));
      };

      xhr.onabort = () => {
        xhrRef.current = null;
        reject(new Error('Upload cancelled'));
      };

      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', 'video/mp4');
      xhr.send(file);
    });
  }, []);

  const pollModeration = useCallback((clipId: string, seriesId?: string) => {
    setState((prev) => ({ ...prev, step: 'moderating', moderationStatus: 'processing' }));
    pollStartRef.current = Date.now();

    pollRef.current = setInterval(async () => {
      // Timeout after 5 minutes to prevent infinite polling
      if (Date.now() - pollStartRef.current > MODERATION_POLL_TIMEOUT) {
        cleanup();
        setState((prev) => ({ ...prev, step: 'error', error: 'Moderation timed out. Check your uploads page for status.' }));
        return;
      }

      try {
        const clip = await getClipStatus(clipId);

        if (clip.status !== 'processing') {
          cleanup();
          const result: UploadCompleteResponse = {
            _id: clipId,
            status: clip.status,
            reason: clip.reason,
          };
          setState((prev) => ({
            ...prev,
            step: 'done',
            moderationStatus: clip.status,
            result,
          }));
          queryClient.invalidateQueries({ queryKey: ['clips', 'mine'] });
          if (seriesId) {
            queryClient.invalidateQueries({ queryKey: ['creator-series', seriesId] });
          }
        }
      } catch {
        // Polling errors are non-fatal — keep trying
      }
    }, MODERATION_POLL_INTERVAL);
  }, [cleanup, queryClient]);

  const start = useCallback(async (input: UploadInitInput, file: File) => {
    try {
      // Step 1: Init
      seriesIdRef.current = input.seriesId;
      setState((prev) => ({ ...prev, step: 'validating', error: null }));
      const initResult = await initClipUpload(input);
      const clipId = initResult._id;

      setState((prev) => ({
        ...prev,
        step: 'uploading',
        clipId,
        progress: 0,
        bytesTransferred: 0,
        totalBytes: file.size,
      }));

      // Step 2: Upload to R2
      await uploadToR2(initResult.presignedUrl, file);

      // Step 3: Complete + trigger moderation
      setState((prev) => ({ ...prev, step: 'completing', progress: 100 }));
      const completeResult = await completeClipUpload(clipId);

      // If moderation already returned a final status (sync scan)
      if (completeResult.status !== 'processing') {
        setState((prev) => ({
          ...prev,
          step: 'done',
          result: completeResult,
          moderationStatus: completeResult.status,
        }));
        queryClient.invalidateQueries({ queryKey: ['clips', 'mine'] });
        if (input.seriesId) {
          queryClient.invalidateQueries({ queryKey: ['creator-series', input.seriesId] });
        }
        return;
      }

      // Step 4: Poll for moderation result
      pollModeration(clipId, input.seriesId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      if (message === 'Upload cancelled') {
        reset();
        return;
      }
      setState((prev) => ({ ...prev, step: 'error', error: message }));
    }
  }, [uploadToR2, pollModeration, queryClient, reset]);

  const retry = useCallback(async (file: File) => {
    const clipId = state.clipId;
    if (!clipId) return;

    try {
      setState((prev) => ({
        ...prev,
        step: 'uploading',
        error: null,
        progress: 0,
        bytesTransferred: 0,
        totalBytes: file.size,
      }));

      const retryResult = await retryClipUpload(clipId);
      await uploadToR2(retryResult.presignedUrl, file);

      setState((prev) => ({ ...prev, step: 'completing', progress: 100 }));
      const completeResult = await completeClipUpload(clipId);

      if (completeResult.status !== 'processing') {
        setState((prev) => ({
          ...prev,
          step: 'done',
          result: completeResult,
          moderationStatus: completeResult.status,
        }));
        queryClient.invalidateQueries({ queryKey: ['clips', 'mine'] });
        if (seriesIdRef.current) {
          queryClient.invalidateQueries({ queryKey: ['creator-series', seriesIdRef.current] });
        }
        return;
      }

      pollModeration(clipId, seriesIdRef.current);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Retry failed';
      setState((prev) => ({ ...prev, step: 'error', error: message }));
    }
  }, [state.clipId, uploadToR2, pollModeration, queryClient]);

  const cancel = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
    reset(); // reset() already calls cleanup()
  }, [reset]);

  return { state, start, retry, cancel, reset };
}
