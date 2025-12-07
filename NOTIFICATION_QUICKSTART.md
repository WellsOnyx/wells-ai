# Notification System Quick Start

Get the Wells Onyx notification system up and running in 5 minutes.

## Step 1: Get API Keys

### Twilio (SMS)
1. Sign up at [twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Get a phone number (free trial includes $15 credit)
3. Copy your Account SID and Auth Token from the dashboard

### Resend (Email)
1. Sign up at [resend.com](https://resend.com)
2. Create an API key from the dashboard
3. Verify your sending domain (or use onboarding@resend.dev for testing)

## Step 2: Configure Environment

Add to `.env.local`:

```bash
# Twilio (SMS)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890

# Resend (Email)
RESEND_API_KEY=re_...
FROM_EMAIL="Wells Onyx <notifications@wellsonyx.io>"

# Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # or your production URL
```

## Step 3: Install Dependencies

```bash
npm install twilio resend
```

## Step 4: Run Database Migration

```bash
# Using psql
psql $DATABASE_URL -f scripts/schema-notifications.sql

# Or using Supabase CLI
supabase db push
```

## Step 5: Test It

### Test SMS

Create a file `test-sms.ts`:

```typescript
import { sendPaymentNotification } from './lib/notifications/twilio';

async function test() {
  const result = await sendPaymentNotification({
    phone: '+1234567890',  // Your phone number
    amount: 500,
    senderName: 'Acme Corp',
    claimUrl: 'https://wellsonyx.io/claim/pay_test123',
    expiresIn: '30 days',
  });

  console.log('SMS sent:', result);
}

test();
```

Run it:
```bash
npx tsx test-sms.ts
```

### Test Email

Create a file `test-email.ts`:

```typescript
import { sendPaymentNotification } from './lib/notifications/resend';

async function test() {
  const result = await sendPaymentNotification({
    email: 'your@email.com',
    amount: 500,
    senderName: 'Acme Corp',
    claimUrl: 'https://wellsonyx.io/claim/pay_test123',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    memo: 'Test payment',
  });

  console.log('Email sent:', result);
}

test();
```

Run it:
```bash
npx tsx test-email.ts
```

## Step 6: Test Viral Payment Flow

```bash
# 1. Start the dev server
npm run dev

# 2. Create a viral payment
curl -X POST http://localhost:3000/api/viral/pay \
  -H "Content-Type: application/json" \
  -d '{
    "sender_id": "test_sender",
    "recipient_email": "your@email.com",
    "recipient_phone": "+1234567890",
    "amount": 100,
    "memo": "Test payment - notification system"
  }'

# 3. Check your email and phone for the notification!
```

## Step 7: Configure Webhooks (Production)

### Twilio Webhooks

1. Go to Twilio Console → Phone Numbers
2. Click your phone number
3. Under "Messaging", set:
   - **Status Callback URL**: `https://yourdomain.com/api/webhooks/notifications`
   - **Method**: POST

### Resend Webhooks

1. Go to Resend Dashboard → Webhooks
2. Add webhook:
   - **Endpoint URL**: `https://yourdomain.com/api/webhooks/notifications`
   - **Events**: Select all

## Step 8: Set Up Domain (Production)

### For Resend

1. Add your domain in Resend Dashboard
2. Add these DNS records:

```
Type: TXT
Name: @
Value: v=spf1 include:_spf.resend.com ~all

Type: TXT
Name: resend._domainkey
Value: [provided by Resend]

Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

3. Wait for verification (usually < 5 minutes)

## Common Issues

### SMS Not Sending

**Error: "Twilio credentials not configured"**
- Make sure `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are in `.env.local`
- Restart your dev server after adding env vars

**Error: "Invalid phone number"**
- Phone numbers must be in E.164 format: `+1234567890`
- Include country code (+1 for US)

### Email Not Sending

**Error: "RESEND_API_KEY not configured"**
- Make sure `RESEND_API_KEY` is in `.env.local`
- Restart your dev server

**Emails go to spam**
- Use verified domain (not onboarding@resend.dev)
- Set up SPF/DKIM/DMARC records
- Include unsubscribe link

### Database Errors

**Error: "relation 'notifications' does not exist"**
- Run the database migration: `psql $DATABASE_URL -f scripts/schema-notifications.sql`

## What's Next?

1. **Customize templates**: Edit email templates in `lib/notifications/resend.ts`
2. **Add preferences**: Let users control their notification settings
3. **Monitor delivery**: Check webhook logs for delivery status
4. **Set up analytics**: Aggregate daily stats with the SQL function
5. **Configure quiet hours**: Respect user sleep schedules

## Production Checklist

Before going live:

- [ ] Move from trial to paid Twilio account
- [ ] Verify sending domain in Resend
- [ ] Set up SPF/DKIM/DMARC records
- [ ] Configure webhooks for both services
- [ ] Test notifications end-to-end
- [ ] Set up monitoring/alerts
- [ ] Review email templates for spam compliance
- [ ] Test unsubscribe flow

## Need Help?

- **Documentation**: See `NOTIFICATION_SYSTEM.md`
- **Issues**: Check logs in `/var/log/notifications`
- **Support**: support@wellsonyx.io

## Example: Complete Payment Flow

Here's a complete example showing the full viral payment + notification flow:

```typescript
// 1. Send payment (in your app)
const response = await fetch('/api/viral/pay', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sender_id: 'user_123',
    recipient_email: 'recipient@example.com',
    recipient_phone: '+1234567890',
    amount: 500,
    memo: 'Invoice #1234',
  }),
});

const { payment } = await response.json();

// 2. Recipient gets email/SMS with claim link

// 3. Recipient claims payment
const claimResponse = await fetch(`/api/viral/claim/${payment.id}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'recipient@example.com',
  }),
});

// 4. Both sender and recipient get confirmation notifications
// 5. Recipient gets credit approval notification
```

That's it! Your notification system is ready to power the viral payment loop.
