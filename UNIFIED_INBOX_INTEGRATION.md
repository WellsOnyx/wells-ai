# Unified Inbox Integration - SMS & Internal Messaging

Complete implementation of SMS integration via Twilio and Wells AI internal messaging for the unified inbox system.

## Files Created

### 1. SMS Provider - `lib/inbox/providers/sms.ts`
**Core SMS functionality via Twilio**

Features:
- ✅ Send SMS via Twilio
- ✅ Handle inbound SMS webhooks
- ✅ MMS support (images)
- ✅ Conversation threading by phone number
- ✅ Sync to unified inbox
- ✅ Real-time notifications
- ✅ Read receipts and status tracking

Key Functions:
```typescript
sendSMS(accountId, to, body, mediaUrls?) // Send outbound SMS
handleInboundSMS(twilioPayload) // Process webhook
getConversations(accountId) // List SMS threads
getThreadMessages(threadId) // Get messages in thread
syncToUnifiedInbox(smsMessage) // Convert to inbox format
markThreadAsRead(threadId) // Mark as read
```

### 2. SMS Webhook - `app/api/inbox/sms/webhook/route.ts`
**Twilio inbound SMS webhook handler**

- POST: Receives inbound SMS from Twilio
- Validates Twilio signature for security
- Parses TwiML format
- Creates/updates thread in unified inbox
- Triggers notifications
- Returns TwiML response

Webhook URL: `/api/inbox/sms/webhook`

### 3. SMS Send Route - `app/api/inbox/sms/send/route.ts`
**Send outbound SMS**

POST `/api/inbox/sms/send`
```json
{
  "accountId": "string",
  "to": "+14155551234",
  "body": "Message text",
  "mediaUrls": ["https://..."] // Optional MMS
}
```

Features:
- E.164 phone number validation
- Account authorization
- MMS attachment support
- Error handling for Twilio errors

### 4. Wells Internal Messaging - `lib/inbox/providers/wells-internal.ts`
**User-to-user messaging within Wells platform**

Features:
- ✅ Real-time messaging via Pusher/WebSocket
- ✅ AI assistant responses (auto-triggered in 1:1 conversations)
- ✅ Rich messages (deals, proposals, tasks, files)
- ✅ Read receipts
- ✅ Group conversations
- ✅ Participant management
- ✅ Sync to unified inbox

Key Functions:
```typescript
sendMessage(fromUserId, conversationId, content, messageType, metadata)
createConversation(accountId, creatorUserId, participantUserIds, name)
getConversations(userId, options)
getMessages(conversationId, userId, options)
markAsRead(conversationId, userId)
addParticipant(conversationId, userId, addedBy)
subscribeToMessages(userId, callback) // Real-time updates
```

Message Types:
- `text` - Standard text message
- `deal` - Deal-related message
- `proposal` - Proposal message
- `task` - Task assignment
- `file` - File attachment
- `system` - System notification

### 5. Internal Conversations API - `app/api/inbox/internal/conversations/route.ts`
**Manage internal conversations**

GET `/api/inbox/internal/conversations`
- List conversations for a user
- Filter by account, read status
- Pagination support

POST `/api/inbox/internal/conversations`
```json
{
  "accountId": "string",
  "creatorUserId": "string",
  "participantUserIds": ["user1", "user2"],
  "name": "Optional conversation name",
  "metadata": {}
}
```

### 6. Internal Messages API - `app/api/inbox/internal/messages/route.ts`
**Send and retrieve messages**

GET `/api/inbox/internal/messages?conversationId=xxx&userId=xxx`
- Get messages in a conversation
- Pagination and since-timestamp filtering
- Authorization check (participant only)

POST `/api/inbox/internal/messages`
```json
{
  "fromUserId": "string",
  "conversationId": "string",
  "content": "Message text",
  "messageType": "text",
  "metadata": {}
}
```

### 7. Conversation Detail API - `app/api/inbox/internal/[conversationId]/route.ts`
**Single conversation management**

GET `/api/inbox/internal/[conversationId]?userId=xxx`
- Get conversation details
- Participant authorization

PATCH `/api/inbox/internal/[conversationId]`
Actions:
- `mark_read` - Mark as read
- `add_participant` - Add user to conversation
- `update_name` - Change conversation name
- `leave` - Leave conversation

DELETE `/api/inbox/internal/[conversationId]`
- Delete conversation (admin only)

### 8. Real-time Updates - `lib/inbox/realtime.ts`
**WebSocket connections via Pusher**

Features:
- Real-time message delivery
- Typing indicators
- Read receipts
- Thread updates
- User notifications
- Presence detection

Server Functions:
```typescript
publishMessage(provider, threadId, message)
publishThreadUpdate(threadId, update)
publishMessageRead(threadId, messageId, userId)
publishTypingIndicator(threadId, userId, userName, isTyping)
publishNotification(userId, notification)
publishBatch(events)
```

Client Functions:
```typescript
subscribeToThread(threadId, callbacks)
subscribeToUser(userId, callbacks)
sendTypingIndicator(threadId, userId, userName, isTyping)
getPresenceChannel(threadId, userId, userInfo)
```

### 9. AI Triage - `lib/inbox/ai-triage.ts`
**AI-powered message analysis**

Features:
- ✅ Priority assignment (urgent, important, normal, low)
- ✅ Category detection (deals, recruiting, support, newsletter, personal)
- ✅ Message summarization
- ✅ Smart reply suggestions
- ✅ Action item extraction
- ✅ Sentiment analysis
- ✅ Auto-labeling
- ✅ Entity extraction (people, companies, dates, amounts)
- ✅ Urgency detection

Key Functions:
```typescript
triageMessage(message): Promise<TriageResult>
batchTriageMessages(messages): Promise<Map<string, TriageResult>>
getSmartReplySuggestions(message, count): Promise<string[]>
autoLabelMessage(message): Promise<string[]>
detectUrgency(message): Promise<boolean>
extractEntities(message): Promise<{people, companies, dates, amounts, emails, phones}>
```

Triage Result:
```typescript
{
  priority: 'urgent' | 'important' | 'normal' | 'low';
  category: string;
  summary: string;
  suggestedReply?: string;
  actionItems?: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  labels?: string[];
  shouldNotify?: boolean;
  estimatedResponseTime?: string;
}
```

### 10. Unified Inbox Threads API - `app/api/inbox/threads/route.ts`
**List and manage all threads across providers**

GET `/api/inbox/threads`
Query params:
- `accountId` (required)
- `provider` - Filter by provider (email, sms, wells_internal)
- `label` - Filter by label
- `is_read` - Filter by read status
- `priority` - Filter by priority
- `search` - Search in subject and participants
- `starred_only` - Show starred only
- `limit` / `offset` - Pagination

POST `/api/inbox/threads` - Create new thread

PATCH `/api/inbox/threads` - Bulk update threads
```json
{
  "threadIds": ["id1", "id2"],
  "updates": {
    "is_read": true,
    "starred": false,
    "labels": ["important"],
    "archived": false
  }
}
```

DELETE `/api/inbox/threads` - Bulk delete threads

### 11. Thread Detail API - `app/api/inbox/threads/[threadId]/route.ts`
**Single thread with messages**

GET `/api/inbox/threads/[threadId]`
- Get thread with all messages
- Message pagination
- Optional: exclude messages for performance

PATCH `/api/inbox/threads/[threadId]`
- Update thread properties
- Auto-updates all messages when marking as read
- Publishes real-time update

DELETE `/api/inbox/threads/[threadId]`
- Delete thread and all messages
- Cascade deletes to provider-specific tables

### 12. Message Detail API - `app/api/inbox/messages/[messageId]/route.ts`
**Single message operations**

GET `/api/inbox/messages/[messageId]`
- Get message with full details
- Optional: Include AI triage data
- Optional: Include smart reply suggestions

POST `/api/inbox/messages/[messageId]/reply`
- Reply to message (auto-routes to correct provider)
- Supports SMS, internal messaging
- Email coming soon

PATCH `/api/inbox/messages/[messageId]`
- Mark as read/unread
- Star/unstar

DELETE `/api/inbox/messages/[messageId]`
- Delete single message
- Updates thread counts

## Environment Variables Required

```bash
# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_WEBHOOK_URL=https://your-domain.com/api/inbox/sms/webhook

# Pusher (Real-time)
PUSHER_APP_ID=
PUSHER_SECRET=
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=

# Anthropic (AI Triage)
ANTHROPIC_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

## Database Schema Required

### Tables Needed

```sql
-- SMS threads
CREATE TABLE sms_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  last_message_at TIMESTAMP NOT NULL,
  message_count INTEGER DEFAULT 0,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- SMS messages
CREATE TABLE sms_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES sms_threads(id),
  from_phone TEXT NOT NULL,
  to_phone TEXT NOT NULL,
  body TEXT,
  media_urls TEXT[],
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  status TEXT,
  twilio_sid TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Internal conversations
CREATE TABLE internal_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  name TEXT,
  participants JSONB NOT NULL,
  last_message_at TIMESTAMP NOT NULL,
  last_message_preview TEXT,
  message_count INTEGER DEFAULT 0,
  is_group BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Internal messages
CREATE TABLE internal_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES internal_conversations(id),
  from_user_id UUID NOT NULL REFERENCES users(id),
  from_user_name TEXT,
  from_user_avatar TEXT,
  content TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('text', 'deal', 'proposal', 'task', 'file', 'system')),
  metadata JSONB,
  read_by UUID[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Unified inbox threads
CREATE TABLE inbox_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  provider TEXT NOT NULL,
  provider_thread_id TEXT,
  subject TEXT NOT NULL,
  participants JSONB NOT NULL,
  last_message_at TIMESTAMP NOT NULL,
  is_read BOOLEAN DEFAULT false,
  starred BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  message_count INTEGER DEFAULT 0,
  labels TEXT[],
  priority TEXT,
  metadata JSONB,
  snoozed_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Unified inbox messages
CREATE TABLE inbox_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID REFERENCES inbox_threads(id),
  provider TEXT NOT NULL,
  provider_message_id TEXT,
  from_user JSONB NOT NULL,
  to_users JSONB NOT NULL,
  subject TEXT,
  body TEXT,
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT,
  attachments JSONB,
  is_read BOOLEAN DEFAULT false,
  starred BOOLEAN DEFAULT false,
  priority TEXT,
  category TEXT,
  summary TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Message triage data
CREATE TABLE message_triage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES inbox_messages(id),
  priority TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  sentiment TEXT NOT NULL,
  action_items TEXT[],
  suggested_reply TEXT,
  labels TEXT[],
  should_notify BOOLEAN DEFAULT false,
  estimated_response_time TEXT,
  triaged_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sms_threads_account ON sms_threads(account_id);
CREATE INDEX idx_sms_threads_phone ON sms_threads(phone_number);
CREATE INDEX idx_sms_messages_thread ON sms_messages(thread_id);
CREATE INDEX idx_internal_conversations_account ON internal_conversations(account_id);
CREATE INDEX idx_internal_messages_conversation ON internal_messages(conversation_id);
CREATE INDEX idx_inbox_threads_account ON inbox_threads(account_id);
CREATE INDEX idx_inbox_threads_provider ON inbox_threads(provider);
CREATE INDEX idx_inbox_messages_thread ON inbox_messages(thread_id);
CREATE INDEX idx_message_triage_message ON message_triage(message_id);
```

## Usage Examples

### Send SMS
```typescript
import { sendSMS } from '@/lib/inbox/providers/sms';

const message = await sendSMS(
  accountId,
  '+14155551234',
  'Hello from Wells!',
  ['https://example.com/image.jpg'] // Optional MMS
);
```

### Create Internal Conversation
```typescript
import { createConversation } from '@/lib/inbox/providers/wells-internal';

const conversation = await createConversation(
  accountId,
  creatorUserId,
  ['user2', 'user3'],
  'Project Discussion'
);
```

### Subscribe to Real-time Messages
```typescript
import { subscribeToThread } from '@/lib/inbox/realtime';

const unsubscribe = subscribeToThread(threadId, {
  onNewMessage: (data) => {
    console.log('New message:', data.message);
  },
  onTyping: (data) => {
    console.log(`${data.userName} is typing...`);
  }
});

// Later: unsubscribe();
```

### AI Triage Message
```typescript
import { triageMessage } from '@/lib/inbox/ai-triage';

const triage = await triageMessage(message);
console.log('Priority:', triage.priority);
console.log('Category:', triage.category);
console.log('Summary:', triage.summary);
console.log('Suggested reply:', triage.suggestedReply);
```

## Integration Flow

### SMS Inbound Flow
1. User sends SMS to Wells number
2. Twilio forwards to `/api/inbox/sms/webhook`
3. Webhook validates signature
4. `handleInboundSMS()` processes message
5. Creates/updates SMS thread
6. Syncs to unified inbox
7. Triggers AI triage
8. Sends notifications
9. Publishes real-time update
10. Returns TwiML response

### Internal Message Flow
1. User sends message via `sendMessage()`
2. Validates participant access
3. Creates message record
4. Updates conversation metadata
5. Syncs to unified inbox
6. Publishes via Pusher
7. If 1:1 with AI, triggers AI response
8. Recipients receive real-time notification

### Unified Inbox Query Flow
1. Frontend calls `/api/inbox/threads`
2. Filters by provider, labels, read status, etc.
3. Returns threads from all providers
4. Each thread includes preview and metadata
5. Frontend subscribes to real-time updates
6. New messages appear instantly

## Next Steps

1. **Email Integration** - Add email provider (Gmail/SendGrid)
2. **Slack Integration** - Sync Slack DMs to inbox
3. **WhatsApp Integration** - Via Twilio WhatsApp API
4. **Advanced Search** - Full-text search across all messages
5. **Message Templates** - Quick replies and canned responses
6. **Scheduled Messages** - Send later functionality
7. **Conversation Analytics** - Response times, volume metrics
8. **Spam Detection** - AI-powered spam filtering
9. **Auto-responses** - AI-powered auto-replies for common queries
10. **Voice Integration** - Voicemail transcription via Twilio

## API Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/inbox/sms/webhook` | POST | Receive inbound SMS |
| `/api/inbox/sms/send` | POST | Send outbound SMS |
| `/api/inbox/internal/conversations` | GET, POST | List/create conversations |
| `/api/inbox/internal/messages` | GET, POST | Get/send messages |
| `/api/inbox/internal/[conversationId]` | GET, PATCH, DELETE | Manage conversation |
| `/api/inbox/threads` | GET, POST, PATCH, DELETE | Unified inbox threads |
| `/api/inbox/threads/[threadId]` | GET, PATCH, DELETE | Thread detail |
| `/api/inbox/messages/[messageId]` | GET, POST, PATCH, DELETE | Message operations |

---

**Status**: ✅ Complete and ready for deployment

**Dependencies**: Twilio, Pusher, Anthropic Claude, Supabase

**Testing**: Use Twilio test credentials and Pusher sandbox for development
