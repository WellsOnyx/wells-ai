// @ts-nocheck
/**
 * WORKER PAYMENT API
 *
 * Handle payments to workers through Wells.
 * Work through Wells, get paid through Wells - IN GRAIN.
 *
 * POST /api/worker/payment - Process payment
 * GET /api/worker/payment - Get payment history
 *
 * Payment Options:
 * - 100% USD: Traditional instant payment
 * - 100% GRAIN: Get paid entirely in GRAIN with 5% bonus (appreciating asset!)
 * - Custom Split: e.g., 50% USD / 50% GRAIN (5% bonus on GRAIN portion)
 *
 * Why GRAIN?
 * - GRAIN appreciates as more assets back the system
 * - 1:1 credit line means instant USD access when needed
 * - 5% bonus for choosing GRAIN (Wells keeps USD longer)
 * - You're earning equity in the Wells ecosystem
 *
 * Payment Flow:
 * 1. Client pays Wells for work completed
 * 2. Wells takes 1% fee (on every transaction)
 * 3. Worker chooses: USD, GRAIN, or split
 * 4. GRAIN bonus applied if taking GRAIN
 * 5. Credit line available immediately
 */

import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

// GRAIN bonus for choosing GRAIN payment (Wells keeps USD longer)
const GRAIN_PAYMENT_BONUS = 0.05 // 5% bonus for taking GRAIN

// Wells fee tiers based on origination
const WELLS_FEE_TIERS = {
  transaction: 0.01,    // 1% - Transaction only (worker has own client)
  sourced: 0.033,       // 3.3% - Wells AI discovered the opportunity
  originated: 0.077,    // 7.7% - Wells brought both client AND worker together
  partner: null         // Custom - Established partner pricing
}

// POST: Process a payment
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      worker_id,
      engagement_id,
      timesheet_id,
      amount,
      payment_type,
      description,
      // Payment currency options
      payment_currency = 'usd', // 'usd' | 'grain' | 'split'
      grain_percentage = 0, // For split payments: 0-100
      // Origination determines fee tier
      origination_type = 'transaction' // 'transaction' | 'sourced' | 'originated' | 'partner'
    } = body

    if (!worker_id || !amount) {
      return NextResponse.json({
        error: 'worker_id and amount required'
      }, { status: 400 })
    }

    // Validate payment_currency
    if (!['usd', 'grain', 'split'].includes(payment_currency)) {
      return NextResponse.json({
        error: 'payment_currency must be usd, grain, or split'
      }, { status: 400 })
    }

    // Validate grain_percentage for split
    const grainPct = payment_currency === 'grain' ? 100 :
                     payment_currency === 'usd' ? 0 :
                     Math.min(100, Math.max(0, parseFloat(grain_percentage) || 0))

    // Validate origination_type
    const validOriginTypes = ['transaction', 'sourced', 'originated', 'partner']
    const originType = validOriginTypes.includes(origination_type) ? origination_type : 'transaction'

    // Get worker
    const workerResult = await sql`
      SELECT * FROM workers WHERE id = ${worker_id}::UUID
    `
    if (workerResult.rows.length === 0) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 })
    }
    const worker = workerResult.rows[0]

    // Calculate payment breakdown with dynamic fee tier
    const grossAmount = parseFloat(amount)

    // Determine fee rate based on origination
    // - transaction: 1% (worker has own client, Wells just processes payment)
    // - sourced: 3.3% (Wells AI discovered the opportunity)
    // - originated: 7.7% (Wells brought client AND worker together)
    // - partner: Custom rate from partner agreement
    let feeRate = WELLS_FEE_TIERS[originType as keyof typeof WELLS_FEE_TIERS]
    if (feeRate === null) {
      // Partner pricing - look up from engagement or default to 1%
      feeRate = 0.01 // TODO: Pull custom rate from partner agreement
    }

    const wellsFee = grossAmount * feeRate
    const netAmount = grossAmount - wellsFee

    // Calculate GRAIN vs USD split
    const grainPortionValue = netAmount * (grainPct / 100)
    const usdPortionValue = netAmount - grainPortionValue

    // Calculate GRAIN earned
    // Workers earn GRAIN by choosing to be paid in GRAIN (with 5% bonus)
    // No automatic GRAIN reward - they opt-in
    const grainPaymentBonus = grainPortionValue * GRAIN_PAYMENT_BONUS
    const totalGrainFromPayment = grainPortionValue + grainPaymentBonus // GRAIN portion + 5% bonus
    const totalGrainEarned = totalGrainFromPayment

    // Create payment record
    const paymentResult = await sql`
      INSERT INTO eor_payments (
        worker_id,
        engagement_id,
        timesheet_id,
        payment_type,
        gross_amount,
        wells_fee,
        net_amount,
        grain_earned,
        status,
        to_wallet_id,
        scheduled_date
      ) VALUES (
        ${worker_id}::UUID,
        ${engagement_id || null}::UUID,
        ${timesheet_id || null}::UUID,
        ${payment_type || 'direct'},
        ${grossAmount},
        ${wellsFee},
        ${netAmount},
        ${totalGrainEarned},
        'completed',
        ${worker.wallet_id}::UUID,
        CURRENT_DATE
      )
      RETURNING *
    `
    const payment = paymentResult.rows[0]

    // Credit worker's wallet with USD portion only
    if (usdPortionValue > 0) {
      await sql`
        UPDATE treasury_wallets
        SET balance = balance + ${usdPortionValue},
            updated_at = NOW()
        WHERE id = ${worker.wallet_id}::UUID
      `
    }

    // Award GRAIN if worker chose GRAIN payment
    if (grainPortionValue > 0) {
      // Main payment in GRAIN
      await sql`
        INSERT INTO grain_ledger (
          wallet_id, type, quantity,
          reference_type, reference_id,
          reason, category
        ) VALUES (
          ${worker.wallet_id}::UUID,
          'credit',
          ${grainPortionValue},
          'worker_payment_grain',
          ${payment.id}::TEXT,
          'Payment received in GRAIN',
          'worker_payment'
        )
      `

      // 5% bonus for choosing GRAIN
      if (grainPaymentBonus > 0) {
        await sql`
          INSERT INTO grain_ledger (
            wallet_id, type, quantity,
            reference_type, reference_id,
            reason, category
          ) VALUES (
            ${worker.wallet_id}::UUID,
            'credit',
            ${grainPaymentBonus},
            'worker_grain_bonus',
            ${payment.id}::TEXT,
            'GRAIN payment bonus (5%)',
            'worker_reward'
          )
        `
      }
    }

    // Update worker's GRAIN balance
    await sql`
      UPDATE workers
      SET grain_balance = grain_balance + ${totalGrainEarned},
          updated_at = NOW()
      WHERE id = ${worker_id}::UUID
    `

    // Update engagement totals if provided
    if (engagement_id) {
      await sql`
        UPDATE eor_engagements
        SET total_earned = total_earned + ${netAmount},
            total_paid = total_paid + ${netAmount},
            total_grain_earned = total_grain_earned + ${totalGrainEarned},
            updated_at = NOW()
        WHERE id = ${engagement_id}::UUID
      `
    }

    // Calculate new balances
    const newGrainBalance = parseFloat(worker.grain_balance || 0) + totalGrainEarned
    const creditLineAvailable = newGrainBalance // 1:1 GRAIN to USD credit line

    // Build message based on payment type
    let message = ''
    if (payment_currency === 'usd') {
      message = `$${netAmount.toFixed(2)} sent to your Wells wallet.`
    } else if (payment_currency === 'grain') {
      message = `${totalGrainFromPayment.toFixed(4)} GRAIN deposited (includes 5% bonus!). Credit line: $${newGrainBalance.toFixed(2)}`
    } else {
      message = `$${usdPortionValue.toFixed(2)} USD + ${totalGrainFromPayment.toFixed(4)} GRAIN deposited.`
    }

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        gross_amount: grossAmount,
        wells_fee: wellsFee,
        wells_fee_rate: feeRate,
        origination_type: originType,
        net_amount: netAmount,
        payment_currency,
        grain_percentage: grainPct,
        // Breakdown
        usd_portion: usdPortionValue,
        grain_portion_value: grainPortionValue,
        grain_payment_bonus: grainPaymentBonus,
        total_grain_earned: totalGrainEarned,
        status: 'completed',
        processed_at: new Date().toISOString()
      },
      worker_balance: {
        usd_balance: usdPortionValue, // Added to wallet
        grain_balance: newGrainBalance,
        credit_line_available: creditLineAvailable,
        // The magic: even with 100% GRAIN, you have instant USD access
        instant_usd_access: creditLineAvailable
      },
      message,
      grain_benefits: payment_currency !== 'usd' ? {
        appreciation: 'GRAIN value grows as more assets back the system',
        credit_line: '1:1 credit line for instant USD access',
        bonus: `${(GRAIN_PAYMENT_BONUS * 100).toFixed(0)}% bonus for choosing GRAIN`,
        no_loss: 'You can always access USD via credit line'
      } : undefined
    })
  } catch (error) {
    console.error('Payment processing error:', error)
    return NextResponse.json(
      { error: 'Failed to process payment', details: error.message },
      { status: 500 }
    )
  }
}

// GET: Get payment history
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const workerId = searchParams.get('worker_id')
    const engagementId = searchParams.get('engagement_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!workerId) {
      return NextResponse.json({ error: 'worker_id required' }, { status: 400 })
    }

    // Build query
    let payments
    if (engagementId) {
      payments = await sql`
        SELECT
          p.*,
          e.rate as engagement_rate
        FROM eor_payments p
        LEFT JOIN eor_engagements e ON p.engagement_id = e.id
        WHERE p.worker_id = ${workerId}::UUID
        AND p.engagement_id = ${engagementId}::UUID
        ORDER BY p.created_at DESC
        LIMIT ${limit}
      `
    } else if (status) {
      payments = await sql`
        SELECT
          p.*,
          e.rate as engagement_rate,
          proj.title as project_title
        FROM eor_payments p
        LEFT JOIN eor_engagements e ON p.engagement_id = e.id
        LEFT JOIN eor_projects proj ON e.project_id = proj.id
        WHERE p.worker_id = ${workerId}::UUID
        AND p.status = ${status}
        ORDER BY p.created_at DESC
        LIMIT ${limit}
      `
    } else {
      payments = await sql`
        SELECT
          p.*,
          e.rate as engagement_rate,
          proj.title as project_title,
          c.company_name as client_name
        FROM eor_payments p
        LEFT JOIN eor_engagements e ON p.engagement_id = e.id
        LEFT JOIN eor_projects proj ON e.project_id = proj.id
        LEFT JOIN eor_clients c ON e.client_id = c.id
        WHERE p.worker_id = ${workerId}::UUID
        ORDER BY p.created_at DESC
        LIMIT ${limit}
      `
    }

    // Calculate totals
    const totals = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'completed' THEN net_amount ELSE 0 END), 0) as total_earned,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN net_amount ELSE 0 END), 0) as pending_amount,
        COALESCE(SUM(grain_earned), 0) as total_grain_earned,
        COUNT(*) as total_payments
      FROM eor_payments
      WHERE worker_id = ${workerId}::UUID
    `

    // Get worker's current GRAIN balance
    const worker = await sql`
      SELECT grain_balance FROM workers WHERE id = ${workerId}::UUID
    `
    const grainBalance = parseFloat(worker.rows[0]?.grain_balance || 0)

    return NextResponse.json({
      payments: payments.rows.map(p => ({
        id: p.id,
        payment_type: p.payment_type,
        gross_amount: parseFloat(p.gross_amount),
        wells_fee: parseFloat(p.wells_fee),
        net_amount: parseFloat(p.net_amount),
        grain_earned: parseFloat(p.grain_earned),
        status: p.status,
        project_title: p.project_title,
        client_name: p.client_name,
        created_at: p.created_at,
        processed_at: p.processed_at
      })),
      summary: {
        total_earned: parseFloat(totals.rows[0].total_earned),
        pending_amount: parseFloat(totals.rows[0].pending_amount),
        total_grain_earned: parseFloat(totals.rows[0].total_grain_earned),
        total_payments: parseInt(totals.rows[0].total_payments),
        current_grain_balance: grainBalance,
        credit_line_available: grainBalance // 1:1
      }
    })
  } catch (error) {
    console.error('Payment fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments', details: error.message },
      { status: 500 }
    )
  }
}
