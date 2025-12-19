// @ts-nocheck
/**
 * Grain & Vault Admin Treasury API
 * Returns comprehensive treasury management data for administrators
 */

import { NextRequest, NextResponse } from 'next/server'
import { getMasterWalletBalance, getTreasuryStats } from '@/lib/grain-vault/circle-payments'
import { sqlQuery as sql } from '@/lib/db'

// APY Configuration (matches circle-payments.ts)
const WELLS_APY_RATE = 0.045 // 4.5% annual yield

export async function GET(req: NextRequest) {
  try {
    // In production, add admin authentication check here
    // const { userId } = await auth()
    // if (!isAdmin(userId)) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    // Quick timeout wrapper for database operations
    const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Database timeout')), ms)
      )
      return Promise.race([promise, timeout])
    }

    // Fetch treasury data with 8s timeout (to stay under Vercel's 10s limit)
    const [masterWallet, treasuryStats, largeTransactionsResult] = await withTimeout(
      Promise.all([
        getMasterWalletBalance().catch(() => ({
          usdcBalance: 0,
          totalUserLiabilities: 0,
          netPosition: 0,
          estimatedDailyYield: 0,
        })),
        getTreasuryStats().catch(() => ({
          totalAccounts: 0,
          totalDeposits: 0,
          totalWithdrawals: 0,
          totalUsdBalance: 0,
          totalGrainBalance: 0,
          estimatedAnnualYield: 0,
        })),
        // Get recent large transactions (over $1000)
        sql`
          SELECT
            gt.id,
            gt.account_id,
            ta.email,
            ta.full_name,
            gt.type,
            gt.usd_amount,
            gt.grain_amount,
            gt.grain_price,
            gt.fee_usd,
            gt.status,
            gt.description,
            gt.created_at,
            gt.completed_at
          FROM grain_transactions gt
          LEFT JOIN treasury_accounts ta ON gt.account_id = ta.id
          WHERE gt.usd_amount >= 1000
          ORDER BY gt.created_at DESC
          LIMIT 20
        `.catch(() => ({ rows: [] }))
      ]),
      8000
    )

    // Calculate estimated yields
    const estimatedDailyYield = (masterWallet.usdcBalance * WELLS_APY_RATE) / 365
    const estimatedAnnualYield = masterWallet.usdcBalance * WELLS_APY_RATE

    // Format large transactions
    const largeTransactions = largeTransactionsResult.rows.map(tx => ({
      id: tx.id,
      accountId: tx.account_id,
      email: tx.email,
      fullName: tx.full_name,
      type: tx.type,
      usdAmount: parseFloat(tx.usd_amount || '0'),
      grainAmount: tx.grain_amount ? parseFloat(tx.grain_amount) : null,
      grainPrice: tx.grain_price ? parseFloat(tx.grain_price) : null,
      fee: tx.fee_usd ? parseFloat(tx.fee_usd) : null,
      status: tx.status,
      description: tx.description,
      createdAt: tx.created_at,
      completedAt: tx.completed_at
    }))

    return NextResponse.json({
      success: true,
      treasury: {
        // Master Wallet (Circle)
        masterWallet: {
          usdcBalance: masterWallet.usdcBalance,
          totalUserLiabilities: masterWallet.totalUserLiabilities,
          netPosition: masterWallet.netPosition,
        },

        // Yield Estimates
        yields: {
          apyRate: WELLS_APY_RATE,
          apyPercentage: WELLS_APY_RATE * 100,
          estimatedDailyYield,
          estimatedAnnualYield,
        },

        // Account Statistics
        stats: {
          totalAccounts: treasuryStats.totalAccounts,
          totalUsdBalance: treasuryStats.totalUsdBalance,
          totalGrainBalance: treasuryStats.totalGrainBalance,
        },

        // Lifetime Volume
        volume: {
          totalDeposits: treasuryStats.totalDeposits,
          totalWithdrawals: treasuryStats.totalWithdrawals,
          netFlow: treasuryStats.totalDeposits - treasuryStats.totalWithdrawals,
        },

        // Large Transactions
        largeTransactions,
      },

      updatedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Treasury API error:', error)
    return NextResponse.json(
      { error: 'Failed to load treasury data', details: error.message },
      { status: 500 }
    )
  }
}
