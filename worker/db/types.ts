/**
 * Extended context types with Drizzle ORM
 *
 * Extends Hono's context to include Drizzle database instance
 */

import type { DB } from './index';
import type { AppEnv as BaseAppEnv } from '../lib/types';
import type { Auth, Session, User } from 'better-auth';
import type { CacheLayer } from '../../lib/cache';

/**
 * Session data stored in context after auth middleware
 */
export interface SessionData {
  session: Session;
  user: User;
}

/**
 * Extended Hono environment with Drizzle instance
 *
 * Use this type in routes that need database access:
 * ```typescript
 * const app = new Hono<AppEnvWithDB>();
 * app.get('/users', (c) => {
 *   const db = c.get('db'); // Type-safe access to Drizzle
 *   const session = c.get('session'); // Type-safe session access
 *   const cache = c.get('cache'); // Type-safe cache access
 * });
 * ```
 */
export type AppEnvWithDB = {
  Bindings: BaseAppEnv['Bindings'];
  Variables: {
    db: DB;
    auth: Auth;
    session: SessionData | null;
    userId: string | null;
    cache: CacheLayer;
  };
};
