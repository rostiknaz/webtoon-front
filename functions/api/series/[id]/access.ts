/**
 * Get Series Access Information API Endpoint
 *
 * GET /api/series/[id]/access
 *
 * Returns user-specific access information:
 * - User authentication status
 * - Platform-wide subscription status (access to ALL premium content)
 * - Episode lock status based on subscription
 * - HLS URLs for unlocked episodes
 *
 * Cache: 1 hour per subscription level (premium/free)
 * Invalidate: When user subscribes/unsubscribes
 *
 * Performance: KV cached, <5ms on cache hit
 */

import { createCacheLayer } from '../../../../lib/cache';
import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  SESSIONS: KVNamespace;
  CLOUDFLARE_STREAM_CUSTOMER_CODE: string;
  CLOUDFLARE_STREAM_FALLBACK_VIDEO_ID: string;
}

interface SeriesAccessResponse {
  user: {
    isAuthenticated: boolean;
    hasSubscription: boolean;
  };
  episodes: EpisodeAccess[];
}

interface EpisodeAccess {
  _id: string;
  episodeNumber: number;
  isLocked: boolean;
  hlsUrl?: string;
}

/**
 * Get user session from cookie
 */
async function getUserSession(request: Request, env: Env) {
  try {
    const cookie = request.headers.get('cookie') || '';
    const sessionToken = cookie
      .split(';')
      .find((c) => c.trim().startsWith('webtoon_session='))
      ?.split('=')[1];

    if (!sessionToken) return null;

    // Try KV cache first
    const cached = await env.SESSIONS.get(`session:${sessionToken}`, 'json');
    if (cached) return cached;

    // Fallback to D1
    const session = await env.DB.prepare(
      `SELECT s.user_id, u.email
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = ? AND s.expires_at > unixepoch()
       LIMIT 1`
    )
      .bind(sessionToken)
      .first();

    return session;
  } catch (error) {
    console.error('Session fetch error:', error);
    return null;
  }
}

/**
 * Check if user has active platform-wide subscription
 * Platform subscription gives access to ALL premium content
 */
async function checkUserSubscription(userId: string, env: Env): Promise<boolean> {
  const cache = createCacheLayer(env.CACHE);

  // Try cache first
  let subscription = await cache.subscriptions.getUserSubscription(userId);

  if (!subscription) {
    // Cache miss - query D1
    const dbSub = await env.DB.prepare(
      `SELECT status, current_period_end
       FROM subscriptions
       WHERE user_id = ?
         AND status IN ('active', 'trial')
         AND (current_period_end IS NULL OR current_period_end > unixepoch())
       LIMIT 1`
    )
      .bind(userId)
      .first();

    if (dbSub) {
      subscription = {
        status: dbSub.status as string,
        planId: '',
        planFeatures: { episodeAccess: 'all', adFree: true },
        currentPeriodEnd: dbSub.current_period_end as number,
        hasAccess: true,
        cachedAt: Date.now(),
      };

      // Cache for 1 hour
      await cache.subscriptions.setUserSubscription(userId, subscription);
    }
  }

  return !!subscription;
}

/**
 * Generate HLS URL for Cloudflare Stream video
 */
function getHlsUrl(videoId: string, customerCode: string): string {
  return `https://customer-${customerCode}.cloudflarestream.com/${videoId}/manifest/video.m3u8`;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const seriesId = params.id as string;

  try {
    const cache = createCacheLayer(env.CACHE);

    // Get user session and subscription status
    const session = await getUserSession(request, env);
    const userId = session && typeof session === 'object' && 'user_id' in session ? session.user_id as string : null;
    const hasSubscription = userId ? await checkUserSubscription(userId, env) : false;

    // Cache key based on subscription level (not per-user)
    // This allows sharing cache between all premium users or all free users
    const cacheKey = `series:${seriesId}:access:${hasSubscription ? 'premium' : 'free'}`;

    // Try cache first (1 hour TTL)
    const cachedData = await cache.raw.get<SeriesAccessResponse>(cacheKey);
    if (cachedData) {
      // Update user info (not cached)
      cachedData.user = {
        isAuthenticated: !!session,
        hasSubscription,
      };

      return new Response(JSON.stringify(cachedData), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=300', // Client cache for 5 minutes
          'X-Cache': 'HIT',
        },
      });
    }

    // Cache miss - query episodes
    const episodesData = await env.DB.prepare(
      `SELECT id, episode_number, video_id, is_paid
       FROM episodes
       WHERE serial_id = ?
       ORDER BY episode_number ASC`
    )
      .bind(seriesId)
      .all();

    if (!episodesData.results || episodesData.results.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Series not found',
          message: `No episodes found for series ID: ${seriesId}`,
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Format episodes with access info
    const episodes: EpisodeAccess[] = episodesData.results.map((ep: any) => {
      const isPaid = !!ep.is_paid;
      const isLocked = isPaid && !hasSubscription;

      // Use fallback video ID if episode doesn't have one
      const videoId = ep.video_id || env.CLOUDFLARE_STREAM_FALLBACK_VIDEO_ID;

      return {
        _id: ep.id,
        episodeNumber: ep.episode_number,
        isLocked,
        hlsUrl: !isLocked && videoId
          ? getHlsUrl(videoId, env.CLOUDFLARE_STREAM_CUSTOMER_CODE)
          : undefined,
      };
    });

    // Build response
    const response: SeriesAccessResponse = {
      user: {
        isAuthenticated: !!session,
        hasSubscription,
      },
      episodes,
    };

    // Cache for 1 hour (subscription level cache)
    // Don't cache user info, add it dynamically
    const cacheableResponse = {
      user: { isAuthenticated: false, hasSubscription }, // Placeholder
      episodes,
    };
    await cache.raw.set(cacheKey, cacheableResponse, { ttl: 60 * 60 });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Series access error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch series access',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
