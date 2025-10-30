/**
 * Wells AI GTM Playbook (4th Practice Group)
 *
 * Market: B2B commerce platforms, marketplaces, procurement software
 * ICP: Companies doing $10M+ in B2B transactions
 * Value Prop: Real-time supplier matching, automated RFQ/RFP, 33bps fee vs 3-5% traditional
 */

export interface WellsAIProspect {
  company: string
  industry: string
  annualGMV: number // Gross Merchandise Value
  currentProcurementProcess: 'manual' | 'erp' | 'marketplace' | 'custom'
  painPoints: string[]
  decisionMaker: {
    name: string
    title: string
    email?: string
    linkedIn?: string
  }
  techStack: string[]
  integrationComplexity: 'low' | 'medium' | 'high'
  estimatedDealValue: number // Annual fees at 33bps
}

export const WELLS_AI_ICP = {
  industries: [
    'Manufacturing',
    'Construction',
    'Healthcare',
    'Hospitality',
    'Retail',
    'Technology',
    'Professional Services'
  ],

  companySize: {
    minRevenue: 10000000, // $10M+
    minEmployees: 50,
    minTransactions: 1000 // Per year
  },

  painPoints: [
    'Manual RFQ/RFP process taking 30+ days',
    'Limited supplier network',
    'No price transparency',
    'High procurement fees (3-5%)',
    'Lack of real-time matching',
    'Complex contract negotiations',
    'Poor supplier quality control'
  ],

  valueProp: {
    timeSavings: '30 days → 2 days (93% faster)',
    costReduction: '3-5% fees → 0.33% (90% cheaper)',
    supplierNetwork: '150K+ verified suppliers',
    aiMatching: 'Real-time, intelligent matching',
    automation: 'End-to-end RFQ → Payment → Tithe',
    compliance: 'Built-in quality controls'
  }
}

/**
 * Wells AI GTM Strategy
 */

export const WELLS_AI_GTM_STRATEGY = {
  // Target 1: Companies with broken procurement
  segment1: {
    name: 'Manual Procurement Hell',
    criteria: [
      'Using email/spreadsheets for RFQs',
      'No procurement software',
      'Procurement team of 3+ people',
      'Spending $10M+ annually on suppliers'
    ],
    approach: 'Free procurement audit',
    message: `How much time does your team spend on RFQs?

Most companies waste 40+ hours per RFQ. We automate the entire process: post RFQ → AI matches suppliers → get quotes → close deal → payment.

Want a free audit of your current process? I'll show you exactly how much time & money you're losing.`,

    expectedConversion: '20% (high pain)',
    avgDealValue: 50000 // $50K annual fees (33bps on $15M spend)
  },

  // Target 2: Companies using traditional marketplaces
  segment2: {
    name: 'Marketplace Fee Fatigue',
    criteria: [
      'Using Thomasnet, Alibaba, or similar',
      'Paying 3-5% transaction fees',
      'Unhappy with supplier quality',
      'Want more control'
    ],
    approach: 'Cost comparison',
    message: `You're paying 3-5% on every transaction through {{Marketplace}}.

Wells AI charges 0.33% (10x cheaper) and gives you:
• Better supplier matching (AI-powered)
• Faster turnaround (2 days vs 30)
• Full transaction transparency
• Same payment protection

On $10M annual spend: You save $300K-$400K per year.

Worth a 15-min call?`,

    expectedConversion: '15% (price-sensitive)',
    avgDealValue: 100000 // $100K annual fees (33bps on $30M spend)
  },

  // Target 3: Companies with custom procurement software
  segment3: {
    name: 'Custom Procurement Overhaul',
    criteria: [
      'Built internal procurement tools',
      'High maintenance costs',
      'Limited supplier network',
      'Want to modernize'
    ],
    approach: 'API-first integration',
    message: `Maintaining custom procurement software is expensive. We've seen companies spend $500K+/year on engineering + ops.

Wells AI offers:
• RESTful API (integrate in days, not months)
• 150K+ supplier network (built-in)
• AI matching engine (no ML team needed)
• White-label option (your brand)

Replace your internal tools or integrate alongside existing systems.

Want to see our API docs?`,

    expectedConversion: '10% (technical sale)',
    avgDealValue: 200000 // $200K annual fees (33bps on $60M spend)
  },

  // Target 4: Partner ecosystem (ERP integrations)
  segment4: {
    name: 'ERP Partner Co-Sell',
    criteria: [
      'Using SAP, Oracle, NetSuite, etc.',
      'Want to add procurement module',
      'Need supplier network',
      'Looking for integrations'
    ],
    approach: 'Partner co-sell (like Executive Search)',
    message: `{{PartnerAE}},

I run Wells AI - real-time B2B commerce platform. We integrate with {{ERP}} to add procurement automation.

{{CustomerCompany}} (your customer) is doing $50M+ in supplier spend. They could benefit from:
• Automated RFQ/RFP
• 150K+ supplier network
• AI-powered matching
• Seamless {{ERP}} integration

Would save them $1M+/year in procurement costs + fees.

Worth a co-sell conversation?`,

    expectedConversion: '30% (partner-endorsed)',
    avgDealValue: 150000 // $150K annual fees (33bps on $45M spend)
  }
}

/**
 * Wells AI Outreach Templates
 */

export const WELLS_AI_MESSAGES = {
  coldOutreach: {
    subject: 'Your procurement process (quick question)',
    body: `{{FirstName}},

Quick question: How long does it take your team to complete an RFQ?

Most companies: 30+ days
With Wells AI: 2 days

We automate the entire process:
1. Post RFQ (2 min)
2. AI matches suppliers (instant)
3. Get quotes (24 hours)
4. Close deal (built-in payment)

Fee: 0.33% (vs 3-5% traditional marketplaces)

Worth a 15-min demo?

Best,
Jonah Manning
Founder, Wells AI
wellsai.vercel.app`
  },

  freeAudit: {
    subject: 'Free procurement audit for {{Company}}',
    body: `{{FirstName}},

I help companies reduce procurement time by 90%.

Offer: Free audit of your current procurement process

I'll analyze:
• Time spent per RFQ/RFP
• Current transaction fees
• Supplier network gaps
• Automation opportunities

Then show you exactly how much Wells AI would save you (time + money).

No pitch. Just data.

Worth 30 minutes?

Best,
Jonah`
  },

  costComparison: {
    subject: '{{Company}} could save ${{Savings}}/year',
    body: `{{FirstName}},

Did the math on {{Company}}'s procurement:

Current (via {{Marketplace}}):
• \${{AnnualSpend}} spend
• 3-5% fees = \${{CurrentFees}}/year
• 30+ days per RFQ

With Wells AI:
• Same \${{AnnualSpend}} spend
• 0.33% fees = \${{WellsAIFees}}/year
• 2 days per RFQ

**You save: \${{Savings}}/year**

Plus: Better suppliers, faster turnaround, full transparency

Want to see how we integrate with your current process?

Best,
Jonah`
  },

  apiIntegration: {
    subject: 'Wells AI API for {{Company}}',
    body: `{{FirstName}},

Saw {{Company}} built custom procurement tools. Impressive.

But maintaining it is expensive (engineering + ops).

Alternative: Wells AI API

• RESTful API (integrate in days)
• 150K+ supplier network (built-in)
• AI matching engine (no ML team needed)
• White-label option (your brand)

You keep your UX, we power the backend.

Pricing: 0.33% per transaction (vs internal costs)

Want to see our API docs + pricing?

Best,
Jonah`
  },

  partnerCoSell: {
    subject: '{{PartnerCustomer}} procurement opportunity',
    body: `{{PartnerAE}},

I run Wells AI - B2B commerce platform. We integrate with {{Partner}}.

{{PartnerCustomer}} is doing \${{AnnualSpend}} in supplier spend.

Opportunity:
• Add Wells AI procurement module to their {{Partner}} instance
• Automate RFQ/RFP process
• Access 150K+ supplier network
• Save \${{Savings}}/year

This would:
1. Strengthen their {{Partner}} investment
2. Generate \${{WellsAIRevenue}} annual recurring for us
3. Make you look good (solved their procurement pain)

Worth a co-sell call?

Best,
Jonah Manning
Founder, Wells AI`
  }
}

/**
 * Wells AI Deal Flow
 */

export const WELLS_AI_DEAL_STAGES = {
  stage1: {
    name: 'Free Audit',
    duration: '1 week',
    activities: [
      'Analyze current procurement process',
      'Calculate time & cost savings',
      'Identify supplier network gaps',
      'Present findings (30-min call)'
    ],
    conversion: '50% → Demo'
  },

  stage2: {
    name: 'Product Demo',
    duration: '1 week',
    activities: [
      'Live demo of Wells AI platform',
      'Walk through RFQ → Quote → Deal flow',
      'Show supplier matching AI',
      'Discuss integration options'
    ],
    conversion: '60% → Pilot'
  },

  stage3: {
    name: 'Pilot Program',
    duration: '30 days',
    activities: [
      'Run 10 RFQs through Wells AI',
      'Compare vs current process (time, cost, quality)',
      'Train their procurement team',
      'Measure results'
    ],
    conversion: '70% → Full Contract'
  },

  stage4: {
    name: 'Full Implementation',
    duration: 'Ongoing',
    activities: [
      'Integrate with their systems (ERP, accounting, etc.)',
      'Migrate supplier relationships',
      'Train entire team',
      'Launch + ongoing support'
    ],
    revenue: '$50K-$200K/year per customer'
  }
}

/**
 * Wells AI Target Accounts
 */

export const WELLS_AI_TARGETS = {
  tier1: {
    criteria: '$100M+ annual spend',
    companies: [
      'Large manufacturers',
      'National restaurant chains',
      'Healthcare systems',
      'Construction conglomerates'
    ],
    avgDealValue: 300000, // $300K/year (33bps on $90M)
    salesCycle: '6 months',
    approach: 'White-glove, executive sponsorship'
  },

  tier2: {
    criteria: '$30M-$100M annual spend',
    companies: [
      'Mid-size manufacturers',
      'Regional chains',
      'Tech companies',
      'Professional services firms'
    ],
    avgDealValue: 150000, // $150K/year (33bps on $45M)
    salesCycle: '3 months',
    approach: 'Product-led with sales assist'
  },

  tier3: {
    criteria: '$10M-$30M annual spend',
    companies: [
      'Small manufacturers',
      'Local chains',
      'Startups scaling',
      'SMB services'
    ],
    avgDealValue: 50000, // $50K/year (33bps on $15M)
    salesCycle: '1 month',
    approach: 'Self-serve with onboarding support'
  }
}

/**
 * Wells AI Monthly Targets
 */

export const WELLS_AI_MONTHLY_TARGETS = {
  month1: {
    freeAudits: 20,
    demos: 10,
    pilots: 5,
    deals: 2,
    revenue: 100000, // $100K ARR from 2 deals
    pipeline: 500000 // $500K in pipeline
  },

  month3: {
    freeAudits: 60,
    demos: 30,
    pilots: 15,
    deals: 7,
    revenue: 500000, // $500K ARR
    pipeline: 2000000 // $2M in pipeline
  },

  month6: {
    freeAudits: 120,
    demos: 60,
    pilots: 30,
    deals: 15,
    revenue: 1500000, // $1.5M ARR
    pipeline: 5000000 // $5M in pipeline
  },

  year1: {
    totalCustomers: 50,
    revenue: 5000000, // $5M ARR
    avgDealValue: 100000
  }
}

/**
 * Why Wells AI GTM Will Work
 */

export const WELLS_AI_COMPETITIVE_ADVANTAGES = {
  price: '0.33% vs 3-5% (90% cheaper)',
  speed: '2 days vs 30 days (93% faster)',
  network: '150K+ suppliers vs limited networks',
  automation: 'Full RFQ → Payment automation',
  ai: 'Intelligent matching (not just search)',
  integration: 'API-first, white-label ready',
  tithe: '10% of gross goes to mission (unique positioning)',

  proofPoints: [
    'Already processing deals through platform',
    'Live product at wellsai.vercel.app',
    'Working supplier notification system',
    'Twilio SMS integration for real-time updates',
    'Payment infrastructure ready'
  ]
}
