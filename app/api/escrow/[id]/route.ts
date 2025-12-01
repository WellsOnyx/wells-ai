/**
 * GET /api/escrow/:id
 *
 * Get escrow details and current status
 */

import { NextRequest, NextResponse } from 'next/server'
import { Escrow, fromUSDC, fromGRAIN } from '@/lib/blockchain/contracts'
import { query } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Get from database first
    const result = await query(
      `SELECT * FROM escrows WHERE escrow_id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Escrow not found' },
        { status: 404 }
      )
    }

    const escrowData = result.rows[0]

    // Get on-chain details
    const onChainDetails = await Escrow.getEscrowDetails(BigInt(id))

    // Parse milestone data
    const milestones = JSON.parse(escrowData.milestones)

    // Calculate released amount
    const currentMilestone = Number(onChainDetails.currentMilestone)
    const releasedPercentage = milestones
      .slice(0, currentMilestone)
      .reduce((sum: number, m: any) => sum + m.percentage, 0)
    const releasedAmount = (escrowData.amount * releasedPercentage) / 100

    // Map status
    const statusMap: Record<number, string> = {
      0: 'active',
      1: 'completed',
      2: 'disputed',
      3: 'cancelled',
    }

    const status = statusMap[Number(onChainDetails.status)] || 'unknown'

    // Get transaction history
    const txHistory = await query(
      `SELECT * FROM escrow_transactions
       WHERE escrow_id = $1
       ORDER BY created_at DESC`,
      [id]
    )

    return NextResponse.json({
      escrow: {
        id,
        seller: escrowData.seller,
        buyer: escrowData.buyer,
        amount: escrowData.amount,
        currency: escrowData.currency,
        milestones: milestones.map((m: any, index: number) => ({
          ...m,
          index,
          completed: index < currentMilestone,
          isCurrent: index === currentMilestone,
        })),
        currentMilestone,
        totalMilestones: milestones.length,
        releasedAmount,
        remainingAmount: escrowData.amount - releasedAmount,
        status,
        deadline: escrowData.deadline,
        createdAt: escrowData.created_at,
        onChain: {
          currency: onChainDetails.currency,
          createdAt: new Date(Number(onChainDetails.createdAt) * 1000).toISOString(),
          deadline: new Date(Number(onChainDetails.deadline) * 1000).toISOString(),
        },
      },
      transactions: txHistory.rows.map((tx) => ({
        type: tx.type,
        milestone: tx.milestone_index,
        amount: tx.amount,
        txHash: tx.tx_hash,
        timestamp: tx.created_at,
      })),
    })
  } catch (error) {
    console.error('[API] Error fetching escrow:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch escrow details',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
