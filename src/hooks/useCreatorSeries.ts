/**
 * Creator Series Hooks
 *
 * TanStack Query hooks for creator series CRUD.
 * No cache/polling — creator management needs instant freshness.
 */

import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import {
  getCreatorSeriesList,
  getCreatorSeriesDetail,
  createCreatorSeries,
  updateCreatorSeries,
  deleteCreatorSeries,
} from '../api';

export function creatorSeriesListQueryOptions() {
  return queryOptions({
    queryKey: ['creator-series', 'list'] as const,
    queryFn: getCreatorSeriesList,
    staleTime: 0,
  });
}

export function creatorSeriesDetailQueryOptions(seriesId: string) {
  return queryOptions({
    queryKey: ['creator-series', 'detail', seriesId] as const,
    queryFn: () => getCreatorSeriesDetail(seriesId),
    staleTime: 0,
  });
}

export function useCreatorSeriesList() {
  return useQuery(creatorSeriesListQueryOptions());
}

export function useCreatorSeriesDetail(seriesId: string) {
  return useQuery(creatorSeriesDetailQueryOptions(seriesId));
}

export function useCreateSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCreatorSeries,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-series', 'list'] });
    },
  });
}

export function useUpdateSeries(seriesId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof updateCreatorSeries>[1]) =>
      updateCreatorSeries(seriesId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-series'] });
    },
  });
}

export function useDeleteSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCreatorSeries,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-series', 'list'] });
    },
  });
}
