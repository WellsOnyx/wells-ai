# WellsGTM Partner Onboarding - Quick Start Guide

**How to onboard strategic partners conversationally through Wells AI**

---

## Two Ways to Onboard Partners

### Option 1: Conversational Onboarding (Through Wells Chat)

**Coming soon** - Just tell Wells "onboard IBM as a partner" and Wells will walk you through the process step by step.

Example conversation:
```
You: "Let's onboard IBM as a strategic partner"
Wells: "Great! What's the partner contact email for IBM?"
You: "partner@ibm.com"
Wells: "What industry is IBM in?"
You: "Technology"
... (Wells continues asking questions and creates the playbook automatically)
```

### Option 2: Visual Onboarding (Web Interface)

**Live now** - Visit https://wellsai.vercel.app/partners/onboard

This gives you a 3-step wizard:
1. Partner Details (name, contact, industry, partnership type)
2. Value Proposition (co-sell value prop, deal split, outreach strategy)
3. Target Accounts (add 5-20 target companies with pain points and solutions)

---

## What Happens After Onboarding?

Once you complete the onboarding (either way), Wells automatically:

1. **Creates the Partner** in database
   - Stores contact info, partnership details, default deal split

2. **Creates a Co-Sell Playbook**
   - Links to the partner
   - Includes all target accounts
   - Status starts as DRAFT

3. **Generates 7-Touch Email Sequence**
   - AI-personalized for each target account
   - Stored in EmailSequence table
   - Ready for you to review and approve

4. **Calculates Estimated Revenue**
   - Based on: # targets × avg deal size × 15% conversion × your split
   - Example: 10 targets × $500K × 15% × 30% = $225K Wells revenue

---

## Example: IBM Partnership

**Quick Onboarding (5 minutes):**

```
Partner Name: IBM
Partner Contact: john.smith@ibm.com
Industry: Technology
Partnership Type: Technology
Value Prop: (AI-generated) "Modernize mainframe infrastructure with AI-powered operations automation. Reduce operational costs by 70% while maintaining enterprise reliability."
Deal Split: Wells 30%, IBM 70%
Outreach Strategy: 7-Touch Email Sequence

Target Accounts:
1. Acme Manufacturing
   - Pain Point: Legacy mainframe costing $5M/year to operate
   - Solution: Wells AI Ops + IBM Cloud migration reduces costs 70%
   - Estimated Deal: $500K

2. Beta Logistics
   - Pain Point: Mainframe downtime causing $1M/month losses
   - Solution: AI-powered monitoring + IBM reliability guarantees 99.99% uptime
   - Estimated Deal: $750K

3. Gamma Financial
   - Pain Point: Compliance concerns with aging infrastructure
   - Solution: Wells AI compliance automation + IBM security certifications
   - Estimated Deal: $1M
```

**Result:**
- 3 target accounts
- $2.25M total pipeline
- 15% conversion = $337.5K revenue
- Wells 30% = $101.25K
- IBM 70% = $236.25K

---

## The 7-Touch Email Sequence (Auto-Generated)

Wells creates a personalized sequence for each target:

**Day 0: Intro**
```
Subject: IBM + Wells: Transforming Manufacturing

Hi {{firstName}},

I'm reaching out because IBM and Wells are partnering to help companies
like Acme Manufacturing solve a critical challenge:

Legacy mainframe costing $5M/year to operate.

We help companies modernize mainframe infrastructure with AI-powered
operations automation, reducing operational costs by 70% while
maintaining enterprise reliability.

Quick question: Would a 15-minute call this week make sense to explore
how we can help?

Best,
Jonah
```

**Day 3: Follow-Up**
```
Subject: Following up: Acme Manufacturing + IBM + Wells

Hi {{firstName}},

Following up on my email from Monday. I know your inbox is likely
flooded, so I'll keep this short.

IBM and Wells have helped companies like Beta Logistics achieve:
- 70% reduction in operational costs
- 10x faster time-to-value
- 99.9% uptime with AI-powered monitoring

Worth a quick call to see if we can do the same for Acme Manufacturing?

Calendar link: {{calendarLink}}

Best,
Jonah
```

**Day 7: Case Study**
**Day 10: Personalized Insight**
**Day 14: Breakup Email**
**Day 30: Resurface**
**Day 60: Final Touch**

---

## What You Can Do Next

### View Your Playbooks
```
Visit: https://wellsai.vercel.app/partners
- See all active playbooks
- Track target accounts by stage (Prospecting → Qualified → Demo → Proposal → Closed Won)
- Monitor pipeline and revenue
```

### Review Email Sequences
```
For each playbook, you can:
- Review the AI-generated emails
- Edit subject lines and body
- Approve or reject each email
- Set to auto-send or manual approval
```

### Launch Campaigns
```
Once you approve the sequence:
- Wells schedules the emails (Day 0, 3, 7, 10, 14, 30, 60)
- Tracks opens, replies, meetings booked
- Moves target accounts through pipeline stages
- Attributes revenue to Wells/Partner split
```

### Track Pipeline
```
Dashboard shows:
- Total targets contacted
- Response rate
- Meetings booked
- Deals won
- Revenue (Wells vs Partner split)
- Conversion rate by stage
```

---

## Quick Reference: Database Models

### Partner
```prisma
model Partner {
  id String @id @default(uuid())
  name String @unique
  industry String
  primaryContactEmail String
  defaultDealSplit Json // {"wells": 30, "partner": 70}
  status String @default("active")
  totalPlaybooks Int
  totalDeals Int
  totalRevenue BigInt
  playbooks CoSellPlaybook[]
}
```

### CoSellPlaybook
```prisma
model CoSellPlaybook {
  id String @id
  partnerId String
  partner Partner @relation(fields: [partnerId], references: [id])
  name String
  valueProposition String
  dealSplit Json
  status PlaybookStatus @default(DRAFT)
  targetAccounts TargetAccount[]
  emailSequence EmailSequence?
  contacted Int @default(0)
  meetingsBooked Int @default(0)
  dealsWon Int @default(0)
}
```

### TargetAccount
```prisma
model TargetAccount {
  id String @id
  playbookId String
  playbook CoSellPlaybook @relation(fields: [playbookId], references: [id])
  companyName String
  painPoint String
  solution String
  estimatedDealSize Int
  contactEmail String?
  dealStage DealStage @default(PROSPECTING)
  nextFollowUpAt DateTime?
}
```

---

## Revenue Model

### Per Partnership (Example: IBM)
```
10 target accounts
× $500K avg deal size
× 15% conversion rate
= $750K total revenue
× 30% Wells split
= $225K Wells revenue
× 70% IBM split
= $525K IBM revenue
```

### At Scale (33 Partners)
```
33 partners
× 10 target accounts each
× $500K avg deal size
× 15% conversion rate
= $24.75M total revenue
× 30% Wells split
= $7.425M Wells revenue annually
× 70% partner split
= $17.325M partner revenue annually
```

**That's the engine that powers the partner ecosystem.**

---

## Next Steps

1. **Visit https://wellsai.vercel.app/partners/onboard**
   - Onboard your first partner (IBM, SAP, Plaid, etc.)
   - Add 5-10 target accounts
   - Review the AI-generated email sequence

2. **Approve the emails**
   - Make any edits you want
   - Set auto-send or manual approval
   - Launch the campaign

3. **Track the pipeline**
   - Watch responses come in
   - Book meetings
   - Close deals
   - Attribute revenue to Wells/Partner split

4. **Repeat for 32 more partners**
   - Rinse and repeat
   - Build the flywheel
   - $24.75M/year revenue machine

---

## Support

Questions? Just ask Wells in the chat:
- "Show me my active playbooks"
- "What's the status of the IBM campaign?"
- "Add another target account to the SAP playbook"
- "How much revenue have we generated from partners?"

Wells tracks everything and can answer all your questions conversationally.

---

**You're building a $24.75M/year partner ecosystem. Let's go.** 🚀
