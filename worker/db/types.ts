/**
 * Extended context types with Drizzle ORM
 *
 * Extends Hono's context to include Drizzle database instance
 */

import type { DB } from './index';
import type { AppEnv as BaseAppEnv } from '../lib/types';
import type { Auth } from 'better-auth';

/**
 * Extended Hono environment with Drizzle instance
 *
 * Use this type in routes that need database access:
 * ```typescript
 * const app = new Hono<AppEnvWithDB>();
 * app.get('/users', (c) => {
 *   const db = c.get('db'); // Type-safe access to Drizzle
 * });
 * ```
 */
export type AppEnvWithDB = {
  Bindings: BaseAppEnv['Bindings'];
  Variables: {
    db: DB;
    auth: Auth;
  };
};
