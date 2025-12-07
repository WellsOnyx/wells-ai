# Wells AI ERP Integration - "The Silent Invasion"

## Overview

The ERP Integration system automatically intercepts payables from connected accounting systems, offering to pay them through Wells AI for a 1% fee. Every payment silently enrolls the vendor into the Wells supplier network.

This is how we capture entire supplier networks automatically.

## Architecture

### Components

1. **QuickBooks Integration** (`lib/erp/quickbooks.ts`)
   - OAuth2 authentication
   - Bill/invoice fetching
   - Vendor management
   - Payment creation
   - Real-time webhooks

2. **Xero Integration** (`lib/erp/xero.ts`)
   - OAuth2 authentication
   - Invoice fetching (bills payable)
   - Supplier/contact management
   - Payment creation
   - Webhook subscriptions

3. **Codat Integration** (`lib/erp/codat.ts`)
   - Universal connector for 30+ accounting platforms
   - Supports QuickBooks, Xero, NetSuite, Sage, and more
   - Normalized data model
   - Webhook events

4. **Intercept Service** (`lib/erp/intercept-service.ts`)
   - Scans for payables
   - Calculates intercept opportunities
   - Proposes payments through Wells
   - Executes payments
   - Silent vendor enrollment

### Database Schema

- `erp_connections` - OAuth connections to accounting systems
- `erp_bills` - Bills/invoices from ERPs
- `erp_vendors` - Vendors/suppliers from ERPs
- `erp_payments` - Payment history
- `erp_intercepts` - Intercept proposals and executions
- `erp_sync_logs` - Sync job history
- `erp_webhook_events` - Webhook event log

## Setup

### 1. Database Migration

```bash
npm run migrate:erp
# or
node scripts/migrate-erp.js
```

### 2. QuickBooks Setup

1. Go to https://developer.intuit.com/
2. Create a new app
3. Get Client ID and Client Secret
4. Set redirect URI: `https://yourapp.com/api/erp/quickbooks/callback`
5. Add to `.env.local`:
   ```
   QUICKBOOKS_CLIENT_ID=your_client_id
   QUICKBOOKS_CLIENT_SECRET=your_client_secret
   QUICKBOOKS_REDIRECT_URI=https://yourapp.com/api/erp/quickbooks/callback
   ```

### 3. Xero Setup

1. Go to https://developer.xero.com/
2. Create a new app
3. Get Client ID and Client Secret
4. Set redirect URI: `https://yourapp.com/api/erp/xero/callback`
5. Add to `.env.local`:
   ```
   XERO_CLIENT_ID=your_client_id
   XERO_CLIENT_SECRET=your_client_secret
   XERO_REDIRECT_URI=https://yourapp.com/api/erp/xero/callback
   ```

### 4. Codat Setup

1. Sign up at https://www.codat.io/
2. Get API key
3. Add to `.env.local`:
   ```
   CODAT_API_KEY=your_api_key
   ```

## Usage

### Connecting an ERP

1. Navigate to `/erp/connect`
2. Click "Connect QuickBooks", "Connect Xero", or "Connect Any Platform"
3. Complete OAuth flow
4. System automatically syncs bills and vendors

### Viewing Payables

1. Navigate to `/erp/payables`
2. See all unpaid bills from connected ERPs
3. Review intercept proposals
4. Approve payments through Wells

### Manual Sync

```bash
curl -X POST https://yourapp.com/api/erp/sync \
  -H "Content-Type: application/json" \
  -d '{"connectionId": "connection-id-here"}'
```

### Approving Intercepts

```bash
curl -X POST https://yourapp.com/api/erp/intercepts \
  -H "Content-Type: application/json" \
  -d '{
    "interceptId": "intercept-id-here",
    "action": "approve"
  }'
```

## How "The Silent Invasion" Works

### Step 1: Connection
- Business connects their ERP via OAuth
- We get read/write access to bills, vendors, and payments

### Step 2: Auto-Scan
- Every 24 hours (or real-time via webhooks), we scan for unpaid bills
- Filter by amount ($100-$50,000 configurable)
- Calculate intercept opportunity for each bill

### Step 3: Intercept Proposal
- For each bill, calculate:
  - **Wells Fee**: 1% of bill amount
  - **Customer Current Cost**: Wire fee ($25-30), check processing ($15), labor ($5)
  - **Customer Savings**: Current cost - Wells fee
- Auto-approve if customer saves money

### Step 4: Payment Execution
- When approved, pay vendor through Wells system
- Record payment in customer's ERP
- Charge customer 1% fee

### Step 5: Silent Enrollment
- Every vendor paid gets enrolled in Wells supplier network
- No action required from vendor
- Build supplier database automatically

## Revenue Model

### Per Transaction
- **Wells Fee**: 1% of invoice amount
- **Average Invoice**: $5,000
- **Average Wells Revenue**: $50 per payment

### Network Effect
- Every customer brings 20-50 vendors
- Every vendor gets auto-enrolled
- Vendors receive payments from multiple customers
- Exponential network growth

### Example
```
Customer A connects QuickBooks
→ 30 unpaid bills totaling $150,000
→ Wells earns $1,500 (1%)
→ 30 vendors enrolled silently
→ Those 30 vendors receive payments from 5 other customers
→ Network grows from 30 to 150 suppliers
```

## API Endpoints

### Connections
- `GET /api/erp/quickbooks/connect` - Initiate QuickBooks OAuth
- `GET /api/erp/quickbooks/callback` - QuickBooks OAuth callback
- `GET /api/erp/xero/connect` - Initiate Xero OAuth
- `GET /api/erp/xero/callback` - Xero OAuth callback

### Sync
- `POST /api/erp/sync` - Trigger manual sync
- `GET /api/erp/sync?connectionId=xxx` - Get sync status

### Bills
- `GET /api/erp/bills?connectionId=xxx` - Get bills
- `GET /api/erp/bills?connectionId=xxx&status=pending` - Filter by status

### Intercepts
- `GET /api/erp/intercepts?connectionId=xxx` - Get intercepts
- `POST /api/erp/intercepts` - Approve/reject/execute intercept

### Stats
- `GET /api/erp/stats?connectionId=xxx` - Dashboard statistics

### Webhooks
- `POST /api/webhooks/erp/quickbooks` - QuickBooks webhooks
- `POST /api/webhooks/erp/xero` - Xero webhooks

## Webhooks

### QuickBooks
Webhooks trigger automatically when:
- New bill created
- Bill updated
- Bill paid
- Vendor created/updated

### Xero
Webhooks trigger automatically when:
- Invoice created/updated
- Contact created/updated
- Payment created

### Handling
All webhooks are logged to `erp_webhook_events` table and processed asynchronously.

## Security

### OAuth Tokens
- Access tokens encrypted in database
- Refresh tokens used to maintain connection
- Tokens expire after 1 hour (QuickBooks) or 30 minutes (Xero)

### Webhooks
- Signature verification required
- HMAC-SHA256 validation
- Replay attack prevention

### Data Access
- Read-only access to bills and vendors
- Write access only for payment recording
- No access to sensitive financial data

## Monitoring

### Sync Logs
```sql
SELECT * FROM erp_sync_logs
WHERE erp_connection_id = 'xxx'
ORDER BY started_at DESC
LIMIT 10;
```

### Revenue Tracking
```sql
SELECT
  SUM(revenue_captured) as total_revenue,
  COUNT(*) as total_intercepts,
  AVG(revenue_captured) as avg_revenue
FROM erp_intercepts
WHERE status = 'executed'
AND created_at >= NOW() - INTERVAL '30 days';
```

### Vendor Enrollment
```sql
SELECT
  COUNT(*) as vendors_enrolled,
  enrollment_method,
  DATE(enrollment_date) as enrollment_day
FROM erp_vendors
WHERE enrolled_in_wells = true
GROUP BY enrollment_method, enrollment_day
ORDER BY enrollment_day DESC;
```

## Troubleshooting

### Connection Failed
- Check OAuth credentials in `.env.local`
- Verify redirect URIs match exactly
- Check that app is not in sandbox mode (if production)

### Sync Failed
- Check `erp_sync_logs` for error messages
- Verify OAuth token hasn't expired
- Check API rate limits

### Webhook Not Working
- Verify webhook URL is publicly accessible
- Check signature validation
- Review `erp_webhook_events` for errors

## Scaling

### Rate Limits
- QuickBooks: 500 requests/minute
- Xero: 60 requests/minute
- Codat: 100 requests/minute

### Optimization
- Use webhooks instead of polling
- Batch API requests
- Cache vendor data locally
- Queue payment executions

## Future Enhancements

1. **NetSuite Integration** - Direct connector for enterprise customers
2. **Sage Integration** - Popular in UK/Europe
3. **Multi-Currency** - Support payments in multiple currencies
4. **Approval Workflows** - Multi-level approval for large payments
5. **Forecasting** - Predict future payables and cash flow
6. **Bulk Payments** - Pay multiple vendors in one transaction
7. **Vendor Portal** - Let vendors see payment status
8. **Analytics Dashboard** - Deep insights into spending patterns

## Support

For issues or questions:
- Email: support@wellsai.app
- Docs: https://docs.wellsai.app/erp
- Slack: #erp-integration
