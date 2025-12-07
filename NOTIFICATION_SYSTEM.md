# Wells Onyx Notification System

Complete, production-ready notification system that powers the viral payment flow with email and SMS notifications.

## Overview

The notification system is critical for the viral loop to work. When someone sends a viral payment, the recipient MUST be notified immediately via email and/or SMS. Without notifications, recipients don't know they have money waiting.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Notification System                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │   Twilio     │    │   Resend     │    │  Preferences │ │
│  │     SMS      │    │    Email     │    │   Manager    │ │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘ │
│         │                   │                    │          │
│         └───────────────────┴────────────────────┘          │
│                            │                                │
│                   ┌────────▼─────────┐                      │
│                   │  Unified Service │                      │
│                   │  Smart Routing   │                      │
│                   │  Rate Limiting   │                      │
│                   └────────┬─────────┘                      │
│                            │                                │
│  ┌─────────────────────────┼──────────────────────────┐    │
│  │                         │                          │    │
│  ▼                         ▼                          ▼    │
│ Viral                  Webhooks                    APIs    │
│ Payments               (Delivery Status)           (Admin) │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Features

### Core Capabilities
- **Multi-channel**: Email, SMS, and push notifications
- **Smart routing**: Automatically route based on user preferences
- **Rich templates**: Beautiful HTML emails with compelling CTAs
- **Rate limiting**: Prevent spam and abuse
- **Delivery tracking**: Track delivery status via webhooks
- **Preferences**: Respect user opt-outs and quiet hours
- **Scheduling**: Schedule notifications for future delivery
- **Analytics**: Track open rates, click rates, and engagement

### Notification Types
1. **Payment Received** - Notify recipient of incoming payment
2. **Payment Claimed** - Notify sender when payment is claimed
3. **Payment Reminder** - Remind about unclaimed payments
4. **Credit Approved** - Notify when credit line is approved
5. **Welcome** - Welcome new users
6. **2FA Codes** - Send verification codes
7. **Transaction Alerts** - Real-time transaction notifications
8. **Security Alerts** - Account security events

## Setup

### 1. Environment Variables

Add these to your `.env.local`:

```bash
# Twilio (SMS)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Resend (Email)
RESEND_API_KEY=re_your_api_key
FROM_EMAIL="Wells Onyx <notifications@wellsonyx.io>"

# Base URL (for links in notifications)
NEXT_PUBLIC_BASE_URL=https://wellsonyx.io
```

### 2. Database Setup

Run the notification schema:

```bash
psql $DATABASE_URL -f scripts/schema-notifications.sql
```

This creates:
- `notification_preferences` - User notification settings
- `notifications` - Log of all sent notifications
- `scheduled_notifications` - Future notifications
- `notification_engagement` - Track opens/clicks
- `unsubscribe_tokens` - One-click unsubscribe
- `notification_templates` - Template management
- `notification_analytics` - Aggregated stats

### 3. Install Dependencies

```bash
npm install twilio resend
```

## Usage

### Send Payment Notification

Automatically triggered when a viral payment is created:

```typescript
import { notifyPaymentReceived } from '@/lib/notifications/service';

await notifyPaymentReceived(
  'recipient@example.com',  // Email
  '+1234567890',            // Phone
  500,                      // Amount
  'Acme Corp',              // Sender name
  'https://wellsonyx.io/claim/pay_abc123', // Claim URL
  {
    senderCompany: 'Acme Corp',
    memo: 'Invoice #1234',
    expiresAt: '2025-02-01T00:00:00Z',
    userId: 'user_123',
  }
);
```

### Send Claim Confirmation

Automatically triggered when a payment is claimed:

```typescript
import { notify } from '@/lib/notifications/service';

await notify({
  type: 'payment_claimed',
  userId: 'user_123',
  email: 'user@example.com',
  phone: '+1234567890',
  channel: 'all',
  priority: 'high',
  data: {
    amount: 500,
    walletBalance: 1500,
    senderName: 'Acme Corp',
  },
});
```

### Send Credit Approval

```typescript
await notify({
  type: 'credit_approved',
  userId: 'user_123',
  email: 'user@example.com',
  phone: '+1234567890',
  channel: 'all',
  data: {
    amount: 10000,
    apr: 0.12,
    availableCredit: 10000,
    transactionAmount: 5000,
  },
});
```

### Manual Notification (Admin)

```bash
curl -X POST https://wellsonyx.io/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payment_received",
    "email": "user@example.com",
    "phone": "+1234567890",
    "channel": "all",
    "priority": "high",
    "data": {
      "amount": 500,
      "senderName": "Acme Corp",
      "claimUrl": "https://wellsonyx.io/claim/pay_abc123",
      "expiresAt": "2025-02-01T00:00:00Z"
    }
  }'
```

## Email Templates

### Payment Notification

Subject: **"You have $500 waiting from Acme Corp"**

Features:
- Large, prominent amount display
- Clear "Claim Your Money" CTA button
- Expiration countdown (creates urgency)
- Sender info for trust
- "What is Wells Onyx?" section for new users
- Beautiful gradient design

### Claim Confirmation

Subject: **"$500 claimed successfully!"**

Features:
- Success checkmark and green theme
- Current balance display
- Next steps (Send Money, Get Credit, Dashboard)
- Engaging call-to-action cards

### Credit Approval

Subject: **"You're approved for $10,000 credit!"**

Features:
- Big credit amount display
- APR and terms clearly shown
- "How It Works" section
- Green success theme

## Notification Preferences

### Get User Preferences

```typescript
import { getPreferences } from '@/lib/notifications/preferences';

const prefs = await getPreferences('user_123');
```

### Update Preferences

```typescript
import { updatePreferences } from '@/lib/notifications/preferences';

await updatePreferences('user_123', {
  emailEnabled: true,
  smsEnabled: false,
  marketingNotifications: false,
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
});
```

### Set Quiet Hours

```typescript
import { setQuietHours } from '@/lib/notifications/preferences';

await setQuietHours('user_123', '22:00', '08:00', 'America/New_York');
```

### Opt Out

```typescript
import { optOutAll, optOutMarketing } from '@/lib/notifications/preferences';

// Opt out of everything (except security alerts)
await optOutAll('user_123');

// Opt out of marketing only
await optOutMarketing('user_123');
```

## API Routes

### Send Notification (Admin)

```
POST /api/notifications/send
```

Request:
```json
{
  "type": "payment_received",
  "email": "user@example.com",
  "phone": "+1234567890",
  "channel": "all",
  "priority": "high",
  "data": {
    "amount": 500,
    "senderName": "Acme Corp",
    "claimUrl": "https://wellsonyx.io/claim/pay_abc123"
  }
}
```

### Get Preferences

```
GET /api/notifications/preferences?userId=user_123
```

### Update Preferences

```
PUT /api/notifications/preferences
```

Request:
```json
{
  "userId": "user_123",
  "emailEnabled": true,
  "smsEnabled": false,
  "marketingNotifications": false
}
```

### Get Notification History

```
GET /api/notifications/history?userId=user_123&limit=50&offset=0&stats=true
```

Response:
```json
{
  "success": true,
  "notifications": [...],
  "total": 127,
  "limit": 50,
  "offset": 0,
  "stats": {
    "total": 127,
    "sent": 120,
    "delivered": 115,
    "failed": 5,
    "byType": {
      "payment_received": 50,
      "payment_claimed": 30,
      "credit_approved": 20
    }
  }
}
```

## Webhooks

### Twilio SMS Status

Configure in Twilio Console:
- **Status Callback URL**: `https://wellsonyx.io/api/webhooks/notifications`
- **Events**: Delivered, Failed, Undelivered

### Resend Email Status

Configure in Resend Dashboard:
- **Webhook URL**: `https://wellsonyx.io/api/webhooks/notifications`
- **Events**: email.delivered, email.bounced, email.opened, email.clicked

## Rate Limiting

Built-in rate limiting prevents spam:
- **Max**: 10 notifications per type per hour per user
- **Urgent**: Bypass rate limiting (for security alerts)
- **Window**: 1 hour rolling window

## Quiet Hours

Respect user sleep/work preferences:
- Users can set quiet hours (e.g., 22:00 - 08:00)
- Notifications are held during quiet hours (except urgent)
- Timezone-aware

## Analytics

### Daily Aggregation

Run this daily to aggregate stats:

```sql
SELECT aggregate_notification_stats('2025-01-15'::DATE);
```

### View Delivery Rates

```sql
SELECT * FROM v_notification_delivery_rates;
```

### User Preferences Summary

```sql
SELECT * FROM v_user_notification_prefs_summary;
```

## Monitoring

### Key Metrics to Track

1. **Delivery Rate**: % of notifications delivered successfully
2. **Open Rate**: % of emails opened (for emails)
3. **Click Rate**: % of links clicked
4. **Bounce Rate**: % of notifications bounced
5. **Opt-out Rate**: % of users opting out

### Alerts

Set up alerts for:
- Delivery rate drops below 95%
- Bounce rate exceeds 5%
- Failed notifications exceed 100/hour
- Twilio/Resend API errors

## Testing

### Test SMS Notification

```typescript
import { sendSMS } from '@/lib/notifications/twilio';

const result = await sendSMS(
  '+1234567890',
  'Test message from Wells Onyx'
);

console.log(result);
```

### Test Email Notification

```typescript
import { sendEmail } from '@/lib/notifications/resend';

const result = await sendEmail(
  'test@example.com',
  'Test Email',
  '<h1>Hello from Wells Onyx!</h1>'
);

console.log(result);
```

### Test Payment Flow

```bash
# 1. Create viral payment
curl -X POST https://wellsonyx.io/api/viral/pay \
  -H "Content-Type: application/json" \
  -d '{
    "sender_id": "user_sender",
    "recipient_email": "test@example.com",
    "recipient_phone": "+1234567890",
    "amount": 100,
    "memo": "Test payment"
  }'

# 2. Check email/SMS for notification

# 3. Claim payment
curl -X POST https://wellsonyx.io/api/viral/claim/pay_abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'

# 4. Check email/SMS for claim confirmation
```

## Production Checklist

- [ ] Configure Twilio production account
- [ ] Configure Resend production account
- [ ] Set up webhook endpoints
- [ ] Configure DNS for FROM_EMAIL domain
- [ ] Set up SPF/DKIM/DMARC records
- [ ] Run database schema migration
- [ ] Test all notification types
- [ ] Set up monitoring and alerts
- [ ] Configure rate limiting thresholds
- [ ] Test unsubscribe flow
- [ ] Set up daily analytics aggregation (cron)
- [ ] Review email templates for spam filters
- [ ] Test across different email clients
- [ ] Test SMS delivery to different carriers

## Costs

### Twilio (SMS)
- **Per SMS**: $0.0079 (US)
- **Monthly estimate** (10K notifications): ~$79

### Resend (Email)
- **Free tier**: 100 emails/day
- **Pro plan**: $20/month (50K emails)
- **Monthly estimate** (10K notifications): Free or $20

### Total Monthly Cost
- **Low volume** (1K notifications): ~$10
- **Medium volume** (10K notifications): ~$100
- **High volume** (100K notifications): ~$1,000

## Best Practices

### Email
1. **Subject lines**: Clear, urgent, and personal
2. **Preheader text**: Complement the subject line
3. **CTA buttons**: Large, prominent, and actionable
4. **Mobile-first**: 60% of emails are opened on mobile
5. **Personalization**: Use recipient's name and details
6. **Trust signals**: Show sender info, security badges
7. **Urgency**: Expiration dates, limited time offers

### SMS
1. **Brevity**: Keep under 160 characters when possible
2. **Clear CTA**: Short link to claim/action
3. **Branding**: Always include "Wells Onyx" or "- Wells Onyx"
4. **Opt-out**: Include unsubscribe instructions
5. **Timing**: Respect quiet hours (don't send at 3 AM)

### Both
1. **Test everything**: Different devices, carriers, clients
2. **Monitor deliverability**: Track bounces and failures
3. **A/B testing**: Test subject lines, CTAs, timing
4. **Respect preferences**: Honor opt-outs immediately
5. **Compliance**: Follow CAN-SPAM, TCPA, GDPR

## Troubleshooting

### Notifications Not Sending

1. Check environment variables are set
2. Verify Twilio/Resend API keys are valid
3. Check user preferences (may have opted out)
4. Check rate limits (may be exceeded)
5. Check quiet hours settings
6. Review logs for error messages

### Emails Going to Spam

1. Verify SPF/DKIM/DMARC records
2. Warm up sending domain gradually
3. Avoid spam trigger words
4. Include unsubscribe link
5. Monitor sender reputation
6. Use consistent FROM address

### SMS Not Delivering

1. Verify phone number format (+1234567890)
2. Check Twilio account balance
3. Verify phone number is not blocked
4. Check carrier spam filters
5. Ensure message under 160 characters
6. Review Twilio delivery logs

### Webhooks Not Working

1. Verify webhook URL is publicly accessible
2. Check webhook URL in Twilio/Resend dashboard
3. Test webhook endpoint directly
4. Review webhook logs
5. Verify signature validation (if enabled)

## Future Enhancements

- [ ] Push notifications (web push, mobile)
- [ ] In-app notifications
- [ ] Notification center/inbox
- [ ] Real-time delivery via WebSockets
- [ ] Template builder UI
- [ ] A/B testing framework
- [ ] Advanced segmentation
- [ ] Personalization engine
- [ ] Multi-language support
- [ ] WhatsApp notifications
- [ ] Slack notifications

## Support

For issues or questions:
- Documentation: [wellsonyx.io/docs/notifications](https://wellsonyx.io/docs/notifications)
- Support: support@wellsonyx.io
- Slack: #notifications channel

## License

Proprietary - Wells Onyx Inc.
