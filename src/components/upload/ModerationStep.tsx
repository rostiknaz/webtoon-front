/**
 * Moderation Step (Step 3)
 *
 * Pulsing gradient scan animation over video thumbnail while
 * AI moderation processes the clip. Shows "AI is reviewing..." text.
 */

import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Shield } from 'lucide-react';

interface ModerationStepProps {
  thumbnailUrl?: string | null;
}

export const ModerationStep = memo(function ModerationStep({ thumbnailUrl }: ModerationStepProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;

  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4">
      {/* Thumbnail with scanning overlay */}
      <div className="relative w-40 h-56 rounded-xl overflow-hidden bg-muted">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="Video preview" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/10" />
        )}

        {/* Scanning gradient overlay */}
        {!shouldReduceMotion ? (
          <motion.div
            className="absolute inset-0 bg-gradient-to-b from-primary/30 via-transparent to-primary/30"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : (
          <div className="absolute inset-0 bg-primary/20" />
        )}

        {/* Scan line */}
        {!shouldReduceMotion && (
          <motion.div
            className="absolute left-0 right-0 h-0.5 bg-primary/80 shadow-[0_0_8px_rgba(var(--primary),0.5)]"
            animate={{ top: ['0%', '100%', '0%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </div>

      {/* Status text */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <motion.div
            animate={shouldReduceMotion ? {} : { rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Shield className="w-5 h-5 text-primary" />
          </motion.div>
          <h3 className="text-lg font-semibold">AI is reviewing your content</h3>
        </div>
        <p className="text-[13px] text-muted-foreground max-w-xs">
          Our AI scans for content safety. This usually takes just a few seconds.
        </p>
      </div>

      {/* Processing dots */}
      {!shouldReduceMotion && (
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-primary"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      )}
    </div>
  );
});
