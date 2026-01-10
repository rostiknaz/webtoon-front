#!/bin/bash

# Environment Verification Script
# Checks that all required environment variables are set

echo "🔍 Verifying environment configuration..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "   Please create .env file (see .env.example)"
    exit 1
fi

echo "✅ .env file exists"

# Check if .dev.vars exists
if [ ! -f .dev.vars ]; then
    echo "❌ .dev.vars file not found!"
    echo "   Please create .dev.vars file"
    exit 1
fi

echo "✅ .dev.vars file exists"
echo ""

# Function to check if variable is set and not placeholder
check_var() {
    local var_name=$1
    local var_value=$(grep "^${var_name}=" .env | cut -d '=' -f2-)

    if [ -z "$var_value" ]; then
        echo "❌ $var_name is not set"
        return 1
    elif [[ "$var_value" == *"your_"* ]] || [[ "$var_value" == *"_here"* ]]; then
        echo "⚠️  $var_name is still a placeholder (needs real value)"
        return 2
    else
        echo "✅ $var_name is configured"
        return 0
    fi
}

echo "📋 Checking required variables:"
echo ""

# Check Better Auth
echo "Better Auth:"
check_var "BETTER_AUTH_SECRET"
check_var "BETTER_AUTH_URL"
echo ""

# Check Cloudflare Stream
echo "Cloudflare Stream:"
check_var "CLOUDFLARE_STREAM_CUSTOMER_CODE"
echo ""

# Check Solidgate (these will likely be placeholders initially)
echo "Solidgate Payment Gateway:"
check_var "SOLIDGATE_MERCHANT_ID"
solidgate_status=$?
check_var "SOLIDGATE_SECRET_KEY"
check_var "SOLIDGATE_PUBLIC_KEY"
check_var "SOLIDGATE_WEBHOOK_SECRET"
echo ""

# Summary
echo "📊 Summary:"
echo ""

if [ $solidgate_status -eq 2 ]; then
    echo "⚠️  Solidgate credentials are placeholders"
    echo "   → This is OK for initial development"
    echo "   → You'll need real credentials to test payments"
    echo "   → See docs/solidgate-setup-steps.md for instructions"
    echo ""
fi

# Check if git will ignore .env
if git check-ignore -q .env && git check-ignore -q .dev.vars; then
    echo "✅ .env and .dev.vars are properly ignored by git"
else
    echo "❌ WARNING: .env or .dev.vars might be tracked by git!"
    echo "   Run: git rm --cached .env .dev.vars"
fi

echo ""
echo "🎉 Environment verification complete!"
echo ""
echo "Next steps:"
echo "  1. Get Solidgate credentials (see docs/solidgate-setup-steps.md)"
echo "  2. Update .env and .dev.vars with real Solidgate values"
echo "  3. Build login and signup pages"
echo "  4. Test authentication locally: npm run dev"
