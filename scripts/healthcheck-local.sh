#!/bin/bash
# Local Development Health Check
# Verifies that .dev.vars is configured correctly

set -e

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
  "CLOUDFLARE_STREAM_CUSTOMER_CODE"
  "CLOUDFLARE_STREAM_FALLBACK_VIDEO_ID"
)

ALL_CONFIGURED=true

for secret in "${REQUIRED_SECRETS[@]}"; do
  if grep -q "^${secret}=" .dev.vars && ! grep -q "^${secret}=your_" .dev.vars; then
    echo "✅ $secret is configured"
  else
    echo "❌ $secret is missing or using placeholder"
    ALL_CONFIGURED=false
  fi
done

echo ""

if [ "$ALL_CONFIGURED" = true ]; then
  echo "✅ All local secrets configured correctly!"
  exit 0
else
  echo "❌ Some secrets need configuration"
  echo "   Edit .dev.vars with your actual values"
  exit 1
fi
