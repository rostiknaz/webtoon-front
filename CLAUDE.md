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
