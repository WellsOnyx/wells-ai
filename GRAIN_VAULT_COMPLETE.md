# GRAIN & VAULT - Complete System Documentation

## Overview

A complete, working treasury infrastructure system with proper GRAIN token economics, onboarding flow, and dashboard.

**CRITICAL**: GRAIN is NOT about interest/yield. It's about APPRECIATION through backing ratio mechanics.

## How GRAIN Works

### The Core Mechanism

GRAIN is backed 1:1 by a treasury of real assets (USD, T-bills, stablecoins). The price is calculated as:

```
GRAIN Price = Total Treasury Value / Circulating GRAIN Supply
```

### Example

**Initial State:**
- Treasury: $1,000,000
- Circulating GRAIN: 1,000,000
- GRAIN Price: $1.00

**After Treasury Growth:**
- Treasury: $1,500,000 (from fees, deposits, float yield)
- Circulating GRAIN: 1,000,000 (unchanged)
- GRAIN Price: $1.50 (50% appreciation!)
- **ALL holders now worth 50% more**

### Key Principles

1. **No Interest Payments**: GRAIN doesn't pay interest to holders
2. **Backing Ratio**: Value comes from the treasury backing per token
3. **Universal Benefit**: All holders benefit equally - "rising tide raises all boats"
4. **100% Backed**: Always maintained, verified on-chain
5. **Instant Settlement**: Transfers complete in <1s with zero fees

## System Architecture

### Database Schema

Location: `/scripts/schema-grain-vault.sql`

**Core Tables:**
- `treasury_accounts` - User accounts with balances and verification
- `treasury_backing` - Assets backing GRAIN (USD, T-bills, stablecoins)
- `grain_price_history` - Historical price tracking for charts
- `grain_transactions` - All transaction history
- `onboarding_state` - Track onboarding progress

**Key Functions:**
- `get_grain_price()` - Calculate current GRAIN price from backing ratio
- `record_grain_price()` - Store price snapshot (run hourly via cron)
- `update_account_balance_from_transaction()` - Trigger to update balances

### API Routes

#### Core APIs

1. **POST `/api/grain-vault/onboard`**
   - Complete onboarding flow
   - Create treasury account
   - Generate wallet address
   - Set verification levels and limits

2. **GET `/api/grain-vault/account`**
   - Get account details
   - Current balances (USD + GRAIN)
   - Portfolio value and allocation
   - Unrealized gains/losses
   - Recent transactions

3. **GET `/api/grain-vault/price`**
   - Current GRAIN price
   - 24h/7d/30d changes
   - Treasury breakdown by asset type
   - Circulating supply

4. **GET `/api/grain-vault/price-history`**
   - Historical price data for charts
   - Supports periods: 24h, 7d, 30d, 1y, all
   - Returns timestamps, prices, treasury values

5. **POST `/api/grain-vault/deposit`**
   - Deposit USD to account
   - Optional auto-convert to GRAIN
   - Enforces daily limits

6. **POST `/api/grain-vault/withdraw`**
   - Withdraw USD or sell GRAIN
   - Processes in 1-2 business days
   - Enforces daily limits and fees

### Frontend Pages

#### 1. Landing Page (`/grain-vault`)
- Modern glassmorphism design
- GRAIN and VAULT product overview
- Treasury SDK showcase
- Live GRAIN price display
- CTA to onboarding

#### 2. Onboarding (`/grain-vault/onboard`)
Multi-step flow:
- **Basic Info**: Name, email, phone, DOB
- **Identity**: Address, optional SSN last 4
- **Financial Profile**: Employment, income, net worth, investment experience
- **Wallet Setup**: Terms of service, auto-generates wallet
- **Initial Deposit**: Optional, can skip

**Verification Levels:**
- Basic ($1K/day limits) - Just name, email, DOB
- Intermediate ($10K/day limits) - Add SSN last 4, full address
- Advanced ($50K/day limits) - Add financial profile

#### 3. Dashboard (`/grain-vault/dashboard`)
Displays:
- Total portfolio value with unrealized gains
- USD and GRAIN balances
- Current GRAIN price with 24h/7d/30d changes
- GRAIN holdings breakdown (quantity, value, cost basis, appreciation)
- Treasury backing details (assets, percentages, total value)
- Recent transaction history
- Wallet address and limits

## Usage Guide

### 1. Setup Database

Run the schema:
```bash
psql $DATABASE_URL -f scripts/schema-grain-vault.sql
```

This will:
- Create all tables
- Add functions for price calculation
- Seed initial treasury backing ($1M across USD, T-bills, USDC)
- Record initial GRAIN price ($1.00)

### 2. Schedule Price Recording

Set up a cron job to record GRAIN price every hour:

```sql
SELECT record_grain_price();
```

This maintains price history for charts and change calculations.

### 3. User Onboarding Flow

1. User visits `/grain-vault`
2. Clicks "Open Account"
3. Completes onboarding at `/grain-vault/onboard`
4. System creates account and wallet
5. Redirects to dashboard at `/grain-vault/dashboard`

### 4. Making Deposits

```javascript
const response = await fetch('/api/grain-vault/deposit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    amount: 1000,
    payment_method: 'bank_transfer',
    auto_convert_to_grain: true // Optional: auto-buy GRAIN
  })
})
```

### 5. Checking Balance

```javascript
const response = await fetch('/api/grain-vault/account?email=user@example.com')
const data = await response.json()

console.log('Portfolio Value:', data.balances.portfolio.total_value)
console.log('GRAIN Balance:', data.balances.grain.quantity)
console.log('Current GRAIN Price:', data.balances.grain.current_price)
console.log('Unrealized Gain:', data.balances.grain.unrealized_gain)
```

### 6. Withdrawing

```javascript
// Sell GRAIN and withdraw USD
const response = await fetch('/api/grain-vault/withdraw', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    grain_amount: 500, // Sell 500 GRAIN
    destination_method: 'bank_transfer'
  })
})
```

## GRAIN Economics Deep Dive

### How Treasury Grows

1. **Transaction Fees**: Small fees on deposits/withdrawals
2. **New Deposits**: Users deposit USD, treasury grows
3. **Float Yield**: Treasury assets (T-bills, money market) earn yield
4. **No Withdrawals of Yield**: Yield stays in treasury, not distributed

### Appreciation Mechanism

When treasury grows from $1M to $1.5M with same supply:

```
Old Price = $1,000,000 / 1,000,000 = $1.00
New Price = $1,500,000 / 1,000,000 = $1.50

Appreciation = 50%
```

**Every holder benefits:**
- User A with 1,000 GRAIN: $1,000 → $1,500
- User B with 10,000 GRAIN: $10,000 → $15,000
- User C with 100 GRAIN: $100 → $150

### Why This Works

1. **Alignment**: All holders benefit from treasury growth
2. **Transparency**: Price calculation is public and verifiable
3. **Simplicity**: No complex interest calculations or distributions
4. **Fairness**: No early bird advantage - everyone gets same price
5. **Stability**: Backed 1:1, can always redeem at backing ratio

### Comparison to Alternatives

| Feature | GRAIN | Stablecoins | Interest-Bearing |
|---------|-------|-------------|------------------|
| Price | Appreciates | Fixed $1 | Fixed $1 |
| Returns | Backing ratio | None | Interest paid |
| Complexity | Simple | Simple | Complex |
| Distribution | None needed | None | Must distribute |
| Tax Treatment | Capital gains | None | Income |
| Alignment | Perfect | N/A | Good |

## Security & Compliance

### Verification Levels

**Basic** - $1K/day limits
- Full name
- Email (verified)
- Date of birth

**Intermediate** - $10K/day limits
- Everything in Basic
- Full address
- SSN last 4 digits

**Advanced** - $50K/day limits
- Everything in Intermediate
- Employment status
- Income and net worth ranges
- Investment experience
- Source of funds

### AML/KYC

- Email verification required
- Phone verification optional (increases limits)
- SSN required for limits above $10K/day
- Source of funds declaration
- Transaction monitoring (implement separately)

### Treasury Auditing

- All backing recorded in `treasury_backing` table
- Each asset has verification proof (blockchain hash, API, statement)
- Price calculation is deterministic and auditable
- Recommend: Third-party audits quarterly

## Deployment Checklist

- [ ] Deploy database schema
- [ ] Set up hourly cron for `record_grain_price()`
- [ ] Configure payment processor (Stripe, Plaid, etc.)
- [ ] Set up email verification service
- [ ] Configure SMS verification (optional)
- [ ] Set up monitoring and alerts
- [ ] Create admin panel for treasury management
- [ ] Implement transaction limits enforcement
- [ ] Set up compliance monitoring
- [ ] Create audit log system
- [ ] Deploy to production
- [ ] Test onboarding flow end-to-end
- [ ] Test deposit and withdrawal flows
- [ ] Verify price calculations are correct
- [ ] Load test with expected volume

## Future Enhancements

### Phase 2
- Mobile app (React Native)
- ACH integration for instant deposits
- Credit/debit card support
- Multi-currency support
- Enhanced price charts with technical indicators

### Phase 3
- GRAIN lending (use GRAIN as collateral)
- GRAIN payments (pay merchants in GRAIN)
- Merchant tools and plugins
- API for third-party integrations
- Treasury SDK for ERP systems

### Phase 4
- Decentralized treasury (DAO governance)
- On-chain proof of reserves
- Cross-chain GRAIN (bridge to other blockchains)
- Institutional grade custody
- Regulatory compliance expansion (EU, APAC)

## Support

For questions or issues:
- Email: support@grainandvault.com
- Documentation: https://docs.grainandvault.com
- Status: https://status.grainandvault.com

## License

Proprietary - Wells Onyx 2025
