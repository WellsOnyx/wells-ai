# GRAIN Checkout - Quick Start Guide

## 5-Minute Integration

### Option 1: Embedded Checkout Component

Add GRAIN checkout to any page:

```tsx
import GrainCheckout from '@/app/components/GrainCheckout'

export default function MyPage() {
  return (
    <GrainCheckout
      amount={1000}
      description="Payment for consulting services"
      onSuccess={(paymentId) => {
        console.log('Payment successful!', paymentId)
        // Redirect or update UI
      }}
      onError={(error) => {
        console.error('Payment failed:', error)
      }}
    />
  )
}
```

### Option 2: Payment Link

Generate a payment link:

```typescript
const amount = 5000
const description = "CTO hiring services"
const dealId = "deal_123"

const checkoutUrl = `/checkout?amount=${amount}&description=${encodeURIComponent(description)}&dealId=${dealId}`

// Send this URL to the buyer
// They'll see a full-page checkout experience
```

### Option 3: API-Driven Checkout

Create payment intent programmatically:

```typescript
// 1. Create payment intent
const res = await fetch('/api/payments/create-intent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 5000,
    currency: 'GRAIN',
    description: 'Payment for deal',
    metadata: { dealId: 'deal_123' }
  })
})

const payment = await res.json()

// 2. Redirect to checkout
window.location.href = `/checkout?paymentId=${payment.id}`

// 3. Poll for status (or use webhook)
const statusRes = await fetch(`/api/payments/${payment.id}`)
const status = await statusRes.json()

if (status.status === 'succeeded') {
  console.log('Payment confirmed!')
}
```

---

## Deal Integration Example

```typescript
// 1. Create a deal
const dealRes = await fetch('/api/deals', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    seller: {
      id: 'user_seller_123',
      name: 'Sarah Chen',
      email: 'sarah@example.com'
    },
    terms: {
      amount: 5000,
      description: 'CTO search and placement',
      deliverables: [
        'Source 10+ qualified candidates',
        'Conduct initial screenings',
        'Present top 3 candidates with recommendations'
      ]
    }
  })
})

const deal = await dealRes.json()

// 2. Accept the deal (creates payment intent)
const acceptRes = await fetch('/api/deals/accept', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dealId: deal.deal.id })
})

const acceptance = await acceptRes.json()

// 3. Redirect buyer to checkout
window.location.href = acceptance.checkoutUrl

// 4. After work is delivered, release payment
const releaseRes = await fetch('/api/deals/release', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dealId: deal.deal.id })
})

console.log('Payment released to seller!')
```

---

## Using DealPayment Component

Add to a deal details page:

```tsx
import DealPayment from '@/app/components/DealPayment'
import { useUser } from '@clerk/nextjs'

export default function DealPage({ deal }) {
  const { user } = useUser()

  return (
    <div>
      <h1>Deal: {deal.description}</h1>

      <DealPayment
        dealId={deal.id}
        amount={deal.amount}
        platformFee={deal.platformFee}
        status={deal.status}
        buyerId={deal.buyerId}
        sellerId={deal.sellerId}
        currentUserId={user.id}
        escrowWalletAddress={deal.escrowWalletAddress}
        paymentIntentId={deal.paymentIntentId}
      />
    </div>
  )
}
```

---

## Check User Balance

```typescript
const balanceRes = await fetch('/api/treasury/balance')
const balance = await balanceRes.json()

console.log(`Balance: ${balance.balance} GRAIN`)
console.log(`Credit Line: ${balance.creditLine} GRAIN`)
console.log(`Available: ${balance.available} GRAIN`)

if (balance.available >= paymentAmount) {
  console.log('User has sufficient funds')
} else {
  console.log('User needs to deposit more GRAIN')
}
```

---

## Environment Setup

```bash
# 1. Get Circle API key from https://console.circle.com
CIRCLE_API_KEY=your_api_key_here
CIRCLE_ENVIRONMENT=sandbox  # Use 'production' for live

# 2. Configure database
POSTGRES_URL=postgresql://...

# 3. Set base URL
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

---

## Styling Customization

The components use Tailwind CSS classes from `globals.css`. To customize:

```tsx
// Override default styles
<GrainCheckout
  amount={1000}
  description="Payment"
  onSuccess={...}
  onError={...}
  className="my-custom-class"  // Add custom wrapper class
/>
```

Or modify `globals.css`:

```css
/* Change primary accent color from amber to blue */
.btn-premium-primary {
  @apply bg-gradient-to-r from-blue-500 to-blue-600;
  @apply text-white hover:from-blue-400 hover:to-blue-500;
}
```

---

## Testing in Development

### Mock Payment Success

```typescript
// After creating payment intent, manually update status
const paymentId = 'payment_123'

await fetch(`/api/payments/${paymentId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'succeeded' })
})

// Checkout will detect and show success
```

### Test Balance

Balance API returns mock data if Circle SDK fails, so you can test without a real Circle account.

---

## Production Deployment

1. **Switch to production Circle environment:**
   ```bash
   CIRCLE_ENVIRONMENT=production
   CIRCLE_API_KEY=prod_key_here
   ```

2. **Run database migrations:**
   ```sql
   -- Create tables (see GRAIN_CHECKOUT_COMPLETE.md for full schema)
   CREATE TABLE payment_intents (...);
   CREATE TABLE user_wallets (...);
   CREATE TABLE treasury_transactions (...);
   ALTER TABLE deals ADD COLUMN payment_method TEXT DEFAULT 'grain';
   ```

3. **Set up webhooks (optional but recommended):**
   - Create `/api/payments/webhook` endpoint
   - Register webhook URL in Circle dashboard
   - Handle `payment.succeeded` events

4. **Deploy and test:**
   - Create a test payment
   - Verify escrow wallet creation
   - Test payment release
   - Monitor Circle dashboard

---

## Common Patterns

### Pattern 1: Pay Button

```tsx
function PayButton({ amount, description }) {
  const [loading, setLoading] = useState(false)

  const handlePay = async () => {
    setLoading(true)

    const res = await fetch('/api/payments/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, description })
    })

    const payment = await res.json()
    window.location.href = `/checkout?paymentId=${payment.id}`
  }

  return (
    <button onClick={handlePay} disabled={loading}>
      {loading ? 'Processing...' : `Pay ${amount} GRAIN`}
    </button>
  )
}
```

### Pattern 2: Payment Status Badge

```tsx
function PaymentStatusBadge({ status }) {
  const colors = {
    pending: 'bg-amber-500/10 text-amber-400',
    succeeded: 'bg-green-500/10 text-green-400',
    failed: 'bg-red-500/10 text-red-400'
  }

  return (
    <span className={`px-3 py-1 rounded-full ${colors[status]}`}>
      {status}
    </span>
  )
}
```

### Pattern 3: Escrow Timeline

```tsx
function DealTimeline({ deal }) {
  const steps = [
    { label: 'Deal Created', status: 'completed' },
    { label: 'Payment Escrowed', status: deal.status === 'escrowed' ? 'completed' : 'pending' },
    { label: 'Work Delivered', status: deal.status === 'delivered' ? 'completed' : 'pending' },
    { label: 'Payment Released', status: deal.status === 'released' ? 'completed' : 'pending' }
  ]

  return (
    <div className="space-y-4">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step.status === 'completed' ? 'bg-green-500' : 'bg-gray-500'
          }`}>
            {step.status === 'completed' ? '✓' : i + 1}
          </div>
          <span>{step.label}</span>
        </div>
      ))}
    </div>
  )
}
```

---

## Next Steps

1. **Read the full docs:** See `GRAIN_CHECKOUT_COMPLETE.md`
2. **Test locally:** Create a payment and walk through the flow
3. **Set up Circle account:** Get API keys from https://console.circle.com
4. **Deploy to staging:** Test with sandbox environment
5. **Go live:** Switch to production and monitor

---

## Support

For issues or questions:
- Check `GRAIN_CHECKOUT_COMPLETE.md` for troubleshooting
- Review Circle SDK docs: https://developers.circle.com
- Inspect browser console for detailed errors
- Check database logs for transaction history

---

**You're ready to accept GRAIN payments!** 🚀
