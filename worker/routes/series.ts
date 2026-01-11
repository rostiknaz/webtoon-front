/**
 * Series API Routes
 *
 * Handles all /api/series/* endpoints with optimized caching strategies
 */

import { Hono } from 'hono';
import { createCacheLayer } from '../../lib/cache';
import { getUserSession, checkUserSubscription } from '../lib/auth';
import { kvCache, buildCacheKey } from '../middleware/cache';
import {
  getSeriesById,
  getSeriesEpisodes,
  getEpisodesForAccess,
  getSeriesStats,
} from '../db/services/series.service';
import type { AppEnvWithDB } from '../db/types';

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
      return c.json(
        { error: 'Series not found', message: `No series found with ID: ${seriesId}` },
        404
      );
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
 * GET /api/series/:id/access - Access information
 *
 * Returns user-specific access data (isLocked, hlsUrl)
 * Cache: 1 hour per subscription level (private)
 */
series.get('/:id/access', async (c) => {
  const seriesId = c.req.param('id');

  // Get user session and subscription
  const session = await getUserSession(c.req.raw, c.env);
  const userId =
    session && typeof session === 'object' && 'user_id' in session
      ? (session.user_id as string)
      : null;
  const hasSubscription = userId ? await checkUserSubscription(userId, c.env) : false;

  // Cache key based on subscription level (not per-user)
  const cacheKey = buildCacheKey(
    'series',
    seriesId,
    'access',
    hasSubscription ? 'premium' : 'free'
  );

  // Try cache first
  const cache = createCacheLayer(c.env.CACHE);
  const cachedData = await cache.raw.get<any>(cacheKey);

  if (cachedData) {
    // Update user info dynamically (not cached)
    cachedData.user = {
      isAuthenticated: !!session,
      hasSubscription,
    };

    return c.json(cachedData, 200, {
      'Cache-Control': 'private, max-age=300',
      'Cache-Status': 'HIT; ttl=3600',
    });
  }

  // Cache miss - query episodes using Drizzle
  const db = c.get('db');
  const episodesData = await getEpisodesForAccess(db, seriesId);

  if (episodesData.length === 0) {
    return c.json(
      { error: 'Series not found', message: `No episodes found for series ID: ${seriesId}` },
      404
    );
  }

  // Format episodes with access info
  const episodes = episodesData.map((ep) => {
    const isLocked = ep.isPaid && !hasSubscription;
    const videoId = ep.videoId || c.env.CLOUDFLARE_STREAM_FALLBACK_VIDEO_ID;

    return {
      _id: ep.id,
      episodeNumber: ep.episodeNumber,
      isLocked,
      hlsUrl:
        !isLocked && videoId
          ? `https://customer-${c.env.CLOUDFLARE_STREAM_CUSTOMER_CODE}.cloudflarestream.com/${videoId}/manifest/video.m3u8`
          : undefined,
    };
  });

  // Build response
  const response = {
    user: {
      isAuthenticated: !!session,
      hasSubscription,
    },
    episodes,
  };

  // Cache for 1 hour (subscription level cache)
  const cacheableResponse = {
    user: { isAuthenticated: false, hasSubscription },
    episodes,
  };
  await cache.raw.set(cacheKey, cacheableResponse, { ttl: 60 * 60 });

  return c.json(response, 200, {
    'Cache-Control': 'private, max-age=300',
    'Cache-Status': 'MISS; stored; ttl=3600',
  });
});

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
      return c.json(
        { error: 'Series not found', message: `No series found with ID: ${seriesId}` },
        404
      );
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
