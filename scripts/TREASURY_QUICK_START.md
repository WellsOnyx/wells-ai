# Treasury SDK Database - Quick Start

Get the Treasury SDK database up and running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- Vercel Postgres database provisioned
- Environment variables configured

## Step 1: Set Up Environment Variables

Add to your `.env.local`:

```env
# Vercel Postgres
POSTGRES_URL="postgres://..."
POSTGRES_URL_NON_POOLING="postgres://..."

# Circle API (for Treasury SDK)
CIRCLE_API_KEY="your_circle_api_key"
CIRCLE_ENV="sandbox"  # or "production"

# Clerk (for authentication)
CLERK_SECRET_KEY="sk_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
```

## Step 2: Run Migration

```bash
# Install dependencies (if needed)
npm install

# Run the migration script
node scripts/migrate-treasury.js
```

Expected output:
```
🚀 Starting Treasury SDK database migration...
📖 Read schema file: scripts/schema-treasury.sql
📊 Found 45 SQL statements

✅ [1/45] CREATE TABLE treasury_accounts
✅ [2/45] CREATE INDEX idx_treasury_accounts_clerk_user
...
✨ Migration completed successfully!
✅ Found 9 treasury tables: treasury_accounts, treasury_credit_lines, ...
```

## Step 3: Verify Setup

```bash
# Check tables exist
psql $POSTGRES_URL -c "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'treasury_%' ORDER BY table_name"
```

Expected output:
```
       table_name
-------------------------
 treasury_accounts
 treasury_credit_lines
 treasury_invoices
 treasury_payment_requests
 treasury_transactions
 treasury_vendors
 treasury_wallets
 circle_webhook_events
 user_wallets
```

## Step 4: Test the API

Create a test account:

```typescript
// test-treasury.ts
import { createAccount, getAccountByClerkId } from '@/lib/treasury-db'

async function testTreasury() {
  // Create account
  const account = await createAccount({
    clerkUserId: 'user_test_' + Date.now(),
    companyName: 'Test Company Inc',
    companySize: 'startup',
    industry: 'Technology',
    country: 'US',
    erpSystem: 'netsuite',
  })

  console.log('✅ Account created:', account.id)
  console.log('🔑 API Key:', account.apiKey)
  console.log('💰 Credit Line:', account.creditLine)

  // Fetch account
  const fetched = await getAccountByClerkId(account.clerkUserId)
  console.log('✅ Account fetched:', fetched?.companyName)

  return account
}

testTreasury()
```

Run it:
```bash
npx tsx scripts/test-treasury.ts
```

## Step 5: Test SDK API Endpoints

### Initialize Wallet

```bash
curl -X POST http://localhost:3000/api/treasury \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "initialize"}'
```

### Make a Payment

```bash
curl -X POST http://localhost:3000/api/treasury \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "pay",
    "vendorWallet": "0x1234567890abcdef1234567890abcdef12345678",
    "amount": 1000,
    "reference": "PO-2024-001",
    "costCenter": "IT",
    "memo": "Test payment"
  }'
```

### Get Balance

```bash
curl http://localhost:3000/api/treasury?action=balance \
  -H "x-api-key: YOUR_API_KEY"
```

### Get Credit Line

```bash
curl http://localhost:3000/api/treasury?action=credit \
  -H "x-api-key: YOUR_API_KEY"
```

## Common Issues

### Issue: "relation 'treasury_accounts' does not exist"

**Solution:** Run the migration:
```bash
node scripts/migrate-treasury.js
```

### Issue: "Invalid or missing API key"

**Solution:** Make sure you're using the API key from the database:
```typescript
const account = await getAccountByClerkId(userId)
console.log('API Key:', account.apiKey)
```

### Issue: "Connection timeout"

**Solution:** Check your `POSTGRES_URL` environment variable:
```bash
echo $POSTGRES_URL
```

### Issue: Migration fails with "permission denied"

**Solution:** Make sure your database user has sufficient permissions:
```sql
GRANT ALL ON ALL TABLES IN SCHEMA public TO your_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_user;
```

## Next Steps

1. **Explore the Schema** - Read `TREASURY_DATABASE.md` for full documentation
2. **Create Your First Account** - Use the account creation endpoint
3. **Integrate Your ERP** - Connect NetSuite, SAP, or other ERPs
4. **Set Up Webhooks** - Configure Circle webhooks for payment notifications
5. **Go to Production** - Switch `CIRCLE_ENV` to "production"

## Database Operations Cheat Sheet

```typescript
// Account
import { createAccount, getAccount, getAccountByClerkId, updateAccount } from '@/lib/treasury-db'

// Wallet
import { createWallet, getWallets, updateWalletBalance } from '@/lib/treasury-db'

// Transaction
import { createTransaction, getTransactions, updateTransactionStatus } from '@/lib/treasury-db'

// Vendor
import { createVendor, getVendors, updateVendor } from '@/lib/treasury-db'

// Invoice
import { createInvoice, getInvoices, updateInvoiceStatus } from '@/lib/treasury-db'

// Credit Line
import { createCreditLine, getCreditLine, updateCreditLine } from '@/lib/treasury-db'
```

## Production Checklist

- [ ] Run migration on production database
- [ ] Set `CIRCLE_ENV=production`
- [ ] Configure production API keys
- [ ] Enable database backups
- [ ] Set up monitoring and alerts
- [ ] Configure Row-Level Security (RLS)
- [ ] Test payment flows end-to-end
- [ ] Document API keys securely
- [ ] Set up logging and error tracking
- [ ] Configure rate limiting

## Support

- **Documentation:** `TREASURY_DATABASE.md`
- **Schema File:** `scripts/schema-treasury.sql`
- **Database Helper:** `lib/treasury-db.ts`
- **API Routes:** `app/api/treasury/route.ts`

---

**Ready to build?** Start with the account creation endpoint and work your way through the payment flow.
