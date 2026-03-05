/**
 * Download API Routes
 *
 * Handles clip downloads with credit deduction and presigned R2 URLs.
 * Returns download URL + refreshed credit cookie.
 */

import { Hono } from 'hono';
import { processDownload, getDownloadedClipIds } from '../db/services/download.service';
import { getDownloadHistory } from '../db/services/download-history.service';
import { createCreditSetCookie } from '../lib/credit-cookie';
import { createR2Client, generatePresignedGetUrl } from '../lib/r2';
import type { AppEnvWithDB } from '../db/types';
import { Errors } from '../lib/errors';

const downloadRoute = new Hono<AppEnvWithDB>();

/**
 * GET /api/download/history
 *
 * Returns paginated download history with clip metadata.
 * Auth required. Cursor-based pagination via `cursor` query param.
 */
downloadRoute.get('/history', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    throw Errors.unauthorized();
  }

  const cursorParam = c.req.query('cursor');
  const limitParam = c.req.query('limit');

  const parsedCursor = cursorParam ? Number(cursorParam) : undefined;
  if (parsedCursor !== undefined && (isNaN(parsedCursor) || parsedCursor < 0)) {
    throw Errors.validation('Invalid cursor');
  }
  const cursor = parsedCursor;

  const parsedLimit = limitParam ? Number(limitParam) : 20;
  const limit = isNaN(parsedLimit) || parsedLimit < 1 ? 20 : Math.min(parsedLimit, 50);

  const result = await getDownloadHistory(c.get('db'), userId, cursor, limit);

  return c.json(result);
});

/**
 * GET /api/download/mine
 *
 * Returns clip IDs the current user has downloaded.
 * Used client-side to show checkmark state on download buttons.
 */
downloadRoute.get('/mine', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    throw Errors.unauthorized();
  }

  const clipIds = await getDownloadedClipIds(c.get('db'), userId);

  return c.json({ clipIds });
});

/**
 * POST /api/download/:clipId
 *
 * Atomically deducts credit and returns presigned R2 download URL.
 * Refreshes credit cookie on successful deduction.
 */
downloadRoute.post('/:clipId', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    throw Errors.unauthorized();
  }

  const clipId = c.req.param('clipId');

  const result = await processDownload(
    c.get('db'),
    userId,
    clipId,
    c.env.R2_CDN_URL,
  );

  // Generate presigned GET URL (5-min TTL) or fall back to CDN URL
  let downloadUrl: string;
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = c.env;

  if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME) {
    const r2Client = createR2Client(R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY);
    downloadUrl = await generatePresignedGetUrl(r2Client, R2_BUCKET_NAME, result.r2Key, 300);
  } else {
    // Fallback: use CDN URL directly (local development without R2 credentials)
    downloadUrl = `${c.env.R2_CDN_URL}/${result.r2Key}`;
  }

  // Refresh credit cookie if credits were deducted
  const headers: Record<string, string> = {};
  if (result.creditCost > 0) {
    headers['Set-Cookie'] = await createCreditSetCookie(
      result.creditsRemaining,
      result.freeDownloadsRemaining,
      c.env.BETTER_AUTH_SECRET,
      c.env.BETTER_AUTH_URL.startsWith('https'),
    );
  }

  return c.json(
    {
      downloadUrl,
      creditsRemaining: result.creditsRemaining,
      freeDownloadsRemaining: result.freeDownloadsRemaining,
      alreadyDownloaded: result.alreadyDownloaded,
      creditCost: result.creditCost,
    },
    200,
    headers,
  );
});

export default downloadRoute;
