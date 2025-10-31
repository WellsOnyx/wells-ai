# Stripe Connect Seller Onboarding Guide

## Overview

Wells AI uses **Stripe Connect** to enable sellers to receive payments from buyers, with Wells AI automatically collecting a **33 basis point (0.33%)** fee on each transaction.

## Architecture

### Fee Structure
- **Buyer pays**: Full amount (e.g., $100.00)
- **Wells AI fee**: 33 basis points (e.g., $0.33 on $100)
- **Seller receives**: Amount minus Wells AI fee (e.g., $99.67 minus Stripe processing fees)

### Connect Account Type
- **Type**: Express (easiest for sellers)
- **Capabilities**: `card_payments`, `transfers`
- **Payout Schedule**: Daily (automatic)

## Files Created

### 1. Core Library (`lib/stripe.ts`)
Complete Stripe integration with helper functions:

**Connect Account Management:**
- `createConnectAccount()` - Create Express account for sellers
- `createAccountLink()` - Generate onboarding links
- `getAccountStatus()` - Check onboarding completion
- `createLoginLink()` - Generate Express Dashboard access

**Payment Processing:**
- `createPaymentIntentWithFee()` - Create payment with Wells AI fee
- `calculateWellsAIFee()` - Calculate 33 basis point fee
- `getSellerBalance()` - Retrieve seller earnings
- `getSellerTransfers()` - List recent transfers
- `getUpcomingPayout()` - Check next payout

**Buyer/Customer Management:**
- `getOrCreateCustomer()` - Manage Stripe customers
- `createCheckoutSession()` - Create checkout with fees
- `attachPaymentMethod()` - Save payment methods
- `listPaymentMethods()` - List saved cards/ACH

### 2. API Routes

#### `/api/stripe/connect/onboard/route.ts`
**POST** - Create Connect account and generate onboarding link

**Request:**
```json
{
  "country": "US" // optional, defaults to US
}
```

**Response:**
```json
{
  "success": true,
  "onboardingUrl": "https://connect.stripe.com/...",
  "accountId": "acct_..."
}
```

**What it does:**
1. Gets authenticated user from Clerk
2. Creates Stripe Connect account (or uses existing)
3. Saves `stripeConnectAccountId` to Clerk metadata
4. Generates onboarding link
5. Returns URL to redirect user

#### `/api/stripe/connect/return/route.ts`
**GET** - Handle return from Stripe onboarding

**Query Params:** None (handled by Stripe)

**Redirects to:**
- Success: `/seller/dashboard?success=onboarding_complete`
- Incomplete: `/seller/dashboard?error=onboarding_incomplete`

**What it does:**
1. Retrieves user's Connect account ID from Clerk
2. Checks if account is fully onboarded
3. Updates Clerk metadata: `stripeConnectComplete: true`
4. Redirects with success/error message

#### `/api/stripe/connect/refresh/route.ts`
**GET** - Generate new onboarding link if expired

**What it does:**
1. Gets user's Connect account ID
2. Generates fresh onboarding link
3. Redirects to new Stripe onboarding URL

**Use case:** User's link expired (Stripe links expire after 5 minutes)

#### `/api/stripe/connect/dashboard/route.ts`
**POST** - Generate Stripe Express Dashboard login link

**Response:**
```json
{
  "success": true,
  "dashboardUrl": "https://connect.stripe.com/express/..."
}
```

**What it does:**
1. Verifies user has completed onboarding
2. Generates login link to Express Dashboard
3. Seller can manage payouts, view transactions, update banking info

### 3. Seller Dashboard Page (`/app/seller/dashboard/page.tsx`)

Full-featured React dashboard with:

**Not Onboarded State:**
- Clear call-to-action to complete onboarding
- "Complete Stripe Onboarding" button
- Error handling for failed onboarding

**Onboarded State:**
- **Available Balance** - Ready for payout
- **Pending Balance** - Processing
- **Payout Schedule** - Daily automatic payouts
- **Recent Transactions** - Transaction history
- **Stripe Dashboard Link** - Access full Express Dashboard

## User Flow

### Seller Onboarding Flow

```
1. Seller visits /seller/dashboard
   ↓
2. Clicks "Complete Stripe Onboarding"
   ↓
3. POST /api/stripe/connect/onboard
   → Creates Connect account
   → Saves accountId to Clerk metadata
   → Returns onboarding URL
   ↓
4. Redirects to Stripe onboarding
   → Seller fills out personal/business info
   → Adds bank account for payouts
   → Verifies identity
   ↓
5. Stripe redirects to /api/stripe/connect/return
   → Verifies onboarding is complete
   → Updates Clerk: stripeConnectComplete = true
   ↓
6. Redirects to /seller/dashboard
   → Shows earnings, payouts, transactions
```

### Payment Flow with 33bps Fee

```typescript
// Example: Buyer purchases $100 item from seller

import { createCheckoutSession, calculateWellsAIFee } from '@/lib/stripe'

// 1. Calculate fees
const itemPrice = 10000 // $100.00 in cents
const wellsAIFee = calculateWellsAIFee(itemPrice) // 33 cents
const total = itemPrice + wellsAIFee // $100.33

// 2. Create checkout session
const session = await createCheckoutSession({
  amountInCents: itemPrice,
  description: 'Premium Widget',
  buyerEmail: 'buyer@example.com',
  buyerUserId: 'user_xxx',
  sellerStripeAccountId: 'acct_seller', // If seller has Connect account
  metadata: {
    productId: 'prod_123',
    sellerId: 'seller_456',
  }
})

// 3. Redirect buyer to checkout
window.location.href = session.url

// 4. After successful payment:
//    - Wells AI receives: $0.33 (application fee)
//    - Seller receives: $99.67 (minus Stripe processing ~2.9% + $0.30)
//    - Payout to seller: Automatic daily payout to bank account
```

### Alternative: Direct Payment Intent

```typescript
import { createPaymentIntentWithFee, calculateWellsAIFee } from '@/lib/stripe'

const amount = 10000 // $100.00
const fee = calculateWellsAIFee(amount) // $0.33

const paymentIntent = await createPaymentIntentWithFee({
  amount,
  currency: 'usd',
  sellerConnectAccountId: 'acct_seller',
  applicationFeeAmount: fee,
  description: 'Wells AI Transaction',
  metadata: {
    buyerId: 'buyer_123',
    sellerId: 'seller_456',
  }
})

// Use paymentIntent.client_secret with Stripe.js on frontend
```

## Clerk Metadata Schema

Wells AI saves the following to Clerk user metadata:

```typescript
{
  publicMetadata: {
    // Stripe Connect (Seller)
    stripeConnectAccountId: 'acct_...', // Created during onboarding
    stripeConnectComplete: true, // true when onboarding complete
    stripeConnectCompletedAt: '2025-01-15T10:30:00Z', // Timestamp

    // Stripe Customer (Buyer)
    stripeCustomerId: 'cus_...', // Created on first purchase
  }
}
```

## Environment Variables

Add to `.env.local`:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_51...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51...

# Stripe Webhooks (for production)
STRIPE_WEBHOOK_SECRET=whsec_...

# Application URL (for redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Get your keys from: https://dashboard.stripe.com/apikeys

## Testing

### Test Mode
1. Use Stripe test keys (start with `sk_test_` and `pk_test_`)
2. Test onboarding at: https://dashboard.stripe.com/test/connect/accounts/overview
3. Use test bank account: `000123456789` (routing: `110000000`)

### Test Cards
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Auth required: `4000 0025 0000 3155`

### Test Flow
```bash
# 1. Start dev server
npm run dev

# 2. Sign in to Wells AI
# Navigate to: http://localhost:3000/sign-in

# 3. Go to seller dashboard
# Navigate to: http://localhost:3000/seller/dashboard

# 4. Complete onboarding
# Click "Complete Stripe Onboarding"
# Fill out test information
# Use test bank account: 000123456789

# 5. Verify success
# Should redirect back to dashboard
# Clerk metadata should have stripeConnectComplete = true
```

## Production Checklist

- [ ] Switch to live Stripe keys (`sk_live_...` and `pk_live_...`)
- [ ] Set up webhook endpoint at `/api/stripe/webhooks`
- [ ] Configure webhook in Stripe Dashboard
- [ ] Enable production Connect account
- [ ] Set proper `NEXT_PUBLIC_APP_URL` for redirects
- [ ] Test end-to-end payment flow
- [ ] Verify Wells AI fee is collected (33 basis points)
- [ ] Confirm seller payouts work correctly

## Troubleshooting

### "No Stripe account found"
- User hasn't completed onboarding
- Check Clerk metadata for `stripeConnectAccountId`
- Restart onboarding flow

### "Onboarding not complete"
- User started but didn't finish onboarding
- Stripe account exists but not fully verified
- Click onboarding button again to continue

### "Account not charges_enabled"
- Identity verification pending
- Bank account not added
- Check Stripe Dashboard for requirements

### Fee not collected
- Verify `application_fee_amount` is set on Payment Intent
- Check `transfer_data.destination` points to seller's Connect account
- Confirm account has `transfers` capability

## Additional Resources

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Express Dashboard Guide](https://stripe.com/docs/connect/express-dashboard)
- [Testing Connect](https://stripe.com/docs/connect/testing)
- [Application Fees](https://stripe.com/docs/connect/direct-charges#collecting-fees)

## Support

For issues:
1. Check Stripe Dashboard logs
2. Review Vercel function logs
3. Inspect Clerk user metadata
4. Contact Stripe support for account issues
