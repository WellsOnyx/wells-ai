/**
 * Grain & Vault - Ideal Customer Profile (ICP) & Targeting
 *
 * Target: Enterprise Treasury/Procurement buyers
 * Budget: $200-500/mo cold start
 * Goal: 10 demos in first month
 */

// =============================================================================
// IDEAL CUSTOMER PROFILE
// =============================================================================

export interface ICPCompany {
  minRevenue: number
  maxRevenue: number
  minEmployees: number
  maxEmployees: number
  industries: string[]
  signals: BuyingSignal[]
  disqualifiers: string[]
}

export interface BuyingSignal {
  signal: string
  strength: 'high' | 'medium' | 'low'
  source: string
  priority: number
}

export interface BuyerPersona {
  title: string
  alternativeTitles: string[]
  department: string
  seniority: string
  painPoints: string[]
  goals: string[]
  objections: string[]
  triggers: string[]
  messageAngle: string
  linkedInKeywords: string[]
}

// Primary ICP: Mid-Market to Enterprise companies with predictable spend
export const PRIMARY_ICP: ICPCompany = {
  minRevenue: 10_000_000,   // $10M ARR
  maxRevenue: 500_000_000,  // $500M ARR
  minEmployees: 50,
  maxEmployees: 2000,
  industries: [
    'Manufacturing',
    'Wholesale Distribution',
    'Construction',
    'Food & Beverage',
    'Industrial Equipment',
    'Automotive Parts',
    'Medical Devices',
    'Aerospace Components',
    'Chemical Manufacturing',
    'Packaging',
    'Logistics & Supply Chain',
    'Agriculture & Farming',
  ],
  signals: [
    { signal: 'Recently raised Series B or later', strength: 'high', source: 'Crunchbase', priority: 1 },
    { signal: 'Hiring Treasury/Finance roles', strength: 'high', source: 'LinkedIn Jobs', priority: 2 },
    { signal: 'Multiple vendor relationships (50+)', strength: 'high', source: 'LinkedIn', priority: 3 },
    { signal: 'Using legacy ERP (NetSuite, SAP, Oracle)', strength: 'medium', source: 'BuiltWith/LinkedIn', priority: 4 },
    { signal: 'Recent CFO/VP Finance hire', strength: 'high', source: 'LinkedIn', priority: 5 },
    { signal: 'Public mentions of supply chain optimization', strength: 'medium', source: 'Google Alerts', priority: 6 },
    { signal: 'Expanding to new suppliers/markets', strength: 'medium', source: 'News/PR', priority: 7 },
    { signal: 'Complaints about payment processing fees', strength: 'high', source: 'G2/Capterra reviews', priority: 8 },
  ],
  disqualifiers: [
    'SaaS-only (no physical goods/suppliers)',
    'Pre-revenue or <$5M ARR',
    'Acquired in last 12 months (frozen systems)',
    'Heavy government/public sector focus',
    'Already using crypto treasury solutions',
    'Fewer than 10 active vendors',
  ]
}

// Secondary ICP: Growth-stage companies scaling operations
export const SECONDARY_ICP: ICPCompany = {
  minRevenue: 5_000_000,
  maxRevenue: 50_000_000,
  minEmployees: 25,
  maxEmployees: 200,
  industries: [
    'E-commerce (physical goods)',
    'Consumer Products',
    'Hardware Startups',
    'Clean Energy / Solar',
    'Food Tech',
    'AgTech',
    'Industrial IoT',
  ],
  signals: [
    { signal: 'Series A/B funded', strength: 'high', source: 'Crunchbase', priority: 1 },
    { signal: 'First ops/finance hire', strength: 'high', source: 'LinkedIn', priority: 2 },
    { signal: 'Scaling supply chain', strength: 'high', source: 'News/PR', priority: 3 },
    { signal: 'YC/Techstars alumni', strength: 'medium', source: 'Crunchbase', priority: 4 },
  ],
  disqualifiers: [
    'Bootstrapped with no external funding',
    'Consumer services only',
    'Less than 5 suppliers',
  ]
}

// =============================================================================
// BUYER PERSONAS
// =============================================================================

export const BUYER_PERSONAS: BuyerPersona[] = [
  {
    title: 'Chief Financial Officer',
    alternativeTitles: ['CFO', 'VP Finance', 'Finance Director', 'Head of Finance'],
    department: 'Finance',
    seniority: 'C-Level / VP',
    painPoints: [
      'Cash trapped in working capital instead of earning yield',
      'Payment processing fees eating into margins (2-3%)',
      'Manual reconciliation consuming team hours',
      'Lack of real-time visibility into cash position',
      'Forecasting errors due to payment timing uncertainty',
      'Treasury returns lagging inflation',
    ],
    goals: [
      'Maximize working capital efficiency',
      'Reduce payment processing costs',
      'Improve cash flow forecasting accuracy',
      'Generate yield on idle treasury',
      'Automate manual finance operations',
    ],
    objections: [
      "What's the regulatory status?",
      "How is the principal protected?",
      "What's the liquidity if we need funds quickly?",
      "Our board won't approve crypto-adjacent solutions",
      "We're locked into our current ERP/bank",
    ],
    triggers: [
      'Quarterly board meeting coming up',
      'Year-end planning cycle',
      'New CFO in first 90 days',
      'Cost reduction initiative',
      'Treasury underperformance review',
    ],
    messageAngle: 'Turn predictable spend into 4.5%+ yield while eliminating payment fees',
    linkedInKeywords: ['treasury management', 'working capital', 'cash flow optimization', 'payment efficiency'],
  },
  {
    title: 'VP of Procurement / Chief Procurement Officer',
    alternativeTitles: ['CPO', 'VP Supply Chain', 'Director of Procurement', 'Head of Sourcing'],
    department: 'Operations / Supply Chain',
    seniority: 'VP / Director',
    painPoints: [
      'Supplier relationships strained by slow payments',
      'Early payment discounts impossible to capture',
      'No leverage for better terms without faster payment',
      'Complex multi-currency supplier payments',
      'High cost of international wire transfers',
      'Fraud risk in B2B payments',
    ],
    goals: [
      'Strengthen supplier relationships',
      'Capture early payment discounts (2-3%)',
      'Negotiate better terms',
      'Streamline supplier onboarding',
      'Reduce payment friction',
    ],
    objections: [
      "Our suppliers won't accept new payment methods",
      "We need to match our ERP workflows",
      "What about our existing purchasing cards?",
      "International compliance is complex",
    ],
    triggers: [
      'Supplier consolidation initiative',
      'New supplier onboarding wave',
      'Supply chain disruption event',
      'Procurement transformation project',
    ],
    messageAngle: 'Pay suppliers instantly at 0% fees. Capture every early payment discount.',
    linkedInKeywords: ['supplier management', 'procurement', 'supply chain', 'vendor payments'],
  },
  {
    title: 'Controller / VP of Accounting',
    alternativeTitles: ['Controller', 'VP Accounting', 'Director of Accounting', 'Head of AP'],
    department: 'Accounting',
    seniority: 'Director / Manager',
    painPoints: [
      'Hours spent on payment reconciliation',
      'Three-way match failures causing delays',
      'ACH/wire failures and manual intervention',
      'Month-end close delayed by payment issues',
      'Audit trail gaps in payment records',
      'Multiple payment systems to manage',
    ],
    goals: [
      'Automate reconciliation',
      'Reduce payment exceptions',
      'Accelerate month-end close',
      'Single source of truth for payments',
      'Clean audit trails',
    ],
    objections: [
      "This seems too good to be true",
      "We need SOC 2 compliance",
      "How does it integrate with our GL?",
      "What about payment approvals/workflows?",
    ],
    triggers: [
      'Failed audit finding on payments',
      'Month-end close taking too long',
      'Payment system migration',
      'New accounting software implementation',
    ],
    messageAngle: 'One-click payments. Auto-reconciliation. Never chase a payment exception again.',
    linkedInKeywords: ['accounts payable', 'reconciliation', 'payment processing', 'financial operations'],
  },
  {
    title: 'Treasury Director / Manager',
    alternativeTitles: ['Treasury Manager', 'Treasury Analyst', 'Director of Treasury', 'Cash Manager'],
    department: 'Treasury',
    seniority: 'Director / Manager',
    painPoints: [
      'Treasury yields below inflation',
      'Cash sitting idle in operating accounts',
      'Manual cash positioning across accounts',
      'Limited investment options for short-term cash',
      'Bank fees eroding returns',
      'Lack of real-time cash visibility',
    ],
    goals: [
      'Maximize risk-adjusted returns on idle cash',
      'Real-time cash visibility across all accounts',
      'Reduce bank dependency and fees',
      'Automate cash positioning',
      'Improve forecasting accuracy',
    ],
    objections: [
      "What's the risk profile vs money market funds?",
      "How is principal protected?",
      "What happens if Circle/USDC has issues?",
      "Is this FDIC insured?",
    ],
    triggers: [
      'Treasury policy review',
      'Low yields on current investments',
      'New treasury management system consideration',
      'Cash accumulation from fundraise',
    ],
    messageAngle: '4.5%+ yield on your operating cash. 100% principal protected. Instant liquidity.',
    linkedInKeywords: ['treasury', 'cash management', 'liquidity', 'investment policy'],
  },
]

// =============================================================================
// WHERE TO FIND THEM
// =============================================================================

export interface TargetingChannel {
  channel: string
  cost: string
  effort: 'low' | 'medium' | 'high'
  quality: 'low' | 'medium' | 'high'
  volume: 'low' | 'medium' | 'high'
  instructions: string[]
  filters?: Record<string, string[]>
}

export const TARGETING_CHANNELS: TargetingChannel[] = [
  {
    channel: 'LinkedIn Sales Navigator',
    cost: '$100/mo',
    effort: 'medium',
    quality: 'high',
    volume: 'medium',
    instructions: [
      'Save target persona searches',
      'Set up lead alerts for job changes',
      'Focus on "Posted in last 30 days"',
      'Look for 2nd degree connections for warm intros',
      'Track company pages for hiring signals',
    ],
    filters: {
      'Title': ['CFO', 'VP Finance', 'Treasury', 'Controller', 'Procurement', 'CPO'],
      'Industry': ['Manufacturing', 'Wholesale', 'Construction', 'Food & Bev'],
      'Company Headcount': ['51-200', '201-500', '501-1000', '1001-5000'],
      'Geography': ['United States'],
      'Function': ['Finance', 'Operations', 'Accounting'],
      'Seniority Level': ['VP', 'CXO', 'Director'],
    }
  },
  {
    channel: 'Apollo.io',
    cost: '$49-99/mo',
    effort: 'low',
    quality: 'medium',
    volume: 'high',
    instructions: [
      'Import ICP company list from LinkedIn',
      'Enrich contacts with verified emails',
      'Set up sequences for multi-touch outreach',
      'Use intent data filters if available',
      'Export to CRM for tracking',
    ],
    filters: {
      'Company Revenue': ['$10M-$50M', '$50M-$100M', '$100M-$500M'],
      'Employee Count': ['50-200', '200-500', '500-2000'],
      'Technologies': ['NetSuite', 'SAP', 'Oracle', 'Quickbooks Enterprise'],
      'Industry': ['Manufacturing', 'Wholesale', 'Distribution'],
    }
  },
  {
    channel: 'Slack/Discord Communities',
    cost: 'Free',
    effort: 'high',
    quality: 'high',
    volume: 'low',
    instructions: [
      'Join: CFO Network, Finance Twitter/X Spaces, Treasury Professionals',
      'Join: Pavilion (RevGenius), Modern Treasury Community',
      'Contribute value first (answer questions, share insights)',
      'DM after establishing presence (never cold DM)',
      'Share treasury optimization content',
    ],
  },
  {
    channel: 'Industry Conferences (Virtual/In-Person)',
    cost: '$0-500',
    effort: 'high',
    quality: 'high',
    volume: 'medium',
    instructions: [
      'AFP Annual Conference (Treasury)',
      'ISM World (Procurement)',
      'NAPM local chapters',
      'FEI (Financial Executives International)',
      'Target speaker/attendee lists on LinkedIn before event',
    ],
  },
  {
    channel: 'Podcast Guesting',
    cost: 'Free',
    effort: 'medium',
    quality: 'high',
    volume: 'low',
    instructions: [
      'Pitch to finance/treasury podcasts',
      'Topic: "The Future of B2B Payments" or "Treasury Yield Optimization"',
      'Create audiogram clips for LinkedIn',
      'Repurpose for content marketing',
    ],
  },
  {
    channel: 'G2/Capterra Review Mining',
    cost: 'Free',
    effort: 'low',
    quality: 'medium',
    volume: 'low',
    instructions: [
      'Search reviews for payment/treasury solutions',
      'Look for complaints about: fees, slow payments, manual reconciliation',
      'Extract company names from reviewer profiles',
      'Cross-reference with LinkedIn for contacts',
    ],
  },
]

// =============================================================================
// SCORING MODEL
// =============================================================================

export interface LeadScore {
  company: number      // 0-40 points
  persona: number      // 0-30 points
  timing: number       // 0-20 points
  engagement: number   // 0-10 points
  total: number        // 0-100 points
  tier: 'hot' | 'warm' | 'cold'
}

export function scoreCompany(attributes: {
  revenue: number
  employees: number
  industry: string
  signals: string[]
}): number {
  let score = 0

  // Revenue fit (0-15 points)
  if (attributes.revenue >= 10_000_000 && attributes.revenue <= 100_000_000) score += 15
  else if (attributes.revenue >= 5_000_000 && attributes.revenue <= 500_000_000) score += 10
  else if (attributes.revenue >= 1_000_000) score += 5

  // Employee fit (0-10 points)
  if (attributes.employees >= 100 && attributes.employees <= 1000) score += 10
  else if (attributes.employees >= 50 && attributes.employees <= 2000) score += 7
  else if (attributes.employees >= 25) score += 3

  // Industry fit (0-10 points)
  const primaryIndustries = PRIMARY_ICP.industries.map(i => i.toLowerCase())
  if (primaryIndustries.some(ind => attributes.industry.toLowerCase().includes(ind))) {
    score += 10
  } else if (SECONDARY_ICP.industries.some(ind => attributes.industry.toLowerCase().includes(ind.toLowerCase()))) {
    score += 5
  }

  // Buying signals (0-5 points, +1 per signal, max 5)
  const signalCount = Math.min(attributes.signals.length, 5)
  score += signalCount

  return score
}

export function scorePersona(title: string): number {
  const normalizedTitle = title.toLowerCase()

  // C-level finance = 30 points
  if (normalizedTitle.includes('cfo') || normalizedTitle.includes('chief financial')) return 30
  if (normalizedTitle.includes('cpo') || normalizedTitle.includes('chief procurement')) return 28

  // VP level = 25 points
  if (normalizedTitle.includes('vp') &&
     (normalizedTitle.includes('finance') || normalizedTitle.includes('treasury') || normalizedTitle.includes('procurement'))) {
    return 25
  }

  // Director level = 20 points
  if (normalizedTitle.includes('director') &&
     (normalizedTitle.includes('treasury') || normalizedTitle.includes('procurement') || normalizedTitle.includes('controller'))) {
    return 20
  }

  // Controller = 18 points
  if (normalizedTitle.includes('controller')) return 18

  // Manager level = 12 points
  if (normalizedTitle.includes('manager') &&
     (normalizedTitle.includes('treasury') || normalizedTitle.includes('ap') || normalizedTitle.includes('payment'))) {
    return 12
  }

  return 5
}

export function scoreTiming(signals: {
  recentHire?: boolean
  quarterEnd?: boolean
  jobPosting?: boolean
  newsEvent?: boolean
}): number {
  let score = 0

  if (signals.recentHire) score += 8    // New hire = mandate to make changes
  if (signals.quarterEnd) score += 5    // Planning cycle = budget discussions
  if (signals.jobPosting) score += 4    // Hiring = growing = need infrastructure
  if (signals.newsEvent) score += 3     // News = top of mind

  return Math.min(score, 20)
}

export function scoreEngagement(activities: {
  openedEmail?: boolean
  clickedLink?: boolean
  visitedSite?: boolean
  repliedEmail?: boolean
}): number {
  let score = 0

  if (activities.repliedEmail) score += 5
  if (activities.visitedSite) score += 3
  if (activities.clickedLink) score += 1
  if (activities.openedEmail) score += 1

  return Math.min(score, 10)
}

export function calculateLeadScore(
  companyScore: number,
  personaScore: number,
  timingScore: number,
  engagementScore: number
): LeadScore {
  const total = companyScore + personaScore + timingScore + engagementScore

  let tier: 'hot' | 'warm' | 'cold'
  if (total >= 70) tier = 'hot'
  else if (total >= 45) tier = 'warm'
  else tier = 'cold'

  return {
    company: companyScore,
    persona: personaScore,
    timing: timingScore,
    engagement: engagementScore,
    total,
    tier
  }
}

// =============================================================================
// OBJECTION HANDLING FRAMEWORK
// =============================================================================

export interface ObjectionResponse {
  objection: string
  category: 'risk' | 'integration' | 'cost' | 'trust' | 'timing'
  response: string
  proofPoints: string[]
  followUp: string
}

export const OBJECTION_RESPONSES: ObjectionResponse[] = [
  {
    objection: "How is the principal protected?",
    category: 'risk',
    response: "Your deposit is held as USDC in a Circle-backed wallet. USDC is backed 1:1 by cash and short-term US Treasuries, audited monthly by Grant Thornton. You can withdraw to your bank account anytime.",
    proofPoints: [
      'USDC reserve reports: https://www.circle.com/en/transparency',
      'Grant Thornton monthly attestations',
      'Full liquidity - instant redemption to USD',
    ],
    followUp: "Want me to send over Circle's latest attestation report?",
  },
  {
    objection: "This seems too good to be true",
    category: 'trust',
    response: "Healthy skepticism! Here's the model: You deposit cash. We convert to USDC (stablecoin). That USDC earns yield from DeFi protocols. We pass 70% of that yield to you. The remaining 30% covers our ops and is our margin. No magic - just efficient access to yield sources unavailable to traditional treasury.",
    proofPoints: [
      'DeFi yields publicly verifiable on-chain',
      'Major institutions (Visa, Fidelity) using similar strategies',
      'We handle compliance and custody - you get the yield',
    ],
    followUp: "Happy to walk through the exact yield sources on a call. When works for you?",
  },
  {
    objection: "Our board won't approve crypto-adjacent solutions",
    category: 'trust',
    response: "Totally understand. Two things: 1) You never touch crypto - you deposit USD, earn yield, withdraw USD. 2) We can provide board-ready materials showing our security architecture, audits, and how Fortune 500s use similar treasury strategies. The word 'crypto' doesn't need to appear.",
    proofPoints: [
      'USD-in, USD-out workflow',
      'SOC 2 compliant custody partner',
      'Board deck template available',
    ],
    followUp: "Would a call with our Head of Risk help prep board materials?",
  },
  {
    objection: "We're locked into our current ERP/bank",
    category: 'integration',
    response: "We integrate alongside your existing systems, not replace them. Our SDK has pre-built connectors for NetSuite, SAP, Oracle, and Quickbooks. Payments flow through our rails, but reporting syncs back to your ERP. Most clients go live in <2 weeks.",
    proofPoints: [
      'NetSuite, SAP, Oracle connectors ready',
      'CSV/API import for any system',
      'Parallel run option - no disruption',
    ],
    followUp: "What ERP are you on? I can show you exactly how it integrates.",
  },
  {
    objection: "What about regulatory/compliance?",
    category: 'risk',
    response: "Great question. We operate under Money Transmission Licenses in applicable states. Circle (our USDC partner) is regulated and audited. We're registered with FinCEN and maintain full AML/KYC compliance. Happy to share our compliance docs.",
    proofPoints: [
      'Money Transmission Licenses',
      'Circle's regulatory framework',
      'FinCEN registration',
    ],
    followUp: "Want me to loop in our compliance team for a deeper dive?",
  },
  {
    objection: "Our suppliers won't accept new payment methods",
    category: 'integration',
    response: "Your suppliers receive USD via ACH or wire - same as today. They don't need to know or do anything different. The GRAIN-to-USD conversion happens on our side. We've never had a supplier reject a payment.",
    proofPoints: [
      'Suppliers receive USD, not crypto',
      'Same bank deposit experience for them',
      'We handle all conversion',
    ],
    followUp: "Want to see a sample supplier payment notification?",
  },
  {
    objection: "We don't have budget for new tools right now",
    category: 'cost',
    response: "Grain & Vault doesn't cost - it earns. No monthly fees. The only fee is 1% on payments (vs 2-3% on cards), which is sourcing cost, not overhead. On $1M monthly spend, you'd earn ~$45K/year in appreciation while saving $10-20K in payment fees.",
    proofPoints: [
      'No SaaS fee',
      '1% payment fee vs 2-3% card fees',
      'Net positive ROI from day 1',
    ],
    followUp: "What's your rough monthly supplier spend? I can model the exact ROI.",
  },
  {
    objection: "We need to run this by legal/security",
    category: 'timing',
    response: "Absolutely - we expect that. We have security questionnaires, SOC 2 reports, and legal memo templates ready to go. Most legal reviews take 1-2 weeks. Want me to send those over so your team can review in parallel?",
    proofPoints: [
      'Pre-filled security questionnaire',
      'SOC 2 Type II report',
      'Template MSA for review',
    ],
    followUp: "What's the best email for your legal/security team?",
  },
]

// =============================================================================
// COMPETITIVE POSITIONING
// =============================================================================

export interface Competitor {
  name: string
  category: string
  weaknesses: string[]
  positioning: string
  battleCard: string
}

export const COMPETITORS: Competitor[] = [
  {
    name: 'Traditional Banks (BoA, Chase, Wells Fargo)',
    category: 'Incumbent',
    weaknesses: [
      'Near-zero yield on operating accounts',
      '2-3% card processing fees',
      'ACH takes 3-5 business days',
      'Manual reconciliation required',
      'Poor API/integration experience',
    ],
    positioning: 'We complement your bank, not replace it. Deposit works with your existing bank account.',
    battleCard: 'You keep your bank. We just make your idle cash work harder. Compare: 0.01% bank savings vs 4.5%+ GRAIN yield.',
  },
  {
    name: 'Bill.com / Tipalti / Airbase',
    category: 'AP Automation',
    weaknesses: [
      'Monthly SaaS fees ($500-2000+/mo)',
      'Still uses slow ACH rails',
      'No yield on idle funds',
      'Complex implementation',
    ],
    positioning: 'We handle payments AND generate yield. No monthly fees.',
    battleCard: 'Bill.com costs $X/month and pays 0% yield. We cost $0/month and pay 4.5%+ yield. You choose.',
  },
  {
    name: 'Ramp / Brex / Corporate Cards',
    category: 'Spend Management',
    weaknesses: [
      '2-3% merchant fees (passed to you)',
      'Suppliers hate card payments (costs them)',
      'No yield on deposits',
      'Rebates don\'t offset true cost',
    ],
    positioning: 'Cards are expensive for B2B. We offer 0% fees and suppliers love instant settlement.',
    battleCard: 'Your 1.5% card rebate doesn\'t offset the 2.5% merchant fee. Net cost = 1%. GRAIN = 0% fees + 4.5% yield.',
  },
  {
    name: 'Mercury / Brex Treasury',
    category: 'Fintech Treasury',
    weaknesses: [
      'Lower yields (2-4%)',
      'Limited to tech/startup focus',
      'No payment rails built-in',
      'Not designed for B2B/procurement',
    ],
    positioning: 'We\'re built for companies with suppliers and inventory, not just SaaS startups.',
    battleCard: 'Mercury Treasury = 4% yield. GRAIN = 4.5%+ yield + integrated supplier payments. Built for real businesses.',
  },
]

// Helper to get persona by title
export function getPersonaByTitle(title: string): BuyerPersona | undefined {
  const normalizedTitle = title.toLowerCase()
  return BUYER_PERSONAS.find(p =>
    p.title.toLowerCase().includes(normalizedTitle) ||
    p.alternativeTitles.some(alt => normalizedTitle.includes(alt.toLowerCase()))
  )
}

// Helper to get relevant objections for persona
export function getObjectionsForPersona(persona: BuyerPersona): ObjectionResponse[] {
  const personaDepartment = persona.department.toLowerCase()

  return OBJECTION_RESPONSES.filter(obj => {
    if (personaDepartment.includes('finance') || personaDepartment.includes('treasury')) {
      return ['risk', 'trust', 'cost'].includes(obj.category)
    }
    if (personaDepartment.includes('procurement') || personaDepartment.includes('operations')) {
      return ['integration', 'cost', 'trust'].includes(obj.category)
    }
    if (personaDepartment.includes('accounting')) {
      return ['integration', 'risk', 'timing'].includes(obj.category)
    }
    return true
  })
}
