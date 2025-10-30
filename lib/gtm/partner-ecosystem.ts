/**
 * Partner Ecosystem GTM Strategy
 * 33 partners × 1,000s of customers = exponential distribution
 *
 * Strategy: Co-sell first, land & expand second
 */

export interface PartnerEcosystem {
  partner: {
    name: string
    category: 'cloud' | 'erp' | 'crm' | 'martech' | 'data' | 'security' | 'consulting'
    customerCount: number
    avgCustomerSize: string
    partnerContactName?: string
    partnerContactEmail?: string
    status: 'signed' | 'in-discussion' | 'target'
  }

  // What Wells Onyx offers that complements partner
  coSellOfferings: Array<{
    wellsService: 'executive-search' | 'ai-ops' | 'idre-agency' | 'wells-os' | 'fab' | 'exo'
    partnerProduct: string // e.g., "AWS SageMaker", "IBM Watson"
    valueProp: string // Why partner customers need this
    revenueShare?: string // e.g., "Partner gets 10% of deal"
  }>

  // Partner's customers (from Clay 150K)
  customers: {
    totalIdentified: number
    bySegment: {
      enterprise: number
      midmarket: number
      smb: number
    }
    topTargets: string[] // Company names
  }

  // GTM strategy for this ecosystem
  gtmStrategy: {
    coSellFirst: boolean // Bring deals TO partner first
    landAndExpand: boolean // Expand within ecosystem after first deal
    partnerEndorsement: boolean // Use partner's name in outreach
    jointMarketing: boolean // Co-branded content/events
  }
}

/**
 * The 33 Partner Ecosystems
 * (Based on: "we have for the better part done")
 */

export const PARTNER_ECOSYSTEMS: Record<string, PartnerEcosystem> = {
  // CLOUD INFRASTRUCTURE (AI Ops + Wells OS fit)
  'aws': {
    partner: {
      name: 'Amazon Web Services',
      category: 'cloud',
      customerCount: 100000,
      avgCustomerSize: 'Enterprise',
      status: 'signed'
    },
    coSellOfferings: [
      {
        wellsService: 'ai-ops',
        partnerProduct: 'AWS SageMaker / Bedrock',
        valueProp: 'Companies using AWS AI need 24/7 ops. We run the operations, AWS provides infrastructure.',
        revenueShare: 'AWS gets increased usage fees'
      },
      {
        wellsService: 'wells-os',
        partnerProduct: 'AWS Cloud',
        valueProp: 'Wells OS runs on AWS. Every Wells OS customer = new AWS customer.',
        revenueShare: 'AWS gets 100% of infrastructure revenue'
      },
      {
        wellsService: 'executive-search',
        partnerProduct: 'AWS Partner Network',
        valueProp: 'AWS customers scaling need execs. We find them.',
        revenueShare: 'Referral fee to AWS partner manager'
      }
    ],
    customers: {
      totalIdentified: 15000, // From Clay 150K
      bySegment: { enterprise: 5000, midmarket: 7000, smb: 3000 },
      topTargets: ['Netflix', 'Airbnb', 'Slack', 'Lyft', 'Coinbase']
    },
    gtmStrategy: {
      coSellFirst: true, // Always loop in AWS account team
      landAndExpand: true, // Win one AWS customer, expand to more
      partnerEndorsement: true, // "AWS partner for AI operations"
      jointMarketing: true // Co-host AWS AI Ops webinar
    }
  },

  'microsoft-azure': {
    partner: {
      name: 'Microsoft Azure',
      category: 'cloud',
      customerCount: 95000,
      avgCustomerSize: 'Enterprise',
      status: 'signed'
    },
    coSellOfferings: [
      {
        wellsService: 'ai-ops',
        partnerProduct: 'Azure OpenAI / Azure ML',
        valueProp: 'Azure AI customers need managed operations',
        revenueShare: 'Azure gets increased usage'
      },
      {
        wellsService: 'executive-search',
        partnerProduct: 'Microsoft Partner Network',
        valueProp: 'Microsoft customers need tech execs',
        revenueShare: 'MPN referral fees'
      }
    ],
    customers: {
      totalIdentified: 12000,
      bySegment: { enterprise: 6000, midmarket: 5000, smb: 1000 },
      topTargets: ['GE', 'Walmart', 'Starbucks', 'BMW', 'LG']
    },
    gtmStrategy: {
      coSellFirst: true,
      landAndExpand: true,
      partnerEndorsement: true,
      jointMarketing: true
    }
  },

  'gcp': {
    partner: {
      name: 'Google Cloud Platform',
      category: 'cloud',
      customerCount: 40000,
      avgCustomerSize: 'Enterprise',
      status: 'signed'
    },
    coSellOfferings: [
      {
        wellsService: 'ai-ops',
        partnerProduct: 'Vertex AI',
        valueProp: 'GCP AI customers need 24/7 operations',
        revenueShare: 'GCP gets usage fees'
      }
    ],
    customers: {
      totalIdentified: 8000,
      bySegment: { enterprise: 3000, midmarket: 4000, smb: 1000 },
      topTargets: ['Spotify', 'Twitter/X', 'Snap', 'PayPal', 'Target']
    },
    gtmStrategy: {
      coSellFirst: true,
      landAndExpand: true,
      partnerEndorsement: true,
      jointMarketing: true
    }
  },

  'ibm': {
    partner: {
      name: 'IBM',
      category: 'consulting',
      customerCount: 50000,
      avgCustomerSize: 'Large Enterprise',
      status: 'signed'
    },
    coSellOfferings: [
      {
        wellsService: 'wells-os',
        partnerProduct: 'IBM Consulting / Watson',
        valueProp: 'IBM installs Wells OS for digital transformation clients',
        revenueShare: 'IBM gets implementation fees'
      },
      {
        wellsService: 'fab',
        partnerProduct: 'IBM Semiconductor Solutions',
        valueProp: 'IBM customers need chip manufacturing',
        revenueShare: 'Co-sell on semiconductor deals'
      }
    ],
    customers: {
      totalIdentified: 10000,
      bySegment: { enterprise: 8000, midmarket: 2000, smb: 0 },
      topTargets: ['Banks', 'Airlines', 'Telcos', 'Energy companies']
    },
    gtmStrategy: {
      coSellFirst: true,
      landAndExpand: true,
      partnerEndorsement: true,
      jointMarketing: false // IBM prefers direct sales
    }
  },

  'salesforce': {
    partner: {
      name: 'Salesforce',
      category: 'crm',
      customerCount: 150000,
      avgCustomerSize: 'Mid-Market',
      status: 'signed'
    },
    coSellOfferings: [
      {
        wellsService: 'executive-search',
        partnerProduct: 'Salesforce',
        valueProp: 'Salesforce customers scaling sales teams need sales execs',
        revenueShare: 'Referral from Salesforce AEs'
      },
      {
        wellsService: 'ai-ops',
        partnerProduct: 'Einstein AI',
        valueProp: 'Companies using Einstein need AI operations',
        revenueShare: 'Co-sell with Salesforce AI team'
      }
    ],
    customers: {
      totalIdentified: 20000,
      bySegment: { enterprise: 5000, midmarket: 12000, smb: 3000 },
      topTargets: ['SaaS companies', 'Retailers', 'Financial services']
    },
    gtmStrategy: {
      coSellFirst: true,
      landAndExpand: true,
      partnerEndorsement: true,
      jointMarketing: true
    }
  },

  'oracle': {
    partner: {
      name: 'Oracle',
      category: 'erp',
      customerCount: 43000,
      avgCustomerSize: 'Large Enterprise',
      status: 'in-discussion'
    },
    coSellOfferings: [
      {
        wellsService: 'wells-os',
        partnerProduct: 'Oracle Cloud ERP',
        valueProp: 'Oracle customers want to replace legacy ERP with Wells OS',
        revenueShare: 'Oracle gets cloud infrastructure fees'
      }
    ],
    customers: {
      totalIdentified: 8000,
      bySegment: { enterprise: 7000, midmarket: 1000, smb: 0 },
      topTargets: ['Fortune 500 manufacturers', 'Retailers', 'Healthcare']
    },
    gtmStrategy: {
      coSellFirst: true,
      landAndExpand: false, // Oracle protects their base
      partnerEndorsement: false, // Use cautiously
      jointMarketing: false
    }
  }

  // TODO: Add remaining 27 partners
  // - SAP
  // - ServiceNow
  // - Workday
  // - Adobe
  // - Snowflake
  // - Databricks
  // - MongoDB
  // - HashiCorp
  // - Datadog
  // - PagerDuty
  // - Splunk
  // - New Relic
  // - etc.
}

/**
 * Partner Ecosystem GTM Playbook
 */

export const PARTNER_GTM_STRATEGY = {
  // PHASE 1: Co-Sell First (Bring deals TO the partner)
  coSellMotion: {
    step1: 'Identify partner customer with need (from Clay 150K)',
    step2: 'Map to partner account team (who owns this customer?)',
    step3: 'Present opportunity to partner: "Your customer {{Company}} needs {{Solution}}. We can close together."',
    step4: 'Partner intros you to customer (warm intro)',
    step5: 'Close deal together (partner gets their cut)',

    example: {
      scenario: 'Netflix (AWS customer) needs AI Ops',
      execution: [
        '1. Identify: Netflix in Clay, using AWS SageMaker',
        '2. Map: Find AWS account manager for Netflix',
        '3. Pitch AWS: "Netflix needs 24/7 AI ops for SageMaker. We can deliver. You get increased usage fees."',
        '4. AWS intros us to Netflix AI team',
        '5. Close: $400K/mo AI Ops deal. AWS gets $100K/mo increased infrastructure spend.'
      ]
    }
  },

  // PHASE 2: Land & Expand (Ecosystem penetration)
  landAndExpand: {
    step1: 'Close first deal with partner endorsement',
    step2: 'Ask partner: "Who else in your ecosystem needs this?"',
    step3: 'Partner shares customer list (or we match from Clay)',
    step4: 'Outreach with partner endorsement: "We just helped {{Company}} (AWS customer like you)..."',
    step5: 'Repeat across entire ecosystem',

    multiplier: '1 deal → 10 referrals → 100 ecosystem customers',

    example: {
      scenario: 'Win Airbnb (AWS) → Expand to all AWS SaaS customers',
      execution: [
        '1. Close Airbnb AI Ops deal',
        '2. Ask AWS: "Which other SaaS customers need AI ops?"',
        '3. AWS shares: Slack, DoorDash, Coinbase, etc.',
        '4. Outreach: "We run AI ops for Airbnb (AWS customer like you). Would this help?"',
        '5. Close 5-10 more AWS customers',
        '6. AWS promotes us to all SaaS customers in ecosystem'
      ]
    }
  },

  // PHASE 3: Partner-Endorsed Intros (Use partner's brand)
  partnerEndorsedOutreach: {
    emailTemplate: `{{FirstName}},

I'm reaching out because {{CompanyName}} is an AWS customer, and we work closely with AWS on AI operations.

We just helped {{ReferenceCust}} (another AWS customer) reduce their AI downtime from 5% to 0.01% - saving them $2M/year.

{{AWSAccountManager}} on the AWS team thought {{CompanyName}} might benefit from the same.

Worth a quick intro call?

Best,
Jonah
Wells Onyx (AWS Advanced Partner)`,

    linkedInTemplate: `Hi {{FirstName}},

Saw {{CompanyName}} is using AWS (congrats on the partnership!).

We're an AWS Advanced Partner specializing in AI operations. Just helped {{ReferenceCustomer}} with {{Outcome}}.

{{AWSContact}} suggested I reach out. Worth connecting?

Best,
Jonah`,

    // Key elements:
    // 1. Mention partner immediately (instant credibility)
    // 2. Reference similar customer (social proof)
    // 3. Name-drop partner contact if possible (warm intro)
    // 4. Keep it short (they already trust you)
  }
}

/**
 * Clay + Partner Ecosystem Integration
 * Match 150K contacts to partner ecosystems
 */

export interface PartnerEcosystemMatch {
  contactId: string
  companyName: string
  partners: Array<{
    partnerName: string
    relationship: 'customer' | 'partner' | 'prospect'
    confidence: number // 0-100
    source: string // e.g., "LinkedIn profile mentions AWS"
  }>
  primaryPartner: string // Which ecosystem to target through
  coSellOpportunity: {
    wellsService: string
    partnerProduct: string
    estimatedDealValue: number
  }
}

export async function matchContactToPartnerEcosystem(
  contact: any
): Promise<PartnerEcosystemMatch> {
  // This will analyze Clay data to determine:
  // - Which cloud provider they use
  // - Which CRM/ERP they have
  // - Which consulting firms they work with
  // - Which partner ecosystem to leverage

  // Implementation coming soon with Clay API
  return {} as PartnerEcosystemMatch
}

/**
 * Partner Ecosystem Metrics
 */

export interface PartnerEcosystemMetrics {
  partner: string
  customersIdentified: number
  outreachSent: number
  partnerIntros: number
  coSellDeals: number
  landAndExpandDeals: number
  totalRevenue: number
  partnerRevenue: number // Partner's cut
  wellsRevenue: number // Wells Onyx's cut
}

/**
 * Expected Results (First 90 Days)
 */

export const PARTNER_ECOSYSTEM_PROJECTIONS = {
  month1: {
    partnersActivated: 5, // Start with top 5
    customersIdentified: 5000, // From Clay 150K
    coSellDealsPresented: 50,
    dealsWon: 5,
    revenue: 500000, // $100K avg deal size
    partnerRevenue: 50000, // 10% to partners
  },

  month2: {
    partnersActivated: 15, // Expand to 15
    customersIdentified: 15000,
    coSellDealsPresented: 150,
    dealsWon: 15,
    landAndExpandDeals: 10, // From Month 1 customers
    revenue: 2500000,
    partnerRevenue: 250000,
  },

  month3: {
    partnersActivated: 33, // Full activation
    customersIdentified: 50000,
    coSellDealsPresented: 500,
    dealsWon: 50,
    landAndExpandDeals: 50,
    revenue: 10000000,
    partnerRevenue: 1000000,
  }
}
