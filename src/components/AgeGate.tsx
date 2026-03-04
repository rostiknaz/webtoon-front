/**
 * AgeGate Component
 *
 * Full-screen age verification overlay. Blocks all content until user confirms 18+.
 * Uses alertdialog role with focus trap — no backdrop dismiss, no escape dismiss.
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useAgeGate } from '@/hooks/useAgeGate';

export function AgeGate() {
  const { isConfirmed, isPending, confirm, deny } = useAgeGate();
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus trap: focus confirm button when modal opens
  useEffect(() => {
    if (isPending && confirmRef.current) {
      confirmRef.current.focus();
    }
  }, [isPending]);

  // Trap keyboard focus within the dialog
  useEffect(() => {
    if (!isPending) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block escape key
      if (e.key === 'Escape') {
        e.preventDefault();
        return;
      }

      // Trap Tab within dialog buttons
      if (e.key === 'Tab') {
        const dialog = document.getElementById('age-gate-dialog');
        if (!dialog) return;

        const focusable = dialog.querySelectorAll<HTMLElement>('button');
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPending]);

  if (isConfirmed) return null;

  return (
    <AnimatePresence>
      {isPending && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[hsl(240_10%_4%)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            id="age-gate-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="age-gate-title"
            aria-describedby="age-gate-desc"
            className="flex flex-col items-center text-center px-6 max-w-[340px]"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {/* Icon */}
            <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center mb-6">
              <AlertTriangle className="w-7 h-7 text-white/60" strokeWidth={1.5} />
            </div>

            {/* Title */}
            <h1
              id="age-gate-title"
              className="text-[20px] font-semibold text-white/90 tracking-[-0.02em] font-display mb-3"
            >
              Age Verification Required
            </h1>

            {/* Description */}
            <p
              id="age-gate-desc"
              className="text-[13px] text-white/50 leading-relaxed mb-8"
            >
              This platform contains mature content intended for adults only.
              You must be at least 18 years old to access this site.
            </p>

            {/* Buttons */}
            <div className="flex flex-col gap-3 w-full">
              <button
                ref={confirmRef}
                type="button"
                onClick={confirm}
                className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-[14px] font-semibold transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                I am 18 or older
              </button>
              <button
                type="button"
                onClick={deny}
                className="w-full py-3 rounded-lg bg-white/6 text-white/50 text-[14px] font-medium transition-colors hover:bg-white/10 hover:text-white/70 focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                I am under 18
              </button>
            </div>

            {/* Fine print */}
            <p className="text-[11px] text-white/20 mt-6 leading-relaxed">
              Your choice is stored locally on this device.
              No account is required for age verification.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
