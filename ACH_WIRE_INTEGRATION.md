# ACH/Wire Payment Integration

## Why This Matters

For commodities (vegetables, grain, etc.) with <2% margins, credit card fees can kill the deal:

### Cost Comparison on $100K Transaction

| Payment Method | Fee | % of Transaction | Savings vs Card |
|---------------|-----|------------------|-----------------|
| **Credit Card** | $2,900.30 | 2.90% | - |
| **ACH** | $0.25 | 0.0003% | **$2,900.05** |
| **Wire** | $15.00 | 0.015% | **$2,885.30** |
| **Grain** (future) | $0.01 | 0.00001% | **$2,900.29** |

**On a $1M vegetable order:**
- Card: $29,003 in fees (kills 1% margin deal)
- ACH: $0.25 in fees (deal lives!)
- **Savings: $29,002.75**

## How It Works

### 1. Plaid Integration (lib/plaid.ts)

```typescript
// Connect bank account
const { linkToken } = await createLinkToken(userId, userName)

// Exchange public token for access token (stored in Clerk metadata)
const { accessToken, itemId } = await exchangePublicToken(publicToken)

// Get connected accounts
const accounts = await getAccounts(accessToken)

// Create ACH payment
const payment = await createACHPayment({
  accessToken,
  accountId: 'plaid_account_id',
  amount: 100000, // $100K
  description: '50 tons of organic vegetables',
})
```

### 2. API Endpoints

**POST /api/plaid/create-link-token**
- Creates Plaid Link token for connecting bank account
- Returns: `{ linkToken, expiration }`

**POST /api/plaid/exchange-token**
- Exchanges public token for access token
- Stores in Clerk user metadata (encrypted)
- Returns: `{ accounts, message }`

**GET /api/plaid/accounts**
- Gets connected bank accounts
- Returns: `{ accounts, hasACHConnected }`

**POST /api/payments/create-ach**
- Creates ACH payment with dynamic pricing
- Auto-detects industry tier
- Returns: `{ payment, pricing, total }`

### 3. Payment Method Selector Component

```tsx
<PaymentMethodSelector
  amount={10000000} // $100K in cents
  selectedMethod="ach"
  onMethodChange={(method) => setPaymentMethod(method)}
  hasACHConnected={true}
  onConnectACH={() => openPlaidLink()}
/>
```

**Features:**
- Cost comparison for all payment methods
- Savings alert if ACH saves $1000+
- "Connect Bank Account" CTA
- Color-coded cheapest option
- Settlement time display

### 4. Dynamic Pricing Integration

ACH payments automatically use the dynamic pricing engine:

```typescript
// User: "I sell 50 tons of vegetables"
const detection = await detectIndustryTier("50 tons of vegetables")
// → tier: "commodities" (0.5% margin)

const pricing = await calculateDynamicPricing(100000, 'ach', 'commodities')
// → processingCost: $0.25 (Plaid)
// → wellsAIMargin: $500 (0.5%)
// → totalFee: $500.25
// → sellerReceives: $99,499.75
```

**vs Credit Card:**
```typescript
const pricing = await calculateDynamicPricing(100000, 'stripe', 'commodities')
// → processingCost: $2,900.30 (Stripe)
// → wellsAIMargin: $500 (0.5%)
// → totalFee: $3,400.30
// → sellerReceives: $96,599.70
// → LOSES $2,900 more than ACH!
```

## User Flow

### Connecting Bank Account (One-Time)

1. User clicks "Connect Bank Account"
2. Opens Plaid Link modal
3. User selects bank, logs in
4. Plaid returns public token
5. We exchange for access token
6. Store encrypted in Clerk metadata
7. User can now pay with ACH

### Making ACH Payment

1. User chats: "I need to pay for vegetables"
2. Wells AI detects tier: commodities
3. Shows payment method selector
4. Alert: "Save $2,900 with ACH"
5. User selects ACH
6. Shows pricing breakdown:
   - Transaction: $100,000
   - Processing: $0.25
   - Wells AI: $500
   - Total: $100,500.25
7. User confirms
8. ACH transfer initiated
9. Settlement: 1-3 business days

## Environment Variables

```bash
# Plaid
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_secret
PLAID_ENV=sandbox # or production

# Plaid webhook endpoint
NEXT_PUBLIC_APP_URL=https://wellsai.vercel.app
```

## Testing in Sandbox

Plaid sandbox uses test credentials:
- Institution: Chase
- Username: user_good
- Password: pass_good

This will create a test ACH connection without real money.

## Production Checklist

- [ ] Set PLAID_ENV=production
- [ ] Update Plaid secrets to production keys
- [ ] Enable Plaid Auth product in dashboard
- [ ] Set up webhook endpoint
- [ ] Test with real bank account (small amount first)
- [ ] Monitor settlement times
- [ ] Set up ACH return handling (failed payments)

## Future: Wire Transfers

Wire transfers are next:
- Same-day settlement
- $15 flat fee (vs $2,900 for card on $100K)
- Manual process (bank details exchange)
- Good for $500K+ transactions

## Future: Grain (0% Fees)

When Grain launches:
- $0.01 gas fee (Base L2)
- Instant settlement
- 1:1 leverage (deposit $100K, get $100K credit)
- No processing costs = lowest fees possible

## Impact

**For a vegetable distributor doing $10M/year:**

| Payment Method | Annual Fees |
|---------------|-------------|
| Credit Card | $290,030 |
| ACH | $2.50 |
| **Savings** | **$290,027.50/year** |

This is the difference between staying in business and going bankrupt.

## Files Created

- `lib/plaid.ts` - Plaid integration
- `app/api/plaid/create-link-token/route.ts` - Link token endpoint
- `app/api/plaid/exchange-token/route.ts` - Token exchange endpoint
- `app/api/plaid/accounts/route.ts` - Get accounts endpoint
- `app/api/payments/create-ach/route.ts` - ACH payment endpoint
- `app/components/PaymentMethodSelector.tsx` - Payment method UI

## Example: Vegetables vs Semiconductors

**Vegetables ($100K, 1% margin, ACH)**
- Processing: $0.25
- Wells AI (0.5%): $500
- Total fee: $500.25
- Seller receives: $99,499.75
- Seller profit: $1,000 (1%)
- **Fee is 50% of profit** (acceptable)

**Same deal with credit card:**
- Processing: $2,900.30
- Wells AI (0.5%): $500
- Total fee: $3,400.30
- Seller receives: $96,599.70
- Seller profit: -$1,900 (LOSS!)
- **Seller LOSES money**

---

**Semiconductors ($12.5M, 20% margin, Credit Card OK)**
- Processing: $362,537.50
- Wells AI (3%): $375,000
- Total fee: $737,537.50
- Seller receives: $11,762,462.50
- Seller profit: $2.5M (20%)
- Fee is 29.5% of profit (acceptable for high-margin business)

ACH works for both, but CRITICAL for commodities.
