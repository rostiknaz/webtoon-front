#!/bin/bash
# API Health Check
# Verifies all API endpoints are working correctly

set -e

BASE_URL="${1:-http://localhost:5173}"

echo "🏥 Running API Health Checks..."
echo "Target: $BASE_URL"
echo ""

ALL_HEALTHY=true

# Health endpoint
echo "Checking /api/health..."
HEALTH=$(curl -s "$BASE_URL/api/health" || echo "FAILED")
if echo "$HEALTH" | grep -q "\"status\":\"ok\""; then
  echo "✅ Health endpoint working"
else
  echo "❌ Health endpoint failed"
  echo "   Response: $HEALTH"
  ALL_HEALTHY=false
fi

# Plans endpoint
echo "Checking /api/plans..."
PLANS=$(curl -s "$BASE_URL/api/plans" || echo "FAILED")
if echo "$PLANS" | grep -q "\"success\":true"; then
  PLAN_COUNT=$(echo "$PLANS" | grep -o "\"id\":" | wc -l | tr -d ' ')
  echo "✅ Plans endpoint working ($PLAN_COUNT plans)"
else
  echo "❌ Plans endpoint failed"
  echo "   Response: $PLANS"
  ALL_HEALTHY=false
fi

# Series endpoint
SERIES_ID="a49ab52f-71ab-477f-b886-bc762fb72e64"
echo "Checking /api/series/$SERIES_ID..."
SERIES=$(curl -s "$BASE_URL/api/series/$SERIES_ID" || echo "FAILED")
if echo "$SERIES" | grep -q "\"title\":"; then
  TITLE=$(echo "$SERIES" | grep -o "\"title\":\"[^\"]*\"" | cut -d'"' -f4)
  echo "✅ Series endpoint working (Title: $TITLE)"
else
  echo "❌ Series endpoint failed"
  echo "   Response: $SERIES"
  ALL_HEALTHY=false
fi

# Series access endpoint
echo "Checking /api/series/$SERIES_ID/access..."
ACCESS=$(curl -s "$BASE_URL/api/series/$SERIES_ID/access" || echo "FAILED")
if echo "$ACCESS" | grep -q "\"user\""; then
  echo "✅ Series access endpoint working"
else
  echo "❌ Series access endpoint failed"
  echo "   Response: $ACCESS"
  ALL_HEALTHY=false
fi

# Series stats endpoint
echo "Checking /api/series/$SERIES_ID/stats..."
STATS=$(curl -s "$BASE_URL/api/series/$SERIES_ID/stats" || echo "FAILED")
if echo "$STATS" | grep -q "\"totalViews\""; then
  echo "✅ Series stats endpoint working"
else
  echo "❌ Series stats endpoint failed"
  echo "   Response: $STATS"
  ALL_HEALTHY=false
fi

# Check cache headers
echo ""
echo "Checking cache headers..."
CACHE_HEADER=$(curl -sI "$BASE_URL/api/series/$SERIES_ID" | grep -i "cache-status" || echo "")
if echo "$CACHE_HEADER" | grep -q "HIT\|MISS"; then
  STATUS=$(echo "$CACHE_HEADER" | sed 's/.*cache-status: //' | tr -d '\r')
  echo "✅ Cache-Status header present: $STATUS"
else
  echo "⚠️  No Cache-Status header found (may be expected in some configs)"
fi

echo ""
if [ "$ALL_HEALTHY" = true ]; then
  echo "✅ All API endpoints healthy!"
  exit 0
else
  echo "❌ Some endpoints failed. Check errors above."
  exit 1
fi
