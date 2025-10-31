# Wells AI - Buyer Checkout Guide

Quick reference for implementing buyer checkout flow with the Wells AI Stripe payment system.

---

## Quick Start (3 Steps)

### 1. Use the CheckoutButton Component

```tsx
import CheckoutButton from '@/app/components/CheckoutButton'

<CheckoutButton
  amount={10000}                    // $100.00 in cents
  description="Acme Widgets x100"
  metadata={{ quoteId: 'quote_456' }}
/>
```

### 2. Buyer Clicks, Pays on Stripe

- Redirects to Stripe Checkout
- Buyer enters card details securely
- Stripe processes payment

### 3. Automatic Post-Payment

- Payment verified
- Logged to audit ledger
- Deal saved to Notion
- Confirmation email sent
- Redirects to success page

**That's it!** Full payment flow in 3 lines of code.

---

## Direct API Usage

If you need more control, call the API directly:

```typescript
const response = await fetch('/api/stripe/create-checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 10000,
    description: 'Product Purchase',
    buyerEmail: 'buyer@company.com',
    metadata: {
      rfqId: 'rfq_123',
      quoteId: 'quote_456'
    }
  })
})

const { checkoutUrl } = await response.json()
window.location.href = checkoutUrl
```

---

## Wells AI Platform Fee (5.5% includes all processing costs)

The fee is automatically calculated and added to cover all payment processing:

```typescript
Buyer pays: $100.00
Wells AI fee: $5.50 (5.5% - includes Stripe processing fees)
Total: $105.50
```

Fee calculation:
```typescript
import { calculateTotalWithFee } from '@/lib/stripe'

const { subtotal, wellsAIFee, total } = calculateTotalWithFee(10000)
// subtotal: 10000
// wellsAIFee: 550
// total: 10550
```

---

## Payment Methods Management

Buyers can save payment methods for faster checkout:

### View Saved Cards

Visit: `/payment-methods`

Or fetch via API:
```typescript
const response = await fetch('/api/stripe/payment-methods')
const { paymentMethods } = await response.json()
```

### Add New Card

The UI at `/payment-methods` includes a form powered by Stripe Elements.

Or via API:
```typescript
// After creating payment method with Stripe.js:
await fetch('/api/stripe/payment-methods', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    paymentMethodId: 'pm_xxx'
  })
})
```

### Set Default Card

```typescript
await fetch('/api/stripe/payment-methods', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    paymentMethodId: 'pm_xxx',
    action: 'set_default'
  })
})
```

### Delete Card

```typescript
await fetch('/api/stripe/payment-methods', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    paymentMethodId: 'pm_xxx'
  })
})
```

---

## Example: Quote Acceptance

```tsx
'use client'

import CheckoutButton from '@/app/components/CheckoutButton'

interface Quote {
  id: string
  supplierName: string
  price: number  // in cents
}

export default function QuoteCard({ quote }: { quote: Quote }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-bold">{quote.supplierName}</h3>
      <p className="text-2xl font-bold mt-4">
        ${(quote.price / 100).toFixed(2)}
      </p>

      <div className="mt-6">
        <CheckoutButton
          amount={quote.price}
          description={`Purchase from ${quote.supplierName}`}
          metadata={{
            quoteId: quote.id,
            sellerCompany: quote.supplierName
          }}
          buttonText="Accept & Pay"
        />
      </div>
    </div>
  )
}
```

---

## Testing

### Test Cards

| Card | Result |
|------|--------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 0002 | Declined |

Use any future expiry and any 3-digit CVC.

### Test Flow

1. Click checkout button
2. Redirected to Stripe
3. Enter test card: `4242 4242 4242 4242`
4. Click Pay
5. Redirected to success page

---

## Environment Variables

Required in `.env.local`:

```bash
STRIPE_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Get keys at: https://dashboard.stripe.com/apikeys

---

## Files Reference

| File | Purpose |
|------|---------|
| `/lib/stripe.ts` | Stripe utility functions |
| `/app/api/stripe/create-checkout/route.ts` | Create checkout API |
| `/app/api/stripe/payment-success/route.ts` | Post-payment handler |
| `/app/api/stripe/payment-methods/route.ts` | Payment methods CRUD |
| `/app/payment-methods/page.tsx` | Payment methods UI |
| `/app/payment/success/page.tsx` | Success confirmation page |
| `/app/components/CheckoutButton.tsx` | Reusable checkout button |

---

## Support

- **Full Documentation**: [STRIPE_PAYMENT_SYSTEM.md](./STRIPE_PAYMENT_SYSTEM.md)
- **Stripe Docs**: https://stripe.com/docs
- **Test Cards**: https://stripe.com/docs/testing

---

**Built for Wells AI** ⚡
