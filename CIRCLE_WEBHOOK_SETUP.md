# Circle Webhook & Payment Intent Setup

Complete guide for the **Grain & Vault** Circle SDK integration with Base L2 payments.

## Overview

This integration provides:

1. **Circle Webhook Handler** - Receives payment confirmations from Circle API
2. **Payment Intent API** - Creates new payment requests for GRAIN/USDC
3. **Payment Status API** - Checks payment status and syncs with Circle
4. **Treasury Database** - Stores transactions, wallets, and webhook events

---

## Architecture

```
User → Create Payment Intent → Payment Intent API
                                      ↓
                              Store in Database
                                      ↓
                              Circle SDK (Base L2)
                                      ↓
Circle API → Webhook Event → Circle Webhook Handler
                                      ↓
                              Update Database
                                      ↓
                              Send Notification
                                      ↓
                              User sees "Payment Complete"
```

---

## Setup Instructions

### 1. Environment Variables

Add these to your `.env.local`:

```bash
# Circle API Configuration
CIRCLE_API_KEY=your_circle_api_key_here
CIRCLE_ENVIRONMENT=sandbox  # or 'production'
CIRCLE_WEBHOOK_SECRET=your_webhook_secret_here

# Application URLs
NEXT_PUBLIC_BASE_URL=https://grainandvault.com

# Optional: Slack notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

### 2. Database Setup

Run the treasury schema migration:

```bash
# Using psql
psql $POSTGRES_URL -f scripts/schema-treasury.sql

# Or using npm script (if configured)
npm run db:migrate:treasury
```

This creates:
- `user_wallets` - Circle wallet info for users
- `treasury_transactions` - All payment transactions
- `circle_webhook_events` - Webhook event log
- `treasury_accounts` - Enterprise treasury accounts
- `treasury_wallets` - Circle wallets for treasury
- Additional helper tables and views

### 3. Configure Circle Webhooks

In the [Circle Dashboard](https://app.circle.com):

1. Go to **Settings** → **Webhooks**
2. Click **Add Endpoint**
3. Enter your webhook URL:
   ```
   https://your-domain.com/api/webhooks/circle
   ```
4. Select event types:
   - ✅ `payment.completed`
   - ✅ `payment.failed`
   - ✅ `transfer.completed`
   - ✅ `transfer.failed`
   - ✅ `payout.completed`
   - ✅ `payout.failed`
5. Copy the **Webhook Secret** and add to `.env.local` as `CIRCLE_WEBHOOK_SECRET`

### 4. Test Webhook

Test that your webhook is receiving events:

```bash
curl -X GET https://your-domain.com/api/webhooks/circle
```

Expected response:
```json
{
  "status": "active",
  "service": "Circle Webhook Handler",
  "timestamp": "2025-12-04T..."
}
```

---

## API Endpoints

### 1. Create Payment Intent

**POST** `/api/payments/create-intent`

Creates a new payment request.

**Authentication:** Required (Clerk)

**Request Body:**
```json
{
  "amount": 100.00,
  "currency": "GRAIN",
  "description": "Payment for services",
  "recipientWallet": "0x...",
  "metadata": {
    "orderId": "12345"
  },
  "returnUrl": "https://yoursite.com/payment/success",
  "cancelUrl": "https://yoursite.com/payment/cancel",
  "embedMode": false
}
```

**Response:**
```json
{
  "success": true,
  "paymentId": "payment_1733345678_abc123",
  "paymentUrl": "https://grainandvault.com/payments/payment_1733345678_abc123",
  "walletAddress": "0x1234...",
  "amount": 100.00,
  "currency": "GRAIN",
  "status": "pending",
  "createdAt": "2025-12-04T12:00:00Z"
}
```

**Example:**
```typescript
const response = await fetch('/api/payments/create-intent', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${clerkToken}`
  },
  body: JSON.stringify({
    amount: 100,
    currency: 'GRAIN',
    description: 'Payment for premium subscription'
  })
})

const { paymentId, paymentUrl } = await response.json()
```

---

### 2. Get Payment Status

**GET** `/api/payments/[paymentId]`

Retrieves current payment status and details.

**Authentication:** Required (user must own payment)

**Response:**
```json
{
  "id": "payment_1733345678_abc123",
  "amount": 100.00,
  "currency": "GRAIN",
  "status": "completed",
  "description": "Payment for services",
  "walletAddress": "0x1234...",
  "transactionHash": "0xabcd...",
  "createdAt": "2025-12-04T12:00:00Z",
  "completedAt": "2025-12-04T12:05:00Z"
}
```

**Status Values:**
- `pending` - Payment created, awaiting deposit
- `processing` - Circle is processing the payment
- `completed` - Payment successful
- `failed` - Payment failed (see `errorMessage`)
- `cancelled` - Payment cancelled by user

**Example:**
```typescript
const response = await fetch(`/api/payments/${paymentId}`, {
  headers: {
    'Authorization': `Bearer ${clerkToken}`
  }
})

const payment = await response.json()
console.log('Payment status:', payment.status)
```

---

### 3. Cancel Payment

**DELETE** `/api/payments/[paymentId]`

Cancels a pending payment.

**Authentication:** Required (user must own payment)

**Response:**
```json
{
  "success": true,
  "message": "Payment cancelled"
}
```

---

### 4. Circle Webhook Handler

**POST** `/api/webhooks/circle`

Receives webhook events from Circle API.

**Authentication:** None (public, but signature verified)

**Event Types Handled:**
- `payment.completed` - Payment successfully processed
- `payment.failed` - Payment processing failed
- `transfer.completed` - Transfer completed on blockchain
- `transfer.failed` - Transfer failed
- `payout.completed` - Payout completed
- `payout.failed` - Payout failed

**Webhook Payload Example:**
```json
{
  "notificationId": "abc123",
  "notificationType": "payment.completed",
  "notification": {
    "Type": "payment.completed",
    "Id": "event_123",
    "Timestamp": "2025-12-04T12:00:00Z",
    "Data": {
      "id": "transfer_456",
      "status": "complete",
      "amount": {
        "amount": "100.00",
        "currency": "USD"
      },
      "transactionHash": "0xabcd..."
    }
  }
}
```

**Response:**
```json
{
  "received": true,
  "eventType": "payment.completed",
  "processingTime": "15ms"
}
```

---

## Database Schema

### `user_wallets`
Stores Circle wallet information for individual users.

```sql
CREATE TABLE user_wallets (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  wallet_id VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(255) NOT NULL,
  balance DECIMAL(20, 6) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `treasury_transactions`
All payment transactions and their status.

```sql
CREATE TABLE treasury_transactions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  circle_transfer_id VARCHAR(255),
  circle_transaction_hash VARCHAR(255),
  transaction_type VARCHAR(50),
  amount DECIMAL(20, 6),
  currency VARCHAR(10),
  status VARCHAR(50),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

### `circle_webhook_events`
Log of all webhook events for debugging.

```sql
CREATE TABLE circle_webhook_events (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(255) UNIQUE,
  event_type VARCHAR(100),
  circle_transfer_id VARCHAR(255),
  payload JSONB,
  status VARCHAR(50),
  created_at TIMESTAMP
);
```

---

## Security

### Webhook Signature Verification

All Circle webhooks are verified using HMAC SHA256:

```typescript
const hmac = crypto.createHmac('sha256', CIRCLE_WEBHOOK_SECRET)
hmac.update(rawBody)
const expectedSignature = hmac.digest('hex')

// Constant-time comparison
crypto.timingSafeEqual(
  Buffer.from(signature),
  Buffer.from(expectedSignature)
)
```

### Authentication

- Payment Intent API requires Clerk authentication
- Payment Status API verifies user owns the payment
- Webhook handler is public but signature-verified

---

## Error Handling

### Payment Failures

When a payment fails, the webhook handler:

1. Updates transaction status to `failed`
2. Stores error message in `error_message` column
3. Sends notification to Slack (if configured)
4. Returns 200 OK to Circle (prevents retries)

**Example Error:**
```json
{
  "id": "payment_123",
  "status": "failed",
  "errorMessage": "insufficient_funds: Wallet balance too low"
}
```

### Webhook Processing

Webhooks are processed asynchronously:

```typescript
// Return 200 OK immediately
return NextResponse.json({ received: true })

// Process asynchronously
setImmediate(async () => {
  await handlePaymentCompleted(event)
})
```

This ensures Circle receives a quick response even if processing takes time.

---

## Notifications

### Slack Integration

When configured, notifications are sent to Slack:

**Payment Completed:**
```
💰 Payment Completed
Amount: 100.00 GRAIN
Transaction: payment_123
```

**Payment Failed:**
```
❌ Payment Failed
Amount: 100.00 GRAIN
Transaction: payment_123
Error: insufficient_funds
```

---

## Testing

### Test Payment Intent Creation

```bash
# Create test payment
curl -X POST https://your-domain.com/api/payments/create-intent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{
    "amount": 10.00,
    "currency": "GRAIN",
    "description": "Test payment"
  }'
```

### Test Webhook Handler

```bash
# Simulate Circle webhook (use real signature in production)
curl -X POST https://your-domain.com/api/webhooks/circle \
  -H "Content-Type: application/json" \
  -H "x-circle-signature: YOUR_SIGNATURE" \
  -d '{
    "notificationId": "test_123",
    "notificationType": "payment.completed",
    "notification": {
      "Type": "payment.completed",
      "Id": "event_123",
      "Data": {
        "id": "transfer_456",
        "status": "complete"
      }
    }
  }'
```

### Check Webhook Logs

Query webhook events in database:

```sql
SELECT
  event_id,
  event_type,
  circle_transfer_id,
  status,
  created_at
FROM circle_webhook_events
ORDER BY created_at DESC
LIMIT 10;
```

---

## Production Checklist

- [ ] Set `CIRCLE_ENVIRONMENT=production`
- [ ] Configure production Circle API key
- [ ] Add webhook endpoint in Circle Dashboard
- [ ] Test webhook signature verification
- [ ] Enable Slack notifications
- [ ] Monitor webhook event logs
- [ ] Set up database backups
- [ ] Configure error alerting
- [ ] Test payment flow end-to-end
- [ ] Document payment reconciliation process

---

## Troubleshooting

### Webhook Not Receiving Events

1. Check Circle Dashboard webhook configuration
2. Verify webhook URL is accessible (test with curl)
3. Check webhook secret matches `.env.local`
4. Review Circle webhook delivery logs

### Payment Status Not Updating

1. Check webhook is being received (query `circle_webhook_events`)
2. Verify signature verification passes
3. Check transaction exists in `treasury_transactions`
4. Look for errors in application logs

### User Wallet Creation Fails

1. Verify Circle API key is valid
2. Check Circle API rate limits
3. Review Circle API response errors
3. Ensure database connection is working

---

## Support

For issues or questions:

1. Check Circle API documentation: https://developers.circle.com
2. Review application logs for errors
3. Query `circle_webhook_events` for webhook delivery issues
4. Contact Circle support for API/webhook issues

---

## Next Steps

1. **Implement Frontend** - Create payment UI components
2. **Add Email Notifications** - Send payment confirmations via email
3. **Treasury Dashboard** - Build admin dashboard for transaction monitoring
4. **Reconciliation** - Automate payment reconciliation with accounting systems
5. **Multi-currency Support** - Extend to support multiple cryptocurrencies

---

**Built with:** Circle SDK, Next.js, PostgreSQL, Clerk Auth, Base L2 Blockchain
