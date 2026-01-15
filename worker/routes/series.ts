/**
 * Series API Routes
 *
 * Handles all /api/series/* endpoints with optimized caching strategies
 */

import { Hono } from 'hono';
import { kvCache, buildCacheKey } from '../middleware/cache';
import {
  getSeriesById,
  getSeriesEpisodes,
  getSeriesStats,
} from '../db/services/series.service';
import type { AppEnvWithDB } from '../db/types';
import { Errors } from '../lib/errors';

const series = new Hono<AppEnvWithDB>();

/**
 * GET /api/series/:id - Core metadata
 *
 * Returns static series data (title, description, episodes list)
 * Cache: 24 hours (public)
 */
series.get(
  '/:id',
  kvCache({
    ttl: 60 * 60 * 24, // 24 hours
    cacheControl: 'public, max-age=3600',
    keyGenerator: (c) => buildCacheKey('series', c.req.param('id'), 'core'),
  }),
  async (c) => {
    const seriesId = c.req.param('id');
    const db = c.get('db');

    // Query series and episodes using type-safe services
    const [seriesData, episodesData] = await Promise.all([
      getSeriesById(db, seriesId),
      getSeriesEpisodes(db, seriesId),
    ]);

    if (!seriesData) {
      throw Errors.notFound('Series', seriesId);
    }

    // Parse genres
    const genres = seriesData.genre
      ? seriesData.genre.split(',').map((g) => g.trim())
      : [];

    // Format episodes
    const episodes = episodesData.map((ep) => ({
      _id: ep.id,
      episodeNumber: ep.episodeNumber,
      title: ep.title,
      description: ep.description,
      thumbnail: ep.thumbnailUrl,
      duration: ep.duration,
      videoId: ep.videoId,
      releaseDate: ep.publishedAt
        ? new Date(ep.publishedAt * 1000).toISOString().split('T')[0]
        : undefined,
      isPaid: ep.isPaid,
    }));

    // Build response
    return c.json({
      _id: seriesData.id,
      title: seriesData.title,
      description: seriesData.description,
      thumbnail: seriesData.thumbnailUrl,
      coverImage: seriesData.thumbnailUrl,
      year: new Date(seriesData.createdAt * 1000).getFullYear(),
      status: seriesData.status,
      genres,
      director: seriesData.author,
      episodes,
    });
  }
);

/**
 * GET /api/series/:id/stats - Statistics
 *
 * Returns dynamic statistics (views, likes)
 * Cache: 1 minute (public, short TTL for real-time feel)
 */
series.get(
  '/:id/stats',
  kvCache({
    ttl: 60, // 1 minute
    cacheControl: 'public, max-age=30',
    keyGenerator: (c) => buildCacheKey('series', c.req.param('id'), 'stats'),
  }),
  async (c) => {
    const seriesId = c.req.param('id');
    const db = c.get('db');

    // Query stats using type-safe service
    const stats = await getSeriesStats(db, seriesId);

    if (stats.totalViews === 0 && stats.episodes.length === 0) {
      throw Errors.notFound('Series', seriesId);
    }

    // Format episode stats
    const episodes = stats.episodes.map((ep) => ({
      _id: ep.id,
      episodeNumber: ep.episodeNumber,
      views: ep.views,
      likes: ep.likes,
    }));

    // Build response
    return c.json({
      totalViews: stats.totalViews,
      totalLikes: stats.totalLikes,
      episodes,
    });
  }
);

export default series;
