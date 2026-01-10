# Solidgate Setup Steps

Quick guide to get your Solidgate credentials and configure your environment.

## Step 1: Create Solidgate Account

1. Go to https://solidgate.com
2. Click "Sign Up" or "Get Started"
3. Complete the registration form
4. Verify your email address
5. Complete merchant onboarding (business details, etc.)

## Step 2: Get API Credentials

### Find Your Credentials:

1. **Log in to Solidgate Dashboard**
2. **Go to Settings → API Keys** (or Developer → API Keys)
3. **Copy the following values:**

   - **Merchant ID** - Your unique merchant identifier
   - **Public Key** - For client-side payment forms
   - **Secret Key** - For server-side API calls (KEEP SECRET!)
   - **Webhook Secret** - For verifying webhook signatures (KEEP SECRET!)

### Update Your `.env` File:

Replace these lines in `.env` and `.dev.vars`:

```bash
SOLIDGATE_MERCHANT_ID=your_actual_merchant_id
SOLIDGATE_SECRET_KEY=your_actual_secret_key
SOLIDGATE_PUBLIC_KEY=your_actual_public_key
SOLIDGATE_WEBHOOK_SECRET=your_actual_webhook_secret
```

## Step 3: Create Products in Solidgate

### Create Monthly Plan:

1. Go to **Products** → **Create Product**
2. Fill in:
   - **Name**: Premium Monthly
   - **Price**: 9.99 USD
   - **Billing Period**: Monthly
   - **Trial Period**: 7 days (optional)
3. Click **Save**
4. **Copy the Product ID** (looks like: `prod_abc123xyz`)

### Create Yearly Plan:

1. Create another product:
   - **Name**: Premium Yearly
   - **Price**: 99.99 USD
   - **Billing Period**: Yearly
   - **Trial Period**: 7 days (optional)
2. **Copy the Product ID**

### Update Database with Product IDs:

```bash
# Update local database
npx wrangler d1 execute webtoon-db --local --command "
UPDATE plans SET solidgate_product_id = 'prod_YOUR_MONTHLY_ID' WHERE id = 'plan_monthly';
UPDATE plans SET solidgate_product_id = 'prod_YOUR_YEARLY_ID' WHERE id = 'plan_yearly';
"

# Update remote database (when ready for production)
npx wrangler d1 execute webtoon-db --remote --command "
UPDATE plans SET solidgate_product_id = 'prod_YOUR_MONTHLY_ID' WHERE id = 'plan_monthly';
UPDATE plans SET solidgate_product_id = 'prod_YOUR_YEARLY_ID' WHERE id = 'plan_yearly';
"
```

## Step 4: Configure Webhook (For Local Testing)

### Option A: Using Cloudflare Tunnel (Recommended)

```bash
# Start your dev server
npm run dev

# In another terminal, create a tunnel
npx wrangler tunnel --url http://localhost:5174
```

You'll get a URL like: `https://abc-def-ghi.trycloudflare.com`

### Option B: Using ngrok

```bash
# Install ngrok: https://ngrok.com/download
ngrok http 5174
```

You'll get a URL like: `https://abc123.ngrok.io`

### Configure Webhook in Solidgate:

1. Go to **Settings → Webhooks**
2. Click **Add Webhook**
3. Enter URL: `https://your-tunnel-url/api/webhooks/solidgate`
4. Select events to listen for:
   - ✅ `payment.success`
   - ✅ `subscription.created`
   - ✅ `subscription.renewed`
   - ✅ `subscription.canceled`
   - ✅ `subscription.expired`
   - ✅ `refund.success`
5. Click **Save**
6. **Copy the Webhook Secret** and update your `.env`:
   ```bash
   SOLIDGATE_WEBHOOK_SECRET=whsec_your_webhook_secret
   ```

## Step 5: Test Mode vs Live Mode

Solidgate has two modes:

- **Test Mode** - Use test credentials for development
- **Live Mode** - Real payments with real cards

Make sure you're using **Test Mode credentials** in development!

### Test Cards (Solidgate):

- **Success**: `4111 1111 1111 1111`
- **Decline**: `4000 0000 0000 0002`
- **Require 3DS**: `4000 0027 6000 3184`

Use any future expiry date and any 3-digit CVV.

## Step 6: Verify Setup

Run this checklist:

```bash
# 1. Check that .env has all Solidgate values
cat .env | grep SOLIDGATE

# 2. Verify database plans have product IDs
npx wrangler d1 execute webtoon-db --local --command "SELECT id, name, solidgate_product_id FROM plans;"

# 3. Test webhook endpoint (should return "Missing signature")
curl -X POST http://localhost:5174/api/webhooks/solidgate

# 4. Start dev server
npm run dev
```

## Production Deployment

When ready for production:

### Set Production Secrets in Cloudflare:

```bash
# Set each secret (you'll be prompted to enter the value)
npx wrangler secret put SOLIDGATE_MERCHANT_ID
npx wrangler secret put SOLIDGATE_SECRET_KEY
npx wrangler secret put SOLIDGATE_PUBLIC_KEY
npx wrangler secret put SOLIDGATE_WEBHOOK_SECRET
```

### Update Webhook URL:

Change webhook URL in Solidgate dashboard from tunnel URL to your production domain:
```
https://your-domain.com/api/webhooks/solidgate
```

## Common Issues

### "Invalid signature" error
- Make sure `SOLIDGATE_WEBHOOK_SECRET` matches the secret in Solidgate dashboard
- Check that you're using the webhook secret, not the API secret

### "Product not found" error
- Verify product IDs in database match Solidgate product IDs
- Make sure you updated the plans table after creating products

### Webhook not receiving events
- Check that tunnel is running
- Verify webhook URL is correct in Solidgate dashboard
- Check Solidgate webhook logs for delivery attempts

## Support

- **Solidgate Documentation**: https://docs.solidgate.com
- **API Reference**: https://docs.solidgate.com/api
- **Support**: support@solidgate.com

---

**Next Step**: Once you have your Solidgate credentials, proceed to building the login and signup pages.
