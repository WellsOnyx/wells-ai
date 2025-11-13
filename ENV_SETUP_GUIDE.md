# Environment Variables Setup Guide

## ✅ Already Generated

I've already added these to your `.env.local` file:

- ✅ `ENCRYPTION_MASTER_SECRET` - Generated securely
- ✅ `CALENDAR_ENCRYPTION_KEY` - Generated securely

## 🔑 API Keys You Need to Get

### 1. Brave Search API (Web Search)
**Priority:** High
**Cost:** Free tier (2,000 queries/month)

1. Go to https://brave.com/search/api/
2. Sign up or sign in
3. Get your API key (starts with `BSA...`)
4. Add to `.env.local`:
   ```bash
   BRAVE_SEARCH_API_KEY=BSA1234567890abcdef...
   ```

### 2. Vercel Blob Storage (File Storage)
**Priority:** High
**Cost:** Free tier (100GB)

1. Go to https://vercel.com/dashboard/stores
2. Click "Create Database" → "Blob"
3. Create store named `wells-ai`
4. Copy the `BLOB_READ_WRITE_TOKEN`
5. Add to `.env.local`:
   ```bash
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_XXXXXXXXXXXXXXXX
   ```

### 3. Cal.com API (Calendar)
**Priority:** Medium
**Cost:** Free tier

1. Go to https://app.cal.com/settings/developer/api-keys
2. Create new API key
3. Copy the key (starts with `cal_live_...`)
4. Add to `.env.local`:
   ```bash
   CALCOM_API_KEY=cal_live_your_key_here
   ```

**Optional:** Get your default event type ID:
1. Go to https://app.cal.com/event-types
2. Click on an event type
3. Look at URL: `/event-types/123456` - that's your ID
4. Add to `.env.local`:
   ```bash
   CALCOM_EVENT_TYPE_ID=123456
   ```

### 4. Resend Webhook Secret (Inbound Email)
**Priority:** Medium (if using inbox system)
**Cost:** Free (already using Resend)

1. Go to https://resend.com/webhooks
2. Create new webhook
3. Set URL to: `https://your-app.vercel.app/api/inbox/webhooks/email`
4. Copy the webhook secret (starts with `whsec_...`)
5. Add to `.env.local`:
   ```bash
   RESEND_WEBHOOK_SECRET=whsec_xxx
   ```

### 5. Resend API Key (if not already set)
**Priority:** High (for email sending)
**Cost:** Free tier (3,000 emails/month)

1. Go to https://resend.com/api-keys
2. Create API key
3. Copy the key (starts with `re_...`)
4. Add to `.env.local`:
   ```bash
   RESEND_API_KEY=re_xxx
   ```

## 📝 Current Status of .env.local

Check your `.env.local` file. I've added all the new variables with placeholders:

```bash
# NEW WELLS AI CAPABILITIES (Nov 2025)
BRAVE_SEARCH_API_KEY=PLACEHOLDER_GET_FROM_BRAVE
BLOB_READ_WRITE_TOKEN=PLACEHOLDER_GET_FROM_VERCEL_STORES
ENCRYPTION_MASTER_SECRET=iMUwa5DQjfxSuHyiydjJHj9iFcnUKphskYAvghoZKw4= ✅
RESEND_WEBHOOK_SECRET=PLACEHOLDER_GET_FROM_RESEND_WEBHOOKS
RESEND_API_KEY=PLACEHOLDER_GET_FROM_RESEND_API_KEYS
RESEND_ACCOUNT_START_DATE=2024-11-01
CALCOM_API_KEY=PLACEHOLDER_GET_FROM_CALCOM
CALCOM_API_URL=https://api.cal.com/v1
CALCOM_EVENT_TYPE_ID=PLACEHOLDER_OPTIONAL
CALENDAR_ENCRYPTION_KEY=176b79d8fddcc18de8f69bec1cc33328800299e1437fec65f2e37fbed4316b51 ✅
```

## 🚀 Quick Setup (5 Minutes)

### Minimum to get started:

```bash
# 1. Web Search (2 min)
#    Go to: https://brave.com/search/api/
#    Copy key, replace PLACEHOLDER in .env.local

# 2. Blob Storage (2 min)
#    Go to: https://vercel.com/dashboard/stores
#    Create Blob, copy token, replace PLACEHOLDER in .env.local

# 3. Done! These two enable:
#    - Web search capability
#    - Persistent file storage
#    - Document uploads
#    - Document creation
```

### Add later (optional):

```bash
# Calendar (2 min) - enables meeting scheduling
# Go to: https://app.cal.com/settings/developer/api-keys

# Resend Webhook (2 min) - enables inbox system
# Go to: https://resend.com/webhooks
```

## 🔒 Security Notes

### Keep These Secret (Already Generated)
- ✅ `ENCRYPTION_MASTER_SECRET` - DO NOT CHANGE (will break user email configs)
- ✅ `CALENDAR_ENCRYPTION_KEY` - DO NOT CHANGE (will break calendar connections)

### Safe to Get from Services
- `BRAVE_SEARCH_API_KEY` - Get from Brave dashboard
- `BLOB_READ_WRITE_TOKEN` - Get from Vercel dashboard
- `CALCOM_API_KEY` - Get from Cal.com settings
- `RESEND_WEBHOOK_SECRET` - Get from Resend webhooks
- `RESEND_API_KEY` - Get from Resend API keys

## 📋 Verification Checklist

After adding keys, verify they work:

### 1. Check Brave Search
```bash
curl https://wellsai.vercel.app/api/test-search
# Should return search results
```

### 2. Check Blob Storage
```bash
# Upload a test document via chat
# "Create a one-pager for our services"
# Should return a download link
```

### 3. Check Calendar
```bash
# Navigate to /settings/calendar
# Should show connection UI
```

### 4. Check Inbox
```bash
# Send email to your inbox address
# Check database for new message
```

## 🎯 Production Deployment

When deploying to Vercel production:

```bash
# Set each variable in Vercel dashboard
vercel env add BRAVE_SEARCH_API_KEY production
vercel env add BLOB_READ_WRITE_TOKEN production
vercel env add ENCRYPTION_MASTER_SECRET production
vercel env add CALENDAR_ENCRYPTION_KEY production
vercel env add CALCOM_API_KEY production
vercel env add RESEND_WEBHOOK_SECRET production

# Deploy
vercel --prod
```

**IMPORTANT:** Use the SAME encryption keys in production that you generated in development, or user data will be inaccessible!

## ❓ Troubleshooting

### "Invalid API key" errors
- Double-check you copied the full key
- Make sure no extra spaces or newlines
- Verify the key is active in the service dashboard

### "Encryption failed" errors
- Check `ENCRYPTION_MASTER_SECRET` is set
- Verify it's base64 encoded
- Don't change it after users have configured emails

### "Blob upload failed"
- Verify `BLOB_READ_WRITE_TOKEN` is correct
- Check Vercel Blob dashboard for quota
- Ensure token has read/write permissions

### "Calendar connection failed"
- Verify Cal.com API key is valid
- Check you're using the right API key (not a test key)
- Ensure `CALENDAR_ENCRYPTION_KEY` is set

## 📞 Support

If you need help:
1. Check the service status pages
2. Verify API keys are active
3. Check Vercel logs for errors
4. Review service dashboards for quota limits

---

**Next Steps:**
1. Get the 5 API keys from services (5-10 minutes total)
2. Replace PLACEHOLDERs in `.env.local`
3. Run `npm run dev` to test locally
4. Deploy to production with `vercel --prod`

Everything is ready to go! 🚀
