# Cloudflare Primitives: Durable Objects & Analytics Engine

Simple explanations of key Cloudflare services used in our scaling architecture.

---

## Durable Objects — Simple Explanation

Think of a regular Cloudflare Worker as a **stateless function** — it runs, handles a request, and forgets everything. A Durable Object is a **stateful object** that remembers things between requests.

### Key properties

- **Globally unique** — each Durable Object has a unique ID. No matter where in the world a request comes from, the same ID always reaches the same object instance.
- **Single-threaded** — only one request at a time can execute inside a given object. No race conditions, no locks needed. If 1,000 users like the same episode at once, the Durable Object processes them one by one in order.
- **Persistent storage** — each object has its own embedded storage (up to 1GB, expanding to 10GB). Data survives between requests and even restarts. Supports both key-value and SQLite APIs.
- **Lives close to users** — created near the first request that uses it, hibernates when idle, wakes up on demand.

### Real-world analogy

A Worker is like a cashier who forgets you after each transaction. A Durable Object is like a personal banker who remembers your account, keeps your balance, and only talks to one customer at a time so no money gets lost.

### Use cases for our app

| Use Case | How |
|----------|-----|
| Like counter for viral episode | One DO per episode, buffers likes in memory, flushes to D1 in batches |
| Rate limiter | One DO per user, tracks request counts in a sliding window |
| WebSocket chat/comments | One DO per room, manages connected clients |
| Subscription state machine | One DO per user, handles state transitions atomically |

### Code example

```typescript
export class EpisodeLikeCounter extends DurableObject {
  private buffer = 0;

  async increment() {
    this.buffer++;
    if (this.buffer >= 50) {
      await this.flush();
    }
    return this.buffer;
  }

  async flush() {
    // Write accumulated likes to D1 in one query
    await this.ctx.storage.put('pendingLikes', this.buffer);
    this.buffer = 0;
  }
}
```

---

## Analytics Engine — Simple Explanation

Analytics Engine is an **append-only event log** with unlimited storage. You write data points from your Worker, and query them later with SQL.

### Key properties

- **Write-only from Workers** — you call `env.DATASET.writeDataPoint(...)` and it's stored. You can never update or delete a data point.
- **Unlimited cardinality** — unlike traditional metrics systems that choke on high-cardinality dimensions (like unique user IDs), Analytics Engine handles them natively.
- **SQL API for querying** — query your data via HTTP using SQL syntax, or connect Grafana for dashboards.
- **No storage limits to worry about** — designed for high-volume event streams.

### Data model

Each data point has 3 parts:

```typescript
env.ANALYTICS.writeDataPoint({
  indexes: ['user_123'],           // 1 index: groups/filters your data
  blobs: ['subscribe', 'plan_4w'], // up to 20 strings: labels, event types, IDs
  doubles: [1706745600, 9.99],     // up to 20 numbers: timestamps, amounts, counts
});
```

| Field | Type | Purpose | Limit |
|-------|------|---------|-------|
| `indexes` | string[] | Primary grouping key (like a WHERE clause) | 1 per data point |
| `blobs` | string[] | Text labels (event type, user ID, plan name) | 20 per data point |
| `doubles` | number[] | Numeric values (timestamp, amount, duration) | 20 per data point |

### Real-world analogy

D1 is like a notebook where you write, erase, and rewrite entries. Analytics Engine is like a receipt printer — it prints every event on a continuous roll of paper that you can never erase, but you can search through it with SQL.

### Use cases for our app

| Use Case | What gets logged |
|----------|-----------------|
| Subscription history | Every subscribe/renew/cancel/expire event |
| Watch history | Every episode view with duration and completion % |
| Payment audit trail | Every webhook event and transaction |
| Engagement metrics | Likes, shares, page views at scale |

### Query example

```sql
-- How many subscriptions were created per day this month?
SELECT
  toDate(timestamp) AS day,
  COUNT() AS subscriptions
FROM webtoon_events
WHERE blob1 = 'subscribe'
  AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY day
ORDER BY day
```

---

## How They Compare

| | D1 | Durable Objects | Analytics Engine |
|-|----|----|------|
| **Model** | Relational database (SQLite) | Stateful object with storage | Append-only event log |
| **Read/Write** | Read + Write + Update + Delete | Read + Write + Update + Delete | Write only (query via SQL API) |
| **Consistency** | Strong (single-threaded) | Strong (single-threaded per object) | Eventually consistent |
| **Best for** | Current state (active subscriptions, users) | Coordination (counters, rate limits, WebSockets) | Historical events (audit logs, analytics, metrics) |
| **Scale limit** | 10GB per database, ~1,000 QPS | 1GB per object, millions of objects | Effectively unlimited |

In our scaling patterns, D1 stores **what is** (current subscription), Durable Objects handle **what's happening right now** (buffering viral likes), and Analytics Engine records **what happened** (full history of every event).

---

## References

- [What are Durable Objects?](https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/)
- [Rules of Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)
- [Durable Objects Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Analytics Engine Overview](https://developers.cloudflare.com/analytics/analytics-engine/)
- [Analytics Engine SQL Reference](https://developers.cloudflare.com/analytics/analytics-engine/sql-reference/)
- [Analytics Engine Pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/)
