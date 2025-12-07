// @ts-nocheck
/**
 * FINANCEABLE INVOICES API
 *
 * Create and manage invoices that can be financed.
 * POST /api/financing/invoices - Create invoice
 * GET /api/financing/invoices - List invoices
 */

import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

// POST: Create a new financeable invoice
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      order_id,
      buyer_id,
      supplier_id,
      invoice_number,
      invoice_date,
      due_date,
      invoice_amount,
      currency = 'USD',
      payment_terms
    } = body

    // Validate required fields
    if (!buyer_id || !supplier_id || !invoice_number || !invoice_date || !due_date || !invoice_amount) {
      return NextResponse.json({
        error: 'Missing required fields',
        required: ['buyer_id', 'supplier_id', 'invoice_number', 'invoice_date', 'due_date', 'invoice_amount']
      }, { status: 400 })
    }

    // Check if supplier has a financing program
    const programResult = await sql`
      SELECT * FROM financing_programs_supplier
      WHERE supplier_id = ${supplier_id}::UUID AND status = 'active'
    `

    const hasProgram = programResult.rows.length > 0
    const program = programResult.rows[0]

    // Determine eligibility
    let financing_status = 'not_eligible'
    let eligibility_reason = 'Supplier does not have an active financing program'

    if (hasProgram) {
      const available = parseFloat(program.advance_available || 0)
      if (invoice_amount <= available) {
        financing_status = 'eligible'
        eligibility_reason = 'Invoice qualifies for financing'
      } else {
        eligibility_reason = `Invoice amount ($${invoice_amount}) exceeds available limit ($${available})`
      }
    }

    // Create the invoice
    const result = await sql`
      INSERT INTO financeable_invoices (
        order_id,
        buyer_id,
        supplier_id,
        invoice_number,
        invoice_date,
        due_date,
        invoice_amount,
        currency,
        payment_terms,
        financing_status
      ) VALUES (
        ${order_id}::UUID,
        ${buyer_id}::UUID,
        ${supplier_id}::UUID,
        ${invoice_number},
        ${invoice_date}::DATE,
        ${due_date}::DATE,
        ${invoice_amount}::DECIMAL,
        ${currency},
        ${payment_terms},
        ${financing_status}
      )
      ON CONFLICT (buyer_id, invoice_number) DO UPDATE SET
        invoice_amount = EXCLUDED.invoice_amount,
        due_date = EXCLUDED.due_date,
        updated_at = NOW()
      RETURNING *
    `

    const invoice = result.rows[0]

    // Calculate potential financing if eligible
    let financing_preview = null
    if (financing_status === 'eligible' && program) {
      const discountRate = parseFloat(program.discount_rate_pct) / 100
      const reserveRate = parseFloat(program.reserve_rate_pct) / 100
      const daysUntilDue = Math.max(0, (new Date(due_date) - new Date()) / (1000 * 60 * 60 * 24))
      const perDayRate = parseFloat(program.per_day_rate) / 100

      const discount = invoice_amount * discountRate + invoice_amount * perDayRate * daysUntilDue
      const reserve = invoice_amount * reserveRate
      const advance = invoice_amount - discount - reserve

      financing_preview = {
        advance_amount: advance,
        reserve_held: reserve,
        discount_fee: discount,
        effective_rate: ((discount / invoice_amount) * 100).toFixed(2) + '%',
        payment_speed: program.payment_speed,
        grain_reward: Math.floor(invoice_amount / 1000)
      }
    }

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        invoice_amount: parseFloat(invoice.invoice_amount),
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        payment_terms: invoice.payment_terms,
        financing_status: invoice.financing_status,
        created_at: invoice.created_at
      },
      eligibility: {
        status: financing_status,
        reason: eligibility_reason,
        has_financing_program: hasProgram
      },
      financing_preview,
      next_steps: financing_status === 'eligible'
        ? ['Invoice is eligible for financing', 'Use POST /api/financing/request to request early payment']
        : ['Invoice created but not eligible for financing', eligibility_reason]
    })
  } catch (error) {
    console.error('Invoice creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create invoice', details: error.message },
      { status: 500 }
    )
  }
}

// GET: List invoices
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const buyer_id = searchParams.get('buyer_id')
    const supplier_id = searchParams.get('supplier_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = `
      SELECT
        fi.*,
        sn.company_name as supplier_name,
        sn.supplier_code,
        ec.company_name as buyer_name,
        ec.customer_code,
        (fi.due_date - CURRENT_DATE) as days_until_due
      FROM financeable_invoices fi
      JOIN supplier_network sn ON fi.supplier_id = sn.id
      JOIN erp_customers ec ON fi.buyer_id = ec.id
      WHERE 1=1
    `
    const params = []
    let paramIndex = 1

    if (buyer_id) {
      query += ` AND fi.buyer_id = $${paramIndex}::UUID`
      params.push(buyer_id)
      paramIndex++
    }

    if (supplier_id) {
      query += ` AND fi.supplier_id = $${paramIndex}::UUID`
      params.push(supplier_id)
      paramIndex++
    }

    if (status) {
      query += ` AND fi.financing_status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    query += ` ORDER BY fi.due_date ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    // Execute with dynamic params
    let result
    if (params.length === 2) {
      result = await sql.query(query, params)
    } else if (buyer_id && !supplier_id && !status) {
      result = await sql`
        SELECT
          fi.*,
          sn.company_name as supplier_name,
          sn.supplier_code,
          ec.company_name as buyer_name,
          ec.customer_code,
          (fi.due_date - CURRENT_DATE) as days_until_due
        FROM financeable_invoices fi
        JOIN supplier_network sn ON fi.supplier_id = sn.id
        JOIN erp_customers ec ON fi.buyer_id = ec.id
        WHERE fi.buyer_id = ${buyer_id}::UUID
        ORDER BY fi.due_date ASC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else if (supplier_id && !buyer_id && !status) {
      result = await sql`
        SELECT
          fi.*,
          sn.company_name as supplier_name,
          sn.supplier_code,
          ec.company_name as buyer_name,
          ec.customer_code,
          (fi.due_date - CURRENT_DATE) as days_until_due
        FROM financeable_invoices fi
        JOIN supplier_network sn ON fi.supplier_id = sn.id
        JOIN erp_customers ec ON fi.buyer_id = ec.id
        WHERE fi.supplier_id = ${supplier_id}::UUID
        ORDER BY fi.due_date ASC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else if (status && !buyer_id && !supplier_id) {
      result = await sql`
        SELECT
          fi.*,
          sn.company_name as supplier_name,
          sn.supplier_code,
          ec.company_name as buyer_name,
          ec.customer_code,
          (fi.due_date - CURRENT_DATE) as days_until_due
        FROM financeable_invoices fi
        JOIN supplier_network sn ON fi.supplier_id = sn.id
        JOIN erp_customers ec ON fi.buyer_id = ec.id
        WHERE fi.financing_status = ${status}
        ORDER BY fi.due_date ASC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else {
      // All invoices
      result = await sql`
        SELECT
          fi.*,
          sn.company_name as supplier_name,
          sn.supplier_code,
          ec.company_name as buyer_name,
          ec.customer_code,
          (fi.due_date - CURRENT_DATE) as days_until_due
        FROM financeable_invoices fi
        JOIN supplier_network sn ON fi.supplier_id = sn.id
        JOIN erp_customers ec ON fi.buyer_id = ec.id
        ORDER BY fi.due_date ASC
        LIMIT ${limit} OFFSET ${offset}
      `
    }

    // Calculate totals by status
    const totals = result.rows.reduce((acc, inv) => {
      const status = inv.financing_status
      if (!acc[status]) {
        acc[status] = { count: 0, amount: 0 }
      }
      acc[status].count++
      acc[status].amount += parseFloat(inv.invoice_amount)
      return acc
    }, {})

    return NextResponse.json({
      invoices: result.rows.map(inv => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        invoice_amount: parseFloat(inv.invoice_amount),
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        days_until_due: inv.days_until_due,
        payment_terms: inv.payment_terms,
        financing_status: inv.financing_status,
        supplier: {
          id: inv.supplier_id,
          name: inv.supplier_name,
          code: inv.supplier_code
        },
        buyer: {
          id: inv.buyer_id,
          name: inv.buyer_name,
          code: inv.customer_code
        },
        financing: inv.financing_status !== 'eligible' && inv.financing_status !== 'not_eligible' ? {
          advance_amount: parseFloat(inv.advance_amount || 0),
          reserve_amount: parseFloat(inv.reserve_amount || 0),
          discount_amount: parseFloat(inv.discount_amount || 0),
          financed_at: inv.financed_at
        } : null
      })),
      pagination: {
        limit,
        offset,
        count: result.rows.length
      },
      totals
    })
  } catch (error) {
    console.error('Invoice list error:', error)
    return NextResponse.json(
      { error: 'Failed to list invoices', details: error.message },
      { status: 500 }
    )
  }
}
