#!/bin/bash

# Wells Onyx AI Ops Deployment Script
# Deploy operations from command line or integrate with chat tools

# Your deployment secret (keep this private!)
DEPLOYMENT_SECRET="cBXjR7LFgE5KQTQ6xSBM9t/4lo1/Il6xR/8RpMApFWk="

# API endpoint
API_URL="https://wellsai.vercel.app/api/deploy/ai-ops"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Wells Onyx AI Ops Deployment${NC}"
echo ""

# Check if operation details provided
if [ "$1" == "" ]; then
  echo -e "${YELLOW}Usage:${NC}"
  echo "  ./deploy-from-chat.sh \"Operation Name\" \"category\" \"description\""
  echo ""
  echo -e "${YELLOW}Categories:${NC}"
  echo "  sales | procurement | hiring | finance | customer_service"
  echo ""
  echo -e "${YELLOW}Example:${NC}"
  echo "  ./deploy-from-chat.sh \"Daily Lead Gen\" \"sales\" \"Find 50 leads and send outreach\""
  echo ""
  echo -e "${YELLOW}Quick Deploy (uses defaults):${NC}"
  echo "  ./deploy-from-chat.sh quick"
  exit 0
fi

# Quick deploy option
if [ "$1" == "quick" ]; then
  OPERATION_NAME="Test Operation $(date +%H:%M:%S)"
  CATEGORY="sales"
  DESCRIPTION="Quick test deployment from chat script"
else
  OPERATION_NAME="$1"
  CATEGORY="${2:-sales}"
  DESCRIPTION="${3:-Deployed via chat script}"
fi

echo -e "${YELLOW}Deploying operation:${NC}"
echo "  Name: $OPERATION_NAME"
echo "  Category: $CATEGORY"
echo "  Description: $DESCRIPTION"
echo ""

# Create the JSON payload
PAYLOAD=$(cat <<EOF
{
  "deploymentSecret": "$DEPLOYMENT_SECRET",
  "operation": {
    "name": "$OPERATION_NAME",
    "category": "$CATEGORY",
    "description": "$DESCRIPTION",
    "frequency": "daily",
    "schedule": "09:00"
  }
}
EOF
)

# Make the API call
echo -e "${YELLOW}Deploying...${NC}"
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

# Check if successful
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ Deployment successful!${NC}"
  echo ""
  echo "$RESPONSE" | jq '.'
else
  echo -e "${RED}❌ Deployment failed${NC}"
  echo ""
  echo "$RESPONSE" | jq '.'
fi
