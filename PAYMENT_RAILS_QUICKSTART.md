# Payment Rails Quick Start

Get Wells AI payment infrastructure running in 10 minutes.

---

## 1. Install Dependencies (2 minutes)

```bash
npm install stripe @stripe/stripe-js @stripe/react-stripe-js @supabase/supabase-js
```

---

## 2. Get API Keys (3 minutes)

### Circle (USDC)
1. Go to https://console.circle.com
2. Sign up / Login
3. Create Sandbox API Key
4. Copy API Key and Entity Secret

### Stripe (Fiat)
1. Go to https://dashboard.stripe.com
2. Sign up / Login
3. Get Test Mode keys from Developers → API Keys
4. Copy Secret Key and Publishable Key

### Supabase (Database)
1. Go to https://app.supabase.com
2. Create new project
3. Copy URL and Service Role Key from Settings → API

---

## 3. Configure Environment (1 minute)

```bash
cp .env.payments.example .env.local
```

Edit `.env.local`:

```bash
# Circle
CIRCLE_API_KEY=your_sandbox_key_here
CIRCLE_ENTITY_SECRET=your_entity_secret_here

# Stripe
STRIPE_SECRET_KEY=sk_test_your_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_leave_blank_for_now

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# App
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

---

## 4. Setup Database (2 minutes)

```bash
# Connect to your Supabase database
psql "postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres"

# Run schema
\i scripts/schema-payments.sql

# Exit
\q
```

Or use Supabase Dashboard:
1. Go to SQL Editor
2. Copy contents of `scripts/schema-payments.sql`
3. Run query

---

## 5. Start Server (1 minute)

```bash
npm run dev
```

Visit: http://localhost:3000/deposit

---

## 6. Test Deposit (1 minute)

1. Enter amount: $100
2. Click "Continue"
3. Use test card: `4242 4242 4242 4242`
4. Expiry: Any future date
5. CVC: Any 3 digits
6. Click "Add Funds"

You should see:
- Balance updated to $100 USDC
- Transaction in history
- Float metrics showing active position

---

## That's It!

You now have:
- Working deposit flow (card/ACH)
- USDC balance management
- Float tracking and yield generation
- Transaction history
- Real-time balance updates

---

## Next Steps

### Setup Webhooks (Optional for development)

**Stripe:**
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:3000/api/webhooks/payments?provider=stripe
```

Copy the webhook secret to `.env.local`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_from_stripe_cli_output
```

**Circle:**
- Webhooks work automatically in production
- For local testing, use ngrok or similar

### Test Complete Flow

```typescript
// 1. Deposit $500
// Visit /deposit, add $500

// 2. Send payment
import { sendUSDC } from '@/lib/payments/circle';

await sendUSDC({
  fromUserId: 'demo-user',
  toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  amount: '200.00',
  metadata: {
    paymentType: 'viral_payment',
    sourceId: 'test-payment-1',
  },
});

// 3. Check float metrics
// Visit /deposit to see earnings

// 4. Withdraw
// Setup bank account first, then withdraw
```

### Read Documentation

- **Complete Guide**: `PAYMENT_RAILS_GUIDE.md`
- **Code Examples**: `lib/payments/example.ts`
- **Build Summary**: `PAYMENT_RAILS_SUMMARY.md`
- **Dependencies**: `PAYMENT_RAILS_DEPENDENCIES.md`

---

## Troubleshooting

**"Module not found"**
```bash
npm install
rm -rf .next
npm run dev
```

**"Missing API key"**
- Check `.env.local` exists
- Verify all keys are filled in
- Restart dev server

**"Database error"**
- Verify schema was applied
- Check Supabase connection string
- Review table creation in Supabase dashboard

**"Stripe Elements not loading"**
- Check `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set
- Verify it starts with `pk_test_`
- Open browser console for errors

**"Payment not confirming"**
- Use test card: `4242 4242 4242 4242`
- Check Stripe Dashboard → Payments
- Review webhook logs

---

## Production Deployment

When ready for production:

1. **Switch API Keys**
   - Circle: Production API key
   - Stripe: Live mode keys (sk_live_, pk_live_)

2. **Setup Webhooks**
   - Circle: Add webhook URL in dashboard
   - Stripe: Add webhook endpoint

3. **Apply Schema**
   - Run schema on production database
   - Verify all tables created

4. **Test Thoroughly**
   - Test deposit flow
   - Test payment flow
   - Test withdrawal flow
   - Verify webhooks working

5. **Monitor**
   - Set up error tracking
   - Monitor balance changes
   - Watch float deployment
   - Track yield generation

---

## Support

- **Issues?** Check `PAYMENT_RAILS_GUIDE.md`
- **Questions?** See `lib/payments/example.ts`
- **Stripe Help:** https://stripe.com/docs
- **Circle Help:** https://developers.circle.com

---

**Time to first payment: ~10 minutes**

**Status: Production Ready ✓**
