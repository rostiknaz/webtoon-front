# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Webtoon streaming platform with React frontend and Cloudflare Worker backend. Uses Hono for API routing, Better Auth for authentication, and Drizzle ORM with Cloudflare D1 (SQLite).

## Commands

### Development
```bash
npm run dev              # Start Vite dev server with Cloudflare Worker
```

### Build & Lint
```bash
npm run build            # TypeScript check + Vite production build
npm run lint             # ESLint
```

### Testing
```bash
npm run test             # Run all Playwright E2E tests
npm run test:mobile      # Run tests on Mobile Chrome only
npm run test:ui          # Interactive Playwright UI
npx playwright test --grep "test name"  # Run specific test
```

### Database
```bash
npm run db:generate      # Generate migrations from schema changes
npm run db:migrate:local # Apply migrations to local D1
npm run db:migrate:remote # Apply migrations to production D1
npm run db:studio        # Drizzle Studio (local)
npm run db:studio:remote # Drizzle Studio (production)
npm run db:seed:local    # Seed local database
```

## Architecture

### Monorepo Structure
- **Frontend**: React 19 + TanStack Router + TanStack Query in `src/`
- **Backend**: Cloudflare Worker with Hono in `worker/`
- **Database**: Drizzle ORM schema in `db/schema.ts`

### Request Flow
```
Browser → Cloudflare Worker → Hono Router
                ↓
        /api/* routes → D1 Database
        /* (other)   → Static assets (Vite build)
```

### Key Files
- `worker/index.ts` - Worker entry point, Hono app setup
- `worker/auth/index.ts` - Better Auth configuration
- `worker/routes/` - API route handlers
- `worker/db/services/` - Database service layer
- `src/routes/` - TanStack Router file-based routes
- `db/schema.ts` - Drizzle ORM schema (all tables)

### Authentication
Uses Better Auth with email/password and Google OAuth. Session stored in cookies. Subscription status uses signed cookies (HMAC-SHA256) for instant client-side access checks without API calls.

### Subscription Cookie System
- Server sets `webtoon.sub` cookie on login/subscribe with signed expiration
- Client reads cookie locally for instant subscription checks
- See `docs/subscription-architecture.md` for details

### Database Tables
- Auth: `users`, `sessions`, `accounts`, `verifications`
- Content: `series`, `episodes`
- Subscriptions: `plans`, `subscriptions`, `userEpisodeAccess`
- Payments: `webhookEvents`, `paymentTransactions`
- Activity: `userLikes`, `watchHistory`

### Environment Variables
Secrets in `.dev.vars` (local) or Wrangler secrets (production):
- `BETTER_AUTH_SECRET` - Auth session signing
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - OAuth
- `CLOUDFLARE_API_TOKEN` - For remote DB operations

### Cloudflare Bindings
- `DB` - D1 database
- `CACHE` - KV namespace for caching
- `SESSIONS` - KV namespace for sessions
- `ASSETS` - Static asset serving

## Observability

Workers Observability is enabled in `wrangler.jsonc` with 100% sampling rate. Data is retained for 7 days.

### Viewing Logs
```bash
npx wrangler tail webtoon-front --format json  # Real-time logs
```

### Key Metrics Available
- `$workers.wallTimeMs` - Total request time
- `$workers.cpuTimeMs` - CPU execution time
- `$workers.event.response.status` - HTTP status code
- `$metadata.trigger` - Endpoint (e.g., "GET /api/subscription/plans")

### Dashboard
View in [Cloudflare Dashboard](https://dash.cloudflare.com/?to=/:account/workers-and-pages/observability)

## Performance & Caching

### KV Cache TTLs (lib/cache.ts)
| Key | TTL | Purpose |
|-----|-----|---------|
| `SESSION` | 7 days | Auth sessions |
| `USER_SUBSCRIPTION` | 10 min | Subscription status |
| `SERIES_METADATA` | 24 hours | Series core data |
| `SERIES_EPISODES` | 6 hours | Episode lists |
| `SUBSCRIPTION_PLANS` | 7 days | Plan definitions |

### D1 Read Patterns
High-frequency reads (candidates for read replication):
- `getSeriesById()` - series.service.ts
- `getSeriesEpisodes()` - series.service.ts
- `getSeriesStats()` - series.service.ts (2 parallel queries)
- `getActivePlans()` - plans.service.ts

Write operations (must use primary):
- `incrementEpisodeLikes()` / `decrementEpisodeLikes()`
- Subscription inserts

Estimated read:write ratio ~44:1

## API Conventions

### Error Response Format
Server returns nested error objects:
```json
{ "error": { "code": "NOT_FOUND", "message": "Series not found" } }
```

Client-side parsing in `src/api.ts` handles both nested and flat error formats.

### Common Error Codes
- `NOT_FOUND` - Resource doesn't exist
- `ALREADY_SUBSCRIBED` - User already has active subscription (409)
- `UNAUTHORIZED` - Auth required
- `VALIDATION_ERROR` - Invalid input

## Troubleshooting

### KV/D1 Data Sync Issues
If session exists in KV but user missing from D1:
```bash
rm -rf .wrangler/state/v3/kv/miniflare-KVNamespaceObject/*.sqlite*
```

### Local Database Reset
```bash
npm run db:migrate:local && npm run db:seed:local
```

### Deploy to Production
```bash
git push  # CI/CD deploys automatically
# Or manually:
npx wrangler deploy
```

## Git Conventions

- Do NOT include `Co-Authored-By: Claude` in commit messages
- Use imperative mood for commit messages (e.g., "Add feature" not "Added feature")
- Keep commits focused and atomic

## On-Demand Documentation

Read these files only when working on related features:

- **Cloudflare Workers**: `.claude/docs/cloudflare-workers.md` - Detailed Workers patterns, Durable Objects, KV, D1, Queues, WebSockets, Agents
- **Subscription System**: `docs/subscription-architecture.md` - Cookie-based subscription flow
- **Likes System**: `docs/likes-architecture.md` - Scalable likes for episodes (D1, KV, Analytics Engine, Durable Objects)
