# ERP Integration Guide (Merge.dev)

Complete setup and configuration guide for Wells AI ERP integration via Merge.dev, supporting 100+ enterprise resource planning systems.

---

## Table of Contents

- [Overview](#overview)
- [Supported ERP Systems](#supported-erp-systems)
- [Merge.dev Setup](#mergedev-setup)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Customer Onboarding](#customer-onboarding)
- [Auto-Sync Configuration](#auto-sync-configuration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Production Checklist](#production-checklist)

---

## Overview

Wells AI integrates with 100+ ERP systems through Merge.dev's Universal API. This enables:

- **Automatic PO Creation**: Closed deals auto-create purchase orders in customer's ERP
- **Vendor Syncing**: Suppliers automatically added to customer's vendor list
- **Invoice Generation**: Automated invoice creation with Wells AI fee (0.33%)
- **Real-time Sync**: Webhook updates from ERP systems
- **Zero Manual Entry**: Complete automation from deal close to ERP

### Value Proposition

**Traditional Process** (2-4 days):
1. Deal closes in Wells AI
2. Procurement team exports data
3. Manual entry into ERP
4. Create vendor (if new)
5. Generate PO manually
6. Get approvals
7. Send PO to supplier

**Wells AI Process** (< 1 minute):
1. Deal marked 'paid' or 'completed'
2. Database trigger fires
3. Vendor auto-created in ERP (if needed)
4. PO auto-generated with Wells AI fee
5. ERP updated instantly

**Result**: 98% time reduction, zero errors, complete audit trail

---

## Supported ERP Systems

### Tier 1: Enterprise (Full Support)
- SAP ERP
- Oracle NetSuite
- Microsoft Dynamics 365
- Workday Financial Management
- SAP Concur
- Coupa
- SAP Ariba
- Oracle E-Business Suite
- Infor CloudSuite
- IFS Applications

### Tier 2: Mid-Market (Full Support)
- Sage Intacct
- Acumatica
- Epicor ERP
- QAD
- SYSPRO
- Deltek
- Unit4
- Exact
- Odoo
- Priority Software

### Tier 3: SMB (Full Support)
- QuickBooks Online
- QuickBooks Desktop
- Xero
- FreshBooks
- Wave
- Zoho Books
- Kashoo
- ZipBooks
- Manager
- GnuCash

### Tier 4: Industry-Specific (Full Support)
- NetSuite Manufacturing
- Epicor Prophet 21
- Infor M3 (Fashion)
- Infor LN (Manufacturing)
- JD Edwards EnterpriseOne
- Global Shop Solutions
- And 60+ more...

**Total**: 100+ ERP systems via single Merge.dev integration

---

## Merge.dev Setup

### Step 1: Create Merge.dev Account

1. Go to https://merge.dev
2. Click **"Get Started"** or **"Sign Up"**
3. Fill in company information:
   - Company: `Wells Onyx` or your company name
   - Email: Your business email
   - Use Case: `B2B Integrations - ERP/Accounting`

4. Verify email
5. Complete onboarding

### Step 2: Select Integration Categories

In Merge.dev dashboard:

1. Go to **Integrations** → **Categories**
2. Enable **Accounting** category
   - This includes all ERP/accounting integrations
3. Go to **Integrations** → **Available Integrations**
4. Enable specific ERPs you need:
   - Start with: NetSuite, QuickBooks, Xero, SAP, Workday
   - Add more as needed

**Note**: Each integration may require separate approval from Merge.dev. Enterprise ERPs (SAP, Oracle) may take 1-2 business days.

### Step 3: Get API Keys

**Production Keys:**
1. Go to **Settings** → **API Keys**
2. Click **"Generate Production Key"**
3. Copy **Production API Key** (starts with `live_...`)
4. Store securely (won't be shown again)

**Test Keys:**
1. Same location
2. Copy **Test API Key** (starts with `test_...`)
3. Use for development

### Step 4: Configure Webhook

**Settings → Webhooks:**
1. Click **"Add Webhook"**
2. **URL**: `https://wellsai.vercel.app/api/webhooks/merge`
3. **Events**: Select all or:
   - `sync.completed`
   - `sync.failed`
   - `account.connected`
   - `account.disconnected`
4. **Secret**: Auto-generated (copy for verification)
5. Click **Save**

### Step 5: Set Up Link Configuration

**Integrations → Link Configuration:**

**Required Fields** (for all integrations):
- Company Name ✓
- Contact Email ✓
- ERP System ✓

**Optional Fields** (collect for better matching):
- Company Address
- Tax ID
- Currency Preference
- Fiscal Year Start
- Default Payment Terms

**Branding**:
- Logo: Upload Wells AI logo
- Primary Color: `#0066FF`
- Company Name: `Wells AI` or `Wells Onyx`
- Support Email: `support@wellsonyx.com`

Click **Save Configuration**

---

## Environment Configuration

### Add to Vercel Environment Variables

```bash
# Merge.dev API Keys
MERGE_API_KEY=live_your_production_api_key_here
MERGE_TEST_API_KEY=test_your_test_api_key_here

# Merge.dev Webhook Secret (for verification)
MERGE_WEBHOOK_SECRET=your_webhook_secret_here

# Application Base URL
NEXT_PUBLIC_BASE_URL=https://wellsai.vercel.app
```

### Add to .env.local (Development)

Create `.env.local`:

```bash
# Development uses test keys
MERGE_API_KEY=test_your_test_api_key_here
MERGE_WEBHOOK_SECRET=your_webhook_secret_here
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**Redeploy** Vercel after adding production keys.

---

## Database Setup

### Step 1: Run ERP Schema Migration

The ERP schema includes:
- `merge_account_tokens` - Customer ERP connections
- `erp_syncs` - Sync history
- `erp_sync_history` - Detailed logs
- `erp_webhooks` - Webhook events
- `supplier_erp_mappings` - Supplier→Vendor mappings
- Auto-sync trigger - Fires on deal status change

**Run Migration:**

```bash
cd /Users/jonahmanning/Downloads/wells-ai-github-ready
psql $POSTGRES_URL < scripts/schema-erp.sql
```

Or via Vercel Postgres dashboard:
1. Go to Vercel → Storage → Your Postgres DB
2. Click **Query**
3. Paste contents of `scripts/schema-erp.sql`
4. Click **Run**

### Step 2: Verify Tables Created

```sql
-- Check all ERP tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_name LIKE '%erp%' OR table_name LIKE 'merge%'
ORDER BY table_name;

-- Should return:
-- erp_sync_history
-- erp_syncs
-- erp_webhooks
-- merge_account_tokens
-- supplier_erp_mappings
```

### Step 3: Verify Trigger Exists

```sql
-- Check auto-sync trigger
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_auto_sync_deal_to_erp';

-- Should return one row showing trigger on 'deals' table
```

### Step 4: Test Trigger (Optional)

```sql
-- Insert test deal
INSERT INTO deals (id, buyer_id, product_name, amount, status)
VALUES (
  gen_random_uuid(),
  'test_buyer_123',
  'Test Product',
  10000,
  'pending'
);

-- Update to 'paid' (should trigger auto-sync)
UPDATE deals
SET status = 'paid'
WHERE buyer_id = 'test_buyer_123';

-- Check if sync record created
SELECT * FROM erp_syncs
WHERE deal_id IN (
  SELECT id FROM deals WHERE buyer_id = 'test_buyer_123'
);

-- Clean up
DELETE FROM deals WHERE buyer_id = 'test_buyer_123';
```

---

## Customer Onboarding

### Flow Overview

1. Customer signs deal in Wells AI
2. Customer connects their ERP via Merge Link
3. Wells AI stores account token
4. All future deals auto-sync to customer's ERP

### Step 1: Generate Link Token

When customer needs to connect ERP:

**API Call:**
```bash
POST https://wellsai.vercel.app/api/erp/link-token
Content-Type: application/json

{
  "customerId": "customer_123",
  "customerEmail": "buyer@company.com",
  "companyName": "Acme Corp"
}
```

**Response:**
```json
{
  "linkToken": "link_prod_xyz123...",
  "expiresAt": "2025-10-30T12:00:00Z"
}
```

### Step 2: Display Merge Link

**Frontend (React):**

```jsx
import { MergeLink } from '@mergeapi/react-merge-link';

function ERPConnectionButton() {
  const [linkToken, setLinkToken] = useState(null);

  const handleConnect = async () => {
    const response = await fetch('/api/erp/link-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: 'customer_123',
        customerEmail: 'buyer@company.com',
        companyName: 'Acme Corp',
      }),
    });

    const { linkToken } = await response.json();
    setLinkToken(linkToken);
  };

  const handleSuccess = (publicToken) => {
    // Exchange public token for account token
    fetch('/api/erp/exchange-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicToken, customerId: 'customer_123' }),
    });
  };

  return (
    <div>
      <button onClick={handleConnect}>
        Connect Your ERP
      </button>

      {linkToken && (
        <MergeLink
          linkToken={linkToken}
          onSuccess={handleSuccess}
          onClose={() => setLinkToken(null)}
        />
      )}
    </div>
  );
}
```

### Step 3: Store Account Token

After successful connection, Merge.dev returns a public token. Exchange it:

**API Call:**
```bash
POST https://wellsai.vercel.app/api/erp/exchange-token
Content-Type: application/json

{
  "publicToken": "public_token_xyz...",
  "customerId": "customer_123"
}
```

**This endpoint:**
1. Exchanges public token for account token via Merge.dev
2. Stores account token in `merge_account_tokens` table
3. Returns success confirmation

### Step 4: Verify Connection

```sql
-- Check customer's ERP connection
SELECT
  customer_id,
  integration_name,
  is_active,
  connected_at
FROM merge_account_tokens
WHERE customer_id = 'customer_123';
```

---

## Auto-Sync Configuration

### How Auto-Sync Works

**Database Trigger:**
```sql
CREATE TRIGGER trigger_auto_sync_deal_to_erp
AFTER INSERT OR UPDATE OF status ON deals
FOR EACH ROW EXECUTE FUNCTION auto_sync_deal_to_erp();
```

**Trigger Logic:**
1. Fires when deal status changes to `'paid'` or `'completed'`
2. Checks if customer has ERP connected
3. Inserts record into `erp_syncs` table with status='pending'
4. Sends PostgreSQL notification: `erp_sync_needed`

### Background Worker (Recommended for Production)

**Option 1: Vercel Cron Job**

Create `pages/api/cron/sync-erp.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { syncDealToERP } from '@/lib/merge';

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get pending syncs
  const result = await query<any>(
    `SELECT deal_id FROM erp_syncs WHERE status = 'pending' LIMIT 10`
  );

  // Process each sync
  const results = await Promise.allSettled(
    result.rows.map(row => syncDealToERP(row.deal_id))
  );

  return NextResponse.json({
    processed: results.length,
    succeeded: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
  });
}
```

**Configure in vercel.json:**
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-erp",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Runs every 5 minutes.

**Option 2: PostgreSQL LISTEN/NOTIFY**

For real-time syncing, use PostgreSQL pub/sub:

```typescript
// lib/erp-sync-worker.ts
import { Client } from 'pg';
import { syncDealToERP } from './merge';

const client = new Client({ connectionString: process.env.POSTGRES_URL });

async function startWorker() {
  await client.connect();
  await client.query('LISTEN erp_sync_needed');

  client.on('notification', async (msg) => {
    if (msg.channel === 'erp_sync_needed') {
      const { dealId } = JSON.parse(msg.payload);
      await syncDealToERP(dealId);
    }
  });

  console.log('✅ ERP sync worker started');
}

startWorker();
```

Run as separate process or in background job.

### Manual Sync

For manual syncing (admin panel, retry failed syncs):

**API Call:**
```bash
POST https://wellsai.vercel.app/api/deals/sync-erp
Content-Type: application/json

{
  "dealId": "deal_uuid_here",
  "force": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Deal synced to NetSuite",
  "sync": {
    "erpPoId": "PO-12345",
    "erpPoNumber": "WA-1730246400-abc123",
    "vendorId": "VENDOR-789",
    "amount": 100000,
    "wellsFee": 330,
    "syncedAt": "2025-10-29T18:00:00Z"
  }
}
```

---

## Testing

### Test Mode vs Production Mode

**Test Mode** (use `MERGE_TEST_API_KEY`):
- Connects to Merge.dev sandbox
- No actual ERP integration
- Mock data returned
- Perfect for development

**Production Mode** (use `MERGE_API_KEY`):
- Connects to real ERPs
- Actual data synced
- Use with caution

### Unit Tests

**Test ERP Functions:**

```typescript
// lib/merge.test.ts
import {
  createPurchaseOrder,
  syncVendor,
  convertDealToPurchaseOrder,
} from './merge';

describe('Merge.dev ERP Integration', () => {
  test('converts deal to PO format', () => {
    const deal = {
      id: 'deal_123',
      product_name: 'Office Chairs',
      amount: 10000,
      quantity: 100,
      wellsFee: 33,
    };

    const supplier = {
      name: 'Acme Furniture',
      email: 'sales@acme.com',
    };

    const po = convertDealToPurchaseOrder(deal, supplier);

    expect(po.po_number).toMatch(/^WA-\d+-/);
    expect(po.total_amount).toBe(10033); // amount + fee
    expect(po.line_items).toHaveLength(2); // product + fee
  });

  test('creates vendor in ERP', async () => {
    const vendor = {
      name: 'Test Supplier',
      email: 'test@supplier.com',
      phone: '555-0100',
    };

    const result = await syncVendor({
      accountToken: process.env.MERGE_TEST_API_KEY,
      vendor,
    });

    expect(result.id).toBeDefined();
    expect(result.name).toBe('Test Supplier');
  });
});
```

### Integration Tests

**Test Full Flow:**

```bash
# 1. Create test deal
curl -X POST https://wellsai.vercel.app/api/test/create-deal \
  -H "Content-Type: application/json" \
  -d '{
    "buyerId": "test_buyer_123",
    "productName": "Test Product",
    "amount": 10000,
    "status": "pending"
  }'

# 2. Mark as paid (triggers auto-sync)
curl -X POST https://wellsai.vercel.app/api/test/update-deal \
  -H "Content-Type: application/json" \
  -d '{
    "dealId": "DEAL_ID_FROM_STEP_1",
    "status": "paid"
  }'

# 3. Check sync status
curl https://wellsai.vercel.app/api/deals/sync-erp/status/DEAL_ID_FROM_STEP_1

# 4. Verify in ERP (manual check)
# Log into test ERP system
# Search for PO with number starting with "WA-"

# 5. Clean up
curl -X DELETE https://wellsai.vercel.app/api/test/delete-deal/DEAL_ID_FROM_STEP_1
```

### Test Checklist

- [ ] Link token generation works
- [ ] Merge Link UI displays correctly
- [ ] ERP connection succeeds
- [ ] Account token stored in database
- [ ] Deal marked 'paid' triggers sync
- [ ] Vendor created in ERP (if new)
- [ ] Purchase order created in ERP
- [ ] PO includes Wells AI fee line item
- [ ] Sync record created with status='completed'
- [ ] No duplicate POs created on retry
- [ ] Failed syncs marked as 'failed' with error message
- [ ] Webhook receives ERP updates

---

## Troubleshooting

### Common Issues

**Problem:** Link token generation fails
```
Error: Invalid API key
```
**Solution:**
- Verify `MERGE_API_KEY` is correct in Vercel
- Check you're using production key (starts with `live_`)
- Ensure Merge.dev account is active

---

**Problem:** Account token not being stored
```
Error: Cannot read property 'account_token' of undefined
```
**Solution:**
- Check `/api/erp/exchange-token` endpoint logs
- Verify public token is being passed correctly
- Ensure `merge_account_tokens` table exists
- Check database permissions

---

**Problem:** Auto-sync not triggering
```
Deal marked 'paid' but no sync record created
```
**Solution:**
1. Check trigger exists:
   ```sql
   SELECT * FROM information_schema.triggers
   WHERE trigger_name = 'trigger_auto_sync_deal_to_erp';
   ```
2. Check customer has ERP connected:
   ```sql
   SELECT * FROM merge_account_tokens
   WHERE customer_id = 'CUSTOMER_ID' AND is_active = true;
   ```
3. Check deal status is exactly 'paid' or 'completed'
4. Review database logs for trigger errors

---

**Problem:** PO creation fails
```
Error: Vendor not found in ERP
```
**Solution:**
- Ensure vendor sync happened first
- Check `supplier_erp_mappings` table for vendor ID
- Verify vendor was created successfully in ERP
- Try manual vendor creation via Merge.dev dashboard

---

**Problem:** Duplicate POs being created
```
Multiple POs with same deal_id
```
**Solution:**
- Add unique constraint on `deal_id` in `erp_syncs` table:
  ```sql
  ALTER TABLE erp_syncs ADD CONSTRAINT unique_deal_id UNIQUE (deal_id);
  ```
- Check sync status before creating new sync
- Implement idempotency in `/api/deals/sync-erp`

---

**Problem:** Wells AI fee not appearing in PO
```
PO total doesn't include 0.33% fee
```
**Solution:**
- Verify `wellsFee` calculation in `convertDealToPurchaseOrder`
- Check line items include fee:
  ```typescript
  {
    description: 'Wells AI Platform Fee (0.33%)',
    quantity: 1,
    unit_price: wellsFee,
    total_price: wellsFee,
  }
  ```
- Ensure ERP supports multiple line items

---

**Problem:** Merge.dev API rate limiting
```
Error: Rate limit exceeded (429)
```
**Solution:**
- Implement exponential backoff retry logic
- Batch multiple operations when possible
- Upgrade Merge.dev plan for higher limits
- Cache responses where appropriate

---

**Problem:** Webhook not receiving events
```
No webhook events in erp_webhooks table
```
**Solution:**
- Verify webhook URL in Merge.dev dashboard
- Check webhook endpoint returns 200:
  ```bash
  curl -X POST https://wellsai.vercel.app/api/webhooks/merge \
    -H "Content-Type: application/json" \
    -d '{"test": true}'
  ```
- Verify webhook secret matches in Vercel
- Check Vercel function logs for errors

---

### Debug Mode

Enable detailed logging:

```typescript
// lib/merge.ts
const DEBUG = process.env.MERGE_DEBUG === 'true';

function log(message: string, data?: any) {
  if (DEBUG) {
    console.log(`[MERGE DEBUG] ${message}`, data);
  }
}
```

Add to Vercel:
```bash
MERGE_DEBUG=true
```

---

## Production Checklist

Before going live with ERP integration:

### Setup
- [ ] Merge.dev production account created
- [ ] Production API key obtained
- [ ] Webhook configured and verified
- [ ] Environment variables set in Vercel
- [ ] Database schema migrated
- [ ] Auto-sync trigger installed

### Testing
- [ ] Test mode works end-to-end
- [ ] Link token generation tested
- [ ] ERP connection flow tested
- [ ] PO creation tested in sandbox
- [ ] Vendor syncing tested
- [ ] Webhook events received
- [ ] Error handling tested
- [ ] Retry logic tested

### Documentation
- [ ] Customer onboarding docs written
- [ ] Support team trained
- [ ] Troubleshooting guide created
- [ ] API docs published
- [ ] Integration videos recorded

### Monitoring
- [ ] Sentry error tracking enabled
- [ ] Database alerts configured
- [ ] Webhook failure alerts set up
- [ ] Daily sync report automated
- [ ] Usage analytics tracked

### Security
- [ ] API keys stored securely
- [ ] Webhook signature verification enabled
- [ ] Rate limiting implemented
- [ ] Access logs enabled
- [ ] Compliance review completed (SOC 2, GDPR)

### Support
- [ ] Support email configured
- [ ] Escalation process documented
- [ ] Merge.dev support contact established
- [ ] SLA defined for sync issues
- [ ] Customer communication plan ready

---

## Metrics & KPIs

Track these metrics:

### Sync Metrics
- **Sync Success Rate**: Target >99%
  ```sql
  SELECT
    COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*) as success_rate
  FROM erp_syncs;
  ```

- **Average Sync Time**: Target <60 seconds
  ```sql
  SELECT AVG(EXTRACT(EPOCH FROM (synced_at - created_at))) as avg_sync_seconds
  FROM erp_syncs
  WHERE status = 'completed';
  ```

- **Failed Syncs (Last 24h)**:
  ```sql
  SELECT COUNT(*)
  FROM erp_syncs
  WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours';
  ```

### Customer Metrics
- **ERP Connection Rate**: Target >80%
  ```sql
  SELECT
    COUNT(DISTINCT customer_id) as connected_customers,
    (SELECT COUNT(DISTINCT buyer_id) FROM deals) as total_customers,
    COUNT(DISTINCT customer_id) * 100.0 / (SELECT COUNT(DISTINCT buyer_id) FROM deals) as connection_rate
  FROM merge_account_tokens
  WHERE is_active = true;
  ```

- **Top ERPs by Usage**:
  ```sql
  SELECT
    integration_name,
    COUNT(*) as connections
  FROM merge_account_tokens
  WHERE is_active = true
  GROUP BY integration_name
  ORDER BY connections DESC
  LIMIT 10;
  ```

### Financial Metrics
- **Total Value Synced**:
  ```sql
  SELECT SUM(amount) as total_synced_value
  FROM deals d
  JOIN erp_syncs es ON d.id = es.deal_id
  WHERE es.status = 'completed';
  ```

- **Wells AI Fees Synced**:
  ```sql
  SELECT SUM(amount * 0.0033) as total_fees_synced
  FROM deals d
  JOIN erp_syncs es ON d.id = es.deal_id
  WHERE es.status = 'completed';
  ```

---

## Advanced Features

### Multi-Currency Support

```typescript
// lib/merge.ts
export function convertDealToPurchaseOrder(deal: any, supplier: any) {
  const currency = deal.currency || 'USD';
  const subTotal = deal.amount;
  const wellsFee = Math.round(deal.amount * 0.0033 * 100) / 100;

  return {
    currency,
    sub_total: subTotal,
    total_amount: subTotal + wellsFee,
    // ... rest of PO
  };
}
```

### Custom Field Mapping

Some ERPs require custom fields:

```typescript
// For NetSuite
integration_params: {
  wells_ai_deal_id: deal.id,
  custom_field_1: 'Wells AI Deal',
  custom_field_2: deal.metadata?.project_code,
}

// For SAP
integration_params: {
  purchase_organization: '1000',
  company_code: '1000',
  document_type: 'NB',
}
```

### Approval Workflow

Some ERPs support approval workflows:

```typescript
status: 'draft',  // Instead of 'submitted'
// Later, after approval in Wells AI:
await updatePurchaseOrder({
  accountToken,
  poId: erpPoId,
  status: 'submitted',
});
```

---

## Support & Resources

### Merge.dev Resources
- Dashboard: https://app.merge.dev
- API Docs: https://docs.merge.dev
- Status Page: https://status.merge.dev
- Support: support@merge.dev

### Wells AI Resources
- Main Docs: https://wellsai.vercel.app/docs
- API Docs: https://wellsai.vercel.app/api
- Support: support@wellsonyx.com
- Status: https://status.wellsonyx.com (if available)

### Emergency Contacts
- Merge.dev Support: support@merge.dev
- Wells AI On-Call: [Your phone/email]
- Database Admin: [DBA contact]

---

Built with precision. Powered by trust. Designed for generations.
*Wells Onyx | Trust + Outcomes*
