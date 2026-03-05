/**
 * Video Proxy Route
 *
 * Serves video content from R2 through signed URL validation.
 * Rewrites HLS manifests to include signed tokens on all segment/playlist URLs.
 *
 * GET /api/video/:path{.+}?token=...&expires=...
 */

import { Hono } from 'hono';
import { validateVideoToken, generateVideoToken, VIDEO_TOKEN_TTL } from '../lib/video-token';
import { Errors } from '../lib/errors';
import type { AppEnv } from '../lib/types';

type VideoEnv = {
  Bindings: AppEnv['Bindings'];
};

const video = new Hono<VideoEnv>();

/** Content-Type mapping by file extension */
const CONTENT_TYPES = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/MP2T',
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
} as const;

type KnownExtension = keyof typeof CONTENT_TYPES;

function getContentType(path: string): string {
  const ext = path.substring(path.lastIndexOf('.')) as KnownExtension;
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

/**
 * Resolve a relative URL against a base path directory.
 * e.g., basePath="solgier/ep_01/manifest.m3u8", relative="360p/playlist.m3u8"
 *  → "solgier/ep_01/360p/playlist.m3u8"
 */
function resolveRelativePath(basePath: string, relative: string): string {
  const dir = basePath.substring(0, basePath.lastIndexOf('/') + 1);
  return dir + relative;
}

/**
 * Rewrite HLS manifest: replace relative URLs with signed proxy URLs.
 */
async function rewriteManifest(
  manifestText: string,
  basePath: string,
  secret: string,
): Promise<string> {
  const lines = manifestText.split('\n');
  const rewritten: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Lines that aren't comments/tags and aren't empty are URLs
    if (trimmed && !trimmed.startsWith('#')) {
      const resolvedPath = resolveRelativePath(basePath, trimmed);
      const isSegment = trimmed.endsWith('.ts');
      const ttl = isSegment ? VIDEO_TOKEN_TTL.SEGMENT : VIDEO_TOKEN_TTL.MANIFEST;
      const expires = Math.floor(Date.now() / 1000) + ttl;
      const token = await generateVideoToken(resolvedPath, expires, secret);
      rewritten.push(`/api/video/${resolvedPath}?token=${token}&expires=${expires}`);
    } else {
      rewritten.push(line);
    }
  }

  return rewritten.join('\n');
}

/**
 * GET /api/video/token — Generate a signed token for a video path.
 * Used by the frontend to get tokens for initial manifest requests.
 * Requires authentication.
 */
video.get('/token', async (c) => {
  // Require authentication — anonymous users cannot generate video tokens
  const userId = c.get('userId' as never);
  if (!userId) throw Errors.unauthorized();

  const path = c.req.query('path');
  if (!path) throw Errors.validation('path query parameter is required');

  const ttl = path.endsWith('.m3u8') ? VIDEO_TOKEN_TTL.MANIFEST : VIDEO_TOKEN_TTL.SEGMENT;
  const expires = Math.floor(Date.now() / 1000) + ttl;
  const token = await generateVideoToken(path, expires, c.env.BETTER_AUTH_SECRET);

  return c.json({ token, expires, path });
});

/**
 * GET /api/video/* — Proxy video content from R2 with token validation.
 */
video.get('/*', async (c) => {
  // Extract the R2 object path — Hono sub-router receives path relative to mount point
  const path = c.req.path.replace(/^\//, '');
  if (!path) throw Errors.notFound('Video', 'empty path');

  // Validate token
  const token = c.req.query('token');
  const expiresStr = c.req.query('expires');

  if (!token || !expiresStr) {
    throw Errors.forbidden('Missing video token');
  }

  const expires = parseInt(expiresStr, 10);
  if (isNaN(expires)) {
    throw Errors.forbidden('Invalid token expiry');
  }

  const isValid = await validateVideoToken(path, token, expires, c.env.BETTER_AUTH_SECRET);
  if (!isValid) {
    throw Errors.forbidden('Invalid or expired video token');
  }

  // Fetch from R2 via binding (free, no egress)
  const r2Object = await c.env.VIDEO_STORAGE.get(path);
  if (!r2Object) {
    throw Errors.notFound('Video object', path);
  }

  const contentType = getContentType(path);
  const isManifest = path.endsWith('.m3u8');

  if (isManifest) {
    // Rewrite manifest to include signed URLs for all referenced files
    const manifestText = await r2Object.text();
    const rewritten = await rewriteManifest(manifestText, path, c.env.BETTER_AUTH_SECRET);

    return new Response(rewritten, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Stream non-manifest content (segments, MP4) directly from R2
  const isSegment = path.endsWith('.ts') || path.endsWith('.mp4');
  return new Response(r2Object.body, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': r2Object.size.toString(),
      // Segments are immutable content — allow short caching
      'Cache-Control': isSegment ? 'private, max-age=300' : 'private, no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
});

export default video;
