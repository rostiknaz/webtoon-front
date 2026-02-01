# Likes System Architecture

> Scalable likes functionality for episodes, optimized for 500K-1M daily users on Cloudflare infrastructure.

## Table of Contents

- [Overview](#overview)
- [Research Findings](#research-findings)
- [System Architecture](#system-architecture)
- [Flow Diagrams](#flow-diagrams)
- [Database Schema](#database-schema)
- [KV Key Structure](#kv-key-structure)
- [Analytics Engine Schema](#analytics-engine-schema)
- [Cost Analysis](#cost-analysis)
- [Implementation Guide](#implementation-guide)
- [API Reference](#api-reference)

---

## Overview

This document describes the architecture for a high-performance likes system designed to handle:

- **500K - 1M daily active users**
- **100K+ likes per day**
- **5M+ like status reads per day**
- **Viral episodes with 500+ likes/second bursts**

### Design Principles

1. **Read-optimized**: 98% of operations are reads (checking like status/count)
2. **Eventually consistent**: Counts can lag by up to 60 seconds
3. **Deduplication guaranteed**: Users cannot like the same episode twice
4. **Cost-efficient**: Minimize D1 writes, maximize KV cache hits
5. **Burst-resilient**: Handle viral content without service degradation

---

## Research Findings

### Cloudflare Service Capabilities

| Service | Limits | Cost | Best For |
|---------|--------|------|----------|
| **D1** | ~1000 queries/sec, 10GB storage | $0.75/M reads, $1/M writes | Source of truth, ACID transactions |
| **KV** | **1 write/sec per key** (hard limit), unlimited reads | $0.50/M reads, $5/M writes | Read-heavy caching |
| **Analytics Engine** | 25 writes/request, auto-samples at high volume | Included in Workers Paid | High-cardinality event tracking |
| **Durable Objects** | Single-threaded per instance, strong consistency | $0.15/M requests | Per-entity coordination |

### Critical Constraints

1. **KV Write Limit**: 1 write/sec per key is a hard limit. A viral episode getting 100 likes/sec would fail if we used KV for counters directly.

2. **D1 Single-Threaded**: D1 processes queries sequentially. High write volume can cause latency spikes.

3. **Analytics Engine Sampling**: At very high volumes (>10K writes/sec), Analytics Engine automatically samples data. This is acceptable for analytics but not for source of truth.

4. **Durable Objects Singleton**: A single Durable Object instance is single-threaded. Using one global DO for all likes would create a bottleneck.

### Architecture Decision

Based on these constraints, we use a **hybrid approach**:

| Layer | Service | Purpose |
|-------|---------|---------|
| Source of Truth | D1 | `user_likes` table for deduplication |
| Read Cache | KV | Episode like counts (60s TTL) |
| Event Tracking | Analytics Engine | Non-blocking like events |
| Burst Handling | Durable Objects | Per-episode buffers for viral content |

---

## System Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE WORKER (Hono API)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ POST /like  │  │DELETE /like │  │ GET /like   │  │ POST /likes/batch   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼────────────────┼────────────────────┼────────────┘
          │                │                │                    │
          ▼                ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LIKES SERVICE LAYER                               │
│                                                                             │
│  ┌──────────────────┐    ┌──────────────────┐    ┌────────────────────────┐ │
│  │  Write Path      │    │  Read Path       │    │  Burst Detection       │ │
│  │  (like/unlike)   │    │  (get status)    │    │  (>100 likes/min)      │ │
│  └────────┬─────────┘    └────────┬─────────┘    └───────────┬────────────┘ │
└───────────┼───────────────────────┼──────────────────────────┼──────────────┘
            │                       │                          │
            ▼                       ▼                          ▼
┌───────────────────┐   ┌───────────────────┐   ┌─────────────────────────────┐
│        D1         │   │        KV         │   │     DURABLE OBJECT          │
│  (Source of Truth)│   │   (Read Cache)    │   │  (Per-Episode Buffer)       │
│                   │   │                   │   │                             │
│  ┌─────────────┐  │   │  ┌─────────────┐  │   │  ┌───────────────────────┐  │
│  │ user_likes  │  │   │  │ like:count: │  │   │  │ EpisodeLikeBuffer     │  │
│  │ episode_id  │  │   │  │ {episodeId} │  │   │  │                       │  │
│  │ user_id     │  │   │  └─────────────┘  │   │  │ - Batches writes      │  │
│  │ created_at  │  │   │                   │   │  │ - Flushes every 5s    │  │
│  └─────────────┘  │   │  ┌─────────────┐  │   │  │ - Updates D1 + KV     │  │
│                   │   │  │ like:user:  │  │   │  └───────────────────────┘  │
│  ┌─────────────┐  │   │  │ {odId}:{eId}│  │   │                             │
│  │ episodes    │  │   │  └─────────────┘  │   └─────────────────────────────┘
│  │ like_count  │  │   │                   │
│  └─────────────┘  │   └───────────────────┘
└───────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         ANALYTICS ENGINE                                   │
│                     (Non-blocking Event Tracking)                          │
│                                                                            │
│   writeDataPoint({                                                         │
│     blobs: [episodeId, eventType, seriesId],                              │
│     doubles: [timestamp],                                                  │
│     indexes: [userId]                                                      │
│   })                                                                       │
└───────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Consistency | Latency |
|-----------|---------------|-------------|---------|
| **D1 `user_likes`** | Deduplication, source of truth | Strong | 10-50ms |
| **D1 `episodes.like_count`** | Authoritative count | Strong | 10-50ms |
| **KV `like:count:*`** | Cached counts for reads | Eventual (60s) | 1-5ms |
| **KV `like:user:*`** | User's like status cache | Eventual (24h) | 1-5ms |
| **Analytics Engine** | Event tracking, analytics | Eventual | Non-blocking |
| **Durable Object** | Viral episode buffering | Strong (per-DO) | 5-20ms |

---

## Flow Diagrams

### Flow 1: Normal Like Operation (99% of cases)

```
User clicks "Like"
        │
        ▼
┌───────────────────┐
│ POST /api/episodes│
│ /:id/like         │
└─────────┬─────────┘
          │
          ▼
┌───────────────────────────────────────┐
│ 1. Check KV: like:user:{odId}:{eId}   │──── Cache HIT ────▶ Return 409 "Already liked"
└─────────┬─────────────────────────────┘
          │ Cache MISS
          ▼
┌───────────────────────────────────────┐
│ 2. D1: INSERT INTO user_likes         │
│    ON CONFLICT DO NOTHING             │──── Row exists ───▶ Return 409 "Already liked"
│    RETURNING *                        │
└─────────┬─────────────────────────────┘
          │ Insert success
          ▼
┌───────────────────────────────────────┐
│ 3. D1: UPDATE episodes                │
│    SET like_count = like_count + 1    │
│    WHERE id = :episodeId              │
└─────────┬─────────────────────────────┘
          │
          ▼
┌───────────────────────────────────────┐
│ 4. KV (async, non-blocking):          │
│    - SET like:user:{odId}:{eId} = 1   │
│    - DELETE like:count:{eId}          │  ◀── Invalidate count cache
└─────────┬─────────────────────────────┘
          │
          ▼
┌───────────────────────────────────────┐
│ 5. Analytics Engine (non-blocking):   │
│    writeDataPoint({ like event })     │
└─────────┬─────────────────────────────┘
          │
          ▼
   Return 200 { liked: true, count: N }
```

### Flow 2: Unlike Operation

```
User clicks "Unlike"
        │
        ▼
┌─────────────────────┐
│ DELETE /api/episodes│
│ /:id/like           │
└─────────┬───────────┘
          │
          ▼
┌───────────────────────────────────────┐
│ 1. D1: DELETE FROM user_likes         │
│    WHERE user_id = :odId              │──── No rows ──────▶ Return 404 "Not liked"
│      AND episode_id = :eId            │
│    RETURNING *                        │
└─────────┬─────────────────────────────┘
          │ Delete success
          ▼
┌───────────────────────────────────────┐
│ 2. D1: UPDATE episodes                │
│    SET like_count = MAX(0, like_count - 1) │
│    WHERE id = :episodeId              │
└─────────┬─────────────────────────────┘
          │
          ▼
┌───────────────────────────────────────┐
│ 3. KV (async, non-blocking):          │
│    - DELETE like:user:{odId}:{eId}    │
│    - DELETE like:count:{eId}          │
└─────────┬─────────────────────────────┘
          │
          ▼
┌───────────────────────────────────────┐
│ 4. Analytics Engine (non-blocking):   │
│    writeDataPoint({ unlike event })   │
└─────────┬─────────────────────────────┘
          │
          ▼
   Return 200 { liked: false, count: N }
```

### Flow 3: Read Like Status & Count

```
User loads episode page
        │
        ▼
┌────────────────────────┐
│ GET /api/episodes/:id  │
│     /like              │
└─────────┬──────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│ 1. Parallel KV reads:                       │
│    - like:user:{odId}:{eId} → userLiked     │
│    - like:count:{eId} → cachedCount         │
└─────────┬───────────────────────────────────┘
          │
          ├── Both HIT ──────────────────────▶ Return { liked, count }
          │
          ▼ Count MISS
┌─────────────────────────────────────────────┐
│ 2. D1: SELECT like_count FROM episodes      │
│        WHERE id = :episodeId                │
└─────────┬───────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│ 3. KV: SET like:count:{eId} with TTL 60s    │
└─────────┬───────────────────────────────────┘
          │
          ▼
   Return { liked: bool, count: number }
```

### Flow 4: Batch Read (Episode List)

```
User loads series page with 20 episodes
        │
        ▼
┌──────────────────────────┐
│ POST /api/episodes/likes │
│      /batch              │
│ Body: { episodeIds: [] } │
└─────────┬────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│ 1. KV: MGET like:count:{eId} for all IDs    │
│    KV: MGET like:user:{odId}:{eId} for all  │
└─────────┬───────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│ 2. For cache misses, batch D1 query:        │
│    SELECT id, like_count FROM episodes      │
│    WHERE id IN (:missingIds)                │
└─────────┬───────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│ 3. Update KV cache for misses (async)       │
└─────────┬───────────────────────────────────┘
          │
          ▼
   Return {
     likes: { [episodeId]: { liked, count } }
   }
```

### Flow 5: Viral Episode Burst (>100 likes/min)

```
Episode goes viral, 500 likes/sec incoming
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ Worker detects burst (check recent Analytics Engine data)     │
│ OR manual flag: episodes.is_viral = true                      │
└─────────┬─────────────────────────────────────────────────────┘
          │
          ▼
┌───────────────────────────────────────────────────────────────┐
│ Route likes to Durable Object: EpisodeLikeBuffer:{episodeId}  │
└─────────┬─────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DURABLE OBJECT: EpisodeLikeBuffer                        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ State:                                                              │    │
│  │   pendingLikes: Map<odId, { odId, timestamp }>                      │    │
│  │   pendingUnlikes: Set<odId>                                         │    │
│  │   bufferCount: number                                               │    │
│  │   lastFlush: number                                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ On like request:                                                    │    │
│  │   1. Check pendingLikes for duplicate → reject if exists            │    │
│  │   2. Add to pendingLikes (in-memory, instant)                       │    │
│  │   3. Increment bufferCount                                          │    │
│  │   4. Write to Analytics Engine (non-blocking)                       │    │
│  │   5. Return immediately with estimated count                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Alarm (every 5 seconds):                                            │    │
│  │   1. Batch INSERT into D1 user_likes (dedupe on conflict)           │    │
│  │   2. Get actual insert count from D1 response                       │    │
│  │   3. UPDATE episodes SET like_count = like_count + actualDelta      │    │
│  │   4. Update KV cache with new count                                 │    │
│  │   5. Clear pending buffers                                          │    │
│  │   6. If no activity for 5 min, mark episode as non-viral            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### D1 Schema

```sql
-- User likes table (deduplication)
CREATE TABLE IF NOT EXISTS user_likes (
  user_id TEXT NOT NULL,
  episode_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, episode_id)
);

-- Index for fetching user's liked episodes
CREATE INDEX IF NOT EXISTS idx_user_likes_user
  ON user_likes(user_id);

-- Index for fetching episode's likers (admin/analytics)
CREATE INDEX IF NOT EXISTS idx_user_likes_episode
  ON user_likes(episode_id);

-- Index for time-based queries (recent likes)
CREATE INDEX IF NOT EXISTS idx_user_likes_created
  ON user_likes(created_at DESC);

-- Add like_count column to episodes table
-- Run only if column doesn't exist
ALTER TABLE episodes ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0;

-- Add viral flag for burst detection
ALTER TABLE episodes ADD COLUMN is_viral INTEGER NOT NULL DEFAULT 0;
```

### Drizzle Schema Addition

```typescript
// db/schema.ts

export const userLikes = sqliteTable('user_likes', {
  odId: text('user_id').notNull(),
  episodeId: text('episode_id').notNull().references(() => episodes.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  pk: primaryKey({ columns: [table.odId, table.episodeId] }),
  userIdx: index('idx_user_likes_user').on(table.odId),
  episodeIdx: index('idx_user_likes_episode').on(table.episodeId),
  createdIdx: index('idx_user_likes_created').on(table.createdAt),
}));

// Add to episodes table
export const episodes = sqliteTable('episodes', {
  // ... existing fields
  likeCount: integer('like_count').notNull().default(0),
  isViral: integer('is_viral', { mode: 'boolean' }).notNull().default(false),
});
```

---

## KV Key Structure

| Key Pattern | Value Type | TTL | Purpose |
|-------------|------------|-----|---------|
| `like:count:{episodeId}` | `string` (number) | 60 seconds | Cached like count |
| `like:user:{odId}:{episodeId}` | `"1"` | 24 hours | User's like status |
| `like:viral:{episodeId}` | `"1"` | 5 minutes | Viral episode flag |

### Example Keys

```
like:count:ep_abc123          → "1547"
like:user:user_xyz:ep_abc123  → "1"
like:viral:ep_abc123          → "1"
```

### Cache Invalidation Strategy

| Event | Invalidate |
|-------|------------|
| Like | Delete `like:count:{eId}`, Set `like:user:{odId}:{eId}` |
| Unlike | Delete `like:count:{eId}`, Delete `like:user:{odId}:{eId}` |
| Batch flush (viral) | Update `like:count:{eId}` with new value |

---

## Analytics Engine Schema

### Dataset Configuration

```jsonc
// wrangler.jsonc
{
  "analytics_engine_datasets": [
    {
      "binding": "LIKE_EVENTS",
      "dataset": "like_events"
    }
  ]
}
```

### Event Structure

```typescript
interface LikeEvent {
  // Dimensions (filterable, up to 20 blobs)
  blobs: [
    string,  // blob1: episodeId
    string,  // blob2: eventType ('like' | 'unlike')
    string,  // blob3: seriesId
    string,  // blob4: userId (for fraud detection)
  ];

  // Metrics (aggregatable, up to 20 doubles)
  doubles: [
    number,  // double1: timestamp (Unix ms)
    number,  // double2: count (always 1)
  ];

  // Index for efficient queries
  indexes: [string];  // episodeId
}
```

### Writing Events

```typescript
// Non-blocking write - do not await
env.LIKE_EVENTS.writeDataPoint({
  blobs: [episodeId, 'like', seriesId, odId],
  doubles: [Date.now(), 1],
  indexes: [episodeId],
});
```

### Query Examples

```sql
-- Top liked episodes in last hour
SELECT
  blob1 AS episode_id,
  SUM(_sample_interval * double2) AS estimated_likes
FROM like_events
WHERE blob2 = 'like'
  AND timestamp > NOW() - INTERVAL '1' HOUR
GROUP BY blob1
ORDER BY estimated_likes DESC
LIMIT 10;

-- Detect viral episodes (>100 likes in 1 minute)
SELECT
  blob1 AS episode_id,
  COUNT(*) * _sample_interval AS like_rate
FROM like_events
WHERE blob2 = 'like'
  AND timestamp > NOW() - INTERVAL '1' MINUTE
GROUP BY blob1
HAVING like_rate > 100;

-- User activity (fraud detection)
SELECT
  blob4 AS user_id,
  COUNT(*) AS actions,
  COUNT(DISTINCT blob1) AS unique_episodes
FROM like_events
WHERE timestamp > NOW() - INTERVAL '1' HOUR
GROUP BY blob4
HAVING actions > 100;  -- Flag suspicious activity
```

---

## Cost Analysis

### Assumptions

| Metric | Value |
|--------|-------|
| Daily Active Users | 1,000,000 |
| Users who like (10%) | 100,000 |
| Likes per active liker | 3 |
| Total likes/day | 300,000 |
| Episode views/user | 5 |
| Like status checks/day | 5,000,000 |
| KV cache hit rate | 90% |

### Monthly Usage Projections

| Operation | Daily | Monthly |
|-----------|-------|---------|
| Likes | 300K | 9M |
| Unlikes (10% of likes) | 30K | 900K |
| Like status reads | 5M | 150M |
| D1 reads (10% cache miss) | 500K | 15M |

### Cost Breakdown

#### Without Caching (Baseline)

| Service | Operation | Volume/Month | Unit Cost | Monthly Cost |
|---------|-----------|--------------|-----------|--------------|
| D1 | Reads | 150M | $0.75/M | $112.50 |
| D1 | Writes | 10M | $1.00/M | $10.00 |
| | | | **Total** | **$122.50** |

#### With KV Caching (90% hit rate)

| Service | Operation | Volume/Month | Unit Cost | Monthly Cost |
|---------|-----------|--------------|-----------|--------------|
| D1 | Reads | 15M | $0.75/M | $11.25 |
| D1 | Writes | 10M | $1.00/M | $10.00 |
| KV | Reads | 150M | $0.50/M | $75.00 |
| KV | Writes | 10M | $5.00/M | $50.00 |
| Analytics Engine | Writes | 10M | Included | $0.00 |
| Durable Objects | Requests | 1M | $0.15/M | $0.15 |
| | | | **Total** | **$146.40** |

#### Optimized (Batch operations, longer TTLs)

| Service | Operation | Volume/Month | Unit Cost | Monthly Cost |
|---------|-----------|--------------|-----------|--------------|
| D1 | Reads | 10M | $0.75/M | $7.50 |
| D1 | Writes | 10M | $1.00/M | $10.00 |
| KV | Reads | 150M | $0.50/M | $75.00 |
| KV | Writes | 5M | $5.00/M | $25.00 |
| Analytics Engine | Writes | 10M | Included | $0.00 |
| Durable Objects | Requests | 500K | $0.15/M | $0.08 |
| | | | **Total** | **$117.58** |

### Cost Optimization Strategies

1. **Increase KV TTL**: 60s → 5min reduces D1 reads by 80%
2. **Batch reads**: Single D1 query for 20 episodes vs 20 queries
3. **Lazy count updates**: Update count every N likes instead of every like
4. **Analytics sampling**: Accept 1% sampling at very high volumes

---

## Implementation Guide

### Phase 1: Foundation (D1 + Basic API)

**Files to create/modify:**

1. `db/schema.ts` - Add `userLikes` table and `likeCount` column
2. `worker/db/services/likes.service.ts` - Database operations
3. `worker/routes/episodes.ts` - Add like/unlike endpoints

**Deliverables:**
- [ ] Database migration for `user_likes` table
- [ ] `likeEpisode(db, odId, episodeId)` service
- [ ] `unlikeEpisode(db, odId, episodeId)` service
- [ ] `getUserLikeStatus(db, odId, episodeId)` service
- [ ] `POST /api/episodes/:id/like` endpoint
- [ ] `DELETE /api/episodes/:id/like` endpoint
- [ ] `GET /api/episodes/:id/like` endpoint

### Phase 2: Caching Layer (KV)

**Files to create/modify:**

1. `worker/lib/cache.ts` - Add `LikesCache` class
2. `worker/routes/episodes.ts` - Integrate caching

**Deliverables:**
- [ ] `LikesCache.getLikeCount(episodeId)` method
- [ ] `LikesCache.setLikeCount(episodeId, count)` method
- [ ] `LikesCache.getUserLikeStatus(odId, episodeId)` method
- [ ] `LikesCache.setUserLikeStatus(odId, episodeId)` method
- [ ] `LikesCache.invalidate(odId, episodeId)` method
- [ ] Cache-first read pattern in endpoints
- [ ] `POST /api/episodes/likes/batch` endpoint

### Phase 3: Analytics Integration

**Files to create/modify:**

1. `wrangler.jsonc` - Add Analytics Engine binding
2. `worker/lib/analytics.ts` - Analytics helper
3. `worker/routes/episodes.ts` - Add event tracking

**Deliverables:**
- [ ] Analytics Engine dataset configuration
- [ ] `trackLikeEvent(episodeId, odId, eventType)` helper
- [ ] Non-blocking event writes in like/unlike handlers
- [ ] Admin endpoint for like analytics

### Phase 4: Viral Episode Handling (Optional)

**Files to create/modify:**

1. `worker/durable-objects/episode-like-buffer.ts` - Durable Object
2. `wrangler.jsonc` - Add Durable Object binding
3. `worker/routes/episodes.ts` - Route viral episodes to DO

**Deliverables:**
- [ ] `EpisodeLikeBuffer` Durable Object class
- [ ] Viral detection logic (via Analytics Engine query)
- [ ] Automatic routing for viral episodes
- [ ] Batch flush with alarm handler

---

## API Reference

### POST /api/episodes/:id/like

Like an episode.

**Authentication:** Required

**Parameters:**
- `id` (path): Episode ID

**Response:**
```json
{
  "success": true,
  "liked": true,
  "count": 1547
}
```

**Errors:**
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Episode not found
- `409 Conflict` - Already liked

---

### DELETE /api/episodes/:id/like

Unlike an episode.

**Authentication:** Required

**Parameters:**
- `id` (path): Episode ID

**Response:**
```json
{
  "success": true,
  "liked": false,
  "count": 1546
}
```

**Errors:**
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Episode not found or not liked

---

### GET /api/episodes/:id/like

Get like status and count for an episode.

**Authentication:** Optional (returns `liked: null` if not authenticated)

**Parameters:**
- `id` (path): Episode ID

**Response:**
```json
{
  "liked": true,
  "count": 1547
}
```

**Errors:**
- `404 Not Found` - Episode not found

---

### POST /api/episodes/likes/batch

Get like status and counts for multiple episodes.

**Authentication:** Optional

**Request Body:**
```json
{
  "episodeIds": ["ep_abc123", "ep_def456", "ep_ghi789"]
}
```

**Response:**
```json
{
  "likes": {
    "ep_abc123": { "liked": true, "count": 1547 },
    "ep_def456": { "liked": false, "count": 892 },
    "ep_ghi789": { "liked": null, "count": 2341 }
  }
}
```

**Limits:**
- Maximum 50 episode IDs per request

---

## Monitoring & Alerts

### Key Metrics to Track

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Like latency p99 | Workers Analytics | > 500ms |
| D1 query errors | Workers Logs | > 1% error rate |
| KV cache hit rate | Custom metric | < 80% |
| Viral episodes active | Analytics Engine | > 10 simultaneous |
| Duplicate like attempts | Analytics Engine | > 5% of requests |

### Dashboard Queries

```sql
-- Like operation latency
SELECT
  quantile(0.99, $workers.wallTimeMs) AS p99_latency,
  quantile(0.50, $workers.wallTimeMs) AS p50_latency
FROM workers
WHERE $metadata.trigger LIKE '%/like%'
  AND timestamp > NOW() - INTERVAL '1' HOUR;

-- Error rate by endpoint
SELECT
  $metadata.trigger,
  COUNT(*) AS total,
  SUM(CASE WHEN $workers.event.response.status >= 500 THEN 1 ELSE 0 END) AS errors
FROM workers
WHERE $metadata.trigger LIKE '%/like%'
  AND timestamp > NOW() - INTERVAL '1' HOUR
GROUP BY $metadata.trigger;
```

---

## Security Considerations

### Rate Limiting

- **Per-user**: 10 likes per minute
- **Per-IP**: 100 likes per minute (for unauthenticated bursts)
- **Global**: Circuit breaker at 10,000 likes/sec

### Fraud Prevention

1. **Duplicate detection**: Primary key constraint in D1
2. **Velocity checks**: Analytics Engine query for suspicious patterns
3. **Account age**: Require accounts > 24h old to like
4. **CAPTCHA**: Trigger on suspicious activity

### Data Privacy

- User like history is private by default
- Episode like counts are public
- Analytics data is aggregated, no PII in queries

---

## Algorithms & CS Patterns for High-Throughput Likes

This section describes the computer science algorithms and design patterns used to handle thousands of concurrent like/unlike operations per second without data loss or service degradation.

### Problem Statement

When thousands of users toggle likes within seconds:

```
1000 likes/sec → 1000 D1 writes/sec → D1 is single-threaded → queue overload
               → 1000 counter increments → race conditions (lost updates)
               → KV limit: 1 write/sec per key → can't update count cache
```

### Algorithm 1: Write Coalescing Buffer (Durable Object)

**CS Concept**: Batch processing / Write-behind cache

Instead of N individual writes, buffer them and flush as a single batch:

```
Individual writes:                  Write coalescing:
─────────────────                   ─────────────────
like → D1 write                     like ─┐
like → D1 write                     like ─┤
like → D1 write        vs          like ─┼─→ 1 batch D1 write (every 5s)
like → D1 write                     like ─┤
like → D1 write                     like ─┘

5 writes/sec                        1 write/5sec (250x reduction)
```

**Data structure**: `Map<userId, timestamp>` for O(1) deduplication in the Durable Object:

```typescript
class EpisodeLikeBuffer {
  pendingLikes = new Map<string, number>();   // userId → timestamp
  pendingUnlikes = new Set<string>();          // userId set

  async handleLike(userId: string): boolean {
    // O(1) duplicate check
    if (this.pendingLikes.has(userId)) return false;
    if (this.pendingUnlikes.has(userId)) {
      this.pendingUnlikes.delete(userId);  // Cancel pending unlike
    }
    this.pendingLikes.set(userId, Date.now());
    return true;
  }

  async flush() {
    // Single batch INSERT with ON CONFLICT DO NOTHING
    // Delta = actualInserted - pendingUnlikes.size
    // Single UPDATE episodes SET like_count += delta
  }
}
```

**Complexity**: O(1) per like, O(n) per flush (n = buffer size, bounded by flush interval)

### Algorithm 2: Sliding Window Counter for Rate Limiting

**CS Concept**: Sliding window log / Token bucket hybrid

```
Time windows:    [----60s window----]
User actions:    |||  ||  | ||| ||     = 12 actions
Limit:           10 per minute
Result:          Reject after 10th
```

Implementation using KV with fixed window buckets:

```typescript
// O(1) rate check
async function checkRateLimit(
  kv: KVNamespace,
  userId: string,
  limit = 10
): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 60000); // 1-minute window
  const key = `rate:like:${userId}:${bucket}`;

  const current = parseInt(await kv.get(key) ?? '0');
  if (current >= limit) return false;

  // Non-blocking increment with auto-expiry
  await kv.put(key, String(current + 1), { expirationTtl: 120 });
  return true;
}
```

**Complexity**: O(1) per check. TTL auto-cleans expired windows.

**Tradeoff**: Fixed window can allow 2x burst at window boundaries. Acceptable for likes since the consequence is just a few extra likes, not a security issue.

### Algorithm 3: CRDT-Inspired Counter (Grow-Only with Reconciliation)

**CS Concept**: Conflict-free Replicated Data Type (G-Counter)

The problem with `like_count = like_count + 1` under concurrency:

```
Thread A: reads count = 100
Thread B: reads count = 100
Thread A: writes count = 101
Thread B: writes count = 101  ← LOST UPDATE (should be 102)
```

**Solution**: Don't maintain a running counter. Derive it from the source of truth:

```sql
-- Instead of maintaining episodes.like_count via increment/decrement,
-- periodically reconcile from user_likes table:

UPDATE episodes
SET like_count = (SELECT COUNT(*) FROM user_likes WHERE episode_id = ?)
WHERE id = ?;
```

**When to reconcile**:
- On Durable Object flush (every 5s during viral periods)
- On cache miss (lazy reconciliation)
- Via scheduled cron (every 5 min for all episodes)

**Complexity**: O(k) where k = number of likes for that episode (indexed scan). With the index on `episode_id`, this is fast even for popular episodes.

**Tradeoff**: Slightly stale count (acceptable per eventual consistency design) but **zero lost updates**.

### Algorithm 4: Two-Level Cache (KV + Bloom Filter)

**CS Concept**: Bloom filter for probabilistic membership testing

For the "has user liked this episode?" check (most frequent operation at 5M reads/day):

```
Level 1 - KV Cache (current design):
  Key: like:user:{userId}:{episodeId}
  Hit rate: 90%+ with 24h TTL
  Cost: $0.50/M reads

Level 2 - Bloom Filter (future optimization at 10M+ DAU):
  Per-episode bloom filter stored in KV
  False positive rate: ~1% (still check D1 to confirm)
  False negative rate: 0% (guaranteed correct for "not liked")

  if bloomFilter.mayContain(userId):
    return d1.checkLike(userId, episodeId)  // Confirm positive
  else:
    return false  // Definitely not liked, skip D1
```

**Current recommendation**: KV per-user cache is sufficient at 500K-1M DAU. Bloom filters become cost-effective at 10M+ DAU when KV read volume exceeds 500M/month.

### Algorithm 5: Event Sourcing with CQRS

**CS Concept**: Command Query Responsibility Segregation

Separate the write model (optimized for throughput) from the read model (optimized for latency):

```
Write path (Command):
  User → Like → Analytics Engine (append-only event log, always succeeds)
             → Durable Object (buffer for batch processing)
             → D1 (batch flush, source of truth)

Read path (Query):
  User → KV cache (1-5ms, 90% hit rate)
       → D1 read replica (10-30ms fallback, nearest region)
```

Analytics Engine serves as the immutable event log. Every like/unlike is recorded first as an event, then state is derived from events. This guarantees:
- No event is lost (append-only)
- State can always be reconstructed
- Fraud detection via event pattern analysis

---

## Complexity Analysis

### Per-Operation Complexity

| Operation | Current | After Improvements |
|-----------|---------|-------------------|
| Like (write) | O(1) but unbounded D1 writes | O(1) to DO buffer, O(n) batch flush |
| Unlike (write) | O(1) D1 write | O(1) to DO buffer |
| Check liked (read) | O(1) D1 query every time | O(1) KV cache hit (90%), O(1) D1 fallback |
| Get count (read) | O(1) D1 query every time | O(1) KV cache (60s TTL) |
| Batch status (read) | N/A (missing) | O(1) KV + O(k) D1 for k cache misses |
| Rate check | N/A (missing) | O(1) KV lookup |

### Throughput Comparison

| Scenario | Current Capacity | After Improvements |
|----------|-----------------|-------------------|
| Normal load | ~1000 likes/sec (D1 limit) | ~1000 likes/sec (same, no bottleneck) |
| Viral episode | ~1000 likes/sec (degrades) | ~50,000 likes/sec (DO buffer) |
| Read load | ~1000 reads/sec (D1 bound) | Unlimited (KV cached) |
| Batch reads | N/A | Single query for 20+ episodes |

### Space Complexity

| Component | Memory Usage |
|-----------|-------------|
| DO buffer (per episode) | O(n) where n = likes in current 5s window |
| KV count cache | O(e) where e = number of episodes with activity |
| KV user status cache | O(u × e) where u = active users, e = liked episodes |
| Rate limit keys | O(u) per minute window, auto-expired via TTL |

---

## Data Flow After Improvements

### Normal Path (99% of traffic)

```
Like request
    │
    ├─ Rate limit check ──── O(1) KV ──── reject if exceeded
    │
    ├─ Dedup check ────────── O(1) KV ──── reject if already liked
    │
    ├─ D1 INSERT user_likes ─ O(1) ─────── ON CONFLICT DO NOTHING
    │
    ├─ D1 UPDATE count ────── O(1) ─────── atomic increment
    │
    ├─ KV update (async) ──── O(1) ─────── cache user status + invalidate count
    │
    └─ Analytics (async) ──── O(1) ─────── fire-and-forget event
```

### Viral Path (1% of traffic, 500+ likes/sec)

```
Like request
    │
    ├─ Rate limit check ──── O(1) KV
    │
    ├─ Route to Durable Object ──── O(1) per request
    │   │
    │   ├─ Dedup via Map.has() ──── O(1)
    │   ├─ Buffer in Map ────────── O(1)
    │   └─ Return estimated count ─ O(1)
    │
    └─ DO Alarm (every 5s):
        ├─ Batch INSERT ─────────── O(n) single query
        ├─ Reconcile count ──────── O(1) single COUNT(*) query
        └─ Update KV cache ──────── O(1)
```

---

## Implementation Priority

| # | Improvement | Algorithm/Pattern | Impact | Risk |
|---|-------------|-------------------|--------|------|
| 1 | Add auth to likes | Idempotent ops via PK constraint | Prevents duplicates | Low |
| 2 | KV cache layer | Cache-aside pattern, O(1) reads | 90% fewer D1 reads | Low |
| 3 | Batch read endpoint | Single D1 query for N episodes | O(n) → O(1) per page | Low |
| 4 | Rate limiting | Sliding window counter | Prevents abuse | Low |
| 5 | Write coalescing DO | Buffer + batch flush | 250x fewer D1 writes during viral | Medium |
| 6 | Count reconciliation | CRDT G-Counter pattern | Zero lost updates | Low |
| 7 | Analytics Engine | Event sourcing / CQRS | Trend/fraud detection | Low |
| 8 | Bloom filter | Probabilistic membership | KV cost reduction at 10M+ DAU | Low (future) |
