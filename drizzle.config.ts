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
 */
export default {
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'sqlite',
  // D1-specific configuration
  verbose: true,
  strict: true,
  // Database credentials for Drizzle Studio
  dbCredentials: {
    url: '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/d92f4d3dda6d00f0624e5f92a013bc9e140a3dfd7f2719743e3a6571bf66d016.sqlite',
  },
} satisfies Config;
