/**
 * Creator Upload Route — /creator/upload
 *
 * Full-page upload form with 4-step pipeline:
 * Details -> Upload -> Moderation -> Done
 *
 * Accepts optional search params for series episode mode:
 *   ?seriesId=xxx&episodeNumber=1
 */

import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useState, useCallback, useMemo, useRef } from 'react';
import { z } from 'zod';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowLeft, X } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { sessionQueryKey, fetchSession } from '@/hooks/useOptimizedSession';
import { useClipUpload, type UploadStep } from '@/hooks/useClipUpload';
import { UploadPipeline } from '@/components/upload/UploadPipeline';
import { UploadMetadataStep } from '@/components/upload/UploadMetadataStep';
import { UploadProgressStep } from '@/components/upload/UploadProgressStep';
import { ModerationStep } from '@/components/upload/ModerationStep';
import { ResultStep } from '@/components/upload/ResultStep';
import type { UploadInitInput } from '@/types';

const uploadSearchSchema = z.object({
  seriesId: z.string().optional().catch(undefined),
  episodeNumber: z.coerce.number().optional().catch(undefined),
});

export const Route = createFileRoute('/creator/upload')({
  validateSearch: uploadSearchSchema,
  loader: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData({
      queryKey: sessionQueryKey,
      queryFn: fetchSession,
      staleTime: 5 * 60 * 1000,
    });

    if (!session || session.user?.role === 'consumer') {
      throw redirect({ to: '/' });
    }

    return { session };
  },
  component: UploadPage,
});

const STEP_MAP: Record<UploadStep, number> = {
  idle: 0,
  validating: 0,
  uploading: 1,
  completing: 1,
  moderating: 2,
  done: 3,
  error: -1,
};

const stepTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
};

function UploadPage() {
  const navigate = useNavigate();
  const { seriesId, episodeNumber } = Route.useSearch();
  const shouldReduceMotion = useReducedMotion() ?? false;
  const { state, start, retry, cancel, reset } = useClipUpload();
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const pipelineStep = state.step === 'error'
    ? STEP_MAP[state.clipId ? 'uploading' : 'idle']
    : STEP_MAP[state.step];

  const isInProgress = state.step === 'uploading' || state.step === 'completing' || state.step === 'moderating' || state.step === 'validating';

  const backTo = seriesId
    ? '/creator/series/$seriesId'
    : '/creator/uploads';
  const backParams = seriesId ? { seriesId } : undefined;

  const handleBack = useCallback(() => {
    if (isInProgress) {
      setConfirmLeave(true);
      return;
    }
    reset();
    navigate({ to: backTo, params: backParams as any });
  }, [isInProgress, reset, navigate, backTo, backParams]);

  const handleConfirmLeave = useCallback(() => {
    cancel();
    setConfirmLeave(false);
    navigate({ to: backTo, params: backParams as any });
  }, [cancel, navigate, backTo, backParams]);

  const handleSubmit = useCallback((input: UploadInitInput, file: File, thumb: string | null) => {
    fileRef.current = file;
    setThumbnailUrl(thumb);
    start(input, file);
  }, [start]);

  const handleRetry = useCallback(() => {
    if (fileRef.current) retry(fileRef.current);
  }, [retry]);

  const handleUploadAnother = useCallback(() => {
    reset();
    setThumbnailUrl(null);
    fileRef.current = null;
  }, [reset]);

  const handleClose = useCallback(() => {
    reset();
    navigate({ to: backTo, params: backParams as any });
  }, [reset, navigate, backTo, backParams]);

  const stepContent = useMemo(() => {
    if (state.step === 'idle' || state.step === 'validating') {
      return (
        <motion.div
          key="metadata"
          initial={shouldReduceMotion ? false : { opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -30 }}
          transition={shouldReduceMotion ? { duration: 0 } : stepTransition}
        >
          <UploadMetadataStep
            seriesId={seriesId}
            episodeNumber={episodeNumber}
            onSubmit={handleSubmit}
          />
        </motion.div>
      );
    }

    if (state.step === 'uploading' || state.step === 'completing') {
      return (
        <motion.div
          key="progress"
          initial={shouldReduceMotion ? false : { opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -30 }}
          transition={shouldReduceMotion ? { duration: 0 } : stepTransition}
        >
          <UploadProgressStep
            progress={state.progress}
            bytesTransferred={state.bytesTransferred}
            totalBytes={state.totalBytes}
            onCancel={cancel}
          />
        </motion.div>
      );
    }

    if (state.step === 'moderating') {
      return (
        <motion.div
          key="moderation"
          initial={shouldReduceMotion ? false : { opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -30 }}
          transition={shouldReduceMotion ? { duration: 0 } : stepTransition}
        >
          <ModerationStep thumbnailUrl={thumbnailUrl} />
        </motion.div>
      );
    }

    if (state.step === 'done' && state.result) {
      return (
        <motion.div
          key="result"
          initial={shouldReduceMotion ? false : { opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -30 }}
          transition={shouldReduceMotion ? { duration: 0 } : stepTransition}
        >
          <ResultStep
            status={state.result.status}
            reason={state.result.reason}
            onUploadAnother={handleUploadAnother}
            onClose={handleClose}
          />
        </motion.div>
      );
    }

    if (state.step === 'error') {
      return (
        <motion.div
          key="error"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col items-center gap-4 py-8 px-4"
        >
          <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-1">Upload failed</h3>
            <p className="text-[13px] text-muted-foreground">{state.error}</p>
          </div>
          <div className="flex gap-3">
            {state.clipId && (
              <button
                type="button"
                onClick={handleRetry}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium"
              >
                Retry Upload
              </button>
            )}
            <button
              type="button"
              onClick={handleUploadAnother}
              className="px-4 py-2 rounded-lg border border-border text-[13px] font-medium"
            >
              Start Over
            </button>
          </div>
        </motion.div>
      );
    }

    return null;
  }, [state, shouldReduceMotion, seriesId, episodeNumber, handleSubmit, cancel, thumbnailUrl, handleUploadAnother, handleRetry, handleClose]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {isInProgress ? (
            <button
              type="button"
              onClick={handleBack}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors text-muted-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <Link to={backTo} params={backParams as any}>
              <button type="button" className="p-2 rounded-lg hover:bg-white/5 transition-colors text-muted-foreground">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
          )}
          <h1 className="text-lg font-semibold">
            {seriesId ? `Add Episode${episodeNumber ? ` ${episodeNumber}` : ''}` : 'Upload Clip'}
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Pipeline indicator */}
        {pipelineStep >= 0 && <UploadPipeline currentStep={pipelineStep} />}

        {/* Step content */}
        <AnimatePresence mode="wait">
          {stepContent}
        </AnimatePresence>
      </div>

      {/* Confirm leave dialog */}
      <AnimatePresence>
        {confirmLeave && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmLeave(false)} />
            <motion.div
              className="relative bg-background border border-border rounded-xl p-6 max-w-sm mx-4 shadow-2xl"
              initial={shouldReduceMotion ? false : { scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
            >
              <h3 className="text-[15px] font-semibold mb-2">Cancel upload?</h3>
              <p className="text-[13px] text-muted-foreground mb-4">
                Your upload is still in progress. Are you sure you want to cancel?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmLeave(false)}
                  className="px-4 py-2 rounded-lg border border-border text-[13px] font-medium"
                >
                  Keep uploading
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLeave}
                  className="px-4 py-2 rounded-lg bg-red-500 text-white text-[13px] font-medium"
                >
                  Cancel upload
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
