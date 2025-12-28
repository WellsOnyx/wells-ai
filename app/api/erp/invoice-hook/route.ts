/**
 * ERP Invoice Hook API
 *
 * Webhook endpoint that ERPs call when creating invoices for Wells-sourced deals.
 * Automatically injects the 1% Wells fee as a locked line item.
 *
 * POST /api/erp/invoice-hook
 *
 * Supports: SAP, NetSuite, Oracle, Dynamics, QuickBooks, Xero
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import {
  calculateWellsFee,
  generateErpLineItem,
  generatePaymentInstructions,
  WELLS_FEE_CONFIG,
  type WellsSourcedTransaction,
} from '@/lib/fees/wells-fee-service'

interface InvoiceHookPayload {
  // Required
  erpSystem: WellsSourcedTransaction['erpSystem']
  invoiceId: string
  invoiceNumber: string
  grossAmount: number
  currency: string
  wellsDealId: string

  // Optional
  vendorId?: string
  vendorName?: string
  wellsRfqId?: string
  lineItems?: unknown[]
  metadata?: Record<string, unknown>

  // Webhook auth
  apiKey?: string
  signature?: string
}

// Verify webhook is from authorized source
function verifyWebhook(req: NextRequest, payload: InvoiceHookPayload): boolean {
  const apiKey = req.headers.get('x-wells-api-key') || payload.apiKey
  const expectedKey = process.env.WELLS_ERP_WEBHOOK_KEY

  if (!expectedKey) {
    console.warn('WELLS_ERP_WEBHOOK_KEY not configured - allowing all requests in dev')
    return process.env.NODE_ENV !== 'production'
  }

  return apiKey === expectedKey
}

export async function POST(req: NextRequest) {
  try {
    const payload: InvoiceHookPayload = await req.json()

    // Verify webhook authenticity
    if (!verifyWebhook(req, payload)) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'INVALID_API_KEY' },
        { status: 401 }
      )
    }

    // Validate required fields
    if (!payload.erpSystem || !payload.invoiceId || !payload.grossAmount || !payload.wellsDealId) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['erpSystem', 'invoiceId', 'grossAmount', 'wellsDealId'],
        },
        { status: 400 }
      )
    }

    // Validate gross amount
    if (payload.grossAmount <= 0) {
      return NextResponse.json(
        { error: 'grossAmount must be positive' },
        { status: 400 }
      )
    }

    // Check if fee already applied for this invoice
    try {
      const existingFee = await sql`
        SELECT id FROM wells_fees
        WHERE invoice_id = ${payload.invoiceId}
        AND erp_system = ${payload.erpSystem}
        LIMIT 1
      `

      if (existingFee.rows.length > 0) {
        return NextResponse.json(
          {
            error: 'Fee already applied',
            code: 'DUPLICATE_FEE',
            existingFeeId: existingFee.rows[0].id,
          },
          { status: 409 }
        )
      }
    } catch {
      // Table might not exist yet - continue
    }

    // Calculate the fee
    const feeResult = calculateWellsFee(
      payload.grossAmount,
      payload.currency || 'USD',
      payload.wellsDealId
    )

    // Generate ERP-specific line item
    const erpLineItem = generateErpLineItem(payload.erpSystem, feeResult)

    // Generate payment instructions
    const isInternational = payload.currency !== 'USD'
    const paymentInstructions = generatePaymentInstructions(payload.currency, isInternational)

    // Record the fee in our database
    const feeId = feeResult.lineItem.wellsTransactionId
    try {
      await sql`
        INSERT INTO wells_fees (
          id,
          erp_system,
          invoice_id,
          invoice_number,
          vendor_id,
          vendor_name,
          gross_amount,
          fee_amount,
          fee_percent,
          currency,
          wells_deal_id,
          wells_rfq_id,
          line_item_data,
          payment_status,
          created_at
        ) VALUES (
          ${feeId},
          ${payload.erpSystem},
          ${payload.invoiceId},
          ${payload.invoiceNumber || ''},
          ${payload.vendorId || ''},
          ${payload.vendorName || ''},
          ${payload.grossAmount},
          ${feeResult.feeAmount},
          ${feeResult.feePercent},
          ${feeResult.currency},
          ${payload.wellsDealId},
          ${payload.wellsRfqId || null},
          ${JSON.stringify(erpLineItem)},
          'pending',
          NOW()
        )
      `
    } catch (dbError) {
      console.error('Failed to record fee in database:', dbError)
      // Continue anyway - fee calculation is still valid
    }

    // Return the line item to be injected into the invoice
    return NextResponse.json({
      success: true,
      feeId,
      fee: {
        amount: feeResult.feeAmount,
        percent: feeResult.feePercent,
        currency: feeResult.currency,
        description: WELLS_FEE_CONFIG.description,
      },
      lineItem: erpLineItem,
      paymentInstructions,
      paymentDetails: {
        domestic: feeResult.paymentDetails.domestic,
        international: feeResult.paymentDetails.international,
      },
      message: `Wells AI fee of ${feeResult.feeAmount} ${feeResult.currency} (${feeResult.feePercent}%) applied to invoice ${payload.invoiceNumber || payload.invoiceId}`,
    })
  } catch (error) {
    console.error('Invoice hook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - Documentation and health check
export async function GET() {
  return NextResponse.json({
    service: 'Wells AI ERP Invoice Hook',
    version: '1.0.0',
    status: 'operational',
    feeConfig: {
      ratePercent: WELLS_FEE_CONFIG.ratePercent,
      minFeeUsd: WELLS_FEE_CONFIG.minFeeUsd,
      description: WELLS_FEE_CONFIG.description,
    },
    supportedErpSystems: [
      'sap',
      'netsuite',
      'oracle',
      'dynamics',
      'quickbooks',
      'xero',
      'other',
    ],
    usage: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wells-api-key': 'YOUR_API_KEY',
      },
      body: {
        erpSystem: 'netsuite',
        invoiceId: 'INV-12345',
        invoiceNumber: 'INV-2024-001',
        grossAmount: 10000.0,
        currency: 'USD',
        wellsDealId: 'deal_abc123',
        vendorId: 'VENDOR-001',
        vendorName: 'Acme Corp',
      },
    },
  })
}
