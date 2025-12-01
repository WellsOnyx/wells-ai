/**
 * GET /api/analytics/grain
 *
 * Grain & Vault specific analytics dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { GrainToken, PriceOracle, fromGRAIN, fromUSDC } from '@/lib/blockchain/contracts'
import { query } from '@/lib/db'
import { getVolume24h } from '@/lib/blockchain/cache'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Blockchain data
    const [totalSupplyRaw, totalAssetsRaw] = await Promise.all([
      GrainToken.totalSupply(),
      PriceOracle.getTotalAssets(),
    ])

    const totalGRAINSupply = fromGRAIN(totalSupplyRaw)
    const totalVaultAssets = fromUSDC(totalAssetsRaw)

    // Database analytics
    const [investorCount, vaultStats, escrowStats, recentActivity] = await Promise.all([
      // Total investors
      query('SELECT COUNT(*) as count FROM founding_investors'),

      // Vault statistics
      query(`
        SELECT
          COUNT(*) as total_transactions,
          SUM(CASE WHEN type = 'deposit' THEN usdc_amount ELSE 0 END) as total_deposits,
          SUM(CASE WHEN type = 'withdrawal' THEN usdc_amount ELSE 0 END) as total_withdrawals,
          SUM(fee) as total_fees
        FROM vault_transactions
        WHERE status = 'completed'
      `),

      // Escrow statistics
      query(`
        SELECT
          COUNT(*) as total_escrows,
          SUM(amount) as total_escrowed_value,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_escrows,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_escrows
        FROM escrows
      `),

      // Recent activity (last 7 days)
      query(`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as tx_count,
          SUM(usdc_amount) as daily_volume
        FROM vault_transactions
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `),
    ])

    const totalInvestors = parseInt(investorCount.rows[0]?.count || '0')
    const vault = vaultStats.rows[0]
    const escrow = escrowStats.rows[0]

    // Calculate total invested
    const investmentTotal = await query(
      'SELECT SUM(investment_amount) as total FROM founding_investors'
    )
    const totalInvested = parseFloat(investmentTotal.rows[0]?.total || '0')

    // Get 24h volume from cache
    const dailyVolume = await getVolume24h()

    // Calculate 30-day volume
    const monthlyVolumeResult = await query(`
      SELECT SUM(usdc_amount) as total
      FROM vault_transactions
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `)
    const monthlyVolume = parseFloat(monthlyVolumeResult.rows[0]?.total || '0')

    // User growth (new investors per week)
    const userGrowth = await query(`
      SELECT
        DATE_TRUNC('week', created_at) as week,
        COUNT(*) as new_users
      FROM founding_investors
      GROUP BY week
      ORDER BY week DESC
      LIMIT 12
    `)

    return NextResponse.json({
      overview: {
        totalUsers: totalInvestors,
        totalInvested: Math.floor(totalInvested),
        totalGRAINSupply: Math.floor(totalGRAINSupply),
        totalVaultAssets: Math.floor(totalVaultAssets),
        avgInvestment: totalInvestors > 0 ? Math.floor(totalInvested / totalInvestors) : 0,
        dailyVolume: Math.floor(dailyVolume),
        monthlyVolume: Math.floor(monthlyVolume),
      },
      vault: {
        totalTransactions: parseInt(vault?.total_transactions || '0'),
        totalDeposits: parseFloat(vault?.total_deposits || '0'),
        totalWithdrawals: parseFloat(vault?.total_withdrawals || '0'),
        totalFees: parseFloat(vault?.total_fees || '0'),
        netFlow: parseFloat(vault?.total_deposits || '0') - parseFloat(vault?.total_withdrawals || '0'),
      },
      escrow: {
        totalEscrows: parseInt(escrow?.total_escrows || '0'),
        totalValue: parseFloat(escrow?.total_escrowed_value || '0'),
        activeEscrows: parseInt(escrow?.active_escrows || '0'),
        completedEscrows: parseInt(escrow?.completed_escrows || '0'),
        completionRate:
          parseInt(escrow?.total_escrows || '0') > 0
            ? (parseInt(escrow?.completed_escrows || '0') / parseInt(escrow?.total_escrows || '0')) * 100
            : 0,
      },
      activity: {
        last7Days: recentActivity.rows.map((day) => ({
          date: day.date,
          transactions: parseInt(day.tx_count),
          volume: parseFloat(day.daily_volume || '0'),
        })),
      },
      growth: {
        weeklyNewUsers: userGrowth.rows.map((week) => ({
          week: week.week,
          newUsers: parseInt(week.new_users),
        })),
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[API] Analytics error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
