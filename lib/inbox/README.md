# Wells AI Unified Inbox System

**Critical foundation for AI-to-AI communication**

## Overview

The Unified Inbox System enables Wells AI to receive, understand, and respond to messages from any channel (email, SMS, Slack, Discord, Teams, etc.). It's the foundational infrastructure for autonomous AI communication.

## Key Components

### 1. Database Layer (`db.ts`)
All database operations for inbox management:
- `InboundMessages` - Query and store incoming messages
- `OutboundMessages` - Manage responses
- `MessageThreads` - Thread management
- `Contacts` - Relationship tracking
- `AutoResponseRules` - Automation configuration
- `WebhookEvents` - Audit logging

### 2. AI Understanding (`understanding.ts`)
Claude-powered message analysis:
- `understandMessage()` - Analyze intent, urgency, sentiment, entities
- `generateThreadSummary()` - Summarize conversations
- `draftResponse()` - Generate appropriate replies

### 3. Type Definitions (`types.ts`)
TypeScript interfaces for all entities:
- Message types (inbound, outbound, thread)
- Enums (intent, urgency, sentiment, channel)
- Contact and rule types

### 4. Channel Integrations
Send messages via any channel:
- `channels/email.ts` - Resend email sending
- `channels/sms.ts` - Twilio SMS sending
- `integrations/slack.ts` - Slack message handling
- `integrations/discord.ts` - Discord message handling

## Quick Start

```typescript
// 1. Store an inbound message
import { InboundMessages } from '@/lib/inbox/db'

const message = await InboundMessages.create({
  userId: 'user123',
  channel: 'email',
  senderEmail: 'john@example.com',
  senderName: 'John Doe',
  subject: 'Question',
  body: 'Can you help me with...',
  isThreadStart: true,
  urgency: 'normal',
  requiresResponse: false
})

// 2. Analyze with AI
import { understandMessage } from '@/lib/inbox/understanding'

const understanding = await understandMessage({
  body: message.body,
  subject: message.subject,
  senderName: message.senderName,
  senderEmail: message.senderEmail,
  channel: message.channel
})

// 3. Update message with AI insights
await InboundMessages.markProcessed(message.id, {
  intent: understanding.intent,
  urgency: understanding.urgency,
  sentiment: understanding.sentiment,
  entities: understanding.entities,
  actionItems: understanding.actionItems,
  requiresResponse: understanding.requiresResponse,
  suggestedResponse: understanding.suggestedResponse
})

// 4. Send a response
import { OutboundMessages } from '@/lib/inbox/db'
import { sendEmail } from '@/lib/inbox/channels/email'

const response = await OutboundMessages.create({
  userId: 'user123',
  inReplyTo: message.id,
  channel: 'email',
  recipientEmail: message.senderEmail,
  subject: `Re: ${message.subject}`,
  body: understanding.suggestedResponse,
  status: 'approved'
})

await sendEmail({
  to: message.senderEmail!,
  subject: response.subject!,
  text: response.body
})

await OutboundMessages.markSent(response.id, 'platform-msg-id')
```

## Architecture

```
Incoming Message
       ↓
Webhook Handler (/api/inbox/webhooks/*)
       ↓
Store in Database (InboundMessages.create)
       ↓
Claude Analysis (understandMessage) [async]
       ↓
Update with AI Insights (markProcessed)
       ↓
Available via API (/api/inbox)
       ↓
User/Automation Responds (/api/inbox/[id]/respond)
       ↓
Send via Channel (email/sms/slack/discord)
       ↓
Mark as Responded (markResponded)
```

## Supported Channels

- ✅ **Email** (Resend)
- ✅ **SMS** (Twilio)
- ✅ **Slack** (via Events API)
- ✅ **Discord** (via webhooks)
- 🔜 **Teams** (Microsoft Graph API)
- 🔜 **WhatsApp** (Twilio)
- 🔜 **Telegram** (Bot API)

## Message Understanding

Claude analyzes every message to extract:

- **Intent** (12 types: ask_question, request_meeting, negotiate, etc.)
- **Urgency** (critical, high, normal, low)
- **Sentiment** (positive, neutral, negative)
- **Entities** (names, companies, dates, amounts, locations)
- **Action Items** (tasks, deadlines, questions, decisions)
- **Response Requirement** (boolean)
- **Suggested Response** (AI-drafted reply)

## Threading & Context

Messages are automatically threaded:
- **Email**: Via In-Reply-To headers
- **SMS**: By phone number pair
- **Slack**: By thread timestamp
- **Discord**: By channel

Full conversation context provided to Claude for understanding.

## Auto-Response System

Configure rules for automated responses:

```typescript
import { AutoResponseRules } from '@/lib/inbox/db'

await AutoResponseRules.create({
  userId: 'user123',
  name: 'Auto-respond to meeting requests',
  enabled: true,
  priority: 100,
  intentFilter: 'request_meeting',
  urgencyFilter: 'high',
  actionType: 'auto_respond',
  responseTemplate: 'Thanks for reaching out! I\'ll check my calendar and get back to you within 2 hours.',
  requireApproval: true,
  cooldownHours: 24
})
```

## Contact Management

Automatically builds relationship database:
- First/last contact dates
- Communication frequency
- Average response time
- Preferred channel
- Importance scoring
- AI-generated insights

## Security

- ✅ Webhook signature verification (all channels)
- ✅ User isolation in all queries
- ✅ Complete audit trail
- ✅ SQL injection prevention
- ✅ Rate limiting support

## Documentation

- **Setup Guide**: `/INBOX_SYSTEM_SETUP.md` - Complete deployment instructions
- **Example Flow**: `/INBOX_EXAMPLE_WALKTHROUGH.md` - Detailed email-to-response example
- **Implementation Summary**: `/INBOX_SYSTEM_SUMMARY.md` - Technical details
- **Quick Reference**: `/INBOX_QUICK_REFERENCE.md` - Common operations

## API Reference

### Database Operations

```typescript
// InboundMessages
await InboundMessages.create(message)
await InboundMessages.findById(id)
await InboundMessages.findByUser(userId, filters)
await InboundMessages.findByThread(threadId)
await InboundMessages.markProcessed(id, understanding)
await InboundMessages.markResponded(id, responseId)
await InboundMessages.getUnprocessedCount(userId)

// MessageThreads
await MessageThreads.create(thread)
await MessageThreads.findById(id)
await MessageThreads.findByPlatformThreadId(userId, channel, platformId)
await MessageThreads.findByUser(userId, status)
await MessageThreads.updateSummary(id, summary)

// OutboundMessages
await OutboundMessages.create(message)
await OutboundMessages.findPendingApproval(userId)
await OutboundMessages.approve(id, approvedBy)
await OutboundMessages.markSent(id, platformId, response)

// Contacts
await Contacts.findOrCreate({userId, email, phone, name})
await Contacts.updateRelationship(id, updates)
```

### AI Operations

```typescript
// Understanding
const result = await understandMessage({
  body: string,
  subject?: string,
  senderName?: string,
  senderEmail?: string,
  channel: string,
  threadContext?: string[]
})

// Thread Summary
const summary = await generateThreadSummary(messages)

// Response Drafting
const response = await draftResponse({
  incomingMessage: string,
  intent: MessageIntent,
  senderName?: string,
  threadContext?: string[],
  userContext?: string
})
```

### Channel Operations

```typescript
// Email
await sendEmail({
  to: string,
  subject: string,
  text: string,
  html?: string,
  inReplyTo?: string
})

// SMS
await sendSMS({
  to: string,
  body: string,
  mediaUrl?: string[]
})
```

## Error Handling

All operations return typed results:

```typescript
// Database operations throw on error
try {
  const message = await InboundMessages.findById(id)
} catch (error) {
  console.error('Database error:', error)
}

// Channel operations return success/error
const result = await sendEmail({...})
if (result.success) {
  console.log('Sent:', result.platformMessageId)
} else {
  console.error('Failed:', result.error)
}
```

## Testing

```typescript
// Mock webhook payload
const mockPayload = {
  from: { email: 'test@example.com' },
  to: [{ email: 'you@inbox.wellsai.com' }],
  subject: 'Test',
  text: 'This is a test'
}

// Test understanding
const understanding = await understandMessage({
  body: 'Can we meet tomorrow?',
  channel: 'email'
})
expect(understanding.intent).toBe('request_meeting')
expect(understanding.requiresResponse).toBe(true)
```

## Performance

- Database queries use indexes on user_id, created_at, channel, etc.
- AI analysis runs asynchronously (doesn't block webhook response)
- Thread context limited to last 5 messages
- Full-text search enabled on message body

## Monitoring

Key metrics to track:
- Messages received per channel
- Processing lag (time to analyze)
- Response rate and time
- Failed webhooks
- AI understanding accuracy

See `INBOX_QUICK_REFERENCE.md` for monitoring queries.

## Future Enhancements

- [ ] Vector embeddings for semantic search
- [ ] Multi-language support
- [ ] Sentiment trend analysis
- [ ] Conversation scoring
- [ ] Smart routing based on intent
- [ ] A/B testing for response templates
- [ ] Integration with CRM systems
- [ ] Voice message transcription
- [ ] Image/document OCR and understanding

## Support

For questions or issues:
1. Check the documentation files
2. Review webhook event logs in database
3. Verify environment variables
4. Test with sample payloads locally
