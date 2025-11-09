import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { calculateStakingReward } from '@/lib/blockchain/grain-contract'

/**
 * POST /api/grain/stake
 * Stake GRAIN tokens for rewards
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { amount, action } = await req.json()

    if (!amount || !action) {
      return NextResponse.json(
        { error: 'Amount and action (stake/unstake) required' },
        { status: 400 }
      )
    }

    // Validate action
    if (!['stake', 'unstake'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use "stake" or "unstake"' },
        { status: 400 }
      )
    }

    // Mock staking transaction (will be replaced with actual smart contract call)
    const transaction = {
      id: `grain_stake_${Date.now()}`,
      userId,
      type: action,
      amount: amount.toString(),
      reason: action === 'stake' ? 'Staked for 12% APY' : 'Unstaked GRAIN',
      txHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      timestamp: new Date(),
      status: 'pending',
      estimatedRewards: action === 'stake' ? calculateStakingReward(parseFloat(amount), 365) : 0
    }

    // Simulate blockchain confirmation delay
    setTimeout(() => {
      transaction.status = 'confirmed'
    }, 3000)

    return NextResponse.json({
      success: true,
      transaction,
      message: action === 'stake'
        ? `Successfully staked ${amount} GRAIN. Earning 12% APY!`
        : `Successfully unstaked ${amount} GRAIN`,
      newBalance: {
        available: action === 'stake' ? '250.50' : '6250.50',
        staked: action === 'stake' ? '6000.00' : '4000.00'
      }
    })

  } catch (error: any) {
    console.error('[GRAIN STAKE] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process staking transaction' },
      { status: 500 }
    )
  }
}
