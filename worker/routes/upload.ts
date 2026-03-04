/**
 * Upload Routes
 *
 * POST /api/upload/init — Create clip + get presigned R2 PUT URL
 * POST /api/upload/retry/:clipId — Get fresh presigned URL for existing processing clip
 * POST /api/upload/complete/:clipId — Confirm upload + trigger NSFW moderation scan
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppEnvWithDB } from '../db/types';
import { requireCreator } from '../middleware/auth-guard';
import { uploadInitSchema, validationHook } from '../lib/schemas';
import { Errors } from '../lib/errors';
import { createClip, getClipById, updateClipVideoUrl, verifySeriesOwnership } from '../db/services/clips.service';
import { createR2Client, generatePresignedPutUrl } from '../lib/r2';
import { processClipModeration } from '../db/services/moderation.service';
import type { DB } from '../db';

const upload = new Hono<AppEnvWithDB>();

const PRESIGNED_URL_EXPIRY = 3600; // 1 hour

function getR2Client(env: AppEnvWithDB['Bindings']) {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw Errors.internal('R2 credentials not configured');
  }
  return createR2Client(R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY);
}

function buildClipVideoUrl(env: AppEnvWithDB['Bindings'], clipId: string) {
  if (!env.R2_CDN_URL) throw Errors.internal('R2_CDN_URL not configured');
  return `${env.R2_CDN_URL}/clips/${clipId}/video.mp4`;
}

async function generateClipPresignedUrl(env: AppEnvWithDB['Bindings'], clipId: string) {
  const r2Client = getR2Client(env);
  const bucketName = env.R2_BUCKET_NAME || 'webtoon-hls';
  return generatePresignedPutUrl(r2Client, bucketName, `clips/${clipId}/video.mp4`, 'video/mp4', PRESIGNED_URL_EXPIRY);
}

async function getOwnedProcessingClip(db: DB, clipId: string, userId: string) {
  const clip = await getClipById(db, clipId);
  if (!clip) throw Errors.notFound('Clip', clipId);
  if (clip.creatorId !== userId) throw Errors.forbidden('This clip does not belong to you');
  if (clip.status !== 'processing') throw Errors.badRequest('Clip is not in processing state');
  return clip;
}

/**
 * POST /init — Create clip + get presigned R2 PUT URL
 */
upload.post(
  '/init',
  requireCreator(),
  zValidator('json', uploadInitSchema, validationHook),
  async (c) => {
    const userId = c.get('userId')!;
    const db = c.get('db');
    const data = c.req.valid('json');

    if (data.seriesId) {
      const isOwner = await verifySeriesOwnership(db, data.seriesId, userId);
      if (!isOwner) throw Errors.forbidden('Series not found or not owned by you');
    }

    const clipId = await createClip(db, {
      creatorId: userId,
      title: data.title,
      duration: data.duration,
      resolution: data.resolution,
      fileSize: data.fileSize,
      nsfwRating: data.nsfwRating,
      seriesId: data.seriesId,
      episodeNumber: data.episodeNumber,
    }, data.categoryIds);

    const presignedUrl = await generateClipPresignedUrl(c.env, clipId);

    return c.json({ _id: clipId, presignedUrl, expiresIn: PRESIGNED_URL_EXPIRY });
  },
);

/**
 * POST /retry/:clipId — Fresh presigned URL for an existing processing clip
 */
upload.post(
  '/retry/:clipId',
  requireCreator(),
  async (c) => {
    const clipId = c.req.param('clipId');
    await getOwnedProcessingClip(c.get('db'), clipId, c.get('userId')!);

    const presignedUrl = await generateClipPresignedUrl(c.env, clipId);

    return c.json({ _id: clipId, presignedUrl, expiresIn: PRESIGNED_URL_EXPIRY });
  },
);

/**
 * POST /complete/:clipId — Confirm upload + trigger NSFW moderation scan
 */
upload.post(
  '/complete/:clipId',
  requireCreator(),
  async (c) => {
    const db = c.get('db');
    const clipId = c.req.param('clipId');
    const clip = await getOwnedProcessingClip(db, clipId, c.get('userId')!);

    const videoUrl = buildClipVideoUrl(c.env, clipId);
    await updateClipVideoUrl(db, clipId, videoUrl);

    const ai = c.env.AI || null;
    // Pass clip with updated videoUrl (clip was fetched before the update)
    const result = await processClipModeration(db, ai, { ...clip, videoUrl });

    return c.json({ _id: clipId, status: result.status, reason: result.reason });
  },
);

export default upload;
