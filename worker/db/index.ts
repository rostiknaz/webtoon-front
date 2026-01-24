/**
 * Drizzle ORM client initialization and middleware
 *
 * This module provides:
 * - Drizzle client factory for D1 database
 * - Hono middleware to inject Drizzle into request context
 *
 * READ REPLICATION:
 * Uses D1 Sessions API to benefit from read replication.
 * With read replication enabled, read queries can be served by
 * the nearest replica (10-50ms) instead of always hitting the
 * primary database (100-200ms for distant users).
 *
 * @see https://developers.cloudflare.com/d1/best-practices/read-replication/
 */

import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../../db/schema';
import type { Context, Next } from 'hono';
import type { AppEnv } from '../lib/types';

/**
 * Export schema for Better Auth adapter
 */
export { schema };

/**
 * Create Drizzle client from D1 binding or session
 *
 * Called per-request to ensure fresh connection.
 * Includes schema for relational queries and type inference.
 *
 * @param d1 - Cloudflare D1 database binding or session
 * @returns Drizzle database instance with schema
 */
export function createDrizzleClient(d1: D1Database): DrizzleD1Database<typeof schema> {
  return drizzle(d1, { schema });
}

/**
 * Middleware: Attach Drizzle instance to request context
 *
 * Uses D1 Sessions API for read replication support.
 * The session ensures sequential consistency - if you write data,
 * subsequent reads in the same request will see that write,
 * even if served by a read replica.
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
    // Use Sessions API for read replication support
    // withSession() returns a D1DatabaseSession that routes reads to replicas
    // while maintaining sequential consistency within the request
    const session = c.env.DB.withSession();
    const db = createDrizzleClient(session as unknown as D1Database);
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
