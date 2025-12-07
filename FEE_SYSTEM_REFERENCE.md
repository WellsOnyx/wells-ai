# Wells Onyx Fee System - Quick Reference

## Overview

Wells Onyx automatically captures success fees when deals are completed. The fee is deducted from escrow before releasing payment to the seller.

**Flow:**
1. Buyer confirms delivery
2. System calculates fee based on deal amount and tier
3. Fee transferred to Wells treasury wallet
4. Remaining amount transferred to seller
5. Deal marked as complete

## Fee Tiers

| Tier | Rate | Use Case | Minimum |
|------|------|----------|---------|
| **Standard** | 1.0% | Basic deals, standard service | $100 |
| **White Glove** | 3.3% | Concierge service, complex negotiations | $100 |
| **Complex** | 7.7% | High-touch strategic deals, full support | $100 |

## Fee Examples

| Deal Amount | Tier | Fee Amount | Seller Receives | Wells Receives |
|-------------|------|------------|-----------------|----------------|
| $1,000 | Standard | $100* | $900 | $100 |
| $10,000 | Standard | $100 | $9,900 | $100 |
| $25,000 | White Glove | $825 | $24,175 | $825 |
| $50,000 | White Glove | $1,650 | $48,350 | $1,650 |
| $100,000 | Complex | $7,700 | $92,300 | $7,700 |
| $1,000,000 | Complex | $77,000 | $923,000 | $77,000 |

*Minimum fee of $100 applies

## API Endpoints

### Calculate Fee
```bash
POST /api/fees/calculate
Content-Type: application/json

{
  "dealAmount": 10000,
  "tier": "standard"  // optional: standard, white-glove, complex
}
```

**Response:**
```json
{
  "success": true,
  "calculation": {
    "dealAmount": 10000,
    "tier": "standard",
    "feePercent": 1,
    "feeAmount": 100,
    "appliedFee": 100,
    "sellerReceives": 9900,
    "wellsReceives": 100
  }
}
```

### Release Payment (Captures Fee)
```bash
POST /api/deals/release
Content-Type: application/json

{
  "dealId": "deal_12345",
  "tier": "standard"  // optional, defaults to standard
}
```

**Response:**
```json
{
  "success": true,
  "deal": {
    "id": "deal_12345",
    "status": "released"
  },
  "fee": {
    "id": "fee_12345",
    "amount": 100,
    "tier": "standard"
  },
  "seller": {
    "amount": 9900,
    "transferId": "transfer_seller_12345",
    "wallet": "0xSELLER..."
  },
  "wells": {
    "feeAmount": 100,
    "transferId": "transfer_fee_12345"
  },
  "breakdown": {
    "totalEscrow": 10000,
    "feeToWells": 100,
    "amountToSeller": 9900
  }
}
```

### Get Fee History
```bash
GET /api/fees/history?limit=50
```

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "id": "fee_12345",
      "dealId": "deal_12345",
      "dealDescription": "Widget purchase",
      "dealAmount": 10000,
      "feeAmount": 100,
      "tier": "standard",
      "status": "captured",
      "capturedAt": "2025-01-15T10:00:00Z"
    }
  ],
  "summary": {
    "totalFees": 1000,
    "totalDeals": 100000,
    "dealCount": 10,
    "averageFee": 100
  }
}
```

### Get Fee Summary (Treasury View)
```bash
GET /api/fees/summary?days=30
```

**Response:**
```json
{
  "success": true,
  "timeframe": "30 days",
  "summary": {
    "totalFees": 50000,
    "feeCount": 250,
    "averageFee": 200,
    "byTier": {
      "standard": { "count": 200, "total": 20000, "average": 100 },
      "whiteGlove": { "count": 40, "total": 20000, "average": 500 },
      "complex": { "count": 10, "total": 10000, "average": 1000 }
    }
  }
}
```

### Generate Invoice
```bash
POST /api/fees/invoice
Content-Type: application/json

{
  "feeId": "fee_12345"
}
```

**Response:**
```json
{
  "success": true,
  "invoice": {
    "id": "inv_fee_12345",
    "url": "https://app.wellsonyx.com/invoices/inv_fee_12345"
  }
}
```

## Code Usage

### Calculate Fee
```typescript
import { FeeCalculator } from '@/lib/fees'

const calculation = FeeCalculator.calculateFee(10000, 'standard')
console.log(`Fee: $${calculation.appliedFee}`)
console.log(`Seller gets: $${calculation.sellerReceives}`)
```

### Recommend Tier
```typescript
import { FeeCalculator } from '@/lib/fees'

const tier = FeeCalculator.recommendFeeTier(150000, {
  requiresNegotiation: true,
  hasMilestones: true
})
// Returns: "white-glove"
```

### Capture Fee (Internal)
```typescript
import { FeeService } from '@/lib/fees'

const result = await FeeService.captureFee(
  dealId,
  amount,
  escrowWalletId,
  sellerWalletAddress,
  'standard'
)

if (result.success) {
  console.log(`Fee captured: $${result.feeAmount}`)
  console.log(`Seller receives: $${result.sellerAmount}`)
}
```

### Get Fee History
```typescript
import { FeeService } from '@/lib/fees'

const history = await FeeService.getFeeHistory(userId, 50)
history.forEach(fee => {
  console.log(`${fee.dealDescription}: $${fee.feeAmount}`)
})
```

## Database Setup

### Run Migration
```bash
# Install database schema
node scripts/migrate-fees.js

# Or manually:
psql $POSTGRES_URL < scripts/schema-fees.sql
```

### Environment Variables
```bash
# Required: Wells treasury wallet address for fee collection
WELLS_TREASURY_WALLET_ADDRESS=0x...

# Optional: Circle API configuration (already configured)
CIRCLE_API_KEY=your_circle_api_key
CIRCLE_ENV=sandbox  # or production
```

## Database Tables

### `fees`
- Tracks all success fees captured from deals
- One record per deal
- Links to Circle transfer IDs for payment tracking

### `fee_invoices`
- Generated invoices for fee payments
- Sequential invoice numbers (WO-2025-000001)
- PDF generation ready

### `fee_splits`
- Future use: revenue sharing splits
- Support for referral/partner fees

## Views

### `fee_summary`
```sql
SELECT * FROM fee_summary
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC;
```

### `user_fee_history`
```sql
SELECT * FROM user_fee_history
WHERE user_id = 'user_12345'
ORDER BY captured_at DESC;
```

### `treasury_fee_revenue`
```sql
SELECT * FROM treasury_fee_revenue
ORDER BY month DESC
LIMIT 12;
```

## Testing

### Run Test Script
```bash
node scripts/test-fee-system.js
```

### Manual Testing
```bash
# 1. Calculate fee
curl -X POST http://localhost:3000/api/fees/calculate \
  -H "Content-Type: application/json" \
  -d '{"dealAmount": 10000, "tier": "standard"}'

# 2. Check fee history
curl http://localhost:3000/api/fees/history?limit=10

# 3. Get summary
curl http://localhost:3000/api/fees/summary?days=30
```

## Integration Checklist

- [x] Fee calculator implemented
- [x] Fee service with capture logic
- [x] Database schema created
- [x] API endpoints built
- [x] Escrow release integration
- [x] Invoice generation
- [x] Fee history tracking
- [ ] Set WELLS_TREASURY_WALLET_ADDRESS
- [ ] Run database migration
- [ ] Test fee capture on staging
- [ ] Monitor fee collection metrics

## Support

For questions or issues with the fee system:
- Check logs for fee capture errors
- Verify WELLS_TREASURY_WALLET_ADDRESS is set
- Ensure Circle SDK is configured
- Review fee history in database
