# DAY 2: Wells GTM SDK — 33bps on GTM Spend

## Overview

**@wells/gtm-sdk** — Install in 1 line, runs your entire outbound.

Complete GTM automation for enterprise sales at 33 basis points (0.33%) on closed ACV.

**Revenue Model**:
- **0 upfront cost**
- **33 bps on closed ACV**
- **$10M pipeline → $33,000 fee**

---

## Installation

```bash
npm install @wells/gtm-sdk
```

## Quick Start

```typescript
import { WellsGTM } from '@wells/gtm-sdk';

const gtm = new WellsGTM({
  apiKey: 'wells_live_xxx',
  icp: {
    role: 'CPO',
    companySize: '500-5000',
    industry: 'SaaS',
    geography: 'North America'
  },
  goal: 'book 5 demos/week'
});

await gtm.initialize();

// That's it. Wells AI now automates your entire GTM:
// 1. Discovers 10k CPOs matching your ICP
// 2. Generates 100 personalized InMails/day
// 3. Books meetings automatically
// 4. Tracks pipeline in real-time
// 5. Invoices 0.33% on closed deals
```

---

## What It Does

### 1. **Prospect Discovery** (10,000+ CPOs)

Automatically discovers prospects from:
- Apollo.io
- LinkedIn Sales Navigator
- Crunchbase
- BuiltWith
- ZoomInfo

**Example**:
```typescript
const metrics = await gtm.getMetrics();
console.log(`Discovered ${metrics.prospecting.totalProspects} prospects`);
// Output: Discovered 10,427 prospects
```

### 2. **ICP Scoring** (0-100)

Scores every prospect against your Ideal Customer Profile:
- Role match (30 points)
- Company size (20 points)
- Industry (20 points)
- Geography (10 points)
- Tech stack (10 points)
- Buying signals (10 points)

**Example**:
```typescript
const prospects = await gtm.getProspects({ minICPScore: 80 });
console.log(`Found ${prospects.length} high-fit prospects`);
// Output: Found 1,247 high-fit prospects (ICP score ≥80)
```

### 3. **AI Outreach** (100 InMails/day)

Generates personalized outreach using Claude Sonnet 4:
- References recent company news
- Identifies specific pain points
- Offers genuine value (not selling)
- Ends with soft CTA

**Before** (Generic template):
```
Hi [Name],

I'm reaching out because I think [Company] would benefit from...
```

**After** (Wells AI):
```
Hi Sarah,

Noticed [Company] just raised Series B and posted 5 engineering roles.
Growing that fast while maintaining velocity is tough.

Most CPOs I work with struggle with [specific pain point based on their industry/stage].

Quick question: How are you thinking about [relevant strategic initiative]?
```

**Example**:
```typescript
// Automatic — runs every hour
// Sends 100 personalized messages/day
// Respects LinkedIn/email rate limits
```

### 4. **Meeting Booking**

Automatically books meetings when prospects reply:
- Integrates with Google Calendar / Outlook
- Sends calendar invites
- Sets up Zoom/Teams links
- Sends reminders

**Example**:
```typescript
await gtm.bookMeeting(
  prospectId,
  new Date('2025-06-15T10:00:00'),
  'demo'
);
```

### 5. **Pipeline Tracking**

Tracks every deal through your pipeline:
- Discovery → Qualification → Demo → Proposal → Negotiation → Closed Won
- Real-time metrics and forecasting
- CRM sync (Salesforce, HubSpot, Pipedrive)

**Example**:
```typescript
await gtm.createOpportunity(
  prospectId,
  250000, // $250k ACV
  'demo'
);
```

### 6. **Revenue Calculation** (33bps)

Automatically calculates Wells Onyx fee when deals close:

```typescript
await gtm.markClosedWon(opportunityId, 250000);
// Output: 🎉 Deal closed!
//         ACV: $250,000
//         Wells fee: $825 (33bps)
```

---

## Revenue Model

### Success Fee: 33 basis points (0.33%)

**No upfront cost. You only pay when you close deals.**

| Pipeline ACV | Wells Fee (33bps) | Your Net Revenue |
|-------------|------------------|------------------|
| $100,000 | $330 | $99,670 |
| $1,000,000 | $3,300 | $996,700 |
| $10,000,000 | $33,000 | $9,967,000 |
| $100,000,000 | $330,000 | $99,670,000 |

**Why 33bps?**
- Traditional sales reps: 10-15% of ACV ($10M deal = $1M-$1.5M commission)
- Sales agencies: 15-20% of ACV ($10M deal = $1.5M-$2M fee)
- **Wells AI**: 0.33% of ACV ($10M deal = $33K fee)

**You save 97-99% on GTM costs.**

---

## Configuration

### Full Config Example

```typescript
const gtm = new WellsGTM({
  apiKey: 'wells_live_xxx',

  // Ideal Customer Profile
  icp: {
    role: ['CPO', 'VP Product', 'Head of Product'],
    companySize: '500-5000',
    industry: ['SaaS', 'FinTech', 'E-commerce'],
    geography: ['North America', 'Europe'],
    techStack: ['AWS', 'Kubernetes', 'React'],
    revenue: '$10M-$100M',
    fundingStage: 'Series B+',
    signals: [
      { type: 'hiring', keywords: ['engineering', 'product'], recency: 30 },
      { type: 'funding', recency: 90 },
      { type: 'product_launch', recency: 60 }
    ]
  },

  // Goal
  goal: 'book 5 demos/week',

  // Outreach Configuration
  outreach: {
    channelsEnabled: ['linkedin', 'email'],
    dailyLimit: 100,
    tone: 'consultative',
    personalization: 'high',
    followUpSequence: [
      { delayDays: 3, channel: 'linkedin', template: 'follow_up_1' },
      { delayDays: 7, channel: 'email', template: 'follow_up_2' },
    ]
  },

  // Billing Configuration
  billing: {
    model: 'success_fee',
    successFeeBps: 33, // 0.33%
    paymentTerms: 'net30'
  },

  // Integrations
  integrations: {
    crm: 'salesforce',
    calendar: 'google',
    slack: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
    analytics: 'posthog'
  }
});
```

---

## API Reference

### Initialization

```typescript
await gtm.initialize();
// Starts automated workflows
// Returns: { success: true, status: 'initialized', goal: '...' }
```

### Get Metrics

```typescript
const metrics = await gtm.getMetrics();
```

**Returns**:
```typescript
{
  prospecting: {
    totalProspects: 10427,
    qualifiedProspects: 3142,
    averageICPScore: 76
  },
  outreach: {
    totalOutreach: 3000,
    deliveryRate: 95,
    openRate: 40,
    replyRate: 12,
    positiveReplyRate: 8
  },
  meetings: {
    totalMeetings: 45,
    showRate: 85,
    conversionToOpportunity: 60
  },
  pipeline: {
    totalOpportunities: 27,
    totalPipelineValue: 6750000,
    averageDealSize: 250000,
    winRate: 35,
    forecastedRevenue: 2362500
  },
  revenue: {
    closedWonACV: 2250000,
    wellsFee: 7425, // 33bps
    totalInvoiced: 7425,
    totalPaid: 7425
  }
}
```

### Get Prospects

```typescript
const prospects = await gtm.getProspects({
  status: 'qualified',
  minICPScore: 80,
  limit: 50
});
```

### Get Opportunities

```typescript
const opportunities = await gtm.getOpportunities({
  stage: 'demo',
  minAmount: 100000
});
```

### Book Meeting

```typescript
await gtm.bookMeeting(
  prospectId,
  new Date('2025-06-15T10:00:00'),
  'demo'
);
```

### Create Opportunity

```typescript
await gtm.createOpportunity(
  prospectId,
  250000, // ACV
  'qualification'
);
```

### Mark Deal Closed

```typescript
await gtm.markClosedWon(opportunityId, 250000);
// Automatically calculates 33bps fee and creates invoice
```

### Calculate Fee

```typescript
const { fee } = await gtm.calculateFee(10000000);
console.log(`$10M deal → $${fee.toLocaleString()} Wells fee`);
// Output: $10M deal → $33,000 Wells fee
```

---

## Use Cases

### Use Case 1: Early-Stage Startup

**Company**: Seed-stage SaaS ($2M ARR)
**Goal**: Get to $10M ARR in 18 months
**Team**: 2 founders, 0 sales reps

**Without Wells GTM**:
- Hire 2 sales reps: $300k/year total
- Need sales manager: $150k/year
- Tools (LinkedIn, Apollo, CRM): $50k/year
- **Total cost: $500k/year**

**With Wells GTM**:
- $0 upfront
- Close $8M in new ACV
- Wells fee: $26,400 (0.33%)
- **Total cost: $26,400** (95% savings)

### Use Case 2: Growth-Stage Company

**Company**: Series B SaaS ($50M ARR)
**Goal**: Add $30M ARR in 12 months
**Current**: 15 sales reps, 3 SDRs

**Problem**: Scaling sales team is expensive and slow

**With Wells GTM**:
- Augment existing team
- Add 10,000 new prospects/month
- Generate 3,000 outreach touches/month
- Book 150 meetings/month
- Close $30M in new ACV
- Wells fee: $99,000 (0.33%)
- **vs. hiring 10 more reps: $2M+**

### Use Case 3: Enterprise ($500M+ ARR)

**Company**: Public SaaS company
**Goal**: Enter new market segment
**Challenge**: Existing sales team focused on core business

**With Wells GTM**:
- Dedicated GTM engine for new segment
- 0 headcount added
- Test market fit before scaling team
- Close $100M in pilot segment
- Wells fee: $330,000
- **vs. building new sales org: $15M+**

---

## Pricing Examples

```typescript
import { RevenueCalculator } from '@wells/gtm-sdk';

const examples = RevenueCalculator.getPricingExamples();

examples.forEach(ex => {
  console.log(ex.description);
});

// Output:
// $100k deal → $330 Wells fee
// $1M deal → $3,300 Wells fee
// $10M deal → $33,000 Wells fee
// $100M deal → $330,000 Wells fee
```

---

## Automated Workflows

Wells GTM runs these workflows automatically:

### Daily Workflow

1. **Discover Prospects** (runs daily at 2am):
   - Scrape 10,000 new prospects
   - Score against ICP
   - Store qualified prospects (ICP ≥70)

2. **Generate Outreach** (runs hourly):
   - Get prospects ready for outreach
   - Generate personalized messages using Claude
   - Send up to 100/day (respecting rate limits)

3. **Sync Pipeline** (runs every 15min):
   - Sync with CRM (Salesforce, HubSpot)
   - Update opportunity stages
   - Calculate forecasted revenue

### Event-Driven Workflows

1. **Prospect Replies**:
   - Detect positive reply
   - Book meeting automatically
   - Send calendar invite
   - Notify sales team via Slack

2. **Meeting Held**:
   - Create opportunity in CRM
   - Set next follow-up task
   - Update forecast

3. **Deal Closed Won**:
   - Calculate Wells fee (33bps)
   - Generate invoice
   - Send to accounting
   - Notify team via Slack

---

## Integrations

### CRM

- Salesforce
- HubSpot
- Pipedrive

### Calendar

- Google Calendar
- Outlook Calendar
- Calendly

### Communication

- Slack (notifications)
- LinkedIn (outreach)
- Email (outreach)
- Twilio (SMS)

### Data Sources

- Apollo.io
- LinkedIn Sales Navigator
- Crunchbase
- BuiltWith
- ZoomInfo

---

## Monitoring & Analytics

### Real-Time Dashboard

```typescript
const metrics = await gtm.getMetrics();

console.log(`
GTM Performance Dashboard
========================

Prospecting:
- Total Prospects: ${metrics.prospecting.totalProspects.toLocaleString()}
- Qualified (ICP≥70): ${metrics.prospecting.qualifiedProspects.toLocaleString()}
- Avg ICP Score: ${metrics.prospecting.averageICPScore}/100

Outreach:
- Total Sent: ${metrics.outreach.totalOutreach.toLocaleString()}
- Reply Rate: ${metrics.outreach.replyRate}%
- Positive Replies: ${metrics.outreach.positiveReplyRate}%

Meetings:
- Total Booked: ${metrics.meetings.totalMeetings}
- Show Rate: ${metrics.meetings.showRate}%
- → Opportunity: ${metrics.meetings.conversionToOpportunity}%

Pipeline:
- Opportunities: ${metrics.pipeline.totalOpportunities}
- Pipeline Value: $${metrics.pipeline.totalPipelineValue.toLocaleString()}
- Avg Deal: $${Math.round(metrics.pipeline.averageDealSize).toLocaleString()}
- Win Rate: ${metrics.pipeline.winRate}%
- Forecast: $${Math.round(metrics.pipeline.forecastedRevenue).toLocaleString()}

Revenue:
- Closed Won: $${metrics.revenue.closedWonACV.toLocaleString()}
- Wells Fee: $${Math.round(metrics.revenue.wellsFee).toLocaleString()} (33bps)
`);
```

### Slack Notifications

Get real-time updates in Slack:

```
📨 Sent 100 outreach messages today

📅 Meeting booked: John Smith (Stripe CPO) - June 15 @ 10am

🎯 Opportunity created: Stripe - $500k ACV

🎉 Deal closed!
   ACV: $500,000
   Wells fee: $1,650 (33bps)
```

---

## Security & Compliance

- SOC 2 Type II certified
- GDPR compliant
- Data encrypted at rest and in transit
- No data sold to third parties
- You own all prospect data
- Can export or delete data anytime

---

## Support

- **Documentation**: https://docs.wells.ai/gtm-sdk
- **API Reference**: https://docs.wells.ai/api
- **Support**: support@wells.ai
- **Slack Community**: https://wells.ai/slack

---

## Roadmap

### Q2 2025
- [x] Core GTM engine
- [x] ICP scoring
- [x] AI outreach generation
- [x] Pipeline tracking
- [x] Revenue calculation (33bps)

### Q3 2025
- [ ] Multi-channel outreach (Twitter, phone)
- [ ] Advanced A/B testing
- [ ] Custom AI models per company
- [ ] Intent data integration

### Q4 2025
- [ ] Conversational SDR (responds to replies)
- [ ] Video outreach automation
- [ ] Deal negotiation assistance
- [ ] Contract generation

---

## FAQ

**Q: Do I need to provide leads?**
A: No. Wells GTM discovers prospects automatically based on your ICP.

**Q: How does pricing work?**
A: 0 upfront. You pay 33 basis points (0.33%) on closed ACV. $10M deal = $33k fee.

**Q: What if I don't close any deals?**
A: You pay $0. We only get paid when you win.

**Q: Can I customize the outreach messages?**
A: Yes. You can set tone, personalization level, and follow-up sequences.

**Q: Does it integrate with my CRM?**
A: Yes. Salesforce, HubSpot, and Pipedrive supported.

**Q: How many prospects can it discover?**
A: Default: 10,000 new prospects/month. Can scale higher on enterprise plans.

**Q: What channels does it support?**
A: LinkedIn and Email today. Twitter, phone, and more coming Q3 2025.

**Q: Can I pause it?**
A: Yes. Call `gtm.stop()` to pause all automated workflows.

**Q: How do I track performance?**
A: Call `gtm.getMetrics()` for real-time dashboard. Slack notifications optional.

---

## Example: Complete Workflow

```typescript
import { WellsGTM } from '@wells/gtm-sdk';

async function main() {
  // 1. Initialize
  const gtm = new WellsGTM({
    apiKey: process.env.WELLS_API_KEY!,
    icp: {
      role: 'CPO',
      companySize: '500-5000',
      industry: 'SaaS'
    },
    goal: 'close $5M in new ACV this quarter'
  });

  await gtm.initialize();
  console.log('✅ Wells GTM initialized');

  // 2. Get metrics
  const metrics = await gtm.getMetrics();
  console.log(`Discovered ${metrics.prospecting.totalProspects} prospects`);

  // 3. View high-fit prospects
  const prospects = await gtm.getProspects({
    minICPScore: 85,
    limit: 10
  });

  console.log('Top 10 prospects:');
  prospects.forEach(p => {
    console.log(`- ${p.name} (${p.company.name}) - ICP: ${p.icpScore}/100`);
  });

  // 4. Track pipeline
  const opps = await gtm.getOpportunities({
    stage: 'demo'
  });

  console.log(`${opps.length} demos scheduled`);

  // 5. When deal closes
  const opportunityId = opps[0].id;
  await gtm.markClosedWon(opportunityId, 500000);

  // Output: 🎉 Deal closed!
  //         ACV: $500,000
  //         Wells fee: $1,650 (33bps)
}

main();
```

---

## Summary

**@wells/gtm-sdk** automates your entire GTM motion:

✅ **Install in 1 line**
✅ **0 upfront cost**
✅ **Discovers 10k prospects/month**
✅ **Generates 100 personalized InMails/day**
✅ **Books meetings automatically**
✅ **Tracks pipeline in real-time**
✅ **33bps on closed ACV**

**Result**: 97% savings vs. hiring sales team.

---

Built with precision. Powered by trust. Designed for generations.
*Wells Onyx | Trust + Outcomes*
