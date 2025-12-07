#!/bin/bash
# ERP Integration Quick Start
# Run this to set up everything needed for "The Silent Invasion"

set -e

echo "=================================="
echo "Wells AI ERP Integration Setup"
echo '"The Silent Invasion"'
echo "=================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set"
  echo "Please add DATABASE_URL to your .env.local file"
  exit 1
fi

echo "Step 1: Installing dependencies..."
npm install @neondatabase/serverless

echo ""
echo "Step 2: Creating database tables..."
node scripts/migrate-erp.js

echo ""
echo "Step 3: Checking environment variables..."

missing_vars=()

if [ -z "$QUICKBOOKS_CLIENT_ID" ]; then
  missing_vars+=("QUICKBOOKS_CLIENT_ID")
fi

if [ -z "$QUICKBOOKS_CLIENT_SECRET" ]; then
  missing_vars+=("QUICKBOOKS_CLIENT_SECRET")
fi

if [ -z "$XERO_CLIENT_ID" ]; then
  missing_vars+=("XERO_CLIENT_ID")
fi

if [ -z "$XERO_CLIENT_SECRET" ]; then
  missing_vars+=("XERO_CLIENT_SECRET")
fi

if [ ${#missing_vars[@]} -gt 0 ]; then
  echo ""
  echo "WARNING: Missing environment variables:"
  for var in "${missing_vars[@]}"; do
    echo "  - $var"
  done
  echo ""
  echo "To set up QuickBooks:"
  echo "  1. Go to https://developer.intuit.com/"
  echo "  2. Create a new app"
  echo "  3. Add QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET to .env.local"
  echo ""
  echo "To set up Xero:"
  echo "  1. Go to https://developer.xero.com/"
  echo "  2. Create a new app"
  echo "  3. Add XERO_CLIENT_ID and XERO_CLIENT_SECRET to .env.local"
  echo ""
else
  echo "All required environment variables are set!"
fi

echo ""
echo "=================================="
echo "Setup Complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo "  1. Start your dev server: npm run dev"
echo "  2. Visit http://localhost:3000/erp/connect"
echo "  3. Connect your QuickBooks or Xero account"
echo "  4. View payables at http://localhost:3000/erp/payables"
echo ""
echo "Documentation:"
echo "  - Setup guide: ERP_INTEGRATION_GUIDE.md"
echo "  - Deployment: ERP_DEPLOYMENT_CHECKLIST.md"
echo ""
echo "Revenue model:"
echo "  - 1% fee per payment"
echo "  - Silent vendor enrollment"
echo "  - Exponential network growth"
echo ""
echo "Let the invasion begin..."
echo ""
