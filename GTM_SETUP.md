# GTM MVP Setup - UPDATED (Instantly Only!)

## What Changed

**OLD:** Apollo ($49/mo) + Instantly ($30/mo) = $79/mo
**NEW:** Instantly ($30-300/mo) = Everything in one place!

Instantly has 200M+ contacts built-in. No need for separate prospecting tool anymore.

## What You Need

1. **Instantly** (One tool for EVERYTHING)
   - Sign up: https://instantly.ai/
   - Get API key: Settings → API
   - Create campaign, get campaign ID
   - Get credit plan (for lead finding)
   - `export INSTANTLY_API_KEY=your_key`
   - `export INSTANTLY_CAMPAIGN_ID=your_campaign_id`

2. **Notion** (Already have this)
   - API key from your integration
   - Deals database ID
   - `export NOTION_API_KEY=ntn_...`
   - `export NOTION_DEALS_DB_ID=...`

3. **Anthropic** (Already have this)
   - `export ANTHROPIC_API_KEY=...`

4. **Twilio** (Optional - for SMS)
   - Only if you want SMS capability
   - `export TWILIO_FROM=+1234567890`

## Quick Start (5 Minutes)

### 1. Install Dependencies

```bash
cd ~/Downloads/wells-ai-github-ready
npm install
```

### 2. Set Environment Variables

```bash
export NOTION_API_KEY=ntn_t16951791372pjN1C8Dizj9ocXKRf7BFNjSonDl3CtLbby
export NOTION_DEALS_DB_ID=2990650a618180ce8db3e7148d17596d
export ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
export INSTANTLY_API_KEY=<get_from_instantly>
export INSTANTLY_CAMPAIGN_ID=<get_from_instantly>

# Optional for SMS:
export TWILIO_FROM=+1234567890
```

### 3. Test It

```bash
npx tsx scripts/test-gtm-mvp.ts
```

This will:
1. ✅ Check all API keys are set
2. ✅ Pull your Notion deals → Build ICP
3. ✅ Search Instantly for 5 matching prospects
4. ✅ Generate multi-channel messages (Email, SMS if allowed, LinkedIn drafts)
5. ✅ Show you a preview with channel breakdown
6. ⏸️  Wait for approval

### 4. Send Real Emails (When Ready)

```bash
SEND_EMAILS=yes npx tsx scripts/test-gtm-mvp.ts
```

This will:
- Send emails via Instantly
- Send SMS via Twilio (if configured and allowed)
- Show LinkedIn drafts for manual sending
- Report sent/failed count per channel
- Done!

## Expected Output

```
🚀 Testing GTM MVP...

1️⃣ Checking environment variables...
✅ All environment variables set

2️⃣ Building ICP from Notion deals...
✅ ICP built successfully
   Industries: Technology, SaaS
   Titles: CEO, VP Sales, Head of Revenue
   Avg deal size: $125,000
   Summary: Target B2B SaaS companies, 50-200 employees, selling to enterprise

3️⃣ Searching Instantly for prospects...
✅ Found 5 prospects
   1. John Smith - CEO at Acme Corp (john@acme.com)
   2. Jane Doe - VP Sales at BigCo (jane@bigco.com)
   ...

4️⃣ Creating test campaign...
✅ Campaign created: campaign_1234567890
   Prospects: 5
   Messages: 15 (3 channels × 5 prospects)
   Using Wells AI stack: NO (you provided own Instantly API key)

📧 Sample email:
   To: John Smith (john@acme.com)
   Subject: Quick question about Acme's sales process
   Body:
   Hey John,

   I noticed Acme Corp is growing fast in the SaaS space. Most companies
   your size struggle with scaling their sales process without burning out
   their team.

   Would it make sense to chat about how we've helped similar companies
   automate 80% of their demand generation?

   Worth 15 minutes?

   Best,
   Jonah

📊 Channel breakdown:
   Emails: 5
   SMS: 0 (5 blocked by guardrails - all cold outreach)
   LinkedIn drafts: 5 (manual send)

5️⃣ Ready to send?
⚠️  This will send REAL emails to REAL people!

To send, run:
SEND_EMAILS=yes npx tsx scripts/test-gtm-mvp.ts

💡 Test complete! Everything is working.
   Set SEND_EMAILS=yes to actually send.
```

## What Happens When You Send

1. Instantly receives 5 leads
2. Adds them to your campaign
3. Sends emails (respects your campaign schedule)
4. Tracks opens/clicks
5. You get replies in your Instantly inbox

## Next Steps After Testing

Once you verify it works:

1. **Increase volume**: Change `limit: 5` to `limit: 25` in apollo-search.ts
2. **Add to chat**: Integrate into Wells AI chat UI
3. **Track responses**: Connect Instantly webhook
4. **Book meetings**: Add calendar integration
5. **Scale**: Run daily, weekly, etc.

## Troubleshooting

**"No won deals found"**
- Make sure Notion deals database has Status = "Won"
- Will use default ICP if no deals

**"Apollo API error"**
- Check API key is correct
- Check you have credits remaining

**"Instantly API error"**
- Check API key and campaign ID
- Make sure campaign is active

**"No JSON in response"**
- Claude API issue, check ANTHROPIC_API_KEY
- Retry, usually works second time

## Costs

### Option 1: Bring Your Own Instantly Account
- Instantly: $30-300/mo (depends on your plan)
- Wells AI: Just transaction fees
- **Total: Whatever you already pay Instantly**

### Option 2: Use Wells AI's Stack
- Wells AI provides everything: $79/mo
- Includes: Notion CRM + Instantly (email + leads) + everything else
- **Becomes FREE when you hit $250K GMV** 😉

### Your Setup (Based on screenshots):
- Email Outreach: $97/mo
- Instantly Credits: $300/mo
- CRM: $97/mo
- **Total: ~$494/mo**

Since you already have this setup, Wells AI will just use YOUR Instantly account (no additional cost).

## Safety & Guardrails

**Email:**
- Test campaign sends to 5 prospects first
- Review generated emails before sending
- Use your own email domain (not gmail)
- Follow CAN-SPAM (unsubscribe link in Instantly)

**SMS:**
- STRICT GUARDRAILS: NO cold SMS (this is spam!)
- Only sends to existing relationships or opt-ins
- System automatically blocks cold SMS attempts
- Stays compliant with TCPA

**LinkedIn:**
- Drafts messages only - YOU send manually
- No automated sending (ToS violation)
- Stays human and compliant

**Human-first approach** = No spam, no violations, ethical outreach

## Ready to Ship

Once you verify this works, I'll:
1. Integrate into chat UI
2. Add approval flow
3. Add response tracking
4. Make it beautiful

But first - let's make sure it ACTUALLY SENDS.

Get those API keys and let's go! 🚀
