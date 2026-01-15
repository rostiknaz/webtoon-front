# Subscription Cookie Architecture

Zero-API access control using signed cookies.

## Table of Contents
- [Overview](#overview)
- [Cookie-based Architecture](#cookie-based-architecture)
- [Server Components](#server-components)
- [Client Components](#client-components)
- [Flow Diagrams](#flow-diagrams)
- [Security Model](#security-model)
- [Benefits](#benefits)

---

## Overview

This system enables **instant subscription access checks** without any API calls. The server sets a cryptographically signed cookie containing subscription expiration data. The client can read this cookie to make access decisions immediately.

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

## Client Components

### 1. Cookie Reader Utility

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

### 2. React Hook

**File:** `src/hooks/useSubscription.ts`

Provides a React-friendly interface for subscription status.

#### `useSubscription()`

```typescript
import { useSubscription } from '@/hooks/useSubscription';

function PremiumContent() {
  const { data, refresh } = useSubscription();

  if (!data.hasSubscription) {
    return <SubscribePrompt />;
  }

  return <UnlockedEpisode />;
}
```

**Hook return value:**
```typescript
{
  data: {
    hasSubscription: boolean;  // Is subscription active?
    expiresAt: number;         // Unix timestamp (0 if none)
    planId: string | null;     // Plan ID
  };
  refresh: () => { data: {...} };  // Re-read cookie and return fresh data
  isLoading: false;   // Always false (no async)
  isPending: false;   // Always false (no async)
  isError: false;     // Always false (reading local cookie)
  error: null;        // Always null
}
```

**Using `refresh()`:**

Call `refresh()` after actions that update the subscription cookie:

```typescript
function SubscribeButton({ planId }) {
  const { refresh } = useSubscription();

  const handleSubscribe = async () => {
    // API call sets new cookie via Set-Cookie header
    await api.subscribe(planId);

    // Re-read cookie to update React state
    const { data } = refresh();

    if (data.hasSubscription) {
      toast.success('Subscription activated!');
    }
  };

  return <button onClick={handleSubscribe}>Subscribe</button>;
}
```

---

### 3. Imperative Check Function

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

## Summary

The subscription cookie architecture provides:

- **Instant access checks** (<1ms vs 50-200ms)
- **Zero API calls** for subscription status
- **Tamper-proof** via HMAC-SHA256 signing
- **Automatic updates** on auth and subscribe events
- **Self-expiring** when subscription ends
- **Simplified client code** with no async logic

**Cookie flow:**
```
Login/Subscribe -> Server creates signed cookie -> Browser stores it
Access check -> Client reads cookie locally -> Instant decision
Logout/Expire -> Cookie cleared/expires -> Access denied
```

**Files:**
- Server: `worker/lib/subscription-cookie.ts`, `worker/auth/subscription-cookie-plugin.ts`
- Client: `src/lib/subscription-cookie.ts`, `src/hooks/useSubscription.ts`
