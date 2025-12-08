// @ts-nocheck
/**
 * Withdraw API
 * POST: Sell GRAIN and/or withdraw USD
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      email,
      wallet_address,
      amount_usd,
      grain_amount,
      destination_method,
      destination_reference
    } = body

    // Must specify either USD amount or GRAIN amount
    if (!amount_usd && !grain_amount) {
      return NextResponse.json(
        { error: 'Must specify either amount_usd or grain_amount' },
        { status: 400 }
      )
    }

    if (!email && !wallet_address) {
      return NextResponse.json(
        { error: 'Email or wallet address required' },
        { status: 400 }
      )
    }

    // Get account
    let accountQuery
    if (wallet_address) {
      accountQuery = sql`SELECT * FROM treasury_accounts WHERE wallet_address = ${wallet_address}`
    } else {
      accountQuery = sql`SELECT * FROM treasury_accounts WHERE email = ${email}`
    }

    const accountResult = await accountQuery
    if (accountResult.rows.length === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const account = accountResult.rows[0]

    // Get current GRAIN price
    const priceData = await sql`SELECT * FROM get_grain_price()`
    const currentPrice = parseFloat(priceData.rows[0]?.price_usd || 1)

    let finalUsdAmount = amount_usd || 0
    let finalGrainAmount = grain_amount || 0
    let sellTxId = null

    // If withdrawing GRAIN, sell it first
    if (grain_amount) {
      const grainBalance = parseFloat(account.grain_balance)

      if (grain_amount > grainBalance) {
        return NextResponse.json(
          { error: `Insufficient GRAIN balance. Available: ${grainBalance}` },
          { status: 400 }
        )
      }

      finalUsdAmount = grain_amount * currentPrice

      // Create sell transaction
      const sellTx = await sql`
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
          'sell_grain',
          ${finalUsdAmount},
          ${grain_amount},
          ${currentPrice},
          'completed',
          ${`Sold ${grain_amount.toFixed(6)} GRAIN @ $${currentPrice.toFixed(4)} = $${finalUsdAmount.toFixed(2)}`}
        )
        RETURNING id
      `

      sellTxId = sellTx.rows[0].id
    }

    // Check withdrawal limits
    const withdrawLimit = parseFloat(account.daily_withdraw_limit)
    if (finalUsdAmount > withdrawLimit) {
      return NextResponse.json(
        { error: `Withdrawal exceeds daily limit of $${withdrawLimit}` },
        { status: 400 }
      )
    }

    // Check USD balance (after sell if applicable)
    const currentUsdBalance = parseFloat(account.usd_balance) + (sellTxId ? finalUsdAmount : 0)
    if (finalUsdAmount > currentUsdBalance) {
      return NextResponse.json(
        { error: `Insufficient USD balance. Available: $${currentUsdBalance.toFixed(2)}` },
        { status: 400 }
      )
    }

    // Create withdrawal transaction
    const fee = finalUsdAmount * 0.001 // 0.1% withdrawal fee
    const netAmount = finalUsdAmount - fee

    const withdrawTx = await sql`
      INSERT INTO grain_transactions (
        account_id,
        type,
        usd_amount,
        grain_price,
        fee_usd,
        payment_method,
        payment_reference,
        status,
        description
      ) VALUES (
        ${account.id},
        'withdraw',
        ${finalUsdAmount},
        ${currentPrice},
        ${fee},
        ${destination_method || 'bank_transfer'},
        ${destination_reference || null},
        'processing',
        ${`Withdrawing $${netAmount.toFixed(2)} (fee: $${fee.toFixed(2)}) via ${destination_method || 'bank transfer'}`}
      )
      RETURNING id
    `

    return NextResponse.json({
      success: true,
      withdrawal: {
        transaction_id: withdrawTx.rows[0].id,
        gross_amount: finalUsdAmount,
        fee: fee,
        net_amount: netAmount,
        status: 'processing',
        estimated_completion: '1-2 business days'
      },
      grain_sale: sellTxId ? {
        transaction_id: sellTxId,
        grain_amount: finalGrainAmount,
        grain_price: currentPrice,
        usd_received: finalUsdAmount
      } : null
    })
  } catch (error) {
    console.error('Withdraw error:', error)
    return NextResponse.json(
      { error: 'Failed to process withdrawal' },
      { status: 500 }
    )
  }
}
