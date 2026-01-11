# Health Check Scripts

Collection of health check scripts to verify proper configuration of the Webtoon platform.

## Available Scripts

### 1. Comprehensive Health Check

**Command:** `npm run healthcheck`

Runs all health checks in one command:
- ✅ Local secrets configuration (.dev.vars)
- ✅ .gitignore security settings
- ✅ API endpoints functionality
- ✅ Cache headers presence
- ✅ Production secrets (if logged in)

**Example Output:**
```bash
╔════════════════════════════════════════╗
║   🏥 Webtoon Health Check Suite       ║
╚════════════════════════════════════════╝

🔐 Checking Local Secrets (.dev.vars)...
✅ BETTER_AUTH_SECRET
✅ SOLIDGATE_SECRET_KEY
✅ SOLIDGATE_WEBHOOK_SECRET
✅ CLOUDFLARE_STREAM_CUSTOMER_CODE
✅ CLOUDFLARE_STREAM_FALLBACK_VIDEO_ID

🌐 Checking API Endpoints (http://localhost:5173)...
✅ Health (/api/health)
✅ Plans (/api/plans)
   Cache: HIT; ttl=604800
✅ Series Core (/api/series/...)
   Cache: HIT; ttl=86400

==================================================
SUMMARY
==================================================
✅ Local secrets configured
✅ .gitignore properly configured
✅ API endpoints healthy
✅ Production secrets configured

🎉 All health checks passed!
```

---

### 2. Local Secrets Check

**Command:** `npm run healthcheck:local`

Verifies that `.dev.vars` is properly configured with all required secrets.

**Checks:**
- `.dev.vars` file exists
- All required secrets are set
- Secrets don't use placeholder values

**Example:**
```bash
./scripts/healthcheck-local.sh

🏥 Running Local Health Checks...

✅ .dev.vars exists
✅ BETTER_AUTH_SECRET is configured
✅ SOLIDGATE_SECRET_KEY is configured
✅ SOLIDGATE_WEBHOOK_SECRET is configured
✅ CLOUDFLARE_STREAM_CUSTOMER_CODE is configured
✅ CLOUDFLARE_STREAM_FALLBACK_VIDEO_ID is configured

✅ All local secrets configured correctly!
```

---

### 3. API Health Check

**Command:** `npm run healthcheck:api [URL]`

Tests all API endpoints to ensure they're responding correctly.

**Checks:**
- `/api/health` - Worker health status
- `/api/plans` - Subscription plans endpoint
- `/api/series/:id` - Series metadata endpoint
- `/api/series/:id/access` - Series access control
- `/api/series/:id/stats` - Series statistics
- Cache headers presence

**Usage:**
```bash
# Check local development
npm run healthcheck:api

# Check production
./scripts/healthcheck-api.sh https://your-worker.workers.dev

# Check staging
./scripts/healthcheck-api.sh https://staging.your-worker.workers.dev
```

**Example Output:**
```bash
🏥 Running API Health Checks...
Target: http://localhost:5173

Checking /api/health...
✅ Health endpoint working
Checking /api/plans...
✅ Plans endpoint working (3 plans)
Checking /api/series/...
✅ Series endpoint working (Title: Midnight Confessions)

Checking cache headers...
✅ Cache-Status header present: HIT; ttl=86400

✅ All API endpoints healthy!
```

---

### 4. Production Secrets Check

**Command:** `npm run healthcheck:production`

Verifies that all required production secrets are set in Cloudflare.

**Prerequisites:**
- Must be logged in: `wrangler login`

**Checks:**
- All required secrets are set
- Connects to Cloudflare Workers

**Example:**
```bash
./scripts/healthcheck-production.sh

🏥 Checking Production Secrets...

Fetching secret list from Cloudflare...

✅ BETTER_AUTH_SECRET is set
✅ SOLIDGATE_SECRET_KEY is set
✅ SOLIDGATE_WEBHOOK_SECRET is set

✅ All production secrets are configured!
```

---

## When to Run Health Checks

### Before Starting Development
```bash
npm run healthcheck:local
```
Ensures your `.dev.vars` is properly configured.

### Before Committing Code
```bash
npm run healthcheck
```
Verifies everything is working locally.

### Before Deploying to Production
```bash
npm run healthcheck:production
npm run healthcheck:api https://your-worker.workers.dev
```
Ensures production secrets are set and deployment is healthy.

### In CI/CD Pipeline
```bash
npm run healthcheck:api https://staging.workers.dev
```
Automated testing after deployment.

---

## Troubleshooting

### Script Permission Denied

```bash
chmod +x scripts/*.sh scripts/*.js
```

### "wrangler: command not found"

```bash
npm install -g wrangler
# or
npx wrangler login
```

### ".dev.vars not found"

```bash
cp .env.example .dev.vars
# Edit .dev.vars with your secrets
```

### API endpoints failing

```bash
# Make sure dev server is running
npm run dev

# Then in another terminal
npm run healthcheck:api
```

---

## Exit Codes

All scripts use standard exit codes:

| Code | Meaning | Action |
|------|---------|--------|
| 0 | All checks passed | ✅ Safe to proceed |
| 1 | Critical issues found | ❌ Fix before deploying |

Use in CI/CD:
```bash
npm run healthcheck || exit 1
```

---

## Adding New Health Checks

To add a new health check:

1. **Create new script:**
   ```bash
   touch scripts/healthcheck-mycheck.sh
   chmod +x scripts/healthcheck-mycheck.sh
   ```

2. **Add to package.json:**
   ```json
   {
     "scripts": {
       "healthcheck:mycheck": "./scripts/healthcheck-mycheck.sh"
     }
   }
   ```

3. **Update comprehensive check:**
   Edit `scripts/healthcheck.js` to include your new check.

---

## Related Documentation

- [Secret Management Guide](../docs/SECRET_MANAGEMENT.md)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/commands/)
