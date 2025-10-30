/**
 * @wells/gtm-sdk - Revenue Calculator
 * 33bps (0.33%) success fee on closed ACV
 */

import { BillingConfig, GTMResponse } from './types'

export class RevenueCalculator {
  private config: BillingConfig

  constructor(config: BillingConfig) {
    this.config = config
  }

  /**
   * Calculate success fee (33 basis points = 0.33%)
   * Example: $10M ACV → $33,000 fee
   */
  calculateSuccessFee(closedACV: number): number {
    const bps = this.config.successFeeBps
    const fee = (closedACV * bps) / 10000

    console.log(`[Billing] ACV: $${closedACV.toLocaleString()} | Fee: $${fee.toLocaleString()} (${bps}bps)`)

    return fee
  }

  /**
   * Create invoice for closed deal
   */
  async createInvoice(
    opportunityId: string,
    closedACV: number,
    fee: number
  ): Promise<GTMResponse<{ invoiceId: string; amount: number }>> {
    try {
      // In production, this would integrate with Stripe, accounting system, etc.
      const invoiceId = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

      console.log(`[Billing] Created invoice ${invoiceId} for $${fee.toLocaleString()}`)

      // Store invoice in database
      // await db.invoices.create({ ... })

      return {
        success: true,
        data: {
          invoiceId,
          amount: fee,
        },
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Calculate revenue metrics
   */
  calculateRevenue(deals: Array<{ acv: number; status: string }>): {
    totalClosedACV: number
    totalWellsFees: number
    averageDealSize: number
    estimatedAnnualRevenue: number
  } {
    const closedDeals = deals.filter(d => d.status === 'closed_won')
    const totalClosedACV = closedDeals.reduce((sum, d) => sum + d.acv, 0)
    const totalWellsFees = this.calculateSuccessFee(totalClosedACV)
    const averageDealSize = closedDeals.length > 0 ? totalClosedACV / closedDeals.length : 0

    // Estimate annual revenue based on current run rate
    const estimatedAnnualRevenue = totalWellsFees * 12

    return {
      totalClosedACV,
      totalWellsFees,
      averageDealSize,
      estimatedAnnualRevenue,
    }
  }

  /**
   * Example pricing scenarios
   */
  static getPricingExamples(): Array<{ acv: number; fee: number; description: string }> {
    const calculator = new RevenueCalculator({ model: 'success_fee', successFeeBps: 33, paymentTerms: 'net30' })

    return [
      {
        acv: 100000,
        fee: calculator.calculateSuccessFee(100000),
        description: '$100k deal → $330 Wells fee',
      },
      {
        acv: 1000000,
        fee: calculator.calculateSuccessFee(1000000),
        description: '$1M deal → $3,300 Wells fee',
      },
      {
        acv: 10000000,
        fee: calculator.calculateSuccessFee(10000000),
        description: '$10M deal → $33,000 Wells fee',
      },
      {
        acv: 100000000,
        fee: calculator.calculateSuccessFee(100000000),
        description: '$100M deal → $330,000 Wells fee',
      },
    ]
  }
}
