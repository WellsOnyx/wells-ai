# 🔑 Quick Guide: Get Your API Keys

## ✅ Already Done

These encryption keys are already in your `.env.local`:
- ✅ `ENCRYPTION_MASTER_SECRET=iMUwa5DQjfxSuHyiydjJHj9iFcnUKphskYAvghoZKw4=`
- ✅ `CALENDAR_ENCRYPTION_KEY=176b79d8fddcc18de8f69bec1cc33328800299e1437fec65f2e37fbed4316b51`

**DO NOT CHANGE THESE** - they encrypt user data!

---

## 🎯 5 API Keys You Need (10 Minutes Total)

### 1️⃣ Brave Search API (2 min) - **HIGH PRIORITY**

**What it's for:** Web search capability

**Get it:**
1. Go to → https://brave.com/search/api/
2. Click "Get Started" or "Sign In"
3. Create account or sign in
4. Dashboard → "Create API Key"
5. Copy the key (starts with `BSA...`)

**Add to `.env.local`:**
```bash
BRAVE_SEARCH_API_KEY=BSA1234567890abcdef...
```

**Replace:** `PLACEHOLDER_GET_FROM_BRAVE`

**Cost:** FREE (2,000 queries/month)

---

### 2️⃣ Vercel Blob Storage (2 min) - **HIGH PRIORITY**

**What it's for:** Persistent file storage (documents, uploads)

**Get it:**
1. Go to → https://vercel.com/dashboard/stores
2. Click "Create Database"
3. Select "Blob"
4. Name it: `wells-ai-storage`
5. Click "Create"
6. Copy the `BLOB_READ_WRITE_TOKEN` from the .env snippet

**Add to `.env.local`:**
```bash
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_XXXXXXXXXXXXXXXX
```

**Replace:** `PLACEHOLDER_GET_FROM_VERCEL_STORES`

**Cost:** FREE (100GB storage + 100GB bandwidth)

---

### 3️⃣ Cal.com API Key (2 min) - **MEDIUM PRIORITY**

**What it's for:** Calendar scheduling

**Get it:**
1. Go to → https://app.cal.com/settings/developer/api-keys
2. Sign up if needed (free account)
3. Click "Create API Key"
4. Name it: `Wells AI`
5. Copy the key (starts with `cal_live_...`)

**Add to `.env.local`:**
```bash
CALCOM_API_KEY=cal_live_your_key_here
```

**Replace:** `PLACEHOLDER_GET_FROM_CALCOM`

**Cost:** FREE

**Optional:** Get event type ID:
- Go to https://app.cal.com/event-types
- Create or select an event type
- URL will show: `/event-types/123456` - that's your ID
- Add: `CALCOM_EVENT_TYPE_ID=123456`

---

### 4️⃣ Resend API Key (2 min) - **HIGH PRIORITY**

**What it's for:** Sending emails

**Get it:**
1. Go to → https://resend.com/api-keys
2. Sign up if needed
3. Click "Create API Key"
4. Name it: `Wells AI Production`
5. Copy the key (starts with `re_...`)

**Add to `.env.local`:**
```bash
RESEND_API_KEY=re_xxx
```

**Replace:** `PLACEHOLDER_GET_FROM_RESEND_API_KEYS`

**Cost:** FREE (3,000 emails/month)

---

### 5️⃣ Resend Webhook Secret (2 min) - **MEDIUM PRIORITY**

**What it's for:** Receiving inbound emails (inbox system)

**Get it:**
1. Go to → https://resend.com/webhooks
2. Click "Add Webhook"
3. URL: `https://your-app.vercel.app/api/inbox/webhooks/email` (change after deployment)
4. Events: Select "Email Received"
5. Click "Create"
6. Copy the webhook signing secret (starts with `whsec_...`)

**Add to `.env.local`:**
```bash
RESEND_WEBHOOK_SECRET=whsec_xxx
```

**Replace:** `PLACEHOLDER_GET_FROM_RESEND_WEBHOOKS`

**Cost:** FREE (included with Resend)

**Note:** Update the webhook URL after you deploy to production!

---

## ⚡ Quick Setup (Priority Order)

### Must Have (5 minutes):
1. ✅ Brave Search API
2. ✅ Vercel Blob Token
3. ✅ Resend API Key

**These three enable:** Web search, file storage, email sending

### Add Later (5 minutes):
4. ⭕ Cal.com API Key - Enables calendar
5. ⭕ Resend Webhook - Enables inbox

---

## 🔍 How to Update .env.local

Open `/Users/jonahmanning/Downloads/wells-ai-github-ready/.env.local` and replace these:

```bash
# Find these PLACEHOLDERs and replace with real keys:

BRAVE_SEARCH_API_KEY=PLACEHOLDER_GET_FROM_BRAVE
# → Replace with: BSA1234567890abcdef...

BLOB_READ_WRITE_TOKEN=PLACEHOLDER_GET_FROM_VERCEL_STORES
# → Replace with: vercel_blob_rw_XXXXXXXXXXXXXXXX

RESEND_API_KEY=PLACEHOLDER_GET_FROM_RESEND_API_KEYS
# → Replace with: re_xxx

CALCOM_API_KEY=PLACEHOLDER_GET_FROM_CALCOM
# → Replace with: cal_live_xxx

RESEND_WEBHOOK_SECRET=PLACEHOLDER_GET_FROM_RESEND_WEBHOOKS
# → Replace with: whsec_xxx
```

---

## ✅ Verification

After adding keys, test locally:

```bash
cd /Users/jonahmanning/Downloads/wells-ai-github-ready
npm run dev
```

Then visit: http://localhost:3000

**Test:**
- Chat with Wells → "Search for latest AI news" (tests Brave)
- Upload a file → "Create a proposal" (tests Blob)
- Send email → "Email john@example.com" (tests Resend)

---

## 🚀 Production Deployment

Once local testing works, deploy to Vercel:

```bash
# Add each key to Vercel
vercel env add BRAVE_SEARCH_API_KEY production
vercel env add BLOB_READ_WRITE_TOKEN production
vercel env add RESEND_API_KEY production
vercel env add ENCRYPTION_MASTER_SECRET production
vercel env add CALENDAR_ENCRYPTION_KEY production
vercel env add CALCOM_API_KEY production
vercel env add RESEND_WEBHOOK_SECRET production

# Deploy
vercel --prod
```

**IMPORTANT:** Use the SAME `ENCRYPTION_MASTER_SECRET` and `CALENDAR_ENCRYPTION_KEY` in production as in .env.local!

---

## 💡 Tips

### Free Tiers Are Generous:
- Brave: 2,000 searches/month = ~65/day
- Vercel Blob: 100GB = ~200,000 documents
- Resend: 3,000 emails/month = ~100/day
- Cal.com: Unlimited free meetings

### You'll only pay if you exceed these limits

### Security:
- Never commit `.env.local` to git (it's in .gitignore)
- Keep `ENCRYPTION_MASTER_SECRET` safe
- Rotate API keys periodically
- Use different keys for dev vs production

---

## 📞 Need Help?

Check service status:
- Brave: https://status.brave.com
- Vercel: https://vercel.com/status
- Resend: https://resend.com/status
- Cal.com: https://status.cal.com

---

**Ready to go!** Get the 5 API keys and Wells AI will have full capabilities 🚀
