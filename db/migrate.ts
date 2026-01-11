/**
 * Database Migration Script with Drizzle ORM
 *
 * Applies pending migrations to the database.
 *
 * Usage:
 * - Local: npm run db:migrate:local
 * - Remote: npm run db:migrate:remote
 */

import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createClient } from '@libsql/client';

// Determine database URL based on environment
const isRemote = process.env.DATABASE_URL === 'remote';
const DATABASE_URL = isRemote
  ? process.env.CLOUDFLARE_D1_URL || ''
  : process.env.DATABASE_URL ||
    '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/d92f4d3dda6d00f0624e5f92a013bc9e140a3dfd7f2719743e3a6571bf66d016.sqlite';

async function runMigrations() {
  console.log('🔄 Running database migrations...');
  console.log(`📍 Target: ${isRemote ? 'Remote (Cloudflare D1)' : 'Local (SQLite)'}`);

  // Create database client
  const client = createClient({
    url: isRemote ? DATABASE_URL : `file:${DATABASE_URL}`,
  });

  const db = drizzle(client);

  try {
    // Run migrations
    await migrate(db, { migrationsFolder: './db/migrations' });

    console.log('✅ Migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.close();
  }
}

// Run migrations
runMigrations().catch((error) => {
  console.error(error);
  process.exit(1);
});
