# Grain & Vault Treasury SDK - Database Layer

Complete database persistence layer for the Treasury SDK. All accounts, wallets, transactions, vendors, and invoices are now stored in Vercel Postgres.

## 🗄️ Database Schema

### Tables

#### `treasury_accounts`
Organization accounts with API access and credit facilities.

**Key Fields:**
- `id` - Account ID (e.g., `gv_1234567890`)
- `clerk_user_id` - Clerk user ID for authentication
- `company_name`, `company_size`, `industry`, `country`
- `erp_system`, `erp_version`, `erp_connected`, `erp_config`
- `tier` - Account tier: starter, growth, enterprise
- `status` - Account status: pending, active, suspended, closed
- `api_key` - API key for SDK access (unique)
- `sdk_enabled` - Whether SDK access is enabled
- `grain_balance`, `credit_line`, `used_credit` - Balances (denormalized)

#### `treasury_wallets`
Circle blockchain wallets for each account.

**Key Fields:**
- `account_id` - References treasury_accounts
- `wallet_id` - Circle wallet ID
- `address` - Blockchain address
- `blockchain` - Blockchain network (BASE)
- `currency` - Currency type (GRAIN)
- `balance` - Current balance
- `grain_value_at_deposit`, `current_grain_value` - GRAIN appreciation tracking
- `status` - Wallet status: active, inactive, frozen
- `kyc_status` - KYC verification status

#### `treasury_transactions`
All GRAIN movements (payments, receipts, credit draws, etc.)

**Key Fields:**
- `account_id` - References treasury_accounts
- `type` - Transaction type: payment, receipt, credit_draw, credit_repay, conversion, reserve
- `amount`, `currency` - Transaction amount
- `status` - Transaction status: pending, processing, completed, failed, cancelled
- `from_wallet`, `to_wallet` - Wallet addresses
- `circle_tx_id`, `circle_transfer_id` - Circle transaction IDs
- `counterparty_id`, `counterparty_name`, `counterparty_wallet` - Counterparty details
- `erp_reference`, `cost_center`, `gl_account` - ERP integration
- `metadata` - Flexible JSONB field for additional data
- `error_code`, `error_message` - Error tracking
- `completed_at`, `failed_at` - Status timestamps

#### `treasury_credit_lines`
Credit facilities (1:1 with GRAIN deposits)

**Key Fields:**
- `account_id` - References treasury_accounts (unique)
- `limit_amount` - Total credit line limit
- `drawn_amount` - Amount currently drawn
- `available_amount` - Computed: limit_amount - drawn_amount
- `interest_rate` - Interest rate (0% for GRAIN-backed credit)
- `grace_period_days` - Grace period
- `last_draw_at`, `last_repay_at` - Activity tracking

#### `treasury_vendors`
Vendor wallets for payments

**Key Fields:**
- `account_id` - References treasury_accounts
- `vendor_id` - ERP vendor ID
- `vendor_name`, `email`, `phone` - Vendor details
- `wallet_id`, `wallet_address` - Blockchain wallet
- `payment_terms` - Payment terms (Net30, Net60, etc.)
- `early_payment_discount`, `early_payment_days` - Discount terms
- `auto_pay_enabled` - Automatic payment setting
- `trust_score` - Trust score (0-100)
- `status` - Vendor status: active, inactive, blocked
- `onboarding_status` - Onboarding status: invited, pending, completed, declined

#### `treasury_invoices`
Synced invoices from ERP systems

**Key Fields:**
- `account_id` - References treasury_accounts
- `vendor_id` - References treasury_vendors
- `erp_invoice_id` - ERP invoice ID (unique per account)
- `invoice_number` - Invoice number
- `amount`, `currency` - Invoice amount
- `invoice_date`, `due_date` - Dates
- `status` - Invoice status: pending, approved, paid, cancelled, overdue
- `payment_status` - Payment status: unpaid, partial, paid, failed
- `paid_amount` - Amount paid so far
- `transaction_id` - References treasury_transactions
- `erp_po_number`, `cost_center`, `gl_account` - ERP references
- `synced_at`, `sync_status` - Sync tracking

#### `treasury_payment_requests`
Receivables / Payment requests sent to customers

**Key Fields:**
- `account_id` - References treasury_accounts
- `payment_id` - Unique payment request ID
- `amount`, `currency` - Request amount
- `customer_email`, `customer_name` - Customer details
- `erp_reference`, `invoice_number`, `memo` - References
- `payment_link`, `qr_code_url`, `wallet_address` - Payment methods
- `status` - Request status: pending, paid, expired, cancelled
- `due_date`, `expires_at` - Dates
- `transaction_id` - References treasury_transactions

### Views

#### `treasury_dashboard`
Aggregated metrics for dashboard display. Includes:
- Account balances and credit line
- Transaction counts and volume (30 days)
- Vendor counts
- Invoice counts and amounts

### Functions & Triggers

- **`update_updated_at()`** - Automatically updates `updated_at` timestamp
- **`sync_account_credit_line()`** - Syncs credit line changes to account
- **`sync_account_wallet_balance()`** - Syncs wallet balance to account
- **`mark_overdue_invoices()`** - Marks invoices as overdue

### Indexes

All tables have proper indexes on:
- Foreign keys (account_id, vendor_id, etc.)
- Status fields
- Date fields (created_at, due_date, etc.)
- Lookup fields (api_key, wallet_address, erp_reference, etc.)

## 🚀 Setup & Migration

### 1. Run the migration

```bash
# Using the migration script
node scripts/migrate-treasury.js

# Or manually with psql
psql $POSTGRES_URL < scripts/schema-treasury.sql
```

### 2. Verify tables

```bash
# Check tables exist
psql $POSTGRES_URL -c "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'treasury_%'"
```

### 3. Test the database

```typescript
import { createAccount, getAccountByClerkId } from '@/lib/treasury-db'

// Create a test account
const account = await createAccount({
  clerkUserId: 'user_test_001',
  companyName: 'Test Company Inc',
  companySize: 'startup',
  industry: 'Technology',
  country: 'US',
  erpSystem: 'netsuite',
})

console.log('Account created:', account.id)
console.log('API Key:', account.apiKey)
```

## 📚 API Usage

### Account Operations

```typescript
import {
  createAccount,
  getAccount,
  getAccountByClerkId,
  getAccountByApiKey,
  updateAccount,
} from '@/lib/treasury-db'

// Create account
const account = await createAccount({
  clerkUserId: userId,
  companyName: 'Acme Corp',
  companySize: 'mid-market',
  industry: 'Technology',
  erpSystem: 'netsuite',
})

// Get account by ID
const account = await getAccount('gv_1234567890')

// Get account by Clerk user ID
const account = await getAccountByClerkId('user_abc123')

// Get account by API key (for authentication)
const account = await getAccountByApiKey('gv_live_...')

// Update account
await updateAccount('gv_1234567890', {
  status: 'active',
  tier: 'growth',
  erpConnected: true,
})
```

### Wallet Operations

```typescript
import {
  createWallet,
  getWallets,
  getWalletByAddress,
  updateWalletBalance,
} from '@/lib/treasury-db'

// Create wallet
const wallet = await createWallet({
  accountId: 'gv_1234567890',
  walletId: 'circle_wallet_123',
  address: '0x1234567890abcdef',
  blockchain: 'BASE',
  currency: 'GRAIN',
})

// Get all wallets for account
const wallets = await getWallets('gv_1234567890')

// Update wallet balance
await updateWalletBalance('circle_wallet_123', 10000.00, 1.05)
```

### Transaction Operations

```typescript
import {
  createTransaction,
  getTransaction,
  getTransactions,
  updateTransactionStatus,
} from '@/lib/treasury-db'

// Create transaction
const transaction = await createTransaction({
  accountId: 'gv_1234567890',
  type: 'payment',
  amount: 5000,
  currency: 'GRAIN',
  toWallet: '0xvendorwallet',
  counterpartyName: 'Acme Vendor',
  erpReference: 'PO-2024-001',
  costCenter: 'IT',
  glAccount: '5000',
})

// Get transactions for account
const { transactions, total } = await getTransactions('gv_1234567890', {
  type: 'payment',
  status: 'completed',
  limit: 50,
  offset: 0,
})

// Update transaction status
await updateTransactionStatus(transaction.id, 'completed')

// Mark as failed with error
await updateTransactionStatus(transaction.id, 'failed', {
  code: 'INSUFFICIENT_BALANCE',
  message: 'Insufficient balance for payment',
})
```

### Vendor Operations

```typescript
import {
  createVendor,
  getVendor,
  getVendors,
  updateVendor,
} from '@/lib/treasury-db'

// Create vendor
const vendor = await createVendor({
  accountId: 'gv_1234567890',
  vendorId: 'VEND-001',
  vendorName: 'Acme Vendor Inc',
  email: 'payments@acmevendor.com',
  walletAddress: '0xvendorwallet',
  paymentTerms: 'Net30',
})

// Get all vendors
const vendors = await getVendors('gv_1234567890')

// Update vendor
await updateVendor(vendor.id, {
  onboardingStatus: 'completed',
  autoPayEnabled: true,
})
```

### Invoice Operations

```typescript
import {
  createInvoice,
  getInvoice,
  getInvoices,
  updateInvoiceStatus,
} from '@/lib/treasury-db'

// Create invoice
const invoice = await createInvoice({
  accountId: 'gv_1234567890',
  vendorId: vendor.id,
  erpInvoiceId: 'INV-2024-001',
  invoiceNumber: 'INV-001',
  amount: 5000,
  invoiceDate: new Date('2024-01-01'),
  dueDate: new Date('2024-01-31'),
  erpPoNumber: 'PO-2024-001',
})

// Get pending invoices
const { invoices, total } = await getInvoices('gv_1234567890', {
  status: 'pending',
  paymentStatus: 'unpaid',
})

// Mark invoice as paid
await updateInvoiceStatus(invoice.id, 'paid', 'paid', transaction.id)
```

### Credit Line Operations

```typescript
import {
  createCreditLine,
  getCreditLine,
  updateCreditLine,
} from '@/lib/treasury-db'

// Create or update credit line
await createCreditLine('gv_1234567890', 100000)

// Get credit line
const creditLine = await getCreditLine('gv_1234567890')

// Update drawn amount
await updateCreditLine('gv_1234567890', {
  drawnAmount: creditLine.drawnAmount + 5000,
})
```

## 🔐 Security

### API Key Validation

All API requests validate the API key against the database:

```typescript
// In /app/api/treasury/route.ts
const authResult = await validateApiKey(request)
if (!authResult) {
  return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
}

// Account is active and validated
const { accountId } = authResult
```

### Row-Level Security

Consider enabling Postgres Row-Level Security (RLS) for production:

```sql
ALTER TABLE treasury_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY account_isolation ON treasury_accounts
  USING (id = current_setting('app.current_account_id')::text);
```

## 📊 Monitoring & Maintenance

### Mark Overdue Invoices

Run periodically (e.g., daily cron job):

```sql
SELECT mark_overdue_invoices();
```

### Transaction Statistics

```sql
-- Transaction volume by type (last 30 days)
SELECT
  type,
  COUNT(*) as count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount
FROM treasury_transactions
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND status = 'completed'
GROUP BY type
ORDER BY total_amount DESC;
```

### Failed Transactions

```sql
-- Recent failed transactions
SELECT
  id,
  account_id,
  type,
  amount,
  error_code,
  error_message,
  created_at
FROM treasury_transactions
WHERE status = 'failed'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### Account Activity

```sql
-- Active accounts with transaction counts
SELECT
  a.id,
  a.company_name,
  a.tier,
  COUNT(t.id) as transaction_count,
  SUM(t.amount) FILTER (WHERE t.type = 'payment') as total_payments,
  SUM(t.amount) FILTER (WHERE t.type = 'receipt') as total_receipts
FROM treasury_accounts a
LEFT JOIN treasury_transactions t ON a.id = t.account_id
WHERE a.status = 'active'
  AND t.created_at >= NOW() - INTERVAL '30 days'
  AND t.status = 'completed'
GROUP BY a.id, a.company_name, a.tier
ORDER BY transaction_count DESC;
```

## 🔄 Data Migration

### Migrate from In-Memory to Database

If you have existing in-memory data, create a migration script:

```typescript
// scripts/migrate-existing-accounts.ts
import { accounts } from '@/app/api/grain-vault/account/route'
import { createAccount } from '@/lib/treasury-db'

async function migrateAccounts() {
  for (const [userId, account] of accounts.entries()) {
    try {
      await createAccount({
        clerkUserId: account.userId,
        companyName: account.companyName,
        companySize: account.companySize,
        industry: account.industry,
        country: account.country,
        erpSystem: account.erpSystem,
        erpVersion: account.erpVersion,
        tier: account.tier,
      })
      console.log(`Migrated account: ${account.id}`)
    } catch (error) {
      console.error(`Failed to migrate account ${account.id}:`, error)
    }
  }
}
```

## 📈 Scaling Considerations

### Connection Pooling

Vercel Postgres automatically handles connection pooling. For high-traffic applications, consider:

1. **Vercel Postgres Pro** - Higher connection limits
2. **Read Replicas** - For analytics and reporting queries
3. **Caching** - Redis/Vercel KV for frequently accessed data

### Performance Optimization

1. **Indexes** - All critical fields are indexed
2. **Materialized Views** - For complex aggregations
3. **Partitioning** - For large transaction tables (by date)

Example partitioning:

```sql
-- Partition transactions by month
CREATE TABLE treasury_transactions_2024_01 PARTITION OF treasury_transactions
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## 🧪 Testing

### Unit Tests

```typescript
import { describe, test, expect, beforeEach } from 'vitest'
import { createAccount, getAccount } from '@/lib/treasury-db'

describe('Treasury Database', () => {
  test('creates and retrieves account', async () => {
    const account = await createAccount({
      clerkUserId: 'test_user_123',
      companyName: 'Test Co',
      companySize: 'startup',
      industry: 'Technology',
      erpSystem: 'none',
    })

    expect(account.id).toMatch(/^gv_/)
    expect(account.apiKey).toMatch(/^gv_live_/)

    const retrieved = await getAccount(account.id)
    expect(retrieved?.companyName).toBe('Test Co')
  })
})
```

## 📝 Backup & Recovery

### Automated Backups

Vercel Postgres includes automatic backups. For additional protection:

```bash
# Manual backup
pg_dump $POSTGRES_URL > treasury_backup_$(date +%Y%m%d).sql

# Restore from backup
psql $POSTGRES_URL < treasury_backup_20240101.sql
```

## 🎯 Next Steps

1. **Run Migration** - Set up the database schema
2. **Test API** - Create test accounts and transactions
3. **Monitor** - Set up monitoring and alerts
4. **Scale** - Add read replicas and caching as needed
5. **Secure** - Enable RLS and audit logging

## 📞 Support

For issues or questions:
- Check the logs: `vercel logs --project=wells-ai`
- Database console: Vercel Dashboard > Storage > Postgres
- Documentation: [Grain & Vault Treasury SDK](https://docs.grainandvault.com)

---

**Built with Grain & Vault Treasury SDK**
Zero-friction payments for enterprise treasury teams.
