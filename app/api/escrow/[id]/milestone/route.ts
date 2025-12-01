/**
 * POST /api/escrow/:id/milestone
 *
 * Mark milestone as complete and trigger automatic release
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Escrow } from '@/lib/blockchain/contracts'
import { query } from '@/lib/db'

const MilestoneSchema = z.object({
  milestoneIndex: z.number().int().min(0),
  completedBy: z.string(), // Address of who marked it complete
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const data = MilestoneSchema.parse(body)

    // Get escrow details
    const escrowResult = await query(
      'SELECT * FROM escrows WHERE escrow_id = $1',
      [id]
    )

    if (escrowResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Escrow not found' },
        { status: 404 }
      )
    }

    const escrow = escrowResult.rows[0]
    const milestones = JSON.parse(escrow.milestones)

    // Validate milestone index
    if (data.milestoneIndex >= milestones.length) {
      return NextResponse.json(
        { error: 'Invalid milestone index' },
        { status: 400 }
      )
    }

    // Check authorization (only buyer or seller can mark complete)
    const isAuthorized =
      data.completedBy.toLowerCase() === escrow.buyer.toLowerCase() ||
      data.completedBy.toLowerCase() === escrow.seller.toLowerCase()

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized. Only buyer or seller can complete milestones.' },
        { status: 403 }
      )
    }

    // Complete milestone on blockchain
    let txHash: string
    try {
      txHash = await Escrow.completeMilestone(BigInt(id), BigInt(data.milestoneIndex))
    } catch (txError) {
      console.error('[Escrow] Milestone completion failed:', txError)
      return NextResponse.json(
        {
          error: 'Milestone completion failed',
          message: txError instanceof Error ? txError.message : 'Unknown error',
        },
        { status: 500 }
      )
    }

    // Calculate amount released
    const milestone = milestones[data.milestoneIndex]
    const amountReleased = (escrow.amount * milestone.percentage) / 100

    // Store transaction
    await query(
      `INSERT INTO escrow_transactions (
        escrow_id, type, milestone_index, amount, tx_hash,
        completed_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [id, 'milestone_complete', data.milestoneIndex, amountReleased, txHash, data.completedBy.toLowerCase()]
    )

    // Check if all milestones complete
    const nextMilestone = data.milestoneIndex + 1
    const allComplete = nextMilestone >= milestones.length

    if (allComplete) {
      await query(
        'UPDATE escrows SET status = $1, completed_at = NOW() WHERE escrow_id = $2',
        ['completed', id]
      )
    }

    // Send notifications
    await sendMilestoneNotification(escrow.seller, escrow.buyer, {
      escrowId: id,
      milestoneName: milestone.name,
      milestoneIndex: data.milestoneIndex,
      amountReleased,
      txHash,
      allComplete,
    })

    return NextResponse.json({
      success: true,
      milestone: {
        index: data.milestoneIndex,
        name: milestone.name,
        percentage: milestone.percentage,
        amountReleased,
        txHash,
      },
      escrow: {
        id,
        currentMilestone: nextMilestone,
        totalMilestones: milestones.length,
        status: allComplete ? 'completed' : 'active',
      },
      message: allComplete
        ? 'All milestones completed! Escrow is now complete.'
        : `Milestone ${data.milestoneIndex + 1} completed. Funds released to seller.`,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('[API] Milestone completion error:', error)
    return NextResponse.json(
      {
        error: 'Failed to complete milestone',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Send milestone notification
 */
async function sendMilestoneNotification(
  seller: string,
  buyer: string,
  details: {
    escrowId: string
    milestoneName: string
    milestoneIndex: number
    amountReleased: number
    txHash: string
    allComplete: boolean
  }
) {
  console.log('[Escrow] Milestone notification:', details)
  // TODO: Implement actual notifications
}
