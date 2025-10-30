/**
 * Stripe Billing Integration
 * Automatic payment collection for Wells GTM fees
 */

import Stripe from 'stripe'
import { Invoice } from '../gtm-sdk/auto-billing'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-10-29.clover',
    })
  : null

export interface StripeInvoiceParams {
  customer: string
  customerEmail: string
  amount: number
  dealId: string
  dealRevenue: number
  description: string
  metadata?: Record<string, any>
}

export interface StripePaymentResult {
  success: boolean
  invoiceId?: string
  hostedInvoiceUrl?: string
  paymentIntentId?: string
  error?: string
}

export class StripeBillingService {
  /**
   * Create a Stripe customer (if doesn't exist)
   */
  async createOrGetCustomer(params: {
    email: string
    name: string
    metadata?: Record<string, any>
  }): Promise<string> {
    if (!stripe) {
      throw new Error('Stripe not configured')
    }

    try {
      console.log('[Stripe] Creating/getting customer:', params.email)

      // Check if customer exists
      const existingCustomers = await stripe.customers.list({
        email: params.email,
        limit: 1,
      })

      if (existingCustomers.data.length > 0) {
        console.log('[Stripe] Customer exists:', existingCustomers.data[0].id)
        return existingCustomers.data[0].id
      }

      // Create new customer
      const customer = await stripe.customers.create({
        email: params.email,
        name: params.name,
        metadata: params.metadata,
      })

      console.log('[Stripe] Customer created:', customer.id)
      return customer.id
    } catch (error: any) {
      console.error('[Stripe] Error creating customer:', error)
      throw error
    }
  }

  /**
   * Create Stripe invoice for Wells GTM fee
   */
  async createInvoice(params: StripeInvoiceParams): Promise<StripePaymentResult> {
    if (!stripe) {
      return {
        success: false,
        error: 'Stripe not configured',
      }
    }

    try {
      console.log('[Stripe] Creating invoice:', {
        customer: params.customer,
        amount: `$${params.amount.toLocaleString()}`,
        dealId: params.dealId,
      })

      // Get or create customer
      const customerId = await this.createOrGetCustomer({
        email: params.customerEmail,
        name: params.customer,
        metadata: {
          wellsCustomer: 'true',
          dealId: params.dealId,
        },
      })

      // Create invoice item
      await stripe.invoiceItems.create({
        customer: customerId,
        amount: Math.round(params.amount * 100), // Convert to cents
        currency: 'usd',
        description: params.description,
        metadata: {
          dealId: params.dealId,
          dealRevenue: params.dealRevenue.toString(),
          feePercentage: '0.33',
          ...params.metadata,
        },
      })

      // Create invoice
      const invoice = await stripe.invoices.create({
        customer: customerId,
        auto_advance: true, // Auto-finalize
        collection_method: 'send_invoice', // Email to customer
        days_until_due: 30, // Net 30 terms
        metadata: {
          dealId: params.dealId,
          dealRevenue: params.dealRevenue.toString(),
          wellsFee: params.amount.toString(),
        },
      })

      // Finalize invoice (makes it ready to send)
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id)

      // Send invoice via email
      const sentInvoice = await stripe.invoices.sendInvoice(finalizedInvoice.id)

      console.log('[Stripe] Invoice created and sent:', {
        invoiceId: sentInvoice.id,
        hostedUrl: sentInvoice.hosted_invoice_url,
        status: sentInvoice.status,
      })

      return {
        success: true,
        invoiceId: sentInvoice.id,
        hostedInvoiceUrl: sentInvoice.hosted_invoice_url || undefined,
        paymentIntentId: (sentInvoice as any).payment_intent as string | undefined,
      }
    } catch (error: any) {
      console.error('[Stripe] Error creating invoice:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Get invoice status
   */
  async getInvoiceStatus(stripeInvoiceId: string): Promise<{
    status: string
    paid: boolean
    amount: number
    paidAt?: Date
  } | null> {
    if (!stripe) return null

    try {
      const invoice = await stripe.invoices.retrieve(stripeInvoiceId) as any

      return {
        status: invoice.status || 'unknown',
        paid: invoice.paid,
        amount: invoice.amount_paid / 100, // Convert from cents
        paidAt: invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : undefined,
      }
    } catch (error: any) {
      console.error('[Stripe] Error getting invoice status:', error)
      return null
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event: Stripe.Event): Promise<{
    success: boolean
    action?: string
    error?: string
  }> {
    try {
      console.log('[Stripe Webhook] Received event:', event.type)

      switch (event.type) {
        case 'invoice.paid': {
          const invoice = event.data.object as Stripe.Invoice
          console.log('[Stripe Webhook] Invoice paid:', invoice.id)

          // Update internal invoice status to 'paid'
          // In production: await db.invoices.update({ stripeInvoiceId: invoice.id }, { status: 'paid', paidAt: new Date() })

          return {
            success: true,
            action: 'invoice_marked_paid',
          }
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice
          console.log('[Stripe Webhook] Payment failed:', invoice.id)

          // Update internal invoice status
          // In production: await db.invoices.update({ stripeInvoiceId: invoice.id }, { status: 'failed' })

          // Send notification to admin
          // await sendNotification({ type: 'payment_failed', invoiceId: invoice.id })

          return {
            success: true,
            action: 'invoice_marked_failed',
          }
        }

        case 'customer.created': {
          const customer = event.data.object as Stripe.Customer
          console.log('[Stripe Webhook] Customer created:', customer.id)

          return {
            success: true,
            action: 'customer_created',
          }
        }

        default:
          console.log('[Stripe Webhook] Unhandled event type:', event.type)
          return {
            success: true,
            action: 'ignored',
          }
      }
    } catch (error: any) {
      console.error('[Stripe Webhook] Error handling webhook:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Get billing portal URL for customer
   */
  async createBillingPortalSession(customerId: string, returnUrl: string): Promise<string | null> {
    if (!stripe) return null

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      })

      return session.url
    } catch (error: any) {
      console.error('[Stripe] Error creating billing portal session:', error)
      return null
    }
  }

  /**
   * Calculate Wells fee breakdown for invoice
   */
  static calculateFeeBreakdown(dealRevenue: number): {
    revenue: number
    feePercentage: number
    feeBps: number
    feeAmount: number
    customerReceives: number
  } {
    const feeBps = 33 // 0.33%
    const feeAmount = (dealRevenue * feeBps) / 10000
    const customerReceives = dealRevenue - feeAmount

    return {
      revenue: dealRevenue,
      feePercentage: 0.33,
      feeBps,
      feeAmount,
      customerReceives,
    }
  }
}

/**
 * Example usage:
 *
 * const stripeBilling = new StripeBillingService()
 *
 * // On deal close:
 * const result = await stripeBilling.createInvoice({
 *   customer: 'Acme Corp',
 *   customerEmail: 'finance@acme.com',
 *   amount: 1650, // $500K × 0.0033
 *   dealId: 'DEAL-123',
 *   dealRevenue: 500000,
 *   description: 'Wells GTM Success Fee - Acme Corp Enterprise Deal',
 * })
 *
 * // Result:
 * // - Stripe invoice created
 * // - Email sent to customer
 * // - Hosted invoice URL: https://invoice.stripe.com/i/...
 * // - Payment collected automatically
 */
