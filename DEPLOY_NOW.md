# Wells AI - Deploy Now Quick Guide

**Status:** ✅ READY FOR PRODUCTION
**Time Required:** 30-45 minutes
**Confidence:** 85%

---

## TL;DR - Critical Actions Required

Before deploying, you MUST:

1. ✅ Get Clerk production keys
2. ✅ Update Google Calendar redirect URI in console
3. ✅ Run database migrations
4. ✅ Add environment variables to Vercel
5. ✅ Update production URLs

Then: `vercel --prod` and you're live! 🚀

---

## Step-by-Step (Copy & Paste Ready)

### 1. Get Clerk Production Keys (5 min)

Visit: https://dashboard.clerk.com

```bash
# Add to Vercel
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
# Enter: pk_live_... (from Clerk dashboard)

vercel env add CLERK_SECRET_KEY production
# Enter: sk_live_... (from Clerk dashboard)
```

---

### 2. Update Google Calendar (3 min)

Visit: https://console.cloud.google.com/apis/credentials

Find OAuth Client ID: `676649645644-cfg88sveispgtpacj8bvfblv4i2uaifj.apps.googleusercontent.com`

Add authorized redirect URI:
```
https://wells-ai-github-ready.vercel.app/api/calendar/connect/google
```

Update environment variable:
```bash
vercel env add GOOGLE_CALENDAR_REDIRECT_URI production
# Enter: https://wells-ai-github-ready.vercel.app/api/calendar/connect/google
```

---

### 3. Add All Environment Variables (10 min)

```bash
cd "/Users/jonahmanning/Library/Mobile Documents/com~apple~CloudDocs/Wells/wells-ai-github-ready"

# AI & Search
vercel env add ANTHROPIC_API_KEY production
# Enter: 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

vercel env add BRAVE_SEARCH_API_KEY production
# Enter: BSA4hWtee7UznsAe7uV5ie3Xid4HlSn

# Storage
vercel env add BLOB_READ_WRITE_TOKEN production
# Enter: vercel_blob_rw_BYuRNiYIZF8mI0UN_WgSv4PcEC8JzE98bgzHEdD5BrTFA6s

# Email
vercel env add RESEND_API_KEY production
# Enter: re_8aeymUmE_9Wc651vr3fDjwnuLYtcSJjpR

vercel env add RESEND_FROM_EMAIL production
# Enter: wells@wellsonyx.com

vercel env add ENCRYPTION_MASTER_SECRET production
# Enter: iMUwa5DQjfxSuHyiydjJHj9iFcnUKphskYAvghoZKw4=

# Calendar
vercel env add CALENDAR_ENCRYPTION_KEY production
# Enter: 176b79d8fddcc18de8f69bec1cc33328800299e1437fec65f2e37fbed4316b51

vercel env add GOOGLE_CALENDAR_CLIENT_ID production
# Enter: 676649645644-cfg88sveispgtpacj8bvfblv4i2uaifj.apps.googleusercontent.com

vercel env add GOOGLE_CALENDAR_CLIENT_SECRET production
# Enter: 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

# Database
vercel env add wellsmemory_DATABASE_URL production
# Enter: postgres://b288371bbbbb29cd267aa0ade8770d4ac1243b8a7cb697ffc39601fe023830ef:sk_Jd7l0MLiqHCr2Lu3Q9psH@db.prisma.io:5432/postgres?sslmode=require

vercel env add wellsmemory_POSTGRES_URL production
# Enter: postgres://b288371bbbbb29cd267aa0ade8770d4ac1243b8a7cb697ffc39601fe023830ef:sk_Jd7l0MLiqHCr2Lu3Q9psH@db.prisma.io:5432/postgres?sslmode=require

vercel env add wellsmemory_PRISMA_DATABASE_URL production
# Enter: prisma+postgres://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RfaWQiOjEsInNlY3VyZV9rZXkiOiJza19KZDdsME1MaXFIQ3IyTHUzUTlwc0giLCJhcGlfa2V5IjoiMDFLOTU0QlRWVEgyQTZRNEY3MVE1OVFNQUQiLCJ0ZW5hbnRfaWQiOiJiMjg4MzcxYmJiYmIyOWNkMjY3YWEwYWRlODc3MGQ0YWMxMjQzYjhhN2NiNjk3ZmZjMzk2MDFmZTAyMzgzMGVmIiwiaW50ZXJuYWxfc2VjcmV0IjoiMTcxMDk5NzEtMGJjMy00ZjJjLThhMzEtZjU4ZjIzYjgwZDRmIn0.OW4_VzgYFVbJdBEBzO75w3grR6MXq6ui2RnLp0Zqa8w

vercel env add DATABASE_URL production
# Enter: postgresql://placeholder:placeholder@placeholder:5432/placeholder

# URLs
vercel env add NEXT_PUBLIC_APP_URL production
# Enter: https://wells-ai-github-ready.vercel.app

vercel env add NEXT_PUBLIC_BASE_URL production
# Enter: https://wells-ai-github-ready.vercel.app

# Optional: Payments (Airwallex)
vercel env add AIRWALLEX_CLIENT_ID production
# Enter: liGAUBVoRh-YWfE4-XAjUA

vercel env add AIRWALLEX_API_KEY production
# Enter: a13c521800a2d267b469dfa8c1e2c27a00fecf2062679086eaea59d4c22c77f3771934820a756165a8a37bf55191f6ad

vercel env add AIRWALLEX_ACCOUNT_ID production
# Enter: le_ftLSrwDuPDWGbf93on0BFQ

vercel env add AIRWALLEX_API_URL production
# Enter: https://api.airwallex.com

# Optional: SMS (Twilio)
vercel env add TWILIO_ACCOUNT_SID production
# Enter: AC7c941e7f376b57f8b818a2f93aca33f7

vercel env add TWILIO_AUTH_TOKEN production
# Enter: 0b33a9203f8cb867304b7410b0299c77

vercel env add TWILIO_PHONE_NUMBER production
# Enter: +18339175812
```

Verify all added:
```bash
vercel env ls production
```

---

### 4. Run Database Migrations (5 min)

**IMPORTANT:** Backup database first!

```bash
# Backup production database
pg_dump $wellsmemory_DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Run calendar schema
psql $wellsmemory_DATABASE_URL < scripts/schema-calendar.sql

# Run inbox schema
psql $wellsmemory_DATABASE_URL < scripts/schema-inbox.sql

# Verify tables created
psql $wellsmemory_DATABASE_URL -c "\dt user_calendar_connections"
psql $wellsmemory_DATABASE_URL -c "\dt inbound_messages"
```

---

### 5. Test Build Locally (5 min)

```bash
cd "/Users/jonahmanning/Library/Mobile Documents/com~apple~CloudDocs/Wells/wells-ai-github-ready"

# Clean and build
npm run clean
npm install
npm run type-check
npm run build
```

Expected output:
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
```

---

### 6. Deploy to Production (2 min)

```bash
# Deploy now!
vercel --prod
```

Expected output:
```
🔍  Inspect: https://vercel.com/...
✅  Production: https://wells-ai-github-ready.vercel.app
```

---

### 7. Verify Deployment (5 min)

**Test immediately:**

1. Visit: https://wells-ai-github-ready.vercel.app
2. Click "Sign In" - Clerk should work
3. Chat with Wells: "Hello!"
4. Upload a PDF file
5. Ask Wells to search: "What's the latest AI news?"

**Check logs:**
```bash
vercel logs --follow
```

---

## What Gets Deployed

### New Features:
✅ Web Search (Brave Search API)
✅ File Storage (Vercel Blob)
✅ Email Services (Resend)
✅ Calendar Integration (Google Calendar)
✅ Document Processing (PDF/images)
✅ Unified Inbox (multi-channel)
✅ Natural AI Personality
✅ 7 Action Tools

### Modified:
- `/api/chat` - Enhanced with tools
- Email configuration system
- Storage integration

### Database Changes:
- 13 new tables (calendar + inbox)
- UserEmailConfig table (Prisma)

---

## Rollback Plan (If Needed)

### Via Vercel Dashboard:
1. Go to: https://vercel.com/dashboard
2. Project: wells-ai-github-ready
3. Deployments tab
4. Find previous deployment
5. Click "Promote to Production"

### Via CLI:
```bash
vercel ls
vercel promote [previous-deployment-url]
```

### Database Rollback:
```bash
# Restore from backup
psql $wellsmemory_DATABASE_URL < backup_[timestamp].sql
```

---

## Monitoring After Deployment

### First Hour:
```bash
# Watch logs
vercel logs --follow

# Check for errors
vercel logs | grep -i "error"
```

### Dashboard:
- Vercel: https://vercel.com/dashboard
- Sentry: https://sentry.io
- Database: Prisma Data Platform

---

## Common Issues & Quick Fixes

### "Clerk authentication failed"
```bash
# Re-add Clerk keys
vercel env rm CLERK_SECRET_KEY production
vercel env add CLERK_SECRET_KEY production
```

### "Database connection failed"
```bash
# Check DATABASE_URL
vercel env ls DATABASE_URL production
# Verify it matches your production database
```

### "Blob upload failed"
```bash
# Check BLOB_READ_WRITE_TOKEN
vercel env ls BLOB_READ_WRITE_TOKEN production
```

### "Calendar OAuth fails"
```bash
# Verify redirect URI in Google Console
# Must be: https://wells-ai-github-ready.vercel.app/api/calendar/connect/google
```

---

## Success Checklist

After deployment, verify:

- [ ] Homepage loads (no 500 errors)
- [ ] Can sign in with Clerk
- [ ] Chat with Wells works
- [ ] File upload works
- [ ] Web search returns results
- [ ] Email sending works
- [ ] Calendar connection works
- [ ] No errors in Vercel logs
- [ ] Database queries working (< 100ms)
- [ ] All API routes responding

---

## Support & Documentation

**Detailed Guides:**
- `DEPLOYMENT_CHECKLIST.md` - Complete step-by-step
- `PRODUCTION_ENV_SETUP.md` - All environment variables
- `DEPLOYMENT_READINESS.md` - Full status report

**Quick References:**
- `WELLS_AI_QUICK_START.md` - Feature overview
- `COMMIT_SUMMARY.md` - Git commit guide

**Service Status:**
- Vercel: https://www.vercel-status.com
- Anthropic: https://status.anthropic.com
- Resend: https://status.resend.com

**Contact:**
- Engineering: jonah@wellsonyx.com
- Emergency: Follow rollback plan above

---

## Estimated Timeline

| Step | Time | Cumulative |
|------|------|------------|
| 1. Clerk Keys | 5 min | 5 min |
| 2. Google Calendar | 3 min | 8 min |
| 3. Environment Variables | 10 min | 18 min |
| 4. Database Migration | 5 min | 23 min |
| 5. Local Build Test | 5 min | 28 min |
| 6. Deploy | 2 min | 30 min |
| 7. Verify | 5 min | 35 min |

**Total: 30-45 minutes** (depending on familiarity)

---

## Ready to Deploy?

If all checkboxes are complete:

- [x] Read this guide
- [ ] Clerk keys obtained
- [ ] Google Calendar redirect URI updated
- [ ] Environment variables ready
- [ ] Database backup created
- [ ] Local build tested

Then run:
```bash
vercel --prod
```

**Good luck! 🚀**

---

Generated: November 13, 2025
Last Updated: November 13, 2025
