# User Email Configuration - Implementation Summary

## Overview

Wells AI now supports user-configurable email sending. Users can send emails from their own addresses instead of the default wells@grainandvault.com.

## Features

- **Multiple Email Providers:**
  - Resend (API-based)
  - Custom SMTP (any email server)
  - Gmail OAuth (planned)
  - Outlook OAuth (planned)

- **Security:**
  - All credentials encrypted at rest using AES-256-GCM
  - User-specific encryption keys derived from Clerk user ID
  - Credentials never exposed to client
  - Test before save to prevent invalid configs

- **Fallback:**
  - If user hasn't configured email, falls back to default wells@grainandvault.com
  - If user's config fails, gracefully falls back to default

---

## Database Schema Changes

### New Model: `UserEmailConfig`

```prisma
model UserEmailConfig {
  id              String   @id @default(cuid())
  userId          String   @unique

  // Email Provider
  provider        EmailProvider @default(RESEND)

  // Email Settings
  fromEmail       String
  fromName        String?
  replyTo         String?

  // SMTP Settings (encrypted)
  smtpHost        String?
  smtpPort        Int?
  smtpUsername    String?
  smtpPassword    String?   // Encrypted
  smtpSecure      Boolean   @default(true)

  // Resend Settings
  resendApiKey    String?   // Encrypted

  // OAuth Settings (Future)
  oauthProvider   String?
  oauthToken      String?   // Encrypted
  oauthRefresh    String?   // Encrypted
  oauthExpiry     DateTime?

  // Status & Testing
  isVerified      Boolean   @default(false)
  lastTested      DateTime?
  testStatus      EmailTestStatus?
  testError       String?

  // Metadata
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([userId])
  @@map("user_email_configs")
}

enum EmailProvider {
  RESEND
  SMTP
  GMAIL_OAUTH
  OUTLOOK_OAUTH
}

enum EmailTestStatus {
  SUCCESS
  FAILED
  PENDING
}
```

### Migration

To apply the schema changes:

```bash
# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name add_user_email_config

# Or push directly to database (dev only)
npx prisma db push
```

---

## Files Created/Modified

### Created Files

1. **`lib/email-config.ts`** - Core email configuration utilities
   - Get/save/delete user email configs
   - Create email transporters (SMTP, Resend)
   - Send emails using user configs
   - Validate configurations
   - Test email connections

2. **`app/api/settings/email/route.ts`** - GET user's email config
   - Returns current email settings (without sensitive credentials)
   - Returns `{ configured: false }` if no config

3. **`app/api/settings/email/configure/route.ts`** - POST to save email config
   - Validates configuration
   - Tests connection before saving
   - Encrypts credentials
   - Saves to database

4. **`app/api/settings/email/delete/route.ts`** - DELETE email config
   - Removes user's email configuration
   - Reverts to default

5. **`app/api/settings/email/test/route.ts`** - POST to test email config
   - Sends test email to verify configuration
   - Can test before saving (pass config in body)
   - Can test saved config (no config in body)

### Modified Files

1. **`prisma/schema.prisma`**
   - Added `UserEmailConfig` model
   - Added `EmailProvider` enum
   - Added `EmailTestStatus` enum

2. **`lib/resend-email.ts`**
   - Updated `sendEmail()` to accept optional `userId` parameter
   - If userId provided, uses user's email config
   - Falls back to default if user config fails or doesn't exist

---

## API Endpoints

### GET /api/settings/email

Get user's current email configuration.

**Auth:** Required (Clerk)

**Response:**

```json
{
  "configured": true,
  "provider": "SMTP",
  "fromEmail": "user@company.com",
  "fromName": "John Smith",
  "replyTo": "support@company.com",
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 587,
  "smtpUsername": "user@company.com",
  "smtpSecure": true
}
```

Or if not configured:

```json
{
  "configured": false,
  "message": "No email configuration found"
}
```

---

### POST /api/settings/email/configure

Save email configuration.

**Auth:** Required (Clerk)

**Body (SMTP):**

```json
{
  "provider": "SMTP",
  "fromEmail": "user@company.com",
  "fromName": "John Smith",
  "replyTo": "support@company.com",
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 587,
  "smtpUsername": "user@company.com",
  "smtpPassword": "app-specific-password",
  "smtpSecure": true
}
```

**Body (Resend):**

```json
{
  "provider": "RESEND",
  "fromEmail": "user@verifieddomain.com",
  "fromName": "John Smith",
  "replyTo": "support@company.com",
  "resendApiKey": "re_xxxxxxxxxxxx"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Email configuration saved successfully",
  "provider": "SMTP"
}
```

**Errors:**

- `400` - Invalid configuration or connection test failed
- `401` - Unauthorized
- `500` - Server error

---

### DELETE /api/settings/email/delete

Remove email configuration.

**Auth:** Required (Clerk)

**Response:**

```json
{
  "success": true,
  "message": "Email configuration deleted successfully"
}
```

---

### POST /api/settings/email/test

Test email configuration by sending a test email.

**Auth:** Required (Clerk)

**Body (test saved config):**

```json
{
  "testEmail": "user@example.com"
}
```

**Body (test before saving):**

```json
{
  "testEmail": "user@example.com",
  "config": {
    "provider": "SMTP",
    "fromEmail": "user@company.com",
    "fromName": "John Smith",
    "smtpHost": "smtp.gmail.com",
    "smtpPort": 587,
    "smtpUsername": "user@company.com",
    "smtpPassword": "app-specific-password",
    "smtpSecure": true
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Test email sent successfully",
  "details": {
    "messageId": "abc123"
  }
}
```

---

## How Email Routing Works

### Email Flow Diagram

```
User calls sendEmail()
        |
        v
Has userId parameter?
        |
   Yes  |  No
        |
        v
Get user's email config
        |
        v
Config exists?
        |
   Yes  |  No
        |
        v
Send via user config (SMTP/Resend/OAuth)
        |
        v
   Success? -------No------->
        |                   |
       Yes                  |
        |                   |
        v                   v
   Return result     Fall back to default
                     (wells@grainandvault.com)
```

### Code Example

```typescript
import { sendEmail } from '@/lib/resend-email'
import { auth } from '@clerk/nextjs/server'

// In an API route
export async function POST(req: NextRequest) {
  const { userId } = await auth()

  // Send email using user's config (if configured)
  const result = await sendEmail({
    to: 'recipient@example.com',
    subject: 'Hello from Wells AI',
    text: 'This email was sent using your email configuration!'
  }, userId) // Pass userId to use their config

  return NextResponse.json(result)
}
```

### Fallback Behavior

1. **User config not found:** Falls back to default wells@grainandvault.com
2. **User config fails:** Logs warning and falls back to default
3. **Default config fails:** Returns error to caller

---

## Security Considerations

### Encryption

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key Derivation:** scrypt (memory-hard, slow KDF)
- **Per-User Keys:** Each user has unique encryption key derived from Clerk user ID + master secret
- **Components:**
  - Random salt (32 bytes)
  - Random IV (16 bytes)
  - Auth tag (16 bytes)
  - Encrypted data

### Key Management

- **Master Secret:** Stored in `ENCRYPTION_MASTER_SECRET` environment variable
- **User Keys:** Derived at runtime using `getUserEncryptionKey(userId)`
- **No Key Storage:** User keys never stored, always derived on-demand

### Access Control

- **Authentication:** All endpoints require Clerk authentication
- **Authorization:** Users can only access their own email configs
- **No Client Exposure:** Credentials never sent to client
- **API Only:** Email sending only from server-side code

### Validation

- **Pre-Save Testing:** SMTP connections and API keys tested before saving
- **Format Validation:** Email addresses validated
- **Error Handling:** Invalid configs rejected before encryption

### Best Practices

1. **Rotate Master Secret:** Periodically rotate `ENCRYPTION_MASTER_SECRET`
2. **Monitor Failed Tests:** Track failed email tests for security alerts
3. **Audit Logs:** Log all email config changes (TODO)
4. **Rate Limiting:** Add rate limiting to prevent abuse (TODO)

---

## Environment Variables Required

```bash
# Existing
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=wells@grainandvault.com
RESEND_ACCOUNT_START_DATE=2024-01-01

# New
ENCRYPTION_MASTER_SECRET=your-32-byte-random-secret-here
```

Generate a secure master secret:

```bash
openssl rand -base64 32
```

---

## Usage Examples

### Configure SMTP (Gmail)

```typescript
const response = await fetch('/api/settings/email/configure', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider: 'SMTP',
    fromEmail: 'user@gmail.com',
    fromName: 'John Smith',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUsername: 'user@gmail.com',
    smtpPassword: 'app-specific-password', // Not your regular password!
    smtpSecure: true
  })
})
```

### Configure Resend

```typescript
const response = await fetch('/api/settings/email/configure', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider: 'RESEND',
    fromEmail: 'noreply@verifieddomain.com',
    fromName: 'My Company',
    resendApiKey: 're_xxxxxxxxxxxx'
  })
})
```

### Send Email with User Config

```typescript
// Server-side only
import { sendEmail } from '@/lib/resend-email'
import { auth } from '@clerk/nextjs/server'

const { userId } = await auth()

const result = await sendEmail({
  to: 'recipient@example.com',
  subject: 'Hello',
  text: 'This is a test email'
}, userId)

if (result.success) {
  console.log('Email sent:', result.messageId)
} else {
  console.error('Failed to send:', result.error)
}
```

### Test Email Before Saving

```typescript
const response = await fetch('/api/settings/email/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    testEmail: 'test@example.com',
    config: {
      provider: 'SMTP',
      fromEmail: 'user@company.com',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpUsername: 'user@gmail.com',
      smtpPassword: 'app-password',
      smtpSecure: true
    }
  })
})
```

---

## Common SMTP Configurations

### Gmail

```json
{
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 587,
  "smtpSecure": true
}
```

**Note:** Requires [App Password](https://support.google.com/accounts/answer/185833?hl=en), not regular Gmail password.

### Outlook/Office 365

```json
{
  "smtpHost": "smtp.office365.com",
  "smtpPort": 587,
  "smtpSecure": true
}
```

### SendGrid SMTP

```json
{
  "smtpHost": "smtp.sendgrid.net",
  "smtpPort": 587,
  "smtpUsername": "apikey",
  "smtpPassword": "SG.xxxxxxxxxxxx",
  "smtpSecure": true
}
```

### AWS SES

```json
{
  "smtpHost": "email-smtp.us-east-1.amazonaws.com",
  "smtpPort": 587,
  "smtpSecure": true
}
```

---

## Testing

### Test Email Configuration

```bash
curl -X POST http://localhost:3000/api/settings/email/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{
    "testEmail": "test@example.com"
  }'
```

### Get Current Configuration

```bash
curl http://localhost:3000/api/settings/email \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

### Delete Configuration

```bash
curl -X DELETE http://localhost:3000/api/settings/email/delete \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

---

## Future Enhancements

1. **OAuth Integration**
   - Gmail OAuth 2.0
   - Outlook OAuth 2.0
   - Automatic token refresh

2. **Advanced Features**
   - Email templates
   - Scheduled sending
   - Email tracking (opens, clicks)
   - Unsubscribe management

3. **UI Components**
   - React components for email config UI
   - Email template builder
   - Send test email from UI

4. **Monitoring**
   - Email delivery analytics
   - Failed send alerts
   - Deliverability scores

5. **Multi-User Support**
   - Team email accounts
   - Shared SMTP configs
   - Role-based permissions

---

## Troubleshooting

### SMTP Connection Failed

**Common causes:**
- Wrong host/port
- Invalid credentials
- 2FA enabled (use app password)
- Firewall blocking port 587
- Less secure apps disabled (Gmail)

**Solutions:**
1. Enable App Passwords (Gmail, Outlook)
2. Check firewall settings
3. Try port 465 with SSL
4. Verify credentials

### Resend API Key Invalid

**Common causes:**
- API key not active
- Wrong API key format
- Domain not verified in Resend

**Solutions:**
1. Verify domain in Resend dashboard
2. Generate new API key
3. Check API key format (starts with `re_`)

### Encryption Error

**Common causes:**
- `ENCRYPTION_MASTER_SECRET` not set
- Master secret changed
- Corrupted encrypted data

**Solutions:**
1. Set `ENCRYPTION_MASTER_SECRET` environment variable
2. If master secret rotated, re-configure all email settings
3. Delete and reconfigure email settings

---

## Security Checklist

- [ ] `ENCRYPTION_MASTER_SECRET` set in production
- [ ] Master secret is 32+ bytes of random data
- [ ] Master secret never committed to git
- [ ] SMTP passwords are app-specific passwords
- [ ] Email endpoints require authentication
- [ ] Credentials never logged
- [ ] Credentials never sent to client
- [ ] Test emails don't contain sensitive data
- [ ] Rate limiting enabled (TODO)
- [ ] Audit logging enabled (TODO)

---

## Support

For issues or questions:
1. Check this documentation
2. Review error logs
3. Test with a simple SMTP provider (Gmail)
4. Contact Wells AI support

---

**Last Updated:** 2025-11-13
**Version:** 1.0.0
