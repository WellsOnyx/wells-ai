import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * GET /api/grain/balance
 * Get user's GRAIN token balance
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Mock GRAIN balance (will be replaced with actual blockchain queries)
    const balance = {
      userId,
      available: '1250.50',
      staked: '5000.00',
      pending: '25.75',
      totalEarned: '8500.25',
      totalSpent: '2224.00',
      transactions: [
        {
          id: 'grain_1',
          type: 'earn',
          amount: '50.0',
          reason: 'Transaction completed: RFQ #1234',
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'confirmed'
        },
        {
          id: 'grain_2',
          type: 'earn',
          amount: '100.0',
          reason: 'Referral bonus: User signed up',
          timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'confirmed'
        },
        {
          id: 'grain_3',
          type: 'stake',
          amount: '1000.0',
          reason: 'Staked for 12% APY',
          timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'confirmed'
        }
      ],
      rewardRates: {
        transactionComplete: 0.1,
        referralBonus: 100,
        liquidityProvision: 0.05,
        dailyActive: 1
      },
      stakingAPY: 12,
      governanceRights: true,
      feeDiscount: 6.25 // 6.25% discount on platform fees
    }

    return NextResponse.json(balance)

  } catch (error: any) {
    console.error('[GRAIN BALANCE] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch GRAIN balance' },
      { status: 500 }
    )
  }
}
