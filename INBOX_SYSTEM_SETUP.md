# Unified Inbox System - Setup Guide

## Overview

The Unified Inbox System is Wells AI's critical foundation for AI-to-AI communication. It receives, stores, understands, and responds to messages from all channels: email, SMS, Slack, Discord, Teams, and more.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Inbound Channels                         │
├─────────────┬──────────┬──────────┬──────────┬─────────────┤
│   Email     │   SMS    │  Slack   │ Discord  │   Teams     │
│  (Resend)   │ (Twilio) │          │          │             │
└──────┬──────┴────┬─────┴────┬─────┴────┬─────┴─────┬───────┘
       │           │          │          │           │
       └───────────┴──────────┴──────────┴───────────┘
                          │
                    ┌─────▼──────┐
                    │  Webhooks  │
                    └─────┬──────┘
                          │
                    ┌─────▼──────────────────┐
                    │  Webhook Verification  │
                    │  & Event Logging       │
                    └─────┬──────────────────┘
                          │
                    ┌─────▼──────────────────┐
                    │  Store in Database     │
                    │  (inbound_messages)    │
                    └─────┬──────────────────┘
                          │
                    ┌─────▼──────────────────┐
                    │  Claude Understanding  │
                    │  - Intent detection    │
                    │  - Urgency analysis    │
                    │  - Entity extraction   │
                    │  - Response drafting   │
                    └─────┬──────────────────┘
                          │
                    ┌─────▼──────────────────┐
                    │  Unified Inbox API     │
                    │  - Query messages      │
                    │  - View threads        │
                    │  - Send responses      │
                    └────────────────────────┘
```

## Database Schema

### Core Tables

1. **inbound_messages** - All received messages
2. **message_threads** - Conversation threads
3. **outbound_messages** - Wells' responses
4. **contacts** - Sender relationship tracking
5. **auto_response_rules** - Automated response configuration
6. **webhook_events** - Audit log of all webhooks

See `scripts/schema-inbox.sql` for complete schema.

## Setup Instructions

### 1. Database Setup

Run the schema migration:

```bash
# Connect to your Postgres database
psql $DATABASE_URL

# Run the schema
\i scripts/schema-inbox.sql
```

### 2. Email Setup (Resend)

**Sign up for Resend:**
1. Go to https://resend.com
2. Create account and verify domain
3. Get API key

**Configure inbound email:**
1. In Resend dashboard, go to "Domains"
2. Add your domain (e.g., `inbox.wellsai.com`)
3. Set up DNS records (MX, TXT)
4. Configure inbound webhook URL: `https://your-domain.com/api/inbox/webhooks/email`
5. Get webhook secret

**Environment variables:**
```bash
RESEND_API_KEY=re_xxx
RESEND_WEBHOOK_SECRET=whsec_xxx
RESEND_FROM_EMAIL=wells@inbox.wellsai.com
```

**Email routing:**
- Route emails to: `user123@inbox.wellsai.com`
- The `user123` part becomes the user ID
- Update `getUserIdFromEmail()` in webhook handler for your user mapping

### 3. SMS Setup (Twilio)

**Get Twilio account:**
1. Sign up at https://twilio.com
2. Buy a phone number
3. Get Account SID and Auth Token

**Configure webhook:**
1. In Twilio console, go to Phone Numbers
2. Select your number
3. Under "Messaging", set webhook URL: `https://your-domain.com/api/inbox/webhooks/sms`
4. Method: POST
5. Save

**Environment variables:**
```bash
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+15551234567
```

### 4. Slack Setup

**Update existing Slack integration:**
1. Your Slack app is already configured
2. Modify `/api/slack/events/route.ts` to call inbox integration:

```typescript
import { handleSlackMessage } from '@/lib/inbox/integrations/slack'

// In handleDirectMessage or handleAppMention:
await handleSlackMessage({
  userId: 'user-id-from-slack',
  event: event,
})
```

### 5. Discord Setup

**Update existing Discord integration:**
1. Modify Discord handlers to store messages:

```typescript
import { handleDiscordMessage } from '@/lib/inbox/integrations/discord'

// When receiving Discord message:
await handleDiscordMessage({
  userId: 'user-id-from-discord',
  message: message,
})
```

### 6. Environment Variables Summary

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-xxx           # For message understanding
DATABASE_URL=postgresql://...          # Postgres connection

# Email (Resend)
RESEND_API_KEY=re_xxx
RESEND_WEBHOOK_SECRET=whsec_xxx
RESEND_FROM_EMAIL=wells@inbox.wellsai.com

# SMS (Twilio)
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+15551234567

# Slack (existing)
SLACK_BOT_TOKEN=xoxb-xxx
SLACK_SIGNING_SECRET=xxx

# Discord (existing)
DISCORD_BOT_TOKEN=xxx
DISCORD_PUBLIC_KEY=xxx

# Application
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

## API Endpoints

### List Messages (Inbox)
```bash
GET /api/inbox?channel=email&requiresResponse=true&limit=50
Headers:
  x-user-id: user123

Response:
{
  "success": true,
  "messages": [...],
  "stats": {
    "unprocessedCount": 5,
    "requiresResponseCount": 3,
    "totalReturned": 50
  }
}
```

### Get Specific Message
```bash
GET /api/inbox/{messageId}
Headers:
  x-user-id: user123

Response:
{
  "success": true,
  "message": {...},
  "thread": {...},
  "threadMessages": [...],
  "contact": {...}
}
```

### Respond to Message
```bash
POST /api/inbox/{messageId}/respond
Headers:
  x-user-id: user123
Body:
{
  "responseBody": "Thanks for reaching out! ...",  # Optional, uses AI if not provided
  "requireApproval": false                          # true = draft, false = send
}

Response:
{
  "success": true,
  "message": "Response sent",
  "outboundMessageId": "uuid",
  "sent": true
}
```

### List Threads
```bash
GET /api/inbox/threads?status=active
Headers:
  x-user-id: user123

Response:
{
  "success": true,
  "threads": [...],
  "count": 10
}
```

## Message Flow Example

### Email Reception Flow

1. **Email arrives** at `user123@inbox.wellsai.com`
2. **Resend webhook** fires to `/api/inbox/webhooks/email`
3. **Webhook handler**:
   - Verifies signature
   - Logs webhook event
   - Extracts email data
   - Finds/creates thread
   - Stores in `inbound_messages`
4. **Claude analyzes** (async):
   - Intent: "request_meeting"
   - Urgency: "high"
   - Sentiment: "positive"
   - Entities: {"dates": ["next Tuesday"], "names": ["John"]}
   - Requires response: true
   - Suggested response: "Thanks John! I'd be happy to meet..."
5. **Message stored** with AI understanding
6. **API consumer** (frontend/automation) can:
   - List unprocessed messages
   - View message with full context
   - Approve/edit suggested response
   - Send response

### SMS Reception Flow

1. **SMS arrives** at Twilio number
2. **Twilio webhook** fires to `/api/inbox/webhooks/sms`
3. **Webhook handler**:
   - Verifies Twilio signature
   - Logs webhook event
   - Finds/creates conversation thread
   - Stores in `inbound_messages`
   - Responds with TwiML acknowledgment
4. **Claude analyzes** (async)
5. **Response can be**:
   - Auto-sent (if auto-response rule matches)
   - Drafted for approval
   - Handled by custom logic

## Message Understanding

Claude analyzes each message to extract:

### Intent Classification
- `ask_question` - Sender asking a question
- `request_meeting` - Wants to schedule
- `provide_info` - Sharing information
- `negotiate` - Negotiating terms
- `follow_up` - Following up
- `introduction` - First contact
- `thank_you` - Gratitude
- `complaint` - Problem/dissatisfaction
- `urgent_request` - Time-sensitive
- `auto_reply` - Out-of-office
- `spam` - Unsolicited

### Urgency Levels
- `critical` - Immediate attention needed
- `high` - Respond within hours
- `normal` - 1-2 days
- `low` - No rush

### Entities Extracted
- Names (people, companies)
- Dates and times
- Monetary amounts
- Locations
- Products/services

### Action Items
- Tasks with priorities
- Deadlines
- Questions to answer
- Decisions needed

## Auto-Response System

Configure automatic responses based on rules:

```typescript
import { AutoResponseRules } from '@/lib/inbox/db'

// Create auto-response rule
await AutoResponseRules.create({
  userId: 'user123',
  name: 'Auto-reply to out-of-office',
  enabled: true,
  priority: 100,
  intentFilter: 'auto_reply',
  actionType: 'auto_respond',
  responseTemplate: 'Thanks for your message. I received your out-of-office reply.',
  requireApproval: false,
  cooldownHours: 168, // Don't send again for 7 days
})
```

## Threading & Context

Messages are automatically threaded:

- **Email**: Uses `In-Reply-To` and `References` headers
- **SMS**: Groups by phone number pair
- **Slack**: Uses thread timestamps
- **Discord**: Uses channel threads

Thread context is provided to Claude for better understanding.

## Contact Management

The system automatically:
- Creates contact records for new senders
- Updates last contact date
- Tracks communication frequency
- Calculates average response time
- Identifies preferred channel
- Stores AI insights about relationship

## Security Considerations

### Webhook Verification
- **Resend**: Svix signature verification
- **Twilio**: SHA1 HMAC signature
- **Slack**: Request signing
- **Discord**: Ed25519 signature

All webhooks are verified before processing.

### Data Protection
- Messages stored encrypted at rest (Postgres)
- Webhook signatures validated
- User isolation enforced
- Audit logs maintained

### Rate Limiting
- Implement rate limits on webhook endpoints
- Prevent spam/abuse
- Use Vercel's built-in DDoS protection

## Monitoring & Debugging

### Webhook Event Logs
All webhooks logged in `webhook_events` table:
```sql
SELECT * FROM webhook_events
WHERE processed = false
ORDER BY created_at DESC;
```

### Failed Processing
```sql
SELECT * FROM webhook_events
WHERE error_message IS NOT NULL
ORDER BY created_at DESC;
```

### Unprocessed Messages
```sql
SELECT * FROM inbound_messages
WHERE processed_at IS NULL
ORDER BY created_at ASC;
```

### Messages Requiring Response
```sql
SELECT * FROM messages_requiring_response
ORDER BY urgency DESC, created_at ASC;
```

## Testing

### Test Email Reception
```bash
# Send test email to your inbox address
# Check webhook logs and database
```

### Test SMS Reception
```bash
# Send SMS to your Twilio number
# Check webhook logs and database
```

### Test Message Understanding
```typescript
import { understandMessage } from '@/lib/inbox/understanding'

const result = await understandMessage({
  body: 'Can we schedule a call for next Tuesday?',
  subject: 'Meeting Request',
  senderName: 'John Doe',
  senderEmail: 'john@example.com',
  channel: 'email',
})

console.log(result)
// {
//   intent: 'request_meeting',
//   urgency: 'high',
//   sentiment: 'positive',
//   entities: { dates: ['next Tuesday'], names: ['John Doe'] },
//   requiresResponse: true,
//   suggestedResponse: '...'
// }
```

## Next Steps

1. **Deploy database schema** to production
2. **Configure Resend domain** and webhooks
3. **Update Twilio webhook** URL
4. **Integrate Slack/Discord** handlers
5. **Build frontend** to display inbox
6. **Implement auto-response** rules
7. **Set up monitoring** and alerts

## AI-to-AI Communication Use Cases

This system enables:

1. **Email automation** - AI receives, understands, and responds to emails
2. **SMS chatbots** - Conversational SMS with context
3. **Multi-channel support** - Unified inbox across all channels
4. **Auto-triage** - Urgent messages flagged automatically
5. **Response drafting** - AI drafts responses for approval
6. **Relationship tracking** - AI remembers all interactions
7. **Intent routing** - Route to appropriate handler based on intent
8. **A2A handoffs** - AI systems can message each other through this inbox

## Support

For issues or questions:
- Check webhook event logs for errors
- Verify environment variables are set
- Test webhook signatures locally
- Review Claude API usage for understanding errors
