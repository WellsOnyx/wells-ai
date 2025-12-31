/**
 * Complete Deposit API
 * POST: Complete deposit after Circle on-ramp success (or demo checkout)
 *
 * NEW CREDIT LINE MODEL:
 * - Deposit goes to protected deposit (100% protected)
 * - Credit line created 1:1 at current GRAIN price
 * - 0% interest, 0% fees
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'
import { CreditLineEngine } from '@/lib/grain/credit-line-engine'

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

    // Check if already completed
    const existingResult = await sql`
      SELECT id FROM grain_transactions
      WHERE circle_transfer_id = ${reference}
        AND user_id = ${userId}
        AND status = 'completed'
    `

    if (existingResult.rows.length > 0) {
      // Return existing position
      const position = await CreditLineEngine.getPosition(userId)
      return NextResponse.json({
        success: true,
        message: 'Deposit already completed',
        alreadyProcessed: true,
        position,
      })
    }

    // Use Credit Line Engine for deposit
    // This creates: protected deposit + credit line at current price
    const depositResult = await CreditLineEngine.deposit(userId, depositAmount)

    // Also update legacy grain_transactions table for backward compatibility
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
          ${depositAmount},
          ${demo ? 'Demo deposit (sandbox) - Credit Line Model' : 'Card deposit via Circle - Credit Line Model'},
          ${reference},
          'completed',
          NOW(),
          NOW()
        )
      `
    }

    // Also maintain user_wallets for backward compatibility
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

    await sql`
      UPDATE user_wallets
      SET
        balance = ${depositResult.position.creditLineAvailable + depositResult.position.appreciationGrain},
        updated_at = NOW()
      WHERE user_id = ${userId}
    `

    console.log(`[Deposit Complete] User ${userId}: Credit Line Model activated`)
    console.log(`  Protected Deposit: $${depositResult.position.protectedDeposit.toLocaleString()}`)
    console.log(`  Credit Line: ${depositResult.position.creditLineAvailable.toLocaleString()} GRAIN`)

    return NextResponse.json({
      success: true,
      status: 'completed',
      depositAmount,
      transactionId: reference,

      // Credit Line Model response
      position: depositResult.position,
      transaction: depositResult.transaction,
      message: depositResult.message,

      // Summary for UI
      summary: {
        protectedDeposit: depositResult.position.protectedDeposit,
        protectedDepositFormatted: `$${depositResult.position.protectedDeposit.toLocaleString()}`,
        creditLineAvailable: depositResult.position.creditLineAvailable,
        creditLineAvailableFormatted: `${depositResult.position.creditLineAvailable.toLocaleString()} GRAIN`,
        grainPrice: depositResult.position.depositGrainPrice,
        grainPriceFormatted: `$${depositResult.position.depositGrainPrice.toFixed(4)}`,
      },
    })
  } catch (error: any) {
    console.error('Complete deposit error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to complete deposit' },
      { status: 500 }
    )
  }
}
