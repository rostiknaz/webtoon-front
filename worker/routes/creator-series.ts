/**
 * Creator Series Routes
 *
 * GET    /                       — List creator's series
 * POST   /                       — Create new series
 * GET    /:seriesId              — Series detail with episodes
 * PUT    /:seriesId              — Update series metadata
 * DELETE /:seriesId              — Delete series
 * POST   /:seriesId/cover        — Get presigned PUT URL for cover image
 * POST   /:seriesId/cover/complete — Store CDN cover URL in DB
 */

import { Hono, type Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppEnvWithDB } from '../db/types';
import { requireCreator } from '../middleware/auth-guard';
import { seriesCreateSchema, seriesUpdateSchema, validationHook } from '../lib/schemas';
import { Errors } from '../lib/errors';
import { verifySeriesOwnership } from '../db/services/clips.service';
import {
  createSeries,
  getCreatorSeries,
  getSeriesDetail,
  updateSeries,
  deleteSeries,
} from '../db/services/creator-series.service';
import { createR2Client, generatePresignedPutUrl } from '../lib/r2';

const creatorSeriesRoutes = new Hono<AppEnvWithDB>();

const PRESIGNED_URL_EXPIRY = 3600;

const ALLOWED_COVER_TYPES: Record<string, string> = {
  'image/jpeg': 'cover.jpg',
  'image/png': 'cover.png',
};

function getR2Client(env: AppEnvWithDB['Bindings']) {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw Errors.internal('R2 credentials not configured');
  }
  return createR2Client(R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY);
}

function buildCoverUrl(env: AppEnvWithDB['Bindings'], seriesId: string, filename: string) {
  if (!env.R2_CDN_URL) throw Errors.internal('R2_CDN_URL not configured');
  return `${env.R2_CDN_URL}/series/${seriesId}/${filename}`;
}

async function verifyOwnership(c: Context<AppEnvWithDB>, seriesId: string) {
  const db = c.get('db');
  const userId = c.get('userId')!;
  const isOwner = await verifySeriesOwnership(db, seriesId, userId);
  if (!isOwner) throw Errors.notFound('Series', seriesId);
}

/**
 * GET / — List creator's series
 */
creatorSeriesRoutes.get(
  '/',
  requireCreator(),
  async (c) => {
    const db = c.get('db');
    const userId = c.get('userId')!;
    const series = await getCreatorSeries(db, userId);
    return c.json({ series });
  },
);

/**
 * POST / — Create new series
 */
creatorSeriesRoutes.post(
  '/',
  requireCreator(),
  zValidator('json', seriesCreateSchema, validationHook),
  async (c) => {
    const db = c.get('db');
    const userId = c.get('userId')!;
    const data = c.req.valid('json');

    const { id, slug } = await createSeries(db, {
      creatorId: userId,
      title: data.title,
      description: data.description,
      genre: data.genre,
      nsfwRating: data.nsfwRating,
      status: data.status,
    });

    return c.json({ _id: id, slug }, 201);
  },
);

/**
 * GET /:seriesId — Series detail with episodes
 */
creatorSeriesRoutes.get(
  '/:seriesId',
  requireCreator(),
  async (c) => {
    const seriesId = c.req.param('seriesId');
    await verifyOwnership(c, seriesId);

    const detail = await getSeriesDetail(c.get('db'), seriesId);
    if (!detail) throw Errors.notFound('Series', seriesId);

    return c.json(detail);
  },
);

/**
 * PUT /:seriesId — Update series metadata
 */
creatorSeriesRoutes.put(
  '/:seriesId',
  requireCreator(),
  zValidator('json', seriesUpdateSchema, validationHook),
  async (c) => {
    const seriesId = c.req.param('seriesId');
    await verifyOwnership(c, seriesId);

    const data = c.req.valid('json');
    await updateSeries(c.get('db'), seriesId, data);

    return c.json({ _id: seriesId, updated: true });
  },
);

/**
 * DELETE /:seriesId — Delete series (clips retain, seriesId set to null)
 */
creatorSeriesRoutes.delete(
  '/:seriesId',
  requireCreator(),
  async (c) => {
    const seriesId = c.req.param('seriesId');
    await verifyOwnership(c, seriesId);

    await deleteSeries(c.get('db'), seriesId);

    return c.json({ _id: seriesId, deleted: true });
  },
);

/**
 * POST /:seriesId/cover — Generate presigned PUT URL for cover image upload
 */
creatorSeriesRoutes.post(
  '/:seriesId/cover',
  requireCreator(),
  async (c) => {
    const seriesId = c.req.param('seriesId');
    await verifyOwnership(c, seriesId);

    const contentType = c.req.header('x-content-type') || 'image/jpeg';
    const filename = ALLOWED_COVER_TYPES[contentType];
    if (!filename) throw Errors.badRequest('Unsupported content type. Use image/jpeg or image/png');

    const r2Client = getR2Client(c.env);
    const bucketName = c.env.R2_BUCKET_NAME || 'webtoon-hls';
    const key = `series/${seriesId}/${filename}`;

    const presignedUrl = await generatePresignedPutUrl(r2Client, bucketName, key, contentType, PRESIGNED_URL_EXPIRY);

    return c.json({ presignedUrl, key, expiresIn: PRESIGNED_URL_EXPIRY });
  },
);

/**
 * POST /:seriesId/cover/complete — Store CDN cover URL in DB after upload
 */
creatorSeriesRoutes.post(
  '/:seriesId/cover/complete',
  requireCreator(),
  async (c) => {
    const seriesId = c.req.param('seriesId');
    await verifyOwnership(c, seriesId);

    const body = await c.req.json<{ contentType?: string }>();
    const contentType = body.contentType || 'image/jpeg';
    const filename = ALLOWED_COVER_TYPES[contentType];
    if (!filename) throw Errors.badRequest('Unsupported content type');

    const coverUrl = buildCoverUrl(c.env, seriesId, filename);
    await updateSeries(c.get('db'), seriesId, { coverUrl });

    return c.json({ _id: seriesId, coverUrl });
  },
);

export default creatorSeriesRoutes;
