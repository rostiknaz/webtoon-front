/**
 * Create Series Route — /creator/series/new
 *
 * Form for creating a new series with cover image upload.
 */

import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { sessionQueryKey, fetchSession } from '@/hooks/useOptimizedSession';
import { useCreateSeries } from '@/hooks/useCreatorSeries';
import { SeriesForm, type SeriesFormValues } from '@/components/SeriesForm';

export const Route = createFileRoute('/creator/series_/new')({
  loader: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData({
      queryKey: sessionQueryKey,
      queryFn: fetchSession,
      staleTime: 5 * 60 * 1000,
    });

    if (!session || session.user?.role === 'consumer') {
      throw redirect({ to: '/' });
    }

    return { session };
  },
  component: CreateSeriesPage,
});

function CreateSeriesPage() {
  const navigate = useNavigate();
  const createMutation = useCreateSeries();

  const handleSubmit = async (values: SeriesFormValues) => {
    await createMutation.mutateAsync(values);
    navigate({ to: '/creator/series' });
  };

  return (
    <SeriesForm
      mode="create"
      onSubmit={handleSubmit}
      isSubmitting={createMutation.isPending}
      error={createMutation.error?.message}
    />
  );
}
