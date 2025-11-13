# Wells AI Production Deployment Checklist

## Complete Guide for Deploying Wells AI to Vercel Production

**Project:** Wells AI
**Target:** Vercel Production
**Database:** Postgres (Prisma Accelerate)
**Domain:** wells-ai-github-ready.vercel.app (or custom domain)

---

## Pre-Deployment Checklist

### 1. Code Review
- [ ] All uncommitted changes reviewed
- [ ] No sensitive data in code (API keys, secrets)
- [ ] No debugging console.logs in production paths
- [ ] Error handling in place for all API routes
- [ ] Loading states implemented in UI

### 2. Dependencies
- [ ] Run `npm audit` and fix critical vulnerabilities
- [ ] Verify all dependencies in `package.json` are needed
- [ ] Check for any deprecated packages
- [ ] Ensure `package-lock.json` is committed

### 3. Environment Variables
- [ ] Review `PRODUCTION_ENV_SETUP.md` for complete list
- [ ] All required variables identified
- [ ] Production API keys obtained (not test keys)
- [ ] Encryption keys securely generated and stored

### 4. Database
- [ ] Production database created
- [ ] Database migrations ready
- [ ] Backup strategy in place
- [ ] Connection strings tested

---

## Step 1: Prepare Production Environment Variables

### A. Critical Variables (Must Have)

```bash
# Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# AI & Search
ANTHROPIC_API_KEY=sk-ant-...
BRAVE_SEARCH_API_KEY=BSA...

# Database
DATABASE_URL=postgresql://...
wellsmemory_DATABASE_URL=postgres://...
wellsmemory_POSTGRES_URL=postgres://...
wellsmemory_PRISMA_DATABASE_URL=prisma+postgres://...

# Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...

# Email
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=wells@wellsonyx.com
ENCRYPTION_MASTER_SECRET=...

# Calendar
CALENDAR_ENCRYPTION_KEY=...
GOOGLE_CALENDAR_CLIENT_ID=...
GOOGLE_CALENDAR_CLIENT_SECRET=...
GOOGLE_CALENDAR_REDIRECT_URI=https://[PRODUCTION_DOMAIN]/api/calendar/connect/google

# Application URLs
NEXT_PUBLIC_APP_URL=https://[PRODUCTION_DOMAIN]
NEXT_PUBLIC_BASE_URL=https://[PRODUCTION_DOMAIN]
```

### B. Add Variables to Vercel

**Option 1: Via CLI (Recommended)**
```bash
cd "/Users/jonahmanning/Library/Mobile Documents/com~apple~CloudDocs/Wells/wells-ai-github-ready"

# Add each variable
vercel env add ANTHROPIC_API_KEY production
vercel env add BRAVE_SEARCH_API_KEY production
# ... continue for all variables
```

**Option 2: Via Dashboard**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select `wells-ai-github-ready` project
3. Settings → Environment Variables
4. Add each variable with environment: `Production`

### C. Verify Variables Added
```bash
vercel env ls production
```

---

## Step 2: Update OAuth Redirect URIs

### Google Calendar
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your OAuth 2.0 Client ID
3. Under "Authorized redirect URIs", add:
   ```
   https://wells-ai-github-ready.vercel.app/api/calendar/connect/google
   ```
4. Save changes

### Clerk (if needed)
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Configure → Paths
3. Update redirect URLs to production domain

---

## Step 3: Database Migration

### A. Run Migrations on Production Database

**Important:** Test migrations on staging first!

```bash
# Generate Prisma client
npx prisma generate

# Run migrations (dry run first)
npx prisma migrate deploy --preview-feature

# Apply migrations
npx prisma migrate deploy
```

### B. Run Custom SQL Migrations

```bash
# Calendar tables
psql $DATABASE_URL < scripts/schema-calendar.sql

# Inbox tables
psql $DATABASE_URL < scripts/schema-inbox.sql

# Other tables (if needed)
psql $DATABASE_URL < scripts/schema-erp.sql
psql $DATABASE_URL < scripts/schema-negotiation.sql
```

### C. Verify Database Schema

```bash
# Check tables exist
psql $DATABASE_URL -c "\dt"

# Check specific tables
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
```

---

## Step 4: Pre-Deployment Testing

### A. Build Locally

```bash
cd "/Users/jonahmanning/Library/Mobile Documents/com~apple~CloudDocs/Wells/wells-ai-github-ready"

# Clean previous builds
npm run clean

# Install dependencies
npm install

# Run type check
npm run type-check

# Build application
npm run build
```

**Expected Output:**
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
```

### B. Test Build Locally

```bash
# Start production build locally
npm start

# Test in browser: http://localhost:3000
```

**Test Checklist:**
- [ ] Homepage loads
- [ ] Chat interface works
- [ ] File upload works
- [ ] Login/logout with Clerk works
- [ ] No console errors

---

## Step 5: Deploy to Vercel

### A. Deploy via CLI (Recommended)

```bash
cd "/Users/jonahmanning/Library/Mobile Documents/com~apple~CloudDocs/Wells/wells-ai-github-ready"

# Login to Vercel (if not already)
vercel login

# Deploy to production
vercel --prod
```

**Expected Output:**
```
🔍  Inspect: https://vercel.com/...
✅  Production: https://wells-ai-github-ready.vercel.app
```

### B. Alternative: Deploy via Git Push

```bash
# Commit all changes
git add .
git commit -m "Production deployment: Wells AI with all features"

# Push to main branch (triggers auto-deploy)
git push origin main
```

---

## Step 6: Post-Deployment Verification

### A. Verify Deployment Status

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Check deployment status: "Ready"
3. Review build logs for errors

### B. Test Production Site

**Critical Paths to Test:**

1. **Homepage**
   - [ ] Visit: `https://wells-ai-github-ready.vercel.app`
   - [ ] Page loads without errors
   - [ ] Wells AI logo visible

2. **Authentication**
   - [ ] Click "Sign In"
   - [ ] Clerk modal appears
   - [ ] Can sign in successfully
   - [ ] Redirects to `/app`

3. **Chat Interface**
   - [ ] Send message: "Hello Wells"
   - [ ] Receives response from Claude
   - [ ] Response is natural (Wells personality working)

4. **Document Upload**
   - [ ] Upload PDF or image
   - [ ] File uploads to Vercel Blob
   - [ ] Wells processes and responds about document

5. **Web Search**
   - [ ] Ask: "Search for the latest AI news"
   - [ ] Wells uses Brave Search API
   - [ ] Returns search results

6. **Email Tool**
   - [ ] Ask: "Send an email to test@example.com saying hello"
   - [ ] Wells sends email via Resend
   - [ ] Confirmation received

7. **Calendar (if configured)**
   - [ ] Connect calendar
   - [ ] OAuth flow works
   - [ ] Events sync

### C. Monitor Logs

```bash
# View production logs
vercel logs --follow
```

**Watch for:**
- API errors
- Database connection issues
- Rate limit warnings
- Authentication failures

---

## Step 7: Configure Production Settings

### A. Custom Domain (Optional)

1. Go to Vercel Dashboard → Project Settings → Domains
2. Add custom domain: `wellsai.com`
3. Update DNS records as instructed
4. Wait for DNS propagation
5. Update environment variables with new domain

### B. Performance & Caching

1. Go to Project Settings → Functions
2. Set Function Regions: `iad1` (US East - closest to users)
3. Enable Edge Caching for static assets

### C. Error Monitoring (Sentry)

Already configured via `sentry.*.config.ts` files:
- [ ] Verify Sentry errors appear in dashboard
- [ ] Configure alert rules
- [ ] Set up Slack notifications

---

## Step 8: Database Backup Strategy

### A. Manual Backup

```bash
# Backup production database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### B. Automated Backups

**Vercel Postgres:**
- Automatic daily backups included
- Retain for 7 days (Hobby plan)

**External Backup (Recommended):**
1. Set up cron job for daily backups
2. Store in S3 or similar
3. Test restore procedure

---

## Rollback Plan

### If Deployment Fails:

**Option 1: Rollback via Vercel Dashboard**
1. Go to Deployments tab
2. Find last working deployment
3. Click "Promote to Production"

**Option 2: Rollback via CLI**
```bash
# List recent deployments
vercel ls

# Promote specific deployment
vercel promote [deployment-url]
```

### If Database Migration Fails:

```bash
# Revert last migration
npx prisma migrate resolve --rolled-back [migration_name]

# Restore from backup
psql $DATABASE_URL < backup_[timestamp].sql
```

---

## Post-Deployment Tasks

### Immediate (Within 1 Hour)

- [ ] Monitor Vercel deployment logs
- [ ] Check error tracking (Sentry)
- [ ] Test all critical user flows
- [ ] Verify API rate limits not exceeded
- [ ] Check database connection pool

### Within 24 Hours

- [ ] Monitor user feedback
- [ ] Check analytics for errors
- [ ] Review API usage costs
- [ ] Verify email delivery rates
- [ ] Test calendar sync is working

### Within 1 Week

- [ ] Review performance metrics
- [ ] Optimize slow API routes
- [ ] Check database query performance
- [ ] Review and optimize bundle size
- [ ] Set up uptime monitoring (UptimeRobot, etc.)

---

## Common Issues & Solutions

### Issue: Build Fails with "Module not found"

**Solution:**
```bash
# Clear cache and rebuild
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue: Database Connection Timeout

**Solution:**
- Check `DATABASE_URL` is correct
- Verify database is accessible from Vercel
- Check database connection pool limits

### Issue: Clerk Authentication Not Working

**Solution:**
- Verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set
- Check Clerk dashboard for domain configuration
- Ensure redirect URLs are updated for production

### Issue: Blob Storage Upload Fails

**Solution:**
- Verify `BLOB_READ_WRITE_TOKEN` is set
- Check Vercel Blob storage quota
- Review file size limits (default 4.5MB)

### Issue: Calendar OAuth Fails

**Solution:**
- Verify redirect URI in Google Console
- Check `GOOGLE_CALENDAR_REDIRECT_URI` env var
- Ensure HTTPS (not HTTP) in production

---

## Monitoring & Alerts

### Set Up Monitoring

1. **Vercel Analytics**
   - Enable in Project Settings
   - Monitor page load times
   - Track Web Vitals

2. **Sentry**
   - Already configured
   - Set up alert rules
   - Configure Slack integration

3. **Uptime Monitoring**
   - Use UptimeRobot or Pingdom
   - Monitor: `https://wells-ai-github-ready.vercel.app/api/health`
   - Alert on downtime

### Key Metrics to Track

- API response times
- Error rates
- Database query performance
- Blob storage usage
- Email delivery rates
- User authentication success rate

---

## Success Criteria

Deployment is successful when:

- [ ] Application is accessible at production URL
- [ ] All environment variables configured correctly
- [ ] Database migrations completed successfully
- [ ] Clerk authentication working
- [ ] Chat with Wells AI working
- [ ] Document upload working
- [ ] Web search working
- [ ] Email sending working
- [ ] Calendar integration working (if enabled)
- [ ] No critical errors in logs
- [ ] Performance meets expectations (< 3s page load)
- [ ] All user flows tested and working

---

## Emergency Contacts

**Vercel Support:**
- Dashboard: https://vercel.com/help
- Status: https://www.vercel-status.com

**Service Providers:**
- Anthropic Support: https://support.anthropic.com
- Clerk Support: https://clerk.com/support
- Resend Support: https://resend.com/support

**Internal:**
- Engineering Lead: jonah@wellsonyx.com
- DevOps: (if applicable)

---

## Deployment Complete!

Once all checklist items are complete:

1. Document deployment in team wiki/Notion
2. Notify stakeholders of successful deployment
3. Share production URL with team
4. Schedule post-deployment review meeting
5. Update internal documentation with any learnings

**Production URL:**
https://wells-ai-github-ready.vercel.app

**Next Steps:**
- Monitor for 24-48 hours
- Gather user feedback
- Plan next feature deployment
