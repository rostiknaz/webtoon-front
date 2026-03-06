/**
 * Upload Progress Step (Step 2)
 *
 * Spring-physics progress bar with AnimateNumber percentage,
 * file size tracking, and cancel button.
 */

import { memo } from 'react';
import { motion, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { AnimateNumber } from '@/components/AnimateNumber';
import { formatBytes } from '@/lib/format';

interface UploadProgressStepProps {
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
  onCancel: () => void;
}

export const UploadProgressStep = memo(function UploadProgressStep({
  progress,
  bytesTransferred,
  totalBytes,
  onCancel,
}: UploadProgressStepProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const springProgress = useSpring(progress / 100, shouldReduceMotion ? { duration: 0 } : { stiffness: 100, damping: 30 });
  const widthPercent = useTransform(springProgress, (v) => `${Math.min(v * 100, 100)}%`);

  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-1">Uploading video</h3>
        <p className="text-[13px] text-muted-foreground">
          {formatBytes(bytesTransferred)} / {formatBytes(totalBytes)}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-sm">
        <div className="h-3 bg-muted rounded-full overflow-hidden relative">
          <motion.div
            className="absolute inset-y-0 left-0 bg-primary rounded-full"
            style={{ width: widthPercent }}
          />
          {/* Shimmer overlay */}
          {!shouldReduceMotion && (
            <div className="absolute inset-0 overflow-hidden rounded-full">
              <div className="upload-shimmer absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-2">
          <AnimateNumber value={progress} className="text-2xl font-bold tabular-nums" />
          <span className="text-2xl font-bold">%</span>
        </div>
      </div>

      {/* Cancel */}
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
        Cancel
      </button>

    </div>
  );
});
