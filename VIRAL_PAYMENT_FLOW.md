# Viral Payment Flow - Complete Documentation

## Overview

The Viral Payment Flow is a critical feature that enables network growth through viral mechanics. Every payment sent automatically enrolls the recipient with a wallet, creating a seamless viral loop.

## Architecture

### Frontend Pages

1. **`/viral/send`** - Send Viral Payment Page
2. **`/viral/claim/[paymentId]`** - Claim Payment Page (dynamic route)
3. **`/viral/history`** - Payment History Dashboard

### Backend APIs

1. **`POST /api/viral/pay`** - Create a viral payment
2. **`POST /api/viral/claim/[paymentId]`** - Claim a payment
3. **`GET /api/viral/claim/[paymentId]`** - Get payment details
4. **`GET /api/viral/history?account_id=xxx`** - Get payment history and stats

### Supporting Libraries

- **`lib/viral/hooks.ts`** - React hooks for viral payment operations

## File Structure

```
app/
├── viral/
│   ├── send/
│   │   └── page.tsx           # Send payment form
│   ├── claim/
│   │   └── [paymentId]/
│   │       └── page.tsx       # Claim payment page
│   └── history/
│       └── page.tsx           # Payment history dashboard
└── api/
    └── viral/
        ├── pay/
        │   └── route.ts       # Create payment endpoint
        ├── claim/
        │   └── [paymentId]/
        │       └── route.ts   # Claim payment endpoint
        └── history/
            └── route.ts       # Payment history endpoint

lib/
└── viral/
    └── hooks.ts               # React hooks for viral operations
```

## User Flow

### 1. Send Payment Flow

**URL:** `/viral/send`

**Steps:**
1. User enters recipient info (email, phone, or company)
2. User enters amount (USD/USDC toggle)
3. Optional: Add memo or invoice reference
4. Preview shows fees and referrer bonus
5. User confirms and sends payment
6. Success screen shows shareable claim link

**Key Features:**
- Multi-step form with progress indicator
- Real-time fee calculation (1% Wells fee, 0.1% referrer bonus)
- Copy-to-clipboard for claim links
- Mobile-first responsive design
- Dark mode compatible

### 2. Claim Payment Flow

**URL:** `/viral/claim/[paymentId]`

**Steps:**
1. Recipient clicks claim link
2. Page loads payment details (amount, sender, memo)
3. Recipient clicks "Claim Payment Now"
4. Optional: Provide email/phone for notifications
5. Wallet auto-created, funds deposited
6. Success screen shows:
   - Wallet address
   - Available credit (2x transaction amount)
   - Invitation to send first payment (viral loop!)

**Key Features:**
- One-click claiming
- Silent account creation
- Auto-approved credit line
- Viral loop encouragement
- Status-based UI (pending/claimed/expired)

### 3. Payment History Flow

**URL:** `/viral/history`

**Features:**
- Tabs for sent/received payments
- Stats dashboard:
  - Volume sent/received
  - Network size (people enrolled)
  - Total referrer bonuses earned
- Expandable payment details
- Payment status indicators
- Quick actions (copy claim links, resend, etc.)

## React Hooks

### `useSendPayment()`

Send a viral payment.

```typescript
const { sendPayment, loading, error } = useSendPayment();

const result = await sendPayment({
  sender_id: 'user_123',
  recipient_email: 'recipient@example.com',
  amount: 100,
  memo: 'Payment for services',
});
```

### `useClaimPayment()`

Claim a payment.

```typescript
const { claimPayment, loading, error } = useClaimPayment();

const result = await claimPayment(
  'pay_abc123',
  'optional@email.com',
  '+1-555-123-4567'
);
```

### `usePaymentDetails(paymentId)`

Fetch payment details for display.

```typescript
const { payment, loading, error } = usePaymentDetails('pay_abc123');

// payment.payment = { id, amount, status, memo, ... }
// payment.claimable = true/false
```

### `usePaymentHistory(accountId)`

Fetch payment history and stats.

```typescript
const { payments, stats, loading, error, refetch } = usePaymentHistory('user_123');

// payments.sent = ViralPayment[]
// payments.received = ViralPayment[]
// stats = { total_sent, total_received, network_enrollments, ... }
```

### Utility Hooks

**`useFormatCurrency()`** - Format amounts as USD/USDC
```typescript
const { formatUSD, formatUSDC } = useFormatCurrency();
formatUSD(100.50); // "$100.50"
formatUSDC(100.50); // "100.50 USDC"
```

**`useCopyToClipboard()`** - Copy text with feedback
```typescript
const { copy, copied } = useCopyToClipboard();
copy('https://wellsonyx.io/claim/pay_123');
// copied = true for 2 seconds
```

## Viral Mechanics

### Fee Structure

- **Wells Fee:** 1% of payment amount
- **Referrer Bonus:** 0.1% of payment amount (paid to sender)

### Network Growth

1. **Ghost Account Creation**
   - Recipient gets silent account on first payment
   - Activation level: "ghost" → "aware" when claimed
   - Wallet auto-generated

2. **Credit Line Auto-Approval**
   - Credit limit = 2x transaction amount
   - Max $100K on first transaction
   - Instant approval based on transaction history

3. **Viral Loop**
   - After claiming, user is prompted to send their first payment
   - They earn 0.1% on all payments they send
   - Network compounds exponentially

### Payment States

- **Pending:** Payment created, awaiting claim
- **Claimed:** Recipient claimed the payment
- **Expired:** Payment not claimed within 30 days

## Design System

### Colors

- **Primary:** Blue (400-600) for actions
- **Secondary:** Purple (400-600) for gradients
- **Success:** Green (400-500) for claimed/success states
- **Warning:** Yellow (400-500) for pending states
- **Error:** Red (400-500) for expired/error states
- **Background:** Gray (800-900) with backdrop blur

### Components

All pages use:
- Tailwind CSS for styling
- Dark mode compatible (bg-gray-900, text-white)
- Mobile-first responsive design
- Smooth transitions and hover states
- Loading states with spinners
- Error states with retry options

### Typography

- **Headings:** Bold, gradient text (blue to purple)
- **Body:** Gray-400 for secondary text, white for primary
- **Monospace:** For wallet addresses, IDs, codes

## Database Schema

### Tables Used

1. **`viral_payments`**
   - Stores all viral payments
   - Tracks status, fees, claim links

2. **`silent_accounts`**
   - Auto-created accounts for recipients
   - Tracks activation levels and volumes

3. **`viral_events`**
   - Analytics events for tracking

4. **`credit_lines`**
   - Auto-approved credit for new users

5. **`treasury_wallets`**
   - Sender wallet addresses

## API Reference

### POST /api/viral/pay

Create a viral payment.

**Request:**
```json
{
  "sender_id": "user_123",
  "recipient_email": "recipient@example.com",
  "recipient_phone": "+1-555-123-4567",
  "recipient_company": "Acme Inc.",
  "amount": 100,
  "memo": "Payment for services",
  "invoice_id": "INV-001"
}
```

**Response:**
```json
{
  "success": true,
  "payment": {
    "id": "pay_abc123",
    "amount": 100,
    "claim_url": "https://wellsonyx.io/claim/pay_abc123?ref=USER-XYZ",
    "referral_code": "USER-XYZ",
    "expires_at": "2025-01-06T00:00:00Z",
    "status": "pending"
  },
  "recipient": {
    "account_id": "acc_xyz789",
    "activation_level": "ghost"
  }
}
```

### POST /api/viral/claim/[paymentId]

Claim a payment.

**Request:**
```json
{
  "email": "optional@email.com",
  "phone": "+1-555-123-4567"
}
```

**Response:**
```json
{
  "success": true,
  "claimed": {
    "amount": 100,
    "wallet": "0x1234567890abcdef...",
    "memo": "Payment for services"
  },
  "account": {
    "id": "acc_xyz789",
    "activation_level": "aware",
    "total_received": 100
  },
  "next_steps": {
    "credit_available": 200,
    "send_payment_url": "https://wellsonyx.io/send",
    "invite_bonus": "0.1% on payments you send"
  }
}
```

### GET /api/viral/claim/[paymentId]

Get payment details.

**Response:**
```json
{
  "payment": {
    "id": "pay_abc123",
    "amount": 100,
    "memo": "Payment for services",
    "status": "pending",
    "expires_at": "2025-01-06T00:00:00Z",
    "from_company": "Acme Inc.",
    "created_at": "2024-12-07T00:00:00Z"
  },
  "claimable": true
}
```

### GET /api/viral/history?account_id=xxx

Get payment history and stats.

**Response:**
```json
{
  "payments": {
    "sent": [/* ViralPayment[] */],
    "received": [/* ViralPayment[] */]
  },
  "stats": {
    "total_sent": 10,
    "total_received": 5,
    "total_volume_sent": 1000,
    "total_volume_received": 500,
    "network_enrollments": 8,
    "total_referrer_bonus": 10
  },
  "account": {
    "id": "user_123",
    "activation_level": "aware",
    "wallet_address": "0x...",
    "total_volume_sent": 1000,
    "total_volume_received": 500,
    "touch_count": 15
  },
  "viral_events": [/* ViralEvent[] */]
}
```

## Integration Notes

### Authentication

Currently uses hardcoded `user_demo_123` for testing.

**TODO:** Integrate with Clerk authentication:

```typescript
import { useUser } from '@clerk/nextjs';

const { user } = useUser();
const accountId = user?.id || 'user_demo_123';
```

### Notifications

The backend has TODOs for sending notifications:

```typescript
// TODO: Send notification to recipient (email/SMS)
// await notifyRecipient(payment);
```

**Recommended integrations:**
- Email: SendGrid, Postmark, or Resend
- SMS: Twilio (already integrated elsewhere in the app)

### Analytics

Track viral events:
- `payment_created`
- `payment_claimed`

Use the `viral_events` table for funnel analysis and growth metrics.

## Testing

### Manual Testing Checklist

**Send Payment:**
- [ ] Enter recipient email
- [ ] Enter amount
- [ ] Add optional memo
- [ ] Preview shows correct fees
- [ ] Payment creates successfully
- [ ] Claim link is generated
- [ ] Copy to clipboard works

**Claim Payment:**
- [ ] Load claim page with valid payment ID
- [ ] Payment details display correctly
- [ ] Claim button works
- [ ] Success screen shows wallet
- [ ] Credit line is created
- [ ] CTA to send first payment appears

**History:**
- [ ] Stats display correctly
- [ ] Sent payments list correctly
- [ ] Received payments list correctly
- [ ] Tabs switch correctly
- [ ] Payment details expand
- [ ] Copy claim link works

**Error States:**
- [ ] Invalid payment ID shows error
- [ ] Already claimed shows appropriate message
- [ ] Expired payment shows appropriate message
- [ ] Network errors display gracefully

## Performance Considerations

- All pages use React Server Components where possible
- Client-side state management is minimal
- Loading states prevent layout shift
- Optimistic UI updates for better UX
- Debounced search/filter (if added)

## Security Considerations

- Payment IDs are random and unpredictable
- Claim links include referral codes for tracking
- Server-side validation on all endpoints
- Rate limiting recommended for production
- Wallet addresses are generated server-side
- Transaction amounts validated on backend

## Future Enhancements

1. **Email/SMS Notifications**
   - Send claim link to recipient
   - Reminder emails for unclaimed payments
   - Payment confirmation receipts

2. **Advanced Analytics**
   - Network graph visualization
   - Viral coefficient tracking
   - Referral revenue dashboard

3. **Social Sharing**
   - Share claim links on social media
   - QR codes for in-person payments
   - Deep linking for mobile apps

4. **Payment Scheduling**
   - Recurring viral payments
   - Scheduled payment batches
   - Auto-retry on failure

5. **Enhanced Credit System**
   - Dynamic credit limits
   - Credit score integration
   - Payment plans

## Support

For issues or questions, contact the Wells AI team or file a GitHub issue.

## License

Proprietary - Wells Onyx / Wells AI
