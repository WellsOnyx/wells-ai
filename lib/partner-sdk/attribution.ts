/**
 * Partner SDK - Attribution Tracker
 * Links partner deals to 33bps revenue tracking
 */

import { PartnerPlatform, PartnerOpportunity, SuggestedAction, PartnerAttribution } from './types'

export class AttributionTracker {
  private attributions: Map<string, PartnerAttribution> = new Map()

  /**
   * Create attribution record when opportunity is influenced
   */
  async trackInfluence(params: {
    partner: PartnerPlatform
    opportunity: PartnerOpportunity
    actions: SuggestedAction[]
    contributionWeights: {
      discovery: number
      qualification: number
      progression: number
      close: number
    }
  }): Promise<PartnerAttribution> {
    const { partner, opportunity, actions, contributionWeights } = params

    // Calculate influenced revenue
    const totalContribution = Object.values(contributionWeights).reduce((sum, w) => sum + w, 0)
    const influencedAmount = opportunity.value.amount * (totalContribution / 100)

    // Calculate Wells fee (33bps)
    const wellsFee = influencedAmount * 0.0033

    // Calculate tithe (10% of gross fee)
    const tithe = wellsFee * 0.10

    // Net fee
    const netFee = wellsFee - tithe

    const attribution: PartnerAttribution = {
      id: `attr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      partner,
      opportunity,
      actions,
      contribution: contributionWeights,
      revenue: {
        total: opportunity.value.amount,
        influenced: influencedAmount,
        wellsFee,
        tithe,
        net: netFee,
      },
      audit: {
        createdAt: new Date(),
        updatedAt: new Date(),
        policyVersion: '1.0.0',
        consentRef: 'partner_sdk_consent',
      },
    }

    this.attributions.set(attribution.id, attribution)

    console.log('[Attribution] Tracked influence:', {
      partner,
      opportunity: opportunity.name,
      influenced: `$${influencedAmount.toLocaleString()}`,
      wellsFee: `$${wellsFee.toLocaleString()}`,
      tithe: `$${tithe.toLocaleString()}`,
      net: `$${netFee.toLocaleString()}`,
    })

    return attribution
  }

  /**
   * Mark deal as closed
   */
  async markClosed(attributionId: string, closeDate: Date): Promise<PartnerAttribution | undefined> {
    const attribution = this.attributions.get(attributionId)
    if (!attribution) {
      return undefined
    }

    attribution.closeDate = closeDate
    attribution.audit.updatedAt = new Date()

    console.log('[Attribution] Deal closed:', {
      id: attributionId,
      closeDate,
      revenue: `$${attribution.revenue.total.toLocaleString()}`,
      wellsFee: `$${attribution.revenue.wellsFee.toLocaleString()}`,
    })

    // In production: Trigger invoice generation via auto-billing
    // await autoBilling.handleDealClosed({ ... })

    return attribution
  }

  /**
   * Get attribution by ID
   */
  getAttribution(attributionId: string): PartnerAttribution | undefined {
    return this.attributions.get(attributionId)
  }

  /**
   * Get all attributions for partner
   */
  getPartnerAttributions(partner: PartnerPlatform): PartnerAttribution[] {
    return Array.from(this.attributions.values()).filter(a => a.partner === partner)
  }

  /**
   * Get attribution summary
   */
  getAttributionSummary(partner?: PartnerPlatform): {
    totalOpportunities: number
    totalRevenue: number
    totalInfluenced: number
    totalWellsFees: number
    totalTithe: number
    totalNet: number
    closedDeals: number
    openDeals: number
  } {
    let attributions = Array.from(this.attributions.values())

    if (partner) {
      attributions = attributions.filter(a => a.partner === partner)
    }

    const closed = attributions.filter(a => a.closeDate)

    return {
      totalOpportunities: attributions.length,
      totalRevenue: attributions.reduce((sum, a) => sum + a.revenue.total, 0),
      totalInfluenced: attributions.reduce((sum, a) => sum + a.revenue.influenced, 0),
      totalWellsFees: attributions.reduce((sum, a) => sum + a.revenue.wellsFee, 0),
      totalTithe: attributions.reduce((sum, a) => sum + a.revenue.tithe, 0),
      totalNet: attributions.reduce((sum, a) => sum + a.revenue.net, 0),
      closedDeals: closed.length,
      openDeals: attributions.length - closed.length,
    }
  }

  /**
   * Export ledger (for finance/audit)
   */
  exportLedger(partner?: PartnerPlatform): Array<{
    attributionId: string
    partner: PartnerPlatform
    opportunityName: string
    customerName: string
    totalRevenue: number
    influenced: number
    wellsFee: number
    tithe: number
    net: number
    closeDate: string | null
    status: 'open' | 'closed'
  }> {
    let attributions = Array.from(this.attributions.values())

    if (partner) {
      attributions = attributions.filter(a => a.partner === partner)
    }

    return attributions.map(a => ({
      attributionId: a.id,
      partner: a.partner,
      opportunityName: a.opportunity.name,
      customerName: a.opportunity.customer.name,
      totalRevenue: a.revenue.total,
      influenced: a.revenue.influenced,
      wellsFee: a.revenue.wellsFee,
      tithe: a.revenue.tithe,
      net: a.revenue.net,
      closeDate: a.closeDate ? a.closeDate.toISOString() : null,
      status: a.closeDate ? 'closed' : 'open',
    }))
  }
}
