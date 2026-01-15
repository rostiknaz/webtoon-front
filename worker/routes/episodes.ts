/**
 * Episodes API Routes
 *
 * Handles episode-specific endpoints like likes
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { incrementEpisodeLikes, decrementEpisodeLikes } from '../db/services/series.service';
import type { AppEnvWithDB } from '../db/types';
import { idParamSchema, validationHook } from '../lib/schemas';

const episodes = new Hono<AppEnvWithDB>();

/**
 * POST /api/episodes/:id/like - Like an episode
 *
 * Anonymous endpoint - no auth required
 * Increments the likes counter for the episode
 */
episodes.post(
  '/:id/like',
  zValidator('param', idParamSchema, validationHook),
  async (c) => {
    const { id: episodeId } = c.req.valid('param');
    const db = c.get('db');
    const likes = await incrementEpisodeLikes(db, episodeId);
    return c.json({ likes, liked: true });
  }
);

/**
 * DELETE /api/episodes/:id/like - Unlike an episode
 *
 * Anonymous endpoint - no auth required
 * Decrements the likes counter for the episode
 */
episodes.delete(
  '/:id/like',
  zValidator('param', idParamSchema, validationHook),
  async (c) => {
    const { id: episodeId } = c.req.valid('param');
    const db = c.get('db');
    const likes = await decrementEpisodeLikes(db, episodeId);
    return c.json({ likes, liked: false });
  }
);

export default episodes;
