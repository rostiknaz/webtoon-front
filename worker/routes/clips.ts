/**
 * Clips Routes
 *
 * GET /api/clips/mine — Creator's own clips with status and moderation reasons
 * GET /api/clips/:clipId/status — Lightweight status check for polling during upload
 */

import { Hono } from 'hono';
import type { AppEnvWithDB } from '../db/types';
import { requireCreator } from '../middleware/auth-guard';
import { getCreatorClips, getClipModerationLogs, getClipStatus } from '../db/services/clips.service';

const clipsRouter = new Hono<AppEnvWithDB>();

/**
 * GET /api/clips/mine
 *
 * Returns all clips belonging to the authenticated creator,
 * with moderation reasons for rejected/review clips.
 */
clipsRouter.get(
  '/mine',
  requireCreator(),
  async (c) => {
    const userId = c.get('userId')!;
    const db = c.get('db');

    const creatorClips = await getCreatorClips(db, userId);

    // Batch fetch moderation reasons for clips that have been moderated
    const moderatedClipIds = creatorClips
      .filter((clip) => clip.status === 'rejected' || clip.status === 'review')
      .map((clip) => clip.id);

    const moderationMap = await getClipModerationLogs(db, moderatedClipIds);

    const response = creatorClips.map((clip) => {
      const moderation = moderationMap.get(clip.id);
      return {
        _id: clip.id,
        title: clip.title,
        status: clip.status,
        thumbnailUrl: clip.thumbnailUrl,
        videoUrl: clip.videoUrl,
        duration: clip.duration,
        views: clip.views,
        downloadCount: clip.downloadCount,
        nsfwRating: clip.nsfwRating,
        seriesId: clip.seriesId,
        episodeNumber: clip.episodeNumber,
        moderationReason: moderation?.reason ?? null,
        moderationAction: moderation?.action ?? null,
        publishedAt: clip.publishedAt?.toISOString() ?? null,
        createdAt: clip.createdAt.toISOString(),
      };
    });

    return c.json({ clips: response });
  },
);

/**
 * GET /api/clips/:clipId/status
 *
 * Lightweight endpoint for polling clip moderation status during upload.
 * Returns only { _id, status, reason } instead of the full clips list.
 */
clipsRouter.get(
  '/:clipId/status',
  requireCreator(),
  async (c) => {
    const clipId = c.req.param('clipId');
    const userId = c.get('userId')!;
    const db = c.get('db');

    const result = await getClipStatus(db, clipId, userId);
    if (!result) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Clip not found' } }, 404);
    }

    return c.json(result);
  },
);

export default clipsRouter;
