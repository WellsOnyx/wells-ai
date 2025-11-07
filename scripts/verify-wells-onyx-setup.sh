#!/bin/bash

# Wells Onyx Campaign API - Setup Verification Script
# Run this to verify the installation is complete

set -e

echo "🔍 Verifying Wells Onyx Campaign API Setup..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track status
ALL_GOOD=true

# Check 1: Main API Route
echo -n "📄 Checking main API route... "
if [ -f "app/api/gtm/wells-onyx/campaign/route.ts" ]; then
    LINES=$(wc -l < "app/api/gtm/wells-onyx/campaign/route.ts")
    echo -e "${GREEN}✓${NC} ($LINES lines)"
else
    echo -e "${RED}✗ Missing${NC}"
    ALL_GOOD=false
fi

# Check 2: Example Component
echo -n "📄 Checking example component... "
if [ -f "app/api/gtm/wells-onyx/campaign/example-usage.tsx" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Missing${NC}"
    ALL_GOOD=false
fi

# Check 3: Tests
echo -n "📄 Checking test file... "
if [ -f "app/api/gtm/wells-onyx/campaign/__tests__/route.test.ts" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Missing${NC}"
    ALL_GOOD=false
fi

# Check 4: Documentation
echo -n "📄 Checking API documentation... "
if [ -f "docs/WELLS_ONYX_CAMPAIGN_API.md" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Missing${NC}"
    ALL_GOOD=false
fi

# Check 5: Prisma Schema
echo -n "📄 Checking Prisma schema update... "
if grep -q "model WellsOnyxCampaign" prisma/schema.prisma; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Missing WellsOnyxCampaign model${NC}"
    ALL_GOOD=false
fi

# Check 6: Wells Onyx Launcher
echo -n "📄 Checking wells-onyx-launcher... "
if [ -f "lib/gtm/wells-onyx-launcher.ts" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Missing${NC}"
    ALL_GOOD=false
fi

# Check 7: Wells Onyx Templates
echo -n "📄 Checking wells-onyx-templates... "
if [ -f "lib/gtm/wells-onyx-templates.ts" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Missing${NC}"
    ALL_GOOD=false
fi

# Check 8: Prisma Client
echo -n "📦 Checking Prisma client... "
if [ -d "node_modules/.prisma/client" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠ Not generated${NC}"
    echo "   Run: npx prisma generate"
fi

# Check 9: Environment Variables
echo ""
echo "🔐 Checking environment variables:"

check_env() {
    if grep -q "^$1=" .env 2>/dev/null; then
        echo -e "   $1: ${GREEN}✓${NC}"
    else
        echo -e "   $1: ${YELLOW}⚠ Not set${NC}"
        if [ "$2" = "required" ]; then
            ALL_GOOD=false
        fi
    fi
}

check_env "DATABASE_URL" "required"
check_env "CLERK_SECRET_KEY" "required"
check_env "ANTHROPIC_API_KEY" "required"
check_env "INSTANTLY_API_KEY" "optional"

# Check 10: Dependencies
echo ""
echo "📦 Checking dependencies:"

check_dep() {
    if grep -q "\"$1\"" package.json; then
        echo -e "   $1: ${GREEN}✓${NC}"
    else
        echo -e "   $1: ${RED}✗ Missing${NC}"
        ALL_GOOD=false
    fi
}

check_dep "@clerk/nextjs"
check_dep "@prisma/client"
check_dep "zod"

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$ALL_GOOD" = true ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run: npx prisma migrate dev --name add_wells_onyx_campaigns"
    echo "2. Run: npx prisma generate"
    echo "3. Test with: curl -X POST http://localhost:3000/api/gtm/wells-onyx/campaign"
    echo ""
    echo "📖 See WELLS_ONYX_QUICK_START.md for usage examples"
else
    echo -e "${RED}❌ Some checks failed${NC}"
    echo ""
    echo "Please fix the issues above before proceeding."
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# File tree
echo "📂 File Structure:"
echo ""
echo "app/api/gtm/wells-onyx/campaign/"
echo "├── route.ts                    # Main API endpoints"
echo "├── example-usage.tsx           # React component"
echo "├── README.md                   # Quick reference"
echo "└── __tests__/"
echo "    └── route.test.ts           # Jest tests"
echo ""
echo "docs/"
echo "└── WELLS_ONYX_CAMPAIGN_API.md  # Complete documentation"
echo ""
echo "prisma/"
echo "└── schema.prisma               # WellsOnyxCampaign model"
echo ""
echo "lib/gtm/"
echo "├── wells-onyx-launcher.ts      # Campaign generation"
echo "└── wells-onyx-templates.ts     # Practice group templates"
echo ""

# API Summary
echo "🚀 API Endpoints:"
echo ""
echo "POST   /api/gtm/wells-onyx/campaign          # Create campaign"
echo "GET    /api/gtm/wells-onyx/campaign          # Get campaign status"
echo "PATCH  /api/gtm/wells-onyx/campaign          # Update campaign"
echo ""

# Practice Groups
echo "🎯 Practice Groups:"
echo ""
echo "• cybersecurity - Cybersecurity & Data Privacy Leadership"
echo "• fintech       - Fintech & Payments Leadership"
echo "• aerospace     - Aerospace & Defense Leadership"
echo "• healthcare    - Healthcare & MedTech Leadership"
echo "• saas          - SaaS & Enterprise Software Leadership"
echo ""

exit 0
