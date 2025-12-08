# GRAIN & VAULT - Quick Start Guide

Get your GRAIN & VAULT treasury system running in 5 minutes.

## Step 1: Deploy Database Schema

```bash
psql $DATABASE_URL -f scripts/schema-grain-vault.sql
```

This creates:
- All tables for accounts, transactions, treasury backing
- Price calculation functions
- Triggers for automatic balance updates
- Initial $1M treasury backing
- Initial GRAIN price record ($1.00)

## Step 2: Verify Installation

```bash
psql $DATABASE_URL -c "SELECT * FROM get_grain_price();"
```

You should see:
```
 price_usd  | total_treasury | circulating_supply | change_24h
------------+----------------+--------------------+------------
 1.00000000 |     1000000.00 |        1000000.000 |       0.00
```

## Step 3: Test Onboarding

1. Start your Next.js app:
```bash
npm run dev
```

2. Visit: http://localhost:3000/grain-vault

3. Click "Open Account"

4. Complete the onboarding flow with test data:
   - Name: Test User
   - Email: test@example.com
   - DOB: 1990-01-01
   - Address: 123 Main St, Miami, FL 33101
   - (Optional) SSN Last 4: 1234
   - Employment: Employed
   - Source of Funds: Salary

5. Accept terms and create account

## Step 4: View Dashboard

After onboarding, you'll be redirected to:
```
http://localhost:3000/grain-vault/dashboard?email=test@example.com
```

You should see:
- Portfolio overview (initially $0)
- Current GRAIN price ($1.00)
- Treasury backing details ($1M)
- Empty transaction history

## Step 5: Make Test Deposit

Using the API:

```bash
curl -X POST http://localhost:3000/api/grain-vault/deposit \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "amount": 1000,
    "payment_method": "bank_transfer",
    "auto_convert_to_grain": true
  }'
```

Expected response:
```json
{
  "success": true,
  "deposit": {
    "transaction_id": "...",
    "amount_usd": 1000,
    "status": "completed"
  },
  "conversion": {
    "transaction_id": "...",
    "grain_amount": 1000.000000,
    "grain_price": 1.0000000000,
    "total_cost_usd": 1000
  }
}
```

## Step 6: Verify Balance

Refresh the dashboard or call the account API:

```bash
curl http://localhost:3000/api/grain-vault/account?email=test@example.com
```

You should see:
- USD Balance: $0 (converted to GRAIN)
- GRAIN Balance: 1,000 GRAIN
- GRAIN Value: $1,000
- Portfolio Value: $1,000

## Step 7: Simulate Treasury Growth

Add more backing to simulate appreciation:

```bash
psql $DATABASE_URL -c "
INSERT INTO treasury_backing (asset_type, asset_name, amount, custodian, verification_method)
VALUES ('usd_cash', 'Additional Deposit', 100000.00, 'Test Bank', 'bank_statement');
"
```

Record new price:
```bash
psql $DATABASE_URL -c "SELECT record_grain_price();"
```

Check new price:
```bash
psql $DATABASE_URL -c "SELECT * FROM get_grain_price();"
```

The price should now be higher:
```
 price_usd  | total_treasury | circulating_supply
------------+----------------+--------------------
 1.09090909 |     1100000.00 |        1000000.000
```

GRAIN appreciated 9.09%! 🎉

## Step 8: View Appreciation on Dashboard

Refresh the dashboard. You should see:
- GRAIN Price: $1.09 (up from $1.00)
- Your 1,000 GRAIN now worth: $1,090
- Unrealized Gain: +$90 (+9%)

## Common Tasks

### Add Treasury Backing
```sql
INSERT INTO treasury_backing (asset_type, asset_name, amount, custodian, verification_method)
VALUES ('t_bills', '3-Month T-Bills', 500000.00, 'BNY Mellon', 'custodian_api');

SELECT record_grain_price();
```

### Check Current Price
```sql
SELECT * FROM get_grain_price();
```

### List All Accounts
```sql
SELECT email, full_name, grain_balance, wallet_address, status
FROM treasury_accounts
WHERE status = 'active';
```

### View Recent Transactions
```sql
SELECT
  t.created_at,
  t.type,
  t.usd_amount,
  t.grain_amount,
  t.grain_price,
  t.status,
  a.email
FROM grain_transactions t
JOIN treasury_accounts a ON t.account_id = a.id
ORDER BY t.created_at DESC
LIMIT 10;
```

### Calculate Treasury Stats
```sql
SELECT
  COUNT(*) as total_accounts,
  SUM(grain_balance) as total_grain_supply,
  SUM(usd_balance) as total_usd_deposits
FROM treasury_accounts
WHERE status = 'active';
```

## Production Setup

### 1. Environment Variables

Create `.env.local`:
```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_GRAIN_VAULT_API=https://api.grainandvault.com
```

### 2. Set Up Cron Job

Add to crontab (records price every hour):
```cron
0 * * * * psql $DATABASE_URL -c "SELECT record_grain_price();"
```

### 3. Enable Payment Processing

Integrate:
- Stripe for card payments
- Plaid for bank connections
- Circle for USDC deposits

### 4. Email Verification

Set up:
- SendGrid or similar for email verification
- Twilio for SMS verification (optional)

### 5. Monitoring

Set up alerts for:
- Failed price recordings
- Backing ratio below 100%
- Large transactions (>$10K)
- Failed deposits/withdrawals

## Troubleshooting

### Price not calculating?
```sql
-- Check backing
SELECT SUM(amount) FROM treasury_backing WHERE status = 'active';

-- Check supply
SELECT SUM(grain_balance) FROM treasury_accounts WHERE status = 'active';

-- Manually trigger calculation
SELECT * FROM get_grain_price();
```

### Balances not updating?
```sql
-- Check if trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_update_balance_after_transaction';

-- Manually recalculate balance for account
UPDATE treasury_accounts SET updated_at = NOW() WHERE id = 'account-id';
```

### Dashboard not loading?
- Check API route: http://localhost:3000/api/grain-vault/price
- Verify database connection
- Check browser console for errors

## Next Steps

1. Customize onboarding flow for your brand
2. Add payment processor integration
3. Implement KYC/AML verification
4. Add email notifications
5. Create admin dashboard for treasury management
6. Set up monitoring and alerts
7. Deploy to production (Vercel + Supabase recommended)

## Support

Need help? Check:
- Full docs: `GRAIN_VAULT_COMPLETE.md`
- Database schema: `scripts/schema-grain-vault.sql`
- API routes: `app/api/grain-vault/*/route.ts`

Happy building! 🚀
