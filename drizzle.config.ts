import type { Config } from 'drizzle-kit';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Drizzle Kit Configuration
 *
 * Manages database migrations and schema generation for Cloudflare D1.
 *
 * Commands:
 * - `drizzle-kit generate` - Generate migrations from schema changes
 * - `drizzle-kit push` - Push schema directly (development only)
 * - `drizzle-kit studio` - Launch Drizzle Studio GUI
 *
 * Environment:
 * - Local (default): Uses local SQLite file
 * - Remote: Set DATABASE_URL=remote (reads CLOUDFLARE_API_TOKEN from .dev.vars)
 *
 * Examples:
 * - Local:  npm run db:studio
 * - Remote: npm run db:studio:remote
 */

// Load .dev.vars for API token
function loadDevVars(): Record<string, string> {
  try {
    const content = readFileSync(resolve(process.cwd(), '.dev.vars'), 'utf-8');
    const vars: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          vars[key.trim()] = valueParts.join('=').trim();
        }
      }
    }
    return vars;
  } catch {
    return {};
  }
}

const devVars = loadDevVars();
const isRemote = process.env.DATABASE_URL === 'remote';

const localConfig = {
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'sqlite',
  verbose: true,
  strict: true,
  dbCredentials: {
    url: '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/d92f4d3dda6d00f0624e5f92a013bc9e140a3dfd7f2719743e3a6571bf66d016.sqlite',
  },
} satisfies Config;

const remoteConfig = {
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
  verbose: true,
  strict: true,
  dbCredentials: {
    accountId: 'c8ef3e696c565b7c13e0867d70d7b6b9',
    databaseId: '3eb45b23-733f-4ed1-9990-fbb1a9c82179',
    token: process.env.CLOUDFLARE_API_TOKEN || devVars.CLOUDFLARE_API_TOKEN || '',
  },
} satisfies Config;

export default isRemote ? remoteConfig : localConfig;
