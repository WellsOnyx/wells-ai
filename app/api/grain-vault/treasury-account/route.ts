// @ts-nocheck
/**
 * Treasury Account API
 * GET: Get full account data for dashboard by email
 * Fetches from treasury_accounts table (consumer flow)
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter required' },
        { status: 400 }
      )
    }

    // Get account from treasury_accounts
    const accountResult = await sql`
      SELECT
        id,
        email,
        phone,
        full_name,
        wallet_address,
        status,
        verification_level,
        daily_deposit_limit,
        daily_withdraw_limit,
        lifetime_deposit_limit,
        usd_balance,
        grain_balance,
        created_at
      FROM treasury_accounts
      WHERE email = ${email}
    `

    if (accountResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      )
    }

    const account = accountResult.rows[0]

    // Get current GRAIN price
    let currentPrice = 1.0
    let change24h = 0
    try {
      const priceResult = await sql`SELECT * FROM get_grain_price()`
      if (priceResult.rows.length > 0) {
        currentPrice = parseFloat(priceResult.rows[0].price_usd) || 1.0
        change24h = parseFloat(priceResult.rows[0].change_24h) || 0
      }
    } catch (e) {
      // If get_grain_price() doesn't exist, use default
      console.log('Using default GRAIN price')
    }

    // Get recent transactions
    const transactionsResult = await sql`
      SELECT
        id,
        type,
        amount,
        grain_amount,
        grain_price_at_time,
        status,
        created_at
      FROM grain_transactions
      WHERE account_id = ${account.id}
      ORDER BY created_at DESC
      LIMIT 10
    `

    // Calculate GRAIN metrics
    const usdBalance = parseFloat(account.usd_balance || 0)
    const grainBalance = parseFloat(account.grain_balance || 0)
    const grainValue = grainBalance * currentPrice

    // Calculate average purchase price and unrealized gain
    let avgPurchasePrice = currentPrice
    let costBasis = grainBalance * currentPrice

    const purchaseTxns = transactionsResult.rows.filter(t =>
      t.type === 'convert_usd_to_grain' && t.grain_price_at_time
    )

    if (purchaseTxns.length > 0) {
      const totalGrainPurchased = purchaseTxns.reduce((sum, t) =>
        sum + parseFloat(t.grain_amount || 0), 0
      )
      const totalCost = purchaseTxns.reduce((sum, t) =>
        sum + (parseFloat(t.grain_amount || 0) * parseFloat(t.grain_price_at_time || 1)), 0
      )

      if (totalGrainPurchased > 0) {
        avgPurchasePrice = totalCost / totalGrainPurchased
        costBasis = grainBalance * avgPurchasePrice
      }
    }

    const unrealizedGain = grainValue - costBasis
    const unrealizedGainPct = costBasis > 0 ? (unrealizedGain / costBasis) * 100 : 0
    const totalPortfolioValue = usdBalance + grainValue

    // Format transactions for dashboard
    const recentTransactions = transactionsResult.rows.map(t => ({
      id: t.id,
      type: t.type,
      amount: parseFloat(t.amount || 0),
      grain_amount: parseFloat(t.grain_amount || 0),
      price_at_time: parseFloat(t.grain_price_at_time || currentPrice),
      status: t.status,
      created_at: t.created_at
    }))

    return NextResponse.json({
      account: {
        id: account.id,
        email: account.email,
        full_name: account.full_name,
        wallet_address: account.wallet_address,
        status: account.status,
        verification_level: account.verification_level
      },
      balances: {
        usd: usdBalance,
        grain: {
          quantity: grainBalance,
          current_price: currentPrice,
          current_value: grainValue,
          avg_purchase_price: avgPurchasePrice,
          cost_basis: costBasis,
          unrealized_gain: unrealizedGain,
          unrealized_gain_pct: unrealizedGainPct
        },
        portfolio: {
          total_value: totalPortfolioValue,
          allocation: {
            usd_pct: totalPortfolioValue > 0 ? (usdBalance / totalPortfolioValue) * 100 : 50,
            grain_pct: totalPortfolioValue > 0 ? (grainValue / totalPortfolioValue) * 100 : 50
          }
        }
      },
      limits: {
        daily_deposit: parseFloat(account.daily_deposit_limit || 1000),
        daily_withdraw: parseFloat(account.daily_withdraw_limit || 1000)
      },
      recent_transactions: recentTransactions
    })
  } catch (error) {
    console.error('Treasury account API error:', error)
    return NextResponse.json(
      { error: 'Failed to load account data' },
      { status: 500 }
    )
  }
}
