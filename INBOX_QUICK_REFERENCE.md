# Inbox System - Quick Reference

## Quick Start

```bash
# 1. Run database migration
psql $DATABASE_URL -f scripts/schema-inbox.sql

# 2. Set environment variables
export RESEND_API_KEY=re_xxx
export RESEND_WEBHOOK_SECRET=whsec_xxx
export TWILIO_ACCOUNT_SID=ACxxx
export TWILIO_AUTH_TOKEN=xxx
export ANTHROPIC_API_KEY=sk-ant-xxx

# 3. Deploy
vercel --prod

# 4. Configure webhooks
# Resend: https://your-app.com/api/inbox/webhooks/email
# Twilio: https://your-app.com/api/inbox/webhooks/sms
```

## Common Operations

### List Unread Messages
```bash
curl -X GET "https://your-app.com/api/inbox?unprocessedOnly=true" \
  -H "x-user-id: your-user-id"
```

### Get Messages Needing Response
```bash
curl -X GET "https://your-app.com/api/inbox?requiresResponse=true&urgency=high" \
  -H "x-user-id: your-user-id"
```

### Get Specific Message with Context
```bash
curl -X GET "https://your-app.com/api/inbox/{messageId}" \
  -H "x-user-id: your-user-id"
```

### Send AI-Drafted Response
```bash
curl -X POST "https://your-app.com/api/inbox/{messageId}/respond" \
  -H "x-user-id: your-user-id" \
  -H "Content-Type: application/json" \
  -d '{"requireApproval": false}'
```

### Send Custom Response
```bash
curl -X POST "https://your-app.com/api/inbox/{messageId}/respond" \
  -H "x-user-id: your-user-id" \
  -H "Content-Type: application/json" \
  -d '{
    "responseBody": "Thanks for your message!",
    "requireApproval": false
  }'
```

## Database Queries

### Unprocessed Messages
```sql
SELECT * FROM inbound_messages
WHERE user_id = 'your-user-id'
  AND processed_at IS NULL
ORDER BY created_at DESC;
```

### High Priority Requiring Response
```sql
SELECT * FROM messages_requiring_response
WHERE user_id = 'your-user-id'
  AND urgency IN ('high', 'critical')
ORDER BY created_at ASC;
```

### Today's Activity by Channel
```sql
SELECT
  channel,
  COUNT(*) as message_count,
  COUNT(*) FILTER (WHERE requires_response = true) as needs_response
FROM inbound_messages
WHERE user_id = 'your-user-id'
  AND created_at >= CURRENT_DATE
GROUP BY channel;
```

### Response Rate
```sql
SELECT
  COUNT(*) FILTER (WHERE responded_at IS NOT NULL) as responded,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE responded_at IS NOT NULL) / COUNT(*), 1) as rate_percent
FROM inbound_messages
WHERE user_id = 'your-user-id'
  AND requires_response = true
  AND created_at >= CURRENT_DATE - INTERVAL '7 days';
```

### Average Response Time
```sql
SELECT
  ROUND(AVG(EXTRACT(EPOCH FROM (responded_at - created_at)) / 3600)::numeric, 2) as avg_hours
FROM inbound_messages
WHERE user_id = 'your-user-id'
  AND responded_at IS NOT NULL
  AND created_at >= CURRENT_DATE - INTERVAL '30 days';
```

### Top Contacts
```sql
SELECT
  name, email, company,
  total_messages_received,
  importance_score,
  last_contact_date
FROM contacts
WHERE user_id = 'your-user-id'
ORDER BY importance_score DESC, total_messages_received DESC
LIMIT 20;
```

### Active Threads
```sql
SELECT
  id, subject, channel,
  message_count,
  last_message_at
FROM message_threads
WHERE user_id = 'your-user-id'
  AND status = 'active'
ORDER BY last_message_at DESC
LIMIT 20;
```

## Code Examples

### Analyze a Message
```typescript
import { understandMessage } from '@/lib/inbox/understanding'

const understanding = await understandMessage({
  body: 'Can we schedule a call?',
  subject: 'Quick sync',
  senderName: 'John',
  senderEmail: 'john@example.com',
  channel: 'email'
})

console.log(understanding)
// {
//   intent: 'request_meeting',
//   urgency: 'normal',
//   sentiment: 'neutral',
//   requiresResponse: true,
//   suggestedResponse: '...'
// }
```

### Store a Message
```typescript
import { InboundMessages } from '@/lib/inbox/db'

const message = await InboundMessages.create({
  userId: 'user123',
  channel: 'email',
  senderEmail: 'john@example.com',
  senderName: 'John Doe',
  subject: 'Quick sync',
  body: 'Can we schedule a call?',
  isThreadStart: true,
  urgency: 'normal',
  requiresResponse: false
})
```

### Send a Response
```typescript
import { OutboundMessages } from '@/lib/inbox/db'
import { sendEmail } from '@/lib/inbox/channels/email'

// Create outbound message
const outbound = await OutboundMessages.create({
  userId: 'user123',
  inReplyTo: 'original-message-id',
  channel: 'email',
  recipientEmail: 'john@example.com',
  subject: 'Re: Quick sync',
  body: 'Sure! How about Tuesday at 2pm?',
  status: 'approved'
})

// Send via email
const result = await sendEmail({
  to: 'john@example.com',
  subject: 'Re: Quick sync',
  text: 'Sure! How about Tuesday at 2pm?'
})

// Mark as sent
if (result.success) {
  await OutboundMessages.markSent(outbound.id, result.platformMessageId!)
}
```

### Create Auto-Response Rule
```typescript
import { AutoResponseRules } from '@/lib/inbox/db'

await AutoResponseRules.create({
  userId: 'user123',
  name: 'Out of office auto-reply',
  enabled: true,
  priority: 100,
  intentFilter: 'auto_reply',
  actionType: 'ignore', // Don't respond to auto-replies
  requireApproval: false,
  cooldownHours: 168
})
```

### Find or Create Contact
```typescript
import { Contacts } from '@/lib/inbox/db'

const contact = await Contacts.findOrCreate({
  userId: 'user123',
  email: 'john@example.com',
  name: 'John Doe',
  channel: 'email'
})

// Update relationship
await Contacts.updateRelationship(contact.id, {
  relationshipType: 'customer',
  importanceScore: 85,
  relationshipNotes: 'VP of Engineering, interested in procurement'
})
```

## Webhook Testing

### Test Email Webhook Locally
```bash
# Install ngrok for local testing
ngrok http 3000

# Update Resend webhook to ngrok URL
# https://abc123.ngrok.io/api/inbox/webhooks/email

# Send test email and watch logs
npm run dev
```

### Test SMS Webhook
```bash
# Update Twilio webhook to ngrok URL
# https://abc123.ngrok.io/api/inbox/webhooks/sms

# Send SMS to your Twilio number
# Watch webhook logs
```

### Simulate Webhook Locally
```typescript
// Test webhook handler without external service
const testPayload = {
  type: 'email.received',
  data: {
    from: { email: 'test@example.com', name: 'Test User' },
    to: [{ email: 'you@inbox.wellsai.com' }],
    subject: 'Test',
    text: 'This is a test'
  }
}

const response = await fetch('http://localhost:3000/api/inbox/webhooks/email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testPayload)
})
```

## Environment Variables

### Required
```bash
ANTHROPIC_API_KEY=sk-ant-xxx          # Claude API
DATABASE_URL=postgresql://...         # Postgres
```

### Email (Resend)
```bash
RESEND_API_KEY=re_xxx
RESEND_WEBHOOK_SECRET=whsec_xxx
RESEND_FROM_EMAIL=wells@inbox.wellsai.com
```

### SMS (Twilio)
```bash
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+15551234567
```

### Optional
```bash
SLACK_BOT_TOKEN=xoxb-xxx              # For Slack integration
DISCORD_BOT_TOKEN=xxx                 # For Discord integration
```

## Message Intent Types

- `ask_question` - Asking a question
- `request_meeting` - Schedule request
- `provide_info` - Sharing information
- `negotiate` - Negotiating deal
- `follow_up` - Following up
- `introduction` - First contact
- `thank_you` - Gratitude
- `complaint` - Problem/issue
- `urgent_request` - Time-sensitive
- `auto_reply` - Out-of-office
- `spam` - Unsolicited
- `unknown` - Unclear

## Urgency Levels

- `critical` - Immediate (system down, emergency)
- `high` - Hours (important question, meeting request)
- `normal` - 1-2 days (general inquiry)
- `low` - No rush (FYI, casual)

## Monitoring Commands

### Webhook Health
```sql
-- Recent webhook activity
SELECT
  source,
  event_type,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE processed = true) as processed,
  COUNT(*) FILTER (WHERE error_message IS NOT NULL) as errors
FROM webhook_events
WHERE created_at >= NOW() - INTERVAL '1 hour'
GROUP BY source, event_type;
```

### Processing Lag
```sql
-- Messages waiting for AI analysis
SELECT COUNT(*)
FROM inbound_messages
WHERE processed_at IS NULL
  AND created_at < NOW() - INTERVAL '5 minutes';
```

### Failed Webhooks
```sql
-- Webhooks that failed processing
SELECT *
FROM webhook_events
WHERE error_message IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;
```

## Troubleshooting

### Webhook not receiving messages
1. Check webhook URL is correct in provider dashboard
2. Verify signature secret is set in env vars
3. Check webhook event logs: `SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 10`
4. Test webhook locally with ngrok

### Messages not being analyzed
1. Check ANTHROPIC_API_KEY is set
2. Look for errors in webhook_events: `SELECT * FROM webhook_events WHERE error_message IS NOT NULL`
3. Check Claude API quota/limits
4. Review server logs for async errors

### Responses not sending
1. Verify channel credentials (Resend, Twilio)
2. Check outbound_messages status: `SELECT status, error_message FROM outbound_messages WHERE status = 'failed'`
3. Test channel send functions independently

### Threads not grouping correctly
1. Email: Check In-Reply-To headers are present
2. SMS: Verify phone numbers are normalized
3. Review thread_id values in inbound_messages

## Performance Tips

1. **Index Usage**: Queries on `user_id`, `created_at`, `urgency`, `requires_response` are indexed
2. **Async Processing**: AI analysis happens async, doesn't block webhook response
3. **Caching**: Consider caching contact lookups
4. **Batch Updates**: Use batch operations for bulk message updates
5. **Materialized Views**: Refresh `daily_metrics` view periodically

## Security Checklist

- ✅ Webhook signatures verified
- ✅ User isolation enforced in queries
- ✅ SQL injection prevented (parameterized queries)
- ✅ Rate limiting on webhook endpoints
- ✅ Complete audit trail in webhook_events
- ✅ No sensitive data in logs
- ✅ HTTPS required for all webhooks

## Support

For detailed documentation:
- `/INBOX_SYSTEM_SETUP.md` - Complete setup guide
- `/INBOX_EXAMPLE_WALKTHROUGH.md` - Full example flow
- `/INBOX_SYSTEM_SUMMARY.md` - Implementation details

For issues:
1. Check webhook event logs
2. Review database for messages
3. Verify environment variables
4. Test webhooks with sample payloads
