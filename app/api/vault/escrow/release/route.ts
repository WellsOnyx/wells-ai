import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { calculateTransactionReward } from '@/lib/blockchain/grain-contract'

/**
 * POST /api/vault/escrow/release
 * Release funds from escrow to seller
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { escrowId, releaseType, reason } = await req.json()

    if (!escrowId || !releaseType) {
      return NextResponse.json(
        { error: 'Escrow ID and release type required' },
        { status: 400 }
      )
    }

    // Validate release type
    if (!['full', 'partial', 'refund'].includes(releaseType)) {
      return NextResponse.json(
        { error: 'Invalid release type. Use "full", "partial", or "refund"' },
        { status: 400 }
      )
    }

    // Mock escrow data
    const escrowAmount = 1000 // $1000 USDC
    const grainReward = calculateTransactionReward(escrowAmount)

    // Create release transaction (mock - will integrate with smart contract)
    const release = {
      id: `release_${Date.now()}`,
      escrowId,
      releaseType,
      amount: escrowAmount.toString(),
      recipient: releaseType === 'refund' ? userId : 'seller_user_id',
      reason: reason || `${releaseType} release`,
      approvedBy: [userId],
      txHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      releasedAt: new Date(),
      status: 'pending',
      grainReward: releaseType === 'full' ? grainReward : 0
    }

    return NextResponse.json({
      success: true,
      release,
      message: `Escrow release initiated. Transaction pending confirmation.`,
      rewards: releaseType === 'full' ? {
        grain: grainReward,
        message: `You earned ${grainReward} GRAIN for completing this transaction!`
      } : null
    })

  } catch (error: any) {
    console.error('[VAULT ESCROW RELEASE] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to release escrow' },
      { status: 500 }
    )
  }
}
