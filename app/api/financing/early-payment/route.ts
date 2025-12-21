// @ts-nocheck
/**
 * DYNAMIC DISCOUNTING / EARLY PAYMENT API
 *
 * Generate and manage early payment discount offers.
 *
 * "Pay in 10 days, save 2%"
 * "Pay in 20 days, save 1%"
 * "Pay on time, earn GRAIN"
 *
 * SECURITY: All endpoints require Clerk authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'

// POST: Generate early payment offers for an invoice
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { invoice_id, schedule_id, action } = body

    if (!invoice_id) {
      return NextResponse.json(
        { error: 'invoice_id is required' },
        { status: 400 }
      )
    }

    // SECURITY: Verify user has permission to manage offers for this invoice
    const accessCheck = await sql`
      SELECT fi.id FROM financeable_invoices fi
      WHERE fi.id = ${invoice_id}::UUID
        AND (fi.buyer_user_id = ${userId} OR fi.supplier_user_id = ${userId} OR fi.created_by = ${userId})
    `
    if (accessCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invoice not found or access denied' },
        { status: 403 }
      )
    }

    // Generate offers
    if (!action || action === 'generate') {
      const result = await sql`
        SELECT generate_early_payment_offers(
          ${invoice_id}::UUID,
          ${schedule_id ? schedule_id : null}::UUID
        ) as offers_created
      `

      const offersCreated = result.rows[0]?.offers_created || 0

      // Get the generated offers
      const offersResult = await sql`
        SELECT
          epo.*,
          fi.invoice_number,
          ec.company_name as buyer_name
        FROM early_payment_offers epo
        JOIN financeable_invoices fi ON epo.invoice_id = fi.id
        JOIN erp_customers ec ON fi.buyer_id = ec.id
        WHERE epo.invoice_id = ${invoice_id}::UUID
        AND epo.status = 'active'
        ORDER BY epo.days_early DESC
      `

      return NextResponse.json({
        success: true,
        invoice_id,
        offers_created: offersCreated,
        offers: offersResult.rows.map(offer => ({
          id: offer.id,
          invoice_number: offer.invoice_number,
          buyer_name: offer.buyer_name,
          offer: {
            days_early: offer.days_early,
            pay_by_date: offer.pay_by_date,
            discount_pct: parseFloat(offer.discount_pct),
            discount_amount: parseFloat(offer.discount_amount),
            original_amount: parseFloat(offer.original_amount),
            discounted_amount: parseFloat(offer.discounted_amount),
            grain_bonus: offer.grain_bonus
          },
          status: offer.status,
          valid_until: offer.valid_until
        })),
        message: `Generated ${offersCreated} early payment offers`
      })
    }

    // Accept an offer
    if (action === 'accept') {
      const { offer_id } = body

      if (!offer_id) {
        return NextResponse.json(
          { error: 'offer_id required for accept action' },
          { status: 400 }
        )
      }

      const result = await sql`
        SELECT * FROM accept_early_payment_offer(${offer_id}::UUID)
      `

      const acceptance = result.rows[0]

      if (!acceptance?.success) {
        return NextResponse.json(
          {
            success: false,
            error: acceptance?.message || 'Failed to accept offer'
          },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        offer_id,
        acceptance: {
          amount_due: parseFloat(acceptance.amount_due),
          savings: parseFloat(acceptance.savings),
          grain_earned: acceptance.grain_earned,
          pay_by: acceptance.pay_by,
          message: acceptance.message
        },
        payment_instructions: {
          amount: parseFloat(acceptance.amount_due),
          due_by: acceptance.pay_by,
          reference: `Early Payment - ${invoice_id}`,
          methods: ['ACH', 'Wire', 'Check']
        },
        rewards: {
          grain_bonus: acceptance.grain_earned,
          message: `You'll earn ${acceptance.grain_earned} GRAIN when payment is received! 🌾`
        }
      })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "generate" or "accept"' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Early payment error:', error)
    return NextResponse.json(
      { error: 'Failed to process early payment request', details: error.message },
      { status: 500 }
    )
  }
}

// GET: Get early payment offers for an invoice or buyer
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const invoice_id = searchParams.get('invoice_id')
    const buyer_id = searchParams.get('buyer_id')
    const status = searchParams.get('status') || 'active'

    if (invoice_id) {
      // SECURITY: Verify user has permission to view offers for this invoice
      const accessCheck = await sql`
        SELECT fi.id FROM financeable_invoices fi
        WHERE fi.id = ${invoice_id}::UUID
          AND (fi.buyer_user_id = ${userId} OR fi.supplier_user_id = ${userId} OR fi.created_by = ${userId})
      `
      if (accessCheck.rows.length === 0) {
        return NextResponse.json(
          { error: 'Invoice not found or access denied' },
          { status: 403 }
        )
      }
      // Get offers for specific invoice
      const result = await sql`
        SELECT
          epo.*,
          fi.invoice_number,
          fi.invoice_amount as original_invoice_amount,
          sn.company_name as supplier_name
        FROM early_payment_offers epo
        JOIN financeable_invoices fi ON epo.invoice_id = fi.id
        JOIN supplier_network sn ON fi.supplier_id = sn.id
        WHERE epo.invoice_id = ${invoice_id}::UUID
        AND (${status} = 'all' OR epo.status = ${status})
        ORDER BY epo.days_early DESC
      `

      return NextResponse.json({
        invoice_id,
        offers: result.rows.map(offer => ({
          id: offer.id,
          invoice_number: offer.invoice_number,
          supplier_name: offer.supplier_name,
          days_early: offer.days_early,
          pay_by_date: offer.pay_by_date,
          discount: {
            percentage: parseFloat(offer.discount_pct),
            amount: parseFloat(offer.discount_amount)
          },
          amounts: {
            original: parseFloat(offer.original_amount),
            discounted: parseFloat(offer.discounted_amount)
          },
          grain_bonus: offer.grain_bonus,
          status: offer.status,
          valid_until: offer.valid_until,
          accepted_at: offer.accepted_at
        }))
      })
    }

    if (buyer_id) {
      // Get all active offers for a buyer
      const result = await sql`
        SELECT
          epo.*,
          fi.invoice_number,
          fi.invoice_amount,
          fi.due_date,
          sn.company_name as supplier_name
        FROM early_payment_offers epo
        JOIN financeable_invoices fi ON epo.invoice_id = fi.id
        JOIN supplier_network sn ON fi.supplier_id = sn.id
        WHERE fi.buyer_id = ${buyer_id}::UUID
        AND epo.status = 'active'
        AND epo.valid_until > NOW()
        ORDER BY epo.discount_pct DESC, epo.pay_by_date ASC
      `

      // Group by invoice
      const byInvoice = {}
      result.rows.forEach(offer => {
        if (!byInvoice[offer.invoice_id]) {
          byInvoice[offer.invoice_id] = {
            invoice_id: offer.invoice_id,
            invoice_number: offer.invoice_number,
            invoice_amount: parseFloat(offer.invoice_amount),
            supplier_name: offer.supplier_name,
            due_date: offer.due_date,
            offers: []
          }
        }
        byInvoice[offer.invoice_id].offers.push({
          id: offer.id,
          days_early: offer.days_early,
          pay_by_date: offer.pay_by_date,
          discount_pct: parseFloat(offer.discount_pct),
          discounted_amount: parseFloat(offer.discounted_amount),
          savings: parseFloat(offer.discount_amount),
          grain_bonus: offer.grain_bonus
        })
      })

      // Calculate total potential savings
      const invoices = Object.values(byInvoice)
      const totalPotentialSavings = invoices.reduce((sum, inv) => {
        const bestOffer = inv.offers[0] // Already sorted by discount_pct DESC
        return sum + (bestOffer?.savings || 0)
      }, 0)

      return NextResponse.json({
        buyer_id,
        total_invoices_with_offers: invoices.length,
        total_potential_savings: totalPotentialSavings,
        invoices,
        recommendation: totalPotentialSavings > 0
          ? `Pay early and save $${totalPotentialSavings.toFixed(2)}!`
          : 'No active early payment offers'
      })
    }

    // Dashboard view - offer statistics
    const stats = await sql`
      SELECT * FROM early_payment_offer_stats LIMIT 30
    `

    return NextResponse.json({
      statistics: stats.rows.map(row => ({
        date: row.offer_date,
        offers_created: parseInt(row.offers_created),
        accepted: parseInt(row.accepted),
        expired: parseInt(row.expired),
        total_discounts_given: parseFloat(row.total_discounts_given),
        total_grain_awarded: parseInt(row.total_grain_awarded),
        acceptance_rate: parseFloat(row.acceptance_rate_pct)
      }))
    })
  } catch (error) {
    console.error('Early payment query error:', error)
    return NextResponse.json(
      { error: 'Failed to get early payment offers', details: error.message },
      { status: 500 }
    )
  }
}
