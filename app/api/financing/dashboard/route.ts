// @ts-nocheck
/**
 * FINANCING DASHBOARD API
 *
 * Get financing metrics, pipeline, and analytics.
 * GET /api/financing/dashboard
 */

import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') || 'overview'
    const customer_id = searchParams.get('customer_id')
    const supplier_id = searchParams.get('supplier_id')

    // Overview dashboard
    if (view === 'overview') {
      // Get pipeline stats
      const pipelineResult = await sql`
        SELECT * FROM financing_pipeline
      `

      // Get today's activity
      const todayResult = await sql`
        SELECT * FROM daily_financing_activity
        WHERE activity_date = CURRENT_DATE
      `

      // Get supplier summary
      const supplierResult = await sql`
        SELECT * FROM supplier_financing_summary LIMIT 10
      `

      // Get buyer summary
      const buyerResult = await sql`
        SELECT * FROM buyer_financing_summary LIMIT 10
      `

      // Get early payment stats
      const epResult = await sql`
        SELECT * FROM early_payment_offer_stats
        WHERE offer_date > CURRENT_DATE - INTERVAL '7 days'
      `

      // Calculate totals
      const pipeline = pipelineResult.rows
      const totalInvoices = pipeline.reduce((sum, p) => sum + parseInt(p.invoice_count), 0)
      const totalAmount = pipeline.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0)
      const totalAdvanced = pipeline.reduce((sum, p) => sum + parseFloat(p.total_advanced || 0), 0)
      const totalRevenue = pipeline.reduce((sum, p) => sum + parseFloat(p.total_discount_earned || 0), 0)

      return NextResponse.json({
        overview: {
          total_invoices_in_system: totalInvoices,
          total_invoice_value: totalAmount,
          total_advanced_to_suppliers: totalAdvanced,
          total_discount_revenue: totalRevenue,
          financing_utilization: totalAmount > 0
            ? ((totalAdvanced / totalAmount) * 100).toFixed(1) + '%'
            : '0%'
        },
        pipeline: pipeline.reduce((acc, p) => {
          acc[p.financing_status] = {
            count: parseInt(p.invoice_count),
            amount: parseFloat(p.total_amount || 0),
            advanced: parseFloat(p.total_advanced || 0),
            revenue: parseFloat(p.total_discount_earned || 0),
            avg_days_to_due: parseFloat(p.avg_days_to_due || 0)
          }
          return acc
        }, {}),
        today: {
          transactions: todayResult.rows.map(t => ({
            type: t.transaction_type,
            count: parseInt(t.transaction_count),
            credits: parseFloat(t.credits || 0),
            debits: parseFloat(t.debits || 0),
            grain_issued: parseFloat(t.grain_issued || 0)
          }))
        },
        top_suppliers: supplierResult.rows.map(s => ({
          code: s.supplier_code,
          name: s.company_name,
          program: s.program_type,
          limit: parseFloat(s.advance_limit || 0),
          used: parseFloat(s.advance_used || 0),
          available: parseFloat(s.advance_available || 0),
          volume_financed: parseFloat(s.total_volume_financed || 0),
          default_rate: parseFloat(s.default_rate_pct || 0)
        })),
        top_buyers: buyerResult.rows.map(b => ({
          code: b.customer_code,
          name: b.company_name,
          program: b.program_type,
          limit: parseFloat(b.credit_limit || 0),
          used: parseFloat(b.credit_used || 0),
          available: parseFloat(b.credit_available || 0),
          apr: parseFloat(b.effective_apr || 0),
          risk_rating: b.risk_rating
        })),
        early_payment: {
          last_7_days: epResult.rows.map(e => ({
            date: e.offer_date,
            offers_created: parseInt(e.offers_created),
            accepted: parseInt(e.accepted),
            expired: parseInt(e.expired),
            discounts_given: parseFloat(e.total_discounts_given || 0),
            grain_awarded: parseInt(e.total_grain_awarded || 0),
            acceptance_rate: parseFloat(e.acceptance_rate_pct || 0)
          }))
        }
      })
    }

    // Supplier-specific view
    if (view === 'supplier' && supplier_id) {
      const programResult = await sql`
        SELECT * FROM financing_programs_supplier
        WHERE supplier_id = ${supplier_id}::UUID
      `

      const invoicesResult = await sql`
        SELECT
          fi.*,
          ec.company_name as buyer_name,
          (fi.due_date - CURRENT_DATE) as days_until_due
        FROM financeable_invoices fi
        JOIN erp_customers ec ON fi.buyer_id = ec.id
        WHERE fi.supplier_id = ${supplier_id}::UUID
        ORDER BY fi.financing_status, fi.due_date
      `

      const program = programResult.rows[0] || {}

      return NextResponse.json({
        supplier_id,
        program: {
          name: program.program_name,
          type: program.program_type,
          limit: parseFloat(program.advance_limit || 0),
          used: parseFloat(program.advance_used || 0),
          available: parseFloat(program.advance_available || 0),
          advance_rate: parseFloat(program.advance_rate_pct || 95),
          discount_rate: parseFloat(program.discount_rate_pct || 2),
          payment_speed: program.payment_speed,
          grain_enabled: program.grain_reward_enabled,
          status: program.status
        },
        performance: {
          invoices_financed: program.invoices_financed || 0,
          total_volume: parseFloat(program.total_volume_financed || 0),
          avg_collection_days: program.avg_days_to_collection,
          default_rate: parseFloat(program.default_rate_pct || 0)
        },
        invoices: invoicesResult.rows.map(i => ({
          id: i.id,
          invoice_number: i.invoice_number,
          buyer_name: i.buyer_name,
          amount: parseFloat(i.invoice_amount),
          due_date: i.due_date,
          days_until_due: i.days_until_due,
          status: i.financing_status,
          advance_amount: parseFloat(i.advance_amount || 0),
          financed_at: i.financed_at
        }))
      })
    }

    // Buyer-specific view
    if (view === 'buyer' && customer_id) {
      const programResult = await sql`
        SELECT * FROM financing_programs_buyer
        WHERE customer_id = ${customer_id}::UUID
      `

      const invoicesResult = await sql`
        SELECT
          fi.*,
          sn.company_name as supplier_name,
          (fi.due_date - CURRENT_DATE) as days_until_due
        FROM financeable_invoices fi
        JOIN supplier_network sn ON fi.supplier_id = sn.id
        WHERE fi.buyer_id = ${customer_id}::UUID
        ORDER BY fi.due_date
      `

      const offersResult = await sql`
        SELECT
          epo.*,
          fi.invoice_number,
          sn.company_name as supplier_name
        FROM early_payment_offers epo
        JOIN financeable_invoices fi ON epo.invoice_id = fi.id
        JOIN supplier_network sn ON fi.supplier_id = sn.id
        WHERE fi.buyer_id = ${customer_id}::UUID
        AND epo.status = 'active'
        ORDER BY epo.discount_pct DESC
      `

      const program = programResult.rows[0] || {}

      return NextResponse.json({
        customer_id,
        program: {
          name: program.program_name,
          type: program.program_type,
          credit_limit: parseFloat(program.credit_limit || 0),
          credit_used: parseFloat(program.credit_used || 0),
          credit_available: parseFloat(program.credit_available || 0),
          standard_days: program.standard_payment_days,
          extended_days: program.extended_payment_days,
          apr: parseFloat(program.effective_apr || 0),
          risk_rating: program.risk_rating,
          grain_enabled: program.grain_reward_enabled,
          status: program.status
        },
        invoices: invoicesResult.rows.map(i => ({
          id: i.id,
          invoice_number: i.invoice_number,
          supplier_name: i.supplier_name,
          amount: parseFloat(i.invoice_amount),
          due_date: i.due_date,
          days_until_due: i.days_until_due,
          status: i.financing_status
        })),
        early_payment_opportunities: offersResult.rows.map(o => ({
          offer_id: o.id,
          invoice_number: o.invoice_number,
          supplier_name: o.supplier_name,
          pay_by: o.pay_by_date,
          discount_pct: parseFloat(o.discount_pct),
          save_amount: parseFloat(o.discount_amount),
          pay_amount: parseFloat(o.discounted_amount),
          grain_bonus: o.grain_bonus
        })),
        total_potential_savings: offersResult.rows.reduce(
          (sum, o) => sum + parseFloat(o.discount_amount),
          0
        )
      })
    }

    return NextResponse.json({
      error: 'Invalid view parameter',
      valid_views: ['overview', 'supplier', 'buyer'],
      required_params: {
        supplier: 'supplier_id',
        buyer: 'customer_id'
      }
    }, { status: 400 })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to get dashboard', details: error.message },
      { status: 500 }
    )
  }
}
