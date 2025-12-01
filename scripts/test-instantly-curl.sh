#!/bin/bash
# Instantly API Test Script - Direct CURL
# This script tests the Instantly API with curl commands

echo "🧪 Testing Instantly API with CURL"
echo "======================================"
echo ""

# Get API key from user or use default
if [ -z "$1" ]; then
  echo "❌ Usage: $0 <your-instantly-api-key>"
  echo ""
  echo "Example:"
  echo "  $0 'abc123-def456-ghi789'"
  echo ""
  echo "Get your API key from:"
  echo "  https://app.instantly.ai/app/settings/integrations"
  echo ""
  exit 1
fi

API_KEY="$1"

echo "Using API Key: ${API_KEY:0:20}..."
echo ""

# Test 1: List Campaigns
echo "📋 Test 1: List All Campaigns"
echo "--------------------------------------"

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  "https://api.instantly.ai/api/v1/campaign/list" \
  -H "Content-Type: application/json" \
  -d "{\"api_key\":\"$API_KEY\"}")

HTTP_CODE=$(echo "$RESPONSE" | grep HTTP_CODE | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ SUCCESS - Status $HTTP_CODE"
  echo ""
  echo "$BODY" | jq -r '.campaigns[] | "- \(.name) (ID: \(.id), Status: \(.status))"' 2>/dev/null || echo "$BODY"
  echo ""

  # Extract campaign IDs
  echo "💾 Campaign IDs for Vercel:"
  echo "$BODY" | jq -r '.campaigns[0].id' 2>/dev/null | while read -r id; do
    if [ ! -z "$id" ]; then
      echo "  INSTANTLY_DEFAULT_CAMPAIGN_ID=\"$id\""
    fi
  done
else
  echo "❌ FAILED - Status $HTTP_CODE"
  echo "$BODY"
fi

echo ""

# Test 2: Account Info
echo "👤 Test 2: Get Account Information"
echo "--------------------------------------"

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  "https://api.instantly.ai/api/v1/account/get" \
  -H "Content-Type: application/json" \
  -d "{\"api_key\":\"$API_KEY\"}")

HTTP_CODE=$(echo "$RESPONSE" | grep HTTP_CODE | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ SUCCESS - Status $HTTP_CODE"
  echo ""
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo "❌ FAILED - Status $HTTP_CODE"
  echo "$BODY"
fi

echo ""
echo "======================================"
echo "✅ Test Complete!"
echo ""
echo "Next steps:"
echo "1. If successful, copy the INSTANTLY_DEFAULT_CAMPAIGN_ID above"
echo "2. Add to Vercel: vercel env add INSTANTLY_DEFAULT_CAMPAIGN_ID"
echo "3. Add API key to Vercel: vercel env add INSTANTLY_API_KEY"
echo ""
