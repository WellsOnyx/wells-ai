# Wells AI - GTM Playbook

## Go-To-Market Strategy

### The Pitch

**Wells AI is a neutral conversational commerce platform** that matches buyers with sellers across any B2B category - from semiconductors to executive search.

**The Opportunity:** We're launching Category Pioneers - a partnership program where companies pioneer new procurement categories and earn perpetual revenue share.

---

## How to Sell Category Pioneers

### Target Prospects

**Ideal Category Pioneers:**
1. **Market Leaders** in established categories
   - Example: Industrial automation companies, robotics manufacturers
   - They have supplier networks, domain expertise

2. **Niche Specialists** looking to expand reach
   - Example: Injection molding shops, freight brokers
   - They want more visibility without sales overhead

3. **Consulting/Agency Firms** with client networks
   - Example: Executive search firms, compliance consultancies
   - They can become category experts on the platform

### The Value Prop

**For Category Pioneers:**
- 🎯 **First Mover Advantage** - Exclusive category ownership
- 💰 **Perpetual Passive Income** - Earn 20-50% of ALL transaction fees forever
- 🚀 **4-Week Sprint** - We co-build the category together
- 📈 **No Upfront Cost** - Revenue share only (no retainer, no fees)
- 🏆 **Featured Placement** - Your brand on our homepage

**Economics Example:**
```
Category: Injection Molding (Tier 2 - 35%)
Year 2 Projected Volume: $38M
Wells AI Fees (33bps): $125,400
Your Share (35%): $43,890/year
Wells Onyx Net: $81,510/year
```

### The Pitch Email Template

```
Subject: Pioneer the [CATEGORY] category on Wells AI

[NAME],

I noticed [COMPANY] is a leader in [CATEGORY]. We're building Wells AI - a conversational commerce platform for B2B procurement.

We're launching Category Pioneers - companies that co-build procurement categories with us and earn perpetual revenue share.

The opportunity:
• Pioneer the [CATEGORY] category (exclusive)
• Earn 20-50% of ALL transaction fees in your category
• Example: [MARKET SIZE] market → ~$[REVENUE]K/year potential
• 4-week co-build sprint (no upfront cost)

We're talking to [COMPETITOR 1] and [COMPETITOR 2] as well. First company to sign gets exclusive rights.

Interested in a 30-min intro call?

Best,
[YOUR NAME]
```

---

## Complete Flow

### Step 1: Prospect Discovery

**Manual Outreach:**
1. Identify category gap (e.g., "We need cybersecurity services")
2. Research market leaders
3. Send Category Pioneer pitch
4. Book intro call

**Inbound Flow:**
1. Prospect visits Wells AI and requests new category
2. Partnership pitch appears automatically
3. They select tier and book call
4. Partnership auto-created in Notion

### Step 2: Intro Call (30 min)

**Agenda:**
1. Confirm category fit (5 min)
2. Explain partnership tiers (10 min)
3. Review requirements (10 min)
4. Next steps (5 min)

**Key Questions:**
- What's your supplier network look like?
- Can you commit 10+ qualified suppliers?
- What's your availability for 4-week sprint?
- Any competitors we should avoid partnering with?

**After Call:**
```bash
curl -X POST http://localhost:3000/api/partnerships/update \
  -H "Content-Type: application/json" \
  -d '{
    "partnershipId": "notion_page_id",
    "status": "🔵 Agreement Sent",
    "introCallDate": "2025-10-30"
  }'
```

### Step 3: Send Agreement

**24-Hour Turnaround:**
1. Use template partnership agreement
2. Customize for tier and category
3. Send via DocuSign
4. Follow up in 48 hours

**Agreement Signed:**
```bash
curl -X POST http://localhost:3000/api/partnerships/update \
  -H "Content-Type: application/json" \
  -d '{
    "partnershipId": "notion_page_id",
    "status": "✅ Live",
    "agreementSignedDate": "2025-11-05",
    "goLiveDate": "2025-11-15",
    "agreementUrl": "https://..."
  }'
```

### Step 4: 4-Week Build Sprint

**Week 1: ICP & Positioning**
- Partner shares ideal customer profile
- We analyze their historical deals
- Define category positioning

**Week 2: Supplier Network**
- Partner introduces 10+ qualified suppliers
- We onboard suppliers to platform
- Set up supplier profiles

**Week 3: AI Training**
- Train Claude on category specifics
- Partner provides industry knowledge
- Test matching algorithm

**Week 4: Launch Prep**
- Set pricing models
- Create category page
- Test end-to-end flow

### Step 5: Category Launch

**Go-Live Checklist:**
- [ ] 10+ suppliers onboarded
- [ ] AI trained on category
- [ ] Category page live
- [ ] Partnership status: ✅ Live
- [ ] Partner featured on homepage
- [ ] Press release drafted

**Launch Announcement:**
```
🎉 Announcing our partnership with [COMPANY]!

[COMPANY] has pioneered the [CATEGORY] category on Wells AI.

Starting today, companies can source [CATEGORY] through conversational commerce - no forms, no portals, just intelligent matching.

[PARTNER QUOTE]

Try it now: [LINK]
```

### Step 6: Revenue Tracking (Automatic)

When deals close, system automatically:
1. Detects category partnership
2. Updates "Total Category Revenue"
3. Calculates partner share (formula-based)
4. Creates activity log entry
5. Displays on partner dashboard

**Monthly Revenue Report:**
```
Category: Injection Molding
Partner: Acme Plastics (Tier 2 - 35%)

This Month:
- Deals Closed: 3
- Total Volume: $1.2M
- Wells AI Fees: $3,960
- Your Share: $1,386
- YTD Total: $12,450

Next Payment: Nov 30, 2025
```

---

## Objection Handling

### "How do I know deals will actually close?"

**Response:**
"Great question. We're already processing deals in 10+ categories with $5M+ annual GMV. Your category has a [$X] market size with clear demand. During our 4-week sprint, we'll validate demand together. If we don't see traction in 90 days, we can adjust the tier or pause the partnership."

### "What if you partner with my competitor after me?"

**Response:**
"We won't. The partnership agreement gives you exclusive rights to the category. Once you sign, we will not accept other partners in [CATEGORY]. That's the value of being the Category Pioneer - you own it."

### "20-50% seems high. Why not just pay you for leads?"

**Response:**
"Because this isn't lead gen - it's co-ownership. You're not just referring deals, you're:
- Building the category with us (supplier network, AI training)
- Maintaining quality standards
- Growing the category long-term
- Earning on ALL deals (not just yours)

It's perpetual passive income vs one-time lead fees."

### "How much time commitment is this?"

**Response:**
"Depends on tier:
- Tier 1 (20%): ~10 hours over 4 weeks + quarterly reviews
- Tier 2 (35%): ~20 hours over 4 weeks + monthly check-ins
- Tier 3 (50%): ~40 hours over 4 weeks + ongoing management

After launch, it's mostly passive. The platform runs itself."

### "What if I don't meet performance requirements?"

**Response:**
"We'll work with you first. Performance requirements are realistic (e.g., maintain 10+ suppliers, respond to escalations within 48 hours). If there are issues, we'll:
1. Identify the gap together
2. Create improvement plan
3. Give 90 days to course-correct
4. Only as last resort: downgrade tier or pause

We want you to succeed - your success is our success."

---

## Pricing Tiers Decision Tree

### When to recommend Tier 1 (20%)

**Good fit:**
- Large established companies
- Want strategic alignment
- Don't want operational burden
- Have supplier network but limited time
- Example: Fortune 500 manufacturer

### When to recommend Tier 2 (35%) ⭐ MOST POPULAR

**Good fit:**
- Mid-market companies
- Want growth without heavy lifting
- Can commit to active partnership
- Have domain expertise + network
- Example: Regional industrial distributor

### When to recommend Tier 3 (50%)

**Good fit:**
- Niche specialists
- Want category ownership
- Can commit significant time
- Have operational capacity
- Example: Boutique consulting firm

---

## Cold Outreach Sequences

### Sequence 1: LinkedIn Approach

**Day 1 - Connection Request:**
```
Hi [NAME] - saw [COMPANY]'s work in [CATEGORY]. Building something in B2B procurement you might find interesting. Would love to connect!
```

**Day 3 - Initial Message:**
```
Thanks for connecting! Quick question: is [COMPANY] looking to expand reach in [CATEGORY] without adding sales overhead?

We're launching Category Pioneers - companies earn perpetual revenue share for pioneering procurement categories on our platform.

Example: [MARKET SIZE] market → ~$[REVENUE]K/year potential (zero upfront cost)

Worth a 15-min call?
```

**Day 7 - Value Add:**
```
[NAME] - thought you'd find this interesting:

[Share relevant market report / industry insight]

Still thinking about the Category Pioneer opportunity? First mover advantage is real - once someone signs for [CATEGORY], we won't accept competitors.
```

**Day 14 - Last Touch:**
```
Last ping! We're finalizing our [CATEGORY] pioneer this week.

If [COMPANY] is interested, let me know by Friday. Otherwise, moving forward with [COMPETITOR].

No pressure either way!
```

### Sequence 2: Email Approach

**Email 1 - The Hook:**
```
Subject: [CATEGORY] opportunity - $[X]K/year potential

[NAME],

Quick question: What if every time someone bought [CATEGORY] services, you earned 20-50% of the transaction fee?

That's Category Pioneers - our partnership program for B2B procurement.

Example for [CATEGORY]:
• Market Size: $[X]
• Year 2 Volume: $[X]M
• Your Share (35%): ~$[X]K/year
• Time Commitment: 4-week sprint + quarterly reviews

First mover wins. Interested?

[YOUR NAME]
```

**Email 2 - Social Proof:**
```
Subject: Re: [CATEGORY] opportunity

[NAME],

Wanted to share - ABB just pioneered Industrial Robotics on our platform. Medtronic did Medical Device Manufacturing.

Both earning revenue share on all category deals (perpetual).

Still have [CATEGORY] open. Fits [COMPANY]'s expertise well.

15-min call this week?
```

**Email 3 - Urgency:**
```
Subject: Final call - [CATEGORY] category

[NAME],

This is my last email about the Category Pioneer opportunity.

We're making a decision on [CATEGORY] by Friday. [COMPANY] is our top choice, but we're also talking to [COMPETITOR 1] and [COMPETITOR 2].

If interested: calendly.com/[LINK]

If not: totally understand - will close the door on this.

Thanks,
[YOUR NAME]
```

---

## Success Metrics

### Phase 1: Launch (Months 1-3)

**Goals:**
- 5 Category Pioneer partnerships signed
- 50+ suppliers across all categories
- $500K GMV
- 3 deals closed

**KPIs:**
- Partnership inquiry → signed: >30%
- Avg time to close partnership: <21 days
- Supplier onboarding rate: >10 per category
- First deal in category: <45 days from launch

### Phase 2: Growth (Months 4-12)

**Goals:**
- 20 Category Pioneer partnerships
- 200+ suppliers
- $5M GMV
- $16.5K transaction fees
- $5.8K partner revenue share paid out
- $10.7K Wells Onyx net

**KPIs:**
- Category growth rate: >20% MoM
- Revenue per partnership: >$800/month
- Supplier utilization: >40%
- Customer NPS: >50

### Phase 3: Scale (Year 2)

**Goals:**
- 50 categories
- 500+ suppliers
- $50M GMV
- $165K transaction fees
- $58K partner revenue share
- $107K Wells Onyx net

---

## Tech Stack Usage

### Create Partnership (Automatic from Chat)
When user requests new category → Partnership auto-created

### List Partnerships
```bash
curl http://localhost:3000/api/partnerships/list?status=live
```

### Update Partnership Status
```bash
curl -X POST http://localhost:3000/api/partnerships/update \
  -H "Content-Type: application/json" \
  -d '{
    "partnershipId": "...",
    "status": "✅ Live"
  }'
```

### Get Activity Feed
```bash
curl http://localhost:3000/api/partnerships/activity?limit=10
```

### Close Deal (Auto-updates partnership revenue)
```bash
curl -X POST http://localhost:3000/api/gtm/deals/close \
  -H "Content-Type: application/json" \
  -d '{
    "targetId": "...",
    "dealValue": 500000
  }'
```

---

## Quick Wins

### Week 1: Launch 3 Categories

**Monday:**
- Identify 10 target categories
- Research 3-5 companies per category
- Send initial outreach

**Wednesday:**
- Follow up on responses
- Book 5+ intro calls

**Friday:**
- Complete intro calls
- Send 3 partnership agreements

### Week 2: Build Categories

- Partner provides supplier list
- Onboard 10+ suppliers per category
- Train AI on category specifics
- Set up category pages

### Week 3: Soft Launch

- Test complete flow with partner
- Close first deal in each category
- Verify revenue tracking works
- Partner gets first payment

### Week 4: Public Launch

- Publish category pages
- Send launch announcements
- Update homepage with partners
- Run first GTM campaigns

---

## Red Flags (Don't Partner)

❌ **Company has no supplier network**
- They expect you to do all the work

❌ **Want to partner on competitor's category**
- Creates conflict with existing partnership

❌ **Can't commit to 4-week sprint**
- Shows lack of seriousness

❌ **Want guaranteed revenue**
- Not aligned on risk/reward model

❌ **Bad reputation in industry**
- Will hurt platform credibility

---

## Green Lights (Ideal Partner)

✅ **Market leader** in their category
✅ **10+ year track record** of success
✅ **Active supplier relationships**
✅ **Growth-minded** (not defensive)
✅ **Can commit resources** to sprint
✅ **Excited about partnership model**
✅ **Willing to evangelize** the platform

---

## Legal/Compliance

### Partnership Agreement Must Include

- Category exclusivity clause
- Revenue share % and calculation method
- Performance requirements by tier
- Payment terms (monthly/quarterly/annually)
- Data sharing provisions
- Termination conditions
- Non-compete (can't build competing marketplace)

### Payment Structure

**Recommendation: Quarterly**
- Reduces administrative overhead
- Meaningful payout amounts
- Aligns with business reviews

**Example Payment:**
```
Q4 2025 - Injection Molding

Total Category Revenue: $3.8M
Wells AI Fees (33bps): $12,540
Partner Share (35%): $4,389
Payment Due: January 15, 2026
```

---

## Next Steps to GTM

1. **Setup Notion Databases** (follow NOTION_PARTNERSHIPS_SETUP.md)
2. **Add environment variables** to Vercel
3. **Test complete flow** end-to-end
4. **Create partnership agreement template**
5. **Identify first 10 target categories**
6. **Build target company list** (3-5 per category)
7. **Launch outreach campaign**
8. **Book 10 intro calls** in next 2 weeks
9. **Sign first 3 partnerships**
10. **Build first 3 categories** (4-week sprint each)

---

**Let's ship it and start earning! 🚀**
