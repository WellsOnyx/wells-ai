# Unified Inbox System

A comprehensive inbox system that brings together messages from all channels into one unified interface.

## Supported Channels

- **Gmail** - Multiple Gmail accounts per user via OAuth
- **SMS** - Text messages via Twilio or native integration
- **LinkedIn** - LinkedIn messages and InMail
- **X (Twitter)** - Direct messages
- **Instagram** - Instagram DMs (Business accounts)
- **iMessage** - Apple Messages (future)
- **Wells AI** - Internal messaging

## Architecture

### Database Schema

Located in `/scripts/schema-inbox.sql`

**Core Tables:**
- `inbox_accounts` - Connected accounts (Gmail, LinkedIn, X, etc.)
- `inbox_contacts` - Unified contact database
- `inbox_threads` - Conversation threads across all channels
- `inbox_messages` - Individual messages
- `inbox_drafts` - Draft messages
- `inbox_snooze` - Snoozed threads
- `inbox_reminders` - Follow-up reminders
- `inbox_rules` - AI-powered smart filters
- `inbox_sync_log` - Sync status tracking

### Services

#### InboxService (`lib/inbox/inbox-service.ts`)

Core service for managing inbox operations:

```typescript
import { inboxService } from '@/lib/inbox/inbox-service';

// Get threads
const { threads, total, hasMore } = await inboxService.getThreads({
  userId: 'user-123',
  provider: InboxProvider.Gmail,
  isRead: false,
  aiPriority: AIPriority.Urgent,
  limit: 50,
});

// Get single thread with messages
const { thread, messages, contact } = await inboxService.getThread({
  threadId: 'thread-123',
  userId: 'user-123',
});

// Mark as read
await inboxService.markAsRead({
  threadIds: ['thread-1', 'thread-2'],
  userId: 'user-123',
  isRead: true,
});

// Archive threads
await inboxService.archiveThreads({
  threadIds: ['thread-1'],
  userId: 'user-123',
});

// Snooze thread
await inboxService.snoozeThread({
  threadId: 'thread-123',
  userId: 'user-123',
  snoozeUntil: new Date('2025-01-15T09:00:00Z'),
  reason: 'Follow up next week',
});

// Search messages
const { messages, threads, total } = await inboxService.searchMessages({
  userId: 'user-123',
  query: 'proposal deadline',
  provider: InboxProvider.Gmail,
  hasAttachment: true,
});

// AI summary
const summary = await inboxService.getAISummary({
  threadId: 'thread-123',
  userId: 'user-123',
});
// Returns: { summary, priority, category, suggestedAction, entities }

// AI reply suggestion
const reply = await inboxService.suggestReply({
  messageId: 'msg-123',
  userId: 'user-123',
  tone: 'professional',
  length: 'medium',
});
// Returns: { suggestedReply, alternativeReplies }
```

#### InboxSyncService (`lib/inbox/sync-service.ts`)

Handles syncing messages from all providers:

```typescript
import { inboxSyncService } from '@/lib/inbox/sync-service';

// Sync single account
await inboxSyncService.syncAccount('account-123');

// Sync all accounts for a user
await inboxSyncService.syncAllAccounts('user-123');

// Background job to sync all accounts
await inboxSyncService.syncAllAccountsBackground();
```

## API Routes

### GET /api/inbox/threads

List threads with filtering:

```bash
GET /api/inbox/threads?userId=user-123&provider=gmail&isRead=false&aiPriority=urgent&limit=50
```

Response:
```json
{
  "threads": [...],
  "total": 150,
  "hasMore": true
}
```

### PATCH /api/inbox/threads

Bulk update threads:

```bash
PATCH /api/inbox/threads
{
  "userId": "user-123",
  "threadIds": ["thread-1", "thread-2"],
  "action": "markRead"
}
```

Actions: `markRead`, `markUnread`, `star`, `unstar`, `archive`, `trash`, `restore`

## AI Features

### Smart Categorization

Automatically categorizes messages:
- **Deals** - Sales opportunities, proposals, contracts
- **Recruiting** - Candidate communications, interviews
- **Support** - Customer support, help requests
- **Newsletter** - Marketing emails, updates
- **Personal** - Personal communications
- **Marketing** - Promotional content
- **Spam** - Unwanted messages

### Priority Detection

AI assigns priority levels:
- **Urgent** - Requires immediate attention
- **Important** - Should be addressed soon
- **Normal** - Standard priority
- **Low** - Can be addressed later

### Sentiment Analysis

Detects emotional tone:
- **Positive** - Happy, satisfied tone
- **Neutral** - Factual, neutral tone
- **Negative** - Upset, frustrated tone
- **Urgent** - Time-sensitive, pressing

### Entity Extraction

Automatically extracts:
- Dates and deadlines
- Dollar amounts and prices
- People names
- Company names
- Locations
- Phone numbers
- Email addresses

### AI Reply Suggestions

Generate context-aware reply suggestions with customizable tone and length.

## Setup

### 1. Database Migration

```bash
node scripts/migrate-inbox.js
```

### 2. Environment Variables

```bash
# Gmail OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://yourapp.com/api/auth/google/callback

# LinkedIn API
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret

# X (Twitter) API
X_API_KEY=your_api_key
X_API_SECRET=your_api_secret

# Instagram
INSTAGRAM_APP_ID=your_app_id
INSTAGRAM_APP_SECRET=your_app_secret

# SMS (Twilio)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token

# AI
ANTHROPIC_API_KEY=your_anthropic_key

# Database
POSTGRES_URL=your_postgres_connection_string
```

### 3. Connect Accounts

Users can connect accounts via OAuth flows for each provider.

### 4. Schedule Sync Jobs

Set up cron jobs or scheduled tasks to sync messages:

```typescript
// Every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  await inboxSyncService.syncAllAccountsBackground();
});

// Process snooze queue every minute
cron.schedule('* * * * *', async () => {
  await inboxService.processSnoozeQueue();
});
```

## Features

### Thread Management
- Mark as read/unread
- Star/unstar
- Archive
- Move to trash
- Restore from trash
- Apply labels
- Bulk operations

### Snooze
- Snooze threads until a specific time
- Automatic unsnooze when time arrives
- Custom snooze reasons

### Reminders
- Set follow-up reminders
- Automatic reminders for no response
- Custom reminder notes
- Mark reminders as complete

### Smart Filters & Rules

Create rules to automatically process incoming messages:

```typescript
{
  "conditions": {
    "from": ["boss@company.com"],
    "aiPriority": ["urgent", "important"]
  },
  "actions": {
    "star": true,
    "important": true,
    "labels": ["vip"]
  }
}
```

### Full-Text Search

Search across all messages with PostgreSQL full-text search:
- Search in subject and body
- Filter by provider, date, attachments
- Ranked results

## Future Enhancements

- [ ] Real-time sync with webhooks
- [ ] iMessage integration (macOS)
- [ ] WhatsApp Business API
- [ ] Telegram integration
- [ ] Email templates
- [ ] Scheduled send
- [ ] AI-powered auto-reply
- [ ] Team collaboration (shared inbox)
- [ ] Analytics and insights
- [ ] Mobile apps (iOS, Android)

## Performance

- Indexed queries for fast filtering
- Pagination for large result sets
- Incremental sync using provider cursors
- Connection pooling for database
- Caching for frequently accessed data

## Security

- OAuth 2.0 for all provider integrations
- Encrypted token storage
- Per-user data isolation
- Rate limiting on API endpoints
- Audit logging for sensitive operations
