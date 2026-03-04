/**
 * Feed API Route
 *
 * Public endpoint for browsing clips with cursor-based pagination.
 * Supports category filtering and NSFW content toggling.
 *
 * GET /api/feed?cursor=&category=&nsfw=safe&limit=20
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppEnvWithDB } from '../db/types';
import { feedQuerySchema, validationHook } from '../lib/schemas';
import { kvCache, buildCacheKey } from '../middleware/cache';
import { getFeedClips, getClipCategoryIds } from '../db/services/clips.service';
import { CACHE_TTL } from '../../lib/cache';

const feed = new Hono<AppEnvWithDB>();

/**
 * GET / — Paginated feed of published clips
 *
 * No auth required — visitors can browse without registering.
 * Results cached in KV with 2-min TTL per unique combination of
 * category, nsfw filter, and cursor position.
 */
feed.get(
  '/',
  zValidator('query', feedQuerySchema, validationHook),
  kvCache({
    ttl: CACHE_TTL.FEED,
    keyGenerator: (c) => {
      const { category, nsfw, cursor, sort, search } = c.req.query();
      // Skip caching for search queries (results change too frequently)
      if (search) return null;
      return buildCacheKey('feed', category || 'all', nsfw || 'safe', sort || 'latest', cursor || 'first');
    },
  }),
  async (c) => {
    const { cursor, limit, category, nsfw, sort, search } = c.req.valid('query');
    const db = c.get('db');

    // Fetch clips with cursor pagination
    const result = await getFeedClips(db, { cursor, limit, category, nsfw, sort, search });

    // Batch fetch category IDs for all clips in this page
    const clipIds = result.clips.map((clip) => clip._id);
    const categoryMap = await getClipCategoryIds(db, clipIds);

    // Merge category IDs into clip objects
    for (const clip of result.clips) {
      clip.categoryIds = categoryMap.get(clip._id) || [];
    }

    return c.json({
      clips: result.clips,
      nextCursor: result.nextCursor,
    });
  },
);

export default feed;
