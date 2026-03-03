/**
 * Creator API Routes
 *
 * Handles creator registration and profile endpoints.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppEnvWithDB } from '../db/types';
import { Errors } from '../lib/errors';
import { creatorRegistrationSchema, validationHook } from '../lib/schemas';
import { requireAuth } from '../middleware/auth-guard';
import {
  getCreatorProfile,
  getPublicCreatorProfile,
  registerAsCreator,
} from '../db/services/creators.service';
import { kvCache, buildCacheKey } from '../middleware/cache';

const creators = new Hono<AppEnvWithDB>();

/**
 * POST /api/creators/register
 *
 * Register the current user as a creator.
 * Requires authentication. User must be a consumer (not already a creator).
 * Automatically determines founding creator status (first 100 creators).
 */
creators.post(
  '/register',
  requireAuth(),
  zValidator('json', creatorRegistrationSchema, validationHook),
  async (c) => {
    const userId = c.get('userId')!;
    const db = c.get('db');
    const data = c.req.valid('json');

    // Check if already a creator
    const existing = await getCreatorProfile(db, userId);
    if (existing) throw Errors.conflict('Already registered as creator');

    const result = await registerAsCreator(db, userId, {
      displayName: data.displayName,
      bio: data.bio,
      payoutMethod: data.payoutMethod,
      payoutEmail: data.payoutEmail,
    });

    return c.json({
      success: true,
      isFoundingCreator: result.isFoundingCreator,
    });
  }
);

/**
 * GET /api/creators/me
 *
 * Get the current user's creator profile.
 * Returns 404 if user is not a creator (prompts registration).
 */
creators.get('/me', requireAuth(), async (c) => {
  const userId = c.get('userId')!;
  const db = c.get('db');

  const profile = await getCreatorProfile(db, userId);
  if (!profile) throw Errors.notFound('Creator profile', userId);

  return c.json({
    _id: profile.id,
    displayName: profile.displayName,
    bio: profile.bio,
    image: profile.image,
    role: profile.role,
    isFoundingCreator: profile.isFoundingCreator,
    payoutMethod: profile.payoutMethod,
    payoutEmail: profile.payoutEmail,
    createdAt: profile.createdAt,
  });
});

/**
 * GET /api/creators/:id
 *
 * Get a public creator profile by ID.
 * Cached in KV for 30 minutes. Excludes sensitive fields (payout info).
 */
creators.get(
  '/:id',
  kvCache({
    ttl: 60 * 30,
    keyGenerator: (c) => buildCacheKey('creator', c.req.param('id')),
  }),
  async (c) => {
    const creatorId = c.req.param('id');
    const db = c.get('db');

    const profile = await getPublicCreatorProfile(db, creatorId);
    if (!profile) throw Errors.notFound('Creator', creatorId);

    return c.json({
      _id: profile.id,
      displayName: profile.displayName,
      bio: profile.bio,
      image: profile.image,
      isFoundingCreator: profile.isFoundingCreator,
    });
  }
);

export default creators;
