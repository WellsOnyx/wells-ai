/**
 * Fee Invoice API
 * POST /api/fees/invoice
 *
 * Generate an invoice for a captured fee.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'
import { generateInvoice } from '@/lib/fees/fee-service'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { feeId } = body

    if (!feeId) {
      return NextResponse.json(
        { error: 'feeId is required' },
        { status: 400 }
      )
    }

    // Verify user has access to this fee
    const feeCheck = await sql`
      SELECT f.id, d.buyer_id, d.seller_id
      FROM fees f
      INNER JOIN deals d ON f.deal_id = d.id
      WHERE f.id = ${feeId}
      LIMIT 1
    `

    if (feeCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Fee not found' }, { status: 404 })
    }

    const fee = feeCheck.rows[0]

    // Only buyer or seller can generate invoice
    if (fee.buyer_id !== userId && fee.seller_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized to generate invoice for this fee' },
        { status: 403 }
      )
    }

    // Generate invoice
    const result = await generateInvoice(feeId)

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to generate invoice',
          details: result.error,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      invoice: {
        id: result.invoiceId,
        url: result.invoiceUrl,
      },
      message: 'Invoice generated successfully',
    })
  } catch (error) {
    console.error('Error generating invoice:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate invoice',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET - Retrieve invoice by ID
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get('invoiceId')

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'invoiceId parameter is required' },
        { status: 400 }
      )
    }

    // Get invoice
    const invoiceResult = await sql`
      SELECT
        i.id,
        i.fee_id as "feeId",
        i.deal_id as "dealId",
        i.amount,
        i.tier,
        i.fee_percent as "feePercent",
        i.issued_date as "issuedDate",
        i.due_date as "dueDate",
        i.paid_date as "paidDate",
        i.status,
        i.invoice_number as "invoiceNumber",
        i.pdf_url as "pdfUrl",
        i.buyer_id as "buyerId",
        i.seller_id as "sellerId",
        i.deal_description as "dealDescription"
      FROM fee_invoices i
      WHERE i.id = ${invoiceId}
      LIMIT 1
    `

    if (invoiceResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const invoice = invoiceResult.rows[0]

    // Verify user has access
    if (invoice.buyerId !== userId && invoice.sellerId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized to view this invoice' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        feeId: invoice.feeId,
        dealId: invoice.dealId,
        amount: parseFloat(invoice.amount),
        tier: invoice.tier,
        feePercent: parseFloat(invoice.feePercent),
        issuedDate: invoice.issuedDate,
        dueDate: invoice.dueDate,
        paidDate: invoice.paidDate,
        status: invoice.status,
        invoiceNumber: invoice.invoiceNumber,
        pdfUrl: invoice.pdfUrl,
        dealDescription: invoice.dealDescription,
      },
    })
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch invoice',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
