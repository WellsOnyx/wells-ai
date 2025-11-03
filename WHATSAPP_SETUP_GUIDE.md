# WhatsApp Business API Setup Guide

## Overview

Wells AI uses **Meta's WhatsApp Business Cloud API** (direct, not through Twilio) for outreach.

**Why WhatsApp:**
- 98% open rate (vs 15% for email)
- First 1,000 conversations/month FREE
- Professional business messaging platform
- 2B+ users globally

**Cost:**
- First 1,000 conversations/month: **FREE**
- After that: ~$0.01 per conversation (USA)

---

## Prerequisites

Before starting, you need:
1. Facebook Business Manager account
2. Meta developer account
3. Phone number (can use existing business line)
4. Business verification documents (may be required)

---

## Step 1: Create Facebook Business Manager

1. Go to https://business.facebook.com
2. Click "Create Account"
3. Enter your business details
4. Verify your business email

---

## Step 2: Create WhatsApp Business App

1. Go to https://developers.facebook.com
2. Click "My Apps" → "Create App"
3. Select "Business" as app type
4. Enter app details:
   - **App Name:** Wells AI WhatsApp
   - **Contact Email:** Your business email
   - **Business Account:** Select your Business Manager
5. Click "Create App"

---

## Step 3: Add WhatsApp Product

1. In your app dashboard, click "Add Product"
2. Find "WhatsApp" and click "Set Up"
3. Select your Business Manager account
4. Click "Continue"

---

## Step 4: Get Phone Number

**Option A: Use Meta Test Number (Recommended for Testing)**
1. In WhatsApp settings, you'll see a test number provided by Meta
2. Use this for testing before going live
3. Limited to 5 test recipients

**Option B: Add Your Own Number (For Production)**
1. Click "Add Phone Number"
2. Enter your business phone number (E.164 format: +1234567890)
3. Verify via SMS code
4. **Note:** This number will be registered to WhatsApp Business and cannot be used for personal WhatsApp

---

## Step 5: Get Access Token

1. In WhatsApp dashboard, go to "API Setup"
2. Find "Temporary Access Token"
   - **For Testing:** Copy the temporary token (valid 24 hours)
   - **For Production:** Generate a permanent token:
     1. Go to "App Settings" → "Basic"
     2. Generate "System User Token"
     3. Assign "whatsapp_business_messaging" permission
     4. Copy the token (save securely!)

3. Copy your **Phone Number ID** (shown in API Setup section)

---

## Step 6: Create Message Template

**WhatsApp requires templates for cold outreach (first message to user).**

1. Go to WhatsApp Manager: https://business.facebook.com/wa/manage/message-templates
2. Click "Create Template"
3. Enter template details:

**Template Name:** `wells_outreach_v1`

**Category:** Marketing

**Language:** English (US)

**Body Text:**
```
Hi {{1}}, {{2}} here from Wells Onyx.

{{3}}

I found your profile - you have expertise in {{4}} that could contribute to {{5}}.

I assume you're happy where you are but if you're keeping your eyes open to an opportunity, let me know.

Best,
{{2}}
```

**Parameters:**
- {{1}} = firstName
- {{2}} = senderName
- {{3}} = valueProposition
- {{4}} = expertise
- {{5}} = contribution

4. Click "Submit"
5. **Wait for approval** (usually 1-2 days, sometimes instant)

---

## Step 7: Set Up Webhook

Webhooks allow Wells to receive incoming WhatsApp messages.

1. In WhatsApp dashboard, go to "Configuration"
2. Click "Edit" next to Webhook
3. Enter webhook details:
   - **Callback URL:** `https://wellsai.vercel.app/api/webhooks/whatsapp`
   - **Verify Token:** Generate a random string (save this!)
     - Example: `whatsapp_webhook_verify_token_abc123xyz`
4. Click "Verify and Save"
5. Subscribe to webhook fields:
   - ✅ messages
   - ✅ message_status

---

## Step 8: Configure Environment Variables

Add these to your Vercel project (or `.env.local`):

```bash
# WhatsApp Business Cloud API
WHATSAPP_ACCESS_TOKEN="your_permanent_access_token_here"
WHATSAPP_PHONE_NUMBER_ID="your_phone_number_id_here"
WHATSAPP_WEBHOOK_VERIFY_TOKEN="your_webhook_verify_token_here"
```

**To add to Vercel:**
1. Go to Vercel dashboard → Your project → Settings → Environment Variables
2. Add each variable above
3. Redeploy your app

---

## Step 9: Test Integration

### Test Sending a Message

1. Create a test file `test-whatsapp.ts`:

```typescript
import { sendWellsOutreach } from './lib/whatsapp-business'

async function test() {
  try {
    const result = await sendWellsOutreach(
      '+1234567890', // Your test phone number
      {
        firstName: 'John',
        senderName: 'Wells',
        valueProposition: 'We help companies hire top engineers',
        expertise: 'React and TypeScript',
        contribution: 'scalable frontend architecture'
      }
    )

    console.log('Message sent!', result)
  } catch (error) {
    console.error('Failed to send:', error)
  }
}

test()
```

2. Run: `tsx test-whatsapp.ts`
3. Check your phone for the WhatsApp message

### Test Receiving Messages

1. Reply to the WhatsApp message you received
2. Check Vercel logs for webhook event:
   ```bash
   vercel logs --follow
   ```
3. You should see: `[WHATSAPP_MESSAGE] Incoming message:` in logs

---

## Step 10: Go Live

### Before Going Live:
1. ✅ Template approved by Meta
2. ✅ Webhook verified and working
3. ✅ Tested sending/receiving messages
4. ✅ Business verification complete (if required)

### Launch Checklist:
1. Switch from test phone number to production number (if needed)
2. Generate permanent access token (replace temporary token)
3. Start with small batch (10-20 messages)
4. Monitor delivery rates and responses
5. Scale up gradually

---

## Pricing (After Free Tier)

**Free Tier:**
- First 1,000 conversations/month: FREE

**Paid Tier (after 1,000):**
- USA: ~$0.01 per conversation
- Other countries: $0.005 - $0.10 per conversation

**What's a "conversation"?**
- 24-hour window from when user replies
- Can send unlimited messages within that window
- New conversation starts after 24hr silence

**Example:**
- You send template message → User replies → 24hr conversation window opens
- You can send unlimited follow-up messages for free during that 24hr window
- Very cost-effective!

---

## Troubleshooting

### "Template not approved"
- Check template follows WhatsApp guidelines
- Avoid spammy language
- Include clear opt-out language
- Wait 24-48 hours for review

### "Message failed to send"
- Check phone number format (E.164: +1234567890)
- Verify access token is valid
- Check template is approved
- Ensure phone number is WhatsApp-enabled

### "Webhook not receiving messages"
- Verify webhook URL is publicly accessible
- Check verify token matches
- Ensure webhook is subscribed to "messages" field
- Check Vercel logs for errors

### "Access token expired"
- Temporary tokens expire after 24 hours
- Generate permanent System User token for production

---

## Best Practices

1. **Start Slow:** 10-20 messages/day for first week
2. **Monitor Responses:** Track open/response rates
3. **Respect Opt-Outs:** Immediately stop messaging if requested
4. **Quality Over Quantity:** Target 80-90% zone (20-year methodology)
5. **Session Messages:** Once user replies, you have 24hr window for free follow-ups

---

## Support Resources

- **Meta Documentation:** https://developers.facebook.com/docs/whatsapp/cloud-api
- **WhatsApp Manager:** https://business.facebook.com/wa/manage
- **Template Guidelines:** https://developers.facebook.com/docs/whatsapp/message-templates/guidelines
- **Pricing:** https://developers.facebook.com/docs/whatsapp/pricing

---

## Next Steps After Setup

1. ✅ WhatsApp integration complete
2. Build Twitter API integration
3. Build Resend email integration
4. Test multi-channel sequence
5. Launch first campaign!

---

Built with Meta's WhatsApp Business Cloud API.
98% open rate. First 1,000 conversations/month FREE.
