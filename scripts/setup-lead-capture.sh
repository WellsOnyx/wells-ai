#!/bin/bash

# Setup script for GTM Lead Capture System
# Run: bash scripts/setup-lead-capture.sh

set -e

echo "🎯 Setting up Wells Onyx Lead Capture System..."
echo ""

# Check for required env vars
if [ -z "$POSTGRES_URL" ]; then
  echo "❌ Error: POSTGRES_URL environment variable not set"
  echo "   Please set it in your .env.local file"
  exit 1
fi

echo "✅ POSTGRES_URL found"

# Run database migration
echo ""
echo "📊 Running database migration..."
psql "$POSTGRES_URL" < scripts/schema-leads.sql

if [ $? -eq 0 ]; then
  echo "✅ Database schema created successfully"
else
  echo "❌ Error creating database schema"
  exit 1
fi

# Check for optional Slack webhook
echo ""
if [ -z "$SLACK_WEBHOOK_URL" ]; then
  echo "⚠️  SLACK_WEBHOOK_URL not set (optional)"
  echo "   Slack notifications will be disabled"
  echo "   Set it in .env.local to enable notifications"
else
  echo "✅ SLACK_WEBHOOK_URL found - notifications enabled"

  # Test Slack webhook
  echo ""
  echo "🔔 Testing Slack webhook..."
  curl -X POST "$SLACK_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d '{"text":"✅ Wells Onyx Lead Capture System is set up and ready!"}' \
    -s -o /dev/null -w "%{http_code}\n" | grep -q "200"

  if [ $? -eq 0 ]; then
    echo "✅ Slack webhook is working!"
  else
    echo "⚠️  Slack webhook test failed - check your webhook URL"
  fi
fi

# Verify tables were created
echo ""
echo "🔍 Verifying database tables..."

TABLES=$(psql "$POSTGRES_URL" -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('leads', 'lead_notes', 'lead_activities');")

if echo "$TABLES" | grep -q "leads"; then
  echo "✅ leads table created"
else
  echo "❌ leads table not found"
  exit 1
fi

if echo "$TABLES" | grep -q "lead_notes"; then
  echo "✅ lead_notes table created"
else
  echo "❌ lead_notes table not found"
  exit 1
fi

if echo "$TABLES" | grep -q "lead_activities"; then
  echo "✅ lead_activities table created"
else
  echo "❌ lead_activities table not found"
  exit 1
fi

# Success!
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Lead Capture System setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next steps:"
echo "   1. Start your dev server: npm run dev"
echo "   2. Test the chat: http://localhost:3000"
echo "   3. View leads dashboard: http://localhost:3000/leads"
echo ""
echo "📚 Documentation: LEAD_CAPTURE_SYSTEM.md"
echo ""
echo "🎉 Ready to capture leads!"
