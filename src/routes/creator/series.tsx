/**
 * Creator Series List Route — /creator/series
 *
 * Displays a grid of the creator's series with cover images,
 * episode counts, status badges, and a "Create Series" button.
 */

import { createFileRoute, redirect, Link } from '@tanstack/react-router';
import { sessionQueryKey, fetchSession } from '@/hooks/useOptimizedSession';
import { useCreatorSeriesList, creatorSeriesListQueryOptions } from '@/hooks/useCreatorSeries';
import { ArrowLeft, Plus, BookOpen } from 'lucide-react';
import type { CreatorSeriesItem } from '@/types';

export const Route = createFileRoute('/creator/series')({
  loader: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData({
      queryKey: sessionQueryKey,
      queryFn: fetchSession,
      staleTime: 5 * 60 * 1000,
    });

    if (!session || session.user?.role === 'consumer') {
      throw redirect({ to: '/' });
    }

    await context.queryClient.ensureQueryData(creatorSeriesListQueryOptions());
    return { session };
  },
  component: CreatorSeriesListPage,
});

// ==================== Status Badge ====================

const STATUS_STYLES: Record<string, string> = {
  ongoing: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  hiatus: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
};

function SeriesStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.ongoing;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${style}`}>
      {status}
    </span>
  );
}

function NsfwBadge() {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border bg-red-500/15 text-red-400 border-red-500/20">
      NSFW
    </span>
  );
}

// ==================== Series Card ====================

function SeriesCard({ series }: { series: CreatorSeriesItem }) {
  const gradientIdx = Math.abs(series._id.charCodeAt(0)) % 5;

  return (
    <Link
      to="/creator/series/$seriesId"
      params={{ seriesId: series._id }}
      className="block rounded-xl bg-card border border-border overflow-hidden hover:border-white/10 transition-colors"
    >
      {/* Cover */}
      <div className="aspect-video relative overflow-hidden bg-muted">
        {series.coverUrl ? (
          <img src={series.coverUrl} alt={series.title} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full flex items-center justify-center brand-gradient-${gradientIdx}`}>
            <BookOpen className="w-8 h-8 text-white/20" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-[14px] font-medium truncate mb-1">{series.title}</h3>
        <p className="text-[12px] text-muted-foreground mb-2">
          {series.genre ? `${series.genre} · ` : ''}{series.totalEpisodes} episode{series.totalEpisodes !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-1.5">
          <SeriesStatusBadge status={series.status} />
          {series.nsfwRating !== 'safe' && <NsfwBadge />}
        </div>
      </div>
    </Link>
  );
}

// ==================== Page ====================

function CreatorSeriesListPage() {
  const { data, isLoading } = useCreatorSeriesList();
  const seriesList = data?.series ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <button type="button" className="p-2 rounded-lg hover:bg-white/5 transition-colors text-muted-foreground">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold">My Series</h1>
              <p className="text-[13px] text-muted-foreground">{seriesList.length} series</p>
            </div>
          </div>

          <Link to="/creator/series/new">
            <button type="button" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" />
              Create Series
            </button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {isLoading ? (
          <LoadingSkeleton />
        ) : seriesList.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {seriesList.map((s) => (
              <SeriesCard key={s._id} series={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <BookOpen className="w-12 h-12 text-muted-foreground/30 mb-4" />
      <h3 className="text-lg font-medium mb-1">No series yet</h3>
      <p className="text-[13px] text-muted-foreground mb-6">Create your first series to start publishing episodes!</p>
      <Link to="/creator/series/new">
        <button type="button" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          Create Series
        </button>
      </Link>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl bg-card border border-border overflow-hidden animate-pulse">
          <div className="aspect-video bg-muted" />
          <div className="p-3">
            <div className="h-4 bg-muted rounded w-3/4 mb-2" />
            <div className="h-3 bg-muted rounded w-1/2 mb-2" />
            <div className="h-4 bg-muted rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
