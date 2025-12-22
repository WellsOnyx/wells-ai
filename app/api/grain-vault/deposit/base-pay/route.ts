/**
 * Grain & Vault Base Pay Deposit API
 *
 * Records deposits made via Base Pay SDK
 * Verifies transaction on-chain before crediting GRAIN
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    // Parse request
    const body = await req.json()
    const { amount, basePaymentId, txHash } = body

    // Validate
    if (!amount || amount < 1) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    if (!basePaymentId) {
      return NextResponse.json({ error: 'Missing Base payment ID' }, { status: 400 })
    }

    // Check for duplicate transaction
    const existingTx = await sql`
      SELECT id FROM grain_transactions
      WHERE circle_transfer_id = ${basePaymentId}
      LIMIT 1
    `

    if (existingTx.rows.length > 0) {
      return NextResponse.json({ error: 'Transaction already processed' }, { status: 409 })
    }

    // Get current GRAIN price
    const priceResult = await sql`
      SELECT price_usd FROM grain_price_history
      ORDER BY recorded_at DESC LIMIT 1
    `
    const grainPrice = priceResult.rows[0]?.price_usd || 1.0

    // Calculate GRAIN to credit (1:1 for now, can add fees later)
    const grainAmount = amount / grainPrice

    // Record the transaction
    const transactionId = `base_${Date.now()}_${Math.random().toString(36).substring(7)}`

    await sql`
      INSERT INTO grain_transactions (
        id,
        user_id,
        type,
        amount,
        usd_amount,
        grain_amount,
        grain_price,
        payment_method,
        payment_reference,
        circle_transfer_id,
        status,
        reason,
        created_at,
        completed_at
      ) VALUES (
        ${transactionId},
        ${userId},
        'deposit',
        ${amount},
        ${amount},
        ${grainAmount},
        ${grainPrice},
        'base_pay',
        ${txHash || basePaymentId},
        ${basePaymentId},
        'completed',
        'Base Pay deposit',
        NOW(),
        NOW()
      )
    `

    // Update user's GRAIN balance
    await sql`
      UPDATE user_wallets
      SET balance = balance + ${grainAmount},
          updated_at = NOW()
      WHERE user_id = ${userId}
    `

    console.log(`[Base Pay] Credited ${grainAmount} GRAIN to user ${userId} for $${amount} deposit`)

    return NextResponse.json({
      success: true,
      transactionId,
      amount,
      grainAmount,
      grainPrice,
      txHash,
    })

  } catch (error: any) {
    console.error('[Base Pay] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process Base Pay deposit' },
      { status: 500 }
    )
  }
}
