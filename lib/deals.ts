/**
 * Wells AI - Deal Tracking System
 * Win/loss counters and attribution calculations
 */

// ===== TYPES =====

export type DealStatus =
  | 'discovered'      // Found via partner discovery
  | 'registered'      // Deal registration submitted
  | 'qualified'       // Partner accepted registration
  | 'in_progress'     // Actively working the deal
  | 'won'             // Closed won
  | 'lost'            // Closed lost
  | 'abandoned'       // No longer pursuing

export interface Deal {
  dealId: string
  partnerId: string                    // 'ibm', 'cisco', etc.
  partnerOpportunityId?: string        // External partner system ID

  // Account details
  accountName: string
  accountContact?: string
  accountPain?: string

  // Deal details
  dealName: string
  estimatedValue: number               // ACV in USD
  stage: DealStatus

  // Attribution
  wellsAttribution: number             // 33 basis points (0.0033)
  wellsFee?: number                    // Calculated: estimatedValue * wellsAttribution

  // Tracking
  discoveredAt: string
  registeredAt?: string
  qualifiedAt?: string
  closedAt?: string

  // Metadata
  wedge?: string                       // e.g., "Customer Ops"
  productFit?: string                  // e.g., "watsonx Assistant + knowledge mining"
  pilotDuration?: number               // Days (e.g., 90)

  metadata?: Record<string, any>
}

export interface DealMetrics {
  // Counts
  totalDiscovered: number
  totalRegistered: number
  totalQualified: number
  totalInProgress: number
  totalWon: number
  totalLost: number
  totalAbandoned: number

  // Values
  pipelineValue: number                // Sum of all open deals
  wonValue: number                     // Sum of closed won
  lostValue: number                    // Sum of closed lost

  // Attribution
  totalAttribution: number             // Sum of wellsFee for won deals

  // Rates
  winRate: number                      // won / (won + lost)
  qualificationRate: number            // qualified / registered

  // By partner
  byPartner: Record<string, {
    discovered: number
    registered: number
    won: number
    lost: number
    pipelineValue: number
    wonValue: number
    attribution: number
  }>
}

// ===== CONSTANTS =====

export const WELLS_ATTRIBUTION_BPS = 33          // 33 basis points
export const WELLS_ATTRIBUTION_DECIMAL = 0.0033  // 0.33%

// ===== IN-MEMORY STORAGE =====

const deals = new Map<string, Deal>()

// ===== DEAL OPERATIONS =====

/**
 * Create a new deal from discovered opportunity
 */
export function createDeal(params: {
  partnerId: string
  partnerOpportunityId?: string
  accountName: string
  dealName: string
  estimatedValue: number
  wedge?: string
  productFit?: string
  metadata?: Record<string, any>
}): Deal {
  const dealId = `deal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const deal: Deal = {
    dealId,
    partnerId: params.partnerId,
    partnerOpportunityId: params.partnerOpportunityId,
    accountName: params.accountName,
    dealName: params.dealName,
    estimatedValue: params.estimatedValue,
    stage: 'discovered',
    wellsAttribution: WELLS_ATTRIBUTION_DECIMAL,
    wellsFee: params.estimatedValue * WELLS_ATTRIBUTION_DECIMAL,
    discoveredAt: new Date().toISOString(),
    wedge: params.wedge,
    productFit: params.productFit,
    metadata: params.metadata
  }

  deals.set(dealId, deal)

  console.log(`✅ Deal created: ${dealId} - ${params.accountName} ($${params.estimatedValue.toLocaleString()})`)

  return deal
}

/**
 * Update deal status
 */
export function updateDealStatus(dealId: string, status: DealStatus): Deal {
  const deal = deals.get(dealId)
  if (!deal) {
    throw new Error(`Deal ${dealId} not found`)
  }

  const now = new Date().toISOString()

  // Update status
  deal.stage = status

  // Update timestamps
  if (status === 'registered' && !deal.registeredAt) {
    deal.registeredAt = now
  }
  if (status === 'qualified' && !deal.qualifiedAt) {
    deal.qualifiedAt = now
  }
  if ((status === 'won' || status === 'lost') && !deal.closedAt) {
    deal.closedAt = now
  }

  deals.set(dealId, deal)

  console.log(`✅ Deal updated: ${dealId} -> ${status}`)

  return deal
}

/**
 * Get deal by ID
 */
export function getDeal(dealId: string): Deal | undefined {
  return deals.get(dealId)
}

/**
 * Get all deals
 */
export function getAllDeals(): Deal[] {
  return Array.from(deals.values())
}

/**
 * Get deals by partner
 */
export function getDealsByPartner(partnerId: string): Deal[] {
  return Array.from(deals.values()).filter(d => d.partnerId === partnerId)
}

/**
 * Get deals by status
 */
export function getDealsByStatus(status: DealStatus): Deal[] {
  return Array.from(deals.values()).filter(d => d.stage === status)
}

/**
 * Calculate deal metrics
 */
export function calculateMetrics(): DealMetrics {
  const allDeals = getAllDeals()

  // Count by status
  const discovered = allDeals.filter(d => d.stage === 'discovered').length
  const registered = allDeals.filter(d => d.stage === 'registered').length
  const qualified = allDeals.filter(d => d.stage === 'qualified').length
  const inProgress = allDeals.filter(d => d.stage === 'in_progress').length
  const won = allDeals.filter(d => d.stage === 'won').length
  const lost = allDeals.filter(d => d.stage === 'lost').length
  const abandoned = allDeals.filter(d => d.stage === 'abandoned').length

  // Calculate values
  const openStatuses: DealStatus[] = ['discovered', 'registered', 'qualified', 'in_progress']
  const pipelineValue = allDeals
    .filter(d => openStatuses.includes(d.stage))
    .reduce((sum, d) => sum + d.estimatedValue, 0)

  const wonValue = allDeals
    .filter(d => d.stage === 'won')
    .reduce((sum, d) => sum + d.estimatedValue, 0)

  const lostValue = allDeals
    .filter(d => d.stage === 'lost')
    .reduce((sum, d) => sum + d.estimatedValue, 0)

  // Attribution (only on won deals)
  const totalAttribution = allDeals
    .filter(d => d.stage === 'won')
    .reduce((sum, d) => sum + (d.wellsFee || 0), 0)

  // Rates
  const closedDeals = won + lost
  const winRate = closedDeals > 0 ? won / closedDeals : 0
  const qualificationRate = registered > 0 ? qualified / registered : 0

  // By partner
  const byPartner: Record<string, any> = {}
  const partners = Array.from(new Set(allDeals.map(d => d.partnerId)))

  partners.forEach(partnerId => {
    const partnerDeals = allDeals.filter(d => d.partnerId === partnerId)

    byPartner[partnerId] = {
      discovered: partnerDeals.filter(d => d.stage === 'discovered').length,
      registered: partnerDeals.filter(d => d.stage === 'registered').length,
      won: partnerDeals.filter(d => d.stage === 'won').length,
      lost: partnerDeals.filter(d => d.stage === 'lost').length,
      pipelineValue: partnerDeals
        .filter(d => openStatuses.includes(d.stage))
        .reduce((sum, d) => sum + d.estimatedValue, 0),
      wonValue: partnerDeals
        .filter(d => d.stage === 'won')
        .reduce((sum, d) => sum + d.estimatedValue, 0),
      attribution: partnerDeals
        .filter(d => d.stage === 'won')
        .reduce((sum, d) => sum + (d.wellsFee || 0), 0)
    }
  })

  return {
    totalDiscovered: discovered,
    totalRegistered: registered,
    totalQualified: qualified,
    totalInProgress: inProgress,
    totalWon: won,
    totalLost: lost,
    totalAbandoned: abandoned,
    pipelineValue,
    wonValue,
    lostValue,
    totalAttribution,
    winRate,
    qualificationRate,
    byPartner
  }
}

/**
 * Seed fixture data for testing
 */
export function seedFixtureDeals() {
  // IBM: Acme Health
  createDeal({
    partnerId: 'ibm',
    accountName: 'Acme Health',
    dealName: 'Acme Health - Customer Ops Automation',
    estimatedValue: 500000,
    wedge: 'Customer Ops',
    productFit: 'watsonx Assistant + knowledge mining',
    metadata: {
      contact: 'VP Customer Experience',
      pain: 'High AHT, agent backlog',
      pilotDuration: 90
    }
  })

  // IBM: Northwind Insurance
  createDeal({
    partnerId: 'ibm',
    accountName: 'Northwind Insurance',
    dealName: 'Northwind Insurance - Case Classification',
    estimatedValue: 750000,
    wedge: 'Customer Ops',
    productFit: 'watsonx Assistant + case classification',
    metadata: {
      contact: 'Head of Ops',
      pain: 'Long first-response, churn',
      pilotDuration: 90
    }
  })

  // Cisco: Contoso Manufacturing (won deal for testing)
  const contosoId = createDeal({
    partnerId: 'cisco',
    accountName: 'Contoso Manufacturing',
    dealName: 'Contoso Manufacturing - Network Automation',
    estimatedValue: 1200000,
    wedge: 'Network Ops',
    productFit: 'Cisco DNA Center + automation',
    metadata: {
      contact: 'CTO',
      pain: 'Manual network provisioning'
    }
  }).dealId

  // Progress Contoso to won
  updateDealStatus(contosoId, 'registered')
  updateDealStatus(contosoId, 'qualified')
  updateDealStatus(contosoId, 'in_progress')
  updateDealStatus(contosoId, 'won')

  console.log('✅ Fixture deals seeded')
}

// ===== EXPORTS =====

export default {
  createDeal,
  updateDealStatus,
  getDeal,
  getAllDeals,
  getDealsByPartner,
  getDealsByStatus,
  calculateMetrics,
  seedFixtureDeals
}
