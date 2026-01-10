# Database Schema Documentation

This directory contains the database schema and migrations for the webtoon platform.

## Database: Cloudflare D1 (SQLite)

- **Database Name**: `webtoon-db`
- **Database ID**: `3eb45b23-733f-4ed1-9990-fbb1a9c82179`
- **Binding Name**: `DB` (used in Cloudflare Workers)

## Schema Overview

### Authentication Tables (Better Auth)

- **users** - User accounts
- **sessions** - Active user sessions
- **accounts** - Social auth provider accounts
- **verifications** - Email verification tokens

### Content Tables

- **series** - Webtoon series/shows
- **episodes** - Individual episodes with video content
- **user_likes** - User likes on episodes
- **watch_history** - User watch progress tracking

### Subscription Tables

- **plans** - Subscription plans (Solidgate products)
- **subscriptions** - User subscriptions
- **user_episode_access** - Granular episode access control
- **payment_transactions** - Payment history

### Webhook Tables

- **webhook_events** - Solidgate webhook events (for idempotency)

## Available Scripts

### Generate Migrations
```bash
npm run db:generate
```
Generates new migration files from schema changes.

### Apply Migrations

**Local Database (development):**
```bash
npm run db:migrate:local
```

**Remote Database (production):**
```bash
npm run db:migrate:remote
```

### Database Studio
```bash
npm run db:studio
```
Opens Drizzle Studio GUI for database visualization and management.

### Execute SQL Commands

**Local:**
```bash
npm run db:console:local "SELECT * FROM users"
```

**Remote:**
```bash
npm run db:console:remote "SELECT * FROM users"
```

## Schema Files

- **schema.ts** - Main schema definition
- **migrations/** - Generated SQL migration files

## Database Design Notes

### Timestamps
All timestamps use Unix epoch integers (seconds since 1970-01-01).

### Boolean Fields
SQLite doesn't have a native boolean type, so integers are used:
- `0` = false
- `1` = true

### Foreign Keys
- Cascade deletes are enabled for user-related data
- Subscription and episode access maintain referential integrity

### JSON Fields
Some fields store JSON for flexibility:
- `plans.features` - Feature flags per plan
- `payment_transactions.metadata` - Additional payment info

## Access Control Pattern

Episodes can be:
1. **Free** (`isPaid = false`) - Everyone can watch
2. **Paid** (`isPaid = true`) - Requires:
   - Active subscription with plan allowing access
   - OR explicit `user_episode_access` entry

Subscription plans control access via `features` JSON:
```json
{
  "episodeAccess": "all" | "first_3",
  "adFree": true
}
```

## Making Schema Changes

1. Edit `schema.ts`
2. Run `npm run db:generate` to create migration
3. Run `npm run db:migrate:local` to test locally
4. Run `npm run db:migrate:remote` to deploy to production

## Querying the Database

### Using Drizzle ORM (TypeScript)
```typescript
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

const db = drizzle(env.DB, { schema });

// Type-safe queries
const users = await db.select().from(schema.users);
```

### Using Raw SQL (Cloudflare Workers)
```typescript
const result = await env.DB
  .prepare('SELECT * FROM users WHERE email = ?')
  .bind(email)
  .first();
```

## Backup & Recovery

Cloudflare D1 automatically creates backups. To export manually:

```bash
wrangler d1 export webtoon-db --remote --output=backup.sql
```

To restore:

```bash
wrangler d1 execute webtoon-db --remote --file=backup.sql
```
