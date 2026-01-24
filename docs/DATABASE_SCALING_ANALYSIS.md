# Database Scaling Analysis: 3-5 Million DAU

> Comprehensive analysis and recommendations for scaling the webtoon platform database to handle 3-5 million daily active users.

---

## D1 Read Replication Setup (Completed: 2026-01-24)

### Configuration

| Setting | Value |
|---------|-------|
| Primary Region | EEUR (Eastern Europe) |
| Read Replication Mode | `auto` (enabled) |
| Read Replicas | 6 regions (WNAM, ENAM, WEUR, EEUR, APAC, OC) |
| Sessions API | Enabled in `worker/db/index.ts` |

### Implementation

The Sessions API is integrated in the Drizzle middleware (`worker/db/index.ts`):

```typescript
export function drizzleMiddleware() {
  return async (c: Context<AppEnv>, next: Next) => {
    // Use Sessions API for read replication support
    const session = c.env.DB.withSession();
    const db = createDrizzleClient(session as unknown as D1Database);
    c.set('db', db);
    await next();
  };
}
```

### How It Works

1. **Read queries** → Routed to nearest replica (10-50ms latency)
2. **Write queries** → Always go to primary in EEUR
3. **Sequential consistency** → Session bookmarks ensure reads after writes see latest data

### Latency Improvements

| User Location | Before (Primary Only) | After (Read Replicas) |
|---------------|----------------------|----------------------|
| Eastern Europe | ~20ms | ~20ms |
| Western Europe | ~50ms | ~20ms |
| US East | ~120ms | ~20ms |
| US West | ~150ms | ~25ms |
| Asia Pacific | ~200ms | ~30ms |
| Australia | ~180ms | ~25ms |

### Verification

```bash
# Check read replication status
npx wrangler d1 info webtoon-db

# Look for:
# read_replication.mode │ auto
```

### References

- [D1 Read Replication Docs](https://developers.cloudflare.com/d1/best-practices/read-replication/)
- [Sessions API](https://developers.cloudflare.com/d1/worker-api/d1-database/#withsession)

---

## Executive Summary

### Current State
- **Database**: Cloudflare D1 (SQLite-based)
- **Caching**: KV with TTL-based caching + lock patterns
- **Current Scale**: Development/Early production

### Key Findings

| Category | Status | Risk Level |
|----------|--------|------------|
| Index Coverage | Good (85%) | Medium |
| Like Counter Architecture | Critical Issue | High |
| Cache Configuration | Needs Tuning | Medium |
| D1 Storage Limits | Will Exceed 10GB | High |
| Read Replication | Not Enabled | Medium |

### Projected Load at 3-5M DAU

| Operation | Daily Volume | Peak RPS |
|-----------|--------------|----------|
| Series Metadata Reads | 50M | ~1,500 |
| Subscription Checks | 40M | ~1,200 |
| Episode Like/Unlike | 3M | ~100 |
| Watch History Updates | 15M | ~500 |
| Authentication | 5M | ~150 |

---

## Part 1: D1 Architecture Constraints

### D1 Fundamental Limits

From Cloudflare documentation:

| Limit | Value | Impact |
|-------|-------|--------|
| **Storage per DB** | 10 GB | Will exceed at scale |
| **Concurrency** | Single-threaded | Write bottleneck |
| **Query Throughput** | ~1,000 QPS (1ms queries) | Requires aggressive caching |

### Critical Constraint: Single-Threaded Writes

D1 databases are backed by Durable Objects, which are single-threaded. This means:

- If average query takes 1ms: ~1,000 queries/second
- If average query takes 10ms: ~100 queries/second

**Impact on your app**: Episode like counters (`UPDATE episodes SET likes = likes + 1`) will bottleneck at ~500-1,000 writes/second.

At 3M likes/day = ~35 likes/second average, but **viral episodes can spike to 500+ likes/second**.

---

## Part 2: Missing Indexes (Critical)

### Currently Missing

```sql
-- 1. User email lookup (OAuth critical path)
-- Used by: findUserByEmail() in payment.service.ts
-- Impact: Every OAuth login, account lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Subscription ordering for fresh lookups
-- Used by: getUserSubscription() with ORDER BY createdAt DESC
-- Impact: Subscription checks on cache miss
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_created
  ON subscriptions(user_id, created_at DESC);

-- 3. Session expiration cleanup
-- Used by: Background session cleanup jobs
-- Impact: Expired session queries
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
  ON sessions(expires_at);

-- 4. Webhook audit trail
-- Used by: Compliance queries, debugging
-- Impact: Webhook history lookups
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at
  ON webhook_events(processed_at);

-- 5. Episode publication queries
-- Used by: "Get published episodes for series"
-- Impact: Content management, series pages
CREATE INDEX IF NOT EXISTS idx_episodes_serial_published
  ON episodes(serial_id, published_at DESC);
```

### Migration File to Add

**File: `db/migrations/0002_scaling_indexes.sql`**

```sql
-- Scaling indexes for 3-5M DAU
-- These indexes support high-traffic query patterns

-- User email lookup for OAuth (implicit unique index may exist, explicit is clearer)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Subscription ordering optimization
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_created
  ON subscriptions(user_id, created_at DESC);

-- Session cleanup optimization
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Webhook audit trail
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at
  ON webhook_events(processed_at);

-- Episode publication ordering
CREATE INDEX IF NOT EXISTS idx_episodes_serial_published
  ON episodes(serial_id, published_at DESC);
```

---

## Part 3: D1 Read Replication (Recommended)

### What It Does

D1 Read Replication creates read-only copies in multiple regions:
- WNAM (Western North America)
- ENAM (Eastern North America)
- WEUR (Western Europe)
- EEUR (Eastern Europe)
- APAC (Asia Pacific)
- OC (Oceania)

### How to Enable

In `wrangler.jsonc`:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "webtoon-db",
      "database_id": "3eb45b23-733f-4ed1-9990-fbb1a9c82179",
      "read_replication": true  // Add this
    }
  ]
}
```

### Session API for Consistency

For read-after-write consistency (important for subscriptions):

```typescript
// worker/index.ts
const session = env.DB.withSession();

// Write operation
await session.exec(`UPDATE subscriptions SET status = 'active' WHERE id = ?`, [subId]);

// Immediately read with session - guaranteed to see write
const result = await session.exec(`SELECT * FROM subscriptions WHERE id = ?`, [subId]);
```

### Benefits at Scale

| Without Replication | With Replication |
|---------------------|------------------|
| All queries go to Primary (single region) | Reads go to nearest replica |
| 50-200ms latency for distant users | 10-50ms latency globally |
| Single point of failure | Regional redundancy |

**Cost**: Same as without replication (included in D1 pricing)

---

## Part 4: Cache TTL Optimization

### Current vs Recommended TTLs

| Cache Key | Current TTL | Recommended | Reasoning |
|-----------|-------------|-------------|-----------|
| `USER_SUBSCRIPTION` | 10 min | **30 min** | Subscriptions change rarely |
| `SERIES_METADATA` | 24 hours | 24 hours | Good |
| `SERIES_EPISODES` | 6 hours | 6 hours | Good |
| `SUBSCRIPTION_PLANS` | 7 days | 7 days | Good |
| Series Stats | 1 min | **5 min** | Users don't need real-time |

### Update `lib/cache.ts`

```typescript
export const CACHE_TTL = {
  SESSION: 60 * 60 * 24 * 7,        // 7 days
  USER_SUBSCRIPTION: 60 * 30,       // 30 minutes (was 10)
  USER_PROFILE: 60 * 60,            // 1 hour
  SERIES_METADATA: 60 * 60 * 24,    // 1 day
  SERIES_EPISODES: 60 * 60 * 6,     // 6 hours
  SERIES_STATS: 60 * 5,             // 5 minutes (add this)
  SUBSCRIPTION_PLANS: 60 * 60 * 24 * 7, // 1 week
  HOMEPAGE_DATA: 60 * 30,           // 30 minutes
} as const;
```

### Impact

| Metric | Before | After |
|--------|--------|-------|
| Subscription cache misses/day | ~4M | ~1.3M (-67%) |
| Stats DB queries/day | ~1.4M | ~280K (-80%) |
| D1 read load | High | Moderate |

---

## Part 5: Like Counter Architecture (Critical Fix)

### The Problem

Current implementation:
```typescript
// episodes.ts
UPDATE episodes SET likes = likes + 1 WHERE id = ?
```

**Issues at 3-5M DAU**:
1. SQLite write lock contention
2. Viral episodes spike to 500+ likes/second
3. D1 single-threaded = max ~1,000 writes/second for entire DB

### Recommended Architecture

Use the hybrid approach from `docs/likes-architecture.md`:

```
Normal Traffic (99%):
  Client --> D1 (writes) --> KV (cache)

Viral Burst (1%):
  Client --> Durable Object (per-episode buffer) --> D1 (batch) --> KV

Analytics (all):
  Client --> Analytics Engine (non-blocking)
```

### Implementation Priority

1. **Phase 1**: Add Analytics Engine for event tracking (non-blocking)
2. **Phase 2**: Implement KV caching for like counts
3. **Phase 3**: Add Durable Object buffer for viral detection

### Wrangler Configuration

```jsonc
{
  // Add Analytics Engine
  "analytics_engine_datasets": [
    {
      "binding": "LIKE_EVENTS",
      "dataset": "like_events"
    }
  ],

  // Add Durable Object for viral handling
  "durable_objects": {
    "bindings": [
      {
        "name": "EPISODE_LIKE_BUFFER",
        "class_name": "EpisodeLikeBuffer"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_classes": ["EpisodeLikeBuffer"]
    }
  ]
}
```

---

## Part 6: Storage Growth Projections

### Data Size at 3-5M DAU

| Table | Rows (Est.) | Size | Growth Rate |
|-------|-------------|------|-------------|
| users | 3-5M | 300-500 MB | +500K/month |
| watch_history | 50-100M | 5-10 GB | +15M/month |
| user_likes | 100-500M | 10-20 GB | +10M/month |
| webhook_events | 365M/year | 40-80 GB | +1-2M/day |
| subscriptions | 500K active | 50 MB | +100K/month |
| sessions | 10-20M | 2-4 GB | Fluctuates |
| **TOTAL** | ~1.5B | **60-120 GB** | - |

### D1 Limit: 10 GB per Database

**You will exceed this limit within 6-12 months at scale.**

### Recommended Sharding Strategy

#### Option A: Functional Sharding (Recommended)

Split into multiple D1 databases:

```
webtoon-auth-db (D1)
├── users
├── sessions
├── accounts
└── verifications
Size: ~1 GB

webtoon-content-db (D1)
├── series
├── episodes
└── (read replicas enabled)
Size: ~100 MB

webtoon-subscriptions-db (D1)
├── plans
├── subscriptions
├── payment_transactions
└── webhook_events (recent 90 days)
Size: ~2 GB

webtoon-activity-db (D1)
├── watch_history
├── user_likes
└── user_episode_access
Size: ~8 GB (rotate old data to R2)

R2 (Archive)
├── webhook_events_archive/
└── watch_history_archive/
```

#### Option B: Time-Based Archival

Archive old data to R2:
- Webhook events > 90 days to R2
- Watch history > 1 year to R2
- Keep hot data in D1

---

## Part 7: Cloudflare Services Integration

### Services to Add

| Service | Use Case | Cost at Scale |
|---------|----------|---------------|
| **D1 Read Replication** | Global read performance | Included |
| **Analytics Engine** | Like/view event tracking | Included in Workers Paid |
| **Durable Objects** | Viral episode buffering | ~$150/month |
| **Queues** | Async webhook processing | ~$50/month |
| **R2** | Data archival | ~$15/month per 100GB |

### Analytics Engine Setup

```typescript
// worker/lib/analytics.ts
export function trackLikeEvent(
  env: Env,
  episodeId: string,
  userId: string,
  eventType: 'like' | 'unlike'
) {
  // Non-blocking write - do not await
  env.LIKE_EVENTS.writeDataPoint({
    blobs: [episodeId, eventType, userId],
    doubles: [Date.now(), 1],
    indexes: [episodeId], // Sampling key
  });
}

// Usage in route handler
app.post('/api/episodes/:id/like', async (c) => {
  const episodeId = c.req.param('id');
  const userId = c.get('userId');

  // ... D1 write logic ...

  // Track event (non-blocking)
  trackLikeEvent(c.env, episodeId, userId, 'like');

  return c.json({ success: true });
});
```

### Query Analytics Data

```sql
-- Top liked episodes in last hour
SELECT
  blob1 AS episode_id,
  SUM(_sample_interval) AS estimated_likes
FROM like_events
WHERE blob2 = 'like'
  AND timestamp > NOW() - INTERVAL '1' HOUR
GROUP BY blob1
ORDER BY estimated_likes DESC
LIMIT 10;
```

---

## Part 8: Implementation Roadmap

### Phase 1: Quick Wins (Week 1)

- [ ] Add missing indexes (migration file)
- [ ] Increase cache TTLs (code change)
- [ ] Enable D1 read replication (wrangler config)

**Effort**: 1 day
**Impact**: 30-50% reduction in DB load

### Phase 2: Observability (Week 2)

- [ ] Add Analytics Engine binding
- [ ] Implement `trackLikeEvent()` helper
- [ ] Add non-blocking event tracking to like/unlike routes
- [ ] Create monitoring dashboard queries

**Effort**: 2-3 days
**Impact**: Visibility into actual usage patterns

### Phase 3: Like Architecture (Week 3-4)

- [ ] Implement KV caching for like counts
- [ ] Create Durable Object for viral episode buffering
- [ ] Implement burst detection logic
- [ ] Add batch like status endpoint

**Effort**: 1-2 weeks
**Impact**: 10x improvement in like operation capacity

### Phase 4: Database Sharding (Month 2)

- [ ] Design schema for split databases
- [ ] Create new D1 instances
- [ ] Migrate data with zero downtime
- [ ] Update bindings and service layer

**Effort**: 2-3 weeks
**Impact**: Removes 10GB storage limit

### Phase 5: Archival Strategy (Month 3)

- [ ] Implement R2 archival for old webhook events
- [ ] Implement watch history rotation
- [ ] Create retrieval API for archived data

**Effort**: 1 week
**Impact**: Long-term storage sustainability

---

## Part 9: Cost Projections

### At 3-5M DAU (Monthly)

| Service | Usage | Cost |
|---------|-------|------|
| D1 Reads | 500M rows | $375 |
| D1 Writes | 50M rows | $50 |
| KV Reads | 1B | $500 |
| KV Writes | 100M | $500 |
| Durable Objects | 10M requests | $1.50 |
| Analytics Engine | Included | $0 |
| Workers | 100M requests | Included |
| **Total** | | **~$1,400/month** |

### With Optimizations

| Optimization | Savings |
|--------------|---------|
| Extended cache TTLs | -40% D1 reads |
| Read replication | -30% latency (no cost) |
| Like batching | -80% like writes |
| **Optimized Total** | **~$800/month** |

---

## Summary: Priority Actions

### Immediate (This Week)

1. **Add missing indexes** - Create `0002_scaling_indexes.sql`
2. **Extend cache TTLs** - Update `lib/cache.ts`
3. **Enable read replication** - Update `wrangler.jsonc`

### Short-Term (Next 2 Weeks)

4. **Add Analytics Engine** - Configure binding, implement tracking
5. **Implement like caching** - KV layer for counts

### Medium-Term (Next Month)

6. **Durable Objects for viral** - Per-episode buffers
7. **Plan database sharding** - Design split architecture

### Long-Term (Quarter)

8. **Execute sharding** - Split into functional databases
9. **Implement archival** - R2 for old data

---

## References

- [D1 Read Replication](https://developers.cloudflare.com/d1/best-practices/read-replication/)
- [D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Durable Objects Counter Example](https://developers.cloudflare.com/durable-objects/examples/build-a-counter/)
- [Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)
- [Worker Storage Options](https://developers.cloudflare.com/workers/platform/storage-options/)
