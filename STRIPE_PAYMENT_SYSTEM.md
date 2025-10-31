# Wells AI - Stripe Payment System

Complete buyer payment system with Stripe Checkout, payment methods management, and Wells AI platform fee (5.5% includes all processing costs).

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Files Created](#files-created)
4. [Environment Variables](#environment-variables)
5. [Buyer Payment Flow](#buyer-payment-flow)
6. [API Routes](#api-routes)
7. [Key Functions](#key-functions)
8. [Testing](#testing)
9. [Production Deployment](#production-deployment)

---

## Overview

The Wells AI Stripe payment system enables:

- **Buyer Checkout**: Seamless payment flow using Stripe Checkout
- **Payment Methods**: Save and manage payment methods for future use
- **Wells AI Fee**: Automatic calculation of 5.5% platform fee (includes all Stripe processing costs)
- **Stripe Connect**: Optional seller payouts via Stripe Connect
- **Audit Trail**: Complete payment logging to audit ledger
- **Notion Integration**: Automatic deal creation in Notion CRM
- **Email Notifications**: Confirmation emails to buyers

---

## Architecture

```
┌─────────────┐
│   Buyer     │
└──────┬──────┘
       │
       │ 1. Create Checkout
       ▼
┌─────────────────────────────┐
│ POST /api/stripe/           │
│      create-checkout        │
│                             │
│ - Validates request         │
│ - Calculates fees (5.5%)    │
│ - Creates Stripe session    │
│ - Logs to audit ledger      │
└──────────┬──────────────────┘
           │
           │ 2. Redirect to Stripe
           ▼
┌─────────────────────────────┐
│   Stripe Checkout UI        │
│                             │
│ - Buyer enters card info    │
│ - Stripe processes payment  │
└──────────┬──────────────────┘
           │
           │ 3. Payment Success
           ▼
┌─────────────────────────────┐
│ GET /api/stripe/            │
│     payment-success         │
│                             │
│ - Verifies payment          │
│ - Logs to audit ledger      │
│ - Creates deal in Notion    │
│ - Sends confirmation email  │
│ - Redirects to success page │
└──────────┬──────────────────┘
           │
           │ 4. Display Success
           ▼
┌─────────────────────────────┐
│   /payment/success          │
│                             │
│ - Shows confirmation        │
│ - Displays amount & ID      │
└─────────────────────────────┘
```

---

## Files Created

### 1. **`lib/stripe.ts`** - Stripe Utility Library

Core Stripe integration with helper functions:

```typescript
// Customer management
getOrCreateCustomer(userId: string): Promise<Stripe.Customer>
getCustomer(customerId: string): Promise<Stripe.Customer | null>

// Payment methods
attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<Stripe.PaymentMethod>
detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod>
listPaymentMethods(customerId: string, type?: 'card'): Promise<Stripe.PaymentMethod[]>
setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<Stripe.Customer>

// Checkout sessions
createCheckoutSession(params: CreateCheckoutSessionParams): Promise<Stripe.Checkout.Session>
getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session>

// Fee calculation
calculateWellsAIFee(amount: number): number // 5.5% platform fee (includes processing)
calculateTotalWithFee(amountInCents: number): { subtotal, wellsAIFee, total }

// Stripe Connect (seller payouts)
createConnectAccount(params: CreateConnectAccountParams): Promise<Stripe.Account>
createPaymentIntentWithFee(params: CreatePaymentIntentParams): Promise<Stripe.PaymentIntent>
```

**Location**: `/Users/jonahmanning/Downloads/wells-ai-github-ready/lib/stripe.ts`

---

### 2. **`app/api/stripe/create-checkout/route.ts`** - Create Checkout API

**POST** `/api/stripe/create-checkout`

Creates a Stripe Checkout Session for buyer payments.

**Request Body**:
```json
{
  "amount": 10000,                          // Required: Amount in cents ($100.00)
  "description": "Product purchase",        // Required: What buyer is purchasing
  "buyerEmail": "buyer@example.com",        // Required: Buyer's email
  "sellerStripeAccountId": "acct_xxx",      // Optional: Seller's Stripe Connect ID
  "metadata": {                             // Optional: Custom metadata
    "rfqId": "rfq_123",
    "quoteId": "quote_456"
  },
  "successUrl": "/custom-success",          // Optional: Custom success URL
  "cancelUrl": "/custom-cancel"             // Optional: Custom cancel URL
}
```

**Response**:
```json
{
  "success": true,
  "checkoutUrl": "https://checkout.stripe.com/pay/cs_test_xxx",
  "sessionId": "cs_test_xxx",
  "pricing": {
    "subtotal": 10000,
    "wellsAIFee": 550,
    "total": 10550,
    "subtotalFormatted": "$100.00",
    "wellsAIFeeFormatted": "$5.50",
    "totalFormatted": "$105.50"
  }
}
```

**Location**: `/Users/jonahmanning/Downloads/wells-ai-github-ready/app/api/stripe/create-checkout/route.ts`

---

### 3. **`app/api/stripe/payment-success/route.ts`** - Payment Success Handler

**GET** `/api/stripe/payment-success?session_id={CHECKOUT_SESSION_ID}`

Handles post-payment redirect from Stripe.

**Process**:
1. Retrieves checkout session from Stripe
2. Verifies payment status is "paid"
3. Logs payment to audit ledger
4. Creates deal in Notion deals database
5. Queues confirmation email to buyer
6. Redirects to `/payment/success` with details

**Location**: `/Users/jonahmanning/Downloads/wells-ai-github-ready/app/api/stripe/payment-success/route.ts`

---

### 4. **`app/api/stripe/payment-methods/route.ts`** - Payment Methods API

Manage customer payment methods.

#### **GET** - List Payment Methods

Returns all saved payment methods for the authenticated user.

**Response**:
```json
{
  "success": true,
  "paymentMethods": [
    {
      "id": "pm_xxx",
      "type": "card",
      "card": {
        "brand": "visa",
        "last4": "4242",
        "exp_month": 12,
        "exp_year": 2025
      },
      "isDefault": true
    }
  ]
}
```

#### **POST** - Add Payment Method

Attaches a payment method to the customer.

**Request**:
```json
{
  "paymentMethodId": "pm_xxx"
}
```

#### **PATCH** - Update Payment Method

Set default payment method.

**Request**:
```json
{
  "paymentMethodId": "pm_xxx",
  "action": "set_default"
}
```

#### **DELETE** - Remove Payment Method

Detaches a payment method from the customer.

**Request**:
```json
{
  "paymentMethodId": "pm_xxx"
}
```

**Location**: `/Users/jonahmanning/Downloads/wells-ai-github-ready/app/api/stripe/payment-methods/route.ts`

---

### 5. **`app/payment-methods/page.tsx`** - Payment Methods Page

User interface for managing saved payment methods.

**Features**:
- View all saved cards
- Add new card using Stripe Elements
- Set default payment method
- Delete payment methods
- Secure card input (PCI compliant)

**URL**: `/payment-methods`

**Location**: `/Users/jonahmanning/Downloads/wells-ai-github-ready/app/payment-methods/page.tsx`

---

### 6. **`app/payment/success/page.tsx`** - Payment Success Page

Confirmation page shown after successful payment.

**Features**:
- Success message with checkmark
- Amount paid and payment ID
- Next steps for the buyer
- Links to view quotes or return home

**URL**: `/payment/success?amount=100.33&payment_id=pi_xxx`

**Location**: `/Users/jonahmanning/Downloads/wells-ai-github-ready/app/payment/success/page.tsx`

---

## Environment Variables

Add these to your `.env.local` file:

```bash
# Stripe Payments & Connect (Required for payments)
# Get your keys at https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx

# Stripe Webhooks (Optional - for real-time payment events)
# Get from https://dashboard.stripe.com/webhooks
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx

# Application URLs (Required)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Other required variables (if not already set)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
```

**Get Stripe Keys**:
1. Go to https://dashboard.stripe.com/apikeys
2. Copy your **Secret key** → `STRIPE_SECRET_KEY`
3. Copy your **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

---

## Buyer Payment Flow

### Step-by-Step Process

#### **Step 1: Buyer Initiates Checkout**

From your app (e.g., when accepting a quote):

```typescript
const response = await fetch('/api/stripe/create-checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 10000,              // $100.00 in cents
    description: 'Acme Widgets x100',
    buyerEmail: 'buyer@company.com',
    metadata: {
      rfqId: 'rfq_123',
      quoteId: 'quote_456',
      sellerCompany: 'Acme Corp'
    }
  })
})

const { checkoutUrl } = await response.json()

// Redirect buyer to Stripe Checkout
window.location.href = checkoutUrl
```

#### **Step 2: Buyer Completes Payment on Stripe**

- Buyer enters card information on Stripe's hosted checkout page
- Stripe processes the payment securely
- No PCI compliance burden on your app

#### **Step 3: Stripe Redirects to Success Handler**

After payment, Stripe redirects to:
```
/api/stripe/payment-success?session_id=cs_test_xxx
```

Your API:
1. Verifies payment with Stripe
2. Logs to audit ledger
3. Creates deal in Notion
4. Sends confirmation email
5. Redirects to `/payment/success`

#### **Step 4: Buyer Sees Confirmation**

Success page shows:
- Payment confirmed message
- Amount paid
- Payment ID
- Next steps

---

## API Routes

### Create Checkout

```bash
POST /api/stripe/create-checkout
```

**cURL Example**:
```bash
curl -X POST http://localhost:3000/api/stripe/create-checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{
    "amount": 10000,
    "description": "Test Purchase",
    "buyerEmail": "test@example.com"
  }'
```

### Payment Success

```bash
GET /api/stripe/payment-success?session_id=cs_test_xxx
```

This is automatically called by Stripe after payment.

### Payment Methods

```bash
# List
GET /api/stripe/payment-methods

# Add
POST /api/stripe/payment-methods
Body: { "paymentMethodId": "pm_xxx" }

# Set Default
PATCH /api/stripe/payment-methods
Body: { "paymentMethodId": "pm_xxx", "action": "set_default" }

# Delete
DELETE /api/stripe/payment-methods
Body: { "paymentMethodId": "pm_xxx" }
```

---

## Key Functions

### Wells AI Fee Calculation

**5.5% platform fee (includes all payment processing costs)**

```typescript
import { calculateWellsAIFee, calculateTotalWithFee } from '@/lib/stripe'

// Calculate fee only
const fee = calculateWellsAIFee(10000) // Returns 550 (cents = $5.50)

// Calculate full breakdown
const { subtotal, wellsAIFee, total } = calculateTotalWithFee(10000)
// subtotal: 10000
// wellsAIFee: 550
// total: 10550
```

### Create Checkout Session

```typescript
import { createCheckoutSession } from '@/lib/stripe'

const session = await createCheckoutSession({
  amountInCents: 10000,
  description: 'Product Purchase',
  buyerEmail: 'buyer@example.com',
  buyerUserId: 'user_123',
  sellerStripeAccountId: 'acct_xxx',  // Optional for Stripe Connect
  metadata: {
    rfqId: 'rfq_123',
    quoteId: 'quote_456'
  }
})

console.log(session.url) // Redirect buyer here
```

### Get/Create Customer

```typescript
import { getOrCreateCustomer } from '@/lib/stripe'

// Automatically creates Stripe customer if doesn't exist
// Saves customer ID to Clerk user metadata
const customer = await getOrCreateCustomer(userId)
```

---

## Testing

### Test in Development

1. **Start the dev server**:
   ```bash
   npm run dev
   ```

2. **Use Stripe test cards**:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - Any future expiry date
   - Any 3-digit CVC

3. **Test the flow**:
   ```bash
   # Create checkout
   curl -X POST http://localhost:3000/api/stripe/create-checkout \
     -H "Content-Type: application/json" \
     -d '{
       "amount": 10000,
       "description": "Test Purchase",
       "buyerEmail": "test@example.com"
     }'

   # Copy the checkoutUrl from response
   # Visit URL in browser and complete payment with test card
   ```

### Test Payment Methods Page

1. Visit `http://localhost:3000/payment-methods`
2. Click "Add Payment Method"
3. Enter test card: `4242 4242 4242 4242`
4. Save and verify it appears in the list

---

## Production Deployment

### 1. Switch to Live Mode

In Stripe Dashboard:
1. Toggle from "Test mode" to "Live mode"
2. Get your **live** API keys
3. Update environment variables:
   ```bash
   STRIPE_SECRET_KEY=sk_live_xxxxx
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
   ```

### 2. Enable Webhooks (Optional)

For real-time payment events:

1. Go to https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Select events: `checkout.session.completed`, `payment_intent.succeeded`
4. Copy webhook secret → `STRIPE_WEBHOOK_SECRET`

### 3. Configure Stripe Connect (Optional)

For seller payouts:

1. Enable Stripe Connect in dashboard
2. Complete platform profile
3. Use `createConnectAccount()` to onboard sellers
4. Pass `sellerStripeAccountId` in checkout requests

### 4. Set Production URLs

```bash
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### 5. Test Live Payments

Use real credit cards in small amounts ($0.50) to verify:
- Checkout flow works
- Payment success handler executes
- Notion deals are created
- Emails are sent
- Success page displays correctly

---

## Dependencies

Already installed in `package.json`:

```json
{
  "dependencies": {
    "stripe": "^19.2.0",              // Server-side Stripe SDK
    "@stripe/stripe-js": "^8.2.0",    // Client-side Stripe.js
    "@clerk/nextjs": "^6.34.1",       // User authentication
    "@notionhq/client": "^5.3.0",     // Notion integration
    "zod": "^3.25.76"                 // Validation
  }
}
```

---

## Security Notes

1. **PCI Compliance**: Stripe Elements handles card data, keeping you PCI compliant
2. **API Keys**: Never expose `STRIPE_SECRET_KEY` in client-side code
3. **Authentication**: All payment APIs require Clerk authentication
4. **Validation**: Zod schemas validate all API inputs
5. **Audit Trail**: Every payment is logged to audit ledger
6. **HTTPS**: Always use HTTPS in production

---

## Support

- **Stripe Docs**: https://stripe.com/docs
- **Stripe Dashboard**: https://dashboard.stripe.com
- **Test Cards**: https://stripe.com/docs/testing

For Wells AI specific questions, contact the development team.

---

**Built with Stripe Checkout** ⚡
