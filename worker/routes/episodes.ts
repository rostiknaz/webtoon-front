/**
 * Episodes API Routes
 *
 * Handles episode-specific endpoints like likes
 */

import { Hono } from 'hono';
import { incrementEpisodeLikes, decrementEpisodeLikes } from '../db/services/series.service';
import type { AppEnvWithDB } from '../db/types';

const episodes = new Hono<AppEnvWithDB>();

/**
 * POST /api/episodes/:id/like - Like an episode
 *
 * Anonymous endpoint - no auth required
 * Increments the likes counter for the episode
 */
episodes.post('/:id/like', async (c) => {
  const episodeId = c.req.param('id');
  const db = c.get('db');

  try {
    const likes = await incrementEpisodeLikes(db, episodeId);
    return c.json({ likes, liked: true });
  } catch (error) {
    console.error('Failed to like episode:', error);
    return c.json({ error: 'Failed to like episode' }, 500);
  }
});

/**
 * DELETE /api/episodes/:id/like - Unlike an episode
 *
 * Anonymous endpoint - no auth required
 * Decrements the likes counter for the episode
 */
episodes.delete('/:id/like', async (c) => {
  const episodeId = c.req.param('id');
  const db = c.get('db');

  try {
    const likes = await decrementEpisodeLikes(db, episodeId);
    return c.json({ likes, liked: false });
  } catch (error) {
    console.error('Failed to unlike episode:', error);
    return c.json({ error: 'Failed to unlike episode' }, 500);
  }
});

export default episodes;
