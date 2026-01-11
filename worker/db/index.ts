/**
 * Drizzle ORM client initialization and middleware
 *
 * This module provides:
 * - Drizzle client factory for D1 database
 * - Hono middleware to inject Drizzle into request context
 */

import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../../db/schema';
import type { Context, Next } from 'hono';
import type { AppEnv } from '../lib/types';

/**
 * Create Drizzle client from D1 binding
 *
 * Called per-request to ensure fresh connection.
 * Includes schema for relational queries and type inference.
 *
 * @param d1 - Cloudflare D1 database binding
 * @returns Drizzle database instance with schema
 */
export function createDrizzleClient(d1: D1Database): DrizzleD1Database<typeof schema> {
  return drizzle(d1, { schema });
}

/**
 * Middleware: Attach Drizzle instance to request context
 *
 * Usage in routes:
 * ```typescript
 * const db = c.get('db');
 * const users = await db.query.users.findMany();
 * ```
 *
 * @returns Hono middleware function
 */
export function drizzleMiddleware() {
  return async (c: Context<AppEnv>, next: Next) => {
    const db = createDrizzleClient(c.env.DB);
    // @ts-expect-error - Middleware adds db to context
    c.set('db', db);
    await next();
  };
}

/**
 * Type helper for Drizzle DB instance
 * Export for use in service functions
 */
export type DB = ReturnType<typeof createDrizzleClient>;
