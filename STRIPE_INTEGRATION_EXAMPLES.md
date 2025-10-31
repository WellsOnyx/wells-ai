# Stripe Connect Integration Examples

## Example 1: Quote Acceptance Flow with 33bps Fee

### Scenario
A buyer receives a quote for $10,000 from a seller and wants to pay via Stripe.

### Frontend Implementation

```typescript
// app/quotes/[id]/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function QuoteDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [accepting, setAccepting] = useState(false)

  const quote = {
    id: params.id,
    amount: 1000000, // $10,000.00 in cents
    description: 'Custom Manufacturing Services',
    sellerId: 'user_seller_123',
    sellerName: 'Acme Manufacturing',
  }

  const handleAcceptQuote = async () => {
    try {
      setAccepting(true)

      // Create Stripe Checkout Session
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amountInCents: quote.amount,
          description: quote.description,
          sellerId: quote.sellerId,
          metadata: {
            quoteId: quote.id,
            sellerName: quote.sellerName,
          },
          successUrl: `/quotes/${quote.id}/success`,
          cancelUrl: `/quotes/${quote.id}`,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      // Show fee breakdown to buyer
      console.log('Payment Breakdown:')
      console.log('  Item Price:', data.breakdown.itemPrice)
      console.log('  Wells AI Fee:', data.breakdown.wellsAIFee)
      console.log('  Total:', data.breakdown.total)

      // Redirect to Stripe Checkout
      window.location.href = data.sessionUrl

    } catch (error: any) {
      alert(`Error: ${error.message}`)
      setAccepting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Quote Details</h1>

      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">{quote.description}</h2>
        <p className="text-gray-600 mb-4">From: {quote.sellerName}</p>

        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between">
            <span>Quote Amount:</span>
            <span className="font-medium">${(quote.amount / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Wells AI Fee (0.33%):</span>
            <span>${((quote.amount * 0.0033) / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-2">
            <span>Total:</span>
            <span>${((quote.amount + quote.amount * 0.0033) / 100).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleAcceptQuote}
        disabled={accepting}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {accepting ? 'Processing...' : 'Accept Quote & Pay'}
      </button>
    </div>
  )
}
```

### Money Flow
```
Buyer pays: $10,033.00
  ↓
Stripe processes payment
  ↓
Wells AI receives: $33.00 (application fee - 33 basis points)
  ↓
Seller receives: $10,000.00 (minus Stripe processing fee ~2.9% + $0.30)
  ↓
Automatic payout to seller's bank account (daily)
```

## Example 2: Direct Payment Intent (Custom Checkout)

### Use Case
Building a custom checkout experience instead of using Stripe Checkout.

```typescript
// app/api/custom-payment/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createPaymentIntentWithFee, calculateWellsAIFee } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { amountInCents, sellerId } = await request.json()

  // Get seller's Connect account
  const client = await clerkClient()
  const seller = await client.users.getUser(sellerId)
  const sellerAccountId = seller.publicMetadata?.stripeConnectAccountId as string

  // Calculate Wells AI fee (33 basis points)
  const wellsAIFee = calculateWellsAIFee(amountInCents)

  // Create Payment Intent with application fee
  const paymentIntent = await createPaymentIntentWithFee({
    amount: amountInCents,
    currency: 'usd',
    sellerConnectAccountId: sellerAccountId,
    applicationFeeAmount: wellsAIFee,
    description: 'Wells AI Transaction',
    metadata: {
      buyerId: userId,
      sellerId,
    },
  })

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    wellsAIFee,
  })
}
```

### Frontend (React + Stripe Elements)

```typescript
'use client'

import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function CheckoutForm({ clientSecret }: { clientSecret: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment-success`,
      },
    })

    if (error) {
      alert(error.message)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-blue-600 text-white py-3 rounded-lg"
      >
        {loading ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  )
}

export default function CustomCheckoutPage() {
  const [clientSecret, setClientSecret] = useState('')

  useEffect(() => {
    // Create payment intent
    fetch('/api/custom-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountInCents: 10000, // $100.00
        sellerId: 'user_seller_123',
      }),
    })
      .then(res => res.json())
      .then(data => setClientSecret(data.clientSecret))
  }, [])

  if (!clientSecret) {
    return <div>Loading...</div>
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm clientSecret={clientSecret} />
    </Elements>
  )
}
```

## Example 3: Subscription with 33bps Fee

### Use Case
Monthly recurring payments with Wells AI fee on each charge.

```typescript
import { stripe, calculateWellsAIFee } from '@/lib/stripe'

// Create subscription with application fee
async function createSubscription(customerId: string, sellerAccountId: string) {
  const monthlyPrice = 10000 // $100/month
  const wellsAIFee = calculateWellsAIFee(monthlyPrice) // $0.33

  // Create subscription
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Monthly Service',
          },
          recurring: {
            interval: 'month',
          },
          unit_amount: monthlyPrice,
        },
      },
    ],
    application_fee_percent: 0.33, // 33 basis points
    transfer_data: {
      destination: sellerAccountId,
    },
  })

  return subscription
}
```

## Example 4: Refund with Fee Reversal

### Use Case
Buyer requests refund - Wells AI fee is also refunded.

```typescript
import { stripe, createRefund } from '@/lib/stripe'

async function processRefund(paymentIntentId: string, refundReason: string) {
  // Full refund (includes reversing Wells AI fee)
  const refund = await createRefund({
    paymentIntentId,
    reason: 'requested_by_customer',
    metadata: {
      refundReason,
    },
  })

  // The application fee is automatically refunded
  // Seller's balance is debited
  // Buyer gets full amount back

  return refund
}
```

## Example 5: Checking Seller Onboarding Status

### Use Case
Before showing "Buy Now" button, verify seller can receive payments.

```typescript
// app/api/seller/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { getAccountStatus } from '@/lib/stripe'

export async function GET(request: NextRequest) {
  const sellerId = request.nextUrl.searchParams.get('sellerId')
  if (!sellerId) {
    return NextResponse.json({ error: 'sellerId required' }, { status: 400 })
  }

  const client = await clerkClient()
  const seller = await client.users.getUser(sellerId)

  const accountId = seller.publicMetadata?.stripeConnectAccountId as string | undefined
  const isComplete = seller.publicMetadata?.stripeConnectComplete as boolean

  if (!accountId || !isComplete) {
    return NextResponse.json({
      canReceivePayments: false,
      reason: 'Seller has not completed Stripe onboarding',
    })
  }

  // Verify with Stripe
  const { isComplete: stripeComplete } = await getAccountStatus(accountId)

  return NextResponse.json({
    canReceivePayments: stripeComplete,
    accountId,
  })
}
```

### Frontend Usage

```typescript
'use client'

import { useEffect, useState } from 'react'

export default function ProductPage({ sellerId }: { sellerId: string }) {
  const [canBuy, setCanBuy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/seller/status?sellerId=${sellerId}`)
      .then(res => res.json())
      .then(data => {
        setCanBuy(data.canReceivePayments)
        setLoading(false)
      })
  }, [sellerId])

  if (loading) return <div>Checking seller status...</div>

  if (!canBuy) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
        <p className="text-yellow-800">
          This seller is not yet set up to receive payments.
        </p>
      </div>
    )
  }

  return (
    <button className="bg-blue-600 text-white px-6 py-3 rounded">
      Buy Now
    </button>
  )
}
```

## Example 6: Webhook Handler for Payment Success

### Use Case
Record transaction in database when payment succeeds.

```typescript
// app/api/stripe/webhooks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createDeal } from '@/lib/notion'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  // Handle payment success
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object

    // Extract metadata
    const { buyerId, sellerId, quoteId } = paymentIntent.metadata

    // Record deal in Notion
    await createDeal({
      rfqId: quoteId,
      quoteId,
      buyerCompany: buyerId,
      sellerCompany: sellerId,
      productName: paymentIntent.description || 'Unknown',
      category: 'General',
      dealValue: paymentIntent.amount / 100,
      status: 'Completed',
      closeDate: new Date().toISOString(),
      paymentIntentId: paymentIntent.id,
    })

    console.log(`✅ Payment succeeded: ${paymentIntent.id}`)
    console.log(`   Amount: $${(paymentIntent.amount / 100).toFixed(2)}`)
    console.log(`   Wells AI Fee: $${((paymentIntent.application_fee_amount || 0) / 100).toFixed(2)}`)
  }

  return NextResponse.json({ received: true })
}
```

## Testing Checklist

- [ ] Seller completes onboarding successfully
- [ ] Buyer can create checkout session
- [ ] 33 basis point fee is calculated correctly
- [ ] Payment succeeds and seller receives transfer
- [ ] Wells AI receives application fee
- [ ] Seller can access Express Dashboard
- [ ] Refunds work correctly (fee is reversed)
- [ ] Webhooks fire and record transactions

## Production Considerations

### 1. Error Handling
Always handle cases where:
- Seller hasn't completed onboarding
- Payment fails
- Stripe API is down
- Webhook signature is invalid

### 2. Security
- Never expose Stripe secret key to frontend
- Validate webhook signatures
- Verify seller onboarding status before accepting payments
- Store customer IDs securely in Clerk metadata

### 3. User Experience
- Show fee breakdown to buyers before checkout
- Provide clear onboarding instructions for sellers
- Send email notifications for successful payments
- Display pending payouts in seller dashboard

### 4. Monitoring
- Log all payment intents
- Track application fees collected
- Monitor failed payments
- Alert on webhook failures

## Support Resources

- **Stripe Dashboard**: https://dashboard.stripe.com
- **Connect Documentation**: https://stripe.com/docs/connect
- **Clerk Documentation**: https://clerk.com/docs
- **Wells AI Guide**: See STRIPE_CONNECT_GUIDE.md
