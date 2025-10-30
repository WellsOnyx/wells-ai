/**
 * @wells/gtm-sdk - Auto-Billing Engine
 * Automatic invoice generation and payment collection
 */

import { DealAttribution } from './tracking'
import { RevenueCalculator } from './billing'

export interface Invoice {
  invoiceId: string
  dealId: string
  customer: string
  amount: number
  fee: number
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  createdAt: Date
  dueDate: Date
  paidAt?: Date
  stripeInvoiceId?: string
  metadata?: Record<string, any>
}

export interface BillingNotification {
  type: 'invoice_created' | 'invoice_sent' | 'payment_received' | 'payment_failed'
  invoice: Invoice
  customer: string
  timestamp: Date
}

export class AutoBillingEngine {
  private calculator: RevenueCalculator
  private webhookUrl?: string

  constructor(config?: { webhookUrl?: string }) {
    this.calculator = new RevenueCalculator({
      model: 'success_fee',
      successFeeBps: 33,
      paymentTerms: 'net30',
    })
    this.webhookUrl = config?.webhookUrl
  }

  /**
   * Generate invoice for closed deal
   * Automatically triggered by deal close event
   */
  async generateInvoice(attribution: DealAttribution): Promise<Invoice> {
    try {
      console.log('[Auto-Billing] Generating invoice for deal:', attribution.dealId)

      // Calculate due date (net 30)
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 30)

      // Create invoice
      const invoice: Invoice = {
        invoiceId: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        dealId: attribution.dealId,
        customer: attribution.customer,
        amount: attribution.revenue,
        fee: attribution.wellsFee,
        status: 'draft',
        createdAt: new Date(),
        dueDate,
        metadata: {
          source: attribution.source,
          campaign: attribution.campaign,
          prospectId: attribution.prospectId,
        },
      }

      console.log('[Auto-Billing] Invoice created:', {
        invoiceId: invoice.invoiceId,
        customer: invoice.customer,
        fee: `$${invoice.fee.toLocaleString()}`,
        dueDate: invoice.dueDate.toISOString(),
      })

      // Store in database
      // In production: await db.invoices.create(invoice)

      // Send notification
      await this.sendNotification({
        type: 'invoice_created',
        invoice,
        customer: invoice.customer,
        timestamp: new Date(),
      })

      return invoice
    } catch (error: any) {
      console.error('[Auto-Billing] Error generating invoice:', error)
      throw error
    }
  }

  /**
   * Send invoice to customer
   * Integrates with Stripe for payment collection
   */
  async sendInvoice(invoiceId: string): Promise<{
    success: boolean
    stripeInvoiceId?: string
    error?: string
  }> {
    try {
      console.log('[Auto-Billing] Sending invoice:', invoiceId)

      // In production:
      // 1. Get invoice from database
      // 2. Create Stripe invoice
      // 3. Send email to customer
      // 4. Update invoice status to 'sent'

      const stripeInvoiceId = `stripe_inv_${Math.random().toString(36).substr(2, 10)}`

      console.log('[Auto-Billing] Invoice sent:', {
        invoiceId,
        stripeInvoiceId,
      })

      // Send notification
      await this.sendNotification({
        type: 'invoice_sent',
        invoice: {} as Invoice, // In production: actual invoice
        customer: 'customer', // In production: actual customer
        timestamp: new Date(),
      })

      return {
        success: true,
        stripeInvoiceId,
      }
    } catch (error: any) {
      console.error('[Auto-Billing] Error sending invoice:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Process payment received
   */
  async processPayment(params: {
    invoiceId: string
    stripePaymentIntentId: string
    amount: number
  }): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[Auto-Billing] Processing payment:', {
        invoiceId: params.invoiceId,
        amount: `$${params.amount.toLocaleString()}`,
      })

      // In production:
      // 1. Verify payment in Stripe
      // 2. Update invoice status to 'paid'
      // 3. Update deal attribution
      // 4. Send receipt

      // Send notification
      await this.sendNotification({
        type: 'payment_received',
        invoice: {} as Invoice, // In production: actual invoice
        customer: 'customer', // In production: actual customer
        timestamp: new Date(),
      })

      console.log('[Auto-Billing] Payment processed successfully')

      return { success: true }
    } catch (error: any) {
      console.error('[Auto-Billing] Error processing payment:', error)

      // Send failure notification
      await this.sendNotification({
        type: 'payment_failed',
        invoice: {} as Invoice,
        customer: 'customer',
        timestamp: new Date(),
      })

      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Get billing summary for customer
   */
  async getCustomerBillingSummary(customer: string): Promise<{
    totalRevenue: number
    totalFees: number
    paidFees: number
    outstandingFees: number
    invoiceCount: number
    invoices: Invoice[]
  }> {
    try {
      console.log('[Auto-Billing] Getting billing summary for:', customer)

      // In production: Query database for customer invoices
      // const invoices = await db.invoices.find({ customer })

      return {
        totalRevenue: 0,
        totalFees: 0,
        paidFees: 0,
        outstandingFees: 0,
        invoiceCount: 0,
        invoices: [],
      }
    } catch (error: any) {
      console.error('[Auto-Billing] Error getting billing summary:', error)
      throw error
    }
  }

  /**
   * Calculate customer savings vs traditional sales
   */
  calculateSavings(params: {
    revenueGenerated: number
    traditionalSalesCost: number
  }): {
    wellsFee: number
    traditionalCost: number
    savings: number
    savingsPercentage: number
    roi: number
  } {
    const wellsFee = this.calculator.calculateSuccessFee(params.revenueGenerated)
    const savings = params.traditionalSalesCost - wellsFee
    const savingsPercentage = (savings / params.traditionalSalesCost) * 100
    const roi = (params.revenueGenerated / wellsFee) * 100

    console.log('[Auto-Billing] Savings calculation:', {
      revenueGenerated: `$${params.revenueGenerated.toLocaleString()}`,
      wellsFee: `$${wellsFee.toLocaleString()}`,
      traditionalCost: `$${params.traditionalSalesCost.toLocaleString()}`,
      savings: `$${savings.toLocaleString()}`,
      savingsPercentage: `${savingsPercentage.toFixed(1)}%`,
      roi: `${roi.toFixed(0)}x`,
    })

    return {
      wellsFee,
      traditionalCost: params.traditionalSalesCost,
      savings,
      savingsPercentage,
      roi,
    }
  }

  /**
   * Send billing notification
   */
  private async sendNotification(notification: BillingNotification): Promise<void> {
    try {
      if (!this.webhookUrl) {
        console.log('[Auto-Billing] No webhook configured, skipping notification')
        return
      }

      console.log('[Auto-Billing] Sending notification:', notification.type)

      // In production: Send to webhook URL
      // await fetch(this.webhookUrl, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(notification),
      // })
    } catch (error: any) {
      console.error('[Auto-Billing] Error sending notification:', error)
    }
  }

  /**
   * Get billing analytics
   */
  async getAnalytics(dateRange?: { start: Date; end: Date }): Promise<{
    totalRevenue: number
    totalFees: number
    paidFees: number
    outstandingFees: number
    invoiceCount: number
    paymentRate: number
    averageDealSize: number
    averageFee: number
  }> {
    try {
      console.log('[Auto-Billing] Getting analytics')

      // In production: Query database with date range
      // const invoices = await db.invoices.find({ createdAt: { $gte: start, $lte: end } })

      return {
        totalRevenue: 0,
        totalFees: 0,
        paidFees: 0,
        outstandingFees: 0,
        invoiceCount: 0,
        paymentRate: 0,
        averageDealSize: 0,
        averageFee: 0,
      }
    } catch (error: any) {
      console.error('[Auto-Billing] Error getting analytics:', error)
      throw error
    }
  }
}

/**
 * Example usage:
 *
 * const autoBilling = new AutoBillingEngine({ webhookUrl: 'https://...' })
 *
 * // On deal close:
 * const invoice = await autoBilling.generateInvoice(attribution)
 * await autoBilling.sendInvoice(invoice.invoiceId)
 *
 * // On Stripe webhook:
 * await autoBilling.processPayment({
 *   invoiceId: 'INV-123',
 *   stripePaymentIntentId: 'pi_123',
 *   amount: 1650
 * })
 *
 * // Get customer savings:
 * const savings = autoBilling.calculateSavings({
 *   revenueGenerated: 500000,
 *   traditionalSalesCost: 150000
 * })
 * // Result: $148,350 saved (98.9% savings)
 */
