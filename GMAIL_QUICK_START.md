# Gmail Integration - Quick Start Guide

Get Gmail integration running in 5 minutes.

## Prerequisites

- Google Cloud account
- Postgres database (Vercel Postgres recommended)
- Node.js project with Next.js 14+

## Step 1: Google Cloud Setup (5 minutes)

### 1.1 Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Enable Gmail API:
   ```
   Navigation Menu > APIs & Services > Library
   Search "Gmail API" > Enable
   ```

4. Create OAuth Client:
   ```
   Navigation Menu > APIs & Services > Credentials
   Click "Create Credentials" > "OAuth client ID"
   Application type: Web application
   Name: Wells Gmail Integration
   ```

5. Add Redirect URIs:
   ```
   Production: https://your-domain.com/api/inbox/gmail/callback
   Development: http://localhost:3000/api/inbox/gmail/callback
   ```

6. Copy your Client ID and Client Secret

### 1.2 Configure OAuth Consent Screen

```
Navigation Menu > APIs & Services > OAuth consent screen
User Type: External (or Internal for workspace)
App name: Wells
Support email: your-email@domain.com
Scopes: Add Gmail scopes (will be requested automatically)
Test users: Add your email for testing
```

## Step 2: Environment Setup

Add to `.env.local`:

```bash
# Gmail Integration
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123def456
GOOGLE_REDIRECT_URI=http://localhost:3000/api/inbox/gmail/callback

# Optional: For production push notifications
# GOOGLE_PUBSUB_TOPIC=projects/your-project/topics/gmail-notifications
# GOOGLE_PUBSUB_WEBHOOK_TOKEN=your-secret-webhook-token
```

## Step 3: Database Migration

Run the Gmail schema migration:

```bash
# Using psql
psql $DATABASE_URL -f scripts/schema-gmail.sql

# Or using Vercel Postgres CLI
npx vercel env pull .env.local
psql $(grep DATABASE_URL .env.local | cut -d '=' -f2-) -f scripts/schema-gmail.sql
```

This creates 3 tables:
- `gmail_accounts` - User Gmail accounts and tokens
- `gmail_messages` - Message metadata and sync state
- `gmail_sync_log` - Sync operation audit log

## Step 4: Test the Integration

### 4.1 Start Development Server

```bash
npm run dev
```

### 4.2 Test OAuth Flow

Open in browser or use curl:

```bash
# 1. Get auth URL
curl http://localhost:3000/api/inbox/gmail/auth?userId=test-user-123
```

Response:
```json
{
  "success": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

Open the `authUrl` in your browser, authorize the app, and you'll be redirected back.

### 4.3 Check Connected Accounts

```bash
curl http://localhost:3000/api/inbox/gmail/accounts?userId=test-user-123
```

Response:
```json
{
  "success": true,
  "accounts": [
    {
      "id": "uuid-here",
      "email": "you@gmail.com",
      "sync_status": "active",
      "last_sync_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### 4.4 Trigger Sync

```bash
curl -X POST http://localhost:3000/api/inbox/gmail/sync \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user-123"}'
```

Response:
```json
{
  "success": true,
  "synced": 1,
  "failed": 0,
  "total": 1
}
```

### 4.5 Send Test Email

```bash
curl -X POST http://localhost:3000/api/inbox/gmail/send \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "your-account-uuid",
    "action": "send",
    "to": "recipient@example.com",
    "subject": "Test from Wells",
    "bodyText": "Hello from Wells Gmail Integration!"
  }'
```

## Step 5: Frontend Integration

### 5.1 Add Connect Button

```typescript
// components/ConnectGmail.tsx
'use client'

import { useState } from 'react'

export function ConnectGmail({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false)

  const handleConnect = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/inbox/gmail/auth?userId=${userId}`)
      const { authUrl } = await res.json()

      if (authUrl) {
        window.location.href = authUrl
      }
    } catch (error) {
      console.error('Failed to connect Gmail:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
    >
      {loading ? 'Connecting...' : 'Connect Gmail'}
    </button>
  )
}
```

### 5.2 Display Connected Accounts

```typescript
// components/GmailAccounts.tsx
'use client'

import { useEffect, useState } from 'react'

export function GmailAccounts({ userId }: { userId: string }) {
  const [accounts, setAccounts] = useState([])

  useEffect(() => {
    fetch(`/api/inbox/gmail/accounts?userId=${userId}`)
      .then(res => res.json())
      .then(data => setAccounts(data.accounts))
  }, [userId])

  return (
    <div>
      <h2>Connected Gmail Accounts</h2>
      {accounts.map((account: any) => (
        <div key={account.id} className="p-4 border rounded">
          <div className="font-bold">{account.email}</div>
          <div className="text-sm text-gray-600">
            Status: {account.sync_status}
          </div>
          <div className="text-sm text-gray-600">
            Last sync: {new Date(account.last_sync_at).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}
```

### 5.3 Handle OAuth Callback

```typescript
// app/inbox/page.tsx
'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export default function InboxPage() {
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check for OAuth success
    const gmailConnected = searchParams.get('gmail_connected')
    if (gmailConnected) {
      console.log('Gmail connected:', gmailConnected)
      // Show success notification
    }

    // Check for errors
    const error = searchParams.get('error')
    if (error) {
      console.error('Gmail error:', error)
      // Show error notification
    }
  }, [searchParams])

  return (
    <div>
      <h1>Inbox</h1>
      {/* Your inbox UI */}
    </div>
  )
}
```

## Step 6: Verify Everything Works

### Check Database

```sql
-- See connected accounts
SELECT email, sync_status, last_sync_at
FROM gmail_accounts;

-- See synced messages
SELECT COUNT(*) as message_count, account_id
FROM gmail_messages
GROUP BY account_id;

-- Check sync log
SELECT *
FROM gmail_sync_log
ORDER BY created_at DESC
LIMIT 10;
```

### Check Unified Inbox

```sql
-- See all conversations including Gmail
SELECT
  channel,
  contact_email,
  subject,
  last_message_preview,
  unread_count
FROM inbox_conversations
WHERE channel = 'gmail'
ORDER BY last_message_at DESC;
```

## Common Issues

### "Invalid redirect URI"

**Problem**: Google rejects the redirect URI

**Solution**: Ensure the redirect URI in Google Console exactly matches the one in your `.env.local`

```bash
# Development
http://localhost:3000/api/inbox/gmail/callback

# Production (no trailing slash!)
https://your-domain.com/api/inbox/gmail/callback
```

### "Access denied" during OAuth

**Problem**: Gmail API not enabled or app not verified

**Solution**:
1. Enable Gmail API in Google Cloud Console
2. Add your email as a test user in OAuth consent screen
3. For production, submit app for verification

### Sync not working

**Problem**: Messages not appearing in inbox

**Solution**:
1. Check account status:
   ```sql
   SELECT sync_status, error_message FROM gmail_accounts;
   ```

2. Check sync log:
   ```sql
   SELECT * FROM gmail_sync_log WHERE status = 'failed';
   ```

3. Manually trigger sync:
   ```bash
   curl -X POST http://localhost:3000/api/inbox/gmail/sync \
     -H "Content-Type: application/json" \
     -d '{"userId": "your-user-id"}'
   ```

### Token expired errors

**Problem**: Access token expired and refresh failed

**Solution**:
1. Check if refresh token exists:
   ```sql
   SELECT email, refresh_token FROM gmail_accounts;
   ```

2. If refresh token is missing, user must reconnect:
   - Delete account: `DELETE /api/inbox/gmail/accounts?accountId=xxx`
   - Reconnect via OAuth flow

## Next Steps

### Enable Push Notifications (Optional)

For real-time email updates:

1. **Create Pub/Sub Topic**:
   ```bash
   gcloud pubsub topics create gmail-notifications
   ```

2. **Grant Gmail Permission**:
   ```bash
   gcloud pubsub topics add-iam-policy-binding gmail-notifications \
     --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
     --role=roles/pubsub.publisher
   ```

3. **Create Push Subscription**:
   ```bash
   gcloud pubsub subscriptions create gmail-push-sub \
     --topic=gmail-notifications \
     --push-endpoint=https://your-domain.com/api/inbox/gmail/webhook \
     --push-auth-service-account=your-service-account@project.iam.gserviceaccount.com
   ```

4. **Update Environment Variables**:
   ```bash
   GOOGLE_PUBSUB_TOPIC=projects/your-project/topics/gmail-notifications
   GOOGLE_PUBSUB_WEBHOOK_TOKEN=your-random-secret-token
   ```

### Production Checklist

- [ ] OAuth consent screen verified by Google
- [ ] Production redirect URI added
- [ ] Environment variables set in Vercel
- [ ] Database migrations run on production
- [ ] SSL/HTTPS enabled
- [ ] Rate limiting configured
- [ ] Error monitoring (Sentry) set up
- [ ] Webhook endpoint secured with token
- [ ] Data retention policy implemented
- [ ] Backup strategy in place

### Performance Optimization

1. **Enable Incremental Sync**:
   - Already implemented! Uses Gmail History API
   - Syncs only changes since last sync

2. **Background Sync**:
   - Set up cron job to sync every 15 minutes
   - Vercel Cron: Add to `vercel.json`

   ```json
   {
     "crons": [
       {
         "path": "/api/cron/sync-gmail",
         "schedule": "*/15 * * * *"
       }
     ]
   }
   ```

3. **Caching**:
   - Cache labels and account info
   - Use Redis for session data

## Support

Need help?

1. **Check Logs**: Look in `gmail_sync_log` table
2. **Enable Debug**: Set `DEBUG=gmail:*` environment variable
3. **Review Docs**: See [GMAIL_INTEGRATION.md](./GMAIL_INTEGRATION.md)
4. **Test API**: Use provided curl commands
5. **Check Status**: Monitor sync status in database

## Resources

- [Full Documentation](./GMAIL_INTEGRATION.md)
- [Gmail API Docs](https://developers.google.com/gmail/api)
- [OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [Provider Guide](./lib/inbox/providers/README.md)

---

**Ready to go!** Your Gmail integration is now live. Messages will sync automatically and appear in your unified inbox alongside SMS, Slack, and other channels.
