/**
 * Get Series Statistics API Endpoint
 *
 * GET /api/series/[id]/stats
 *
 * Returns dynamic statistics that change frequently:
 * - Series total views and likes
 * - Per-episode views and likes
 *
 * Cache: Short (1-5 minutes) OR no cache for real-time data
 * Performance: Direct D1 query, ~20-50ms
 *
 * Future: Can be replaced with WebSockets for real-time updates
 */

import { createCacheLayer } from '../../../../lib/cache';
import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
}

interface SeriesStatsResponse {
  totalViews: number;
  totalLikes: number;
  episodes: EpisodeStats[];
}

interface EpisodeStats {
  _id: string;
  episodeNumber: number;
  views: number;
  likes: number;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const seriesId = params.id as string;

  try {
    const cache = createCacheLayer(env.CACHE);

    // Cache key for stats (short TTL)
    const cacheKey = `series:${seriesId}:stats`;

    // Try cache first (1 minute TTL - can be disabled for real-time)
    const cachedData = await cache.raw.get<SeriesStatsResponse>(cacheKey);
    if (cachedData) {
      return new Response(JSON.stringify(cachedData), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30', // Client cache for 30 seconds
          'X-Cache': 'HIT',
        },
      });
    }

    // Cache miss - query D1 for stats
    const [seriesData, episodesData, likesData] = await Promise.all([
      // Get series total views
      env.DB.prepare(
        `SELECT total_views
         FROM series
         WHERE id = ?
         LIMIT 1`
      )
        .bind(seriesId)
        .first(),

      // Get episode-level views and likes
      env.DB.prepare(
        `SELECT id, episode_number, views, likes
         FROM episodes
         WHERE serial_id = ?
         ORDER BY episode_number ASC`
      )
        .bind(seriesId)
        .all(),

      // Get total likes for the series (count from user_likes table)
      env.DB.prepare(
        `SELECT COUNT(*) as total_likes
         FROM user_likes ul
         INNER JOIN episodes e ON ul.episode_id = e.id
         WHERE e.serial_id = ?`
      )
        .bind(seriesId)
        .first(),
    ]);

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

    // Format episode stats
    const episodes: EpisodeStats[] = (episodesData.results || []).map((ep: any) => ({
      _id: ep.id,
      episodeNumber: ep.episode_number,
      views: ep.views || 0,
      likes: ep.likes || 0,
    }));

    // Build response
    const response: SeriesStatsResponse = {
      totalViews: (seriesData.total_views as number) || 0,
      totalLikes: (likesData?.total_likes as number) || 0,
      episodes,
    };

    // Cache for 1 minute (short TTL for dynamic data)
    // Can be removed entirely for real-time stats
    await cache.raw.set(cacheKey, response, { ttl: 60 });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Series stats error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch series stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
