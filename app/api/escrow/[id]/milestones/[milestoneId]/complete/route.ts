// @ts-nocheck
/**
 * POST /api/escrow/[id]/milestones/[milestoneId]/complete
 *
 * Mark a milestone as completed (seller action)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { completeMilestone, getEscrow } from '@/lib/escrow/escrow-service'
import { CompleteMilestoneRequest } from '@/lib/escrow/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: escrowId, milestoneId } = await params

    // Get escrow to validate seller
    const escrow = await getEscrow(escrowId)

    if (escrow.sellerId !== userId) {
      return NextResponse.json(
        { error: 'Only the seller can complete milestones' },
        { status: 403 }
      )
    }

    const milestone = escrow.milestones.find(m => m.id === milestoneId)
    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }

    const body = (await request.json()) as CompleteMilestoneRequest

    if (!body.deliverables || body.deliverables.length === 0) {
      return NextResponse.json(
        { error: 'At least one deliverable must be provided' },
        { status: 400 }
      )
    }

    // Complete the milestone
    const updatedMilestone = await completeMilestone(
      milestoneId,
      body.deliverables,
      userId
    )

    return NextResponse.json({
      milestone: updatedMilestone,
      message: 'Milestone completed. Awaiting buyer approval.',
    })
  } catch (error) {
    console.error('Error completing milestone:', error)
    return NextResponse.json(
      {
        error: 'Failed to complete milestone',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
