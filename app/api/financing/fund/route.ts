// @ts-nocheck
/**
 * INVOICE FUNDING API
 *
 * Execute funding - transfer money to supplier.
 * POST /api/financing/fund
 */

import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { invoice_id } = body

    if (!invoice_id) {
      return NextResponse.json(
        { error: 'invoice_id is required' },
        { status: 400 }
      )
    }

    // Call the database function to fund the invoice
    const result = await sql`
      SELECT * FROM fund_invoice(${invoice_id}::UUID)
    `

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'No result from funding operation' },
        { status: 500 }
      )
    }

    const funding = result.rows[0]

    if (!funding.success) {
      return NextResponse.json(
        {
          success: false,
          error: funding.message
        },
        { status: 400 }
      )
    }

    // Get updated invoice details
    const invoiceResult = await sql`
      SELECT
        fi.*,
        sn.company_name as supplier_name,
        sn.supplier_code
      FROM financeable_invoices fi
      JOIN supplier_network sn ON fi.supplier_id = sn.id
      WHERE fi.id = ${invoice_id}::UUID
    `

    const invoice = invoiceResult.rows[0] || {}

    // Return success with funding details
    return NextResponse.json({
      success: true,
      transaction_id: funding.transaction_id,
      invoice_id,
      funding: {
        amount_funded: parseFloat(funding.amount_funded),
        grain_earned: parseFloat(funding.grain_earned),
        message: funding.message
      },
      invoice: {
        invoice_number: invoice.invoice_number,
        supplier_name: invoice.supplier_name,
        financing_status: invoice.financing_status,
        financed_at: invoice.financed_at
      },
      payment_details: {
        method: 'ACH Transfer',
        expected_arrival: 'Same day if before 2pm ET, next business day otherwise',
        reference: funding.transaction_id
      },
      rewards: {
        grain_earned: parseFloat(funding.grain_earned),
        grain_value_usd: parseFloat(funding.grain_earned) * 1.0, // Placeholder rate
        message: `You earned ${funding.grain_earned} GRAIN! 🌾`
      }
    })
  } catch (error) {
    console.error('Invoice funding error:', error)
    return NextResponse.json(
      { error: 'Failed to fund invoice', details: error.message },
      { status: 500 }
    )
  }
}

// GET: Get funding status and transaction history
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const invoice_id = searchParams.get('invoice_id')

    if (!invoice_id) {
      return NextResponse.json(
        { error: 'invoice_id required' },
        { status: 400 }
      )
    }

    // Get invoice and all transactions
    const invoiceResult = await sql`
      SELECT
        fi.*,
        sn.company_name as supplier_name,
        ec.company_name as buyer_name
      FROM financeable_invoices fi
      JOIN supplier_network sn ON fi.supplier_id = sn.id
      JOIN erp_customers ec ON fi.buyer_id = ec.id
      WHERE fi.id = ${invoice_id}::UUID
    `

    if (invoiceResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const invoice = invoiceResult.rows[0]

    // Get all transactions for this invoice
    const txResult = await sql`
      SELECT *
      FROM financing_transactions
      WHERE invoice_id = ${invoice_id}::UUID
      ORDER BY created_at DESC
    `

    // Calculate totals
    const transactions = txResult.rows
    const totalAdvanced = transactions
      .filter(t => t.transaction_type === 'advance')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0)
    const totalFees = transactions
      .filter(t => t.transaction_type === 'discount_fee')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0)
    const grainEarned = transactions
      .filter(t => t.transaction_type === 'grain_reward')
      .reduce((sum, t) => sum + parseFloat(t.grain_amount || 0), 0)

    return NextResponse.json({
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        invoice_amount: parseFloat(invoice.invoice_amount),
        financing_status: invoice.financing_status,
        supplier_name: invoice.supplier_name,
        buyer_name: invoice.buyer_name,
        financed_at: invoice.financed_at,
        collected_at: invoice.collected_at
      },
      summary: {
        total_advanced: totalAdvanced,
        total_fees: totalFees,
        reserve_held: parseFloat(invoice.reserve_amount || 0),
        grain_earned: grainEarned
      },
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.transaction_type,
        direction: t.direction,
        amount: parseFloat(t.amount),
        grain_amount: parseFloat(t.grain_amount || 0),
        from_account: t.from_account,
        to_account: t.to_account,
        reference: t.reference,
        created_at: t.created_at
      }))
    })
  } catch (error) {
    console.error('Funding status error:', error)
    return NextResponse.json(
      { error: 'Failed to get funding status', details: error.message },
      { status: 500 }
    )
  }
}
