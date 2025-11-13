# Calendar Integration Setup Guide

## Overview

Wells AI now integrates directly with Google Calendar, Microsoft Outlook/365, and Apple Calendar using OAuth 2.0. Users connect their own calendar accounts, and Wells AI provides the integration layer.

**Philosophy**: "We provide the strategy and playbooks, but it's their pipes" - users connect their own calendars via OAuth.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Wells AI Calendar System                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Google     │  │  Microsoft   │  │    Apple     │     │
│  │   Calendar   │  │   Outlook    │  │   Calendar   │     │
│  │   (OAuth)    │  │   (OAuth)    │  │   (OAuth +   │     │
│  │              │  │              │  │   CalDAV)    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                  │
│                  ┌─────────▼─────────┐                       │
│                  │  Unified Calendar  │                       │
│                  │     Service        │                       │
│                  └────────────────────┘                       │
│                            │                                  │
│                  ┌─────────▼─────────┐                       │
│                  │   PostgreSQL DB    │                       │
│                  │  (Encrypted Tokens)│                       │
│                  └────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

## Features

- OAuth 2.0 authentication for all providers
- Encrypted token storage (AES-256-GCM)
- Automatic token refresh
- Unified API across all providers
- Support for:
  - Creating/updating/deleting events
  - Checking availability (free/busy)
  - Multi-calendar support
  - Video conferencing (Google Meet, Microsoft Teams)
  - Recurring events
  - Attendee management

## Setup Instructions

### 1. Google Calendar Integration

#### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Calendar API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

#### Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Configure OAuth consent screen:
   - User Type: External
   - App name: Wells AI
   - User support email: your-email@example.com
   - Scopes: Add `calendar` and `userinfo.email`
   - Test users: Add your email for testing
4. Create OAuth Client ID:
   - Application type: Web application
   - Name: Wells AI Calendar
   - Authorized redirect URIs:
     - Development: `http://localhost:3000/api/calendar/connect/google`
     - Production: `https://your-app.com/api/calendar/connect/google`
5. Copy Client ID and Client Secret

#### Step 3: Add to Environment Variables

```bash
GOOGLE_CALENDAR_CLIENT_ID=1234567890-abc123def456.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=GOCSPX-aBc123DeF456...
GOOGLE_CALENDAR_REDIRECT_URI=https://your-app.com/api/calendar/connect/google
```

### 2. Microsoft Outlook/365 Integration

#### Step 1: Register Application

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" > "App registrations"
3. Click "New registration"
   - Name: Wells AI Calendar
   - Supported account types: Accounts in any organizational directory and personal Microsoft accounts
   - Redirect URI: Web, `https://your-app.com/api/calendar/connect/microsoft`
4. Click "Register"

#### Step 2: Configure API Permissions

1. Go to "API permissions"
2. Click "Add a permission" > "Microsoft Graph"
3. Select "Delegated permissions"
4. Add these permissions:
   - `Calendars.ReadWrite` - Read and write user calendars
   - `User.Read` - Sign in and read user profile
   - `offline_access` - Maintain access to data
5. Click "Grant admin consent" (if you have admin rights)

#### Step 3: Create Client Secret

1. Go to "Certificates & secrets"
2. Click "New client secret"
3. Description: Wells AI Calendar Secret
4. Expires: 24 months (or custom)
5. Copy the secret value (you won't see it again!)

#### Step 4: Add to Environment Variables

```bash
MICROSOFT_CLIENT_ID=12345678-1234-1234-1234-123456789012
MICROSOFT_CLIENT_SECRET=abc~123DeF456GhI789...
MICROSOFT_REDIRECT_URI=https://your-app.com/api/calendar/connect/microsoft
```

### 3. Apple Calendar Integration

Apple Calendar integration uses Sign in with Apple for authentication and CalDAV for calendar operations.

#### Step 1: Create Service ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to "Certificates, Identifiers & Profiles"
3. Click "Identifiers" > "+" button
4. Select "Services IDs" > Continue
5. Register Services ID:
   - Description: Wells AI Calendar
   - Identifier: com.yourcompany.wellsai.calendar
   - Click "Continue" > "Register"

#### Step 2: Configure Sign in with Apple

1. Select your Service ID
2. Enable "Sign in with Apple"
3. Click "Configure"
4. Primary App ID: Select your main app ID
5. Domains and Subdomains: `your-app.com`
6. Return URLs: `https://your-app.com/api/calendar/connect/apple`
7. Click "Save" > "Continue" > "Save"

#### Step 3: Create Private Key

1. Go to "Keys" > "+" button
2. Key Name: Wells AI Calendar Key
3. Enable "Sign in with Apple"
4. Configure: Select your Primary App ID
5. Click "Continue" > "Register"
6. Download the .p8 key file
7. Note the Key ID (e.g., ABC123DEF4)

#### Step 4: Add to Environment Variables

```bash
APPLE_CLIENT_ID=com.yourcompany.wellsai.calendar
APPLE_TEAM_ID=ABC123XYZ9  # Your 10-character Team ID
APPLE_KEY_ID=ABC123DEF4    # From step 3
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----"
APPLE_REDIRECT_URI=https://your-app.com/api/calendar/connect/apple
```

**Note**: For `APPLE_PRIVATE_KEY`, replace newlines with `\n`:
```bash
# Convert .p8 file to environment variable format
cat AuthKey_ABC123DEF4.p8 | awk '{printf "%s\\n", $0}' | pbcopy
```

### 4. Database Setup

Run the calendar schema migration:

```bash
# Using psql
psql $DATABASE_URL < scripts/schema-calendar.sql

# Or using Vercel Postgres
vercel env pull .env.local
psql $(grep DATABASE_URL .env.local | cut -d '=' -f2-) < scripts/schema-calendar.sql
```

This creates the following tables:
- `user_calendar_connections` - OAuth connections
- `calendar_events` - Cached events
- `calendar_sync_log` - Sync operations log
- `calendar_availability_preferences` - User preferences
- `calendar_webhooks` - Webhook subscriptions

### 5. Verify Setup

Check that all environment variables are set:

```bash
# Run verification script
node -e "
const required = [
  'GOOGLE_CALENDAR_CLIENT_ID',
  'GOOGLE_CALENDAR_CLIENT_SECRET',
  'MICROSOFT_CLIENT_ID',
  'MICROSOFT_CLIENT_SECRET',
  'APPLE_CLIENT_ID',
  'APPLE_TEAM_ID',
  'APPLE_KEY_ID',
  'APPLE_PRIVATE_KEY',
  'ENCRYPTION_MASTER_SECRET'
];

const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('❌ Missing environment variables:', missing.join(', '));
  process.exit(1);
} else {
  console.log('✅ All calendar environment variables are configured');
}
"
```

## Usage

### User Flow

1. **Connect Calendar**
   ```typescript
   // Request OAuth authorization
   POST /api/calendar/connect
   {
     "provider": "google", // or "microsoft" or "apple"
     "isPrimary": true
   }

   // Returns authorization URL
   {
     "success": true,
     "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
     "provider": "google"
   }
   ```

2. **OAuth Callback** (automatic)
   - User approves access
   - Provider redirects to `/api/calendar/connect/{provider}`
   - Tokens exchanged and stored (encrypted)
   - User redirected to settings with success message

3. **List Connected Calendars**
   ```typescript
   GET /api/calendar/list

   // Returns
   {
     "success": true,
     "connections": [
       {
         "id": "uuid",
         "provider": "google",
         "email": "user@gmail.com",
         "displayName": "John Doe",
         "isPrimary": true,
         "connected": true
       }
     ]
   }
   ```

4. **Create Event**
   ```typescript
   POST /api/calendar/events
   {
     "title": "Team Meeting",
     "description": "Weekly sync",
     "startTime": "2025-01-20T14:00:00Z",
     "endTime": "2025-01-20T15:00:00Z",
     "attendees": [
       {"email": "john@example.com", "displayName": "John Doe"}
     ],
     "addConference": true,
     "provider": "google" // optional, uses primary if not specified
   }
   ```

5. **Check Availability**
   ```typescript
   POST /api/calendar/availability
   {
     "startDate": "2025-01-20T00:00:00Z",
     "endDate": "2025-01-27T00:00:00Z",
     "durationMinutes": 30
   }

   // Returns free and busy periods across all calendars
   {
     "success": true,
     "availability": {
       "slots": [...],
       "busyPeriods": [...],
       "freePeriods": [...]
     }
   }
   ```

6. **Disconnect Calendar**
   ```typescript
   POST /api/calendar/disconnect
   {
     "provider": "google"
   }
   ```

### AI Assistant Integration

The calendar system integrates with the AI chat tool:

```typescript
// User: "Schedule a meeting with john@example.com tomorrow at 2pm"

// AI uses the calendar tool:
await UnifiedCalendarService.createEvent(userId, {
  title: "Meeting with John",
  startTime: "2025-01-21T14:00:00Z",
  endTime: "2025-01-21T15:00:00Z",
  attendees: [
    { email: "john@example.com", displayName: "John" }
  ],
  addConference: true
});

// AI responds: "I've scheduled a meeting with John tomorrow at 2:00 PM.
// A calendar invite has been sent with a Google Meet link."
```

## Security

### Token Encryption

All OAuth tokens are encrypted before storage using AES-256-GCM:

```typescript
// Encryption flow
User Token → Encrypt with User Key → Store in Database
             (AES-256-GCM)          (encrypted text)

// User Key derivation
User Key = scrypt(userId, ENCRYPTION_MASTER_SECRET)
```

### Key Points

1. **Master Secret**: Set `ENCRYPTION_MASTER_SECRET` in environment
2. **User-Specific Keys**: Each user has unique encryption key derived from their ID
3. **Key Rotation**: Changing master secret requires re-encrypting all tokens
4. **Token Refresh**: Automatic refresh when tokens expire (< 5 minutes remaining)
5. **Token Revocation**: Tokens revoked on disconnect (best effort)

### Best Practices

- Use strong `ENCRYPTION_MASTER_SECRET` (32+ random bytes)
- Rotate keys periodically
- Monitor failed token refreshes
- Log OAuth errors for debugging
- Never log decrypted tokens

## Rate Limits

### Google Calendar API
- **Free Tier**: 1,000,000 queries/day
- **Per User**: 10 queries/second
- **Our Limit**: 8 requests/second/user (buffer)

### Microsoft Graph API
- **Throttling**: Per-app per-user basis
- **Typical**: 2,000-10,000 requests per 10 minutes
- **Our Limit**: 100 requests/minute/user (conservative)

### Apple CalDAV
- **Undocumented**: No official rate limits
- **Conservative**: 10 requests/second/user
- **Recommendation**: Cache aggressively

## Troubleshooting

### Google Calendar Issues

**Error: "redirect_uri_mismatch"**
- Ensure redirect URI in Google Console matches exactly
- Check for trailing slashes
- Verify protocol (http vs https)

**Error: "access_denied"**
- User declined permission
- Check OAuth consent screen configuration
- Verify scopes are correct

**Error: "invalid_grant"**
- Refresh token expired or revoked
- User changed password
- User needs to reconnect calendar

### Microsoft Calendar Issues

**Error: "AADSTS50011: redirect_uri_mismatch"**
- Verify redirect URI in Azure Portal
- Must be exact match (case-sensitive)

**Error: "AADSTS65001: consent_required"**
- Admin consent needed for organization
- Have admin grant permissions
- Or use personal Microsoft account for testing

**Error: "InvalidAuthenticationToken"**
- Token expired, will auto-refresh
- If persists, user needs to reconnect

### Apple Calendar Issues

**Error: "invalid_client"**
- Check Service ID configuration
- Verify Team ID and Key ID
- Ensure private key is correct format

**Error: "CalDAV 401 Unauthorized"**
- App-specific password required (not regular password)
- Generate at appleid.apple.com
- Verify username format (usually full email)

### General Debugging

Enable verbose logging:

```bash
# Add to .env.local
DEBUG=calendar:*
LOG_LEVEL=debug
```

Check database connections:

```sql
-- View user's calendars
SELECT * FROM user_calendar_connections
WHERE user_id = 'user_xxx' AND connected = true;

-- View recent sync logs
SELECT * FROM calendar_sync_log
ORDER BY started_at DESC
LIMIT 10;

-- Check for expired tokens
SELECT email, provider, token_expires_at
FROM user_calendar_connections
WHERE token_expires_at < NOW();
```

## API Reference

See [API Documentation](./docs/API_REFERENCE.md) for complete API reference.

## Support

- **Documentation**: `/docs/CALENDAR_INTEGRATION.md`
- **API Reference**: `/docs/API_REFERENCE.md`
- **Database Schema**: `/scripts/schema-calendar.sql`
- **Source Code**: `/lib/integrations/calendar/`

## Migration from Cal.com

If you're migrating from Cal.com:

1. **Export existing bookings** (if needed)
2. **Update environment variables** (remove Cal.com vars, add OAuth vars)
3. **Run database migration** (creates new tables)
4. **Update user settings** page to show new calendar options
5. **Test OAuth flows** for each provider
6. **Notify users** to reconnect their calendars
7. **Monitor** for OAuth errors and failed refreshes

The old Cal.com integration is removed, but the chat tool interface remains the same for a seamless user experience.

## Production Checklist

- [ ] All OAuth credentials configured
- [ ] Redirect URIs updated for production domain
- [ ] Database schema migrated
- [ ] `ENCRYPTION_MASTER_SECRET` set (strong, unique)
- [ ] OAuth consent screens configured (production-ready)
- [ ] Rate limiting tested
- [ ] Token refresh logic tested
- [ ] Error handling verified
- [ ] Monitoring/logging enabled
- [ ] User documentation updated
- [ ] Privacy policy updated (if needed)
- [ ] Security review completed

## Resources

### Documentation
- [Google Calendar API](https://developers.google.com/calendar/api)
- [Microsoft Graph Calendar](https://learn.microsoft.com/en-us/graph/api/resources/calendar)
- [Apple CalDAV](https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/iCalendarServ/iCalendarServ.pdf)
- [Sign in with Apple](https://developer.apple.com/sign-in-with-apple/)

### OAuth Resources
- [OAuth 2.0 RFC](https://datatracker.ietf.org/doc/html/rfc6749)
- [Google OAuth Playground](https://developers.google.com/oauthplayground/)
- [Microsoft Auth Library](https://learn.microsoft.com/en-us/azure/active-directory/develop/msal-overview)

### Security
- [OWASP OAuth Security Cheatsheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)
- [Token Storage Best Practices](https://oauth.net/2/token-storage/)
