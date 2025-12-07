# Inbox Providers

This directory contains provider-specific integrations for the Wells Unified Inbox.

## Current Providers

### Gmail (`gmail.ts`)

Full-featured Gmail integration with:
- OAuth 2.0 authentication
- Multiple accounts per user
- Real-time push notifications
- Incremental sync via History API
- Send/receive/reply
- Labels and threading
- Attachment support

See [GMAIL_INTEGRATION.md](../../../GMAIL_INTEGRATION.md) for complete documentation.

## Adding New Providers

To add a new email provider (Outlook, Yahoo, etc.), create a new file following this pattern:

### 1. Create Provider File

```typescript
// lib/inbox/providers/outlook.ts

import { sql } from '@vercel/postgres'

export interface OutlookAccount {
  id: string
  user_id: string
  email: string
  access_token: string
  refresh_token: string
  expires_at: Date
  // ... provider-specific fields
}

export interface OutlookMessage {
  id: string
  subject: string
  from: string
  to: string
  body: string
  // ... provider-specific fields
}

// OAuth flow
export function getAuthUrl(userId: string): string {
  // Generate OAuth URL
}

export async function handleOAuthCallback(code: string, userId: string): Promise<OutlookAccount> {
  // Exchange code for tokens
  // Save account
  // Trigger initial sync
}

// Token management
export async function refreshAccessToken(accountId: string): Promise<string> {
  // Refresh expired token
}

// Sync
export async function syncMessages(accountId: string, options: any): Promise<any> {
  // Sync messages from provider
  // Save to unified inbox
}

// Send
export async function sendMessage(accountId: string, options: any): Promise<any> {
  // Send via provider API
}

// Other operations...
```

### 2. Create Database Schema

```sql
-- scripts/schema-outlook.sql

CREATE TABLE IF NOT EXISTS outlook_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  -- provider-specific fields
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, email)
);
```

### 3. Create API Routes

```typescript
// app/api/inbox/outlook/auth/route.ts
// app/api/inbox/outlook/callback/route.ts
// app/api/inbox/outlook/sync/route.ts
// app/api/inbox/outlook/send/route.ts
// app/api/inbox/outlook/webhook/route.ts
```

### 4. Update Integration Config

```typescript
// lib/integrations.ts

export const INTEGRATION_CONFIG = {
  // ... existing
  outlook: {
    authType: 'oauth',
    oauthUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    requiredFields: [],
    scopes: ['Mail.Read', 'Mail.Send', 'Mail.ReadWrite'],
    setupInstructions: 'Connect your Microsoft account to send and receive emails.'
  }
}
```

### 5. Update Inbox Channel Type

```typescript
// lib/inbox.ts

export type Channel =
  | 'gmail'
  | 'outlook' // Add new channel
  | 'email'
  // ... existing channels

export const CHANNEL_INFO = {
  // ... existing
  outlook: {
    name: 'Outlook',
    color: '#0078D4',
    icon: '📨'
  }
}
```

## Provider Requirements

All providers must implement:

### Required Functions

1. **Authentication**
   - `getAuthUrl(userId)` - Start OAuth flow
   - `handleOAuthCallback(code, userId)` - Complete OAuth
   - `refreshAccessToken(accountId)` - Refresh expired tokens

2. **Sync**
   - `syncMessages(accountId, options)` - Sync messages
   - `getMessage(accountId, messageId)` - Get single message

3. **Send**
   - `sendMessage(accountId, options)` - Send email
   - `replyToMessage(accountId, threadId, body)` - Reply in thread

4. **Account Management**
   - `getUserAccounts(userId)` - List all accounts
   - `deleteAccount(accountId)` - Remove account

### Optional Functions

- `watchInbox(accountId)` - Set up push notifications
- `createDraft(accountId, options)` - Save draft
- `modifyLabels(accountId, messageId, add, remove)` - Manage labels/folders
- `markAsRead/Unread(accountId, messageId)` - Read status
- `archive/trash/moveToInbox(accountId, messageId)` - Folder operations

### Unified Inbox Integration

All providers must save messages to the unified inbox:

```typescript
import { findOrCreateConversation, addMessage } from '@/lib/inbox'

async function saveToInbox(accountId: string, userId: string, message: ProviderMessage) {
  // Create conversation
  const conversation = await findOrCreateConversation({
    id: `provider:${message.threadId}`,
    name: message.from,
    email: extractEmail(message.from),
    channel: 'provider',
  })

  // Add message
  await addMessage({
    conversation_id: conversation.id,
    content: message.body,
    content_html: message.bodyHtml,
    direction: 'inbound',
    sender_type: 'contact',
    sender_name: message.from,
    channel: 'provider',
    channel_message_id: message.id,
  })
}
```

## Best Practices

1. **Token Management**
   - Always check token expiration before API calls
   - Auto-refresh expired tokens
   - Handle refresh failures gracefully

2. **Error Handling**
   - Log all errors with context
   - Update account status on failures
   - Provide clear error messages to users

3. **Sync Strategy**
   - Use incremental sync when available
   - Implement pagination for large result sets
   - Sync in background, don't block user

4. **Performance**
   - Fetch message details in parallel
   - Cache frequently accessed data
   - Use database indexes

5. **Security**
   - Never expose tokens in API responses
   - Encrypt sensitive data at rest
   - Validate all user inputs
   - Use HTTPS for all API calls

6. **Rate Limiting**
   - Respect provider API limits
   - Implement exponential backoff
   - Queue operations when near limits

## Testing

Test each provider thoroughly:

```typescript
// Example test flow
describe('Outlook Provider', () => {
  it('should complete OAuth flow', async () => {
    const authUrl = getAuthUrl('user123')
    expect(authUrl).toContain('login.microsoftonline.com')

    const account = await handleOAuthCallback('auth-code', 'user123')
    expect(account.email).toBeDefined()
  })

  it('should sync messages', async () => {
    const result = await syncMessages(accountId, { maxResults: 10 })
    expect(result.messages.length).toBeGreaterThan(0)
  })

  it('should send email', async () => {
    const message = await sendMessage(accountId, {
      to: 'test@example.com',
      subject: 'Test',
      body: 'Hello'
    })
    expect(message.id).toBeDefined()
  })
})
```

## Documentation

Each provider should include:
- Setup instructions
- API endpoint documentation
- Example usage
- Environment variables needed
- Rate limits and quotas
- Known limitations

## Provider Comparison

| Feature | Gmail | Outlook | Yahoo | ProtonMail |
|---------|-------|---------|-------|------------|
| OAuth 2.0 | ✅ | ✅ | ✅ | ❌ |
| Push Notifications | ✅ | ✅ | ❌ | ❌ |
| Incremental Sync | ✅ | ✅ | ❌ | ❌ |
| Threading | ✅ | ✅ | ✅ | ✅ |
| Labels/Folders | ✅ | ✅ | ✅ | ✅ |
| Attachments | ✅ | ✅ | ✅ | ✅ |

## Support

For questions or issues:
- Review existing provider implementations
- Check provider API documentation
- Test with provider's sandbox/test accounts
- Monitor sync logs and error messages
