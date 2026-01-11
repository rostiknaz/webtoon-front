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
import plansRoutes from './routes/plans';
import webhooksRoutes from './routes/webhooks';
import { drizzleMiddleware } from './db/index';
import type { AppEnvWithDB } from './db/types';

/**
 * Create Hono app instance with environment bindings
 */
const app = new Hono<AppEnvWithDB>();

/**
 * Global middleware
 */
app.use('*', cors());
app.use('*', drizzleMiddleware());

/**
 * Mount API routes
 */
app.route('/api/series', seriesRoutes);
app.route('/api/plans', plansRoutes);
app.route('/api/webhooks', webhooksRoutes);

/**
 * Health check endpoint
 */
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    worker: 'webtoon-front',
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
