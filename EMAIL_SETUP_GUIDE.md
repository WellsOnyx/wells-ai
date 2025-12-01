# Wells AI Email Delivery Setup Guide

Complete setup guide for Gmail OAuth + Instantly API integration.

## Overview

Wells AI now supports intelligent email routing across multiple providers:

- **Gmail OAuth**: Best for 1:1 high-value outreach (500 emails/day limit)
- **Instantly**: Perfect for automated sequences with 3-7 follow-ups
- **Resend**: Reliable transactional email delivery
- **SMTP**: Custom email server support

## Environment Variables

Add these to your `.env` file:

```bash
# Gmail OAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://wellsai.vercel.app/api/auth/gmail/callback

# Instantly API
INSTANTLY_API_KEY=your_instantly_api_key

# Encryption (for secure credential storage)
ENCRYPTION_MASTER_SECRET=your_random_32_char_secret

# Existing email providers (keep these)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=wells@grainandvault.com
```

## 1. Gmail OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **Gmail API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

### Step 2: Create OAuth Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Configure OAuth consent screen (if not done):
   - User Type: External
   - App name: "Wells AI"
   - Support email: your email
   - Scopes: Add Gmail send scopes
4. Create OAuth Client ID:
   - Application type: Web application
   - Name: "Wells AI Gmail Integration"
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/gmail/callback` (development)
     - `https://wellsai.vercel.app/api/auth/gmail/callback` (production)
5. Copy **Client ID** and **Client Secret**

### Step 3: Add to Environment

```bash
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123def456
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback
```

### Step 4: Connect Gmail in Wells

1. Visit `/settings/email` in Wells
2. Click "Connect Gmail"
3. Authorize the app
4. You'll be redirected back with a success message

## 2. Instantly API Setup

### Step 1: Get API Key

1. Log in to [Instantly.ai](https://instantly.ai)
2. Go to Settings > API
3. Generate API key
4. Copy the key

### Step 2: Add to Environment

```bash
INSTANTLY_API_KEY=inst_abc123def456xyz789
```

### Step 3: Test Connection

Run the test script:

```bash
npm run test:email
```

## 3. Database Schema

The email configuration is stored in the `UserEmailConfig` table. Make sure your Prisma schema includes:

```prisma
model UserEmailConfig {
  id              String   @id @default(cuid())
  userId          String   @unique
  provider        String   // GMAIL_OAUTH, RESEND, SMTP, INSTANTLY
  fromEmail       String
  fromName        String?
  replyTo         String?

  // SMTP fields
  smtpHost        String?
  smtpPort        Int?
  smtpUsername    String?
  smtpPassword    String?  // Encrypted
  smtpSecure      Boolean?

  // Resend fields
  resendApiKey    String?  // Encrypted

  // OAuth fields
  oauthProvider   String?
  oauthToken      String?  // Encrypted
  oauthRefresh    String?  // Encrypted
  oauthExpiry     DateTime?

  // Testing
  isVerified      Boolean  @default(false)
  lastTested      DateTime?
  testStatus      String?
  testError       String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

Run migration if needed:

```bash
npx prisma migrate dev --name add_email_config
npx prisma generate
```

## 4. Testing the Integration

### Run Test Suite

```bash
# Set test parameters
export TEST_USER_ID=user_123
export TEST_EMAIL=your-email@example.com

# Run tests
npx tsx scripts/test-email-delivery.ts
```

### Manual Testing

#### Test Gmail Send

```typescript
import { sendGmailEmail } from '@/lib/email/gmail'

const result = await sendGmailEmail('user_123', {
  to: 'recipient@example.com',
  subject: 'Test Email',
  text: 'This is a test',
  html: '<p>This is a test</p>'
})

console.log(result)
```

#### Test Instantly Campaign

```typescript
import { createInstantlyCampaign } from '@/lib/email/instantly'

const result = await createInstantlyCampaign({
  name: 'Test Campaign',
  fromEmail: 'you@example.com',
  sequence: [
    {
      subject: 'Hi {{firstName}}',
      body: 'Email 1 content',
      delayInDays: 0
    },
    {
      subject: 'Following up',
      body: 'Email 2 content',
      delayInDays: 3
    }
  ]
})

console.log(result)
```

#### Test Smart Routing

```typescript
import { sendEmailSmart } from '@/lib/email/router'

const result = await sendEmailSmart(
  {
    userId: 'user_123',
    importance: 'critical',
    volume: 1
  },
  {
    to: 'recipient@example.com',
    subject: 'Important Email',
    text: 'This is important'
  }
)

console.log(`Sent via: ${result.provider}`)
console.log(`Reason: ${result.routing.reason}`)
```

## 5. API Endpoints

### Gmail OAuth

- `GET /api/auth/gmail/authorize` - Start OAuth flow
- `GET /api/auth/gmail/callback` - OAuth callback handler

### Email Sending

- `POST /api/gtm/email/send` - Send email with smart routing
  ```json
  {
    "to": "recipient@example.com",
    "subject": "Email subject",
    "text": "Plain text",
    "html": "<p>HTML content</p>",
    "importance": "critical",
    "isSequence": false
  }
  ```

### Instantly Campaigns

- `POST /api/instantly/campaign/create` - Create campaign
  ```json
  {
    "name": "My Campaign",
    "template": "exec-search",
    "fromEmail": "you@example.com"
  }
  ```

- `POST /api/instantly/campaign/prospects` - Add prospects
  ```json
  {
    "campaignId": "camp_123",
    "prospects": [
      {
        "email": "prospect@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "companyName": "Acme Corp"
      }
    ]
  }
  ```

### Email Settings

- `GET /api/settings/email` - Get email configuration
- `POST /api/settings/email/configure` - Save email config
- `POST /api/settings/email/test` - Send test email
- `DELETE /api/settings/email/delete` - Disconnect provider

## 6. Wells AI Usage Examples

### High-Value Executive Outreach (Gmail)

```typescript
// Wells automatically routes to Gmail for critical emails
const result = await fetch('/api/gtm/email/send', {
  method: 'POST',
  body: JSON.stringify({
    to: 'ceo@fortune500.com',
    subject: 'Partnership Opportunity',
    text: 'Personalized message...',
    importance: 'critical',
    requiresPersonalization: true
  })
})

// Response includes Wells AI suggestion:
// "I'll send this via your Gmail for maximum deliverability..."
```

### Automated Follow-up Sequence (Instantly)

```typescript
// Create campaign with template
const campaign = await fetch('/api/instantly/campaign/create', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Q4 Exec Search Campaign',
    template: 'exec-search',
    fromEmail: 'jonah@wellsonyx.com'
  })
})

// Add prospects
await fetch('/api/instantly/campaign/prospects', {
  method: 'POST',
  body: JSON.stringify({
    campaignId: campaign.campaignId,
    prospects: [
      {
        email: 'hiring@company.com',
        firstName: 'Sarah',
        companyName: 'TechCorp',
        jobTitle: 'VP of Engineering',
        customVariables: {
          role_type: 'CTO',
          hiring_signal: 'hiring for senior roles'
        }
      }
    ]
  })
})
```

## 7. Rate Limits & Best Practices

### Gmail
- **Limit**: 500 emails/day (free), 2000/day (Google Workspace)
- **Best for**: 1:1 high-value outreach
- **Tip**: Wells tracks your daily limit automatically

### Instantly
- **Limit**: Based on your plan (typically 5000-50000/month)
- **Best for**: Automated sequences, bulk campaigns
- **Tip**: Use daily sending limits (50-100/day recommended)

### Smart Routing Strategy

Wells AI automatically:
1. Uses Gmail for first 10-50 high-value contacts
2. Routes bulk sequences to Instantly
3. Falls back to Resend for transactional emails
4. Respects all rate limits

## 8. Troubleshooting

### Gmail OAuth Issues

**Error: "Invalid grant"**
- Token expired - reconnect Gmail in settings
- Solution: Visit `/settings/email` and reconnect

**Error: "Insufficient permission"**
- Missing Gmail API scopes
- Solution: Revoke access in Google Account settings, reconnect

### Instantly Issues

**Error: "Invalid API key"**
- Check INSTANTLY_API_KEY in .env
- Regenerate key in Instantly dashboard

**Error: "Campaign not found"**
- Campaign may have been deleted
- Check campaign ID is correct

### Rate Limit Exceeded

**Gmail**: "Daily sending quota exceeded"
- Wait until midnight (user's timezone)
- Or use Instantly for remaining emails

**Instantly**: "Monthly limit reached"
- Upgrade plan or wait for month reset
- Use Gmail as fallback

## 9. Security Notes

### Credential Storage
- All tokens encrypted at rest using AES-256-GCM
- User-specific encryption keys (derived from Clerk user ID)
- Tokens never logged or exposed to client
- Automatic token refresh for OAuth

### Best Practices
- Never commit `.env` files
- Rotate API keys regularly
- Use least-privilege OAuth scopes
- Enable 2FA on all accounts
- Monitor for unusual sending patterns

## 10. Production Deployment

### Vercel Setup

1. Add environment variables in Vercel dashboard
2. Deploy to production
3. Update Google OAuth redirect URIs to production URL
4. Test OAuth flow in production

### Required Environment Variables

```bash
# Production URLs
NEXT_PUBLIC_APP_URL=https://wellsai.vercel.app
GOOGLE_REDIRECT_URI=https://wellsai.vercel.app/api/auth/gmail/callback

# All other variables same as development
```

### Post-Deployment Checklist

- [ ] Gmail OAuth working
- [ ] Instantly campaigns creating successfully
- [ ] Test email sending via all providers
- [ ] Rate limiting working correctly
- [ ] Error notifications configured
- [ ] Monitoring dashboards set up

## Support

For issues or questions:
- Check logs: `vercel logs` or Prisma logs
- Run test suite: `npm run test:email`
- Review API responses for error details
- Contact Wells AI team
