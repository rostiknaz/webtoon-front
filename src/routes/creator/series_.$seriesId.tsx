/**
 * Series Detail Route — /creator/series/$seriesId
 *
 * Shows series metadata, cover image, and episode list with statuses.
 * Provides edit and delete actions.
 */

import { createFileRoute, redirect, Link, useNavigate } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { sessionQueryKey, fetchSession } from '@/hooks/useOptimizedSession';
import { useCreatorSeriesDetail, useDeleteSeries, creatorSeriesDetailQueryOptions } from '@/hooks/useCreatorSeries';
import { UploadStatusBadge } from '@/components/UploadStatusBadge';
import { ArrowLeft, Pencil, Trash2, BookOpen, Film, Eye, Plus } from 'lucide-react';
import type { SeriesEpisodeItem } from '@/types';
import { MotionButton, buttonAnimations } from '@/components/ui/motion-button';

export const Route = createFileRoute('/creator/series_/$seriesId')({
  loader: async ({ context, params }) => {
    const session = await context.queryClient.ensureQueryData({
      queryKey: sessionQueryKey,
      queryFn: fetchSession,
      staleTime: 5 * 60 * 1000,
    });

    if (!session || session.user?.role === 'consumer') {
      throw redirect({ to: '/' });
    }

    await context.queryClient.ensureQueryData(creatorSeriesDetailQueryOptions(params.seriesId));
    return { session };
  },
  component: SeriesDetailPage,
});

// ==================== Status Styles ====================

const STATUS_STYLES: Record<string, string> = {
  ongoing: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  hiatus: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
};

// ==================== Page ====================

function SeriesDetailPage() {
  const { seriesId } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useCreatorSeriesDetail(seriesId);
  const deleteMutation = useDeleteSeries();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = useCallback(async () => {
    await deleteMutation.mutateAsync(seriesId);
    navigate({ to: '/creator/series' });
  }, [deleteMutation, seriesId, navigate]);

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse">
          <div className="h-6 bg-muted rounded w-1/3 mb-4" />
          <div className="aspect-video bg-muted rounded-xl mb-4" />
          <div className="h-4 bg-muted rounded w-2/3 mb-2" />
          <div className="h-4 bg-muted rounded w-1/2" />
        </div>
      </div>
    );
  }

  const series = data;
  const gradientIdx = Math.abs(seriesId.charCodeAt(0)) % 5;
  const statusStyle = STATUS_STYLES[series.status] || STATUS_STYLES.ongoing;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/creator/series">
              <button type="button" className="p-2 rounded-lg hover:bg-white/5 transition-colors text-muted-foreground">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <h1 className="text-lg font-semibold truncate">{series.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/creator/series/$seriesId/edit" params={{ seriesId }}>
              <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[13px] font-medium hover:bg-white/5 transition-colors">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            </Link>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 text-[13px] font-medium hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Series Header */}
        <div className="flex gap-4 mb-6">
          {/* Cover */}
          <div className="w-40 aspect-video rounded-xl overflow-hidden bg-muted border border-border shrink-0 relative">
            {series.coverUrl ? (
              <img src={series.coverUrl} alt={series.title} className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full flex items-center justify-center brand-gradient-${gradientIdx}`}>
                <BookOpen className="w-8 h-8 text-white/20" />
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="flex-1 min-w-0">
            <h2 className="text-[16px] font-semibold mb-1">{series.title}</h2>
            {series.description && (
              <p className="text-[13px] text-muted-foreground mb-2 line-clamp-2">{series.description}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${statusStyle}`}>
                {series.status}
              </span>
              {series.nsfwRating !== 'safe' && (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border bg-red-500/15 text-red-400 border-red-500/20">
                  {series.nsfwRating}
                </span>
              )}
              {series.genre && (
                <span className="text-[12px] text-muted-foreground">{series.genre}</span>
              )}
              <span className="text-[12px] text-muted-foreground">
                {series.totalEpisodes} episode{series.totalEpisodes !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Episode List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-semibold">Episodes</h3>
            <MotionButton
              size="sm"
              onClick={() => navigate({
                to: '/creator/upload',
                search: {
                  seriesId,
                  episodeNumber: Math.max(...series.episodes.map((e) => e.episodeNumber ?? 0), 0) + 1,
                },
              })}
              {...buttonAnimations.press}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Episode
            </MotionButton>
          </div>
          {series.episodes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Film className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-[13px]">No episodes yet. Upload a clip with this series to add episodes.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {series.episodes.map((ep) => (
                <EpisodeRow key={ep._id} episode={ep} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm mx-4">
            <h3 className="text-[16px] font-semibold mb-2">Delete Series?</h3>
            <p className="text-[13px] text-muted-foreground mb-4">
              This will permanently delete "{series.title}". Episodes will become standalone clips. This action cannot be undone.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg border border-border text-[13px] font-medium hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-[13px] font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Episode Row ====================

function EpisodeRow({ episode }: { episode: SeriesEpisodeItem }) {
  const gradientIdx = Math.abs(episode._id.charCodeAt(0)) % 5;

  return (
    <div className="flex items-center gap-3 rounded-lg bg-card border border-border p-3">
      {/* Thumbnail */}
      <div className="w-16 h-10 rounded-md overflow-hidden bg-muted shrink-0 relative">
        {episode.thumbnailUrl ? (
          <img src={episode.thumbnailUrl} alt={episode.title} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full flex items-center justify-center brand-gradient-${gradientIdx}`}>
            <Film className="w-4 h-4 text-white/20" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {episode.episodeNumber != null && (
            <span className="text-[11px] text-muted-foreground font-medium">Ep. {episode.episodeNumber}</span>
          )}
          <span className="text-[13px] font-medium truncate">{episode.title}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {episode.duration && <span>{episode.duration}s</span>}
          <span className="flex items-center gap-0.5">
            <Eye className="w-3 h-3" /> {episode.views}
          </span>
        </div>
      </div>

      {/* Status */}
      <UploadStatusBadge status={episode.status as 'processing' | 'published' | 'rejected' | 'review'} />
    </div>
  );
}
