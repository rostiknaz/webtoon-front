# Session Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SESSION ARCHITECTURE                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER (Client)                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                            COOKIES                                        │   │
│  ├──────────────────────────────────────────────────────────────────────────┤   │
│  │  webtoon.session_token    │ HttpOnly │ 7 days │ Session ID (secure)      │   │
│  │  webtoon.session_data     │ Readable │ 5 min  │ Cached user info (fast)  │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                           │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                         React Query Cache                                 │   │
│  │  staleTime: 5 min  │  refetchOnWindowFocus: false                        │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                           │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │  useOptimizedSession Hook                                                 │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │   │
│  │  │ if (!hasCookie('webtoon.session_data')) return null  // No API call │  │   │
│  │  │ else → fetch('/api/auth/get-session')                              │  │   │
│  │  └────────────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ HTTPS Request + Cookies
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE EDGE (Workers)                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                     Session Middleware (per request)                      │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │   │
│  │  │ 1. Parse webtoon.session_token from cookies                        │  │   │
│  │  │ 2. Call auth.api.getSession() ONCE                                 │  │   │
│  │  │ 3. Store in Hono context: c.set('session', session)                │  │   │
│  │  │ 4. Routes access via c.get('session') (no re-fetch)                │  │   │
│  │  └────────────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                           │
│                    ┌─────────────────┴─────────────────┐                        │
│                    ▼                                   ▼                        │
│  ┌─────────────────────────────┐     ┌─────────────────────────────┐            │
│  │      KV: SESSIONS           │     │      KV: CACHE              │            │
│  │  (Better Auth internal)     │     │  (Subscription cache)       │            │
│  ├─────────────────────────────┤     ├─────────────────────────────┤            │
│  │  Token → Session Data       │     │  user_sub:{id} → SubData    │            │
│  │  TTL: 7 days                │     │  TTL: 10 min                │            │
│  └─────────────────────────────┘     └─────────────────────────────┘            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ D1 Query (if KV miss)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            CLOUDFLARE D1 (SQLite)                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                          sessions table                                   │   │
│  ├──────────────────────────────────────────────────────────────────────────┤   │
│  │  id          │ text PK     │ UUID session identifier                     │   │
│  │  user_id     │ text FK     │ → users.id (CASCADE DELETE)                 │   │
│  │  token       │ text UNIQUE │ Session token (indexed for lookup)          │   │
│  │  expires_at  │ integer     │ Unix timestamp when session expires         │   │
│  │  ip_address  │ text        │ Client IP for security audit                │   │
│  │  user_agent  │ text        │ Browser info for security audit             │   │
│  │  created_at  │ integer     │ Session creation time                       │   │
│  │  updated_at  │ integer     │ Last activity/refresh time                  │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                           users table                                     │   │
│  ├──────────────────────────────────────────────────────────────────────────┤   │
│  │  id, email, name, image, email_verified, created_at, updated_at          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Session Lifecycle Flows

### Login Flow

```
  User                    Worker                      D1                    KV
   │                        │                         │                      │
   │ POST /auth/sign-in     │                         │                      │
   │ {email, password}      │                         │                      │
   │───────────────────────►│                         │                      │
   │                        │                         │                      │
   │                        │ Verify password (PBKDF2)│                      │
   │                        │────────────────────────►│                      │
   │                        │                         │                      │
   │                        │ INSERT session          │                      │
   │                        │ expires_at = now + 7d   │                      │
   │                        │────────────────────────►│                      │
   │                        │                         │                      │
   │                        │ Cache session token     │                      │
   │                        │─────────────────────────────────────────────►│
   │                        │                         │                      │
   │ Set-Cookie:            │                         │                      │
   │ webtoon.session_token  │                         │                      │
   │ webtoon.session_data   │                         │                      │
   │◄───────────────────────│                         │                      │
   │                        │                         │                      │
```

### Authenticated Request Flow

```
  Browser                 Worker Middleware            KV                   D1
   │                            │                      │                     │
   │ GET /api/series/123        │                      │                     │
   │ Cookie: session_token      │                      │                     │
   │───────────────────────────►│                      │                     │
   │                            │                      │                     │
   │                            │ Lookup token in KV   │                     │
   │                            │─────────────────────►│                     │
   │                            │                      │                     │
   │                            │      ┌───────────────┴──────────────┐      │
   │                            │      │                              │      │
   │                            │   HIT│                           MISS│     │
   │                            │◄─────┘                              │      │
   │                            │                                     │      │
   │                            │ Query D1 sessions table             │      │
   │                            │ WHERE token = ? AND expires_at > now│      │
   │                            │─────────────────────────────────────────►│
   │                            │                                     │      │
   │                            │◄────────────────────────────────────────│
   │                            │                      │                     │
   │                            │ c.set('session')     │                     │
   │                            │ c.set('userId')      │                     │
   │                            │                      │                     │
   │                            │ Execute route handler│                     │
   │                            │ (uses cached session)│                     │
   │                            │                      │                     │
   │ JSON Response              │                      │                     │
   │◄───────────────────────────│                      │                     │
```

### Session Refresh Flow

```
  Config:  expiresIn = 7 days  │  updateAge = 1 day

  Day 0: Session created (expires Day 7)
         │
  Day 1: Request → session valid, no refresh needed
         │
  Day 2: Request → session > 1 day old → REFRESH TRIGGERED
         │
         └──► New token generated
             Old token invalidated
             New expires_at = now + 7 days (Day 9)
             New cookies sent to browser
```

### Logout Flow

```
  User                    Worker                      D1                    KV
   │                        │                         │                      │
   │ POST /auth/sign-out    │                         │                      │
   │───────────────────────►│                         │                      │
   │                        │                         │                      │
   │                        │ DELETE FROM sessions    │                      │
   │                        │ WHERE token = ?         │                      │
   │                        │────────────────────────►│                      │
   │                        │                         │                      │
   │                        │ Delete KV cache         │                      │
   │                        │─────────────────────────────────────────────►│
   │                        │                         │                      │
   │ Set-Cookie:            │                         │                      │
   │ max-age=0 (delete)     │                         │                      │
   │◄───────────────────────│                         │                      │
```

### Expiration Flow

```
  Day 7+ (session expired)

  Browser                 Worker                      D1
   │                        │                         │
   │ GET /api/protected     │                         │
   │ Cookie: session_token  │                         │
   │───────────────────────►│                         │
   │                        │                         │
   │                        │ SELECT * FROM sessions  │
   │                        │ WHERE token = ?         │
   │                        │────────────────────────►│
   │                        │                         │
   │                        │ expires_at < now()      │
   │                        │ → SESSION INVALID       │
   │                        │◄────────────────────────│
   │                        │                         │
   │ Set-Cookie: max-age=0  │                         │
   │ 401 Unauthorized       │                         │
   │◄───────────────────────│                         │
```

## Key Configuration

### Better Auth (`worker/auth/index.ts`)

```typescript
session: {
  expiresIn: 60 * 60 * 24 * 7,    // 7 days - session lifetime
  updateAge: 60 * 60 * 24,        // 1 day  - refresh if older
  cookieCache: {
    enabled: true,
    maxAge: 60 * 5,               // 5 min  - client-side cache
  }
}

advanced: {
  cookiePrefix: 'webtoon',
  defaultCookieAttributes: {
    sameSite: 'lax',              // Required for OAuth redirects
    httpOnly: true,               // Prevent XSS access
    secure: isHttps,              // HTTPS only in production
    path: '/',
  }
}
```

### Password Hashing

PBKDF2 with 100,000 iterations (SHA-256). Scrypt disabled due to Cloudflare Worker CPU limits.

## TTL Summary

| Layer | TTL | Purpose |
|-------|-----|---------|
| D1 Session | 7 days | Source of truth |
| KV Session Cache | 7 days | Reduce D1 reads |
| Cookie (HttpOnly) | 7 days | Browser persistence |
| Cookie Cache | 5 min | Client-side optimization |
| React Query | 5 min | Avoid redundant fetches |
| Subscription Cache | 10 min | Access control freshness |
