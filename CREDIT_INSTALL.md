# Wells AI Credit System - Installation Guide

## Quick Start

### 1. Install Required Dependencies

```bash
npm install react-plaid-link
```

Note: The `plaid` package is already installed in the main dependencies.

### 2. Set Up Environment Variables

Copy the credit environment template:

```bash
cat .env.credit.example >> .env.local
```

Then edit `.env.local` and add your credentials:

```bash
# Plaid (Required)
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_secret
PLAID_ENV=sandbox

# Codat (Optional)
CODAT_API_KEY=your_api_key
```

### 3. Run Database Migration

```bash
# Apply credit underwriting schema
psql $POSTGRES_URL -f scripts/schema-credit-underwriting.sql
```

Or if you have database credentials:

```bash
psql -h hostname -U username -d database -f scripts/schema-credit-underwriting.sql
```

### 4. Start Development Server

```bash
npm run dev
```

### 5. Test the System

Navigate to:
- Application: http://localhost:3000/credit/apply
- Dashboard: http://localhost:3000/credit/dashboard

## Getting Plaid Credentials

### Sandbox (Development)

1. Go to https://dashboard.plaid.com/signup
2. Create a free account
3. Navigate to Team Settings > Keys
4. Copy your:
   - `client_id`
   - `sandbox` secret
5. Enable products:
   - Go to Team Settings > Products
   - Enable: Transactions, Auth, Balance

### Test Credentials

Plaid provides test bank accounts:

```
Institution: First Platypus Bank
Username: user_good
Password: pass_good
MFA Code: 1234

This will return strong financials for testing approvals.
```

## Getting Codat Credentials (Optional)

### Free Tier

1. Go to https://signup.codat.io/
2. Create a free account (free for first 50 companies)
3. Navigate to Developers > API Keys
4. Copy your API key
5. Enable integrations:
   - QuickBooks Online
   - Xero
   - Any others you want to support

## Verifying Installation

### 1. Check Database Tables

```bash
psql $POSTGRES_URL -c "\dt credit_*"
```

You should see:
- credit_applications
- credit_lines
- credit_draws
- credit_payments
- credit_transactions
- payment_intercepts
- credit_alerts

### 2. Test Plaid Connection

```bash
curl http://localhost:3000/api/credit/apply \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user","requestedAmount":50000}'
```

Should return:
```json
{
  "success": true,
  "applicationId": "...",
  "plaidLinkToken": "link-sandbox-..."
}
```

### 3. Check Dependencies

```bash
npm list plaid react-plaid-link
```

Should show:
```
├── plaid@29.0.0
└── react-plaid-link@3.x.x
```

## Troubleshooting

### Error: "Plaid credentials not configured"

**Solution**: Make sure `.env.local` has:
```bash
PLAID_CLIENT_ID=...
PLAID_SECRET=...
PLAID_ENV=sandbox
```

### Error: "Table credit_applications does not exist"

**Solution**: Run the database migration:
```bash
psql $POSTGRES_URL -f scripts/schema-credit-underwriting.sql
```

### Error: "Cannot find module 'react-plaid-link'"

**Solution**: Install the dependency:
```bash
npm install react-plaid-link
```

### Plaid Link doesn't open

**Solution**: Check browser console for errors. Make sure:
1. Link token is valid (check API response)
2. No CORS issues (check browser network tab)
3. Plaid SDK loaded (check page source)

## Development Workflow

### 1. Create Test Applications

```javascript
// In browser console or test script
const response = await fetch('/api/credit/apply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'test-user-1',
    requestedAmount: 50000
  })
});

const data = await response.json();
console.log('Application ID:', data.applicationId);
```

### 2. Test Different Scenarios

**Strong Applicant (High Score)**:
- Use Plaid test account: `user_good`
- Expected: Approved, Prime tier, $100K+ limit, ~7% APR

**Weak Applicant (Low Score)**:
- Use Plaid test account: `user_bad`
- Expected: Declined with reason

**Moderate Applicant (Medium Score)**:
- Use custom Plaid account with moderate transactions
- Expected: Approved, Near-Prime tier, $25-50K limit, ~10% APR

### 3. Monitor Database

```sql
-- Check applications
SELECT id, user_id, status, credit_score, approved_amount, approved_apr
FROM credit_applications
ORDER BY created_at DESC
LIMIT 10;

-- Check active credit lines
SELECT id, user_id, credit_limit, available_credit, apr, status
FROM credit_lines
WHERE status = 'active';

-- Check transactions
SELECT ct.*, cl.user_id
FROM credit_transactions ct
JOIN credit_lines cl ON cl.id = ct.credit_line_id
ORDER BY ct.created_at DESC
LIMIT 20;
```

## Production Deployment

### 1. Switch to Production Plaid

In `.env.local`:
```bash
PLAID_ENV=production
PLAID_SECRET=your_production_secret
```

### 2. Update Plaid Dashboard

1. Go to https://dashboard.plaid.com/
2. Switch to production environment
3. Add production redirect URIs:
   - https://wells.ai/credit/apply
   - https://wells.ai/credit/callback
4. Enable webhook:
   - https://wells.ai/api/webhooks/plaid

### 3. Configure Risk Limits

In `.env.local`:
```bash
CREDIT_MIN_SCORE=500
CREDIT_LIMIT_PRIME=250000
CREDIT_LIMIT_NEAR_PRIME=100000
CREDIT_LIMIT_SUBPRIME=50000
```

### 4. Enable Monitoring

Set up alerts for:
- High approval volume
- Unusual score distributions
- System errors
- Plaid API failures

## Security Checklist

- [ ] Plaid credentials in environment variables (not hardcoded)
- [ ] Database credentials secured
- [ ] HTTPS enabled in production
- [ ] Rate limiting configured
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (using parameterized queries)
- [ ] XSS prevention (React default escaping)
- [ ] CSRF protection (Next.js built-in)
- [ ] Sensitive data encrypted at rest
- [ ] Audit logging enabled

## Performance Optimization

### Database Indexes

Already created in schema:
```sql
CREATE INDEX idx_credit_applications_user ON credit_applications(user_id);
CREATE INDEX idx_credit_lines_user ON credit_lines(user_id);
-- etc.
```

### Caching

Consider caching:
- Credit scores (TTL: 24 hours)
- Plaid transaction data (TTL: 1 hour)
- Financial ratios (TTL: 24 hours)

### API Rate Limits

Plaid free tier limits:
- 100 Item creations/month
- Unlimited transactions pulls

Production limits vary by plan.

## Next Steps

1. Customize credit scoring weights in `lib/underwriting/scoring.ts`
2. Add more data sources (Stripe, Shopify, etc.)
3. Build internal admin dashboard for manual review
4. Implement automated monitoring and alerts
5. Create customer communication workflows
6. Build collections and recovery processes

## Support

For issues or questions:
- Documentation: See CREDIT_UNDERWRITING_README.md
- Email: engineering@wells.ai
- GitHub Issues: Create an issue with logs and environment details

## Additional Resources

- Plaid Docs: https://plaid.com/docs/
- Codat Docs: https://docs.codat.io/
- Wells API Docs: https://docs.wells.ai/
- Credit Scoring Guide: See CREDIT_UNDERWRITING_README.md
