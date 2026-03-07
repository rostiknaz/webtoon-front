/**
 * CreditCounter Component
 *
 * Small pill badge showing free downloads / credit balance.
 * Shows animated number transitions when credits change.
 * Visible when authenticated (even at 0 — pulses to nudge purchase).
 * Tappable at 0 credits to open PricingDrawer.
 */

import { memo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useOptimizedSession } from '@/hooks/useOptimizedSession';
import { useCredits } from '@/hooks/useCredits';
import { useSubscription } from '@/hooks/useSubscription';
import { AnimateNumber } from './AnimateNumber';
import { PricingDrawer } from './PricingDrawer';
import { Crown, Download } from 'lucide-react';

const PILL_TRANSITION = { type: 'spring' as const, stiffness: 400, damping: 30 };
const POINTER_STYLE = { cursor: 'pointer' } as const;

export const CreditCounter = memo(function CreditCounter() {
  const { data: session } = useOptimizedSession();
  const isAuthenticated = !!session;
  const shouldReduceMotion = useReducedMotion() ?? false;
  const { totalCredits } = useCredits();
  const { data: subscription } = useSubscription();
  const hasSubscription = subscription.hasSubscription;
  const [pricingOpen, setPricingOpen] = useState(false);

  const isZero = totalCredits === 0 && !hasSubscription;
  const pillClass = `flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/6 border border-white/6${isZero && !shouldReduceMotion ? ' animate-pulse' : ''}`;

  const handleClick = () => {
    if (isZero) setPricingOpen(true);
  };

  const badgeContent = hasSubscription ? (
    <>
      <Crown className="h-3 w-3 text-amber-400" aria-hidden="true" />
      <span className="text-xs font-semibold text-amber-400">Unlimited</span>
    </>
  ) : (
    <>
      <Download className="h-3 w-3 text-white/55" aria-hidden="true" />
      <AnimateNumber value={totalCredits} className="text-xs font-semibold text-white/55 tabular-nums" />
    </>
  );

  return (
    <>
      <AnimatePresence>
        {isAuthenticated && (
          shouldReduceMotion ? (
            <div
              key="credit-counter"
              className={pillClass}
              data-testid="credit-counter"
              onClick={handleClick}
              role={isZero ? 'button' : undefined}
              style={isZero ? POINTER_STYLE : undefined}
            >
              {badgeContent}
            </div>
          ) : (
            <motion.div
              key="credit-counter"
              className={pillClass}
              data-testid="credit-counter"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={PILL_TRANSITION}
              onClick={handleClick}
              role={isZero ? 'button' : undefined}
              style={isZero ? POINTER_STYLE : undefined}
            >
              {badgeContent}
            </motion.div>
          )
        )}
      </AnimatePresence>
      <PricingDrawer open={pricingOpen} onOpenChange={setPricingOpen} />
    </>
  );
});
