# Secret Management Guide

> Complete guide to managing environment variables and secrets for Cloudflare Workers with the Vite plugin

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Environment-Specific Configuration](#environment-specific-configuration)
- [Health Check Scripts](#health-check-scripts)
- [Troubleshooting](#troubleshooting)
- [Security Best Practices](#security-best-practices)

---

## Overview

This project uses **Cloudflare Workers** with the **Vite plugin** for deployment. Secret management follows Cloudflare's best practices for security and developer experience.

### Key Concepts

| Concept | Description | Example |
|---------|-------------|---------|
| **Secrets** | Sensitive data that should never be visible | API keys, passwords, tokens |
| **Environment Variables** | Non-sensitive configuration | Customer codes, URLs, feature flags |
| **Bindings** | Cloudflare-specific resources | D1 databases, KV namespaces, R2 buckets |

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Local Development                    │
│  .dev.vars → Worker Runtime → Access via c.env.*   │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│                   Production                         │
│  wrangler secret → Worker Runtime → Access via c.env.*│
└─────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Clone and Setup

```bash
# Clone repository
git clone <your-repo>
cd webtoon-front

# Install dependencies
npm install

# Copy environment template
cp .env.example .dev.vars
```

### 2. Configure Secrets

Edit `.dev.vars` with your local secrets:

```bash
# .dev.vars (NEVER commit this file!)
BETTER_AUTH_SECRET=your_random_secret_here
SOLIDGATE_SECRET_KEY=your_solidgate_secret
SOLIDGATE_WEBHOOK_SECRET=your_webhook_secret
# ... other secrets
```

**Generate secure secrets:**
```bash
# Generate random secret
openssl rand -base64 32
```

### 3. Start Development

```bash
npm run dev
# Server starts at http://localhost:5173
```

### 4. Run Health Checks

```bash
# Check all secrets are loaded
npm run healthcheck

# Or manually
node scripts/healthcheck.js
```

---

## Local Development

### Using `.dev.vars` (Recommended)

The Cloudflare Vite plugin **prioritizes `.dev.vars`** over `.env` files.

**✅ Correct Setup:**
```bash
# Use .dev.vars for all secrets
.dev.vars
```

**❌ Avoid:**
```bash
# Don't use .env when using Cloudflare Vite plugin
.env  # Will be ignored if .dev.vars exists
```

### `.dev.vars` Format

```bash
# Simple key=value pairs (no export, no quotes needed)
BETTER_AUTH_SECRET=mysecret123
SOLIDGATE_WEBHOOK_SECRET=webhook_abc

# For URLs with special chars, use quotes
BETTER_AUTH_URL="http://localhost:5173"

# Comments are supported
# This is a comment
```

### Accessing Secrets in Worker Code

```typescript
// worker/routes/webhooks.ts
webhooks.post('/solidgate', async (c) => {
  // Access secret from environment bindings
  const secret = c.env.SOLIDGATE_WEBHOOK_SECRET;

  // Verify webhook signature
  const isValid = await verifySignature(
    body,
    signature,
    secret // ← Secret from c.env
  );
});
```

### What's Available in Development?

All variables from `.dev.vars` are automatically loaded and accessible via `c.env.*`:

```typescript
// Available in development
c.env.BETTER_AUTH_SECRET
c.env.SOLIDGATE_SECRET_KEY
c.env.SOLIDGATE_WEBHOOK_SECRET
c.env.CLOUDFLARE_STREAM_CUSTOMER_CODE
// etc...
```

---

## Production Deployment

### Step 1: Set Secrets (One-Time Setup)

Use `wrangler secret put` to set production secrets:

```bash
# Set each secret individually
wrangler secret put BETTER_AUTH_SECRET
# Prompt: Enter a secret value: ••••••••••

wrangler secret put SOLIDGATE_SECRET_KEY
# Prompt: Enter a secret value: ••••••••••

wrangler secret put SOLIDGATE_WEBHOOK_SECRET
# Prompt: Enter a secret value: ••••••••••
```

**Important:**
- ⚠️ Secret values are **write-only** - you cannot view them after setting
- ⚠️ Updating a secret creates a new Worker version and deploys immediately
- ✅ Secret names (not values) are visible via `wrangler secret list`

### Step 2: Configure Non-Sensitive Variables

For **non-sensitive** configuration, use `wrangler.jsonc`:

```jsonc
{
  "name": "webtoon-front",
  "vars": {
    "CLOUDFLARE_STREAM_CUSTOMER_CODE": "9u10nm8oora2n5zb",
    "CLOUDFLARE_STREAM_FALLBACK_VIDEO_ID": "e173ed29029287118d810abce2ea35c5"
  }
}
```

**When to use `vars` vs `secrets`:**

| Use `vars` | Use `secrets` |
|------------|---------------|
| Customer codes | API keys |
| Feature flags | Passwords |
| Public URLs | Tokens |
| Non-sensitive IDs | Webhook secrets |

### Step 3: Build and Deploy

```bash
# Build the project
npm run build

# Deploy to production
wrangler deploy

# Verify deployment
curl https://your-worker.workers.dev/api/health
```

### Managing Production Secrets

```bash
# List all secret names (not values)
wrangler secret list

# Update a secret (redeploys immediately)
wrangler secret put SOLIDGATE_WEBHOOK_SECRET

# Delete a secret
wrangler secret delete OLD_SECRET_NAME

# Bulk operation (interactive)
wrangler secret bulk <secrets.json>
```

---

## Environment-Specific Configuration

### Multiple Environments (Staging, Production)

Configure different environments in `wrangler.jsonc`:

```jsonc
{
  "name": "webtoon-front",
  "vars": {
    "ENVIRONMENT": "production"
  },
  "env": {
    "staging": {
      "name": "webtoon-front-staging",
      "vars": {
        "ENVIRONMENT": "staging",
        "CLOUDFLARE_STREAM_CUSTOMER_CODE": "staging_customer_code"
      }
    },
    "production": {
      "name": "webtoon-front-production",
      "vars": {
        "ENVIRONMENT": "production",
        "CLOUDFLARE_STREAM_CUSTOMER_CODE": "production_customer_code"
      }
    }
  }
}
```

### Deploy to Specific Environment

```bash
# Deploy to staging
wrangler deploy --env staging

# Set staging-specific secret
wrangler secret put SOLIDGATE_SECRET_KEY --env staging

# Deploy to production
wrangler deploy --env production

# Set production-specific secret
wrangler secret put SOLIDGATE_SECRET_KEY --env production
```

### Local Environment Files

```bash
# Development (default)
.dev.vars

# Staging environment
.dev.vars.staging

# Production environment (rarely needed locally)
.dev.vars.production
```

Activate specific environment:

```bash
# Use staging config
CLOUDFLARE_ENV=staging npm run dev

# Use production config
CLOUDFLARE_ENV=production npm run dev
```

---

## Health Check Scripts

### Overview

Health check scripts verify that:
1. All required secrets are configured
2. Worker can access secrets correctly
3. API endpoints are functioning
4. Cache is working properly

### 1. Local Health Check

**File:** `scripts/healthcheck-local.sh`

```bash
#!/bin/bash
# Check local development environment

echo "🏥 Running Local Health Checks..."
echo ""

# Check .dev.vars exists
if [ ! -f .dev.vars ]; then
  echo "❌ .dev.vars file not found!"
  echo "   Run: cp .env.example .dev.vars"
  exit 1
fi
echo "✅ .dev.vars exists"

# Check required secrets are set
REQUIRED_SECRETS=(
  "BETTER_AUTH_SECRET"
  "SOLIDGATE_SECRET_KEY"
  "SOLIDGATE_WEBHOOK_SECRET"
)

for secret in "${REQUIRED_SECRETS[@]}"; do
  if grep -q "^${secret}=" .dev.vars && ! grep -q "^${secret}=your_" .dev.vars; then
    echo "✅ $secret is configured"
  else
    echo "❌ $secret is missing or using placeholder"
    exit 1
  fi
done

echo ""
echo "✅ All local secrets configured correctly!"
```

**Usage:**
```bash
chmod +x scripts/healthcheck-local.sh
./scripts/healthcheck-local.sh
```

### 2. API Health Check

**File:** `scripts/healthcheck-api.sh`

```bash
#!/bin/bash
# Check API endpoints

BASE_URL="${1:-http://localhost:5173}"

echo "🏥 Running API Health Checks..."
echo "Target: $BASE_URL"
echo ""

# Health endpoint
echo "Checking /api/health..."
HEALTH=$(curl -s "$BASE_URL/api/health")
if echo "$HEALTH" | grep -q "\"status\":\"ok\""; then
  echo "✅ Health endpoint working"
else
  echo "❌ Health endpoint failed"
  exit 1
fi

# Plans endpoint
echo "Checking /api/plans..."
PLANS=$(curl -s "$BASE_URL/api/plans")
if echo "$PLANS" | grep -q "\"success\":true"; then
  echo "✅ Plans endpoint working"
else
  echo "❌ Plans endpoint failed"
  exit 1
fi

# Series endpoint
SERIES_ID="a49ab52f-71ab-477f-b886-bc762fb72e64"
echo "Checking /api/series/$SERIES_ID..."
SERIES=$(curl -s "$BASE_URL/api/series/$SERIES_ID")
if echo "$SERIES" | grep -q "\"title\":"; then
  echo "✅ Series endpoint working"
else
  echo "❌ Series endpoint failed"
  exit 1
fi

# Check cache headers
echo ""
echo "Checking cache headers..."
CACHE_HEADER=$(curl -sI "$BASE_URL/api/series/$SERIES_ID" | grep -i "cache-status")
if echo "$CACHE_HEADER" | grep -q "HIT\|MISS"; then
  echo "✅ Cache-Status header present: $CACHE_HEADER"
else
  echo "⚠️  No Cache-Status header found"
fi

echo ""
echo "✅ All API endpoints healthy!"
```

**Usage:**
```bash
# Check local development
./scripts/healthcheck-api.sh

# Check production
./scripts/healthcheck-api.sh https://your-worker.workers.dev
```

### 3. Production Secrets Check

**File:** `scripts/healthcheck-production.sh`

```bash
#!/bin/bash
# Verify production secrets are set

echo "🏥 Checking Production Secrets..."
echo ""

REQUIRED_SECRETS=(
  "BETTER_AUTH_SECRET"
  "SOLIDGATE_SECRET_KEY"
  "SOLIDGATE_WEBHOOK_SECRET"
)

# Get list of configured secrets
SECRET_LIST=$(wrangler secret list 2>&1)

if echo "$SECRET_LIST" | grep -q "error"; then
  echo "❌ Failed to fetch secrets. Are you logged in?"
  echo "   Run: wrangler login"
  exit 1
fi

# Check each required secret
for secret in "${REQUIRED_SECRETS[@]}"; do
  if echo "$SECRET_LIST" | grep -q "$secret"; then
    echo "✅ $secret is set"
  else
    echo "❌ $secret is NOT set"
    echo "   Run: wrangler secret put $secret"
    exit 1
  fi
done

echo ""
echo "✅ All production secrets are configured!"
```

**Usage:**
```bash
./scripts/healthcheck-production.sh
```

### 4. Complete Health Check

**File:** `scripts/healthcheck.js`

```javascript
#!/usr/bin/env node
/**
 * Comprehensive health check script
 * Checks local, API, and optionally production
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function checkLocalSecrets() {
  log('\n🔐 Checking Local Secrets (.dev.vars)...', 'blue');

  if (!existsSync('.dev.vars')) {
    log('❌ .dev.vars not found!', 'red');
    log('   Run: cp .env.example .dev.vars', 'yellow');
    return false;
  }

  const devVars = readFileSync('.dev.vars', 'utf-8');
  const requiredSecrets = [
    'BETTER_AUTH_SECRET',
    'SOLIDGATE_SECRET_KEY',
    'SOLIDGATE_WEBHOOK_SECRET',
  ];

  let allConfigured = true;
  for (const secret of requiredSecrets) {
    const regex = new RegExp(`^${secret}=(?!your_)(.+)`, 'm');
    if (regex.test(devVars)) {
      log(`✅ ${secret}`, 'green');
    } else {
      log(`❌ ${secret} (missing or placeholder)`, 'red');
      allConfigured = false;
    }
  }

  return allConfigured;
}

async function checkApiHealth(baseUrl = 'http://localhost:5173') {
  log(`\n🌐 Checking API Endpoints (${baseUrl})...`, 'blue');

  const endpoints = [
    { path: '/api/health', expected: 'status' },
    { path: '/api/plans', expected: 'success' },
    {
      path: '/api/series/a49ab52f-71ab-477f-b886-bc762fb72e64',
      expected: 'title',
    },
  ];

  let allHealthy = true;
  for (const { path, expected } of endpoints) {
    try {
      const response = await fetch(`${baseUrl}${path}`);
      const data = await response.json();

      if (JSON.stringify(data).includes(expected)) {
        log(`✅ ${path}`, 'green');
      } else {
        log(`❌ ${path} (unexpected response)`, 'red');
        allHealthy = false;
      }
    } catch (error) {
      log(`❌ ${path} (${error.message})`, 'red');
      allHealthy = false;
    }
  }

  return allHealthy;
}

function checkProductionSecrets() {
  log('\n☁️  Checking Production Secrets...', 'blue');

  try {
    const output = execSync('wrangler secret list', {
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    const requiredSecrets = [
      'BETTER_AUTH_SECRET',
      'SOLIDGATE_SECRET_KEY',
      'SOLIDGATE_WEBHOOK_SECRET',
    ];

    let allSet = true;
    for (const secret of requiredSecrets) {
      if (output.includes(secret)) {
        log(`✅ ${secret}`, 'green');
      } else {
        log(`❌ ${secret} (not set)`, 'red');
        log(`   Run: wrangler secret put ${secret}`, 'yellow');
        allSet = false;
      }
    }

    return allSet;
  } catch (error) {
    log('⚠️  Could not check production secrets', 'yellow');
    log('   (This is normal if not logged in)', 'yellow');
    return null;
  }
}

async function main() {
  log('╔════════════════════════════════════════╗', 'blue');
  log('║   🏥 Webtoon Health Check Suite       ║', 'blue');
  log('╚════════════════════════════════════════╝', 'blue');

  const results = {
    local: checkLocalSecrets(),
    api: await checkApiHealth(),
    production: checkProductionSecrets(),
  };

  log('\n' + '='.repeat(40), 'blue');
  log('SUMMARY', 'blue');
  log('='.repeat(40), 'blue');

  if (results.local) {
    log('✅ Local secrets configured', 'green');
  } else {
    log('❌ Local secrets need attention', 'red');
  }

  if (results.api) {
    log('✅ API endpoints healthy', 'green');
  } else {
    log('❌ API endpoints have issues', 'red');
  }

  if (results.production === true) {
    log('✅ Production secrets configured', 'green');
  } else if (results.production === false) {
    log('❌ Production secrets need attention', 'red');
  } else {
    log('⚠️  Production secrets not checked', 'yellow');
  }

  log('='.repeat(40) + '\n', 'blue');

  const allPassed = results.local && results.api && results.production !== false;
  if (allPassed) {
    log('🎉 All health checks passed!', 'green');
    process.exit(0);
  } else {
    log('⚠️  Some health checks failed. See above for details.', 'yellow');
    process.exit(1);
  }
}

main().catch((error) => {
  log(`Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
```

**Usage:**
```bash
# Make executable
chmod +x scripts/healthcheck.js

# Run comprehensive check
node scripts/healthcheck.js

# Or via npm script
npm run healthcheck
```

### Add to package.json

```json
{
  "scripts": {
    "healthcheck": "node scripts/healthcheck.js",
    "healthcheck:local": "./scripts/healthcheck-local.sh",
    "healthcheck:api": "./scripts/healthcheck-api.sh",
    "healthcheck:production": "./scripts/healthcheck-production.sh"
  }
}
```

---

## Troubleshooting

### Common Issues

#### 1. "Secret not found" in development

**Problem:** Worker can't access secrets locally

**Solution:**
```bash
# Ensure .dev.vars exists
ls -la .dev.vars

# Check format (no export, no quotes for simple values)
cat .dev.vars

# Restart dev server
npm run dev
```

#### 2. "Secret not found" in production

**Problem:** Production deployment can't access secrets

**Solution:**
```bash
# List configured secrets
wrangler secret list

# Set missing secret
wrangler secret put MISSING_SECRET_NAME

# Redeploy
wrangler deploy
```

#### 3. Secrets not updating

**Problem:** Changes to secrets don't take effect

**Local:**
```bash
# Restart dev server
# Ctrl+C, then npm run dev
```

**Production:**
```bash
# Setting a secret auto-deploys new version
wrangler secret put SECRET_NAME

# Or force redeploy
wrangler deploy --force
```

#### 4. `.env` vs `.dev.vars` confusion

**Problem:** Using `.env` but secrets not loading

**Solution:**
```bash
# Cloudflare Vite plugin prioritizes .dev.vars
# Delete .env or rename to .dev.vars
mv .env .dev.vars

# Restart dev server
npm run dev
```

#### 5. CORS errors in production

**Problem:** API calls blocked by CORS

**Check worker has CORS middleware:**
```typescript
import { cors } from 'hono/cors';
app.use('*', cors());
```

---

## Security Best Practices

### DO ✅

1. **Use `wrangler secret put` for sensitive data**
   ```bash
   wrangler secret put API_KEY
   ```

2. **Keep `.dev.vars` in `.gitignore`**
   ```gitignore
   .dev.vars
   .dev.vars.*
   .env
   .env.*
   !.env.example
   ```

3. **Rotate secrets regularly**
   ```bash
   # Update production secret
   wrangler secret put OLD_SECRET_NAME
   ```

4. **Use different secrets per environment**
   ```bash
   wrangler secret put API_KEY --env staging
   wrangler secret put API_KEY --env production
   ```

5. **Document required secrets in `.env.example`**
   ```bash
   # Good - shows what's needed without values
   API_KEY=your_api_key_here
   ```

### DON'T ❌

1. **Never commit secrets to git**
   ```bash
   # Bad - secret in commit history
   git add .env
   ```

2. **Never use `vars` for secrets in wrangler.jsonc**
   ```jsonc
   // Bad - visible in dashboard
   {
     "vars": {
       "API_KEY": "secret123"
     }
   }
   ```

3. **Never log secrets**
   ```typescript
   // Bad
   console.log('Secret:', c.env.API_KEY);

   // Good
   console.log('Secret configured:', !!c.env.API_KEY);
   ```

4. **Never expose secrets in error messages**
   ```typescript
   // Bad
   return c.json({ error: `Invalid key: ${c.env.API_KEY}` });

   // Good
   return c.json({ error: 'Invalid API key' });
   ```

5. **Never store secrets in client-side code**
   ```typescript
   // Bad - VITE_ prefix exposes to client
   VITE_SECRET_KEY=abc123

   // Good - no VITE_ prefix
   SECRET_KEY=abc123
   ```

---

## Appendix

### Complete Secret Reference

| Secret | Required | Used For | Set Via |
|--------|----------|----------|---------|
| `BETTER_AUTH_SECRET` | ✅ | Session encryption | `wrangler secret put` |
| `SOLIDGATE_SECRET_KEY` | ✅ | Payment API | `wrangler secret put` |
| `SOLIDGATE_WEBHOOK_SECRET` | ✅ | Webhook verification | `wrangler secret put` |
| `SOLIDGATE_MERCHANT_ID` | ✅ | Payment gateway | `wrangler.jsonc vars` |
| `SOLIDGATE_PUBLIC_KEY` | ✅ | Client-side payment | `wrangler.jsonc vars` |
| `CLOUDFLARE_STREAM_CUSTOMER_CODE` | ✅ | Video streaming | `wrangler.jsonc vars` |
| `CLOUDFLARE_STREAM_FALLBACK_VIDEO_ID` | ✅ | Video fallback | `wrangler.jsonc vars` |

### Resources

- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Environment Variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)
- [Cloudflare Vite Plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [Wrangler Commands](https://developers.cloudflare.com/workers/wrangler/commands/)
- [Security Best Practices](https://developers.cloudflare.com/workers/platform/security/)

---

**Last Updated:** January 11, 2026
**Author:** Webtoon Platform Team
**Version:** 1.0.0
