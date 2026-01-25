# Webtoon

A video streaming platform for webtoon/anime content, built with React and deployed on Cloudflare's edge network.

## Features

- **Video Streaming** - Self-hosted HLS adaptive streaming via R2 (free egress)
- **Authentication** - Email/password and Google OAuth via Better Auth
- **Subscriptions** - Subscription plans with trial periods and instant access checks
- **Responsive UI** - Mobile-first TikTok-style vertical video player
- **Edge Deployment** - Globally distributed on Cloudflare Workers

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TanStack Router, TanStack Query |
| Backend | Cloudflare Workers, Hono |
| Database | Cloudflare D1 (SQLite), Drizzle ORM |
| Auth | Better Auth + better-auth-cloudflare |
| Payments | Solidgate (webhooks) |
| Styling | Tailwind CSS v4, Radix UI, shadcn/ui |
| Testing | Playwright |

## Prerequisites

- Node.js 20+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Cloudflare account (for deployment)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.dev.vars` file in the project root:

```env
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
CLOUDFLARE_API_TOKEN=your-api-token
```

### 3. Set up the database

```bash
# Generate migrations from schema
npm run db:generate

# Apply migrations to local D1
npm run db:migrate:local

# Seed with sample data
npm run db:seed:local
```

### 4. Start development server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

## Scripts

### Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with Cloudflare Worker |
| `npm run build` | TypeScript check + production build |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build locally |

### Database

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate migrations from schema changes |
| `npm run db:migrate:local` | Apply migrations to local D1 |
| `npm run db:migrate:remote` | Apply migrations to production D1 |
| `npm run db:studio` | Open Drizzle Studio (local) |
| `npm run db:studio:remote` | Open Drizzle Studio (production) |
| `npm run db:seed:local` | Seed local database |

### Testing

| Command | Description |
|---------|-------------|
| `npm run test` | Run all Playwright E2E tests |
| `npm run test:mobile` | Run tests on Mobile Chrome |
| `npm run test:ui` | Open Playwright interactive UI |

Run a specific test:
```bash
npx playwright test --grep "test name"
```

## Project Structure

```
webtoon-front/
├── src/                    # Frontend React application
│   ├── components/         # React components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities and client config
│   ├── routes/             # TanStack Router file-based routes
│   └── types.ts            # TypeScript types
├── worker/                 # Cloudflare Worker backend
│   ├── auth/               # Better Auth configuration
│   ├── db/                 # Database services
│   ├── lib/                # Backend utilities
│   ├── routes/             # Hono API routes
│   └── index.ts            # Worker entry point
├── db/                     # Database schema and migrations
│   ├── schema.ts           # Drizzle ORM schema
│   ├── migrations/         # SQL migrations
│   └── seed.sql            # Sample data
├── tests/                  # Playwright E2E tests
└── docs/                   # Architecture documentation
```

## Architecture

### Request Flow

```
Browser → Cloudflare Worker → Hono Router
                ↓
        /api/*  → D1 Database
        /*      → Static Assets
```

The Cloudflare Worker handles both API requests and serves the static React frontend. API routes are processed by Hono, while all other routes return the SPA for client-side routing.

### Authentication

Uses [Better Auth](https://www.better-auth.com/) with the [better-auth-cloudflare](https://github.com/zpg6/better-auth-cloudflare) adapter for:
- Email/password authentication
- Google OAuth
- Session management via cookies
- Rate limiting via Cloudflare KV

### Subscription System

Subscription status is stored in a signed cookie (HMAC-SHA256) for instant client-side access checks without API calls:

```
Login → Server sets signed cookie → Client reads locally → Instant decision
```

See [`docs/subscription-architecture.md`](docs/subscription-architecture.md) for details.

## Deployment

### Deploy to Cloudflare Workers

```bash
# Set production secrets
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET

# Apply database migrations
npm run db:migrate:remote

# Deploy
wrangler deploy
```

## Documentation

Detailed documentation for specific features:

| Topic | File | Description |
|-------|------|-------------|
| **Database Scaling** | [`docs/DATABASE_SCALING_ANALYSIS.md`](docs/DATABASE_SCALING_ANALYSIS.md) | D1 read replication, scaling to 3-5M DAU, indexes, cache TTLs |
| **Subscription System** | [`docs/subscription-architecture.md`](docs/subscription-architecture.md) | Cookie-based subscription flow |
| **Likes System** | [`docs/likes-architecture.md`](docs/likes-architecture.md) | Scalable likes for episodes (D1, KV, Analytics Engine) |
| **Video Player** | [`docs/video-player-architecture.md`](docs/video-player-architecture.md) | HybridVideoPlayer with LRU caching, priority loading, preloading |
| **R2 Video Streaming** | [`docs/r2-video-streaming.md`](docs/r2-video-streaming.md) | Self-hosted HLS architecture, R2 bucket structure |
| **Video Transcoding** | [`docs/video-transcoding-workflow.md`](docs/video-transcoding-workflow.md) | FFmpeg transcoding and R2 upload workflow |
| **Video Posters** | [`docs/video-poster-generation.md`](docs/video-poster-generation.md) | Poster/thumbnail generation for loading states |
| **HLS Streaming** | [`docs/HLS_ADAPTIVE_STREAMING.md`](docs/HLS_ADAPTIVE_STREAMING.md) | Adaptive bitrate streaming setup |
| **Secret Management** | [`docs/SECRET_MANAGEMENT.md`](docs/SECRET_MANAGEMENT.md) | Environment variables guide |

## License

Private - All rights reserved
