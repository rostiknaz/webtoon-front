# Subscription Cookie Architecture

Hybrid cookie/API access control optimized for scale (500k-10M users/day).

## Table of Contents
- [Overview](#overview)
- [Hybrid Architecture](#hybrid-architecture)
- [Cookie-based Architecture](#cookie-based-architecture)
- [Server Components](#server-components)
- [Client Components](#client-components)
- [Flow Diagrams](#flow-diagrams)
- [Security Model](#security-model)
- [Benefits](#benefits)
- [Cost Analysis](#cost-analysis)
- [Scaling to 5-10M DAU](#scaling-to-5-10m-dau)

---

## Overview

This system uses a **hybrid cookie/API approach** for subscription access checks:

1. **Instant UI** - Reads from signed cookie (0ms, $0 cost)
2. **Background sync** - TanStack Query fetches from API (validates/refreshes)
3. **Cookie mismatch** - API response updates local state

**Key Principle:** Users can READ the cookie but cannot FORGE a valid one.

```
Traditional Approach (API-based):
  User clicks episode -> API call -> Server validates -> Response -> Allow/Deny
  Latency: 30-200ms

Cookie Approach (This System):
  User clicks episode -> Read cookie locally -> Allow/Deny
  Latency: <1ms
```

The cookie contains:
- **Expiration timestamp** - When the subscription ends (Unix timestamp)
- **Plan ID** - Which plan the user subscribed to
- **HMAC signature** - Cryptographic proof the server created this cookie

---

## Hybrid Architecture

The hybrid approach balances instant UX with data validation:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Hybrid Flow                                    │
│                                                                         │
│  ┌─────────────┐                    ┌─────────────────────────────┐     │
│  │   Cookie    │  Instant (0ms)     │        React State          │     │
│  │  (Signed)   │ ─────────────────▶ │   hasSubscription: true     │     │
│  └─────────────┘                    └─────────────────────────────┘     │
│                                              │                           │
│                                              │ TanStack Query            │
│                                              │ (background)              │
│  ┌─────────────┐                             ▼                           │
│  │    API      │  GET /api/subscription/status                          │
│  │  (Cached)   │ ◀───────────────────────────────────────────────────── │
│  └─────────────┘                                                        │
│        │                                                                │
│        │ KV Cache (10 min) → D1 fallback                                │
│        ▼                                                                │
│  ┌─────────────┐                    ┌─────────────────────────────┐     │
│  │   Server    │  Validated data    │        React State          │     │
│  │  Response   │ ─────────────────▶ │   source: 'api' (trusted)   │     │
│  └─────────────┘                    └─────────────────────────────┘     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Sources Priority

| Source | Speed | Trust Level | Use Case |
|--------|-------|-------------|----------|
| Cookie | <1ms | Signed, trusted | UI rendering, feature flags |
| API (cached) | ~10ms | Validated | Background sync, sensitive ops |
| API (fresh) | ~50ms | Authoritative | Payment flows, after subscribe |

### When Each Source Is Used

**Cookie-first (90% of checks):**
- Initial page load
- Episode navigation
- Premium badge display
- Download button visibility

**API validation (10% of checks):**
- Background sync every 5 minutes (stale time)
- After successful login
- After subscription purchase
- Sensitive operations (via `validateWithApi()`)

### Cookie Lifecycle

| Event | Cookie Action | Source |
|-------|--------------|--------|
| Login | Set with subscription data | `subscription-cookie-plugin` |
| Subscribe | Set with new subscription | `POST /subscribe` |
| API fetch | Refresh/restore cookie | `GET /status` |
| Logout | Clear cookie | `subscription-cookie-plugin` |
| Expiration | Browser auto-deletes | `Max-Age` attribute |

**Cookie recovery:** If the cookie is deleted (user clears browser data, etc.), the next API call via TanStack Query will restore it from `GET /status` response.

---

## Cookie-based Architecture

### Cookie Format

The subscription cookie uses a simple two-part format:

```
base64(payload).base64(signature)
```

**Example raw cookie:**
```
eyJleHAiOjE3MzY4NDg0MDAsInBpZCI6InBsYW5fNHdlZWtzIn0.kDf2Hx9qWvYz8...
```

### Payload Structure

```typescript
interface SubscriptionPayload {
  exp: number;        // Unix timestamp when subscription expires (0 = no subscription)
  pid: string | null; // Plan ID (e.g., "plan_4weeks", "plan_yearly")
}
```

**Example payloads:**

Active subscription:
```json
{
  "exp": 1736848400,
  "pid": "plan_4weeks"
}
```

No subscription:
```json
{
  "exp": 0,
  "pid": null
}
```

### Signature Algorithm

- **Algorithm:** HMAC-SHA256
- **Input:** JSON payload string (not base64)
- **Key:** Server secret (`BETTER_AUTH_SECRET`)
- **Output:** 32-byte signature, URL-safe base64 encoded

```
signature = HMAC-SHA256(key=secret, message=JSON.stringify(payload))
```

### Cookie Attributes

```
Name:     webtoon.sub
Path:     /
Max-Age:  Matches subscription expiration (or 1 year if no subscription)
SameSite: Lax
Secure:   Yes (in production)
HttpOnly: No (client needs to read it)
```

**Important:** The cookie is NOT HttpOnly because the client JavaScript must read it to make instant access decisions.

---

## Server Components

### 1. Cookie Creation/Verification Utilities

**File:** `worker/lib/subscription-cookie.ts`

This module provides the core cryptographic functions.

#### `createSubscriptionCookie(expiresAt, planId, secret)`

Creates a signed cookie value.

```typescript
import { createSubscriptionCookie } from '../lib/subscription-cookie';

const cookieValue = await createSubscriptionCookie(
  1736848400,        // expiresAt: Unix timestamp
  'plan_4weeks',     // planId
  env.BETTER_AUTH_SECRET
);
// Returns: "eyJleHA...kDf2Hx9q..."
```

#### `verifySubscriptionCookie(cookieValue, secret)`

Verifies signature and returns payload if valid.

```typescript
import { verifySubscriptionCookie } from '../lib/subscription-cookie';

const payload = await verifySubscriptionCookie(cookieValue, secret);
// Returns: { exp: 1736848400, pid: "plan_4weeks" } or null if invalid
```

#### `createSubscriptionSetCookie(expiresAt, planId, secret, isSecure)`

Creates a complete Set-Cookie header value.

```typescript
import { createSubscriptionSetCookie } from '../lib/subscription-cookie';

const setCookieHeader = await createSubscriptionSetCookie(
  1736848400,
  'plan_4weeks',
  env.BETTER_AUTH_SECRET,
  true  // isSecure (HTTPS)
);
// Returns: "webtoon.sub=eyJle...;Path=/;Max-Age=2592000;SameSite=Lax;Secure"
```

#### `clearSubscriptionCookie()`

Creates a Set-Cookie header that clears the cookie.

```typescript
import { clearSubscriptionCookie } from '../lib/subscription-cookie';

const clearHeader = clearSubscriptionCookie();
// Returns: "webtoon.sub=; Path=/; Max-Age=0; SameSite=Lax"
```

---

### 2. Better Auth Plugin

**File:** `worker/auth/subscription-cookie-plugin.ts`

This plugin automatically sets the subscription cookie after successful authentication.

**When it runs:**
- Sign-in (email/password)
- Sign-up
- OAuth callback (Google, etc.)
- Sign-out (clears cookie)

**How it works:**

```typescript
import { subscriptionCookiePlugin } from './subscription-cookie-plugin';

const auth = betterAuth({
  // ... other config
  plugins: [
    subscriptionCookiePlugin({
      db,
      secret: env.BETTER_AUTH_SECRET,
      isSecure: env.BETTER_AUTH_URL.startsWith('https'),
    }),
  ],
});
```

**Plugin behavior:**

1. **After sign-in/sign-up/OAuth:**
   - Fetches user's subscription from database
   - Creates signed cookie with expiration
   - Appends `Set-Cookie` header to response

2. **After sign-out:**
   - Appends clear cookie header to response

**Endpoint matching:**
```typescript
// Triggers on these paths:
path.startsWith('/sign-in')     // Email sign-in
path.startsWith('/sign-up')     // Email sign-up
path.includes('/callback')      // OAuth callbacks

// Clear cookie on:
path === '/sign-out'
```

---

### 3. Subscribe Endpoint

**File:** `worker/routes/subscription.ts`

The subscribe endpoint sets the cookie after a successful subscription purchase.

**Endpoint:** `POST /api/subscription/subscribe`

**Request:**
```json
{
  "planId": "plan_4weeks"
}
```

**Response with Set-Cookie:**
```http
HTTP/1.1 200 OK
Set-Cookie: webtoon.sub=eyJle...;Path=/;Max-Age=2592000;SameSite=Lax;Secure
Content-Type: application/json

{
  "success": true,
  "subscription": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "planId": "plan_4weeks",
    "status": "trial",
    "currentPeriodStart": 1704067200,
    "currentPeriodEnd": 1736848400,
    "trialDays": 7
  }
}
```

**Implementation detail:**
```typescript
// Calculate expiration
const expiresAt = Math.floor(periodEnd.getTime() / 1000);
const isSecure = c.env.BETTER_AUTH_URL.startsWith('https');

// Create signed cookie
const subCookie = await createSubscriptionSetCookie(
  expiresAt,
  planId,
  c.env.BETTER_AUTH_SECRET,
  isSecure
);

// Return response with cookie
return c.json({ success: true, subscription: {...} }, 200, {
  'Set-Cookie': subCookie,
});
```

---

### 4. Subscription Status Endpoint

**File:** `worker/routes/subscription.ts`

Returns the user's current subscription status using cache-first pattern.
**Also sets/refreshes the subscription cookie** - this handles the case where the cookie was deleted but the user still has an active subscription.

**Endpoint:** `GET /api/subscription/status`

**Response (with subscription):**
```http
HTTP/1.1 200 OK
Set-Cookie: webtoon.sub=eyJle...;Path=/;Max-Age=...;SameSite=Lax;Secure
Content-Type: application/json

{
  "hasSubscription": true,
  "subscription": {
    "status": "active",
    "planId": "plan_4weeks",
    "currentPeriodEnd": 1737882000,
    "planFeatures": {
      "episodeAccess": "all",
      "adFree": true,
      "downloadable": true,
      "earlyAccess": true
    }
  }
}
```

**Response (no subscription):**
```json
{
  "hasSubscription": false
}
```

**Cookie refresh behavior:**

When the API returns `hasSubscription: true`, it also sets the `webtoon.sub` cookie in the response. This ensures:
1. Cookie is restored if it was deleted (user cleared cookies, etc.)
2. Cookie expiration is kept in sync with actual subscription
3. Client has cookie available for subsequent synchronous checks

**Cache strategy:**
- KV cache TTL matches subscription expiration (up to 10 minutes)
- Cache miss → D1 query → cache result
- Invalidated on subscription changes

---

## Client Components

### 1. Subscription Service

**File:** `src/services/subscription.service.ts`

This module provides the hybrid cookie/API subscription checking logic.

#### `SubscriptionData` Interface

```typescript
interface SubscriptionData {
  hasSubscription: boolean;
  expiresAt: number;        // Unix timestamp (seconds), 0 if none
  planId: string | null;
  planFeatures: PlanFeatures | null;
  source: 'cookie' | 'api' | 'none';
}
```

#### `getSubscriptionFromCookie()`

Reads subscription from cookie (instant, no network).

```typescript
import { getSubscriptionFromCookie } from '@/services/subscription.service';

const data = getSubscriptionFromCookie();
// Returns: SubscriptionData with source='cookie' or null
```

#### `getSubscriptionFromApi()`

Fetches subscription from API (cache-first on server).

```typescript
import { getSubscriptionFromApi } from '@/services/subscription.service';

const data = await getSubscriptionFromApi();
// Returns: SubscriptionData with source='api'
```

#### `getSubscription(forceApi?)`

Hybrid approach: cookie-first, API fallback.

```typescript
import { getSubscription } from '@/services/subscription.service';

// Normal usage - cookie first, API fallback
const data = await getSubscription();

// Sensitive operations - force API validation
const validated = await getSubscription(true);
```

#### `getSubscriptionSync()`

Synchronous cookie-only check for immediate UI rendering.

```typescript
import { getSubscriptionSync } from '@/services/subscription.service';

// No async, always returns data
const data = getSubscriptionSync();
if (data.hasSubscription) {
  // Show premium UI immediately
}
```

---

### 2. Cookie Reader Utility

**File:** `src/lib/subscription-cookie.ts`

This module reads and parses the subscription cookie on the client. No verification is needed because the client cannot forge a valid signature anyway.

#### `hasActiveSubscription()`

Checks if the user has an active subscription.

```typescript
import { hasActiveSubscription } from '@/lib/subscription-cookie';

if (hasActiveSubscription()) {
  // Show premium content
} else {
  // Show subscribe prompt
}
```

#### `getSubscriptionExpiry()`

Gets the expiration timestamp.

```typescript
import { getSubscriptionExpiry } from '@/lib/subscription-cookie';

const expiry = getSubscriptionExpiry();
if (expiry > 0) {
  const expiryDate = new Date(expiry * 1000);
  console.log(`Subscription expires: ${expiryDate.toLocaleDateString()}`);
}
```

#### `getSubscriptionPlanId()`

Gets the plan ID.

```typescript
import { getSubscriptionPlanId } from '@/lib/subscription-cookie';

const planId = getSubscriptionPlanId();
// Returns: "plan_4weeks" or null
```

#### `parseSubscriptionCookie()`

Returns the full payload.

```typescript
import { parseSubscriptionCookie } from '@/lib/subscription-cookie';

const payload = parseSubscriptionCookie();
// Returns: { exp: 1736848400, pid: "plan_4weeks" } or null
```

---

### 3. React Hook (Hybrid)

**File:** `src/hooks/useSubscription.ts`

Provides a React-friendly interface with hybrid cookie/API checking using TanStack Query.

#### `useSubscription(options?)`

```typescript
import { useSubscription } from '@/hooks/useSubscription';

function PremiumContent() {
  const { data, isPending, source } = useSubscription();

  // data is available instantly from cookie
  // isPending is true only if API is loading AND no cookie data
  if (!data.hasSubscription) {
    return <SubscribePrompt />;
  }

  return <UnlockedEpisode />;
}
```

**Options:**
```typescript
interface UseSubscriptionOptions {
  enableApiValidation?: boolean;  // Enable background API sync (default: true)
  staleTime?: number;             // API cache stale time (default: 5 minutes)
}

// Cookie-only mode (fastest, no network)
const { data } = useSubscription({ enableApiValidation: false });
```

**Hook return value:**
```typescript
{
  data: SubscriptionData;         // Merged cookie + API data
  isPending: boolean;             // True only if API loading AND no cookie
  isFetching: boolean;            // True if API currently fetching in background
  error: Error | null;            // API error (null if using cookie only)
  source: 'cookie' | 'api' | 'none';  // Current data source
  refresh: () => Promise<SubscriptionData>;   // Re-read cookie + refetch API
  validateWithApi: () => Promise<SubscriptionData>;  // Force fresh API check
}
```

**Data source priority:**
1. API data (if available) - validated, authoritative
2. Cookie data - instant, signed
3. No subscription - default state

**Using `refresh()`:**

Call `refresh()` after actions that update the subscription:

```typescript
function SubscribeButton({ planId }) {
  const { refresh } = useSubscription();

  const handleSubscribe = async () => {
    // API call sets new cookie via Set-Cookie header
    await api.subscribe(planId);

    // Re-read cookie AND refetch API to update React state
    const freshData = await refresh();

    if (freshData.hasSubscription) {
      toast.success('Subscription activated!');
    }
  };

  return <button onClick={handleSubscribe}>Subscribe</button>;
}
```

**Using `validateWithApi()`:**

For sensitive operations that require server validation:

```typescript
function PurchaseButton() {
  const { validateWithApi } = useSubscription();

  const handlePurchase = async () => {
    // Force fresh API check before purchase
    const validated = await validateWithApi();

    if (!validated.hasSubscription) {
      // Proceed with purchase flow
      await showPaymentModal();
    } else {
      toast.info('You already have an active subscription');
    }
  };

  return <button onClick={handlePurchase}>Purchase</button>;
}
```

---

### 4. Imperative Check Function

**File:** `src/hooks/useSubscription.ts`

For non-React contexts or action-based checks.

#### `checkSubscriptionStatus()`

```typescript
import { checkSubscriptionStatus } from '@/hooks/useSubscription';

function onEpisodeChange(episodeId: string) {
  const { hasSubscription, justExpired } = checkSubscriptionStatus();

  if (!hasSubscription) {
    if (justExpired) {
      showModal('Your subscription has expired. Renew to continue watching.');
    } else {
      showModal('Subscribe to watch this episode.');
    }
    return;
  }

  playEpisode(episodeId);
}
```

**Return value:**
```typescript
{
  hasSubscription: boolean;  // Is subscription currently active?
  expiresAt: number;         // Unix timestamp
  planId: string | null;     // Plan ID
  justExpired: boolean;      // Had a subscription but it's now expired
}
```

**Use cases:**
- Episode switching
- Video playback start
- Premium feature access
- Download button clicks

---

## Flow Diagrams

### Login Flow

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ POST /api/auth/sign-in/email
       │ { email, password }
       ▼
┌──────────────────────────────────────────────────────────────┐
│                  Cloudflare Worker                            │
│                                                               │
│  1. Better Auth validates credentials                         │
│  2. Creates session                                           │
│  3. subscription-cookie-plugin hook runs:                     │
│     a. Fetch subscription from D1                             │
│     b. Create signed cookie:                                  │
│        payload = { exp: 1736848400, pid: "plan_4weeks" }      │
│        signature = HMAC-SHA256(secret, JSON(payload))         │
│        cookie = base64(payload) + "." + base64(signature)     │
│     c. Append Set-Cookie header                               │
│                                                               │
└──────┬───────────────────────────────────────────────────────┘
       │
       │ HTTP/1.1 200 OK
       │ Set-Cookie: webtoon.sub=eyJle...;Path=/;Max-Age=...
       │ { user: { id, email }, session: {...} }
       ▼
┌─────────────┐
│   Browser   │  Cookie stored automatically
│             │  useSubscription() now returns hasSubscription: true
└─────────────┘
```

---

### Subscribe Flow

```
┌─────────────┐
│   Browser   │  User has no subscription, clicks "Subscribe"
└──────┬──────┘
       │
       │ POST /api/subscription/subscribe
       │ { planId: "plan_4weeks" }
       ▼
┌──────────────────────────────────────────────────────────────┐
│                  Cloudflare Worker                            │
│                                                               │
│  1. Validate user session                                     │
│  2. Validate plan exists                                      │
│  3. Check no existing active subscription                     │
│  4. Calculate dates:                                          │
│     - Trial: 7 days                                           │
│     - Period: 30 days after trial                             │
│     - Expiration: periodEnd (Unix timestamp)                  │
│  5. INSERT subscription into D1                               │
│  6. Create signed cookie:                                     │
│     - expiresAt = Math.floor(periodEnd / 1000)                │
│     - cookie = createSubscriptionSetCookie(...)               │
│  7. Return response with Set-Cookie header                    │
│                                                               │
└──────┬───────────────────────────────────────────────────────┘
       │
       │ HTTP/1.1 200 OK
       │ Set-Cookie: webtoon.sub=eyJle...;Path=/;Max-Age=...
       │ { success: true, subscription: {...} }
       ▼
┌─────────────┐
│   Browser   │  Cookie updated automatically
│             │  Call refresh() to update React state
│             │  hasSubscription now returns true
└─────────────┘
```

---

### Episode Access Check Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│                                                              │
│  User clicks on Episode 5 (premium)                          │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  EpisodePlayer Component                                │ │
│  │                                                         │ │
│  │  const { data } = useSubscription();                    │ │
│  │                                                         │ │
│  │  // Read cookie from document.cookie                    │ │
│  │  // Parse: "webtoon.sub=eyJle..." -> { exp, pid }       │ │
│  │  // Check: exp > Date.now() / 1000                      │ │
│  │                                                         │ │
│  │  if (data.hasSubscription) {                            │ │
│  │    return <VideoPlayer src={episode.videoUrl} />;       │ │
│  │  } else {                                               │ │
│  │    return <SubscribePrompt />;                          │ │
│  │  }                                                      │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  Total latency: <1ms (no network request)                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘

No server involved! Decision made entirely client-side.
```

---

### Complete User Journey

```
Time     Event                          Cookie State
────────────────────────────────────────────────────────────────
T+0      User visits site               No cookie (or exp=0)
         hasSubscription() = false

T+1min   User signs up                  Cookie set by auth plugin
         (no subscription yet)          { exp: 0, pid: null }
         hasSubscription() = false

T+2min   User subscribes to plan        Cookie updated by subscribe endpoint
         POST /subscribe                { exp: 1736848400, pid: "plan_4weeks" }
         hasSubscription() = true

T+3min   User clicks premium episode    Cookie read locally
         No API call needed!            hasSubscription() = true
                                        -> Show video player

T+30days Cookie expires naturally       Browser deletes cookie
         (Max-Age reached)              hasSubscription() = false
                                        -> Show subscribe prompt

T+30d+1m User logs back in              Cookie refreshed by auth plugin
         (subscription expired in DB)   { exp: 0, pid: null }
         hasSubscription() = false
```

---

## Security Model

### Why Users Cannot Forge Cookies

The cookie uses HMAC-SHA256 signing, which requires the secret key to create a valid signature.

**Attack scenario: User tries to extend subscription**

```
1. User reads their cookie:
   eyJleHAiOjE3MDQwNjcyMDAsInBpZCI6InBsYW5fNHdlZWtzIn0.kDf2Hx9qWvYz8...
   Decoded payload: { exp: 1704067200, pid: "plan_4weeks" }

2. User modifies expiration:
   New payload: { exp: 1999999999, pid: "plan_4weeks" }  // Year 2033
   New base64: eyJleHAiOjE5OTk5OTk5OTksInBpZCI6InBsYW5fNHdlZWtzIn0

3. User doesn't know the secret, so they:
   a. Reuse old signature (FAILS - signature doesn't match new payload)
   b. Create random signature (FAILS - won't verify)
   c. Try to guess secret (FAILS - 256-bit key space)
```

**Why it's secure:**

1. **HMAC-SHA256 is unforgeable** without the secret key
2. **Secret key** lives only on the server (environment variable)
3. **Base64 is not encryption** - it's just encoding, but that's fine
4. **Signature verification** happens server-side when needed

### When Server Verification Occurs

The client trusts the cookie for UI decisions (showing/hiding content). The server verifies when security matters:

| Action | Client Check | Server Verification |
|--------|--------------|---------------------|
| Show premium badge | Cookie only | Not needed |
| Display unlock button | Cookie only | Not needed |
| Play video | Cookie only | Video URL is signed separately |
| Download content | Cookie only | Download URL has signature |
| Access API data | Cookie only | Session + subscription check |

### What If Cookie Is Tampered?

**Client behavior:**
- `parseSubscriptionCookie()` returns `null` if parsing fails
- `hasActiveSubscription()` returns `false` on any error

**Server behavior:**
- `verifySubscriptionCookie()` returns `null` if signature invalid
- Protected endpoints reject the request

### Cookie Not HttpOnly - Is That Safe?

Yes, because:

1. **XSS attacks** could steal the cookie, but they could also steal the session token (which IS HttpOnly via `__Secure-` prefix)
2. **The subscription cookie has no write authority** - it only indicates status
3. **All mutations require session authentication** - forging the subscription cookie doesn't grant write access
4. **Video/download URLs have their own signatures** - the subscription cookie alone doesn't grant content access

---

## Benefits

### 1. Zero API Calls for Access Checks

Traditional approach:
```typescript
// Each check = 1 API call
const { data } = await fetch('/api/subscription/check');
if (data.hasSubscription) { /* allow */ }
```

Cookie approach:
```typescript
// Each check = 1 cookie read (synchronous, local)
if (hasActiveSubscription()) { /* allow */ }
```

**Impact:**
- 10 episodes viewed = 0 API calls (vs 10 previously)
- Navigation between pages = 0 API calls
- Tab switching = 0 API calls

### 2. Instant Client-Side Decisions

```
API approach:    Click -> Network request -> Wait 50-200ms -> Decision
Cookie approach: Click -> Read cookie -> Decision in <1ms
```

The UI feels instant because there's no loading state for subscription checks.

### 3. No Staleness Issues

Unlike cached API responses, the cookie:

- **Has real expiration** (`exp` field matches actual subscription end)
- **Auto-expires** via `Max-Age` header
- **Updates on every auth event** (login, subscribe, logout)

**Scenario: User's subscription expires**

```
T+0:        Cookie: { exp: 1736848400 }  (expires in 30 days)
T+30days:   hasActiveSubscription() checks exp < now
            Returns false immediately
            User sees subscribe prompt
```

No background refresh needed. No stale cache to invalidate.

### 4. Works Offline

Once the cookie is set, subscription checks work without network connectivity:

```typescript
// Works even if offline
if (hasActiveSubscription()) {
  // Play downloaded episode
}
```

### 5. Reduced Server Load

Every subscription check that would have been an API call is now a local cookie read:

| Metric | Before (API) | After (Cookie) |
|--------|--------------|----------------|
| Server requests | 100% | 0% |
| D1 queries | High | None |
| KV cache reads | High | None |
| Worker CPU time | High | None |
| User latency | 50-200ms | <1ms |

### 6. Simpler Client Code

Before:
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['subscription'],
  queryFn: () => fetch('/api/subscription/check').then(r => r.json()),
});

if (isLoading) return <Spinner />;
if (error) return <Error />;
if (!data?.hasSubscription) return <SubscribePrompt />;
```

After:
```typescript
const { data } = useSubscription();

if (!data.hasSubscription) return <SubscribePrompt />;
```

No loading states, no error handling for network failures, no retry logic.

---

## Cost Analysis

Estimated costs for 5-10M users/day with hybrid approach:

### Approach Comparison

| Approach | Monthly Cost | Latency | Use Case |
|----------|-------------|---------|----------|
| Cookie only | $0 | 0ms | UI checks |
| API + KV | ~$126/mo | ~10ms | Full validation |
| **Hybrid** | **~$12/mo** | **0-10ms** | Best of both |

### Hybrid Breakdown

Assuming 1M users/day, 5 subscription checks per session:

**Cookie checks (90%):**
- 4.5M checks/day × 30 days = 135M checks/month
- Cost: $0 (local cookie read)

**API checks (10%):**
- 0.5M checks/day × 30 days = 15M checks/month
- KV reads: ~$0.50/million = ~$7.50/month
- Worker invocations: ~$0.30/million = ~$4.50/month
- **Total: ~$12/month**

### Why Hybrid Wins

```
Pure API (all 150M checks via API):
  - KV: 150M × $0.50/M = $75
  - Workers: 150M × $0.30/M = $45
  - D1 fallback: ~$6
  Total: ~$126/month

Hybrid (90% cookie, 10% API):
  - Cookie: 135M × $0 = $0
  - API: 15M checks = ~$12
  Total: ~$12/month

Savings: 90% ($114/month)
```

---

---

## Scaling to 5-10M DAU

### The Problem: Unbounded Table Growth

With millions of daily active users subscribing, renewing, and churning, several tables grow without bound:

| Table | Growth Rate (5M DAU) | Annual Size | Problem |
|-------|---------------------|-------------|---------|
| `subscriptions` | New row per renewal | ~2.4GB/yr | History accumulates |
| `paymentTransactions` | 1-2 per subscribe | ~1.2GB/yr | Audit trail grows |
| `webhookEvents` | 3-5 per payment | ~12GB/yr | Exceeds D1 10GB limit |
| `watchHistory` | 5-10 per user/day | ~360GB/yr | Largest table by far |
| `sessions` | 1-3 per user/day | ~108GB/yr | Frequent auth |

**D1 constraint**: 10GB hard limit per database, single-threaded writes.

---

### Pattern 1: Hot/Cold Data Separation

Time-partition data between an active D1 database and an archive D1 database.

```
┌─────────────────────┐     ┌─────────────────────┐
│   D1: Active (Hot)  │     │  D1: Archive (Cold)  │
│                     │     │                      │
│  subscriptions      │     │  subscriptions_archive│
│  (status=active/    │     │  (status=expired/     │
│   trial/past_due)   │     │   cancelled, >90d)    │
│                     │     │                      │
│  watchHistory       │     │  watchHistory_archive │
│  (last 30 days)     │     │  (older than 30 days) │
│                     │     │                      │
│  sessions           │     │  webhookEvents_archive│
│  (last 7 days)      │     │  (older than 7 days)  │
└─────────────────────┘     └──────────────────────┘
```

**Implementation**: Scheduled Worker (cron) moves expired rows:

```typescript
// worker/crons/archive.ts
async function archiveExpiredSubscriptions(hotDb: D1Database, coldDb: D1Database) {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000; // 90 days ago

  const expired = await hotDb
    .prepare(`SELECT * FROM subscriptions WHERE status IN ('expired','cancelled') AND updatedAt < ?`)
    .bind(cutoff)
    .all();

  if (expired.results.length === 0) return;

  // Batch insert into archive
  const batch = expired.results.map(row =>
    coldDb.prepare(`INSERT INTO subscriptions_archive VALUES (?,?,?,?,?,?,?,?)`)
      .bind(row.id, row.userId, row.planId, row.status, /* ... */)
  );
  await coldDb.batch(batch);

  // Delete from hot
  const ids = expired.results.map(r => r.id);
  await hotDb.prepare(`DELETE FROM subscriptions WHERE id IN (${ids.map(() => '?').join(',')})`)
    .bind(...ids)
    .run();
}
```

**Hot DB size estimate**: ~500MB (active subscriptions + 30-day rolling window).

---

### Pattern 2: State Machine for Subscription Lifecycle

Instead of inserting a new row per renewal, maintain a **single row per user** that transitions through states:

```
          ┌──────────┐
          │  (none)  │
          └────┬─────┘
               │ subscribe()
               ▼
          ┌──────────┐   renew()    ┌──────────┐
          │  trial   │ ──────────▶  │  active   │ ◀─┐
          └────┬─────┘              └────┬──────┘   │
               │ expire()                │ renew()   │
               ▼                         │           │
          ┌──────────┐                   └───────────┘
          │ expired  │ ◀── expire()
          └────┬─────┘
               │ subscribe()
               ▼
          ┌──────────┐
          │  active  │  (re-subscription)
          └──────────┘
```

**Schema change** — single row updated in place:

```sql
-- Current: new row per period (grows unbounded)
-- Proposed: single row per user (constant size)
CREATE TABLE user_subscription (
  userId    TEXT PRIMARY KEY,
  planId    TEXT NOT NULL,
  status    TEXT NOT NULL DEFAULT 'trial',
  startsAt  INTEGER NOT NULL,
  expiresAt INTEGER NOT NULL,
  renewalCount INTEGER DEFAULT 0,
  updatedAt INTEGER NOT NULL
);
```

**History goes to Analytics Engine** (immutable event log, unlimited storage):

```typescript
// Log every state transition to Analytics Engine
env.ANALYTICS.writeDataPoint({
  blobs: [userId, oldStatus, newStatus, planId],
  doubles: [expiresAt, renewalCount],
  indexes: [userId],
});
```

**Result**: `user_subscription` table stays O(users), not O(users × renewals).

---

### Pattern 3: Vertical Database Split

Separate databases by domain to isolate growth and optimize per-domain:

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  D1: Auth    │  │  D1: Content │  │  D1: Billing │  │  D1: Activity│
│              │  │              │  │              │  │              │
│  users       │  │  series      │  │  user_sub    │  │  watchHistory│
│  sessions    │  │  episodes    │  │  plans       │  │  userLikes   │
│  accounts    │  │              │  │  payments    │  │              │
│  verifications│ │              │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

**Important**: Foreign keys do NOT work across separate D1 databases. Each D1 is an independent SQLite instance. Cross-database referential integrity must be enforced at the application level:

```typescript
// Application-level referential integrity
async function subscribe(userId: string, planId: string) {
  // 1. Verify user exists in auth DB
  const user = await authDb.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
  if (!user) throw new Error('User not found');

  // 2. Verify plan exists in billing DB
  const plan = await billingDb.prepare('SELECT id FROM plans WHERE id = ?').bind(planId).first();
  if (!plan) throw new Error('Plan not found');

  // 3. Create subscription in billing DB
  await billingDb.prepare('INSERT INTO user_subscription (userId, planId, ...) VALUES (?, ?, ...)')
    .bind(userId, planId)
    .run();
}
```

**Trade-off**: More application code for integrity checks, but each DB stays well under 10GB and can scale independently.

---

### Pattern 4: Rolling Window with TTL Eviction

For high-volume tables like `watchHistory`, maintain only a fixed time window:

```typescript
// Scheduled Worker: daily cron
async function evictOldWatchHistory(db: D1Database) {
  const cutoff = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60; // 30 days

  await db.prepare('DELETE FROM watchHistory WHERE watchedAt < ?')
    .bind(cutoff)
    .run();
}
```

**Size cap**: With 5M DAU × 7 watches/day × 30 days × ~100 bytes = **~100GB** → still too large for D1.

**Solution**: Move `watchHistory` to Analytics Engine entirely:

```typescript
// Replace D1 insert with Analytics Engine write
env.ANALYTICS.writeDataPoint({
  blobs: [userId, episodeId, seriesId],
  doubles: [watchedAt, durationSeconds, completionPercent],
  indexes: [userId],
});
```

Analytics Engine has no storage limits and is optimized for time-series append-only data.

---

### Pattern 5: Materialized View via KV (CQRS)

Separate the write path (D1) from the read path (KV) for subscription checks:

```
Write Path:                          Read Path:
subscribe() ──▶ D1 (source of truth) useSubscription() ──▶ Cookie (instant)
    │                                                         │
    └──▶ Update KV materialized view                          └──▶ KV (fallback)
         key: sub:{userId}                                         key: sub:{userId}
         value: { status, planId,                                  │
                  expiresAt, features }                            └──▶ D1 (last resort)
         ttl: matches expiration
```

This is already partially implemented via the cookie system. KV acts as a server-side cache that survives cookie deletion.

---

### Pattern 6: Event Sourcing for Audit Trail

Use Analytics Engine as an immutable event log for all subscription and payment events:

```typescript
// Every subscription mutation logs an event
function logSubscriptionEvent(env: Env, event: {
  type: 'subscribe' | 'renew' | 'cancel' | 'expire' | 'refund';
  userId: string;
  planId: string;
  amount?: number;
}) {
  env.ANALYTICS.writeDataPoint({
    blobs: [event.type, event.userId, event.planId],
    doubles: [Date.now(), event.amount ?? 0],
    indexes: [event.userId],
  });
}
```

**Benefits**:
- Unlimited storage (Analytics Engine retains data based on account plan)
- Query via SQL API for analytics dashboards
- D1 only stores current state, not full history
- Webhook events move entirely to Analytics Engine

---

### Implementation Priority

| Priority | Pattern | Impact | Effort |
|----------|---------|--------|--------|
| 1 | FSM subscription (Pattern 2) | Stops subscription table growth | Schema migration |
| 2 | Analytics Engine for events (Pattern 6) | Removes webhookEvents from D1 | New write path |
| 3 | Rolling window / Analytics Engine for watchHistory (Pattern 4) | Removes largest table | Migration |
| 4 | Hot/Cold separation (Pattern 1) | Handles remaining growth | Cron worker |
| 5 | Vertical DB split (Pattern 3) | Long-term scaling | Major refactor |
| 6 | KV materialized views (Pattern 5) | Already partially done via cookies | Incremental |

### Multi-Worker Architecture Analysis

**Question**: Would splitting into separate Workers (auth Worker, billing Worker, content Worker) help handle 5-10M DAU?

**Answer**: No. Splitting Workers does not improve throughput.

#### Why Not

1. **Workers have no per-script request limit.** A single Worker auto-scales across thousands of edge servers with no general limit on requests/second. Splitting doesn't increase total capacity.

2. **The bottleneck is D1, not Workers.** Each D1 database is backed by a single Durable Object (single-threaded). Maximum throughput: ~1,000 QPS for 1ms queries, ~10 QPS for 100ms queries. Whether one Worker or three Workers send queries to the same D1, the database processes them at the same rate.

3. **Service Bindings have zero overhead.** If you split, Workers on the same server communicate via Service Bindings with no latency penalty — but there's also no latency gain.

4. **Smart Placement doesn't help here.** Workers with D1 bindings already run near the D1 location. Read replicas route reads to the nearest replica automatically.

5. **CPU limits are not a concern.** Paid plan allows 30s CPU time per request. Typical auth request uses <5ms CPU. Billing includes total CPU across all Service Binding calls anyway.

6. **No cost difference.** On Standard pricing, Service Binding calls are free. One Worker handling 10M requests costs the same as two Workers handling 5M each.

#### What Actually Helps at Scale

| Solution | Effect |
|----------|--------|
| Separate D1 databases (Pattern 3) | Each DB gets its own ~1,000 QPS write budget |
| D1 read replicas (already enabled) | Multiplies read throughput by replica count |
| KV/cookie caching (already implemented) | Eliminates most D1 reads |
| Analytics Engine for high-volume writes | Bypasses D1 entirely for watchHistory, webhookEvents |

#### When Splitting Workers Makes Sense

Splitting is valid for **organizational** reasons, not performance:
- Independent deployment cycles (different teams)
- Security isolation (reduce public attack surface)
- Reusability (shared auth Worker across multiple apps)

---

### Cloudflare Pages + Worker Split Analysis

**Question**: Should we split frontend (Cloudflare Pages) from backend (Cloudflare Worker)?

**Answer**: No. Cloudflare officially recommends the single Worker approach we already use.

#### Key Findings

1. **Cloudflare is converging Pages into Workers.** From official docs: *"Now that Workers supports both serving static assets and server-side rendering, you should start with Workers. All of our investment, optimizations, and feature work will be dedicated to improving Workers."* Pages won't receive new features.

2. **Static asset serving is identical.** Both Pages and Workers serve static assets from the same edge network, with the same caching, same 25 MiB file limit, and **free unlimited requests** for static assets on both platforms.

3. **Workers has more features.** Durable Objects, Cron Triggers, comprehensive Observability, and gradual deployments (traffic splitting) are Workers-only. Pages Functions are billed as Workers anyway.

4. **No cost benefit.** Static asset requests are free on both platforms. Function/Worker invocations cost the same ($0.30/million). No bandwidth charges on either.

5. **Splitting adds complexity.** A Pages + Worker split requires:
   - Two deployment pipelines
   - Service Bindings or cross-domain fetch for API calls
   - Domain routing between the two
   - Loss of atomic deploys (frontend and API could be out of sync)

6. **We already have the recommended setup.** The `@cloudflare/vite-plugin` with `env.ASSETS.fetch()` is exactly what Cloudflare recommends for full-stack apps. Static assets are served directly without invoking Worker code (unless `run_worker_first` is set).

#### Deployment Features Comparison

| Feature | Pages | Workers |
|---------|-------|---------|
| Preview URLs per PR | Yes (automatic) | Yes (per version) |
| Rollback | Yes (any production build) | Yes (last 100 versions) |
| Gradual deployments | No | Yes (traffic splitting) |
| Cron Triggers | No | Yes |
| Durable Objects | No | Yes |
| Observability | Limited | Full |
| Git-based deploy | Yes (built-in) | No (CI/CD required) |
| File limit | 20,000 | 100,000 (paid) |

---

### Storage Projection After Improvements

| Table | Before (annual) | After | Where |
|-------|-----------------|-------|-------|
| subscriptions | 2.4GB (growing) | ~50MB (O(users)) | D1 (FSM) |
| paymentTransactions | 1.2GB | 0 | Analytics Engine |
| webhookEvents | 12GB | 0 | Analytics Engine |
| watchHistory | 360GB | 0 | Analytics Engine |
| sessions | 108GB | ~500MB (7-day window) | D1 + KV |
| **Total D1** | **~484GB** | **~550MB** | **Well under 10GB** |

---

## Summary

The hybrid subscription architecture provides:

- **Instant access checks** (<1ms for 90% of checks)
- **Background validation** via TanStack Query
- **Tamper-proof** via HMAC-SHA256 signing
- **Automatic updates** on auth and subscribe events
- **Self-expiring** when subscription ends
- **Cost optimized** (~$12/mo vs ~$126/mo for pure API)

**Hybrid flow:**
```
Login/Subscribe -> Server creates signed cookie -> Browser stores it
Access check -> Client reads cookie locally -> Instant UI decision
                  └-> TanStack Query fetches API in background
                       └-> KV cache (10 min) -> D1 fallback
                            └-> Updates React state if different
Logout/Expire -> Cookie cleared/expires -> Access denied
```

**Files:**
- Server:
  - `worker/lib/subscription-cookie.ts` - Cookie creation/verification
  - `worker/auth/subscription-cookie-plugin.ts` - Auth integration
  - `worker/routes/subscription.ts` - API endpoints including `/status`
- Client:
  - `src/lib/subscription-cookie.ts` - Cookie reader utilities
  - `src/services/subscription.service.ts` - Hybrid service layer
  - `src/hooks/useSubscription.ts` - TanStack Query hook
