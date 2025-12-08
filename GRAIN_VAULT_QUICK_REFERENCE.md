# GRAIN & VAULT - Quick Reference Card

## 🚀 Deploy in 3 Commands

```bash
# 1. Deploy schema
psql $DATABASE_URL -f scripts/schema-grain-vault.sql

# 2. Verify
psql $DATABASE_URL -c "SELECT * FROM get_grain_price();"

# 3. Start app
npm run dev
```

Visit: http://localhost:3000/grain-vault

## 📊 GRAIN Economics Formula

```
GRAIN Price = Total Treasury Value / Circulating GRAIN Supply

Example:
$1,500,000 / 1,000,000 GRAIN = $1.50 per GRAIN
```

**NOT interest. APPRECIATION through backing ratio.**

## 🔗 Key URLs

- Landing: `/grain-vault`
- Onboarding: `/grain-vault/onboard`
- Dashboard: `/grain-vault/dashboard?email=user@example.com`

## 🛠️ Key API Endpoints

```javascript
// Get current GRAIN price
GET /api/grain-vault/price

// Complete onboarding
POST /api/grain-vault/onboard
Body: { email, full_name, date_of_birth, ... }

// Get account details
GET /api/grain-vault/account?email=user@example.com

// Deposit USD (optionally convert to GRAIN)
POST /api/grain-vault/deposit
Body: { email, amount, auto_convert_to_grain: true }

// Withdraw (sell GRAIN for USD)
POST /api/grain-vault/withdraw
Body: { email, grain_amount, destination_method }

// Get price history
GET /api/grain-vault/price-history?period=30d
```

## 💾 Common SQL Queries

```sql
-- Get current GRAIN price
SELECT * FROM get_grain_price();

-- Record new price snapshot
SELECT record_grain_price();

-- Add treasury backing
INSERT INTO treasury_backing (asset_type, asset_name, amount, custodian, verification_method)
VALUES ('usd_cash', 'New Deposit', 100000.00, 'Bank Name', 'bank_statement');

-- List all accounts
SELECT email, full_name, grain_balance, wallet_address, status
FROM treasury_accounts
WHERE status = 'active';

-- Check total treasury
SELECT SUM(amount) as total_treasury
FROM treasury_backing
WHERE status = 'active';

-- Check circulating supply
SELECT SUM(grain_balance) as circulating_supply
FROM treasury_accounts
WHERE status = 'active';

-- Recent transactions
SELECT
  t.created_at,
  t.type,
  t.usd_amount,
  t.grain_amount,
  t.grain_price,
  a.email
FROM grain_transactions t
JOIN treasury_accounts a ON t.account_id = a.id
ORDER BY t.created_at DESC
LIMIT 10;
```

## 🎯 Verification Levels

| Level | Daily Deposit | Daily Withdraw | Required Info |
|-------|--------------|----------------|---------------|
| Basic | $1,000 | $1,000 | Name, Email, DOB |
| Intermediate | $10,000 | $10,000 | + Address, SSN last 4 |
| Advanced | $50,000 | $50,000 | + Financial profile |

## 📝 Onboarding Steps

1. **Basic Info** - Name, email, phone, DOB
2. **Identity** - Address, optional SSN last 4
3. **Financial Profile** - Employment, income, source of funds
4. **Wallet Setup** - Accept terms, auto-generate wallet
5. **Initial Deposit** - Optional, can skip

## 💡 Testing Appreciation

```bash
# 1. Create test account via onboarding UI

# 2. Make deposit (converts to GRAIN at $1.00)
curl -X POST http://localhost:3000/api/grain-vault/deposit \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","amount":1000,"auto_convert_to_grain":true}'

# 3. Add treasury backing to simulate growth
psql $DATABASE_URL -c "
INSERT INTO treasury_backing (asset_type, asset_name, amount, custodian, verification_method)
VALUES ('usd_cash', 'Growth', 100000.00, 'Test', 'test');
"

# 4. Record new price
psql $DATABASE_URL -c "SELECT record_grain_price();"

# 5. Check new price (should be ~$1.09)
psql $DATABASE_URL -c "SELECT * FROM get_grain_price();"

# 6. Refresh dashboard - see 9% appreciation!
```

## ⚙️ Production Setup

```bash
# Set up hourly price recording (crontab)
0 * * * * psql $DATABASE_URL -c "SELECT record_grain_price();"

# Environment variables needed
DATABASE_URL=postgresql://...
STRIPE_SECRET_KEY=sk_...
PLAID_CLIENT_ID=...
PLAID_SECRET=...
SENDGRID_API_KEY=SG...
```

## 🐛 Troubleshooting

**Price not calculating?**
```sql
-- Check backing exists
SELECT SUM(amount) FROM treasury_backing WHERE status = 'active';

-- Check supply exists
SELECT SUM(grain_balance) FROM treasury_accounts WHERE status = 'active';
```

**Balances not updating?**
```sql
-- Check trigger exists
SELECT tgname FROM pg_trigger
WHERE tgname = 'trigger_update_balance_after_transaction';
```

**Dashboard not loading?**
- Check API: http://localhost:3000/api/grain-vault/price
- Check database connection
- Check browser console

## 📚 Documentation

- **Full Docs**: `GRAIN_VAULT_COMPLETE.md`
- **Quick Start**: `GRAIN_VAULT_QUICKSTART.md`
- **Build Summary**: `GRAIN_VAULT_BUILD_SUMMARY.md`
- **Database Schema**: `scripts/schema-grain-vault.sql`

## 🎨 Design System

**Colors:**
- Green: `#22C55E` (primary, GRAIN)
- Blue: `#3B82F6` (secondary, VAULT)
- Purple: `#A855F7` (accent, SDK)
- Black: `#000000` (background)
- White: `#FFFFFF` (text)

**Key UI Components:**
- Glassmorphism cards (`bg-white/5 border border-white/10`)
- Green gradient buttons (`from-green-500 to-green-600`)
- Progress indicators with step dots
- Transaction list with status icons

## 🔐 Security Checklist

- [ ] Enable rate limiting on APIs
- [ ] Add CSRF protection
- [ ] Implement email verification
- [ ] Set up 2FA for withdrawals
- [ ] Enable audit logging
- [ ] Set up fraud detection
- [ ] Implement transaction monitoring
- [ ] Add IP whitelisting for admin

## 📞 Support

**Need Help?**
- Read the docs first
- Check SQL schema comments
- Review API route code
- Test with curl commands
- Check database logs

**Common Issues:**
1. Price calculation → Check backing and supply
2. Balance updates → Check triggers
3. API errors → Check logs and database connection
4. Dashboard blank → Verify account exists

## 🚀 Quick Demo Script

```bash
# 1. Deploy
psql $DATABASE_URL -f scripts/schema-grain-vault.sql

# 2. Start
npm run dev

# 3. Open
open http://localhost:3000/grain-vault

# 4. Create account
# (Use UI to complete onboarding)

# 5. Deposit
curl -X POST http://localhost:3000/api/grain-vault/deposit \
  -d '{"email":"demo@example.com","amount":5000,"auto_convert_to_grain":true}'

# 6. Simulate appreciation
psql $DATABASE_URL -c "
INSERT INTO treasury_backing VALUES (gen_random_uuid(), 'usd_cash', 'Demo Growth', 250000.00, 0, 0, 'Demo Bank', NULL, NOW(), 'bank_statement', NULL, 'active', NOW(), NOW());
SELECT record_grain_price();
"

# 7. Check results
open "http://localhost:3000/grain-vault/dashboard?email=demo@example.com"

# GRAIN appreciated 25%! 🎉
```

---

**Built with:** Next.js 14, PostgreSQL, Vercel Postgres SDK, TailwindCSS, Chart.js

**License:** Proprietary - Wells Onyx 2025
