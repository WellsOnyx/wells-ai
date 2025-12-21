/**
 * Complete Deposit API
 * POST: Complete deposit after Circle on-ramp success (or demo checkout)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { sessionId, paymentIntentId, amount, status, demo } = body
    const reference = sessionId || paymentIntentId

    if (!reference) {
      return NextResponse.json(
        { error: 'sessionId or paymentIntentId is required' },
        { status: 400 }
      )
    }

    // Handle cancellation
    if (status === 'cancelled' || status === 'failed') {
      await sql`
        UPDATE grain_transactions
        SET status = 'cancelled', updated_at = NOW()
        WHERE circle_transfer_id = ${reference}
          AND user_id = ${userId}
          AND status = 'pending'
      `
      return NextResponse.json({
        success: true,
        status: 'cancelled',
      })
    }

    // Get deposit amount from request or from pending transaction
    let depositAmount = parseFloat(amount) || 0

    if (depositAmount <= 0) {
      // Try to get from pending transaction
      const pendingResult = await sql`
        SELECT amount FROM grain_transactions
        WHERE circle_transfer_id = ${reference}
          AND user_id = ${userId}
          AND status = 'pending'
      `
      if (pendingResult.rows.length > 0) {
        depositAmount = parseFloat(pendingResult.rows[0].amount)
      }
    }

    if (depositAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid or missing amount' },
        { status: 400 }
      )
    }

    // GRAIN price is 1:1 with USD
    const grainPrice = 1.0
    const grainAmount = depositAmount / grainPrice

    // Check if already completed
    const existingResult = await sql`
      SELECT id FROM grain_transactions
      WHERE circle_transfer_id = ${reference}
        AND user_id = ${userId}
        AND status = 'completed'
    `

    if (existingResult.rows.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Deposit already completed',
        grainAmount,
        alreadyProcessed: true
      })
    }

    // Update existing pending transaction or create new one
    const txResult = await sql`
      UPDATE grain_transactions
      SET
        status = 'completed',
        completed_at = NOW()
      WHERE circle_transfer_id = ${reference}
        AND user_id = ${userId}
        AND status = 'pending'
      RETURNING id
    `

    if (txResult.rows.length === 0) {
      // No pending transaction, create completed one
      await sql`
        INSERT INTO grain_transactions (
          user_id,
          type,
          amount,
          reason,
          circle_transfer_id,
          status,
          created_at,
          completed_at
        ) VALUES (
          ${userId},
          'deposit',
          ${grainAmount},
          ${demo ? 'Demo deposit (sandbox)' : 'Card deposit via Circle'},
          ${reference},
          'completed',
          NOW(),
          NOW()
        )
      `
    }

    // Ensure user has wallet entry
    await sql`
      INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance, created_at, updated_at)
      VALUES (
        ${userId},
        ${'grain-' + userId.substring(0, 8) + '-' + Date.now().toString(36)},
        'custodial',
        0,
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id) DO NOTHING
    `

    // Credit user's GRAIN balance
    await sql`
      UPDATE user_wallets
      SET
        balance = balance + ${grainAmount},
        updated_at = NOW()
      WHERE user_id = ${userId}
    `

    // Get new balance
    const balanceResult = await sql`
      SELECT balance FROM user_wallets WHERE user_id = ${userId}
    `
    const newBalance = parseFloat(balanceResult.rows[0]?.balance || '0')

    console.log(`[Deposit Complete] User ${userId}: +${grainAmount} GRAIN, new balance: ${newBalance}`)

    return NextResponse.json({
      success: true,
      status: 'completed',
      grainAmount,
      grainPrice,
      depositAmount,
      newBalance,
      transactionId: reference
    })
  } catch (error: any) {
    console.error('Complete deposit error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to complete deposit' },
      { status: 500 }
    )
  }
}
