#!/bin/bash
# Production Secrets Health Check
# Verifies that all required production secrets are set

set -e

echo "🏥 Checking Production Secrets..."
echo ""

REQUIRED_SECRETS=(
  "BETTER_AUTH_SECRET"
  "SOLIDGATE_SECRET_KEY"
  "SOLIDGATE_WEBHOOK_SECRET"
)

# Get list of configured secrets
echo "Fetching secret list from Cloudflare..."
SECRET_LIST=$(wrangler secret list 2>&1)

if echo "$SECRET_LIST" | grep -q "error\|Error"; then
  echo "❌ Failed to fetch secrets. Are you logged in?"
  echo "   Run: wrangler login"
  exit 1
fi

echo ""
ALL_SET=true

# Check each required secret
for secret in "${REQUIRED_SECRETS[@]}"; do
  if echo "$SECRET_LIST" | grep -q "$secret"; then
    echo "✅ $secret is set"
  else
    echo "❌ $secret is NOT set"
    echo "   Run: wrangler secret put $secret"
    ALL_SET=false
  fi
done

echo ""
if [ "$ALL_SET" = true ]; then
  echo "✅ All production secrets are configured!"
  exit 0
else
  echo "❌ Some production secrets are missing"
  echo "   Set them using: wrangler secret put <SECRET_NAME>"
  exit 1
fi
