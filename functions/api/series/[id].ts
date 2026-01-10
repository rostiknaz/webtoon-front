/**
 * Get Series Core Metadata API Endpoint
 *
 * GET /api/series/[id]
 *
 * Returns static series metadata (long cache - 24 hours):
 * - Series details (title, description, year, status, etc.)
 * - All episodes (basic info: title, thumbnail, duration, releaseDate, videoId)
 *
 * Does NOT include:
 * - User-specific data (isLocked, hlsUrl, subscription) → use /api/series/:id/access
 * - Dynamic stats (views, likes) → use /api/series/:id/stats
 *
 * Performance: KV cached for 24 hours, <5ms on cache hit
 */

import { createCacheLayer } from '../../../lib/cache';
import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
}

interface SeriesCoreMetadata {
  _id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  coverImage?: string;
  year?: number;
  status?: 'ongoing' | 'completed';
  genres?: string[];
  cast?: string[];
  director?: string;
  episodes: CoreEpisode[];
}

interface CoreEpisode {
  _id: string;
  episodeNumber: number;
  title?: string;
  description?: string;
  thumbnail?: string;
  duration?: number;
  videoId?: string;
  releaseDate?: string;
  isPaid: boolean;
}


export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const seriesId = params.id as string;

  try {
    const cache = createCacheLayer(env.CACHE);

    // Simple cache key - no user-specific data
    const cacheKey = `series:${seriesId}:core`;

    // Try cache first (24 hour cache for static data)
    const cachedData = await cache.raw.get<SeriesCoreMetadata>(cacheKey);
    if (cachedData) {
      return new Response(JSON.stringify(cachedData), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600', // Client cache for 1 hour
          'X-Cache': 'HIT',
        },
      });
    }

    // Cache miss - query D1 (only series and episodes, no stats)
    const [seriesData, episodesData] = await Promise.all([
      // Get series metadata
      env.DB.prepare(
        `SELECT
           id, title, description, thumbnail_url,
           genre, author, status, created_at
         FROM series
         WHERE id = ?
         LIMIT 1`
      )
        .bind(seriesId)
        .first(),

      // Get all episodes (basic info only, no views/likes)
      env.DB.prepare(
        `SELECT
           id, episode_number, title, description,
           thumbnail_url, video_id, duration, is_paid,
           published_at
         FROM episodes
         WHERE serial_id = ?
         ORDER BY episode_number ASC`
      )
        .bind(seriesId)
        .all(),
    ]);

    // Check if series exists
    if (!seriesData) {
      return new Response(
        JSON.stringify({
          error: 'Series not found',
          message: `No series found with ID: ${seriesId}`,
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse genres (stored as comma-separated string)
    const genres = seriesData.genre ? (seriesData.genre as string).split(',').map((g) => g.trim()) : [];

    // Format episodes (no lock status or HLS URLs)
    const episodes: CoreEpisode[] = (episodesData.results || []).map((ep: any) => ({
      _id: ep.id,
      episodeNumber: ep.episode_number,
      title: ep.title,
      description: ep.description,
      thumbnail: ep.thumbnail_url,
      duration: ep.duration,
      videoId: ep.video_id,
      releaseDate: ep.published_at ? new Date(ep.published_at * 1000).toISOString().split('T')[0] : undefined,
      isPaid: !!ep.is_paid,
    }));

    // Build response (core metadata only)
    const response: SeriesCoreMetadata = {
      _id: seriesData.id as string,
      title: seriesData.title as string,
      description: seriesData.description as string | undefined,
      thumbnail: seriesData.thumbnail_url as string | undefined,
      coverImage: seriesData.thumbnail_url as string | undefined,
      year: seriesData.created_at ? new Date((seriesData.created_at as number) * 1000).getFullYear() : undefined,
      status: seriesData.status as 'ongoing' | 'completed' | undefined,
      genres,
      cast: undefined, // TODO: Add cast table
      director: seriesData.author as string | undefined,
      episodes,
    };

    // Cache for 24 hours (static data)
    await cache.raw.set(cacheKey, response, { ttl: 60 * 60 * 24 });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Series core metadata error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch series metadata',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
