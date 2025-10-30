/**
 * Wells AI - Unified Opportunity Schema (Multi-Tenant Platform)
 * Normalizes partner opportunities from IBM, Cisco, Plaid, AWS, etc. into single format
 *
 * Platform Model: Any supplier can register and track opportunities from their partners
 * Wells Revenue: 33 bps on every deal closed through the platform
 */

// ===== ENUMS =====

export enum OpportunityStage {
  Lead = 'lead',
  Qualified = 'qualified',
  Proposal = 'proposal',
  Negotiation = 'negotiation',
  ClosedWon = 'closed-won',
  ClosedLost = 'closed-lost'
}

export enum OpportunityStatus {
  Open = 'open',
  InProgress = 'in-progress',
  Closed = 'closed'
}

export enum OpportunitySource {
  PartnerPortal = 'partner-portal',
  CoSell = 'co-sell',
  Referral = 'referral',
  Direct = 'direct'
}

// ===== CORE TYPES =====

/**
 * Supplier/Tenant on the Wells AI Platform
 * Any company can register and track opportunities from their partners
 */
export interface Supplier {
  id: string // e.g., 'supplier_acme_corp'
  companyName: string
  industry: string
  contactName: string
  contactEmail: string
  createdAt: string

  // Platform configuration
  platformPlan: 'free' | 'pro' | 'enterprise'
  monthlyFee: number // $0 for free, $X for pro/enterprise
  successFeeRate: number // Default: 0.0033 (33 bps)

  // Partners this supplier tracks
  connectedPartners: string[] // ['ibm', 'cisco', 'aws', etc.]

  // Stats
  totalOpportunities: number
  totalRevenue: number // Total deal value closed
  platformFeesOwed: number // Wells revenue from this supplier
}

export interface OpportunityContact {
  name: string
  email?: string
  phone?: string
  title?: string
}

export interface WellsOpportunity {
  searchType: 'executive-search' | 'procurement' | 'consulting'
  title: string
  description: string
  estimatedFee: number
  timeline?: string
}

/**
 * Unified Opportunity Schema
 * All partner opportunities normalize to this format
 */
export interface Opportunity {
  // Identity
  id: string
  supplierId: string // Tenant/supplier who owns this opportunity
  partnerId: string // 'ibm', 'cisco', 'plaid', etc.
  partnerName: string // 'IBM', 'Cisco', 'Plaid'
  partnerOpportunityId: string // Original ID in partner system

  // Core Fields
  title: string
  description: string
  companyName: string
  industry?: string

  // Financial
  estimatedValue: number // Deal size in USD
  currency: string // Default: 'USD'

  // Lifecycle
  stage: OpportunityStage
  status: OpportunityStatus
  source: OpportunitySource

  // Dates
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
  expectedCloseDate?: string // ISO 8601
  actualCloseDate?: string // ISO 8601

  // Contact
  primaryContact?: OpportunityContact
  additionalContacts?: OpportunityContact[]

  // Products/Services
  products: string[] // e.g., ['IBM Cloud', 'Watson AI']

  // Geography
  region?: string // e.g., 'North America', 'EMEA', 'APAC'
  country?: string
  state?: string

  // Wells Pairing (our value-add)
  wellsOpportunity?: WellsOpportunity

  // Partner-specific metadata
  metadata: {
    // Partner portal URL
    portalUrl?: string

    // Co-sell info
    coSellType?: 'aws-cosell' | 'salesforce-cosell' | 'cisco-cosell' | 'ibm-cosell' | 'plaid-cosell'
    partnerEngagement?: 'low' | 'medium' | 'high'

    // Partner manager
    partnerManager?: string
    partnerManagerEmail?: string

    // Original partner data (for debugging)
    raw?: Record<string, any>
  }
}

// ===== PARSER INTERFACE =====

export interface OpportunityParser {
  partnerId: string
  parse(rawData: any, supplierId?: string): Opportunity
}

// ===== HELPERS =====

/**
 * Generate Wells Opportunity suggestion based on partner opportunity
 */
export function suggestWellsOpportunity(opp: Opportunity): WellsOpportunity | undefined {
  // IBM Cloud migration → CTO search
  if (opp.partnerId === 'ibm' && opp.products.some(p => p.toLowerCase().includes('cloud'))) {
    return {
      searchType: 'executive-search',
      title: 'CTO Search - Cloud Migration Expert',
      description: `${opp.companyName} is implementing IBM Cloud. They need a CTO with cloud migration experience.`,
      estimatedFee: opp.estimatedValue * 0.0033, // 33 bps of deal value
      timeline: '60-90 days'
    }
  }

  // Cisco Umbrella (security) → CISO search
  if (opp.partnerId === 'cisco' && opp.products.some(p => p.toLowerCase().includes('umbrella') || p.toLowerCase().includes('security'))) {
    return {
      searchType: 'executive-search',
      title: 'CISO Search - Cybersecurity Expert',
      description: `${opp.companyName} is implementing Cisco Umbrella security. They need a CISO to lead cybersecurity.`,
      estimatedFee: opp.estimatedValue * 0.0033,
      timeline: '60-90 days'
    }
  }

  // Plaid fintech → CFO or VP Finance search
  if (opp.partnerId === 'plaid' && opp.industry?.toLowerCase().includes('fintech')) {
    return {
      searchType: 'executive-search',
      title: 'CFO Search - Fintech Payment Infrastructure',
      description: `${opp.companyName} is implementing Plaid payment infrastructure. They need a CFO with fintech/payments experience.`,
      estimatedFee: opp.estimatedValue * 0.0033,
      timeline: '60-90 days'
    }
  }

  // Default: generic executive search
  return {
    searchType: 'executive-search',
    title: `Executive Search - ${opp.companyName}`,
    description: `${opp.companyName} is implementing ${opp.products.join(', ')}. Executive search opportunity.`,
    estimatedFee: opp.estimatedValue * 0.0033,
    timeline: '60-90 days'
  }
}

/**
 * Calculate Wells Platform fee from opportunity
 * Works for any supplier on the platform
 */
export function calculatePlatformFee(opp: Opportunity, supplier?: Supplier): number {
  // Use supplier's success fee rate, default to 33 bps
  const successFeeRate = supplier?.successFeeRate || 0.0033

  // Platform fee on partner deal value
  const platformFee = opp.estimatedValue * successFeeRate

  return platformFee
}

/**
 * Calculate Wells revenue from opportunity (legacy - for Wells Onyx as supplier)
 */
export function calculateWellsRevenue(opp: Opportunity): number {
  // 33 basis points of partner deal value
  const partnerInfluencedRevenue = opp.estimatedValue * 0.0033

  // If we also place an executive, add search fee
  const searchFee = opp.wellsOpportunity?.estimatedFee || 0

  return partnerInfluencedRevenue + searchFee
}

/**
 * Check if opportunity is hot (worth prioritizing)
 */
export function isHotOpportunity(opp: Opportunity): boolean {
  // Hot if:
  // - Deal size > $500K
  // - Stage is qualified or later
  // - Expected close within 90 days
  const isLargeEnough = opp.estimatedValue >= 500000
  const isQualified = [
    OpportunityStage.Qualified,
    OpportunityStage.Proposal,
    OpportunityStage.Negotiation
  ].includes(opp.stage)

  const isClosingSoon = opp.expectedCloseDate
    ? new Date(opp.expectedCloseDate).getTime() - Date.now() < 90 * 24 * 60 * 60 * 1000
    : false

  return isLargeEnough && isQualified && isClosingSoon
}
