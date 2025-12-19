// @ts-nocheck
/**
 * Deposit API
 * POST: Deposit USD and optionally convert to GRAIN
 * SECURITY: Requires authentication and account ownership verification
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sqlQuery as sql } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Require authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    const {
      amount,
      payment_method,
      payment_reference,
      auto_convert_to_grain
    } = body

    // Validation
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    // SECURITY: Get account by authenticated user ID only - no email/wallet_address lookup
    const accountQuery = sql`SELECT * FROM treasury_accounts WHERE clerk_user_id = ${userId}`

    const accountResult = await accountQuery
    if (accountResult.rows.length === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const account = accountResult.rows[0]

    // Check limits
    const depositLimit = parseFloat(account.daily_deposit_limit)
    if (amount > depositLimit) {
      return NextResponse.json(
        { error: `Deposit exceeds daily limit of $${depositLimit}` },
        { status: 400 }
      )
    }

    // Get current GRAIN price
    const priceData = await sql`SELECT * FROM get_grain_price()`
    const currentPrice = parseFloat(priceData.rows[0]?.price_usd || 1)

    // Create deposit transaction
    const depositTx = await sql`
      INSERT INTO grain_transactions (
        account_id,
        type,
        usd_amount,
        grain_price,
        payment_method,
        payment_reference,
        status,
        description
      ) VALUES (
        ${account.id},
        'deposit',
        ${amount},
        ${currentPrice},
        ${payment_method || 'bank_transfer'},
        ${payment_reference || null},
        'completed',
        ${`Deposited $${amount} via ${payment_method || 'bank transfer'}`}
      )
      RETURNING id
    `

    const depositId = depositTx.rows[0].id

    // If auto-convert to GRAIN, create buy transaction
    let buyTxId = null
    let grainAmount = 0

    if (auto_convert_to_grain) {
      grainAmount = amount / currentPrice

      const buyTx = await sql`
        INSERT INTO grain_transactions (
          account_id,
          type,
          usd_amount,
          grain_amount,
          grain_price,
          status,
          description
        ) VALUES (
          ${account.id},
          'buy_grain',
          ${amount},
          ${grainAmount},
          ${currentPrice},
          'completed',
          ${`Converted $${amount} to ${grainAmount.toFixed(6)} GRAIN @ $${currentPrice.toFixed(4)}`}
        )
        RETURNING id
      `

      buyTxId = buyTx.rows[0].id
    }

    return NextResponse.json({
      success: true,
      deposit: {
        transaction_id: depositId,
        amount_usd: amount,
        status: 'completed'
      },
      conversion: auto_convert_to_grain ? {
        transaction_id: buyTxId,
        grain_amount: grainAmount,
        grain_price: currentPrice,
        total_cost_usd: amount
      } : null
    })
  } catch (error) {
    console.error('Deposit error:', error)
    return NextResponse.json(
      { error: 'Failed to process deposit' },
      { status: 500 }
    )
  }
}
