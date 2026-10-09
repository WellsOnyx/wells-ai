// @ts-nocheck
/**
 * GRAIN User Profile API
 *
 * GET /api/grain/profile - Get user's GRAIN profile and balances
 *
 * Returns complete financial profile including:
 * - GRAIN balance
 * - USDC balance
 * - Credit line status
 * - Transaction limits
 * - KYC level
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { grainRail } from '@/lib/payments/grain-rail'
import { unifiedUser } from '@/lib/identity/unified-user'
import { neon } from '@neondatabase/serverless'

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

export const runtime = 'nodejs'

/**
 * GET - Get user's GRAIN profile
 */
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get unified user identity
    const user = await unifiedUser.get(clerkUserId)

    if (!user) {
      // User doesn't exist yet - create them
      const newUser = await unifiedUser.createOrLink({
        email: '', // Will be filled from Clerk
        clerkUserId,
        source: 'wellsai',
      })
      return NextResponse.json({
        profile: {
          ...newUser,
          isNew: true,
        },
        grainPrice: (await grainRail.getPrice()).price,
        message: 'New account created. Fund your GRAIN wallet to get started.',
      })
    }

    // Get current GRAIN price
    const { price, usdcBacking, assetValue, totalSupply, backingRatio } = await grainRail.getPrice()

    // Calculate user's total value in USD
    const grainValueUsd = user.grainBalance * price
    const totalValueUsd = grainValueUsd + user.usdcBalance

    // Get recent transaction count
    let recentTransactions = 0
    let totalVolume = 0

    if (sql) {
      const [stats] = await sql`
        SELECT
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as volume
        FROM unified_transactions
        WHERE user_id = ${user.unifiedId}
          AND created_at > NOW() - INTERVAL '30 days'
          AND status = 'completed'
      `
      recentTransactions = parseInt(stats?.count || '0')
      totalVolume = parseFloat(stats?.volume || '0')
    }

    // Calculate credit tier if not set
    let creditRecommendation = null
    if (user.creditTier === 'none' && recentTransactions >= 3) {
      creditRecommendation = await unifiedUser.calculateCreditTier(user.unifiedId)
    }

    // Get active escrows
    let activeEscrows: any[] = []
    if (sql) {
      const escrows = await sql`
        SELECT
          id,
          grain_amount,
          grain_price_at_lock,
          usd_equivalent_at_lock,
          status,
          reference,
          created_at
        FROM grain_escrows
        WHERE (from_user_id = ${user.unifiedId} OR to_user_id = ${user.unifiedId})
          AND status IN ('locked', 'partial')
        ORDER BY created_at DESC
        LIMIT 10
      `

      activeEscrows = escrows.map((e: any) => ({
        id: e.id,
        grainAmount: parseFloat(e.grain_amount),
        grainPriceAtLock: parseFloat(e.grain_price_at_lock),
        usdAtLock: parseFloat(e.usd_equivalent_at_lock),
        currentValue: parseFloat(e.grain_amount) * price,
        appreciation: (parseFloat(e.grain_amount) * price) - parseFloat(e.usd_equivalent_at_lock),
        status: e.status,
        reference: e.reference,
        createdAt: e.created_at,
      }))
    }

    return NextResponse.json({
      profile: {
        userId: user.unifiedId,
        clerkUserId: user.clerkUserId,
        treasuryAccountId: user.treasuryAccountId,
        email: user.email,
        name: user.name,
        company: user.company,
      },
      balances: {
        grain: user.grainBalance,
        grainValueUsd,
        usdc: user.usdcBalance,
        locked: user.lockedBalance,
        totalValueUsd,
      },
      credit: {
        tier: user.creditTier,
        limit: user.creditLimit,
        used: user.creditUsed,
        available: user.creditAvailable,
        apr: user.creditApr,
        canUseCredit: user.creditTier !== 'none',
      },
      verification: {
        kycLevel: user.kycLevel,
        canWithdraw: user.kycLevel !== 'none' && user.kycLevel !== 'basic',
        canUseCredit: user.kycLevel === 'verified' || user.kycLevel === 'enhanced',
      },
      limits: {
        daily: user.dailyLimit,
        monthly: user.monthlyLimit,
      },
      activity: {
        recentTransactions,
        totalVolume,
      },
      escrows: {
        active: activeEscrows,
        totalLocked: activeEscrows.reduce((sum, e) => sum + e.grainAmount, 0),
        totalCurrentValue: activeEscrows.reduce((sum, e) => sum + e.currentValue, 0),
      },
      grain: {
        price,
        priceFormatted: `$${price.toFixed(4)}`,
        treasuryBacking: usdcBacking + assetValue,
        totalSupply,
        backingRatio,
        isFullyBacked: backingRatio >= 1.0,
      },
      creditRecommendation,
      status: {
        isActive: user.isActive,
        isFlagged: user.isFlagged,
        createdAt: user.createdAt,
        lastActivityAt: user.lastActivityAt,
      },
    })

  } catch (error: any) {
    console.error('[GRAIN Profile] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get profile', details: error.message },
      { status: 500 }
    )
  }
}
