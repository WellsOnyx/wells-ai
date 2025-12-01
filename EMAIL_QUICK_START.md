# Email Delivery Quick Start

Get up and running with Gmail OAuth + Instantly in 5 minutes.

## 1. Install Dependencies

```bash
npm install
```

This will install:
- `googleapis` - Google API client
- `nodemailer` - Email sending
- `zod` - Validation

## 2. Set Environment Variables

Copy `.env.email.example` to `.env` and fill in:

```bash
# Gmail OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback

# Instantly
INSTANTLY_API_KEY=your_instantly_api_key

# Encryption
ENCRYPTION_MASTER_SECRET=$(openssl rand -hex 32)
```

## 3. Setup Gmail OAuth (5 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project > Enable Gmail API
3. Create OAuth credentials > Copy Client ID & Secret
4. Add to `.env`

**Full guide**: See `EMAIL_SETUP_GUIDE.md`

## 4. Connect Gmail

```bash
npm run dev
```

Visit: http://localhost:3000/settings/email

Click "Connect Gmail" → Authorize → Done!

## 5. Test It

```bash
export TEST_USER_ID=your_user_id
export TEST_EMAIL=your-email@example.com
npm run test:email
```

## Quick Examples

### Send Email (Smart Routing)

```typescript
const res = await fetch('/api/gtm/email/send', {
  method: 'POST',
  body: JSON.stringify({
    to: 'ceo@company.com',
    subject: 'Partnership Opportunity',
    text: 'Hi there...',
    importance: 'critical' // Routes to Gmail automatically
  })
})
```

### Create Instantly Campaign

```typescript
const res = await fetch('/api/instantly/campaign/create', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Q4 Outreach',
    template: 'exec-search'
  })
})
```

## What Wells Does Automatically

1. **Smart Routing**:
   - Critical emails → Gmail (best deliverability)
   - Bulk sequences → Instantly (automation)
   - Transactional → Resend (reliability)

2. **Rate Limiting**:
   - Tracks Gmail's 500/day limit
   - Suggests when to use Instantly instead

3. **Token Management**:
   - Auto-refreshes OAuth tokens
   - Encrypts all credentials
   - Handles expiry gracefully

## Need Help?

- **Full Guide**: `EMAIL_SETUP_GUIDE.md`
- **Test Suite**: `npm run test:email`
- **API Docs**: Check `/api/gtm/email/send`
- **Settings UI**: http://localhost:3000/settings/email

## Production Deployment

```bash
# Add to Vercel environment variables
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://wellsai.vercel.app/api/auth/gmail/callback
INSTANTLY_API_KEY=...
ENCRYPTION_MASTER_SECRET=...

# Deploy
vercel --prod
```

Update Google OAuth redirect URI to production URL.

Done! 🚀
