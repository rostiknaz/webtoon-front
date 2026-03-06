/**
 * Creator Uploads Route — /creator/uploads
 *
 * Shows creator's clips with status badges, moderation reasons,
 * and smart polling for processing clips.
 * Redirects non-creators to home.
 */

import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { sessionQueryKey, fetchSession } from '@/hooks/useOptimizedSession';
import { useCreatorClips, creatorClipsQueryOptions } from '@/hooks/useCreatorClips';
import { UploadStatusBadge } from '@/components/UploadStatusBadge';
import { ArrowLeft, Film, Eye, Download, ChevronDown, Plus } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import type { CreatorClip } from '@/types';
import { MotionButton, buttonAnimations } from '@/components/ui/motion-button';
import { formatCompact } from '@/lib/format';

export const Route = createFileRoute('/creator/uploads')({
  loader: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData({
      queryKey: sessionQueryKey,
      queryFn: fetchSession,
      staleTime: 5 * 60 * 1000,
    });

    if (!session || session.user?.role === 'consumer') {
      throw redirect({ to: '/' });
    }

    await context.queryClient.ensureQueryData(creatorClipsQueryOptions());
    return { session };
  },
  component: CreatorUploadsPage,
});

function CreatorUploadsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useCreatorClips();
  const clips = data?.clips ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <button type="button" className="p-2 rounded-lg hover:bg-white/5 transition-colors text-muted-foreground">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold">My Uploads</h1>
              <p className="text-[13px] text-muted-foreground">{clips.length} clips</p>
            </div>
          </div>

          <MotionButton
            size="sm"
            onClick={() => navigate({ to: '/creator/upload' })}
            {...buttonAnimations.press}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Upload Clip
          </MotionButton>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {isLoading ? (
          <LoadingSkeleton />
        ) : clips.length === 0 ? (
          <EmptyState onUpload={() => navigate({ to: '/creator/upload' })} />
        ) : (
          <div className="flex flex-col gap-3">
            {clips.map((clip) => (
              <ClipCard key={clip._id} clip={clip} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClipCard({ clip }: { clip: CreatorClip }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const hasReason = clip.moderationReason && (clip.status === 'rejected' || clip.status === 'review');
  const isViewable = clip.status === 'published' || clip.status === 'review';

  const toggleExpanded = useCallback(() => setExpanded((prev) => !prev), []);

  const handleCardClick = useCallback(() => {
    if (isViewable) {
      navigate({ to: '/clip/$clipId', params: { clipId: clip._id } });
    }
  }, [isViewable, navigate, clip._id]);

  return (
    <div
      className={`rounded-xl bg-card border border-border p-4 ${isViewable ? 'cursor-pointer hover:bg-card/80 transition-colors' : ''}`}
      onClick={handleCardClick}
      role={isViewable ? 'button' : undefined}
      tabIndex={isViewable ? 0 : undefined}
      onKeyDown={isViewable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(); } } : undefined}
    >
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="w-20 h-28 rounded-lg overflow-hidden bg-muted shrink-0 relative">
          {clip.thumbnailUrl ? (
            <img src={clip.thumbnailUrl} alt={clip.title} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center brand-gradient-${Math.abs(clip._id.charCodeAt(0)) % 5}`}>
              <Film className="w-6 h-6 text-white/30" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="text-[14px] font-medium truncate">{clip.title}</h3>
            <UploadStatusBadge status={clip.status} />
          </div>

          <div className="flex items-center gap-3 text-[12px] text-muted-foreground mb-2">
            {clip.duration && <span>{clip.duration}s</span>}
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" /> {formatCompact(clip.views)}
            </span>
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3" /> {formatCompact(clip.downloadCount)}
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {new Date(clip.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {clip.publishedAt && ` · Published ${new Date(clip.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
          </p>
        </div>
      </div>

      {/* Expandable moderation reason */}
      {hasReason && (
        <div className="mt-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={toggleExpanded}
            className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors w-full text-left"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            {clip.status === 'rejected' ? 'Rejection reason' : 'Review reason'}
          </button>
          {expanded && (
            <p className="mt-2 text-[12px] text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              {clip.moderationReason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Film className="w-12 h-12 text-muted-foreground/30 mb-4" />
      <h3 className="text-lg font-medium mb-1">No uploads yet</h3>
      <p className="text-[13px] text-muted-foreground mb-6">Upload your first clip to get started.</p>
      <MotionButton onClick={onUpload} {...buttonAnimations.press}>
        <Plus className="w-4 h-4 mr-1.5" />
        Upload Clip
      </MotionButton>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl bg-card border border-border p-4 animate-pulse">
          <div className="flex gap-4">
            <div className="w-20 h-28 rounded-lg bg-muted" />
            <div className="flex-1">
              <div className="h-4 bg-muted rounded w-3/4 mb-3" />
              <div className="h-3 bg-muted rounded w-1/2 mb-2" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
