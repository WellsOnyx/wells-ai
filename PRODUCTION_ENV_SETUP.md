# Production Environment Variables Setup

## Complete List of Environment Variables for Vercel Production

This document contains ALL environment variables needed for Wells AI production deployment.

---

## Critical Production Variables

### 1. Authentication (Clerk - Required)

```bash
# Get from: https://dashboard.clerk.com
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
# Enter: pk_live_...

vercel env add CLERK_SECRET_KEY production
# Enter: sk_live_...

vercel env add NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL production
# Enter: /app

vercel env add NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL production
# Enter: /app

vercel env add NEXT_PUBLIC_CLERK_SIGN_IN_URL production
# Enter: /sign-in

vercel env add NEXT_PUBLIC_CLERK_SIGN_UP_URL production
# Enter: /sign-up
```

---

### 2. AI & Web Search (Required)

```bash
# Anthropic Claude API
vercel env add ANTHROPIC_API_KEY production
# Enter: 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

# Brave Search API (for web search tool)
vercel env add BRAVE_SEARCH_API_KEY production
# Enter: BSA4hWtee7UznsAe7uV5ie3Xid4HlSn
```

---

### 3. Database (Required)

```bash
# Postgres Database
vercel env add DATABASE_URL production
# Enter: postgresql://placeholder:placeholder@placeholder:5432/placeholder

# Wells Memory Database (Prisma Accelerate)
vercel env add wellsmemory_DATABASE_URL production
# Enter: postgres://b288371bbbbb29cd267aa0ade8770d4ac1243b8a7cb697ffc39601fe023830ef:sk_Jd7l0MLiqHCr2Lu3Q9psH@db.prisma.io:5432/postgres?sslmode=require

vercel env add wellsmemory_POSTGRES_URL production
# Enter: postgres://b288371bbbbb29cd267aa0ade8770d4ac1243b8a7cb697ffc39601fe023830ef:sk_Jd7l0MLiqHCr2Lu3Q9psH@db.prisma.io:5432/postgres?sslmode=require

vercel env add wellsmemory_PRISMA_DATABASE_URL production
# Enter: prisma+postgres://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RfaWQiOjEsInNlY3VyZV9rZXkiOiJza19KZDdsME1MaXFIQ3IyTHUzUTlwc0giLCJhcGlfa2V5IjoiMDFLOTU0QlRWVEgyQTZRNEY3MVE1OVFNQUQiLCJ0ZW5hbnRfaWQiOiJiMjg4MzcxYmJiYmIyOWNkMjY3YWEwYWRlODc3MGQ0YWMxMjQzYjhhN2NiNjk3ZmZjMzk2MDFmZTAyMzgzMGVmIiwiaW50ZXJuYWxfc2VjcmV0IjoiMTcxMDk5NzEtMGJjMy00ZjJjLThhMzEtZjU4ZjIzYjgwZDRmIn0.OW4_VzgYFVbJdBEBzO75w3grR6MXq6ui2RnLp0Zqa8w
```

---

### 4. File Storage (Vercel Blob - Required)

```bash
# Vercel Blob Storage for document uploads
vercel env add BLOB_READ_WRITE_TOKEN production
# Enter: vercel_blob_rw_BYuRNiYIZF8mI0UN_WgSv4PcEC8JzE98bgzHEdD5BrTFA6s
```

---

### 5. Email Services (Required)

```bash
# Resend Email Service
vercel env add RESEND_API_KEY production
# Enter: re_8aeymUmE_9Wc651vr3fDjwnuLYtcSJjpR

vercel env add RESEND_FROM_EMAIL production
# Enter: wells@wellsonyx.com

vercel env add RESEND_ACCOUNT_START_DATE production
# Enter: 2024-11-01

vercel env add RESEND_WEBHOOK_SECRET production
# Enter: PLACEHOLDER_GET_FROM_RESEND_WEBHOOKS

# Email Configuration Encryption
vercel env add ENCRYPTION_MASTER_SECRET production
# Enter: iMUwa5DQjfxSuHyiydjJHj9iFcnUKphskYAvghoZKw4=
```

---

### 6. Calendar Integration (Required)

```bash
# Calendar Encryption Key
vercel env add CALENDAR_ENCRYPTION_KEY production
# Enter: 176b79d8fddcc18de8f69bec1cc33328800299e1437fec65f2e37fbed4316b51

# Google Calendar OAuth
vercel env add GOOGLE_CALENDAR_CLIENT_ID production
# Enter: 676649645644-cfg88sveispgtpacj8bvfblv4i2uaifj.apps.googleusercontent.com

vercel env add GOOGLE_CALENDAR_CLIENT_SECRET production
# Enter: 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

# IMPORTANT: Update redirect URI for production!
vercel env add GOOGLE_CALENDAR_REDIRECT_URI production
# Enter: https://your-production-domain.vercel.app/api/calendar/connect/google
```

---

### 7. Application URLs (Update for Production!)

```bash
# CRITICAL: Update these with your actual production domain
vercel env add NEXT_PUBLIC_APP_URL production
# Enter: https://wells-ai-github-ready.vercel.app

vercel env add NEXT_PUBLIC_BASE_URL production
# Enter: https://wells-ai-github-ready.vercel.app
```

---

### 8. Payments (Airwallex - Optional)

```bash
vercel env add AIRWALLEX_CLIENT_ID production
# Enter: liGAUBVoRh-YWfE4-XAjUA

vercel env add AIRWALLEX_API_KEY production
# Enter: a13c521800a2d267b469dfa8c1e2c27a00fecf2062679086eaea59d4c22c77f3771934820a756165a8a37bf55191f6ad

vercel env add AIRWALLEX_ACCOUNT_ID production
# Enter: le_ftLSrwDuPDWGbf93on0BFQ

vercel env add AIRWALLEX_API_URL production
# Enter: https://api.airwallex.com
```

---

### 9. SMS (Twilio - Optional)

```bash
vercel env add TWILIO_ACCOUNT_SID production
# Enter: AC7c941e7f376b57f8b818a2f93aca33f7

vercel env add TWILIO_AUTH_TOKEN production
# Enter: 0b33a9203f8cb867304b7410b0299c77

vercel env add TWILIO_PHONE_NUMBER production
# Enter: +18339175812
```

---

### 10. Notion Integration (Optional)

```bash
vercel env add NOTION_REQUESTS_DB production
# Enter: d0ffa8b2cbff42b8a384c52bb6d03eb9

vercel env add NOTION_SUPPLIERS_DB production
# Enter: 2c9751c549794daabeb2a511a00af570
```

---

## Quick Setup Script

Save this as `setup-production-env.sh` and run it:

```bash
#!/bin/bash

# Core Authentication
vercel env add ANTHROPIC_API_KEY production
vercel env add BRAVE_SEARCH_API_KEY production
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add CLERK_SECRET_KEY production

# Database
vercel env add DATABASE_URL production
vercel env add wellsmemory_DATABASE_URL production
vercel env add wellsmemory_POSTGRES_URL production
vercel env add wellsmemory_PRISMA_DATABASE_URL production

# Storage
vercel env add BLOB_READ_WRITE_TOKEN production

# Email
vercel env add RESEND_API_KEY production
vercel env add RESEND_FROM_EMAIL production
vercel env add ENCRYPTION_MASTER_SECRET production

# Calendar
vercel env add CALENDAR_ENCRYPTION_KEY production
vercel env add GOOGLE_CALENDAR_CLIENT_ID production
vercel env add GOOGLE_CALENDAR_CLIENT_SECRET production
vercel env add GOOGLE_CALENDAR_REDIRECT_URI production

# URLs (MUST UPDATE!)
vercel env add NEXT_PUBLIC_APP_URL production
vercel env add NEXT_PUBLIC_BASE_URL production

echo "Environment variables added! Remember to:"
echo "1. Update GOOGLE_CALENDAR_REDIRECT_URI with production domain"
echo "2. Update NEXT_PUBLIC_APP_URL with production domain"
echo "3. Update NEXT_PUBLIC_BASE_URL with production domain"
```

---

## Critical Production Updates Required

### 1. Google Calendar Redirect URI

**Current (Development):**
```
http://localhost:3000/api/calendar/connect/google
```

**Production (MUST UPDATE):**
```
https://wells-ai-github-ready.vercel.app/api/calendar/connect/google
```

**Action Required:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Find your OAuth 2.0 Client ID
3. Add the production redirect URI to "Authorized redirect URIs"
4. Update the environment variable

---

### 2. Application URLs

Update these once you know your production domain:

```bash
NEXT_PUBLIC_APP_URL=https://your-actual-domain.vercel.app
NEXT_PUBLIC_BASE_URL=https://your-actual-domain.vercel.app
```

---

## Security Checklist

- [ ] All API keys are production keys (not test keys)
- [ ] Clerk keys are `pk_live_` and `sk_live_` (not `pk_test_`)
- [ ] ENCRYPTION_MASTER_SECRET is securely stored
- [ ] CALENDAR_ENCRYPTION_KEY is securely stored
- [ ] Google Calendar redirect URI updated in Google Console
- [ ] Production domain updated in all URL variables
- [ ] Resend webhook URL configured: `https://your-domain.vercel.app/api/inbox/webhooks/email`

---

## Optional Services

### Microsoft Graph (Outlook/365)
```bash
vercel env add MICROSOFT_CLIENT_ID production
vercel env add MICROSOFT_CLIENT_SECRET production
vercel env add MICROSOFT_REDIRECT_URI production
```

### Apple Calendar
```bash
vercel env add APPLE_CLIENT_ID production
vercel env add APPLE_TEAM_ID production
vercel env add APPLE_KEY_ID production
vercel env add APPLE_PRIVATE_KEY production
```

### Slack Integration
```bash
vercel env add SLACK_BOT_TOKEN production
vercel env add SLACK_SIGNING_SECRET production
```

---

## Verification Commands

After setting up environment variables:

```bash
# List all production environment variables
vercel env ls production

# Pull production env to local (for testing)
vercel env pull .env.production.local

# Check specific variable
vercel env ls ANTHROPIC_API_KEY production
```

---

## Need to Update Variables?

```bash
# Remove old variable
vercel env rm VARIABLE_NAME production

# Add new variable
vercel env add VARIABLE_NAME production
```

---

## Support

**Issues with environment variables?**
- Check [Vercel Environment Variables Docs](https://vercel.com/docs/environment-variables)
- Ensure no trailing spaces or newlines in values
- Use quotes for values with special characters

**Missing a variable?**
- Review `.env.local` for any custom variables
- Check `.env.example` for reference
- Review API route files for required env vars
