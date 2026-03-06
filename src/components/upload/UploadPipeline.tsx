/**
 * Upload Pipeline Step Indicator
 *
 * 4-step horizontal indicator: Details -> Upload -> Moderation -> Done
 * Uses layout animations for smooth step transitions and
 * AnimatePresence for number-to-checkmark swaps.
 */

import { memo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';

const STEPS = ['Details', 'Upload', 'Moderation', 'Done'] as const;

interface UploadPipelineProps {
  currentStep: number; // 0-3
}

const SPRING = { type: 'spring' as const, stiffness: 300, damping: 30 };

export const UploadPipeline = memo(function UploadPipeline({ currentStep }: UploadPipelineProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const transition = shouldReduceMotion ? { duration: 0 } : SPRING;

  return (
    <div className="flex items-center justify-between px-2 py-4" role="navigation" aria-label="Upload progress">
      {STEPS.map((label, i) => {
        const isCompleted = i < currentStep;
        const isActive = i === currentStep;

        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            {/* Step circle */}
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                layout={!shouldReduceMotion}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold border-2 transition-colors ${
                  isCompleted
                    ? 'bg-primary border-primary text-primary-foreground'
                    : isActive
                      ? 'border-primary text-primary bg-primary/10'
                      : 'border-border text-muted-foreground bg-muted/50'
                }`}
                animate={isActive && !shouldReduceMotion ? { scale: [1, 1.1, 1] } : {}}
                transition={isActive ? { repeat: Infinity, repeatDelay: 2, duration: 0.6 } : undefined}
              >
                <AnimatePresence mode="wait">
                  {isCompleted ? (
                    <motion.div
                      key="check"
                      initial={shouldReduceMotion ? false : { scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={transition}
                    >
                      <Check className="w-4 h-4" strokeWidth={3} />
                    </motion.div>
                  ) : (
                    <motion.span
                      key="number"
                      initial={shouldReduceMotion ? false : { scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={transition}
                    >
                      {i + 1}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
              <span className={`text-[10px] font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                {label}
              </span>
            </div>

            {/* Connecting line */}
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 bg-border rounded-full overflow-hidden relative">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-primary rounded-full"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: isCompleted ? 1 : 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 200, damping: 25 }}
                  style={{ transformOrigin: 'left', width: '100%' }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
