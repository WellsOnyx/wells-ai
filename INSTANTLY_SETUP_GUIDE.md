# Instantly.ai Email Integration Setup Guide

**Last Updated:** November 21, 2025
**Status:** Infrastructure complete, API key needs verification

---

## Current Status

### ✅ What's Built:
- **Complete email infrastructure** in `lib/email.ts`
- **Instantly.ai API integration** in `lib/instantly.ts`
- **GTM campaign engine** with email sending in `lib/gtm/campaign-engine.ts`
- **Consent system** - All emails require approval before sending
- **Audit logging** - Every email tracked in database
- **API endpoints** ready for email campaigns

### ⚠️  What's Missing:
- **No Instantly.ai campaign created** - Account needs at least one campaign
- **`INSTANTLY_DEFAULT_CAMPAIGN_ID` not set** - Required environment variable
- **Local `.env.local` needs config** - For development testing

---

## How It Works

Wells AI uses **Instantly.ai** for email sending through their campaign system:

1. **User requests outreach** → Wells generates personalized email
2. **Email queued for approval** → Consent system (required)
3. **User approves** → `sendEmailViaInstantly()` called
4. **Add lead to Instantly campaign** → Triggers email sequence
5. **Instantly sends email** → From their infrastructure
6. **Response tracking** → Instantly handles opens, clicks, replies

### Why Instantly.ai?

- **Warm inbox reputation** - Dedicated IPs and domain warming
- **Deliverability optimization** - Smart sending patterns
- **Response classification** - AI detects positive/negative replies
- **Multi-sequence support** - Follow-ups automated
- **Cheaper than SES at scale** - ~$79/month unlimited

---

## Setup Steps

### Step 1: Create Instantly.ai Campaign

1. **Log in to Instantly.ai** dashboard: https://app.instantly.ai
2. **Create a new campaign**:
   - Name it "Wells AI - Default Campaign"
   - Set up email sequence (can be simple 1-email for now)
   - Configure sending schedule
   - Verify sending domain/email address
3. **Copy the Campaign ID**:
   - Go to campaign settings
   - Find "Campaign ID" (usually format: `camp_xxxxxxxxxxxxx`)
   - Save this for Step 2

### Step 2: Set Environment Variables

**For Production (Vercel):**

```bash
# Already configured:
# ✅ INSTANTLY_API_KEY - Set 6 days ago in Vercel

# Need to add:
cd ~/Downloads/wells-ai-github-ready
vercel env add INSTANTLY_DEFAULT_CAMPAIGN_ID
# Paste your campaign ID when prompted
# Select: Production, Preview, Development (all three)
```

**For Local Development:**

```bash
cd ~/Downloads/wells-ai-github-ready

# Create or edit .env.local
cat >> .env.local << 'EOF'

# Instantly.ai Email Automation
INSTANTLY_API_KEY=YmE4YTc2ZWItZTM3Zi00YWEyLTk3NmQtZjRkOGUyOWRlY2VjOnVEb0FOY1JEbHVLWg==
INSTANTLY_DEFAULT_CAMPAIGN_ID=your_campaign_id_here
EOF
```

### Step 3: Verify Campaigns

**IMPORTANT:** The existing API key in the environment is failing authentication. You need to get a fresh API key from Instantly.

Run the test script to verify your API key:

```bash
cd /Users/jonahmanning/Library/Mobile\ Documents/com~apple~CloudDocs/Wells/wells-ai-github-ready

# Test with your API key
./scripts/test-instantly-curl.sh 'YOUR_API_KEY_FROM_INSTANTLY'
```

**Expected output:**
```
✅ SUCCESS - Status 200

- Wells GTM (ID: abc123..., Status: active)
- Wells AI (ID: def456..., Status: paused)

💾 Campaign IDs for Vercel:
  INSTANTLY_DEFAULT_CAMPAIGN_ID="abc123..."
```

If you see `❌ FAILED - Error: ERR_AUTH_FAILED`, your API key is invalid. Get a new one from Instantly dashboard.

### Step 4: Test Email Sending (Optional)

Test the full flow with a script:

```bash
# Test email queue and send
INSTANTLY_API_KEY="..." \
INSTANTLY_DEFAULT_CAMPAIGN_ID="..." \
npx tsx scripts/test-email-flow.ts
```

Or test through the API:

```bash
curl -X POST https://wellsai.vercel.app/api/email/queue \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "toName": "Test User",
    "subject": "Test from Wells AI",
    "text": "This is a test email"
  }'
```

---

## Code Reference

### lib/instantly.ts

The core integration with three key functions:

```typescript
// Add lead to Instantly campaign (triggers email sequence)
export async function addLeadToCampaign(params: AddLeadToCampaignParams): Promise<InstantlyResponse>

// Send email via Instantly with audit logging
export async function sendEmailViaInstantly(params: {...}): Promise<void>

// List available campaigns
export async function listCampaigns(): Promise<any[]>
```

### lib/email.ts

The email service layer with consent integration:

```typescript
// Queue email for consent approval
export async function queueEmail(params: EmailParams): Promise<string>

// Send approved email via Instantly
export async function sendEmail(actionId: string, params: EmailParams, campaignId?: string): Promise<void>
```

**Key behavior:**
- If `INSTANTLY_DEFAULT_CAMPAIGN_ID` is NOT set → **Dry run mode** (logs but doesn't send)
- If set → Actually sends via Instantly.ai
- Always requires consent approval first

### lib/gtm/campaign-engine.ts

Campaign creation and bulk sending:

```typescript
// Create GTM campaign with prospect discovery
export async function createCampaign(params: {...}): Promise<Campaign>

// Send all approved messages in campaign
export async function sendCampaign(params: {...}): Promise<{...}>
```

---

## Environment Variables Reference

| Variable | Required? | Description | Location |
|----------|-----------|-------------|----------|
| `INSTANTLY_API_KEY` | ✅ Yes | Instantly.ai API key | ✅ Set in Vercel |
| `INSTANTLY_DEFAULT_CAMPAIGN_ID` | ✅ Yes | Default campaign for emails | ❌ Missing |
| `WELLS_INSTANTLY_API_KEY` | ⚠️  Optional | Wells AI's shared account key | Not needed |
| `INSTANTLY_CAMPAIGN_ID` | ⚠️  Optional | Alternate campaign ID variable | Not needed |

**Note:** Only need to set `INSTANTLY_DEFAULT_CAMPAIGN_ID` - the API key is already configured.

---

## Testing Checklist

Before using in production, test:

- [ ] **List campaigns** - `scripts/list-instantly-campaigns.ts` returns campaigns
- [ ] **Queue email** - Creates consent request in database
- [ ] **Approve email** - Sends to Instantly.ai API successfully
- [ ] **Check Instantly dashboard** - Lead appears in campaign
- [ ] **Receive email** - Email delivered to inbox (not spam)
- [ ] **Response tracking** - Replies detected in Instantly

---

## Alternative: AWS SES

If you want to use AWS SES instead of Instantly.ai:

### Pros:
- **Cheaper at scale** - $0.10 per 1,000 emails
- **More control** - Own infrastructure
- **Direct sending** - No third-party campaigns

### Cons:
- **Cold start reputation** - Need to warm up IPs/domains
- **No deliverability optimization** - Manual tuning required
- **No response classification** - Need to build yourself
- **More setup complexity** - Verified domains, DKIM, SPF, DMARC

### Implementation Plan:

1. **Create new module** `lib/aws-ses.ts`
2. **Add AWS SDK** dependency
3. **Implement `sendEmailViaSES()`** function
4. **Update `lib/email.ts`** to support provider selection
5. **Add environment variable** `EMAIL_PROVIDER=instantly|ses`

**Estimated effort:** 2-4 hours

---

## Troubleshooting

### "No Instantly campaign ID - email not sent"

**Problem:** `INSTANTLY_DEFAULT_CAMPAIGN_ID` not set
**Solution:** Follow Step 1 & 2 above to create campaign and set env var

### "INSTANTLY_API_KEY not configured"

**Problem:** API key missing or incorrect
**Solution:** Check `.env.local` or Vercel environment variables

### "Instantly API error: 401 Unauthorized"

**Problem:** Invalid API key or expired
**Solution:** Get new API key from Instantly.ai dashboard → Settings → API

### "No campaigns found"

**Problem:** Instantly account has no campaigns created
**Solution:** Create at least one campaign in Instantly dashboard

### Emails going to spam

**Problem:** Domain not warmed up or SPF/DKIM issues
**Solution:**
1. Verify sending domain in Instantly
2. Set up SPF/DKIM records
3. Use Instantly's warming feature
4. Start with small volumes (10-20/day)

---

## Next Steps

1. ✅ **Read this guide**
2. ⬜ **Create Instantly.ai campaign**
3. ⬜ **Set `INSTANTLY_DEFAULT_CAMPAIGN_ID`** in Vercel
4. ⬜ **Test with `list-instantly-campaigns.ts`**
5. ⬜ **Try sending test email**
6. ⬜ **Launch first GTM campaign**

---

## Questions?

- **Instantly.ai API docs**: https://developer.instantly.ai/
- **Wells AI infrastructure**: `lib/email.ts`, `lib/instantly.ts`
- **GTM campaign system**: `lib/gtm/campaign-engine.ts`
- **Example test**: `scripts/test-gtm-mvp.ts`

**Status:** Ready to send emails once campaign is configured! 🚀
