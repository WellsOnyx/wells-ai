# Wells AI Stripe Connect Implementation

## Overview

Complete Stripe Connect seller onboarding system with automatic 33 basis point (0.33%) fee collection for Wells AI.

## What Was Built

### Complete Payment Infrastructure
- **Seller Onboarding**: Express accounts with guided Stripe onboarding
- **Payment Processing**: Automatic Wells AI fee collection (33 basis points)
- **Seller Payouts**: Daily automatic payouts to seller bank accounts
- **Dashboard**: Full-featured seller earnings and transaction dashboard
- **Admin Dashboard**: Stripe Express Dashboard access for sellers

## Files Created

### 1. Core Library
- **`lib/stripe.ts`** (584 lines)
  - Stripe Connect account management
  - Payment processing with application fees
  - Customer management (buyers)
  - Checkout session creation
  - Balance and transfer queries
  - Refund handling

### 2. API Routes

#### Seller Onboarding Flow
- **`app/api/stripe/connect/onboard/route.ts`**
  - Creates Stripe Connect account
  - Generates onboarding link
  - Saves account ID to Clerk metadata

- **`app/api/stripe/connect/return/route.ts`**
  - Handles return from Stripe onboarding
  - Verifies account completion
  - Updates Clerk: `stripeConnectComplete: true`

- **`app/api/stripe/connect/refresh/route.ts`**
  - Regenerates onboarding link if expired
  - Handles abandoned onboarding flows

- **`app/api/stripe/connect/dashboard/route.ts`**
  - Generates Express Dashboard login link
  - Allows sellers to manage account

- **`app/api/stripe/connect/stats/route.ts`**
  - Fetches seller balance (available + pending)
  - Returns recent transfers
  - Provides upcoming payout info

#### Payment Processing
- **`app/api/stripe/checkout/route.ts`**
  - Creates Stripe Checkout Session
  - Calculates 33bps Wells AI fee
  - Routes payment to seller with application fee

### 3. Frontend
- **`app/seller/dashboard/page.tsx`** (367 lines)
  - Onboarding CTA for new sellers
  - Earnings display (available + pending)
  - Transaction history
  - Payout schedule
  - Express Dashboard access

### 4. Documentation
- **`STRIPE_CONNECT_GUIDE.md`** - Complete implementation guide
- **`STRIPE_INTEGRATION_EXAMPLES.md`** - Code examples and use cases
- **`STRIPE_CONNECT_README.md`** - This file
- **`.env.example`** - Updated with Stripe configuration

## How It Works

### Seller Onboarding Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Seller visits /seller/dashboard                         │
│    - Shows "Complete Stripe Onboarding" button            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Click button → POST /api/stripe/connect/onboard         │
│    - Creates Stripe Connect Express account                │
│    - Saves stripeConnectAccountId to Clerk                 │
│    - Returns onboarding URL                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Redirects to Stripe                                      │
│    - Seller enters business/personal info                  │
│    - Adds bank account for payouts                         │
│    - Verifies identity                                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Stripe redirects to /api/stripe/connect/return          │
│    - Verifies account is complete                          │
│    - Updates Clerk: stripeConnectComplete = true           │
│    - Redirects to /seller/dashboard?success=...            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Dashboard shows earnings and payouts                     │
│    - Available balance                                     │
│    - Pending balance                                       │
│    - Transaction history                                   │
│    - Link to Stripe Express Dashboard                     │
└─────────────────────────────────────────────────────────────┘
```

### Payment Flow with 33 Basis Point Fee

```
┌─────────────────────────────────────────────────────────────┐
│ Example: Buyer purchases $100 item from seller              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Create Checkout Session                                  │
│    const wellsAIFee = calculateWellsAIFee(10000) // $0.33  │
│    Total buyer pays: $100.33                               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Stripe processes payment                                 │
│    application_fee_amount: 33 (cents)                      │
│    transfer_data.destination: seller_account_id            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Money distribution                                       │
│    - Wells AI receives: $0.33 (application fee)            │
│    - Seller receives: $99.67 (minus Stripe fees ~2.9%)     │
│    - Stripe deducts: ~$3.20 (processing fee)               │
│    - Seller net: ~$96.47                                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Automatic payout to seller                               │
│    - Daily automatic payout to bank account                │
│    - Typically arrives in 2-3 business days                │
└─────────────────────────────────────────────────────────────┘
```

## Fee Calculation

### 33 Basis Points Explained
```typescript
// 1 basis point = 0.01%
// 33 basis points = 0.33%

function calculateWellsAIFee(amountInCents: number): number {
  return Math.round(amountInCents * 0.0033)
}

// Examples:
calculateWellsAIFee(10000)   // $100.00 → $0.33
calculateWellsAIFee(100000)  // $1,000.00 → $3.30
calculateWellsAIFee(1000000) // $10,000.00 → $33.00
```

### Revenue Projection
```
Monthly Transaction Volume: $1,000,000
Wells AI Fee (33 bps):      $3,300/month
Annual Revenue:             $39,600/year

At $10M monthly volume:     $33,000/month ($396,000/year)
At $100M monthly volume:    $330,000/month ($3.96M/year)
```

## Clerk Metadata Schema

### Seller Metadata
```typescript
{
  publicMetadata: {
    // Stripe Connect (saved during onboarding)
    stripeConnectAccountId: 'acct_1234567890',
    stripeConnectComplete: true,
    stripeConnectCompletedAt: '2025-10-31T12:00:00Z'
  }
}
```

### Buyer Metadata
```typescript
{
  publicMetadata: {
    // Stripe Customer (saved on first purchase)
    stripeCustomerId: 'cus_1234567890'
  }
}
```

## API Endpoints Reference

### Seller Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/stripe/connect/onboard` | POST | Start seller onboarding |
| `/api/stripe/connect/return` | GET | Handle onboarding completion |
| `/api/stripe/connect/refresh` | GET | Refresh expired onboarding link |
| `/api/stripe/connect/dashboard` | POST | Get Express Dashboard link |
| `/api/stripe/connect/stats` | GET | Get seller earnings & transfers |

### Buyer Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/stripe/checkout` | POST | Create checkout session |
| `/api/stripe/payment-success` | GET | Handle successful payment |

## Environment Variables

### Required
```bash
STRIPE_SECRET_KEY=sk_test_51...           # Stripe secret key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51...  # Stripe publishable key
NEXT_PUBLIC_APP_URL=http://localhost:3000  # App URL for redirects

# Clerk (for user management)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### Optional (Production)
```bash
STRIPE_WEBHOOK_SECRET=whsec_...  # For webhook signature verification
```

## Quick Start

### 1. Install Dependencies
Already included in `package.json`:
- `stripe` - Stripe Node.js library
- `@stripe/stripe-js` - Stripe.js for frontend
- `@clerk/nextjs` - Clerk authentication
- `zod` - Request validation

### 2. Configure Environment
```bash
cp .env.example .env.local

# Add your Stripe keys from:
# https://dashboard.stripe.com/apikeys
```

### 3. Start Development Server
```bash
npm run dev
```

### 4. Test Seller Onboarding
1. Navigate to: `http://localhost:3000/seller/dashboard`
2. Click "Complete Stripe Onboarding"
3. Fill out test information:
   - Use test mode (keys start with `sk_test_`)
   - Test bank account: `000123456789`
   - Routing number: `110000000`
4. Complete onboarding
5. Verify dashboard shows earnings and payout info

### 5. Test Payment Flow
```typescript
// Example: Create a test payment
const response = await fetch('/api/stripe/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amountInCents: 10000,  // $100.00
    description: 'Test Product',
    sellerId: 'user_seller_test_id',
  })
})

const { sessionUrl } = await response.json()
window.location.href = sessionUrl
```

## Production Deployment

### 1. Switch to Live Mode
```bash
# Update .env.local with live keys
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### 2. Set Up Webhooks
1. Go to: https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://your-app.com/api/stripe/webhooks`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `account.updated` (for Connect accounts)
4. Copy webhook secret to `.env.local`

### 3. Enable Connect in Dashboard
1. Go to: https://dashboard.stripe.com/connect/overview
2. Complete platform profile
3. Enable Express accounts
4. Set branding and support info

### 4. Deploy to Vercel
```bash
npm run deploy:prod
```

## Monitoring & Analytics

### Track in Stripe Dashboard
- **Connect**: https://dashboard.stripe.com/connect/accounts/overview
- **Payments**: https://dashboard.stripe.com/payments
- **Application Fees**: https://dashboard.stripe.com/connect/application-fees

### Metrics to Monitor
- Total transaction volume
- Wells AI fees collected
- Number of onboarded sellers
- Failed onboarding attempts
- Failed payments
- Refund rate

## Security Best Practices

### ✅ Implemented
- Stripe keys stored in environment variables (never committed)
- Clerk authentication required for all endpoints
- Webhook signature verification (when configured)
- Connect account ownership verified via Clerk metadata
- Input validation with Zod schemas

### 🔒 Additional Recommendations
- Enable Stripe Radar for fraud detection
- Set up rate limiting on API routes
- Monitor for suspicious Connect account activity
- Implement 2FA for high-value transactions
- Log all payment events for audit trail

## Common Issues & Solutions

### "No Stripe account found"
**Cause**: User hasn't started onboarding
**Solution**: Click "Complete Stripe Onboarding" button

### "Onboarding not complete"
**Cause**: User started but didn't finish onboarding
**Solution**: Click onboarding button again to continue

### "Account not charges_enabled"
**Cause**: Stripe needs more info (identity verification, bank account)
**Solution**: Check Stripe Dashboard → Connect → Accounts → Requirements

### Fee not collected
**Cause**: Missing `application_fee_amount` in Payment Intent
**Solution**: Ensure using `createPaymentIntentWithFee()` or `createCheckoutSession()` from lib/stripe.ts

### Webhook failures
**Cause**: Invalid signature or missing `STRIPE_WEBHOOK_SECRET`
**Solution**: Verify webhook secret in .env matches Stripe Dashboard

## Testing Scenarios

### Test Cards
```
Success:          4242 4242 4242 4242
Decline:          4000 0000 0000 0002
Requires Auth:    4000 0025 0000 3155
Insufficient:     4000 0000 0000 9995
```

### Test Bank Account
```
Account Number:   000123456789
Routing Number:   110000000
```

### Test Flow Checklist
- [ ] Seller onboarding completes successfully
- [ ] Clerk metadata updated correctly
- [ ] Seller dashboard shows after onboarding
- [ ] Express Dashboard link works
- [ ] Checkout session creates correctly
- [ ] 33bps fee calculated accurately
- [ ] Payment succeeds and transfers to seller
- [ ] Wells AI receives application fee
- [ ] Seller can view earnings in dashboard
- [ ] Refund processes correctly

## Support & Resources

### Documentation
- **Stripe Connect**: https://stripe.com/docs/connect
- **Express Accounts**: https://stripe.com/docs/connect/express-accounts
- **Application Fees**: https://stripe.com/docs/connect/direct-charges
- **Clerk + Stripe**: https://clerk.com/docs/integrations/stripe

### Code Files
- Implementation Guide: `STRIPE_CONNECT_GUIDE.md`
- Code Examples: `STRIPE_INTEGRATION_EXAMPLES.md`
- Core Library: `lib/stripe.ts`

### Help
- Stripe Support: https://support.stripe.com
- Clerk Support: https://clerk.com/support
- Wells AI Docs: See project README.md

## Summary

✅ **Complete Stripe Connect Implementation**
- Seller onboarding with Express accounts
- Automatic 33 basis point fee collection
- Daily payouts to sellers
- Full seller dashboard
- Production-ready code
- Comprehensive documentation

**Ready to process payments and collect Wells AI's 33bps fee on every transaction.**
