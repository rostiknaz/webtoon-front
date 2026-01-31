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

**Mobile Testing**: To properly emulate mobile devices in Playwright, always use "Toggle device toolbar" from the browser dev console (or device emulation with `isMobile: true, hasTouch: true`). Simply resizing the viewport does NOT trigger mobile CSS media queries like `(hover: none) and (pointer: coarse)`.

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
| `USER_SUBSCRIPTION` | 30 min | Subscription status |
| `SERIES_METADATA` | 24 hours | Series core data |
| `SERIES_EPISODES` | 6 hours | Episode lists |
| `SERIES_STATS` | 5 min | Views/likes counts |
| `SUBSCRIPTION_PLANS` | 7 days | Plan definitions |

### D1 Read Replication (Enabled 2026-01-24)
- **Primary**: EEUR (Eastern Europe)
- **Replicas**: 6 regions (WNAM, ENAM, WEUR, EEUR, APAC, OC)
- **Sessions API**: Enabled in `worker/db/index.ts` via `withSession()`
- Reads go to nearest replica (10-50ms), writes go to primary
- See `docs/DATABASE_SCALING_ANALYSIS.md` for full details

### D1 Read Patterns
High-frequency reads (served by replicas):
- `getSeriesById()` - series.service.ts
- `getSeriesEpisodes()` - series.service.ts
- `getSeriesStats()` - series.service.ts (2 parallel queries)
- `getActivePlans()` - plans.service.ts

Write operations (always go to primary):
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
```

**IMPORTANT**: Never use `npx wrangler deploy` directly when developing locally. Always commit and push changes to trigger the CI/CD pipeline for deployment.

## Git Conventions

- Do NOT include `Co-Authored-By: Claude` in commit messages
- Use imperative mood for commit messages (e.g., "Add feature" not "Added feature")
- Keep commits focused and atomic

## Code Quality Principles

Follow these CS fundamentals and design principles in ALL code written for this project. Code must be time/space efficient, extensible, well-organized, and readable.

### Big O Complexity Awareness

Always consider time and space complexity when writing code:

| Operation | Target | Avoid |
|-----------|--------|-------|
| Lookup by key | O(1) - Map/Set/Object | O(n) - Array.find() in hot paths |
| Search sorted data | O(log n) - Binary search | O(n) - Linear scan |
| Filtering/transforming | O(n) - Single pass | O(n²) - Nested loops on same data |
| Checking existence | O(1) - Set.has() | O(n) - Array.includes() in loops |
| Caching | O(1) amortized - LRU/Map | O(n) - Rebuilding on every access |

**Rules**:
- Prefer `Map` and `Set` over arrays for frequent lookups
- Use early returns to avoid unnecessary computation
- Avoid creating objects/arrays inside render loops or hot paths
- Use `WeakMap`/`WeakSet` for DOM-keyed caches (prevents memory leaks)
- Pre-compute derived data once, not on every access

### Data Structures - When to Use What

| Structure | Use When | Example in Project |
|-----------|----------|-------------------|
| **Map/Object** | Key-value lookup, O(1) access | `likedEpisodes` record, KV cache |
| **Set/WeakSet** | Tracking membership, deduplication | `playersWithEventsRef` (WeakSet) |
| **Array** | Ordered data, iteration, indexed access | `episodes[]` list |
| **LRU Cache** | Bounded memory with eviction | `VideoPlayerCacheContext` (max 5 players) |
| **Queue** | FIFO processing, rate limiting | Request queues, event buffering |
| **Stack** | LIFO, undo/redo, navigation history | Router history |

### Design Patterns to Apply

**Strategy Pattern** - Swap algorithms at runtime:
```typescript
// Example: Video format strategy
const VIDEO_FORMAT: VideoFormat = 'mp4' | 'hls';
// Player config changes based on format without conditionals everywhere
```

**Observer Pattern** - Decouple event producers from consumers:
```typescript
// Already used: xgplayer events (player.on('ended', ...))
// Already used: MutationObserver for DOM readiness
// Apply for: cross-component communication, cache invalidation
```

**Factory Pattern** - Centralize object creation:
```typescript
// Already used: createPlayerConfig() in VideoPlayerCacheContext
// Apply when: creating different player types, API clients, error objects
```

**Adapter Pattern** - Unify different interfaces:
```typescript
// Example: HLS.js plugin adapts HLS streams to look like native video
// Apply when: integrating third-party SDKs, normalizing API responses
```

**Decorator Pattern** - Add behavior without modifying originals:
```typescript
// Example: withSession() wraps D1 queries with session handling
// Apply for: logging, caching, auth wrappers, error handling
```

### SOLID Principles (Adapted for React/TypeScript)

| Principle | Meaning | Application |
|-----------|---------|-------------|
| **Single Responsibility** | One component/function = one job | `EpisodeSlide` handles display, `VideoPlayerCacheContext` handles caching |
| **Open/Closed** | Extend behavior without modifying | Use props/composition, not conditional branches for variants |
| **Liskov Substitution** | Subtypes must be substitutable | Consistent interfaces: all API services follow same error/response pattern |
| **Interface Segregation** | Don't force unused dependencies | Small focused hooks (`useDoubleTap`, `useHaptic`) not one mega hook |
| **Dependency Inversion** | Depend on abstractions | Context providers as interfaces, not direct imports of implementations |

### Code Organization Rules

1. **Extract when reused** - If logic appears in 2+ places, extract to a utility/hook
2. **Colocate related code** - Keep component + hook + types together
3. **Pure functions first** - Extract business logic into pure functions outside components
4. **Constants outside** - Static values, configs, and stable handlers outside component scope
5. **Minimize state** - Derive values from existing state instead of creating new state
6. **Prefer composition** - Small composable hooks/components over large monolithic ones

### Performance Patterns for This Project

- **Memoize expensive computations**: `useMemo` for derived data, `useCallback` for stable references
- **Lazy loading**: Split code at route level, defer non-critical imports
- **Debounce/throttle**: For scroll handlers, resize events, search inputs
- **Batch state updates**: Group related `setState` calls, use `useReducer` for complex state
- **Preload strategically**: Adjacent episodes loaded after current is ready (bandwidth priority)
- **Use `requestIdleCallback`**: For non-urgent work (preloading ep+2, analytics)
- **WeakRef for caches**: Allow GC to reclaim memory when needed

### Anti-Patterns to Avoid

- **O(n²) in render paths** - No nested `.find()` / `.filter()` / `.includes()` on arrays in loops
- **Prop drilling > 2 levels** - Use Context or composition instead
- **God components** - Max ~200 lines per component, extract if larger
- **Inline object/array literals in JSX** - Creates new references every render, breaks memoization
- **Synchronous heavy computation in event handlers** - Defer to `requestAnimationFrame` or `setTimeout`
- **Unbounded caches** - Always set max size (LRU pattern), use WeakMap/WeakSet for DOM references

## On-Demand Documentation

Read these files only when working on related features:

- **Database Scaling**: `docs/DATABASE_SCALING_ANALYSIS.md` - D1 read replication setup, scaling to 3-5M DAU, indexes, cache TTLs, Cloudflare services (Analytics Engine, Durable Objects)
- **Cloudflare Workers**: `.claude/docs/cloudflare-workers.md` - Detailed Workers patterns, Durable Objects, KV, D1, Queues, WebSockets, Agents
- **Subscription System**: `docs/subscription-architecture.md` - Cookie-based subscription flow
- **Likes System**: `docs/likes-architecture.md` - Scalable likes for episodes (D1, KV, Analytics Engine, Durable Objects)
- **Video Player**: `docs/video-player-architecture.md` - HybridVideoPlayer with LRU caching, priority loading, preloading strategy, long jump handling
- **R2 Video Streaming**: `docs/r2-video-streaming.md` - Self-hosted HLS architecture, R2 bucket structure, player optimization
- **Video Transcoding**: `docs/video-transcoding-workflow.md` - FFmpeg transcoding and R2 upload workflow
- **Video Posters**: `docs/video-poster-generation.md` - Poster/thumbnail generation to prevent black screens during loading
- **Edge Architecture**: `docs/cloudflare-edge-architecture.md` - How Cloudflare's edge network, V8 isolates, anycast routing, and D1 read replication work
