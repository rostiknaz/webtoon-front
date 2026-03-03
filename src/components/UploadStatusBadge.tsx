/**
 * UploadStatusBadge Component
 *
 * Multi-state pill badge showing clip processing status.
 * Uses AnimatePresence for smooth icon/color transitions.
 * Accessible: role="status" + aria-live="polite".
 */

import { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Check, X, Clock } from 'lucide-react';

type ClipStatus = 'processing' | 'published' | 'rejected' | 'review';

interface UploadStatusBadgeProps {
  status: ClipStatus;
}

const statusConfig: Record<ClipStatus, {
  label: string;
  icon: typeof Check;
  colorClass: string;
  spinning?: boolean;
}> = {
  processing: {
    label: 'Processing',
    icon: Loader2,
    colorClass: 'bg-muted text-muted-foreground',
    spinning: true,
  },
  published: {
    label: 'Live',
    icon: Check,
    colorClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  },
  rejected: {
    label: 'Rejected',
    icon: X,
    colorClass: 'bg-destructive/15 text-red-400 border border-destructive/20',
  },
  review: {
    label: 'In Review',
    icon: Clock,
    colorClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  },
};

export const UploadStatusBadge = memo(function UploadStatusBadge({
  status,
}: UploadStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div role="status" aria-live="polite" aria-label={`Status: ${config.label}`}>
      <AnimatePresence mode="wait">
        <motion.span
          key={status}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${config.colorClass}`}
        >
          <Icon
            className={`w-3 h-3 ${config.spinning ? 'animate-spin' : ''}`}
            strokeWidth={2}
          />
          {config.label}
        </motion.span>
      </AnimatePresence>
    </div>
  );
});
