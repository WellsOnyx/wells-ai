/**
 * @wells/gtm-sdk - Deal Tracking & Attribution
 * Automatic tracking of deals with full attribution
 */

import { RevenueCalculator } from './billing'

export interface DealClosedEvent {
  revenue: number
  customer: string
  customerEmail?: string
  dealName?: string
  source: 'wells_linkedin_outreach' | 'wells_email_outreach' | 'wells_inbound' | 'manual' | string
  campaign?: string
  prospectId?: string
  outreachMessageId?: string
  metadata?: Record<string, any>
}

export interface DealAttribution {
  dealId: string
  revenue: number
  customer: string
  wellsFee: number
  source: string
  campaign?: string
  prospectId?: string
  outreachMessageId?: string
  closedAt: Date
  invoiceId?: string
  paidAt?: Date
  metadata?: Record<string, any>
}

export interface TrackingResponse {
  success: boolean
  dealId?: string
  attribution?: DealAttribution
  invoice?: {
    invoiceId: string
    amount: number
    dueDate: string
  }
  error?: string
}

export class DealTracker {
  private apiKey: string
  private billingCalculator: RevenueCalculator

  constructor(apiKey: string) {
    this.apiKey = apiKey
    this.billingCalculator = new RevenueCalculator({
      model: 'success_fee',
      successFeeBps: 33,
      paymentTerms: 'net30',
    })
  }

  /**
   * Track a closed deal
   * Automatically calculates Wells fee and triggers invoicing
   */
  async trackDealClosed(event: DealClosedEvent): Promise<TrackingResponse> {
    try {
      console.log('[Deal Tracker] Deal closed:', {
        customer: event.customer,
        revenue: event.revenue,
        source: event.source,
      })

      // Calculate Wells fee (33bps)
      const wellsFee = this.billingCalculator.calculateSuccessFee(event.revenue)

      // Generate deal ID
      const dealId = `DEAL-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

      // Create attribution record
      const attribution: DealAttribution = {
        dealId,
        revenue: event.revenue,
        customer: event.customer,
        wellsFee,
        source: event.source,
        campaign: event.campaign,
        prospectId: event.prospectId,
        outreachMessageId: event.outreachMessageId,
        closedAt: new Date(),
        metadata: event.metadata,
      }

      console.log('[Deal Tracker] Attribution created:', {
        dealId,
        wellsFee: `$${wellsFee.toLocaleString()}`,
        source: event.source,
      })

      // Store attribution in database
      // In production: await db.dealAttributions.create(attribution)

      // Trigger auto-invoicing
      const invoice = await this.triggerAutoInvoicing(attribution)

      return {
        success: true,
        dealId,
        attribution,
        invoice,
      }
    } catch (error: any) {
      console.error('[Deal Tracker] Error:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Trigger automatic invoicing for closed deal
   */
  private async triggerAutoInvoicing(attribution: DealAttribution): Promise<{
    invoiceId: string
    amount: number
    dueDate: string
  }> {
    // Generate invoice ID
    const invoiceId = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    // Calculate due date (net 30)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    console.log('[Deal Tracker] Auto-invoice triggered:', {
      invoiceId,
      amount: attribution.wellsFee,
      dueDate: dueDate.toISOString(),
    })

    // In production:
    // 1. Create invoice in database
    // 2. Create Stripe invoice
    // 3. Send notification
    // await fetch('/api/billing/auto-invoice', { ... })

    return {
      invoiceId,
      amount: attribution.wellsFee,
      dueDate: dueDate.toISOString(),
    }
  }

  /**
   * Get attribution for a deal
   */
  async getAttribution(dealId: string): Promise<DealAttribution | null> {
    try {
      // In production: await db.dealAttributions.findOne({ dealId })
      console.log('[Deal Tracker] Getting attribution for:', dealId)
      return null
    } catch (error: any) {
      console.error('[Deal Tracker] Error getting attribution:', error)
      return null
    }
  }

  /**
   * Get all attributions for a customer
   */
  async getCustomerAttributions(customer: string): Promise<DealAttribution[]> {
    try {
      // In production: await db.dealAttributions.find({ customer })
      console.log('[Deal Tracker] Getting attributions for customer:', customer)
      return []
    } catch (error: any) {
      console.error('[Deal Tracker] Error getting customer attributions:', error)
      return []
    }
  }

  /**
   * Get attribution analytics
   */
  async getAttributionAnalytics(): Promise<{
    totalRevenue: number
    totalFees: number
    dealCount: number
    bySource: Record<string, { deals: number; revenue: number; fees: number }>
    byCampaign: Record<string, { deals: number; revenue: number; fees: number }>
  }> {
    try {
      // In production: Query database for aggregated analytics
      console.log('[Deal Tracker] Getting attribution analytics')

      return {
        totalRevenue: 0,
        totalFees: 0,
        dealCount: 0,
        bySource: {},
        byCampaign: {},
      }
    } catch (error: any) {
      console.error('[Deal Tracker] Error getting analytics:', error)
      throw error
    }
  }

  /**
   * Calculate ROI for customer
   */
  calculateCustomerROI(params: {
    revenueGenerated: number
    traditionalSalesCost: number
  }): {
    revenueGenerated: number
    wellsFee: number
    traditionalCost: number
    savings: number
    savingsPercentage: number
  } {
    const wellsFee = this.billingCalculator.calculateSuccessFee(params.revenueGenerated)
    const savings = params.traditionalSalesCost - wellsFee
    const savingsPercentage = (savings / params.traditionalSalesCost) * 100

    return {
      revenueGenerated: params.revenueGenerated,
      wellsFee,
      traditionalCost: params.traditionalSalesCost,
      savings,
      savingsPercentage,
    }
  }
}

/**
 * Example usage:
 *
 * const tracker = new DealTracker(apiKey)
 *
 * // Track a closed deal
 * await tracker.trackDealClosed({
 *   revenue: 500000,
 *   customer: 'Acme Corp',
 *   dealName: 'Enterprise Plan',
 *   source: 'wells_linkedin_outreach',
 *   campaign: 'Q4_Enterprise',
 *   prospectId: 'PROSPECT-123',
 * })
 *
 * // Result:
 * // - Calculates Wells fee: $500K × 0.0033 = $1,650
 * // - Creates attribution record
 * // - Generates invoice
 * // - Sends to Stripe
 * // - Notifies admin
 */
