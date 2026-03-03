/**
 * Cloudflare Worker Entry Point with Hono Framework
 *
 * Handles API requests and serves static assets
 *
 * Architecture:
 * - Uses Hono for routing (ultra-fast, lightweight framework)
 * - KV-based caching with proper Cache-Status headers
 * - Modular route structure for maintainability
 *
 * @see https://hono.dev/
 * @see https://developers.cloudflare.com/workers/
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import seriesRoutes from './routes/series';
import episodesRoutes from './routes/episodes';
import plansRoutes from './routes/plans';
import webhooksRoutes from './routes/webhooks';
import subscriptionRoutes from './routes/subscription';
import creatorsRoutes from './routes/creators';
import feedRoutes from './routes/feed';
import categoriesRoutes from './routes/categories';
import { drizzleMiddleware } from './db';
import { createAuth } from './auth';
import type { AppEnvWithDB } from './db/types';
import { toApiError } from './lib/errors';
import { createCacheLayer } from '../lib/cache';

/**
 * Create Hono app instance with environment bindings
 */
const app = new Hono<AppEnvWithDB>();

/**
 * Global error handler
 *
 * Catches all errors and returns standardized API responses.
 * ApiError instances are converted to their defined status codes.
 * Unknown errors are logged and returned as 500 Internal Server Error.
 */
app.onError((err, c) => {
  const apiError = toApiError(err);
  return c.json(apiError.toResponse(), apiError.statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503);
});

/**
 * Global middleware
 */
// CORS configuration for Better Auth
app.use('*', cors({
  origin: (origin) => {
    // Allow requests from the same origin (Worker serves both API and frontend)
    // and from localhost for development
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://webtoon-front.rostiknaz.workers.dev',
    ];

    // If origin matches allowed origins, return it
    if (origin && allowedOrigins.includes(origin)) {
      return origin;
    }

    // For same-origin requests (no Origin header), allow them
    return allowedOrigins[2]; // Default to production URL
  },
  credentials: true, // Allow cookies for Better Auth sessions
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Set-Cookie'],
  maxAge: 86400, // 24 hours
}));
app.use('*', drizzleMiddleware());

/**
 * API middleware - auth, session, and cache initialization
 *
 * This middleware runs once per request and sets up:
 * - auth: Better Auth instance for authentication
 * - session: Cached session data (eliminates redundant lookups in routes)
 * - userId: Convenience accessor for session.user.id
 * - cache: KV cache layer instance (eliminates object allocation per route)
 */
app.use('/api/*', async (c, next) => {
  // Create auth instance with env bindings and Cloudflare context
  const cf = (c.req.raw as any).cf || {};
  const auth = createAuth(c.env, cf);
  c.set('auth', auth);

  // Create cache layer once per request (P1 fix: eliminates 6+ object allocations per route)
  const cache = createCacheLayer(c.env.CACHE);
  c.set('cache', cache);

  // Fetch session once per request (P1 fix: eliminates redundant auth lookups in routes)
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  c.set('session', session);
  c.set('userId', session?.user?.id || null);

  await next();
});

/**
 * Better Auth routes - handle all authentication endpoints
 *
 * Endpoints handled:
 * - POST /api/auth/sign-in/email
 * - POST /api/auth/sign-up/email
 * - POST /api/auth/sign-out
 * - GET /api/auth/get-session
 * - And all other Better Auth endpoints
 */
app.all('/api/auth/*', async (c) => {
  const auth = c.get('auth');
  return auth.handler(c.req.raw);
});

/**
 * Mount API routes
 */
app.route('/api/series', seriesRoutes);
app.route('/api/episodes', episodesRoutes);
app.route('/api/plans', plansRoutes);
app.route('/api/webhooks', webhooksRoutes);
app.route('/api/subscription', subscriptionRoutes);
app.route('/api/creators', creatorsRoutes);
app.route('/api/feed', feedRoutes);
app.route('/api/categories', categoriesRoutes);

/**
 * Health check endpoint
 */
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    worker: 'webtoon-front',
    auth: 'better-auth-cloudflare',
  });
});

/**
 * Serve static assets for all non-API routes
 *
 * In production, this uses the ASSETS binding configured in wrangler.jsonc
 * In development, Vite handles asset serving automatically
 */
app.all('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

/**
 * Export the app
 */
export default app;
