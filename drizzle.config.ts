import type { Config } from 'drizzle-kit';

/**
 * Drizzle Kit Configuration
 *
 * Manages database migrations and schema generation for Cloudflare D1.
 *
 * Commands:
 * - `drizzle-kit generate` - Generate migrations from schema changes
 * - `drizzle-kit migrate` - Apply migrations (use wrangler for D1)
 * - `drizzle-kit push` - Push schema directly (development only)
 * - `drizzle-kit studio` - Launch Drizzle Studio GUI
 *
 * Environment:
 * - Local (default): Uses local SQLite file
 * - Production: Set DATABASE_URL=remote and CLOUDFLARE_API_TOKEN
 *
 * Examples:
 * - Local:  npm run db:studio
 * - Remote: DATABASE_URL=remote CLOUDFLARE_API_TOKEN=xxx npm run db:studio
 */

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
    token: process.env.CLOUDFLARE_API_TOKEN!,
  },
} satisfies Config;

export default isRemote ? remoteConfig : localConfig;
