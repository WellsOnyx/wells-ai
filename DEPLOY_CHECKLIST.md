# Wells AI Transaction Engine - Deployment Checklist

**Ready to Deploy: November 8, 2025**

---

## Pre-Deployment

### 1. Environment Variables
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key
- [ ] `CLERK_SECRET_KEY` - Clerk secret key
- [ ] `AIRWALLEX_CLIENT_ID` - Airwallex client ID
- [ ] `AIRWALLEX_API_KEY` - Airwallex API key
- [ ] `AIRWALLEX_ACCOUNT_ID` - Airwallex account ID
- [ ] `AIRWALLEX_API_URL` - Set to `https://api.airwallex.com` (prod) or `https://api-demo.airwallex.com` (test)

### 2. Database Setup
```bash
# Run migrations
npx prisma migrate deploy

# Verify tables created
npx prisma db pull
```

**Expected Tables:**
- [x] Transaction
- [x] TransactionEvent
- [x] UserTrustScore
- [x] RFQ
- [x] SellerProfile
- [x] SellerQuote

### 3. Code Quality
```bash
# Type check
npm run type-check

# Lint
npm run lint

# Build test
npm run build
```

### 4. Local Testing
```bash
# Start dev server
npm run dev

# Run transaction flow test
npx tsx scripts/test-transaction-flow.ts
```

**Expected Results:**
- ✓ Deal accepted
- ✓ Escrow created
- ✓ Transaction completed
- ✓ Trust score updated

---

## Deployment Steps

### Step 1: Deploy to Vercel
```bash
# Preview deployment (test)
npm run deploy:preview

# Production deployment
npm run deploy:prod
```

### Step 2: Verify Environment
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Confirm all variables set for Production
3. Redeploy if any variables changed

### Step 3: Database Migration
- Vercel automatically runs `postinstall` script
- This executes `prisma generate`
- Verify in deployment logs: "Prisma schema loaded"

### Step 4: Test Production Endpoints

**Test 1: Health Check**
```bash
curl https://your-app.vercel.app/api/health
```

**Test 2: Trust Score (Unauthenticated)**
```bash
curl "https://your-app.vercel.app/api/users/trust-score?userId=test_user"
```

**Test 3: Accept Deal (Authenticated)**
```bash
curl -X POST https://your-app.vercel.app/api/transactions/accept \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{
    "rfqId": "test_rfq",
    "sellerId": "test_seller",
    "amount": 100000,
    "category": "test"
  }'
```

---

## Post-Deployment Verification

### 1. Smoke Tests
- [ ] Homepage loads
- [ ] Chat interface works
- [ ] User can sign in
- [ ] API endpoints respond

### 2. Transaction Flow
- [ ] Create test RFQ
- [ ] Accept deal
- [ ] Create escrow
- [ ] Verify Airwallex payment intent created
- [ ] Complete transaction
- [ ] Check trust scores updated

### 3. Monitoring
- [ ] Check Vercel logs for errors
- [ ] Verify database connections
- [ ] Monitor Airwallex API calls
- [ ] Check Clerk authentication working

---

## Rollback Plan

If deployment fails:

### Option 1: Revert via Vercel
1. Go to Deployments tab
2. Find last working deployment
3. Click "..." → "Promote to Production"

### Option 2: Rollback Code
```bash
git revert HEAD
git push origin main
```

### Option 3: Database Rollback
```bash
# If migration caused issues
npx prisma migrate reset
```

---

## Monitoring Setup

### Vercel Analytics
- Enable in Vercel Dashboard
- Track: API response times, error rates

### Database Monitoring
```sql
-- Check transaction volume
SELECT COUNT(*) FROM "Transaction" WHERE "createdAt" > NOW() - INTERVAL '24 hours';

-- Check trust score health
SELECT AVG(score) FROM "UserTrustScore";

-- Find failed transactions
SELECT * FROM "Transaction" WHERE status = 'DISPUTED' OR status = 'CANCELLED';
```

### Airwallex Dashboard
- Monitor payment intents
- Check success/failure rates
- Verify split settlements

---

## Production Configuration

### Rate Limiting
Consider adding (future):
```typescript
// middleware.ts
if (isAPIRoute(req)) {
  const rateLimit = await checkRateLimit(userId)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }
}
```

### Caching
Current setup:
- Airwallex auth token: 1 hour cache
- Trust scores: Calculated on-demand (consider Redis cache)

### Security
- [x] Clerk authentication on all transaction endpoints
- [x] User ID verification (buyer/seller authorization)
- [x] Input validation (amount > 0, rating 1-5)
- [x] SQL injection protection (Prisma parameterized queries)

---

## Known Limitations

### Current Version
1. **No dispute resolution** - Coming Week 2
2. **No refunds** - Manual process via Airwallex dashboard
3. **No installments** - Single payment only
4. **No webhooks** - Airwallex events not yet handled

### Planned Improvements
- Webhook handler for payment confirmations
- Auto-release escrow after X days
- Email/SMS notifications
- Transaction dashboard UI

---

## Support & Debugging

### Common Issues

**Issue: "Airwallex authentication failed"**
- Check `AIRWALLEX_CLIENT_ID` and `AIRWALLEX_API_KEY`
- Verify using correct API URL (demo vs prod)
- Check Airwallex account is active

**Issue: "Transaction not found"**
- Verify database connection
- Check Prisma client generated
- Run `npx prisma generate`

**Issue: "Trust score always 50"**
- User has no completed transactions yet
- Trust score initializes at 50
- Increases after first rated transaction

**Issue: "Unauthorized error"**
- Check Clerk authentication token
- Verify user is signed in
- Check middleware configuration

### Logs to Check
```bash
# Vercel logs
vercel logs --follow

# Database logs
# Check Vercel Postgres dashboard

# Airwallex logs
# Check Airwallex dashboard → API logs
```

---

## Success Criteria

### Week 1
- [ ] 10+ test transactions completed
- [ ] Zero failed escrows
- [ ] All trust scores calculating correctly
- [ ] Average response time < 500ms

### Month 1
- [ ] $1M+ GMV processed
- [ ] 50+ completed transactions
- [ ] 4.5+ average rating
- [ ] < 1% transaction failure rate

---

## Next Steps After Deployment

### Immediate (Week 1)
1. Monitor production transactions
2. Add email notifications
3. Add SMS alerts via Twilio
4. Build transaction dashboard

### Short-term (Week 2-3)
1. Implement dispute resolution
2. Add webhook handlers
3. Create admin panel
4. Add transaction search

### Medium-term (Month 2)
1. ACH/Wire integration
2. Multi-currency support
3. Installment payments
4. Auto-release after milestones

---

## Final Checklist

Before announcing to users:

- [ ] All environment variables set
- [ ] Database migrated successfully
- [ ] Test transaction flow passes
- [ ] Production endpoints verified
- [ ] Monitoring enabled
- [ ] Error tracking configured
- [ ] Support contact ready
- [ ] Documentation complete

---

**Status: Ready to Deploy 🚀**

*Built with precision. Powered by trust. Designed for scale.*

**Wells AI | Trust + Outcomes**
