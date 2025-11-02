# LinkedIn GTM Integration - Setup Guide

## Overview

The LinkedIn GTM integration allows you to run outbound campaigns on LinkedIn following Wells Onyx's proprietary 20-year sourcing methodology.

## BYOI (Bring Your Own Infrastructure)

**You own your data. Wells provides the intelligence.**

- ✅ You control your LinkedIn account
- ✅ You own all prospect relationships
- ✅ Wells provides targeting, messaging, and workflow intelligence
- ✅ No data lock-in

## Integration Options

### 1. Manual (Recommended)

**How it works:**
- Wells provides connection requests and messages
- You copy-paste into LinkedIn
- Safest option - no risk of account restrictions

**Pros:**
- LinkedIn-compliant (no automation)
- No API keys needed
- Full control over timing and personalization
- Zero risk of account suspension

**Cons:**
- Requires 15-30 min/day of manual work
- Slower than automation

**Best for:**
- First-time LinkedIn outreach
- High-value prospects requiring personalization
- Users concerned about LinkedIn account safety

### 2. Phantombuster (Automated)

**How it works:**
- Connect your Phantombuster account
- Wells orchestrates campaigns via Phantombuster API
- Automated sending within safe limits

**Pros:**
- Fully automated
- Consistent daily execution
- Scalable to 50+ messages/day

**Cons:**
- Requires Phantombuster subscription (~$60/mo)
- Small risk of LinkedIn restrictions if overused
- Requires API key setup

**Best for:**
- Users with existing Phantombuster accounts
- High-volume campaigns (100+ prospects)
- Experienced LinkedIn outreach users

### 3. Browser Extension (Coming Soon)

**How it works:**
- Chrome extension adds "Send with Wells" buttons to LinkedIn
- One-click to send Wells-generated messages
- Semi-automated workflow

**Status:** In development

## The 20-Year Methodology

Wells applies proven sourcing principles to LinkedIn outreach:

### Step 0: Deep Qualification
- Understand what you're selling
- Identify target companies and industries
- Define success criteria (the 3 things that matter)

### Step 1: 80-90% Zone Targeting
- Target prospects in the "sweet spot" (not 100%)
- Avoid over-qualified prospects (too competitive)
- Avoid under-qualified prospects (waste of time)

### Step 2: Message Formula
**Connection Request (max 300 chars):**
```
Hi {{firstName}}, [VALUE PROP IN 1 LINE]. Worth connecting?
```

**Day 1 Message (after connection accepted):**
```
Thanks for connecting, {{firstName}}!

Quick context: [WHAT YOU DO].

I found your profile both as someone knowledgeable in [EXPERTISE] but also who could potentially contribute to [OUTCOME].

I assume you're happy where you are but if you're keeping your eyes and ears open to an opportunity, please circle back.

Best,
[Your Name]
```

**Day 4 Follow-up:**
```
{{firstName}} - following up on my note.

We just [SOCIAL PROOF].

Our approach:
→ [BENEFIT 1]
→ [BENEFIT 2]
→ [BENEFIT 3]

Worth a 15-min call? [CALENDLY LINK]
```

**Day 7 Final Touch:**
```
{{firstName}} - last note!

I know you're busy. If you're not looking right now, totally understand.

But if you ever need [OUTCOME], we're here:
• [BENEFIT 1]
• [BENEFIT 2]
• [BENEFIT 3]

Feel free to reach out anytime.
```

### Step 3: Self-Screening
- If they respond → Qualified + interested
- If they don't respond → Not interested
- ~1% false positives (filter quickly)

## Performance Targets

### Good Targeting:
- **Response Rate:** 20-40%
- **Qualification Rate:** 50%+ of responders
- **Conversion to Meeting:** 10-15%

### Poor Targeting (Fix immediately):
- **Response Rate < 10%** → You're chasing 100% zone or messaging is off
- **High response but < 30% qualified** → Message not assumptive enough
- **High qualification but < 5% conversion** → Compensation/offer not competitive

## Daily LinkedIn Routine

### Morning (15 min)
1. Review 10-20 prospect profiles
2. Send 10-15 personalized connection requests
3. Engage with 5-10 posts from prospects (like/comment)

### Midday (10 min)
1. Check for new connection acceptances
2. Send Day 1 message to new connections
3. Respond to any replies

### Evening (5 min)
1. Review profile views (warm leads)
2. Schedule follow-ups for next day

## LinkedIn Safety Limits

### Connection Requests:
- **Max per week:** 100
- **Recommended daily:** 10-15
- **Wells enforces:** 15/day in manual mode, 20/day in automated

### Messages:
- **Max per day:** 50-100 (depending on account age)
- **Recommended daily:** 20-30
- **Wells enforces:** 20/day in manual mode, 50/day in automated

### Engagement:
- Like/comment on 5-10 posts per day
- Endorse skills of connections
- Share relevant content

## Setup Instructions

### Step 1: Connect LinkedIn Integration

1. Go to Settings → LinkedIn Integration
2. Choose your integration method (Manual recommended for first-timers)
3. Click "Connect LinkedIn"

### Step 2: Complete Qualification

Wells will ask you:
- What do you sell?
- Who are your target customers?
- What companies/industries to target?
- What's your pricing?
- What 3 things determine customer fit?

### Step 3: Generate Prospect List

1. Wells identifies prospects in the 80-90% zone
2. Review the list and remove any you don't want to contact
3. Approve the campaign

### Step 4: Daily Execution

**Manual Mode:**
1. Log into Wells dashboard each morning
2. Copy connection requests (Wells provides them)
3. Paste into LinkedIn
4. Copy messages for new connections
5. Paste into LinkedIn

**Automated Mode:**
1. Wells runs automatically each day
2. Check dashboard for responses
3. Respond to qualified leads

### Step 5: Track Performance

1. Wells tracks all metrics automatically
2. Review dashboard weekly
3. Adjust targeting if performance is off

## Campaign Analytics

Wells tracks:
- Connection request acceptance rate
- Message response rate
- Qualification rate (qualified vs unqualified responses)
- Meeting booking rate
- Deal creation rate

You'll see real-time diagnostics:
- "Low response rate - check targeting"
- "High response but low qualification - message too generic"
- "High qualification but low conversion - offer not competitive"

## Best Practices

### DO:
✅ Personalize the first line of connection requests
✅ Engage with prospects' content before reaching out
✅ Follow up 3 times max (Day 1, 4, 7)
✅ Track response rates and adjust targeting
✅ Use judgment criteria as search keywords

### DON'T:
❌ Send generic connection requests
❌ Pitch immediately in connection request
❌ Follow up more than 3 times
❌ Target 100% zone (too competitive)
❌ Ignore performance metrics

## Troubleshooting

### "Connection requests getting declined"
- Check: Are you targeting 100% zone? (Overqualified prospects)
- Fix: Lower targeting to 80-90% zone

### "Low response rate (<10%)"
- Check: Is message formula being followed? Subject line = First Name?
- Fix: Review messaging, ensure assumptive close

### "High response but low qualification"
- Check: Is Line 2 assumptive enough? Too generic?
- Fix: Tighten targeting, make message more specific

### "High qualification but low meeting conversion"
- Check: Is compensation competitive? Overselling?
- Fix: Adjust offer, simplify pitch

## Security & Privacy

- API keys stored encrypted in Clerk user metadata
- LinkedIn credentials never stored by Wells
- All prospect data owned by you
- Export data anytime
- Delete integration anytime

## Pricing

LinkedIn GTM is included in Wells AI Platform:
- **Starter:** $297/mo (1 active campaign, 100 prospects)
- **Growth:** $997/mo (3 active campaigns, 500 prospects)
- **Scale:** $2,997/mo (Unlimited campaigns, unlimited prospects)

Phantombuster subscription sold separately (~$60/mo).

## Support

- In-app chat support
- Video tutorials: [wells.ai/linkedin-tutorials]
- Weekly office hours: Tuesdays 2pm ET
- Email: support@wellsonyx.com

---

Built with the 20-year sourcing methodology that placed 100+ executives.
Now available for your GTM campaigns.
