# Database Management with Drizzle ORM

This directory contains all database-related code for the webtoon platform, fully managed with Drizzle ORM.

## Directory Structure

```
db/
├── schema.ts              # Database schema definitions (single source of truth)
├── migrate.ts             # Migration runner script
├── seed.ts                # Database seeding script
├── migrations/            # Generated SQL migration files
│   ├── 0000_*.sql        # Migration files
│   └── meta/             # Migration metadata and journal
└── README.md             # This file
```

## Quick Start

### 1. Update Schema

Edit `schema.ts` to modify your database structure:

```typescript
export const myTable = sqliteTable('my_table', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  // ... more columns
});
```

### 2. Generate Migration

After updating the schema, generate a migration:

```bash
npm run db:generate
```

This creates a new SQL file in `db/migrations/` based on schema changes.

### 3. Apply Migration

Apply migrations to your database:

```bash
# Local development
npm run db:migrate:local

# Remote (Cloudflare D1)
npm run db:migrate:remote
```

### 4. Seed Database

Populate the database with initial data:

```bash
# Local development
npm run db:seed:local

# Remote (Cloudflare D1)
npm run db:seed:remote
```

---

## Available Commands

### Schema Management

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate migration from schema changes |
| `npm run db:push` | Push schema directly to DB (dev only, skips migrations) |
| `npm run db:studio` | Launch Drizzle Studio GUI for database browsing |

### Migrations

| Command | Description |
|---------|-------------|
| `npm run db:migrate:local` | Apply migrations to local D1 database |
| `npm run db:migrate:remote` | Apply migrations to remote D1 database |

### Seeding

| Command | Description |
|---------|-------------|
| `npm run db:seed:local` | Seed local database with sample data |
| `npm run db:seed:remote` | Seed remote database with sample data |

---

## Migration Workflow

### Development Workflow

1. **Modify Schema** - Edit `db/schema.ts`
2. **Generate Migration** - Run `npm run db:generate`
3. **Review Migration** - Check generated SQL in `db/migrations/`
4. **Apply Migration** - Run `npm run db:migrate:local`
5. **Test Changes** - Verify in your application

### Production Deployment

1. **Generate Migration** - On your dev machine
2. **Commit Migration** - Add to version control
3. **Deploy Application** - Push to production
4. **Apply Migration** - Run `npm run db:migrate:remote`

**⚠️ Important:** Always review generated migrations before applying to production!

---

## Best Practices

### ✅ DO:

- Always generate migrations for schema changes
- Review generated SQL before applying
- Test migrations on local database first
- Commit migration files to version control
- Use `.onConflictDoNothing()` in seeds for idempotency

### ❌ DON'T:

- Edit migration files manually (regenerate instead)
- Use `db:push` in production (it bypasses migrations)
- Delete old migration files
- Run migrations without backing up production data
- Modify schema without generating migrations

---

## Resources

- **Drizzle ORM Docs:** https://orm.drizzle.team/
- **Cloudflare D1 Docs:** https://developers.cloudflare.com/d1/
- **Schema Definition:** See `db/schema.ts` for examples
