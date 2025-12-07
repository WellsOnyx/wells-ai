// @ts-nocheck
/**
 * INVOICE FINANCING REQUEST API
 *
 * Allows suppliers to request early payment on invoices.
 * POST /api/financing/request
 */

import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { invoice_id, supplier_id } = body

    if (!invoice_id) {
      return NextResponse.json(
        { error: 'invoice_id is required' },
        { status: 400 }
      )
    }

    // Call the database function to request financing
    const result = await sql`
      SELECT * FROM request_invoice_financing(${invoice_id}::UUID)
    `

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'No result from financing request' },
        { status: 500 }
      )
    }

    const financing = result.rows[0]

    if (!financing.success) {
      return NextResponse.json(
        {
          success: false,
          error: financing.message
        },
        { status: 400 }
      )
    }

    // Return success with financing details
    return NextResponse.json({
      success: true,
      invoice_id,
      financing: {
        advance_amount: parseFloat(financing.advance_amount),
        reserve_amount: parseFloat(financing.reserve_amount),
        discount_amount: parseFloat(financing.discount_amount),
        message: financing.message
      },
      next_steps: [
        'Financing approved - awaiting funding',
        'Funds will be transferred within 24 hours',
        'You will receive GRAIN rewards upon funding'
      ]
    })
  } catch (error) {
    console.error('Financing request error:', error)
    return NextResponse.json(
      { error: 'Failed to process financing request', details: error.message },
      { status: 500 }
    )
  }
}

// GET: Check financing eligibility for an invoice
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const invoice_id = searchParams.get('invoice_id')
    const supplier_id = searchParams.get('supplier_id')

    if (invoice_id) {
      // Get specific invoice details
      const result = await sql`
        SELECT
          fi.*,
          sn.company_name as supplier_name,
          ec.company_name as buyer_name,
          fps.advance_rate_pct,
          fps.discount_rate_pct,
          fps.reserve_rate_pct,
          fps.advance_available,
          (fi.due_date - CURRENT_DATE) as days_until_due
        FROM financeable_invoices fi
        JOIN supplier_network sn ON fi.supplier_id = sn.id
        JOIN erp_customers ec ON fi.buyer_id = ec.id
        LEFT JOIN financing_programs_supplier fps ON fi.supplier_id = fps.supplier_id
        WHERE fi.id = ${invoice_id}::UUID
      `

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
      }

      const invoice = result.rows[0]

      // Calculate potential financing amounts
      const invoiceAmount = parseFloat(invoice.invoice_amount)
      const advanceRate = parseFloat(invoice.advance_rate_pct || 95) / 100
      const discountRate = parseFloat(invoice.discount_rate_pct || 2) / 100
      const reserveRate = parseFloat(invoice.reserve_rate_pct || 5) / 100

      return NextResponse.json({
        invoice: {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          invoice_amount: invoiceAmount,
          due_date: invoice.due_date,
          days_until_due: invoice.days_until_due,
          financing_status: invoice.financing_status,
          supplier_name: invoice.supplier_name,
          buyer_name: invoice.buyer_name
        },
        eligibility: {
          is_eligible: invoice.financing_status === 'eligible',
          reason: invoice.financing_status === 'eligible'
            ? 'Invoice qualifies for financing'
            : `Invoice status: ${invoice.financing_status}`,
          available_limit: parseFloat(invoice.advance_available || 0)
        },
        potential_financing: invoice.financing_status === 'eligible' ? {
          advance_amount: invoiceAmount * advanceRate,
          discount_fee: invoiceAmount * discountRate,
          reserve_held: invoiceAmount * reserveRate,
          you_receive: invoiceAmount * (1 - discountRate - reserveRate),
          effective_rate: `${(discountRate * 100).toFixed(2)}%`,
          grain_reward: Math.floor(invoiceAmount / 1000)
        } : null
      })
    }

    // List all eligible invoices for a supplier
    if (supplier_id) {
      const result = await sql`
        SELECT
          fi.id,
          fi.invoice_number,
          fi.invoice_amount,
          fi.due_date,
          fi.financing_status,
          ec.company_name as buyer_name,
          (fi.due_date - CURRENT_DATE) as days_until_due
        FROM financeable_invoices fi
        JOIN erp_customers ec ON fi.buyer_id = ec.id
        WHERE fi.supplier_id = ${supplier_id}::UUID
        AND fi.financing_status IN ('eligible', 'requested', 'approved')
        ORDER BY fi.due_date ASC
      `

      return NextResponse.json({
        supplier_id,
        eligible_invoices: result.rows.map(row => ({
          ...row,
          invoice_amount: parseFloat(row.invoice_amount)
        })),
        total_available: result.rows
          .filter(r => r.financing_status === 'eligible')
          .reduce((sum, r) => sum + parseFloat(r.invoice_amount), 0)
      })
    }

    return NextResponse.json(
      { error: 'invoice_id or supplier_id required' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Financing eligibility check error:', error)
    return NextResponse.json(
      { error: 'Failed to check eligibility', details: error.message },
      { status: 500 }
    )
  }
}
