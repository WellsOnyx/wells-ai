/**
 * IDRE Whale Hunt Strategy
 *
 * Market: Only 15 CMS-approved IDRE agencies
 * Current: 2 agencies (13% market share)
 * Target: 3 more agencies (33% total market share)
 * Strategy: Relationship-based, white-glove, executive sponsorship
 */

export interface IDREAgency {
  name: string
  cmsApprovalDate: string
  determinationsPerMonth: number // Estimated
  status: 'working-with' | 'in-discussion' | 'target' | 'not-target'
  keyContacts: Array<{
    name: string
    title: string
    linkedIn?: string
    email?: string
    relationship: 'cold' | 'warm' | 'hot'
  }>
  annualRevenueEstimate: number
  painPoints: string[]
  whyTheyNeedWells: string
  approach: string
  notes?: string
}

/**
 * The 15 CMS-Approved IDRE Agencies
 * (Public information from CMS website)
 */

export const IDRE_AGENCIES: Record<string, IDREAgency> = {
  // CURRENT PARTNERS (2) - CONFIDENTIAL, DO NOT NAME DROP
  'current-partner-1': {
    name: '[CONFIDENTIAL - Client A]',
    cmsApprovalDate: '2021',
    determinationsPerMonth: 500,
    status: 'working-with',
    keyContacts: [],
    annualRevenueEstimate: 3600000,
    painPoints: ['Scaling beyond current capacity'],
    whyTheyNeedWells: 'We provide overflow capacity + quality assurance',
    approach: 'Account management - upsell additional services',
    notes: 'NEVER name this client publicly without explicit permission'
  },

  'current-partner-2': {
    name: '[CONFIDENTIAL - Client B]',
    cmsApprovalDate: '2022',
    determinationsPerMonth: 300,
    status: 'working-with',
    keyContacts: [],
    annualRevenueEstimate: 2160000,
    painPoints: ['New to market, need expertise'],
    whyTheyNeedWells: 'We provide operations backbone + training',
    approach: 'Account management - expand scope',
    notes: 'NEVER name this client publicly without explicit permission'
  },

  // TARGET AGENCIES (3)
  'target-agency-1': {
    name: '[To be researched - High-volume agency]',
    cmsApprovalDate: '2021',
    determinationsPerMonth: 1000, // Estimated
    status: 'target',
    keyContacts: [
      {
        name: '[CEO Name]',
        title: 'CEO / Founder',
        relationship: 'cold'
      },
      {
        name: '[COO Name]',
        title: 'COO',
        relationship: 'cold'
      }
    ],
    annualRevenueEstimate: 7200000,
    painPoints: [
      'Quality issues causing CMS reversals',
      'High cost per determination ($800+)',
      'Cannot scale beyond 1,000/month',
      'Compliance audit risk'
    ],
    whyTheyNeedWells: 'We deliver: $450/determination, ≥98% quality, 2,000/month capacity',
    approach: 'Executive sponsorship campaign'
  },

  'target-agency-2': {
    name: '[To be researched - Mid-volume agency]',
    cmsApprovalDate: '2022',
    determinationsPerMonth: 600,
    status: 'target',
    keyContacts: [],
    annualRevenueEstimate: 4320000,
    painPoints: [
      'Recent entrant, establishing credibility',
      'Building operational capacity',
      'Need to compete with established players'
    ],
    whyTheyNeedWells: 'White-label operations - we run backend, they get credit',
    approach: 'Partnership / white-label model'
  },

  'target-agency-3': {
    name: '[To be researched - Regional focus]',
    cmsApprovalDate: '2023',
    determinationsPerMonth: 400,
    status: 'target',
    keyContacts: [],
    annualRevenueEstimate: 2880000,
    painPoints: [
      'Regional coverage gaps',
      'Need national scale',
      'Limited practice lead capacity'
    ],
    whyTheyNeedWells: 'National coverage - we provide capacity across all regions',
    approach: 'Geographic expansion partner'
  },

  // NOT TARGETING (rest of 15 - various reasons)
  // - May be competitors
  // - May be too small
  // - May have internal capacity
  // - May have exclusive agreements
}

/**
 * IDRE Whale Hunt Playbook
 * Multi-month, multi-touch, executive-level relationship building
 */

export const IDRE_WHALE_HUNT_STRATEGY = {
  // PHASE 1: Research & Intelligence (2-4 weeks)
  research: {
    objectives: [
      'Identify all 15 CMS-approved agencies (public CMS data)',
      'Map key decision-makers (CEO, COO, CFO)',
      'Understand their current capacity and pain points',
      'Identify warm intro paths (mutual connections)',
      'Research their financial performance (if available)',
      'Understand their competitive positioning'
    ],

    sources: [
      'CMS public database',
      'LinkedIn (key personnel)',
      'Company websites',
      'Industry conferences',
      'Healthcare compliance publications',
      'Mutual connections (hospital CFOs we know)'
    ],

    deliverable: 'Target list of 3 agencies with full intel dossiers'
  },

  // PHASE 2: Warm Introduction Path (4-6 weeks)
  warmIntro: {
    strategy: 'Never cold outreach. Always warm intro.',

    paths: [
      {
        method: 'Hospital CFO introduction',
        execution: 'Ask current clients: "Do you know anyone at {{TargetAgency}}?"'
      },
      {
        method: 'Industry conference',
        execution: 'Attend NASTAD, AHLA conferences. Meet in person.'
      },
      {
        method: 'LinkedIn mutual connections',
        execution: 'Find 2-3 mutual connections. Ask for intro.'
      },
      {
        method: 'Consulting firm intro',
        execution: 'Use Big 4 consulting relationships (they work with agencies)'
      },
      {
        method: 'Thought leadership',
        execution: 'Publish IDR white paper. Share with target agencies.'
      }
    ],

    timeline: '30-45 days to secure first meeting'
  },

  // PHASE 3: Executive Sponsorship Campaign (8-12 weeks)
  executiveCampaign: {
    approach: 'CEO-to-CEO relationship building',

    sequence: [
      {
        week: 1,
        action: 'First meeting (discovery)',
        agenda: [
          'Understand their business model',
          'Learn their pain points',
          'Share Wells Onyx capabilities (no pitch)',
          'Establish credibility (share case studies)',
          'Ask: "What would make this valuable for you?"'
        ]
      },
      {
        week: 2,
        action: 'Custom proposal',
        deliverables: [
          'Tailored to their specific needs',
          'ROI model (cost savings + capacity increase)',
          'Quality assurance guarantees',
          'Pilot program proposal (100 determinations)',
          'References from current partners'
        ]
      },
      {
        week: 4,
        action: 'Pilot program',
        structure: [
          '30-day pilot',
          '100 determinations',
          '$450/determination',
          '≥98% quality guarantee',
          'Full transparency on process'
        ]
      },
      {
        week: 8,
        action: 'Pilot results presentation',
        metrics: [
          'Quality score: X%',
          'Turnaround time: X days',
          'Cost per determination: $450 (vs $800 industry avg)',
          'Capacity demonstrated: 30/day',
          'Client testimonial from pilot'
        ]
      },
      {
        week: 12,
        action: 'Full partnership negotiation',
        terms: [
          'Volume commitment',
          'Pricing (volume discounts)',
          'SLA guarantees',
          'Audit rights',
          'Revenue share model (if applicable)',
          'Multi-year agreement'
        ]
      }
    ],

    closeRate: '80% (if you get to pilot, you close)',
    timeline: '3-4 months from first meeting to signed contract'
  },

  // PHASE 4: Relationship Maintenance (Ongoing)
  accountManagement: {
    cadence: 'Monthly executive check-ins',

    activities: [
      'QBR (Quarterly Business Review)',
      'Compliance updates',
      'Performance dashboards',
      'Continuous improvement proposals',
      'Industry intelligence sharing',
      'Partnership expansion opportunities'
    ],

    upsell: [
      'Increase volume commitment',
      'Add additional services (audit support, training)',
      'White-label operations',
      'Exclusive partnership (lock out competitors)'
    ]
  }
}

/**
 * IDRE Outreach Templates (Warm Intro Only)
 */

export const IDRE_MESSAGING = {
  // Email after warm intro
  emailAfterIntro: `{{FirstName}},

{{MutualConnection}} suggested I reach out. I run Wells Onyx - we provide operational support for IDRE agencies.

We currently work with 2 of the 15 CMS-approved agencies (happy to provide references at the right time). We help them:
• Scale from 300 → 900 determinations/month
• Reduce cost per determination from $800 → $450
• Maintain ≥98% quality (zero CMS reversals)

I'd love to learn about {{TheirAgency}}'s operations and see if there's a fit.

Would you be open to a 30-min intro call?

Best,
Jonah Manning
Founder, Wells Onyx`,

  // LinkedIn after conference meeting
  linkedInAfterConference: `{{FirstName}},

Great to meet you at {{Conference}} last week. Enjoyed our conversation about IDR scaling challenges.

Following up on our discussion about {{TheirPainPoint}}.

We work with {{CurrentPartner}} on exactly this - happy to share what's working for them.

Coffee next time you're in {{City}}?

Best,
Jonah`,

  // Follow-up after first meeting
  followUpAfterMeeting: `{{FirstName}},

Thank you for the time yesterday. Really appreciated learning about {{TheirAgency}}'s approach to {{SpecificTopic}}.

As promised, here's:
1. Anonymous case study: How we helped another agency {{SpecificOutcome}}
2. ROI model for {{TheirAgency}} (customized to your volume)
3. Our quality metrics: ≥98% accuracy, $450/determination, 900+/day capacity

Main takeaway: We could help {{TheirAgency}} {{KeyValueProp}} in 30-60 days.

Worth exploring a pilot program? Once we're further along, happy to provide client references.

Best,
Jonah`
}

/**
 * IDRE Success Metrics
 */

export const IDRE_TARGETS = {
  year1: {
    agenciesApproached: 3,
    warmIntrosSecured: 3,
    firstMeetingsBooked: 3,
    pilotsLaunched: 2,
    partnershipsWon: 2, // 67% close rate
    totalMarketShare: 27, // 4 of 15 agencies = 27%
    annualRevenue: 15000000 // $15M from 2 new partners
  },

  year2: {
    agenciesApproached: 6, // Approach remaining targets
    partnershipsWon: 1,
    totalMarketShare: 33, // 5 of 15 = 33%
    annualRevenue: 30000000, // $30M run-rate

    // At this point: Market leader position
    // 5 of 15 agencies = dominant player
    // Can raise prices, set standards, influence CMS policy
  }
}

/**
 * Why This Works for IDRE
 */

export const IDRE_COMPETITIVE_ADVANTAGES = {
  quality: '≥98% (industry avg: 85-90%)',
  cost: '$450 per determination (industry avg: $600-800)',
  scale: '900+ determinations/day capacity (most agencies: 300-500)',
  speed: '30 determinations/day per Practice Lead',
  compliance: 'Full audit trail, CMS-compliant',

  proof: [
    'Already serving 2 of 15 agencies',
    'Processing $5.8M+ determinations annually',
    'Zero CMS reversals',
    'References available'
  ]
}

/**
 * IDRE Action Plan (Next 90 Days)
 */

export const IDRE_90_DAY_PLAN = {
  days_1_30: {
    objective: 'Research & identify top 3 target agencies',
    tasks: [
      'Pull CMS-approved agency list',
      'Research each agency (size, leadership, pain points)',
      'Map warm intro paths for top 3',
      'Create custom intel dossiers',
      'Reach out to mutual connections'
    ]
  },

  days_31_60: {
    objective: 'Secure 3 first meetings',
    tasks: [
      'Execute warm intro strategy',
      'Book 3 discovery calls',
      'Prepare custom proposals',
      'Share case studies and references',
      'Identify pilot opportunities'
    ]
  },

  days_61_90: {
    objective: 'Launch 1-2 pilot programs',
    tasks: [
      'Negotiate pilot terms',
      'Execute 30-day pilots',
      'Deliver exceptional results',
      'Present results + ROI',
      'Negotiate full partnerships'
    ]
  }
}
