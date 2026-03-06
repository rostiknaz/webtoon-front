/**
 * Result Step (Step 4)
 *
 * Shows final moderation result with animated state transitions:
 * - Published: green checkmark with spring scale-up
 * - Rejected: red X with shake keyframes
 * - In Review: amber clock with gentle pulse
 */

import { memo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, X, Clock, ChevronDown } from 'lucide-react';
import { MotionButton, buttonAnimations } from '@/components/ui/motion-button';

interface ResultStepProps {
  status: 'published' | 'rejected' | 'review';
  reason?: string | null;
  onUploadAnother: () => void;
  onClose: () => void;
}

const SPRING = { type: 'spring' as const, stiffness: 200, damping: 15 };

export const ResultStep = memo(function ResultStep({
  status,
  reason,
  onUploadAnother,
  onClose,
}: ResultStepProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const [reasonExpanded, setReasonExpanded] = useState(false);

  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4">
      {/* Icon */}
      {status === 'published' && (
        <motion.div
          className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center"
          initial={shouldReduceMotion ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={shouldReduceMotion ? { duration: 0 } : SPRING}
        >
          <Check className="w-10 h-10 text-emerald-400" strokeWidth={3} />
        </motion.div>
      )}

      {status === 'rejected' && (
        <motion.div
          className="w-20 h-20 rounded-full bg-red-500/15 border-2 border-red-500/30 flex items-center justify-center"
          initial={shouldReduceMotion ? false : { scale: 0 }}
          animate={shouldReduceMotion ? { scale: 1 } : { scale: 1, x: [0, -8, 8, -8, 8, 0] }}
          transition={shouldReduceMotion ? { duration: 0 } : { scale: SPRING, x: { delay: 0.3, duration: 0.5 } }}
        >
          <X className="w-10 h-10 text-red-400" strokeWidth={3} />
        </motion.div>
      )}

      {status === 'review' && (
        <motion.div
          className="w-20 h-20 rounded-full bg-amber-500/15 border-2 border-amber-500/30 flex items-center justify-center"
          initial={shouldReduceMotion ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={shouldReduceMotion ? { duration: 0 } : SPRING}
        >
          <Clock className="w-10 h-10 text-amber-400" />
        </motion.div>
      )}

      {/* Title + message */}
      <motion.div
        className="text-center"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.2 }}
      >
        {status === 'published' && (
          <>
            <h3 className="text-lg font-semibold text-emerald-400 mb-1">Your clip is live!</h3>
            <p className="text-[13px] text-muted-foreground">It's now visible in the feed for everyone.</p>
          </>
        )}
        {status === 'rejected' && (
          <>
            <h3 className="text-lg font-semibold text-red-400 mb-1">Clip rejected</h3>
            <p className="text-[13px] text-muted-foreground">Your content didn't pass the safety review.</p>
          </>
        )}
        {status === 'review' && (
          <>
            <h3 className="text-lg font-semibold text-amber-400 mb-1">Under manual review</h3>
            <p className="text-[13px] text-muted-foreground">
              Our team will review your clip shortly. You'll see the status update on your uploads page.
            </p>
          </>
        )}
      </motion.div>

      {/* Rejection/review reason */}
      {reason && (status === 'rejected' || status === 'review') && (
        <motion.div
          className="w-full max-w-sm"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <button
            type="button"
            onClick={() => setReasonExpanded((p) => !p)}
            className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${reasonExpanded ? 'rotate-180' : ''}`} />
            {status === 'rejected' ? 'Rejection reason' : 'Review reason'}
          </button>
          {reasonExpanded && (
            <p className="mt-2 text-[12px] text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              {reason}
            </p>
          )}
        </motion.div>
      )}

      {/* Actions */}
      <motion.div
        className="flex gap-3 pt-2"
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <MotionButton
          variant="outline"
          onClick={onClose}
          {...buttonAnimations.press}
        >
          Close
        </MotionButton>
        <MotionButton
          onClick={onUploadAnother}
          {...buttonAnimations.press}
        >
          Upload Another
        </MotionButton>
      </motion.div>
    </div>
  );
});
