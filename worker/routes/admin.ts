/**
 * Admin Routes
 *
 * GET /api/admin/moderation — List clips in review queue
 * POST /api/admin/moderation/:clipId — Approve or reject a clip
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppEnvWithDB } from '../db/types';
import { requireAdmin } from '../middleware/auth-guard';
import { validationHook } from '../lib/schemas';
import { getModerationQueue, adminModerateClip } from '../db/services/moderation.service';

const admin = new Hono<AppEnvWithDB>();

const moderationActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional(),
});

/**
 * GET /api/admin/moderation
 *
 * List clips with status='review' for admin moderation.
 */
admin.get(
  '/moderation',
  requireAdmin(),
  async (c) => {
    const db = c.get('db');
    const queue = await getModerationQueue(db);
    return c.json({ clips: queue });
  },
);

/**
 * POST /api/admin/moderation/:clipId
 *
 * Admin approves or rejects a clip in review.
 */
admin.post(
  '/moderation/:clipId',
  requireAdmin(),
  zValidator('json', moderationActionSchema, validationHook),
  async (c) => {
    const adminId = c.get('userId')!;
    const db = c.get('db');
    const clipId = c.req.param('clipId');
    const { action, reason } = c.req.valid('json');

    await adminModerateClip(db, clipId, adminId, action, reason);

    return c.json({
      _id: clipId,
      status: action === 'approve' ? 'published' : 'rejected',
      action,
    });
  },
);

export default admin;
