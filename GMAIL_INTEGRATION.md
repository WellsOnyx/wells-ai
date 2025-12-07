# Gmail Integration for Wells Unified Inbox

Complete Gmail integration supporting multiple Gmail accounts per user with OAuth 2.0, real-time sync, and full send/receive capabilities.

## Features

- **Multiple Gmail Accounts**: Users can connect multiple Gmail accounts
- **OAuth 2.0 Authentication**: Secure authentication flow with automatic token refresh
- **Real-time Sync**: Push notifications via Google Cloud Pub/Sub for instant updates
- **Incremental Sync**: Efficient syncing using Gmail History API
- **Send & Reply**: Full email sending and threading support
- **Labels & Organization**: Support for Gmail labels, stars, and folders
- **Attachments**: Handle email attachments
- **Drafts**: Create and manage drafts

## Setup

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Gmail API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Gmail API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `https://yourdomain.com/api/inbox/gmail/callback`
     - `http://localhost:3000/api/inbox/gmail/callback` (for dev)
   - Save Client ID and Client Secret

### 2. Environment Variables

Add these to your `.env.local`:

```bash
# Gmail OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/inbox/gmail/callback

# Optional: For push notifications
GOOGLE_PUBSUB_TOPIC=projects/your-project/topics/gmail-notifications
GOOGLE_PUBSUB_WEBHOOK_TOKEN=your-webhook-secret-token
```

### 3. Database Setup

Run the Gmail schema migration:

```bash
psql $DATABASE_URL -f scripts/schema-gmail.sql
```

This creates the following tables:
- `gmail_accounts` - Store Gmail account credentials and sync state
- `gmail_messages` - Track message metadata and sync state
- `gmail_sync_log` - Audit log for monitoring

### 4. Google Cloud Pub/Sub Setup (Optional - for Real-time)

For real-time push notifications:

1. Create a Pub/Sub topic in Google Cloud Console
2. Create a push subscription pointing to your webhook:
   ```
   https://yourdomain.com/api/inbox/gmail/webhook
   ```
3. Grant `gmail.googleapis.com` permission to publish to your topic

## API Endpoints

### Authentication

#### Start OAuth Flow
```bash
GET /api/inbox/gmail/auth?userId=user123
```

Returns:
```json
{
  "success": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

Frontend should redirect user to `authUrl`.

#### OAuth Callback
```bash
GET /api/inbox/gmail/callback?code=xxx&state=xxx
```

Automatically handled. Redirects back to inbox with success or error.

### Account Management

#### List Gmail Accounts
```bash
GET /api/inbox/gmail/accounts?userId=user123
```

Returns:
```json
{
  "success": true,
  "accounts": [
    {
      "id": "account-uuid",
      "email": "user@gmail.com",
      "sync_status": "active",
      "last_sync_at": "2024-01-15T10:30:00Z",
      "labels": [...]
    }
  ]
}
```

#### Remove Account
```bash
DELETE /api/inbox/gmail/accounts?accountId=account-uuid
```

### Sync

#### Trigger Sync
```bash
POST /api/inbox/gmail/sync
Content-Type: application/json

{
  "accountId": "account-uuid",
  "maxResults": 50,
  "labelIds": ["INBOX"],
  "query": "is:unread"
}
```

Or sync all accounts for a user:
```bash
POST /api/inbox/gmail/sync
Content-Type: application/json

{
  "userId": "user123"
}
```

#### Check Sync Status
```bash
GET /api/inbox/gmail/sync?userId=user123
```

### Sending

#### Send Email
```bash
POST /api/inbox/gmail/send
Content-Type: application/json

{
  "accountId": "account-uuid",
  "action": "send",
  "to": "recipient@example.com",
  "subject": "Hello",
  "bodyText": "Plain text body",
  "bodyHtml": "<p>HTML body</p>",
  "cc": ["cc@example.com"],
  "attachments": [
    {
      "filename": "document.pdf",
      "content": "base64-encoded-content",
      "mimeType": "application/pdf"
    }
  ]
}
```

#### Reply to Thread
```bash
POST /api/inbox/gmail/send
Content-Type: application/json

{
  "accountId": "account-uuid",
  "action": "reply",
  "threadId": "thread-id",
  "bodyText": "Reply text",
  "bodyHtml": "<p>Reply HTML</p>"
}
```

#### Create Draft
```bash
POST /api/inbox/gmail/send
Content-Type: application/json

{
  "accountId": "account-uuid",
  "action": "draft",
  "to": "recipient@example.com",
  "subject": "Draft subject",
  "bodyText": "Draft body"
}
```

### Message Actions

#### Perform Actions
```bash
POST /api/inbox/gmail/actions
Content-Type: application/json

{
  "accountId": "account-uuid",
  "messageId": "message-id",
  "action": "markAsRead"
}
```

Available actions:
- `markAsRead` / `markAsUnread`
- `archive` / `unarchive`
- `trash`
- `star` / `unstar`
- `markImportant` / `markNotImportant`
- `addLabel` / `removeLabel` (requires `labelIds` array)

### Webhook

The webhook endpoint handles push notifications from Gmail:

```bash
POST /api/inbox/gmail/webhook
```

This is called automatically by Google Cloud Pub/Sub when new mail arrives.

## Usage Example

### Frontend Integration

```typescript
// 1. Start OAuth flow
async function connectGmail(userId: string) {
  const response = await fetch(`/api/inbox/gmail/auth?userId=${userId}`)
  const { authUrl } = await response.json()

  // Redirect user to Google
  window.location.href = authUrl
}

// 2. After OAuth callback, user is redirected back
// Check for success/error in URL params
const params = new URLSearchParams(window.location.search)
if (params.get('gmail_connected')) {
  console.log('Connected:', params.get('gmail_connected'))
}

// 3. List connected accounts
async function getGmailAccounts(userId: string) {
  const response = await fetch(`/api/inbox/gmail/accounts?userId=${userId}`)
  const { accounts } = await response.json()
  return accounts
}

// 4. Send an email
async function sendEmail(accountId: string, to: string, subject: string, body: string) {
  const response = await fetch('/api/inbox/gmail/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId,
      action: 'send',
      to,
      subject,
      bodyText: body,
    }),
  })
  return response.json()
}

// 5. Trigger sync
async function syncGmail(userId: string) {
  const response = await fetch('/api/inbox/gmail/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  return response.json()
}
```

## Architecture

### Data Flow

1. **OAuth Flow**:
   - User clicks "Connect Gmail"
   - Frontend calls `/api/inbox/gmail/auth`
   - User redirects to Google OAuth
   - Google redirects back to `/api/inbox/gmail/callback`
   - Backend exchanges code for tokens
   - Account saved to `gmail_accounts` table
   - Initial sync triggered

2. **Incremental Sync**:
   - Gmail tracks a `historyId` for each account
   - On sync, use History API to get only changes since last `historyId`
   - Much faster than fetching all messages
   - Updates `gmail_accounts.history_id` after each sync

3. **Real-time Updates**:
   - Gmail sends push notification to Pub/Sub when mail arrives
   - Pub/Sub calls webhook at `/api/inbox/gmail/webhook`
   - Webhook triggers sync for affected account
   - New messages appear in inbox within seconds

4. **Unified Inbox**:
   - Gmail messages saved to `inbox_conversations` and `inbox_messages`
   - Unified with messages from other channels (SMS, Slack, etc.)
   - Single interface to view all communications

### Token Management

- Access tokens expire after ~1 hour
- Refresh tokens never expire (unless revoked)
- Before each API call, check if token expired
- Auto-refresh using refresh token
- Update `gmail_accounts.access_token` and `expires_at`

### Error Handling

- Network errors: Retry with exponential backoff
- Token errors: Auto-refresh and retry
- Rate limits: Respect Gmail API quotas
- Sync errors: Log to `gmail_sync_log` for debugging

## Security

- **Tokens**: Access and refresh tokens stored encrypted in database
- **Scopes**: Request only necessary Gmail scopes
- **Webhook**: Verify Pub/Sub requests using token
- **Rate Limiting**: Implement per-user rate limits
- **Data Privacy**: Messages stored securely, comply with data retention policies

## Monitoring

### Sync Status

Check sync health:
```bash
SELECT
  email,
  sync_status,
  last_sync_at,
  error_message,
  watch_expiration
FROM gmail_accounts
WHERE user_id = 'user123'
```

### Sync Log

View sync history:
```bash
SELECT
  a.email,
  l.sync_type,
  l.messages_synced,
  l.status,
  l.error_message,
  l.created_at
FROM gmail_sync_log l
JOIN gmail_accounts a ON l.account_id = a.id
WHERE a.user_id = 'user123'
ORDER BY l.created_at DESC
LIMIT 20
```

## Troubleshooting

### Sync not working

1. Check account status:
   ```sql
   SELECT * FROM gmail_accounts WHERE user_id = 'user123'
   ```

2. Look for errors in sync log:
   ```sql
   SELECT * FROM gmail_sync_log WHERE status = 'failed' ORDER BY created_at DESC
   ```

3. Manually trigger sync:
   ```bash
   POST /api/inbox/gmail/sync
   {"userId": "user123"}
   ```

### Token expired errors

- Tokens auto-refresh, but if refresh token is invalid, user must reconnect
- Delete account and have user reconnect via OAuth

### Push notifications not working

1. Verify Pub/Sub topic exists and has correct permissions
2. Check webhook endpoint is publicly accessible
3. Verify `GOOGLE_PUBSUB_WEBHOOK_TOKEN` matches subscription
4. Watch expiration: Gmail watches expire after 7 days
   - Watches are auto-renewed on each sync
   - Set up a daily cron to renew watches

### Rate Limits

Gmail API has quotas:
- 1 billion quota units per day
- 250 quota units per user per second

To avoid:
- Use incremental sync (History API uses fewer units)
- Implement caching
- Batch operations where possible

## Advanced Features

### Search

Search emails using Gmail query syntax:
```typescript
await syncMessages(accountId, {
  query: 'from:sender@example.com subject:important',
  maxResults: 100
})
```

### Labels

Create custom labels:
```typescript
const gmail = await getGmailClient(accountId)
await gmail.users.labels.create({
  userId: 'me',
  requestBody: {
    name: 'Wells/Leads',
    labelListVisibility: 'labelShow',
    messageListVisibility: 'show'
  }
})
```

### Batch Operations

Process multiple messages:
```typescript
const messageIds = ['msg1', 'msg2', 'msg3']
await Promise.all(
  messageIds.map(id => markAsRead(accountId, id))
)
```

## Performance Optimization

1. **Incremental Sync**: Always use History API when possible
2. **Parallel Fetching**: Fetch message details in parallel
3. **Caching**: Cache labels and account info
4. **Selective Sync**: Only sync INBOX by default, other labels on demand
5. **Background Processing**: Run heavy sync operations in background

## Compliance

- **GDPR**: Users can delete their Gmail accounts and all data
- **Data Retention**: Implement automatic cleanup of old messages
- **Export**: Provide data export functionality
- **Audit Trail**: All sync operations logged in `gmail_sync_log`

## Future Enhancements

- [ ] AI-powered email categorization
- [ ] Smart reply suggestions
- [ ] Email templates
- [ ] Scheduled sending
- [ ] Read receipts
- [ ] Email tracking
- [ ] Bulk operations UI
- [ ] Advanced search filters
- [ ] Custom label management UI
- [ ] Email analytics dashboard

## Support

For issues or questions:
- Check logs in `gmail_sync_log` table
- Review error messages in `gmail_accounts.error_message`
- Enable debug logging in production
- Contact support with account ID and timestamp

## References

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [Gmail Push Notifications](https://developers.google.com/gmail/api/guides/push)
- [Gmail History API](https://developers.google.com/gmail/api/guides/sync)
