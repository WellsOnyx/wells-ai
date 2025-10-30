/**
 * Auto-Invoice API Endpoint
 * Manually trigger invoice generation for a closed deal
 */

import { NextResponse } from 'next/server'
import { AutoBillingEngine } from '@/lib/gtm-sdk/auto-billing'
import { StripeBillingService } from '@/lib/payments/stripe-billing'
import { DealAttribution } from '@/lib/gtm-sdk/tracking'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    console.log('[Auto-Invoice API] Generating invoice:', {
      dealId: body.dealId,
      customer: body.customer,
      revenue: body.revenue,
    })

    // Validate required fields
    if (!body.dealId || !body.customer || !body.revenue) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: dealId, customer, revenue',
        },
        { status: 400 }
      )
    }

    // Verify API key
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')

    if (!apiKey || apiKey !== process.env.WELLS_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid API key',
        },
        { status: 401 }
      )
    }

    // Calculate Wells fee (33 basis points)
    const wellsFee = body.revenue * 0.0033

    // Create attribution record
    const attribution: DealAttribution = {
      dealId: body.dealId,
      revenue: body.revenue,
      customer: body.customer,
      wellsFee,
      source: body.source || 'manual',
      campaign: body.campaign || 'manual',
      prospectId: body.prospectId || 'N/A',
      closedAt: new Date(),
    }

    // Generate invoice
    const autoBilling = new AutoBillingEngine()
    const invoice = await autoBilling.generateInvoice(attribution)

    console.log('[Auto-Invoice API] Invoice generated:', {
      invoiceId: invoice.invoiceId,
      fee: `$${invoice.fee.toLocaleString()}`,
      dueDate: invoice.dueDate.toISOString(),
    })

    // Send via Stripe if customer email provided
    if (body.customerEmail) {
      try {
        const stripeBilling = new StripeBillingService()

        const stripeResult = await stripeBilling.createInvoice({
          customer: body.customer,
          customerEmail: body.customerEmail,
          amount: wellsFee,
          dealId: body.dealId,
          dealRevenue: body.revenue,
          description: `Wells GTM Success Fee - ${body.dealName || body.dealId}`,
          metadata: {
            source: attribution.source,
            campaign: attribution.campaign,
            prospectId: attribution.prospectId,
          },
        })

        if (stripeResult.success) {
          console.log('[Auto-Invoice API] Stripe invoice sent:', {
            stripeInvoiceId: stripeResult.invoiceId,
            hostedUrl: stripeResult.hostedInvoiceUrl,
          })

          return NextResponse.json({
            success: true,
            message: 'Invoice generated and sent via Stripe',
            data: {
              invoice: {
                id: invoice.invoiceId,
                stripeInvoiceId: stripeResult.invoiceId,
                hostedUrl: stripeResult.hostedInvoiceUrl,
                amount: wellsFee,
                dueDate: invoice.dueDate,
                status: 'sent',
              },
              attribution,
            },
          })
        } else {
          // Stripe failed, return local invoice
          return NextResponse.json({
            success: true,
            warning: 'Invoice generated but Stripe sending failed',
            data: {
              invoice: {
                id: invoice.invoiceId,
                amount: wellsFee,
                dueDate: invoice.dueDate,
                status: 'draft',
              },
              attribution,
              stripeError: stripeResult.error,
            },
          })
        }
      } catch (stripeError: any) {
        console.error('[Auto-Invoice API] Stripe error:', stripeError)
        return NextResponse.json({
          success: true,
          warning: 'Invoice generated but Stripe integration failed',
          data: {
            invoice: {
              id: invoice.invoiceId,
              amount: wellsFee,
              dueDate: invoice.dueDate,
              status: 'draft',
            },
            attribution,
            stripeError: stripeError.message,
          },
        })
      }
    } else {
      // No email, return local invoice only
      return NextResponse.json({
        success: true,
        message: 'Invoice generated (email required to send via Stripe)',
        data: {
          invoice: {
            id: invoice.invoiceId,
            amount: wellsFee,
            dueDate: invoice.dueDate,
            status: 'draft',
          },
          attribution,
        },
      })
    }
  } catch (error: any) {
    console.error('[Auto-Invoice API] Error:', error)
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
 * GET endpoint to retrieve invoice status
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get('invoiceId')
    const stripeInvoiceId = searchParams.get('stripeInvoiceId')

    if (!invoiceId && !stripeInvoiceId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing invoiceId or stripeInvoiceId parameter',
        },
        { status: 400 }
      )
    }

    // Verify API key
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')

    if (!apiKey || apiKey !== process.env.WELLS_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid API key',
        },
        { status: 401 }
      )
    }

    // Get invoice status from Stripe
    if (stripeInvoiceId) {
      const stripeBilling = new StripeBillingService()
      const status = await stripeBilling.getInvoiceStatus(stripeInvoiceId)

      if (status) {
        return NextResponse.json({
          success: true,
          data: {
            stripeInvoiceId,
            status: status.status,
            paid: status.paid,
            amount: status.amount,
            paidAt: status.paidAt,
          },
        })
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'Invoice not found in Stripe',
          },
          { status: 404 }
        )
      }
    }

    // In production: Query local database for invoice
    // const invoice = await db.invoices.findOne({ invoiceId })

    return NextResponse.json({
      success: true,
      message: 'Local invoice lookup not yet implemented',
      data: {
        invoiceId,
        note: 'Use stripeInvoiceId parameter for Stripe invoice status',
      },
    })
  } catch (error: any) {
    console.error('[Auto-Invoice API] GET error:', error)
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
 * Example usage:
 *
 * POST /api/billing/invoice
 * Headers:
 *   Authorization: Bearer <WELLS_API_KEY>
 *   Content-Type: application/json
 *
 * Body:
 * {
 *   "dealId": "DEAL-123",
 *   "customer": "Acme Corp",
 *   "customerEmail": "finance@acme.com",
 *   "revenue": 500000,
 *   "dealName": "Acme Enterprise Agreement",
 *   "source": "wells_linkedin_outreach",
 *   "campaign": "Q4_Enterprise",
 *   "prospectId": "PROSPECT-123"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Invoice generated and sent via Stripe",
 *   "data": {
 *     "invoice": {
 *       "id": "INV-1730287654321-ABC123",
 *       "stripeInvoiceId": "in_1234567890",
 *       "hostedUrl": "https://invoice.stripe.com/i/...",
 *       "amount": 1650,
 *       "dueDate": "2025-11-29T...",
 *       "status": "sent"
 *     },
 *     "attribution": {
 *       "dealId": "DEAL-123",
 *       "revenue": 500000,
 *       "customer": "Acme Corp",
 *       "wellsFee": 1650,
 *       "source": "wells_linkedin_outreach",
 *       "campaign": "Q4_Enterprise",
 *       "prospectId": "PROSPECT-123",
 *       "closedAt": "2025-10-30T..."
 *     }
 *   }
 * }
 *
 * ---
 *
 * GET /api/billing/invoice?stripeInvoiceId=in_1234567890
 * Headers:
 *   Authorization: Bearer <WELLS_API_KEY>
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "stripeInvoiceId": "in_1234567890",
 *     "status": "paid",
 *     "paid": true,
 *     "amount": 1650,
 *     "paidAt": "2025-11-15T..."
 *   }
 * }
 */
