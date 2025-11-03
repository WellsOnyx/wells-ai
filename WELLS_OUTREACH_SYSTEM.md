# Wells Outreach System - Multi-Channel GTM Platform

## Overview

Wells Outreach System is a **custom-built, multi-channel outreach platform** that Wells fully controls.

**Why we built this:**
- Email deliverability is at all-time lows (15-25% open rate in 2025)
- LinkedIn API doesn't exist for cold outreach
- WhatsApp has 98% open rate vs 15% for email
- Multi-channel approach costs 3x more but delivers 5-10x better results

**What we control:**
- ✅ WhatsApp Business API (Twilio) - 98% open rate
- ✅ X/Twitter DMs (API v2) - 70-80% read rate
- ✅ SMS (Twilio) - 98% open rate
- ✅ Email (Resend) - 15-25% open rate

**What we reference (data only):**
- LinkedIn profiles (enrichment, not automation)
- Instagram profiles (enrichment)
- Other social profiles

---

## Architecture

### Core Components

1. **wells-outreach-system.ts** - Core outreach engine
   - Multi-channel sequence builder
   - Campaign management
   - Prospect enrollment
   - Message templating

2. **outreach-orchestrator.ts** - Sending orchestration
   - Scheduled touch execution
   - Daily limits enforcement
   - Multi-channel sending (WhatsApp, Twitter, SMS, Email)
   - Response tracking and classification

3. **PLATFORM_API_RESEARCH.md** - Platform capabilities research
   - WhatsApp Business API (highest priority)
   - X/Twitter API v2
   - Comparison of all social platforms
   - Cost analysis

---

## Multi-Channel Sequence (Default)

### 6-Touch Sequence Over 8 Days

**Day 0: WhatsApp + Twitter (Immediate)**
- Touch 1: WhatsApp message (98% open rate)
- Touch 2: Twitter DM (70% read rate)

**Day 2: Email (If No Response)**
- Touch 3: Email (15% open rate)

**Day 4: SMS (If Still No Response)**
- Touch 4: SMS (98% open rate)

**Day 6: Email Follow-Up**
- Touch 5: Email with value + social proof

**Day 8: Final Touch**
- Touch 6: WhatsApp (back to highest deliverability)

### Why This Works:
- **WhatsApp first** (highest open rate)
- **Multi-channel** (not relying on email alone)
- **Professional** (all channels support business use)
- **Trackable** (all have delivery/read receipts)
- **Cost-effective** (~$0.045 per prospect for full sequence)

---

## Cost Analysis

### Per-Prospect Cost (Full 6-Touch Sequence):
- WhatsApp (2 touches): $0.02 (first 1,000 conversations/mo FREE)
- Twitter DM (1 touch): $0.02 (amortized from API subscription)
- SMS (1 touch): $0.01
- Email (2 touches): $0.01
- **Total: ~$0.045 per prospect**

### vs Email-Only:
- Email (3 touches): $0.015 per prospect
- **But 70% deliverability loss = wasted effort**

**Result:** Multi-channel costs 3x more but delivers 5-10x better results.

---

## Message Formula (20-Year Methodology)

### Touch 1: WhatsApp (Day 0)
```
Hi {{firstName}}, {{senderName}} here from Wells Onyx.

{{valueProposition}}

I found your profile - you have expertise in {{expertise}} that could contribute to {{contribution}}.

I assume you're happy where you are but if you're keeping your eyes open to an opportunity, let me know.

Best,
{{senderName}}
```

### Touch 2: Twitter DM (Day 0)
```
Hi {{firstName}}, saw your profile - {{valueProposition}}. {{expertise}} background is impressive. Worth connecting?
```

### Touch 3: Email (Day 2 - If No Response)
```
Subject: Quick question - {{company}}

Hi {{firstName}},

{{valueProposition}}

I found your profile both as someone knowledgeable in {{expertise}} but also who could potentially contribute to {{contribution}}.

I assume you're happy where you are but if you're keeping your eyes and ears open to an opportunity, please circle back.

Best,
{{senderName}}
```

### Touch 4: SMS (Day 4 - If No Response)
```
Hi {{firstName}}, {{senderName}} from Wells Onyx. Reached out via WhatsApp/email about {{valueProposition}}. Worth a quick call? {{calendlyLink}}
```

### Touch 5: Email Follow-Up (Day 6)
```
Subject: Re: Quick question - {{company}}

{{firstName}} - following up on my note.

We just {{socialProof}}.

Our approach:
→ {{benefit1}}
→ {{benefit2}}
→ {{benefit3}}

Worth a 15-min call this week?

Calendly: {{calendlyLink}}

Best,
{{senderName}}
```

### Touch 6: Final WhatsApp (Day 8)
```
{{firstName}} - last note!

I know you're busy. If {{company}} isn't looking for this right now, totally understand.

But if you ever need {{outcome}}, we're here:
• {{benefit1}}
• {{benefit2}}
• {{benefit3}}

Feel free to reach out anytime.

Best,
{{senderName}}
```

---

## Campaign Safety Limits

### Daily Sending Limits (To Avoid Spam/Rate Limits):
- **WhatsApp:** 200/day (low spam risk, high deliverability)
- **Twitter:** 100/day (conservative, API limit: 500/day)
- **SMS:** 100/day (medium limit)
- **Email:** 100/day (spam filter risk)

### Safety Features:
- Work hours only (9am-5pm)
- Skip weekends
- Random delays (0-2 hours)
- Bounce/opt-out tracking
- Auto-pause if deliverability drops

---

## Platform Integration Status

### ✅ Ready:
- SMS (Twilio) - ALREADY INTEGRATED
- Email (Resend) - NEEDS INTEGRATION

### ⏳ Pending Integration:
- WhatsApp Business API (via Twilio)
  - Requires WhatsApp Business Account verification
  - Template approval (1-2 days)
  - First 1,000 conversations/month FREE

- Twitter API v2 (for DMs)
  - Requires Twitter Developer Account
  - X API Pro ($5,000/mo) or Basic ($100/mo)
  - OAuth 2.0 authentication

---

## Response Classification (Step 3: Self-Screening)

### AI-Powered Response Classification:

Responses are automatically classified using Claude:

- **High Interest** → Qualified + interested
- **Medium Interest** → Interested, need to qualify further
- **Low Interest** → Not interested or not qualified
- **Crazy** → Spam, angry, unreasonable (filter out)

### Classification Logic:
1. Parse response text
2. Compare against qualification criteria
3. Determine:
   - Interested? (yes/no/maybe)
   - Qualified based on criteria? (yes/no/unknown)
   - Reasonable to talk to? (yes/no - filter angry/spam)
4. Return classification + reasoning

---

## Campaign Analytics

### Tracked Metrics (By Channel):
- **WhatsApp:** Sent, Delivered, Read
- **Twitter:** Sent, Delivered, Read
- **SMS:** Sent, Delivered
- **Email:** Sent, Delivered, Bounced, Opened, Clicked

### Quality Metrics (From 20-Year Methodology):
- **Response Rate:** Target 20-40%
- **Qualification Rate:** Target 50%+
- **Conversion Rate:** Target 10-15%
- **Bounce Rate:** Target < 5%

### Diagnostics (Auto-Generated):
- "Low response rate (<10%) - Check targeting (80-90% zone vs 100%)"
- "High response but low qualification (<30%) - Message too generic"
- "High qualification but low conversion (<5%) - Compensation not competitive"
- "High bounce rate (>5%) - Use email verification service"

---

## Next Steps

### Immediate (This Week):
1. ✅ Build core outreach system - DONE
2. ✅ Build orchestration engine - DONE
3. ✅ Research platform APIs - DONE
4. ⏳ Integrate WhatsApp Business API (Twilio)
5. ⏳ Integrate Twitter API v2
6. ⏳ Integrate Resend for email

### Short-Term (Next 2 Weeks):
1. Build campaign management UI
2. Build prospect enrichment (LinkedIn, Twitter data)
3. Build response classification (AI-powered)
4. Build analytics dashboard

### Medium-Term (Next Month):
1. WhatsApp template approval workflow
2. Multi-account Twitter sender rotation (if hitting limits)
3. Email warm-up automation
4. A/B testing framework for messages

---

## File Structure

```
lib/gtm/
├── wells-outreach-system.ts          # Core outreach engine
├── outreach-orchestrator.ts          # Sending orchestration
├── PLATFORM_API_RESEARCH.md          # Platform capabilities
├── sourcing-qualification.ts         # Step 0: Qualification
├── sourcing-engine.ts                # Steps 1-3: Targeting + Messaging
└── PROPRIETARY_METHOD.md             # 20-year methodology

app/api/gtm/
├── outreach/
│   ├── campaigns/route.ts            # Campaign CRUD
│   ├── prospects/route.ts            # Prospect enrollment
│   ├── send/route.ts                 # Manual send trigger
│   └── analytics/route.ts            # Campaign metrics
└── webhooks/
    ├── whatsapp/route.ts             # WhatsApp replies
    ├── twitter/route.ts              # Twitter DM replies
    └── email/route.ts                # Email replies
```

---

## Key Decisions

### 1. Why NOT LinkedIn?
- NO official API for cold outreach
- All automation tools violate LinkedIn TOS
- High ban risk
- Email deliverability already bad - don't make it worse

### 2. Why WhatsApp-First?
- 98% open rate (vs 15% email)
- 45-60 second average response time
- Professional business messaging platform
- 2B+ users globally
- Template approval = compliance-friendly

### 3. Why NOT Instagram/Facebook Messenger?
- Instagram: Can only message users who messaged you first
- Messenger: Requires Click-to-Messenger ads ($0.50-2.00 per message)
- WhatsApp is superior for business outreach

### 4. Why Multi-Channel?
- Email-only = 70% deliverability loss
- Multi-channel = 3x cost but 5-10x results
- Diversification = resilience to platform changes

---

Built with the 20-year sourcing methodology.
Adapted for the reality of 2025: Email is dying, messaging is winning.
