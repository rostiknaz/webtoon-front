/**
 * Auth Guard Middleware
 *
 * Role-based access control middleware for Hono routes.
 * Uses session data set by the global /api/* middleware in worker/index.ts.
 */

import type { Context, Next } from 'hono';
import type { AppEnvWithDB } from '../db/types';
import { Errors } from '../lib/errors';

/**
 * Require authenticated user (any role)
 *
 * @example
 * route.get('/me', requireAuth(), async (c) => { ... })
 */
export const requireAuth = () => async (c: Context<AppEnvWithDB>, next: Next) => {
  const session = c.get('session');
  if (!session) throw Errors.unauthorized();
  await next();
};

/**
 * Require creator or admin role
 *
 * @example
 * route.post('/upload', requireCreator(), async (c) => { ... })
 */
export const requireCreator = () => async (c: Context<AppEnvWithDB>, next: Next) => {
  const session = c.get('session');
  if (!session) throw Errors.unauthorized();
  if (session.user.role !== 'creator' && session.user.role !== 'admin')
    throw Errors.forbidden('Creator access required');
  await next();
};

/**
 * Require admin role
 *
 * @example
 * route.get('/admin/metrics', requireAdmin(), async (c) => { ... })
 */
export const requireAdmin = () => async (c: Context<AppEnvWithDB>, next: Next) => {
  const session = c.get('session');
  if (!session) throw Errors.unauthorized();
  if (session.user.role !== 'admin')
    throw Errors.forbidden('Admin access required');
  await next();
};
