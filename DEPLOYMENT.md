# Production Deployment Guide

Complete step-by-step guide for deploying the webtoon streaming platform to Cloudflare Workers.

---

## Prerequisites

Before deploying, ensure you have:

- [x] Node.js 18+ installed
- [x] Wrangler CLI installed (`npm install -g wrangler` or use `npx wrangler`)
- [x] Cloudflare account with Workers enabled
- [x] Git repository connected to Cloudflare (optional for auto-deploy)

---

## Step 1: Login to Cloudflare

```bash
npx wrangler login
```

This will open a browser window to authenticate with your Cloudflare account.

**Verify login:**
```bash
npx wrangler whoami
```

Expected output: Your email and account ID.

---

## Step 2: Install Dependencies

```bash
npm install
```

This installs all required packages including:
- Hono framework
- Drizzle ORM
- Better Auth
- Cloudflare Workers types

---

## Step 3: Build Production Bundle

```bash
# Run TypeScript type checking
npx tsc --noEmit

# Build for production
npm run build
```

**Expected output:**
- `dist/webtoon_front/` - Worker bundle
- `dist/client/` - Static assets (React app)

**Troubleshooting:**
- If TypeScript errors occur, check `tsconfig.*.json` files
- Ensure all imports are correct and types are defined

---

## Step 4: Deploy to Cloudflare Workers

### Option A: Automatic Deployment (Git Integration)

If your Worker is connected to a git repository:

```bash
# Commit changes
git add .
git commit -m "Deploy to production"

# Push to master branch
git push origin master
```

Cloudflare will automatically deploy when you push to the configured branch.

### Option B: Manual Deployment (Recommended for first deploy)

```bash
npx wrangler deploy
```

**Expected output:**
```
✨ Success! Uploaded 11 files
Deployed webtoon-front triggers (4.50 sec)
  https://webtoon-front.<your-username>.workers.dev
Current Version ID: <version-id>
```

**Verify deployment:**
```bash
npx wrangler deployments list
```

---

## Step 5: Set Production Secrets

Production secrets are sensitive values that should NOT be committed to git.

### Required Secrets

#### 1. Authentication Secret (REQUIRED)

Generate a secure random string:
```bash
openssl rand -base64 32
```

Set the secret:
```bash
npx wrangler secret put BETTER_AUTH_SECRET
# Paste the generated value when prompted
```

#### 2. Solidgate Payment Secrets (Optional - only if using payments)

Get these values from your [Solidgate Dashboard](https://dashboard.solidgate.com/):

```bash
# Set Solidgate secret key
npx wrangler secret put SOLIDGATE_SECRET_KEY
# Enter your secret key from Solidgate

# Set webhook secret
npx wrangler secret put SOLIDGATE_WEBHOOK_SECRET
# Enter webhook secret from Solidgate
```

**Note:** The platform works without Solidgate secrets, but payment webhooks won't function.

### Verify Secrets

```bash
npx wrangler secret list
```

Expected output:
```
[
  { name: "BETTER_AUTH_SECRET", type: "secret_text" },
  { name: "SOLIDGATE_SECRET_KEY", type: "secret_text" },
  { name: "SOLIDGATE_WEBHOOK_SECRET", type: "secret_text" }
]
```

---

## Step 6: Database Setup

### Check Database Tables

Verify all tables exist:
```bash
npx wrangler d1 execute webtoon-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Expected tables:
- `accounts`, `episodes`, `payment_transactions`, `plans`
- `series`, `sessions`, `subscriptions`, `user_episode_access`
- `user_likes`, `users`, `verifications`, `watch_history`, `webhook_events`

### Apply Migrations (if needed)

If tables don't exist, apply migrations:
```bash
npx wrangler d1 execute webtoon-db --remote --file=db/migrations/0000_nifty_supernaut.sql
```

### Seed Database

The database should already be seeded from previous deployments. Verify:

```bash
# Check plans
npx wrangler d1 execute webtoon-db --remote --command "SELECT id, name, price FROM plans"

# Check series count
npx wrangler d1 execute webtoon-db --remote --command "SELECT COUNT(*) as count FROM series"

# Check episodes count
npx wrangler d1 execute webtoon-db --remote --command "SELECT COUNT(*) as count FROM episodes"
```

Expected:
- **3 plans** (Free, Premium Monthly, Premium Yearly)
- **1 series** ("Midnight Confessions")
- **12 episodes** (9 free, 3 premium)

---

## Step 7: Verify Deployment

### Test Health Endpoint

```bash
curl https://webtoon-front.<your-username>.workers.dev/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-11T15:00:00.000Z",
  "worker": "webtoon-front"
}
```

### Test Plans API

```bash
curl https://webtoon-front.<your-username>.workers.dev/api/plans | jq
```

Should return 3 subscription plans.

### Test Series API

Get series ID:
```bash
npx wrangler d1 execute webtoon-db --remote --command "SELECT id FROM series LIMIT 1" --json | jq -r '.[0].results[0].id'
```

Test endpoint (replace `<SERIES_ID>` with actual ID):
```bash
curl https://webtoon-front.<your-username>.workers.dev/api/series/<SERIES_ID> | jq
```

Should return series with 12 episodes.

### Test Frontend

Visit in browser:
```
https://webtoon-front.<your-username>.workers.dev
```

Expected: Homepage loads with series cards.

---

## Step 8: Configure Environment Variables (Optional)

Update production URLs in `wrangler.jsonc` if needed:

```jsonc
{
  "vars": {
    "BETTER_AUTH_URL": "https://your-custom-domain.com",
    "VITE_BETTER_AUTH_URL": "https://your-custom-domain.com",
    "CLOUDFLARE_STREAM_CUSTOMER_CODE": "your_customer_code",
    "CLOUDFLARE_STREAM_FALLBACK_VIDEO_ID": "your_fallback_video_id"
  }
}
```

After updating, redeploy:
```bash
npx wrangler deploy
```

---

## Step 9: Configure Cloudflare Stream (Optional)

To use real video content:

1. **Upload videos to Cloudflare Stream:**
   ```bash
   npx wrangler stream upload path/to/video.mp4
   ```

2. **Update episode video IDs:**
   ```bash
   npx wrangler d1 execute webtoon-db --remote --command "UPDATE episodes SET video_id = '<stream-video-id>' WHERE episode_number = 1"
   ```

---

## Step 10: Set Up Custom Domain (Optional)

### Add Custom Domain

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your Worker (`webtoon-front`)
3. Go to Settings → Domains & Routes
4. Click "Add Custom Domain"
5. Enter your domain (e.g., `app.yourdomain.com`)
6. Follow DNS configuration steps

### Update Environment Variables

After adding custom domain, update `wrangler.jsonc`:

```jsonc
{
  "vars": {
    "BETTER_AUTH_URL": "https://app.yourdomain.com",
    "VITE_BETTER_AUTH_URL": "https://app.yourdomain.com"
  }
}
```

Redeploy:
```bash
npx wrangler deploy
```

---

## Troubleshooting

### Issue: "Secret edit failed"

**Error:**
```
Secret edit failed. You attempted to modify a secret, but the latest version
of your Worker isn't currently deployed.
```

**Solution:** Deploy first, then set secrets:
```bash
npx wrangler deploy
npx wrangler secret put BETTER_AUTH_SECRET
```

---

### Issue: "Table already exists"

**Error:**
```
table `accounts` already exists at offset 13: SQLITE_ERROR
```

**Solution:** Tables are already migrated. Skip migration step and proceed to seeding.

---

### Issue: "Worker returns 500 error"

**Possible causes:**
1. Missing `BETTER_AUTH_SECRET` secret
2. Database not seeded
3. Build errors

**Solution:**
```bash
# Check worker logs
npx wrangler tail

# Verify secrets are set
npx wrangler secret list

# Verify database has data
npx wrangler d1 execute webtoon-db --remote --command "SELECT COUNT(*) FROM plans"
```

---

### Issue: "CORS errors in browser"

**Solution:** CORS middleware is configured in `worker/index.ts`. Check that it's enabled:
```typescript
app.use('*', cors());
```

---

### Issue: "Build fails with TypeScript errors"

**Common causes:**
- Import paths incorrect
- Missing type definitions
- Drizzle schema changes

**Solution:**
```bash
# Check specific error
npx tsc --noEmit

# Fix imports and types
# Rebuild
npm run build
```

---

## Monitoring & Logs

### View Real-Time Logs

```bash
npx wrangler tail
```

Filter by:
- Status: `npx wrangler tail --status error`
- IP: `npx wrangler tail --ip 1.2.3.4`

### View Metrics

```bash
npx wrangler metrics
```

Or visit: [Cloudflare Dashboard → Workers & Pages → Analytics](https://dash.cloudflare.com)

---

## Rollback Deployment

If deployment fails or has issues:

### Option 1: Rollback via Wrangler

```bash
# List deployments
npx wrangler deployments list

# Rollback to previous version
npx wrangler rollback <deployment-id>
```

### Option 2: Rollback via Git

```bash
# Revert last commit
git revert HEAD
git push origin master
```

---

## CI/CD Integration (Optional)

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [master]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

**Set GitHub Secret:**
1. Go to Repository → Settings → Secrets
2. Add `CLOUDFLARE_API_TOKEN`
3. Get token from: [Cloudflare Dashboard → API Tokens](https://dash.cloudflare.com/profile/api-tokens)

---

## Production Checklist

Before going live, verify:

- [ ] All TypeScript errors resolved
- [ ] Build succeeds without warnings
- [ ] Worker deployed successfully
- [ ] `BETTER_AUTH_SECRET` set
- [ ] Database tables exist (14 tables)
- [ ] Database seeded (3 plans, 1 series, 12 episodes)
- [ ] Health endpoint returns 200 OK
- [ ] Plans API returns 3 plans
- [ ] Series API returns series with episodes
- [ ] Frontend loads in browser
- [ ] Authentication works (sign up/sign in)
- [ ] Cache headers present in API responses
- [ ] No errors in `wrangler tail` logs
- [ ] Custom domain configured (optional)
- [ ] Solidgate secrets set (optional, for payments)
- [ ] Cloudflare Stream configured (optional, for real videos)

---

## Quick Reference Commands

```bash
# Login
npx wrangler login

# Build
npm run build

# Deploy
npx wrangler deploy

# Set secret
npx wrangler secret put SECRET_NAME

# List secrets
npx wrangler secret list

# Execute SQL
npx wrangler d1 execute webtoon-db --remote --command "SELECT * FROM plans"

# View logs
npx wrangler tail

# List deployments
npx wrangler deployments list

# Rollback
npx wrangler rollback <deployment-id>
```

---

## Support & Resources

- **Cloudflare Workers Docs:** https://developers.cloudflare.com/workers/
- **Drizzle ORM Docs:** https://orm.drizzle.team/
- **Hono Framework Docs:** https://hono.dev/
- **Cloudflare D1 Docs:** https://developers.cloudflare.com/d1/

---

## Summary

You've successfully deployed your webtoon streaming platform to Cloudflare Workers! 🎉

**Production URL:** `https://webtoon-front.<your-username>.workers.dev`

**Key Features Deployed:**
- ✅ Hono API with Drizzle ORM
- ✅ React frontend with TanStack Router
- ✅ Better Auth authentication
- ✅ D1 database with 3 plans, 1 series, 12 episodes
- ✅ KV caching for performance
- ✅ Health checks and monitoring

**Next Steps:**
1. Set Solidgate secrets for payment processing
2. Upload real videos to Cloudflare Stream
3. Create additional series and episodes
4. Configure custom domain
5. Monitor logs and metrics

Enjoy your live platform! 🚀
