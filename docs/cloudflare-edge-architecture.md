# How Cloudflare's Edge Network Works

This document explains Cloudflare's edge architecture and why it's beneficial for running our webtoon streaming application with frontend and backend on a single Worker.

---

## 1. The Global Anycast Network

### Network Scale
- **330+ data centers** worldwide
- **~50ms from 95%** of the world's Internet-connected population
- **405+ Tbps** network capacity
- Connected to **13,000+ network peers** (ISPs, cloud providers, enterprises)

### How Anycast Routing Works

```
User in Sydney → DNS lookup → Anycast IP
                              ↓
              BGP routes to NEAREST data center
                              ↓
              Sydney data center responds
```

**Key principle**: Every Cloudflare service runs on **every server in every data center**. There's no "origin region" - your Worker code exists everywhere simultaneously.

---

## 2. V8 Isolates vs Traditional Servers

### Traditional Architecture (AWS Lambda, etc.)
```
Request → Cold start VM/Container → Load runtime → Execute code
          (100-500ms overhead)      (memory heavy)
```

### Cloudflare Workers (V8 Isolates)
```
Request → Existing V8 runtime → Spin up isolate → Execute code
          (already running)     (~0ms cold start)  (minimal memory)
```

| Aspect | Traditional Container | Cloudflare Isolate |
|--------|----------------------|-------------------|
| Cold start | 100-500ms | ~0ms (100x faster) |
| Memory per instance | 128MB+ | ~1-5MB |
| Instances per server | 10-100 | **Hundreds to thousands** |
| Isolation | Process-level | V8 sandbox |

**Why this matters**: A single Cloudflare server can run thousands of different Workers simultaneously with almost no individual overhead.

---

## 3. What Happens When Thousands of Users Open Your Homepage

### Scenario: 10,000 users worldwide access the app simultaneously

#### Static Assets (React frontend)

```
User in Tokyo    → Tokyo DC    → Cached index.html, JS, CSS → 5ms
User in London   → London DC   → Cached index.html, JS, CSS → 5ms
User in New York → NYC DC      → Cached index.html, JS, CSS → 5ms
```

- Static assets served from **edge cache** at each data center
- **No origin roundtrip** needed
- Fingerprinted assets (`app.abc123.js`) cached for 1 year
- **Automatic scaling** - cache serves unlimited requests

#### API Requests (Hono backend)

```
User in Tokyo    → Tokyo DC    → Worker isolate → D1 Read Replica (APAC) → 20ms
User in London   → London DC   → Worker isolate → D1 Read Replica (WEUR) → 20ms
User in New York → NYC DC      → Worker isolate → D1 Read Replica (ENAM) → 20ms
```

**From Cloudflare docs**:
> "Workers automatically scale onto thousands of Cloudflare global network servers around the world. **There is no general limit to the number of requests per second Workers can handle.**"

---

## 4. Benefits of Single Worker (Frontend + Backend with Hono)

### Our Architecture

```typescript
// worker/index.ts - Single Worker handles everything
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      // Hono handles API routes
      return app.fetch(request, env);
    }

    // Static assets (React build)
    return env.ASSETS.fetch(request);
  }
}
```

### Benefits

| Benefit | Explanation |
|---------|-------------|
| **Zero network hop** | Frontend and API on same edge location - no cross-region latency |
| **Simplified deployment** | One `wrangler deploy` deploys everything globally |
| **Shared bindings** | D1, KV, R2 accessible to both frontend SSR and API |
| **Atomic deploys** | Frontend and API always in sync |
| **Cost efficiency** | Single Worker, single billing unit |

### Alternative: Split Architecture (with Smart Placement)

For heavy backend operations, Cloudflare recommends:

```
Frontend Worker (edge) ←→ Service Binding ←→ Backend Worker (near DB)
     ↓                                              ↓
Serves UI fast                              Smart Placement enabled
(close to user)                             (close to D1 primary)
```

But for our use case (short API calls, D1 read replicas), **single Worker is optimal**.

---

## 5. D1 Read Replication - Database at the Edge

Our app has D1 read replication enabled:

```
Primary: EEUR (Eastern Europe)
Replicas: WNAM, ENAM, WEUR, EEUR, APAC, OC (6 regions)
```

### How Reads Work

```
User in Australia → Sydney DC → Worker → D1 Replica (APAC) → 10-30ms
User in USA       → NYC DC    → Worker → D1 Replica (ENAM) → 10-30ms
```

### How Writes Work

```
User anywhere → Nearest DC → Worker → D1 Primary (EEUR) → 50-200ms
                                      ↓
                              Async replication to all replicas
```

---

## 6. Comparison: Cloudflare vs Traditional Cloud

### Traditional Setup (AWS/GCP)

```
User in Sydney
    ↓
DNS → us-east-1 (single region)
    ↓
Load Balancer → EC2/Lambda → RDS
    ↓
Response travels 15,000km back
    ↓
~200-400ms total latency
```

**Problems**:
- Single region = high latency for distant users
- Auto-scaling takes seconds (cold starts)
- You pay for idle capacity
- Manual multi-region setup is complex and expensive

### Cloudflare Setup

```
User in Sydney
    ↓
Anycast → Sydney DC (automatic)
    ↓
Worker isolate (0ms cold start) → D1 Replica (APAC)
    ↓
Response from same city
    ↓
~20-50ms total latency
```

**Advantages**:
- **330 regions by default** - no configuration needed
- **0ms cold starts** - always warm
- **Pay only for actual requests** - no idle costs
- **Automatic scaling** - no limits on requests/second

---

## 7. Real Numbers for Our App

Based on our architecture:

| Request Type | Latency | Why |
|--------------|---------|-----|
| Homepage (cached) | **5-15ms** | Edge cache, no compute |
| API: Get series list | **20-50ms** | Worker + D1 read replica |
| API: Like episode | **50-150ms** | Worker + D1 primary write |
| Video stream (R2) | **10-30ms TTFB** | R2 edge cache |

### At 10,000 concurrent users:

| Metric | Traditional (single region) | Cloudflare Edge |
|--------|----------------------------|-----------------|
| Avg latency | 200-400ms | 20-50ms |
| Cold starts | Yes (scaling) | No |
| Infra cost | $500-2000/mo | $5-50/mo |
| Config needed | Load balancers, ASGs, CDN | None (automatic) |

---

## Summary

**Cloudflare's edge model fundamentally changes the equation**:

1. **Code runs everywhere** - No "origin server" concept
2. **Instant scaling** - V8 isolates spin up in microseconds
3. **Data follows users** - D1 read replicas in 6 regions
4. **No cold starts** - High-traffic Workers are pre-warmed
5. **Single deployment** - Frontend + API deploy atomically to 330 cities

For our webtoon streaming app, this architecture means:
- Users worldwide get **sub-50ms API responses**
- Videos stream from **nearest R2 edge**
- **Zero infrastructure management**
- **Predictable costs** that scale with actual usage

---

## References

- [How Workers Works](https://developers.cloudflare.com/workers/reference/how-workers-works)
- [D1 Read Replication](https://developers.cloudflare.com/d1/best-practices/read-replication/)
- [Smart Placement](https://developers.cloudflare.com/workers/configuration/smart-placement)
- [Workers Limits](https://developers.cloudflare.com/workers/platform/limits)
- [Cloudflare Network](https://www.cloudflare.com/network/)
