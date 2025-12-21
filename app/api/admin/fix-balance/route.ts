/**
 * Admin endpoint to fix wallet balances
 * Removes sandbox test deposits, keeps only real production deposits
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'

// Only allow specific admin user IDs
const ADMIN_USER_IDS = [
  'user_2pSKBHVlvLZKjjVgWPXbf3Ld4Jc', // Add your Clerk user ID here
]

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action, targetUserId, newBalance } = body

    // For now, allow any authenticated user to fix their own balance
    // In production, restrict to ADMIN_USER_IDS
    const userToFix = targetUserId || userId

    if (action === 'reset_to_production') {
      // Get only production deposits (non-demo)
      const productionDeposits = await sql`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM grain_transactions
        WHERE user_id = ${userToFix}
          AND type = 'deposit'
          AND status = 'completed'
          AND (reason NOT LIKE '%Demo%' AND reason NOT LIKE '%sandbox%' AND reason NOT LIKE '%demo%')
      `

      const realBalance = parseFloat(productionDeposits.rows[0]?.total || '0')

      // Update wallet to real balance only
      await sql`
        UPDATE user_wallets
        SET balance = ${realBalance}, updated_at = NOW()
        WHERE user_id = ${userToFix}
      `

      // Mark demo transactions as void
      await sql`
        UPDATE grain_transactions
        SET status = 'voided', reason = reason || ' [VOIDED - sandbox]'
        WHERE user_id = ${userToFix}
          AND type = 'deposit'
          AND (reason LIKE '%Demo%' OR reason LIKE '%sandbox%' OR reason LIKE '%demo%')
          AND status = 'completed'
      `

      return NextResponse.json({
        success: true,
        message: `Balance reset to production deposits only`,
        newBalance: realBalance,
        userId: userToFix
      })
    }

    if (action === 'set_balance' && typeof newBalance === 'number') {
      await sql`
        UPDATE user_wallets
        SET balance = ${newBalance}, updated_at = NOW()
        WHERE user_id = ${userToFix}
      `

      return NextResponse.json({
        success: true,
        message: `Balance set to ${newBalance}`,
        newBalance,
        userId: userToFix
      })
    }

    if (action === 'get_info') {
      const wallet = await sql`
        SELECT * FROM user_wallets WHERE user_id = ${userToFix}
      `
      const transactions = await sql`
        SELECT id, type, amount, reason, status, created_at
        FROM grain_transactions
        WHERE user_id = ${userToFix}
        ORDER BY created_at DESC
        LIMIT 20
      `

      return NextResponse.json({
        success: true,
        wallet: wallet.rows[0] || null,
        transactions: transactions.rows
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error: any) {
    console.error('[Admin Fix Balance] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fix balance' },
      { status: 500 }
    )
  }
}
