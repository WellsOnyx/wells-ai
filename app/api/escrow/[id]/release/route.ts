// @ts-nocheck
/**
 * POST /api/escrow/[id]/release
 *
 * Release escrow funds to seller
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { releaseEscrow, getEscrow } from '@/lib/escrow/escrow-service'
import { ReleaseEscrowRequest, ReleaseEscrowResponse } from '@/lib/escrow/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: escrowId } = await params

    // Get escrow to validate buyer (only buyer can release)
    const escrow = await getEscrow(escrowId)

    if (escrow.buyerId !== userId) {
      return NextResponse.json(
        { error: 'Only the buyer can release escrow funds' },
        { status: 403 }
      )
    }

    if (escrow.status !== 'funded') {
      return NextResponse.json(
        { error: `Cannot release escrow with status: ${escrow.status}` },
        { status: 400 }
      )
    }

    if (!escrow.sellerWalletAddress) {
      return NextResponse.json(
        { error: 'Seller wallet address not set. Seller must complete setup.' },
        { status: 400 }
      )
    }

    const body = (await request.json()) as ReleaseEscrowRequest

    // Validate milestone release if specified
    if (body.milestoneId) {
      const milestone = escrow.milestones.find(m => m.id === body.milestoneId)
      if (!milestone) {
        return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
      }
      if (milestone.status !== 'approved') {
        return NextResponse.json(
          { error: 'Milestone must be approved before release' },
          { status: 400 }
        )
      }
    }

    // Validate partial release amount
    if (body.amount !== undefined) {
      if (body.amount <= 0 || body.amount > escrow.amount) {
        return NextResponse.json(
          { error: `Invalid release amount. Must be between 0 and ${escrow.amount}` },
          { status: 400 }
        )
      }
    }

    // Release the escrow
    const result = await releaseEscrow(escrowId, body, userId)

    const response: ReleaseEscrowResponse = {
      escrow: result.escrow,
      transaction: result.transaction,
      releasedAmount: result.releasedAmount,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error releasing escrow:', error)
    return NextResponse.json(
      {
        error: 'Failed to release escrow',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
