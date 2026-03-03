/**
 * Categories API Route
 *
 * Public endpoint for listing all categories.
 * Cached for 24 hours since categories rarely change.
 *
 * GET /api/categories
 */

import { Hono } from 'hono';
import type { AppEnvWithDB } from '../db/types';
import { kvCache, buildCacheKey } from '../middleware/cache';
import { getAllCategories } from '../db/services/categories.service';
import { CACHE_TTL } from '../../lib/cache';

const categoriesRouter = new Hono<AppEnvWithDB>();

/**
 * GET / — All categories ordered by sortOrder
 *
 * No auth required — categories are public.
 * Cached 24 hours in KV.
 */
categoriesRouter.get(
  '/',
  kvCache({
    ttl: CACHE_TTL.CATEGORIES,
    keyGenerator: () => buildCacheKey('categories', 'all'),
  }),
  async (c) => {
    const db = c.get('db');
    const categories = await getAllCategories(db);
    return c.json({ categories });
  },
);

export default categoriesRouter;
