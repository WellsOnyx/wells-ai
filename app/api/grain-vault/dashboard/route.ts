// @ts-nocheck
/**
 * Grain & Vault Dashboard API
 * GET: Returns comprehensive dashboard data for authenticated user
 * POST: Perform dashboard actions (refresh, set preferences)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sqlQuery as sql } from '@/lib/db'

// Color scheme for transactions (accessibility-focused: blue/orange, not red/green)
const FLOW_COLORS = {
  income: '#2563eb',   // Blue for income
  expense: '#ea580c',  // Orange for expenses
  neutral: '#6b7280'   // Gray for neutral
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get display currency preference from query param or default
    const searchParams = req.nextUrl.searchParams
    const displayCurrency = searchParams.get('currency') || 'USD'

    // Fetch all dashboard data in parallel
    const [
      balancesResult,
      transactionsResult,
      networkResult,
      grainValueResult,
      currenciesResult
    ] = await Promise.all([
      // User balances from gv_user_balances
      sql`
        SELECT * FROM gv_user_balances WHERE user_id = ${userId}
      `,
      // Recent transactions
      sql`
        SELECT * FROM gv_transaction_history
        WHERE user_id = ${userId}
        LIMIT 50
      `,
      // Network stats (if they have referrals)
      sql`
        SELECT * FROM network_dashboard WHERE user_id = ${userId}
      `,
      // Current GRAIN value
      sql`SELECT gv_get_grain_value() as grain_value`,
      // Supported currencies
      sql`
        SELECT code, name, symbol, currency_type, decimal_places
        FROM gv_currencies WHERE is_active = true ORDER BY code
      `
    ])

    // Initialize user balance if doesn't exist
    let balances = balancesResult.rows[0]
    if (!balances) {
      await sql`
        INSERT INTO gv_user_balances (user_id) VALUES (${userId})
        ON CONFLICT (user_id) DO NOTHING
      `
      balances = {
        user_id: userId,
        usd_available: 0,
        usd_pending: 0,
        usd_total: 0,
        grain_quantity: 0,
        grain_cost_basis: 0,
        grain_current_value: 0,
        grain_appreciation: 0,
        credit_line_total: 0,
        credit_line_used: 0,
        credit_line_available: 0,
        network_earnings_total: 0,
        network_earnings_pending: 0,
        network_earnings_this_month: 0,
        display_currency: 'USD'
      }
    }

    const grainValue = parseFloat(grainValueResult.rows[0]?.grain_value || 1)
    const network = networkResult.rows[0]

    // Calculate portfolio metrics
    const portfolioValue =
      parseFloat(balances.usd_total || 0) +
      parseFloat(balances.grain_current_value || 0) -
      parseFloat(balances.credit_line_used || 0)

    // Group transactions by date
    const transactions = transactionsResult.rows
    const groupedTransactions: Record<string, typeof transactions> = {}
    transactions.forEach(tx => {
      const group = tx.date_group || 'Other'
      if (!groupedTransactions[group]) {
        groupedTransactions[group] = []
      }
      groupedTransactions[group].push({
        ...tx,
        amount: parseFloat(tx.amount),
        fee_amount: parseFloat(tx.fee_amount || 0),
        flowColor: FLOW_COLORS[tx.flow_direction as keyof typeof FLOW_COLORS] || FLOW_COLORS.neutral
      })
    })

    // Calculate daily change (mock for now - would need balance snapshots)
    const dailyChange = {
      amount: 0,
      percentage: 0,
      direction: 'neutral'
    }

    return NextResponse.json({
      success: true,

      // Core balances
      balances: {
        usd: {
          available: parseFloat(balances.usd_available || 0),
          pending: parseFloat(balances.usd_pending || 0),
          total: parseFloat(balances.usd_total || 0)
        },
        grain: {
          quantity: parseFloat(balances.grain_quantity || 0),
          unitPrice: grainValue,
          costBasis: parseFloat(balances.grain_cost_basis || 0),
          currentValue: parseFloat(balances.grain_quantity || 0) * grainValue,
          appreciation: parseFloat(balances.grain_appreciation || 0),
          appreciationPct: balances.grain_cost_basis > 0
            ? ((parseFloat(balances.grain_quantity || 0) * grainValue - parseFloat(balances.grain_cost_basis || 0)) / parseFloat(balances.grain_cost_basis || 0)) * 100
            : 0
        },
        creditLine: {
          total: parseFloat(balances.grain_quantity || 0) * grainValue, // 1:1 with GRAIN value
          used: parseFloat(balances.credit_line_used || 0),
          available: (parseFloat(balances.grain_quantity || 0) * grainValue) - parseFloat(balances.credit_line_used || 0),
          utilizationPct: balances.credit_line_total > 0
            ? (parseFloat(balances.credit_line_used || 0) / parseFloat(balances.credit_line_total || 0)) * 100
            : 0
        },
        portfolio: {
          totalValue: portfolioValue,
          dailyChange
        }
      },

      // Network earnings (MLM referrals)
      network: network ? {
        earnings: {
          total: parseFloat(network.total_earned || 0),
          thisMonth: parseFloat(network.monthly_earned || 0),
          pending: parseFloat(balances.network_earnings_pending || 0)
        },
        grain: {
          totalEarned: parseInt(network.total_grain_earned || 0),
          thisMonth: parseInt(network.monthly_grain_earned || 0)
        },
        size: {
          direct: parseInt(network.direct_referrals || 0),
          l2: parseInt(network.l2_network_size || 0),
          l3: parseInt(network.l3_network_size || 0),
          total: parseInt(network.total_network_size || 0)
        },
        referralCode: network.referral_code,
        tier: network.tier
      } : null,

      // Transaction history grouped by date
      transactions: {
        groups: Object.entries(groupedTransactions).map(([group, txs]) => ({
          label: group,
          transactions: txs.map(tx => ({
            id: tx.id,
            type: tx.type,
            status: tx.status,
            amount: tx.amount,
            currency: tx.currency,
            feeAmount: tx.fee_amount,
            counterparty: tx.counterparty_name,
            title: tx.display_title || tx.type,
            icon: tx.display_icon,
            category: tx.category,
            flowDirection: tx.flow_direction,
            flowColor: tx.flowColor,
            createdAt: tx.created_at,
            completedAt: tx.completed_at
          }))
        })),
        total: transactions.length
      },

      // Supported currencies for conversion
      currencies: currenciesResult.rows.map(c => ({
        code: c.code,
        name: c.name,
        symbol: c.symbol,
        type: c.currency_type,
        decimals: c.decimal_places
      })),

      // User preferences
      preferences: {
        displayCurrency: balances.display_currency || 'USD'
      },

      // UI configuration
      ui: {
        colors: FLOW_COLORS,
        grainSymbol: 'G',
        showCreditLine: parseFloat(balances.grain_quantity || 0) > 0,
        showNetwork: !!network
      },

      // Last updated
      updatedAt: balances.updated_at || new Date().toISOString()
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Failed to load dashboard' },
      { status: 500 }
    )
  }
}

// POST: Dashboard actions
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action, ...params } = body

    switch (action) {
      case 'set_display_currency': {
        const { currency } = params
        if (!currency) {
          return NextResponse.json({ error: 'Currency required' }, { status: 400 })
        }

        await sql`
          UPDATE gv_user_balances
          SET display_currency = ${currency}, updated_at = NOW()
          WHERE user_id = ${userId}
        `

        return NextResponse.json({ success: true, currency })
      }

      case 'refresh_balances': {
        // Recalculate balances from ledger (would query gv_ledger_entries)
        await sql`SELECT gv_update_user_balance(${userId})`
        return NextResponse.json({ success: true, message: 'Balances refreshed' })
      }

      case 'create_snapshot': {
        // Create a balance snapshot for reporting
        const balances = await sql`
          SELECT * FROM gv_user_balances WHERE user_id = ${userId}
        `

        if (balances.rows.length > 0) {
          const b = balances.rows[0]
          await sql`
            INSERT INTO gv_balance_snapshots (
              user_id, snapshot_date,
              usd_balance, grain_quantity, grain_value_usd,
              credit_used, network_earnings, total_portfolio_value
            ) VALUES (
              ${userId}, CURRENT_DATE,
              ${b.usd_total}, ${b.grain_quantity}, ${b.grain_current_value},
              ${b.credit_line_used}, ${b.network_earnings_total},
              ${parseFloat(b.usd_total) + parseFloat(b.grain_current_value) - parseFloat(b.credit_line_used)}
            )
            ON CONFLICT (user_id, snapshot_date) DO UPDATE SET
              usd_balance = EXCLUDED.usd_balance,
              grain_quantity = EXCLUDED.grain_quantity,
              grain_value_usd = EXCLUDED.grain_value_usd,
              credit_used = EXCLUDED.credit_used,
              network_earnings = EXCLUDED.network_earnings,
              total_portfolio_value = EXCLUDED.total_portfolio_value
          `
        }

        return NextResponse.json({ success: true, message: 'Snapshot created' })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Dashboard POST error:', error)
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    )
  }
}
