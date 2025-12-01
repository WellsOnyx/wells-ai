# Instantly API Test Results

**Date:** 2025-11-21
**Status:** ⚠️ API Key Authentication Failed

---

## Test Summary

### Tests Performed

1. ✅ **Test Script Created** - `/scripts/test-instantly.js`
2. ❌ **List Campaigns** - Auth failed
3. ❌ **Get Account Info** - Auth failed

### API Key Analysis

**Provided Key (Base64):**
```
YmE4YTc2ZWItZTM3Zi00YWEyLTk3NmQtZjRkOGUyOWRlY2VjOnVEb0FOY1JEbHVLWg==
```

**Decoded Key:**
```
ba8a76eb-e37f-4aa2-976d-f4d8e29decec:uDoANcRDluKZ
```

**Format:** `UUID:SECRET` (appears correct for Instantly API)

### Issue Identified

The API key is failing authentication with error: `ERR_AUTH_FAILED`

This means either:
- The API key is expired or invalid
- The API key needs to be regenerated in Instantly dashboard
- The account needs to be verified

---

## How to Fix

### Step 1: Get Fresh API Key from Instantly

1. Go to [Instantly.ai Dashboard](https://app.instantly.ai)
2. Navigate to **Settings** → **API Keys**
3. Generate a new API key or copy existing one
4. The key should look like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### Step 2: Test the New API Key

Use the test script:

```bash
cd /Users/jonahmanning/Library/Mobile\ Documents/com~apple~CloudDocs/Wells/wells-ai-github-ready

# Edit the script with your new API key
nano scripts/test-instantly.js
# Update line 6: const API_KEY = 'YOUR_NEW_KEY_HERE'

# Run the test
node scripts/test-instantly.js
```

### Step 3: Update Environment Variables

Once you have a working API key:

#### For Local Development:
```bash
# Edit .env.local
echo 'INSTANTLY_API_KEY="your-api-key-here"' >> .env.local
```

#### For Vercel Production:
```bash
# Set via Vercel CLI
vercel env add INSTANTLY_API_KEY

# Or via Vercel Dashboard:
# 1. Go to https://vercel.com/[your-project]/settings/environment-variables
# 2. Add: INSTANTLY_API_KEY = your-api-key-here
# 3. Select: Production, Preview, Development
# 4. Save
```

---

## API Integration Details

### Endpoint Format

Instantly uses **POST requests** with `api_key` in the JSON body:

```javascript
const response = await fetch('https://api.instantly.ai/api/v1/campaign/list', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    api_key: 'your-api-key-here'
  })
})
```

### Available Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/campaign/list` | POST | List all campaigns |
| `/campaign/get` | POST | Get campaign details |
| `/campaign/create` | POST | Create new campaign |
| `/lead/add` | POST | Add prospects to campaign |
| `/account/get` | POST | Get account info |

### Integration in Wells

The integration is already set up in:
- **File:** `/lib/email/instantly.ts`
- **Functions:**
  - `listCampaigns()` - Get all campaigns
  - `getCampaign(id)` - Get specific campaign
  - `addProspectsToCampaign(campaignId, prospects)` - Add leads
  - `createInstantlyCampaign(config)` - Create new campaign

---

## Next Steps After API Key Works

### 1. Find Your Campaign IDs

Once authenticated, the test script will show:
```
Found 2 campaign(s):

1. Wells GTM
   ID: abc123...
   Status: active

2. Wells AI
   ID: def456...
   Status: paused

💡 RECOMMENDED DEFAULT CAMPAIGN:
   Set INSTANTLY_DEFAULT_CAMPAIGN_ID="abc123..."
```

### 2. Set Default Campaign

In Vercel:
```bash
vercel env add INSTANTLY_DEFAULT_CAMPAIGN_ID
# Enter the campaign ID from above
```

### 3. Test the Integration

Use the Wells AI GTM system:
```typescript
import { addProspectsToCampaign } from '@/lib/email/instantly'

// Add prospects to your campaign
await addProspectsToCampaign('your-campaign-id', [
  {
    email: 'prospect@example.com',
    firstName: 'John',
    lastName: 'Doe',
    companyName: 'Acme Corp',
    jobTitle: 'CTO'
  }
])
```

---

## Current Code Status

✅ **Integration Code:** Complete and ready in `lib/email/instantly.ts`
✅ **Test Script:** Created at `scripts/test-instantly.js`
⚠️ **API Key:** Needs to be regenerated/verified
⏳ **Campaign IDs:** Waiting for successful auth to retrieve

---

## Campaign Templates

The integration includes pre-built templates:

### Executive Search Template
```typescript
import { createCampaignFromTemplate } from '@/lib/email/instantly'

await createCampaignFromTemplate('exec-search', 'jonah@wellsonyx.com')
```

### Partnership Outreach Template
```typescript
await createCampaignFromTemplate('partnership', 'jonah@wellsonyx.com')
```

---

## Support

If issues persist:
1. Check Instantly account is active and in good standing
2. Verify email sending limits haven't been exceeded
3. Contact Instantly support: support@instantly.ai
4. Check Instantly status page: https://status.instantly.ai

---

## Test Files Created

- ✅ `/scripts/test-instantly.js` - API test script
- ✅ `/lib/email/instantly.ts` - Full integration library
- ✅ `INSTANTLY_API_TEST_RESULTS.md` - This document

**Next Action:** Get fresh API key from Instantly dashboard and re-run tests.
