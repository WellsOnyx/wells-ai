/**
 * Grain & Vault - Cold Outreach Email Templates
 *
 * Target: Enterprise Treasury/Procurement buyers
 * Goal: Book 10 demos in first month
 *
 * Template Philosophy:
 * - First line = hook (value prop, not company intro)
 * - Short (< 100 words)
 * - Clear CTA (single ask)
 * - Personalization tokens for customization
 */

// =============================================================================
// TYPES
// =============================================================================

export interface EmailTemplate {
  id: string
  name: string
  persona: 'cfo' | 'procurement' | 'controller' | 'treasury' | 'generic'
  stage: 'cold_1' | 'cold_2' | 'cold_3' | 'demo_confirm' | 'no_show' | 'follow_up'
  subject: string
  body: string
  personalizationHooks: string[]
  sendDelay?: number  // days after previous email
}

export interface EmailSequence {
  id: string
  name: string
  persona: string
  templates: EmailTemplate[]
  totalTouches: number
}

// =============================================================================
// PERSONALIZATION TOKENS
// =============================================================================

export const PERSONALIZATION_TOKENS = {
  '{{firstName}}': 'Lead first name',
  '{{company}}': 'Company name',
  '{{industry}}': 'Company industry',
  '{{title}}': 'Job title',
  '{{recentNews}}': 'Recent company news/trigger',
  '{{mutualConnection}}': 'Shared LinkedIn connection',
  '{{specificPainPoint}}': 'Industry-specific pain point',
  '{{estimatedSpend}}': 'Estimated monthly supplier spend',
  '{{potentialYield}}': 'Calculated annual yield potential',
  '{{competitorUsed}}': 'Current payment/treasury solution',
}

// =============================================================================
// CFO / VP FINANCE SEQUENCES
// =============================================================================

export const CFO_COLD_1: EmailTemplate = {
  id: 'cfo-cold-1',
  name: 'CFO Cold Outreach - First Touch',
  persona: 'cfo',
  stage: 'cold_1',
  subject: 'Your treasury is leaving ${{potentialYield}} on the table',
  body: `{{firstName}},

Quick question: what's your idle cash earning right now? 0.1%? Maybe 2% if you're lucky?

We're helping CFOs at manufacturing and distribution companies earn 4.5%+ on their operating cash - while using it for supplier payments at 0% fees.

The model: deposit predictable spend, get 1:1 credit line, pay vendors instantly, earn appreciation on the deposit.

{{recentNews}}

Worth 15 minutes to see if this fits {{company}}?

Best,
[Your name]

P.S. - Our calculator shows {{company}}'s size could generate ${{potentialYield}}/year in treasury yield. Happy to share the math.`,
  personalizationHooks: [
    'Recent funding round or growth announcement',
    'New hire in finance/ops',
    'Industry-specific supply chain news',
    'Quarterly earnings mention of cost optimization',
  ],
}

export const CFO_COLD_2: EmailTemplate = {
  id: 'cfo-cold-2',
  name: 'CFO Cold Outreach - Second Touch (Value Add)',
  persona: 'cfo',
  stage: 'cold_2',
  subject: 'Re: Your treasury is leaving ${{potentialYield}} on the table',
  body: `{{firstName}},

Following up on my note about treasury yield.

Just published a quick analysis: "Why Manufacturing CFOs Are Moving From Money Markets to Treasury-Backed Yield."

TL;DR: Money market funds are paying 4-5%, but treasury-backed stable yield platforms can do the same while also:
- Eliminating 2-3% payment processing fees
- Providing instant settlement (vs 3-5 day ACH)
- Auto-reconciling with your ERP

Not sure if treasury optimization is on your radar right now, but if it is - happy to share how {{company}} could capture this.

15 min call?

[Your name]`,
  personalizationHooks: [
    'Reference specific ERP they use (NetSuite, SAP)',
    'Mention similar company in their industry',
    'Tie to year-end planning cycle',
  ],
  sendDelay: 3,
}

export const CFO_COLD_3: EmailTemplate = {
  id: 'cfo-cold-3',
  name: 'CFO Cold Outreach - Third Touch (Breakup)',
  persona: 'cfo',
  stage: 'cold_3',
  subject: 'Should I close the file?',
  body: `{{firstName}},

I've reached out a couple times about treasury yield optimization for {{company}}.

No response = either:
1. Wrong timing (totally get it)
2. You've already solved this (congrats!)
3. Not a priority right now

If (1) or (3): I'll check back in a few months.

If you ARE thinking about working capital efficiency, just reply "interested" and I'll send a 2-min video showing the model.

Either way, no hard feelings. Thanks for your time.

[Your name]`,
  personalizationHooks: [
    'Keep it short and respectful',
    'Easy response option (just say "interested")',
  ],
  sendDelay: 5,
}

// =============================================================================
// VP PROCUREMENT / CPO SEQUENCES
// =============================================================================

export const PROCUREMENT_COLD_1: EmailTemplate = {
  id: 'procurement-cold-1',
  name: 'Procurement Cold Outreach - First Touch',
  persona: 'procurement',
  stage: 'cold_1',
  subject: 'Pay {{company}}\'s suppliers at 0% fees (seriously)',
  body: `{{firstName}},

Your suppliers probably hate waiting 30-60 days for payment. And you're probably paying 2-3% in card/processing fees to pay them faster.

What if you could:
- Pay suppliers instantly (sub-second settlement)
- 0% payment fees (we charge 1% sourcing fee - COGS, not overhead)
- Capture every early payment discount

We're Grain & Vault. {{company}}'s procurement team could eliminate ~${{estimatedSpend}} in annual payment fees while strengthening supplier relationships.

10-min demo?

[Your name]

P.S. - Suppliers receive USD via normal ACH/wire. No change on their end.`,
  personalizationHooks: [
    'Mention specific supplier challenges in their industry',
    'Reference supplier consolidation or onboarding initiative',
    'Tie to supply chain disruption events',
  ],
}

export const PROCUREMENT_COLD_2: EmailTemplate = {
  id: 'procurement-cold-2',
  name: 'Procurement Cold Outreach - Second Touch',
  persona: 'procurement',
  stage: 'cold_2',
  subject: 'Re: Pay {{company}}\'s suppliers at 0% fees',
  body: `{{firstName}},

Quick follow-up. Ran some numbers for {{industry}} companies like {{company}}:

On $500K/month supplier spend:
- Current cost (2.5% card fees): $150K/year
- With Grain & Vault (1% sourcing): $60K/year
- Savings: $90K/year

Plus: deposits earn 4.5%+ annually. On $500K deposit = $22,500/year yield.

Total annual value: $112,500

These are real numbers from similar {{industry}} companies. Happy to run {{company}}'s specific scenario.

15 minutes to explore?

[Your name]`,
  personalizationHooks: [
    'Customize spend estimates based on company size',
    'Reference their specific industry benchmarks',
  ],
  sendDelay: 3,
}

export const PROCUREMENT_COLD_3: EmailTemplate = {
  id: 'procurement-cold-3',
  name: 'Procurement Cold Outreach - Third Touch',
  persona: 'procurement',
  stage: 'cold_3',
  subject: 'Case study: How [Similar Company] cut payment fees by 60%',
  body: `{{firstName}},

Last touch, promise.

Just wrapped a case study with a {{industry}} company similar to {{company}}:

Before Grain & Vault:
- $2M/month supplier spend
- Net-45 average payment terms
- 2.5% card processing fees
- Manual AP reconciliation

After:
- Same $2M/month spend
- Net-0 (instant settlement)
- 1% sourcing fee (60% savings)
- Auto-reconciliation with NetSuite
- $90K/year deposit appreciation

If this resonates, reply and I'll send the full study.

If not the right time, I'll follow up in 6 months.

[Your name]`,
  personalizationHooks: [
    'Use actual case study from similar industry',
    'Match their ERP in the story',
  ],
  sendDelay: 5,
}

// =============================================================================
// CONTROLLER / AP DIRECTOR SEQUENCES
// =============================================================================

export const CONTROLLER_COLD_1: EmailTemplate = {
  id: 'controller-cold-1',
  name: 'Controller Cold Outreach - First Touch',
  persona: 'controller',
  stage: 'cold_1',
  subject: 'End payment reconciliation headaches at {{company}}',
  body: `{{firstName}},

How many hours does your team spend on payment reconciliation each month? If you're like most controllers we talk to: too many.

Grain & Vault eliminates that pain:
- One-click supplier payments
- Automatic three-way match
- Real-time sync to your ERP (we integrate with {{competitorUsed}})
- Zero failed payments (no ACH failures, no chargebacks)

Plus: your operating cash earns 4.5%+ while waiting to be paid out.

We're working with several {{industry}} companies right now. Worth a quick demo?

[Your name]`,
  personalizationHooks: [
    'Reference their ERP system',
    'Tie to month-end close timing',
    'Mention audit season if applicable',
  ],
}

export const CONTROLLER_COLD_2: EmailTemplate = {
  id: 'controller-cold-2',
  name: 'Controller Cold Outreach - Second Touch',
  persona: 'controller',
  stage: 'cold_2',
  subject: 'Re: End payment reconciliation headaches',
  body: `{{firstName}},

Following up on payment automation for {{company}}.

Quick question: what's your current month-end close cycle for AP? 5 days? 7 days?

Companies using Grain & Vault typically cut that in half because:
- Payments auto-post to GL
- No chasing failed payments
- Three-way match happens automatically
- Audit trail is built-in

If month-end close optimization isn't a priority, no worries. But if it is - I'd love to show you how it works.

10 minutes?

[Your name]`,
  personalizationHooks: [
    'Tie to their fiscal year end',
    'Reference recent accounting standard changes',
  ],
  sendDelay: 4,
}

// =============================================================================
// TREASURY MANAGER SEQUENCES
// =============================================================================

export const TREASURY_COLD_1: EmailTemplate = {
  id: 'treasury-cold-1',
  name: 'Treasury Cold Outreach - First Touch',
  persona: 'treasury',
  stage: 'cold_1',
  subject: '4.5%+ on operating cash (not a money market fund)',
  body: `{{firstName}},

What's {{company}}'s treasury policy allow for idle cash? Probably money markets, maybe some short-term Treasuries.

We're seeing treasury managers get 4.5%+ on operating cash using a different approach:
- Deposit USD into Grain & Vault
- Funds convert to USDC (Circle-backed stablecoin)
- Earn DeFi yield, passed to you at 70%
- Withdraw to USD anytime

100% principal protected. Instant liquidity. No lock-up.

The kicker: while earning yield, you can ALSO use that deposit as collateral for 0% interest credit line to pay suppliers.

Earn yield + pay vendors. Same dollar, two jobs.

Worth exploring?

[Your name]`,
  personalizationHooks: [
    'Reference their current treasury management approach',
    'Tie to Fed rate environment',
    'Mention inflation hedging',
  ],
}

export const TREASURY_COLD_2: EmailTemplate = {
  id: 'treasury-cold-2',
  name: 'Treasury Cold Outreach - Second Touch',
  persona: 'treasury',
  stage: 'cold_2',
  subject: 'Re: 4.5%+ on operating cash',
  body: `{{firstName}},

Quick follow-up on treasury yield.

I know "DeFi" might raise eyebrows in a treasury context. Fair.

So let me address the top concern upfront: risk.

Here's the structure:
1. Your USD converts to USDC (1:1 backed by cash + T-bills, audited monthly)
2. USDC is held in Circle custody (SOC 2 certified)
3. Yield comes from overcollateralized lending protocols
4. You can withdraw to USD in <24 hours

This isn't speculative crypto. It's efficient access to yield sources that banks can't/won't offer.

Happy to walk through the risk framework. 15 minutes?

[Your name]`,
  personalizationHooks: [
    'Reference Circle's regulatory status',
    'Mention similar treasury policies at other companies',
  ],
  sendDelay: 4,
}

// =============================================================================
// DEMO CONFIRMATION & NO-SHOW TEMPLATES
// =============================================================================

export const DEMO_CONFIRMATION: EmailTemplate = {
  id: 'demo-confirm',
  name: 'Demo Confirmation',
  persona: 'generic',
  stage: 'demo_confirm',
  subject: 'Confirmed: Grain & Vault demo - {{date}}',
  body: `{{firstName}},

Great - looking forward to our call on {{date}} at {{time}}.

Here's what we'll cover in 15 minutes:
1. How the deposit-to-credit model works (2 min)
2. Live demo of the platform (8 min)
3. ROI calculator for {{company}} (3 min)
4. Q&A (2 min)

Come prepared with:
- Rough monthly supplier spend (doesn't need to be exact)
- What ERP/accounting system you use
- Any specific pain points you want to solve

Meeting link: {{meetingLink}}

See you soon,
[Your name]

P.S. - If something comes up, just reply to reschedule. No ghosting needed!`,
  personalizationHooks: [
    'Include specific agenda items based on their pain points',
    'Reference their industry in the ROI section',
  ],
}

export const NO_SHOW_FOLLOW_UP: EmailTemplate = {
  id: 'no-show',
  name: 'No Show Follow Up',
  persona: 'generic',
  stage: 'no_show',
  subject: 'Missed you - reschedule?',
  body: `{{firstName}},

Looks like we missed each other for our call today. No worries - happens to everyone.

Two options:
1. Reply with a few times that work better for you
2. Grab a slot here: {{calendlyLink}}

If priorities shifted and this isn't the right time, just let me know. I'll follow up in a few months instead.

[Your name]`,
  personalizationHooks: [],
}

export const NO_SHOW_LOOM: EmailTemplate = {
  id: 'no-show-loom',
  name: 'No Show - Loom Alternative',
  persona: 'generic',
  stage: 'no_show',
  subject: 'Quick video instead?',
  body: `{{firstName}},

Since we missed our call, I recorded a quick 3-minute Loom showing exactly how Grain & Vault works:

{{loomLink}}

TL;DW:
- Deposit predictable spend
- Get 1:1 credit line at 0% interest
- Pay suppliers at 0% fees
- Earn 4.5%+ on your deposit

If it resonates, let's reschedule. If not, no hard feelings.

[Your name]`,
  personalizationHooks: [
    'Personalize the Loom intro with their name/company',
    'Show their industry in the demo',
  ],
  sendDelay: 1,
}

// =============================================================================
// POST-DEMO FOLLOW-UP
// =============================================================================

export const POST_DEMO_SAME_DAY: EmailTemplate = {
  id: 'post-demo-same-day',
  name: 'Post Demo - Same Day Recap',
  persona: 'generic',
  stage: 'follow_up',
  subject: 'Recap: Grain & Vault for {{company}}',
  body: `{{firstName}},

Thanks for the great conversation today. Quick recap:

What we discussed:
{{discussionPoints}}

Your key questions:
{{keyQuestions}}

Next steps:
{{nextSteps}}

Materials:
- One-pager: [attached]
- ROI calculator for {{company}}: {{calculatorLink}}
- Security overview: [attached]

Let me know if you need anything else for {{nextStep}}.

[Your name]`,
  personalizationHooks: [
    'Include specific discussion points from the call',
    'Reference their objections and your responses',
    'Clear next step with owner and deadline',
  ],
}

export const POST_DEMO_FOLLOW_UP: EmailTemplate = {
  id: 'post-demo-follow-up',
  name: 'Post Demo - Check In',
  persona: 'generic',
  stage: 'follow_up',
  subject: 'Re: Recap: Grain & Vault for {{company}}',
  body: `{{firstName}},

Checking in on our Grain & Vault discussion.

When we spoke, you mentioned {{nextStep}} as the next step. Any updates there?

Happy to:
- Hop on a call with {{stakeholder}} if that helps
- Send additional materials for {{requirement}}
- Run updated numbers if your spend estimates changed

Let me know how I can help move this forward.

[Your name]`,
  personalizationHooks: [
    'Reference specific next step they committed to',
    'Offer specific help based on their process',
  ],
  sendDelay: 3,
}

// =============================================================================
// SEQUENCES
// =============================================================================

export const EMAIL_SEQUENCES: EmailSequence[] = [
  {
    id: 'cfo-sequence',
    name: 'CFO / VP Finance Sequence',
    persona: 'cfo',
    templates: [CFO_COLD_1, CFO_COLD_2, CFO_COLD_3],
    totalTouches: 3,
  },
  {
    id: 'procurement-sequence',
    name: 'VP Procurement / CPO Sequence',
    persona: 'procurement',
    templates: [PROCUREMENT_COLD_1, PROCUREMENT_COLD_2, PROCUREMENT_COLD_3],
    totalTouches: 3,
  },
  {
    id: 'controller-sequence',
    name: 'Controller / AP Director Sequence',
    persona: 'controller',
    templates: [CONTROLLER_COLD_1, CONTROLLER_COLD_2],
    totalTouches: 2,
  },
  {
    id: 'treasury-sequence',
    name: 'Treasury Manager Sequence',
    persona: 'treasury',
    templates: [TREASURY_COLD_1, TREASURY_COLD_2],
    totalTouches: 2,
  },
]

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getSequenceForPersona(persona: string): EmailSequence | undefined {
  return EMAIL_SEQUENCES.find(seq => seq.persona === persona)
}

export function personalizeTemplate(
  template: EmailTemplate,
  data: Record<string, string>
): { subject: string; body: string } {
  let subject = template.subject
  let body = template.body

  for (const [token, value] of Object.entries(data)) {
    const regex = new RegExp(token.replace(/[{}]/g, '\\$&'), 'g')
    subject = subject.replace(regex, value)
    body = body.replace(regex, value)
  }

  return { subject, body }
}

export function calculateYieldPotential(monthlySpend: number): number {
  // Assume 4.5% annual yield on deposit equal to monthly spend
  return Math.round(monthlySpend * 0.045)
}

export function calculateFeeSavings(monthlySpend: number, currentFeeRate: number = 0.025): number {
  // Savings = current fees - GRAIN fees (1%)
  const currentAnnualFees = monthlySpend * 12 * currentFeeRate
  const grainAnnualFees = monthlySpend * 12 * 0.01
  return Math.round(currentAnnualFees - grainAnnualFees)
}

export function generatePersonalizationData(lead: {
  firstName: string
  company: string
  industry: string
  title: string
  estimatedMonthlySpend?: number
}): Record<string, string> {
  const monthlySpend = lead.estimatedMonthlySpend || 500000
  const annualYield = calculateYieldPotential(monthlySpend)
  const feeSavings = calculateFeeSavings(monthlySpend)

  return {
    '{{firstName}}': lead.firstName,
    '{{company}}': lead.company,
    '{{industry}}': lead.industry,
    '{{title}}': lead.title,
    '{{estimatedSpend}}': monthlySpend.toLocaleString(),
    '{{potentialYield}}': annualYield.toLocaleString(),
    '{{recentNews}}': '', // To be filled manually
    '{{mutualConnection}}': '', // To be filled manually
    '{{specificPainPoint}}': '', // To be filled manually
    '{{competitorUsed}}': '', // To be filled manually
  }
}

// =============================================================================
// SUBJECT LINE VARIANTS (A/B Testing)
// =============================================================================

export const SUBJECT_LINE_VARIANTS = {
  cfo: [
    'Your treasury is leaving ${{potentialYield}} on the table',
    '4.5% yield on operating cash - how {{company}} can capture it',
    'Quick question about {{company}}\'s treasury',
    'Making idle cash work harder at {{company}}',
  ],
  procurement: [
    'Pay {{company}}\'s suppliers at 0% fees (seriously)',
    'Instant supplier payments, zero fees',
    'What if {{company}}\'s suppliers got paid same-day?',
    'Cutting payment fees by 60% at {{company}}',
  ],
  controller: [
    'End payment reconciliation headaches at {{company}}',
    'Auto-reconciliation for {{company}}\'s AP',
    'Faster month-end close for {{company}}',
    'Zero failed payments (really)',
  ],
  treasury: [
    '4.5%+ on operating cash (not a money market fund)',
    '{{company}}\'s treasury yield could be higher',
    'DeFi yield for corporate treasury (it\'s not what you think)',
    'Same dollar, two jobs: yield + payments',
  ],
}
