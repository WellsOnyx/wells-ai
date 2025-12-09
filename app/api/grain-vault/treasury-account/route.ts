// @ts-nocheck
/**
 * Treasury Account API
 * GET: Get full account data for dashboard by email
 * Fetches from treasury_accounts table (consumer flow)
 */

import { NextRequest, NextResponse } from 'next/server'
import { sqlQuery as sql } from '@/lib/db'

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

    // Get current GRAIN price - try multiple methods
    let currentPrice = 1.0
    let change24h = 0
    try {
      // Try grain_calculate_price first (actual function name)
      const priceResult = await sql`SELECT grain_calculate_price() as price`
      if (priceResult.rows.length > 0 && priceResult.rows[0].price) {
        currentPrice = parseFloat(priceResult.rows[0].price) || 1.0
      }
    } catch (e) {
      // Try getting latest from grain_price_history
      try {
        const historyResult = await sql`
          SELECT price_usd FROM grain_price_history
          ORDER BY recorded_at DESC LIMIT 1
        `
        if (historyResult.rows.length > 0) {
          currentPrice = parseFloat(historyResult.rows[0].price_usd) || 1.0
        }
      } catch (e2) {
        console.log('Using default GRAIN price')
      }
    }

    // Get recent transactions using actual column names
    let transactionsResult = { rows: [] }
    try {
      transactionsResult = await sql`
        SELECT
          id,
          tx_type as type,
          usd_value as amount,
          grain_amount,
          grain_price as grain_price_at_time,
          status,
          created_at
        FROM grain_transactions
        WHERE from_wallet_id = ${account.wallet_address}
           OR to_wallet_id = ${account.wallet_address}
        ORDER BY created_at DESC
        LIMIT 10
      `
    } catch (e) {
      console.log('Could not fetch transactions:', e.message)
    }

    // Calculate GRAIN metrics
    const usdBalance = parseFloat(account.usd_balance || 0)
    const grainBalance = parseFloat(account.grain_balance || 0)
    const grainValue = grainBalance * currentPrice

    // Calculate average purchase price and unrealized gain
    let avgPurchasePrice = parseFloat(account.average_purchase_price || 0) || currentPrice
    let costBasis = grainBalance * avgPurchasePrice

    // Try to calculate from transactions if no stored average
    if (!account.average_purchase_price && transactionsResult.rows.length > 0) {
      const purchaseTxns = transactionsResult.rows.filter(t =>
        (t.type === 'deposit' || t.type === 'buy') && t.grain_price_at_time
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
