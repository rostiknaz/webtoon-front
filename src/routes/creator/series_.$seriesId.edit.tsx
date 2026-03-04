/**
 * Edit Series Route — /creator/series/$seriesId/edit
 *
 * Form for editing an existing series with cover image upload.
 */

import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { sessionQueryKey, fetchSession } from '@/hooks/useOptimizedSession';
import { useCreatorSeriesDetail, useUpdateSeries, creatorSeriesDetailQueryOptions } from '@/hooks/useCreatorSeries';
import { SeriesForm, type SeriesFormValues } from '@/components/SeriesForm';

export const Route = createFileRoute('/creator/series_/$seriesId/edit')({
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
  component: EditSeriesPage,
});

function EditSeriesPage() {
  const { seriesId } = Route.useParams();
  const navigate = useNavigate();
  const { data } = useCreatorSeriesDetail(seriesId);
  const updateMutation = useUpdateSeries(seriesId);

  const handleSubmit = async (values: SeriesFormValues) => {
    await updateMutation.mutateAsync(values);
    navigate({ to: '/creator/series/$seriesId', params: { seriesId } });
  };

  if (!data) return null;

  return (
    <SeriesForm
      mode="edit"
      initialValues={{
        title: data.title,
        description: data.description || '',
        genre: data.genre || '',
        nsfwRating: data.nsfwRating as 'safe' | 'suggestive' | 'explicit',
        status: data.status as 'ongoing' | 'completed' | 'hiatus',
      }}
      seriesId={seriesId}
      coverUrl={data.coverUrl}
      onSubmit={handleSubmit}
      isSubmitting={updateMutation.isPending}
      error={updateMutation.error?.message}
    />
  );
}
