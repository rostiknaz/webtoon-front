/**
 * ClipCard Component
 *
 * Grid card for the browse view. Displays clip thumbnail with metadata.
 * Uses brand gradient fallback when thumbnailUrl is null.
 */

import { memo } from 'react';
import { Link } from '@tanstack/react-router';
import { Eye, Film } from 'lucide-react';
import { motion } from 'framer-motion';
import { DownloadButton } from './DownloadButton';
import { useOptimizedSession } from '@/hooks/useOptimizedSession';
import type { FeedClip } from '../types';

const GRADIENT_COUNT = 5;

/** Stable hash → gradient index from clip ID. Same clip always gets same color. */
const getGradientIndex = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % GRADIENT_COUNT;
};

/** Format count to compact notation (1234 → 1.2K) */
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Format seconds to display string (125 → "2:05") */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

interface ClipCardProps {
  clip: FeedClip;
  showNsfwIndicator?: boolean;
}

export const ClipCard = memo(function ClipCard({ clip, showNsfwIndicator }: ClipCardProps) {
  const gradientIdx = getGradientIndex(clip._id);
  const { data: session } = useOptimizedSession();
  const isAuthenticated = !!session;

  return (
    <motion.div
      layout
      variants={cardVariants}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
      style={{ borderRadius: '0.5rem' }}
    >
      <Link
        to="/"
        className="group block"
      >
        {/* Thumbnail */}
        <div className="relative aspect-video rounded-lg overflow-hidden">
          {clip.thumbnailUrl ? (
            <img
              src={clip.thumbnailUrl}
              alt={clip.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className={`w-full h-full brand-gradient-${gradientIdx} flex items-center justify-center transition-transform duration-300 group-hover:scale-[1.02]`}>
              <Film className="w-8 h-8 text-white/30" strokeWidth={1.5} />
            </div>
          )}

          {/* Bottom gradient overlay */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

          {/* Episode badge — top-left */}
          {clip.seriesId && clip.episodeNumber != null && (
            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-[10px] font-medium text-white/80">
              Ep {clip.episodeNumber}{clip.seriesTotalEpisodes ? `/${clip.seriesTotalEpisodes}` : ''}
            </div>
          )}

          {/* NSFW indicator — top-right */}
          {showNsfwIndicator && clip.nsfwRating !== 'safe' && (
            <div className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded bg-red-600/80 backdrop-blur-sm text-[10px] font-bold text-white tracking-wider">
              18+
            </div>
          )}

          {/* Duration badge — bottom-right */}
          {clip.duration != null && (
            <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-[10px] font-medium text-white/80">
              {formatDuration(clip.duration)}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="mt-1.5 px-0.5">
          <h3 className="text-[13px] font-medium text-white/85 truncate leading-tight">
            {clip.title}
          </h3>
          <p className="text-[11px] text-white/40 truncate mt-0.5">
            @{clip.creatorName}
          </p>
          <div className="flex items-center justify-between mt-1">
            <span className="flex items-center gap-0.5 text-[11px] text-white/30">
              <Eye className="w-3 h-3" strokeWidth={1.5} />
              {formatCount(clip.views)}
            </span>
            {isAuthenticated && (
              <DownloadButton clipId={clip._id} className="!p-1.5 !w-[26px] !h-[26px] !rounded-full" />
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
});
