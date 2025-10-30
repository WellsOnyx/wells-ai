/**
 * Deal Closed Webhook
 * Receives deal close events and triggers automatic billing
 */

import { NextResponse } from 'next/server'
import { DealTracker } from '@/lib/gtm-sdk/tracking'
import { StripeBillingService } from '@/lib/payments/stripe-billing'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    console.log('[Deal Closed Webhook] Received event:', {
      dealName: body.dealName,
      revenue: body.revenue,
      customer: body.customer,
    })

    // Validate required fields
    if (!body.revenue || !body.customer || !body.dealName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: revenue, customer, dealName',
        },
        { status: 400 }
      )
    }

    // Extract API key from Authorization header
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing API key in Authorization header',
        },
        { status: 401 }
      )
    }

    // Initialize deal tracker
    const tracker = new DealTracker(apiKey)

    // Track deal closed and generate attribution
    const trackingResult = await tracker.trackDealClosed({
      revenue: body.revenue,
      customer: body.customer,
      dealName: body.dealName,
      source: body.source || 'unknown',
      campaign: body.campaign || 'unknown',
      prospectId: body.prospectId,
      customerEmail: body.customerEmail,
      metadata: body.metadata,
    })

    if (!trackingResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: trackingResult.error,
        },
        { status: 500 }
      )
    }

    console.log('[Deal Closed Webhook] Deal tracked:', {
      dealId: trackingResult.dealId,
      wellsFee: `$${trackingResult.attribution?.wellsFee.toLocaleString()}`,
      invoiceId: trackingResult.invoice?.invoiceId,
    })

    // Create and send Stripe invoice
    if (body.customerEmail && trackingResult.attribution && trackingResult.dealId) {
      try {
        const stripeBilling = new StripeBillingService()

        const invoiceResult = await stripeBilling.createInvoice({
          customer: trackingResult.attribution.customer,
          customerEmail: body.customerEmail,
          amount: trackingResult.attribution.wellsFee,
          dealId: trackingResult.dealId,
          dealRevenue: trackingResult.attribution.revenue,
          description: `Wells GTM Success Fee - ${body.dealName}`,
          metadata: {
            source: trackingResult.attribution.source,
            campaign: trackingResult.attribution.campaign,
            prospectId: trackingResult.attribution.prospectId,
          },
        })

        if (invoiceResult.success) {
          console.log('[Deal Closed Webhook] Stripe invoice created:', {
            stripeInvoiceId: invoiceResult.invoiceId,
            hostedUrl: invoiceResult.hostedInvoiceUrl,
          })

          return NextResponse.json({
            success: true,
            message: 'Deal closed and invoice sent',
            data: {
              dealId: trackingResult.dealId,
              attribution: trackingResult.attribution,
              invoice: {
                id: trackingResult.invoice?.invoiceId,
                stripeInvoiceId: invoiceResult.invoiceId,
                hostedUrl: invoiceResult.hostedInvoiceUrl,
                amount: trackingResult.attribution.wellsFee,
                dueDate: trackingResult.invoice?.dueDate,
              },
            },
          })
        } else {
          console.warn('[Deal Closed Webhook] Failed to create Stripe invoice:', invoiceResult.error)
          // Still return success for deal tracking, but note invoice failure
          return NextResponse.json({
            success: true,
            warning: 'Deal tracked but invoice creation failed',
            data: {
              dealId: trackingResult.dealId,
              attribution: trackingResult.attribution,
              invoiceError: invoiceResult.error,
            },
          })
        }
      } catch (stripeError: any) {
        console.error('[Deal Closed Webhook] Stripe error:', stripeError)
        // Still return success for deal tracking
        return NextResponse.json({
          success: true,
          warning: 'Deal tracked but invoice creation failed',
          data: {
            dealId: trackingResult.dealId,
            attribution: trackingResult.attribution,
            invoiceError: stripeError.message,
          },
        })
      }
    } else {
      // No customer email provided, invoice generated but not sent via Stripe
      return NextResponse.json({
        success: true,
        message: 'Deal closed and invoice generated',
        data: {
          dealId: trackingResult.dealId,
          attribution: trackingResult.attribution,
          invoice: trackingResult.invoice,
        },
      })
    }
  } catch (error: any) {
    console.error('[Deal Closed Webhook] Error processing webhook:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * Example webhook payload:
 *
 * POST /api/webhooks/deal-closed
 * Headers:
 *   Authorization: Bearer <WELLS_API_KEY>
 *   Content-Type: application/json
 *
 * Body:
 * {
 *   "revenue": 500000,
 *   "customer": "Acme Corp",
 *   "customerEmail": "finance@acme.com",
 *   "dealName": "Acme Enterprise Agreement",
 *   "source": "wells_linkedin_outreach",
 *   "campaign": "Q4_Enterprise",
 *   "prospectId": "PROSPECT-123",
 *   "metadata": {
 *     "closeDate": "2025-10-30",
 *     "salesRep": "Jane Smith"
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Deal closed and invoice sent",
 *   "data": {
 *     "dealId": "DEAL-1730287654321-ABC123",
 *     "attribution": {
 *       "dealId": "DEAL-1730287654321-ABC123",
 *       "revenue": 500000,
 *       "customer": "Acme Corp",
 *       "wellsFee": 1650,
 *       "source": "wells_linkedin_outreach",
 *       "campaign": "Q4_Enterprise",
 *       "prospectId": "PROSPECT-123",
 *       "closedAt": "2025-10-30T..."
 *     },
 *     "invoice": {
 *       "id": "INV-1730287654321-XYZ789",
 *       "stripeInvoiceId": "in_1234567890",
 *       "hostedUrl": "https://invoice.stripe.com/i/acct_...",
 *       "amount": 1650,
 *       "dueDate": "2025-11-29T..."
 *     }
 *   }
 * }
 */
