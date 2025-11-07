# Grain & Vault Quick Start Guide

**Get started with the new pricing system in 5 minutes.**

---

## Quick Reference

### Fee Rates
- **In-Network:** 0.33% (both have wallets + verified)
- **Sourced:** 3.3% (platform matched)
- **Originated:** 7% (Wells negotiated)
- **Tithe:** 10% of all fees → Adullam Fund

### Payment Rails
- **GRAIN:** Free
- **USDC:** 0.1%
- **ACH:** 0.8% (capped at $5)
- **Wire:** $25 flat
- **Card:** 2.9% + $0.30

---

## Usage Examples

### 1. Calculate Fee (Simple)

```typescript
import { calculateFee } from '@/lib/pricing/calculator'
import { DealType, PaymentRail } from '@/lib/pricing/types'

// $1,000 transaction at originated tier
const breakdown = calculateFee(
  100000,  // cents
  DealType.ORIGINATED,
  PaymentRail.ACH
)

console.log(breakdown.totalCharge)  // 7005 ($70.05)
```

### 2. Auto-Infer Deal Type

```typescript
import { inferDealType } from '@/lib/pricing/calculator'

const context = {
  amount: 100000,
  buyer: { userId: '...', wallet: {...} },
  seller: { userId: '...', wallet: {...} },
  platformMatched: true,
  wellsNegotiated: false
}

const dealType = inferDealType(context)
// Returns: 'in_network' or 'sourced' or 'originated'
```

### 3. Show Savings

```typescript
import { calculateSavings } from '@/lib/pricing/calculator'

const savings = calculateSavings(
  100000,
  DealType.ORIGINATED,
  PaymentRail.ACH
)

console.log(savings.savingsAmount)  // 6670 ($66.70 saved!)
```

### 4. Create Wallet

```typescript
import { createWallet } from '@/lib/wallet/manager'

const result = await createWallet({
  userId: 'user_123',
  email: 'buyer@acme.com',
  businessName: 'Acme Corp',
  initialDepositUSDC: 50000  // $500
})

console.log(result.wallet.address)  // '0x...'
```

### 5. API Call (Fee Estimation)

```bash
curl -X POST http://localhost:3000/api/pricing/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100000,
    "dealType": "originated",
    "rail": "ach"
  }'
```

---

## Environment Setup

Add to `.env`:

```bash
ADULLAM_WALLET_ADDRESS=0x...
WELLS_TREASURY_WALLET=0x...
GRAIN_VAULT_ADDRESS=0x...
GRAIN_TOKEN_ADDRESS=0x...

GRAIN_ENABLED=false
CREDIT_LINES_ENABLED=false
TREASURY_YIELD_ENABLED=false
IN_NETWORK_ENABLED=false
```

---

## Common Calculations

### $1,000 Transaction
| Tier | Fee | Tithe | Net to Wells | Total |
|------|-----|-------|--------------|-------|
| Originated | $70.00 | $7.00 | $63.00 | $70.00 |
| Sourced | $33.00 | $3.30 | $29.70 | $33.00 |
| In-Network | $3.30 | $0.33 | $2.97 | $3.30 |

### $10,000 Transaction
| Tier | Fee | Tithe | Net to Wells | Total |
|------|-----|-------|--------------|-------|
| Originated | $700.00 | $70.00 | $630.00 | $700.00 |
| Sourced | $330.00 | $33.00 | $297.00 | $330.00 |
| In-Network | $33.00 | $3.30 | $29.70 | $33.00 |

### $100,000 Transaction
| Tier | Fee | Tithe | Net to Wells | Total |
|------|-----|-------|--------------|-------|
| Originated | $7,000.00 | $700.00 | $6,300.00 | $7,000.00 |
| Sourced | $3,300.00 | $330.00 | $2,970.00 | $3,300.00 |
| In-Network | $330.00 | $33.00 | $297.00 | $330.00 |

---

## Credit Line Tiers

### Tier 1 (New Users)
- Multiplier: 1:1
- Deposit $100K → Get $100K credit
- Interest-free: 30 days
- APR after: 8%

### Tier 2 (3+ Months)
- Multiplier: 1.5:1
- Deposit $100K → Get $150K credit
- Interest-free: 45 days
- APR after: 6%

### Tier 3 (12+ Months)
- Multiplier: 2:1
- Deposit $100K → Get $200K credit
- Interest-free: 60 days
- APR after: 5%

---

## In-Network Requirements

Both parties must have:
- ✅ GRAIN wallet
- ✅ KYB verified
- ✅ Min $100 GRAIN balance
- ✅ 1+ completed transaction

---

## API Endpoints

### Fee Estimation
```
POST /api/pricing/estimate
Body: { amount, dealType?, rail?, context? }
```

### Wallet Creation
```
POST /api/wallet/create
Body: { email, businessName, initialDepositUSDC? }
```

### Wallet Balance
```
GET /api/wallet/balance?address=0x...
```

### Fund Wallet
```
POST /api/wallet/fund
Body: { walletAddress, amountUSDC, autoSwapToGrain? }
```

### Create Transaction
```
POST /api/transactions/create
Body: { amount, dealType?, rail?, buyerId, sellerId, context? }
```

---

## React Component

```tsx
import FeeEstimator from '@/app/components/FeeEstimator'

export default function PricingPage() {
  return (
    <div>
      <h1>Calculate Your Fees</h1>
      <FeeEstimator />
    </div>
  )
}
```

---

## Testing Checklist

- [ ] Calculate fee for $1,000 originated
- [ ] Calculate fee for $10,000 sourced
- [ ] Calculate fee for $100,000 in-network
- [ ] Verify tithe is exactly 10%
- [ ] Test auto-inference with context
- [ ] Test savings calculator
- [ ] Create wallet via API
- [ ] Query wallet balance
- [ ] Fund wallet with USDC
- [ ] Create transaction
- [ ] Verify fee distribution
- [ ] Test FeeEstimator UI

---

## Common Issues

### "Missing deal source attribution tag"
→ Provide a `dealSourceTag` in the request

### "Buyer does not have a GRAIN wallet"
→ Create wallet via `/api/wallet/create` first

### "Wallet is not verified"
→ Complete KYB verification

### "Deal was not Wells negotiated"
→ Use `sourced` tier instead of `originated`

---

## Resources

- **Full Strategy:** `GRAIN_TOKENOMICS.md`
- **Implementation Guide:** `GRAIN_VAULT_IMPLEMENTATION.md`
- **Build Summary:** `GRAIN_BUILD_SUMMARY.md`
- **This Guide:** `GRAIN_QUICK_START.md`

---

## Support

Questions? Check:
1. Code comments in each file
2. Implementation guide examples
3. API response messages

---

**Ready to build the future of B2B payments!** 🚀
