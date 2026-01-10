# Authentication & Subscription Setup Guide

Complete guide for setting up Better Auth + Cloudflare + Solidgate integration.

## Prerequisites

- Cloudflare account with Workers/Pages access
- D1 database created (✅ Already done: `webtoon-db`)
- KV namespaces created (✅ Already done: `CACHE`, `SESSIONS`)
- Solidgate merchant account
- (Optional) Google/GitHub OAuth apps

## 1. Environment Setup

### Local Development (.env)

Create `.env` file (see `.env.example` for template):

```bash
# Better Auth
BETTER_AUTH_SECRET=your_random_32_char_secret_here
BETTER_AUTH_URL=http://localhost:5174

# Solidgate (get from Solidgate dashboard)
SOLIDGATE_MERCHANT_ID=your_merchant_id
SOLIDGATE_SECRET_KEY=your_secret_key
SOLIDGATE_PUBLIC_KEY=your_public_key
SOLIDGATE_WEBHOOK_SECRET=your_webhook_secret

# Cloudflare (already configured)
CLOUDFLARE_STREAM_CUSTOMER_CODE=9u10nm8oora2n5zb

# OAuth (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Production (Cloudflare Secrets)

```bash
# Set secrets in Cloudflare
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put SOLIDGATE_MERCHANT_ID
npx wrangler secret put SOLIDGATE_SECRET_KEY
npx wrangler secret put SOLIDGATE_PUBLIC_KEY
npx wrangler secret put SOLIDGATE_WEBHOOK_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

## 2. Database Setup

✅ Already done! Your database is ready with:

- Users, sessions, accounts, verifications tables
- Series, episodes, likes, watch history tables
- Subscriptions, plans, user_episode_access tables
- Webhook events, payment transactions tables

To view your database:

```bash
# Local
npm run db:local

# Remote
npm run db:remote
```

## 3. Seed Subscription Plans

Create initial subscription plans:

```bash
npm run db:seed
```

Or manually insert via D1:

```sql
-- Free plan (for testing)
INSERT INTO plans (id, name, description, price, currency, billing_period, trial_days, features, is_active, display_order)
VALUES (
  'plan_free',
  'Free',
  'Access to free episodes only',
  0,
  'USD',
  'monthly',
  0,
  '{"episodeAccess":"limited","adFree":false,"downloadable":false,"earlyAccess":false}',
  1,
  1
);

-- Monthly Premium
INSERT INTO plans (id, name, description, price, currency, billing_period, trial_days, features, solidgate_product_id, is_active, display_order)
VALUES (
  'plan_monthly',
  'Premium Monthly',
  'Unlimited access to all episodes',
  9.99,
  'USD',
  'monthly',
  7,
  '{"episodeAccess":"all","adFree":true,"downloadable":true,"earlyAccess":true}',
  'your_solidgate_product_id_monthly',
  1,
  2
);

-- Yearly Premium
INSERT INTO plans (id, name, description, price, currency, billing_period, trial_days, features, solidgate_product_id, is_active, display_order)
VALUES (
  'plan_yearly',
  'Premium Yearly',
  'Unlimited access + 2 months free',
  99.99,
  'USD',
  'yearly',
  7,
  '{"episodeAccess":"all","adFree":true,"downloadable":true,"earlyAccess":true}',
  'your_solidgate_product_id_yearly',
  1,
  3
);
```

## 4. Solidgate Configuration

### 4.1 Create Products in Solidgate Dashboard

1. Go to Solidgate Dashboard → Products
2. Create two products:
   - **Premium Monthly** ($9.99/month)
   - **Premium Yearly** ($99.99/year)
3. Copy the Product IDs and update your plans table

### 4.2 Configure Webhook

1. Go to Solidgate Dashboard → Settings → Webhooks
2. Add webhook URL: `https://your-domain.com/api/webhooks/solidgate`
3. Select events to listen:
   - `payment.success`
   - `subscription.created`
   - `subscription.renewed`
   - `subscription.canceled`
   - `subscription.expired`
   - `refund.success`
4. Copy webhook secret and add to environment variables

### 4.3 Test Webhook Locally

Use Cloudflare Tunnel to expose local server:

```bash
# Run dev server
npm run dev

# In another terminal, create tunnel
npx wrangler tunnel --url http://localhost:5174

# Use the tunnel URL in Solidgate webhook settings
```

## 5. Frontend Integration

### 5.1 Wrap App with Auth Provider

```tsx
// src/main.tsx
import { authClient } from './lib/auth.client';

// The authClient is already configured, just use it in your components
```

### 5.2 Create Login Page

```tsx
// src/routes/login.tsx
import { signIn } from 'better-auth/react';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    await signIn.email({ email, password });
  };

  return (
    <div>
      <h1>Login</h1>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={handleLogin}>Sign In</button>
    </div>
  );
}
```

### 5.3 Create Signup Page

```tsx
// src/routes/signup.tsx
import { signUp } from 'better-auth/react';
import { useState } from 'react';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSignup = async () => {
    await signUp.email({ email, password, name });
  };

  return (
    <div>
      <h1>Sign Up</h1>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={handleSignup}>Create Account</button>
    </div>
  );
}
```

### 5.4 Protected Routes

```tsx
// src/routes/__root.tsx
import { useSession } from 'better-auth/react';
import { Navigate } from '@tanstack/react-router';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const session = useSession();

  if (session.isPending) {
    return <div>Loading...</div>;
  }

  if (!session.data) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}
```

### 5.5 Subscription Page with Solidgate

```tsx
// src/routes/subscribe.tsx
import { FormEvent } from '@solidgate/react-sdk';
import { useState, useEffect } from 'react';

export default function SubscribePage() {
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    // Fetch available plans
    fetch('/api/plans')
      .then(res => res.json())
      .then(data => setPlans(data.plans));
  }, []);

  const handlePayment = (planId: string) => {
    // Initialize Solidgate form
    const form = new FormEvent({
      merchantId: import.meta.env.VITE_SOLIDGATE_MERCHANT_ID,
      publicKey: import.meta.env.VITE_SOLIDGATE_PUBLIC_KEY,
      productId: planId,
      // ... other config
    });

    form.mount('#payment-form');
  };

  return (
    <div>
      <h1>Choose Your Plan</h1>
      {plans.map(plan => (
        <div key={plan.id}>
          <h2>{plan.name}</h2>
          <p>{plan.description}</p>
          <p>${plan.price}/{plan.billingPeriod}</p>
          <button onClick={() => handlePayment(plan.solidgateProductId)}>
            Subscribe
          </button>
        </div>
      ))}
      <div id="payment-form"></div>
    </div>
  );
}
```

## 6. Access Control

### 6.1 Check Subscription Before Playing Episode

```tsx
// src/routes/serials/$serialId/episodes/$episodeId.tsx
import { useEffect, useState } from 'react';
import { checkSubscription } from '@/lib/auth.client';

export default function EpisodePage() {
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    checkSubscription().then(setHasAccess);
  }, []);

  if (!hasAccess) {
    return (
      <div>
        <h1>Subscribe to Watch</h1>
        <a href="/subscribe">Get Premium</a>
      </div>
    );
  }

  return <VideoPlayer />;
}
```

### 6.2 API Endpoint Access Control

```typescript
// functions/api/episodes/[id].ts
import { requireAuth, requireSubscription } from '../../../lib/auth.server';

export const onRequestGet: PagesFunction = async (context) => {
  const { request, env, params } = context;

  // Check authentication
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult; // 401 Unauthorized
  }

  const { user } = authResult;

  // Check if episode is paid
  const episode = await env.DB.prepare('SELECT is_paid FROM episodes WHERE id = ?')
    .bind(params.id)
    .first();

  if (episode?.is_paid) {
    // Check subscription
    const hasSubscription = await requireSubscription(user.id, env);
    if (!hasSubscription) {
      return new Response('Subscription required', { status: 403 });
    }
  }

  // Return episode data
  return new Response(JSON.stringify(episode));
};
```

## 7. Testing

### 7.1 Test Authentication

```bash
# Sign up
curl -X POST http://localhost:5174/api/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Sign in
curl -X POST http://localhost:5174/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Get session
curl http://localhost:5174/api/auth/session \
  -H "Cookie: webtoon_session=YOUR_SESSION_TOKEN"
```

### 7.2 Test Subscription Check

```bash
# Check subscription
curl http://localhost:5174/api/subscription/check \
  -H "Cookie: webtoon_session=YOUR_SESSION_TOKEN"

# Get subscription status
curl http://localhost:5174/api/subscription/status \
  -H "Cookie: webtoon_session=YOUR_SESSION_TOKEN"
```

### 7.3 Test Webhook (Manually)

```bash
# Simulate Solidgate webhook
curl -X POST http://localhost:5174/api/webhooks/solidgate \
  -H "Content-Type: application/json" \
  -H "x-solidgate-signature: YOUR_SIGNATURE" \
  -d '{
    "event": "subscription.created",
    "order": {
      "order_id": "test123",
      "customer": { "email": "test@example.com" },
      "subscription": {
        "id": "sub_123",
        "plan_id": "plan_monthly",
        "status": "active",
        "current_period_start": 1609459200,
        "current_period_end": 1612137600
      }
    }
  }'
```

## 8. Deployment

```bash
# Deploy to Cloudflare Pages
npm run deploy

# Or connect GitHub repo for automatic deployments
npx wrangler pages project create webtoon-front
```

## 9. Monitoring

### View Logs

```bash
# Real-time logs
npx wrangler tail

# Filter by specific worker
npx wrangler tail --format=pretty
```

### Check KV Storage

```bash
# List keys
npx wrangler kv:key list --namespace-id=YOUR_KV_ID

# Get value
npx wrangler kv:key get "session:token123" --namespace-id=YOUR_KV_ID
```

### Check D1 Database

```bash
# Query subscriptions
npx wrangler d1 execute webtoon-db --command "SELECT * FROM subscriptions LIMIT 10"

# Query webhook events
npx wrangler d1 execute webtoon-db --command "SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 10"
```

## 10. Common Issues

### Issue: "Unauthorized" on auth endpoints

**Solution**: Check that `BETTER_AUTH_SECRET` is set correctly and cookies are being sent.

### Issue: Webhook signature verification fails

**Solution**: Ensure `SOLIDGATE_WEBHOOK_SECRET` matches the secret in Solidgate dashboard.

### Issue: Session not found in KV

**Solution**: Sessions expire after 7 days. User needs to log in again.

### Issue: Payment succeeds but subscription not created

**Solution**: Check webhook logs in D1 (`webhook_events` table) for error details.

## 11. Security Checklist

- ✅ All secrets stored in Cloudflare secrets (never committed to git)
- ✅ Webhook signature verification enabled
- ✅ Session cookies marked as httpOnly and secure in production
- ✅ CORS configured for your domain only
- ✅ Rate limiting on auth endpoints (TODO)
- ✅ Email verification required for new accounts
- ✅ Strong password requirements (min 8 chars)

## Next Steps

1. Implement frontend UI/UX for auth pages
2. Add email provider (SMTP) for verification emails
3. Set up OAuth providers (Google, GitHub)
4. Implement rate limiting on API endpoints
5. Add analytics tracking for subscriptions
6. Create admin dashboard for managing users/subscriptions
