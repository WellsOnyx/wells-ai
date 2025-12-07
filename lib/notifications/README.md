# Wells Onyx Notification System

Production-ready notification infrastructure that powers the viral payment flow.

## Files Overview

```
lib/notifications/
├── README.md                 # This file
├── twilio.ts                # Twilio SMS integration
├── resend.ts                # Resend email integration
├── service.ts               # Unified notification service
└── preferences.ts           # User preference management
```

## Core Modules

### 1. `twilio.ts` - SMS Notifications

Handles all SMS notifications via Twilio.

**Key Functions:**
- `sendSMS()` - Send basic SMS
- `sendPaymentNotification()` - Payment alert SMS
- `sendClaimConfirmation()` - Claim success SMS
- `sendCreditApproval()` - Credit approval SMS
- `send2FACode()` - 2FA verification codes

**Example:**
```typescript
import { sendPaymentNotification } from './twilio';

await sendPaymentNotification({
  phone: '+1234567890',
  amount: 500,
  senderName: 'Acme Corp',
  claimUrl: 'https://wellsonyx.io/claim/pay_abc123',
});
```

### 2. `resend.ts` - Email Notifications

Handles all email notifications via Resend with beautiful HTML templates.

**Key Functions:**
- `sendEmail()` - Send basic email
- `sendPaymentNotification()` - Rich HTML payment email
- `sendClaimConfirmation()` - Claim success email
- `sendCreditApproval()` - Credit approval email
- `sendWelcomeEmail()` - Welcome new users

**Example:**
```typescript
import { sendPaymentNotification } from './resend';

await sendPaymentNotification({
  email: 'user@example.com',
  amount: 500,
  senderName: 'Acme Corp',
  claimUrl: 'https://wellsonyx.io/claim/pay_abc123',
  expiresAt: '2025-02-01T00:00:00Z',
  memo: 'Invoice #1234',
});
```

### 3. `service.ts` - Unified Notification Service

Smart routing that automatically sends notifications via the right channels based on user preferences.

**Key Functions:**
- `notify()` - Main notification function (auto-routes)
- `notifyPaymentReceived()` - Notify about incoming payment
- `notifyPaymentClaimed()` - Notify sender about claim
- `scheduleNotification()` - Schedule for future delivery
- `sendBulkNotifications()` - Send to multiple users

**Example:**
```typescript
import { notify } from './service';

await notify({
  type: 'payment_received',
  userId: 'user_123',
  email: 'user@example.com',
  phone: '+1234567890',
  channel: 'all',  // Send via email AND SMS
  priority: 'high',
  data: {
    amount: 500,
    senderName: 'Acme Corp',
    claimUrl: 'https://wellsonyx.io/claim/pay_abc123',
  },
});
```

### 4. `preferences.ts` - User Preferences

Manage user notification preferences, opt-outs, and quiet hours.

**Key Functions:**
- `getPreferences()` - Get user preferences
- `updatePreferences()` - Update preferences
- `setQuietHours()` - Configure quiet hours
- `optOutAll()` - Opt out of everything
- `getNotificationHistory()` - Get past notifications

**Example:**
```typescript
import { getPreferences, updatePreferences } from './preferences';

// Get preferences
const prefs = await getPreferences('user_123');

// Update preferences
await updatePreferences('user_123', {
  emailEnabled: true,
  smsEnabled: false,
  marketingNotifications: false,
});
```

## Notification Types

The system supports these notification types:

| Type | Channel | Priority | Use Case |
|------|---------|----------|----------|
| `payment_received` | Email + SMS | High | Viral payment notification |
| `payment_claimed` | Email + SMS | High | Claim confirmation |
| `payment_reminder` | Email + SMS | Normal | Unclaimed payment reminder |
| `credit_approved` | Email + SMS | Normal | Credit line approval |
| `welcome` | Email | Normal | New user welcome |
| `2fa_code` | SMS | Urgent | 2FA verification |
| `transaction_completed` | Email | Normal | Transaction receipt |
| `security_alert` | Email + SMS | Urgent | Security events |

## Smart Routing Logic

The `service.ts` module automatically handles:

1. **User Preferences**: Respects opt-outs and channel preferences
2. **Quiet Hours**: Holds non-urgent notifications during user's sleep hours
3. **Rate Limiting**: Prevents spam (max 10 per type per hour)
4. **Delivery Tracking**: Logs all notifications to database
5. **Fallback**: If email fails, tries SMS (if available)

## Integration with Viral Payments

The notification system is integrated into the viral payment flow:

### When Payment is Sent (`/api/viral/pay`)

```typescript
// Automatically triggered in viral payment creation
await notifyPaymentReceived(
  recipient_email,
  recipient_phone,
  amount,
  senderName,
  claimUrl
);
```

### When Payment is Claimed (`/api/viral/claim/[paymentId]`)

```typescript
// 1. Notify recipient of successful claim
await notify({
  type: 'payment_claimed',
  email: account.email,
  phone: account.phone,
  data: { amount, walletBalance },
});

// 2. Notify sender that payment was claimed
await notifyPaymentClaimed(
  senderEmail,
  senderPhone,
  amount,
  recipientName
);

// 3. Notify recipient of credit approval (if applicable)
await notify({
  type: 'credit_approved',
  email: account.email,
  phone: account.phone,
  data: { amount: creditLimit, apr: 0.12 },
});
```

## Error Handling

All notification functions use `.catch()` to prevent payment failures:

```typescript
await notifyPaymentReceived(...).catch((error) => {
  // Log error but don't fail the payment
  console.error('Failed to send notification:', error);
});
```

This ensures that notification failures never block critical business logic.

## Testing

### Test Individual Functions

```typescript
// Test SMS
import { sendSMS } from './twilio';
await sendSMS('+1234567890', 'Test message');

// Test Email
import { sendEmail } from './resend';
await sendEmail('test@example.com', 'Test', '<h1>Test</h1>');

// Test Full Flow
import { notify } from './service';
await notify({
  type: 'payment_received',
  email: 'test@example.com',
  phone: '+1234567890',
  channel: 'all',
  data: { amount: 100, senderName: 'Test' },
});
```

### Test Payment Flow

```bash
# Create payment (triggers notification)
curl -X POST http://localhost:3000/api/viral/pay \
  -H "Content-Type: application/json" \
  -d '{
    "sender_id": "test",
    "recipient_email": "your@email.com",
    "amount": 100
  }'

# Check email/SMS for notification
```

## Environment Variables

Required:
```bash
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890
RESEND_API_KEY=re_...
FROM_EMAIL="Wells Onyx <notifications@wellsonyx.io>"
NEXT_PUBLIC_BASE_URL=https://wellsonyx.io
```

See `.env.notifications.example` for full details.

## Database Schema

The notification system uses these tables:
- `notification_preferences` - User settings
- `notifications` - Delivery log
- `scheduled_notifications` - Future notifications
- `notification_engagement` - Opens/clicks
- `unsubscribe_tokens` - One-click unsubscribe

Run migration:
```bash
psql $DATABASE_URL -f scripts/schema-notifications.sql
```

## Monitoring

### Key Metrics

```sql
-- Delivery rates
SELECT * FROM v_notification_delivery_rates;

-- User preferences summary
SELECT * FROM v_user_notification_prefs_summary;

-- Failed notifications
SELECT * FROM notifications WHERE status = 'failed';
```

### Daily Aggregation

```sql
-- Run this daily (via cron)
SELECT aggregate_notification_stats(CURRENT_DATE);
```

## Production Checklist

- [ ] Configure Twilio production credentials
- [ ] Configure Resend with verified domain
- [ ] Set up SPF/DKIM/DMARC records
- [ ] Configure webhooks for delivery tracking
- [ ] Test all notification types
- [ ] Set up monitoring and alerts
- [ ] Review templates for spam compliance
- [ ] Test unsubscribe flow

## Performance

### Benchmarks
- SMS delivery: ~1-3 seconds
- Email delivery: ~500ms
- Database logging: ~50ms
- Total time: ~2-4 seconds per notification

### Optimization
- Notifications are sent asynchronously (don't block payment)
- Bulk sends use batching (50 per batch)
- Rate limiting prevents overload
- Database indexes optimize queries

## Common Issues

### SMS not sending
- Check Twilio credentials
- Verify phone number format (+1234567890)
- Check Twilio account balance

### Emails going to spam
- Verify sending domain
- Set up SPF/DKIM/DMARC
- Avoid spam trigger words
- Include unsubscribe link

### Webhooks not working
- Verify webhook URL is public
- Check webhook configuration in Twilio/Resend
- Review webhook logs

## Support

- **Docs**: See `/NOTIFICATION_SYSTEM.md`
- **Quick Start**: See `/NOTIFICATION_QUICKSTART.md`
- **Support**: support@wellsonyx.io

## License

Proprietary - Wells Onyx Inc.
