# Payment Rails Integration Guide

**Wells AI Payment Infrastructure - Circle (USDC) + Stripe (Fiat)**

This is the real money movement system for Wells AI. All payments flow through these rails and automatically generate float for treasury deployment.

---

## Overview

### Payment Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PAYMENT RAILS SYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FIAT DEPOSITS        →  USDC BALANCE  →   USDC PAYMENTS       │
│  (Stripe Card/ACH)       (Unified)         (Circle)             │
│                                                                  │
│                          ↓                                       │
│                    FLOAT TRACKING                                │
│                    (3-day window)                                │
│                          ↓                                       │
│                  VAULT DEPLOYMENT                                │
│                   (Yield earning)                                │
│                          ↓                                       │
│               YIELD DISTRIBUTION                                 │
│         (50% Wells, 30% GRAIN, 20% Users)                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Features

1. **Unified Balance** - Users think in dollars, system handles USDC/fiat conversion
2. **Automatic Float Tracking** - Every payment creates float for yield generation
3. **Multiple Rails** - Card (instant), ACH (1-3 days), USDC (sub-second)
4. **Passive Yield** - Users earn 20% of float yield automatically
5. **Seamless Withdrawals** - USDC → Bank account via Stripe payouts

---

## Setup

### Environment Variables

Add these to your `.env.local`:

```bash
# Circle (USDC Payments)
CIRCLE_API_KEY=your_circle_api_key_here
CIRCLE_ENTITY_SECRET=your_circle_entity_secret_here

# Stripe (Fiat Payments)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App URL (for Stripe redirects)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Get API Keys

#### Circle
1. Sign up at [Circle Developer Console](https://console.circle.com)
2. Create API key (Production or Sandbox)
3. Save the Entity Secret for webhook verification
4. Note: Start with Sandbox for testing

#### Stripe
1. Sign up at [Stripe Dashboard](https://dashboard.stripe.com)
2. Get API keys from Developers → API keys
3. Create webhook endpoint at Developers → Webhooks
4. Copy webhook signing secret

### Database Setup

Run the payment schema migration:

```bash
psql $DATABASE_URL -f scripts/schema-payments.sql
```

This creates:
- Circle wallet and payment tables
- Stripe customer and payment intent tables
- User balance and transaction ledger
- Integration with float treasury system

---

## Architecture

### File Structure

```
lib/payments/
├── circle.ts          # Circle USDC payment integration
├── stripe.ts          # Stripe fiat payment integration
└── service.ts         # Unified payment service layer

app/api/
├── webhooks/
│   └── payments/
│       └── route.ts   # Circle & Stripe webhook handlers
└── payments/
    ├── deposit/
    │   └── route.ts   # Create deposit intent
    ├── balance/
    │   └── route.ts   # Get user balance
    └── float-metrics/
        └── route.ts   # Get float earnings

app/
└── deposit/
    └── page.tsx       # Deposit UI with Stripe Elements

scripts/
└── schema-payments.sql # Database schema
```

### Integration Points

**Float Treasury Integration:**
```typescript
import { trackFloat } from '@/lib/scale/float-treasury-integration';

// Every payment automatically creates float position
const floatPosition = await trackFloat(
  'viral_payment',  // Payment type
  paymentId,        // Source ID
  amount,           // Amount in USDC
  3                 // Settlement window (days)
);

// Float is automatically deployed to vault for yield
// Yield is distributed: 50% Wells, 30% GRAIN, 20% Users
```

---

## Usage

### 1. Deposits (Fiat → USDC)

**Card Deposit (Instant):**
```typescript
import PaymentService from '@/lib/payments/service';

// Create payment intent
const intent = await PaymentService.deposit({
  userId: 'user123',
  amount: 10000, // $100.00 in cents
  method: 'card',
});

// Frontend uses intent.clientSecret with Stripe Elements
// On success, user gets 100 USDC in their balance
```

**ACH Deposit (1-3 days):**
```typescript
const intent = await PaymentService.deposit({
  userId: 'user123',
  amount: 100000, // $1,000.00 in cents
  method: 'ach',
});
```

### 2. Get Balance

```typescript
const balance = await PaymentService.getBalance('user123');

console.log(balance);
// {
//   userId: 'user123',
//   usdc: {
//     available: 500.50,
//     pending: 100.00,
//     total: 600.50
//   },
//   usd: {
//     totalDeposited: 1000.00,
//     totalWithdrawn: 499.50,
//     net: 500.50
//   },
//   yield: {
//     earned: 5.25,
//     pending: 1.50
//   }
// }
```

### 3. Send USDC Payment

```typescript
import { sendUSDC } from '@/lib/payments/circle';

const result = await sendUSDC({
  fromUserId: 'user123',
  toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  amount: '100.00',
  metadata: {
    paymentType: 'viral_payment',
    sourceId: 'payment123',
    description: 'Invoice payment',
  },
});

// Result includes float position ID for yield tracking
console.log(result.floatPositionId);
```

### 4. Withdrawals (USDC → Bank)

**Setup bank account first:**
```typescript
const { onboardingUrl } = await PaymentService.setupBankAccount(
  'user123',
  'user@example.com'
);

// Redirect user to onboardingUrl to complete Stripe Connect
```

**Create withdrawal:**
```typescript
const payout = await PaymentService.withdraw({
  userId: 'user123',
  amount: 500.00, // USDC amount
  destination: 'bank',
});

// Payout arrives in 1-2 business days
console.log(payout.arrivalDate);
```

### 5. Payment History

```typescript
const history = await PaymentService.getPaymentHistory('user123', 50);

history.forEach(tx => {
  console.log(`${tx.type}: $${tx.amount} ${tx.currency} - ${tx.status}`);
});
```

### 6. Float Metrics

```typescript
const metrics = await PaymentService.getUserFloatMetrics('user123');

console.log(metrics);
// {
//   activeFloatPositions: 5,
//   totalFloatAmount: 1500.00,
//   totalYieldEarned: 12.50,
//   pendingYield: 3.25,
//   estimatedMonthlyYield: 6.25,
//   currentAPY: 0.05
// }
```

---

## Webhooks

### Circle Webhooks

**Setup webhook in Circle Dashboard:**
- URL: `https://your-domain.com/api/webhooks/payments?provider=circle`
- Events: `transfers.created`, `transfers.completed`, `transfers.failed`

**Events handled:**
- Payment confirmations
- Transaction hash updates
- Float position status changes

### Stripe Webhooks

**Setup webhook in Stripe Dashboard:**
- URL: `https://your-domain.com/api/webhooks/payments?provider=stripe`
- Events:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `payout.paid`
  - `payout.failed`
  - `account.updated`

**Events handled:**
- Deposit confirmations
- Balance updates
- Payout status changes
- Connected account verification

---

## Frontend Integration

### Deposit Page

The deposit page (`/deposit`) provides a complete UI for:
- Card and ACH deposits
- Real-time balance display
- Float earnings dashboard
- Transaction history

**Key features:**
- Stripe Elements for secure card input
- Automatic USDC conversion
- Float yield projections
- Quick actions for withdrawals

### Example Usage

```typescript
// User visits /deposit
// 1. Enters amount: $100
// 2. Selects method: Card
// 3. Completes payment with Stripe Elements
// 4. Receives 100 USDC instantly
// 5. Can immediately send payments
// 6. Float from payments earns yield
```

---

## Float Flywheel

### How It Works

1. **Payment Created** → Float position tracked (3-day window)
2. **Float Deployed** → Funds move to Grain & Vault yield strategies
3. **Yield Earned** → 5% APY on average float balance
4. **Yield Distributed**:
   - 50% to Wells (revenue)
   - 30% to GRAIN token appreciation
   - 20% to payment participants (users)

### User Benefits

**For a user making $10k/month in payments:**
- Average float: ~$1,000 (3-day settlement)
- Annual yield: $50 (5% APY)
- User share (20%): $10/year in passive income
- Plus: GRAIN token appreciation from 30% share

**At scale ($1T/year volume):**
- Average float: ~$100B
- Annual yield: $5B
- User rewards: $1B/year distributed

---

## Security

### API Keys
- Store all keys in environment variables
- Never commit keys to git
- Use separate keys for development/production

### Webhook Verification
- All webhooks verify signatures
- Circle: HMAC SHA256
- Stripe: Built-in signature verification
- Reject unsigned requests

### Balance Safety
- All balance changes go through ledger
- Transactions are atomic
- Balances cannot go negative
- Audit trail for all operations

---

## Testing

### Development Mode

1. **Circle Sandbox:**
   - Use sandbox API key
   - Test with fake USDC
   - Instant confirmations

2. **Stripe Test Mode:**
   - Use test API keys
   - Test cards: `4242 4242 4242 4242`
   - Simulate ACH: Use Stripe test bank accounts

### Test Flow

```bash
# 1. Create deposit
curl -X POST http://localhost:3000/api/payments/deposit \
  -H "Content-Type: application/json" \
  -d '{"amount": 10000, "method": "card"}'

# 2. Get balance
curl http://localhost:3000/api/payments/balance

# 3. Get float metrics
curl http://localhost:3000/api/payments/float-metrics

# 4. Test webhooks
# Use Stripe CLI or Circle webhook simulator
```

---

## Production Checklist

### Before Launch

- [ ] Configure production API keys
- [ ] Set up webhook endpoints
- [ ] Test deposit flow end-to-end
- [ ] Test withdrawal flow
- [ ] Verify webhook signatures
- [ ] Monitor float tracking
- [ ] Set up error alerting
- [ ] Review rate limits
- [ ] Configure backup payment methods
- [ ] Test edge cases (insufficient balance, failed payments)

### Monitoring

**Key metrics to track:**
- Deposit success rate
- Payment confirmation time
- Float deployment rate
- Yield generation
- Withdrawal processing time
- Failed payment rate

### Rate Limits

**Circle:**
- 100 requests per second
- 10,000 wallets per account

**Stripe:**
- 100 requests per second (test mode)
- Unlimited in production with verification

---

## Troubleshooting

### Common Issues

**"Insufficient balance"**
- Check user's USDC balance
- Verify pending deposits have settled
- Check for failed deposits

**"Webhook signature verification failed"**
- Verify webhook secret in environment
- Check webhook URL configuration
- Ensure raw body is used for verification

**"Payment not found"**
- Check payment ID format
- Verify payment was created
- Check database for payment record

**"Payout failed"**
- Verify connected account is verified
- Check bank account details
- Review Stripe Dashboard for specific error

### Debug Helpers

```typescript
// Check Circle wallet status
import { getUserWallet } from '@/lib/payments/circle';
const wallet = await getUserWallet('user123');
console.log(wallet);

// Check Stripe customer
import { getOrCreateCustomer } from '@/lib/payments/stripe';
const customer = await getOrCreateCustomer('user123');
console.log(customer);

// Check balance ledger
SELECT * FROM balance_transactions
WHERE user_id = 'user123'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Next Steps

### Phase 2 Enhancements

1. **Multi-Currency Support**
   - EURC, USDT in addition to USDC
   - Auto-conversion at best rates

2. **Instant Payouts**
   - Stripe Instant Payouts (higher fees)
   - Same-day ACH option

3. **Plaid Integration**
   - Bank account linking
   - Balance verification
   - Direct ACH

4. **Payment Links**
   - Generate payment links for invoices
   - QR codes for in-person payments

5. **Recurring Payments**
   - Subscription handling
   - Auto-charging saved cards

6. **Batch Payments**
   - Pay multiple recipients at once
   - CSV upload for bulk payments

---

## Support

### Resources

- **Circle Docs**: https://developers.circle.com/
- **Stripe Docs**: https://stripe.com/docs
- **Wells AI Docs**: See other guides in this repo

### Getting Help

1. Check this guide first
2. Review error messages in logs
3. Check Circle/Stripe status pages
4. Review webhook logs
5. Contact support with specific error details

---

**Built with:**
- Circle API v1
- Stripe API v2024-12-18
- Next.js 14
- Supabase
- TypeScript

**Last Updated**: 2025-12-07
