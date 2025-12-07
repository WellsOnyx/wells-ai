// @ts-nocheck
/**
 * WORKER PAYMENT API
 *
 * Handle payments to workers through Wells.
 * Work through Wells, get paid through Wells.
 *
 * POST /api/worker/payment - Process payment
 * GET /api/worker/payment - Get payment history
 *
 * Payment Flow:
 * 1. Client pays Wells for work completed
 * 2. Wells takes platform fee (5%)
 * 3. Worker receives net amount instantly
 * 4. Worker earns GRAIN (1% of payment)
 * 5. GRAIN credit line available immediately
 */

import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

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
      description
    } = body

    if (!worker_id || !amount) {
      return NextResponse.json({
        error: 'worker_id and amount required'
      }, { status: 400 })
    }

    // Get worker
    const workerResult = await sql`
      SELECT * FROM workers WHERE id = ${worker_id}::UUID
    `
    if (workerResult.rows.length === 0) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 })
    }
    const worker = workerResult.rows[0]

    // Calculate payment breakdown
    const grossAmount = parseFloat(amount)
    const wellsFee = grossAmount * 0.05 // 5% platform fee
    const netAmount = grossAmount - wellsFee
    const grainEarned = netAmount * 0.01 // 1% GRAIN reward

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
        ${grainEarned},
        'completed',
        ${worker.wallet_id}::UUID,
        CURRENT_DATE
      )
      RETURNING *
    `
    const payment = paymentResult.rows[0]

    // Credit worker's wallet
    await sql`
      UPDATE treasury_wallets
      SET balance = balance + ${netAmount},
          updated_at = NOW()
      WHERE id = ${worker.wallet_id}::UUID
    `

    // Award GRAIN
    await sql`
      INSERT INTO grain_ledger (
        wallet_id, type, quantity,
        reference_type, reference_id,
        reason, category
      ) VALUES (
        ${worker.wallet_id}::UUID,
        'credit',
        ${grainEarned},
        'worker_payment',
        ${payment.id}::TEXT,
        ${description || 'GRAIN earned on payment'},
        'worker_reward'
      )
    `

    // Update worker's GRAIN balance
    await sql`
      UPDATE workers
      SET grain_balance = grain_balance + ${grainEarned},
          updated_at = NOW()
      WHERE id = ${worker_id}::UUID
    `

    // Update engagement totals if provided
    if (engagement_id) {
      await sql`
        UPDATE eor_engagements
        SET total_earned = total_earned + ${netAmount},
            total_paid = total_paid + ${netAmount},
            total_grain_earned = total_grain_earned + ${grainEarned},
            updated_at = NOW()
        WHERE id = ${engagement_id}::UUID
      `
    }

    // Calculate credit line available (1:1 against GRAIN)
    const newGrainBalance = parseFloat(worker.grain_balance || 0) + grainEarned
    const creditLineAvailable = newGrainBalance // 1:1 GRAIN to USD credit line

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        gross_amount: grossAmount,
        wells_fee: wellsFee,
        net_amount: netAmount,
        grain_earned: grainEarned,
        status: 'completed',
        processed_at: new Date().toISOString()
      },
      worker_balance: {
        wallet_balance: netAmount, // Would add to existing balance
        grain_balance: newGrainBalance,
        credit_line_available: creditLineAvailable
      },
      message: `Payment of $${netAmount.toFixed(2)} sent instantly to your Wells wallet. +${grainEarned.toFixed(4)} GRAIN earned.`
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
