/**
 * CreditCounter Component
 *
 * Small pill badge showing free downloads / credit balance.
 * Uses TanStack Query for accuracy (catches admin changes)
 * with credit cookie as instant placeholder data.
 * Only visible when user is authenticated and has credits.
 */

import { memo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useOptimizedSession } from '@/hooks/useOptimizedSession';
import { useCredits } from '@/hooks/useCredits';
import { Download } from 'lucide-react';

const PILL_TRANSITION = { type: 'spring' as const, stiffness: 400, damping: 30 };

export const CreditCounter = memo(function CreditCounter() {
  const { data: session } = useOptimizedSession();
  const isAuthenticated = !!session;
  const shouldReduceMotion = useReducedMotion() ?? false;
  const { totalCredits } = useCredits();

  const showCounter = isAuthenticated && totalCredits > 0;

  return (
    <AnimatePresence>
      {showCounter && (
        shouldReduceMotion ? (
          <div
            key="credit-counter"
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/6 border border-white/6"
            data-testid="credit-counter"
          >
            <Download className="h-3 w-3 text-white/55" aria-hidden="true" />
            <span className="text-xs font-semibold text-white/55 tabular-nums">
              {totalCredits}
            </span>
          </div>
        ) : (
          <motion.div
            key="credit-counter"
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/6 border border-white/6"
            data-testid="credit-counter"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={PILL_TRANSITION}
          >
            <Download className="h-3 w-3 text-white/55" aria-hidden="true" />
            <span className="text-xs font-semibold text-white/55 tabular-nums">
              {totalCredits}
            </span>
          </motion.div>
        )
      )}
    </AnimatePresence>
  );
});
