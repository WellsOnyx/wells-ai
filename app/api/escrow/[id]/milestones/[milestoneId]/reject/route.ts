// @ts-nocheck
/**
 * POST /api/escrow/[id]/milestones/[milestoneId]/reject
 *
 * Reject a completed milestone (buyer action)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { rejectMilestone, getEscrow } from '@/lib/escrow/escrow-service'
import { RejectMilestoneRequest } from '@/lib/escrow/types'

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

    // Get escrow to validate buyer
    const escrow = await getEscrow(escrowId)

    if (escrow.buyerId !== userId) {
      return NextResponse.json(
        { error: 'Only the buyer can reject milestones' },
        { status: 403 }
      )
    }

    const milestone = escrow.milestones.find(m => m.id === milestoneId)
    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }

    if (milestone.status !== 'completed') {
      return NextResponse.json(
        { error: 'Can only reject completed milestones' },
        { status: 400 }
      )
    }

    const body = (await request.json()) as RejectMilestoneRequest

    if (!body.reason) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      )
    }

    // Reject the milestone
    const updatedMilestone = await rejectMilestone(milestoneId, userId, body.reason)

    return NextResponse.json({
      milestone: updatedMilestone,
      message: body.requestRevision
        ? 'Milestone rejected. Seller can revise and resubmit.'
        : 'Milestone rejected.',
    })
  } catch (error) {
    console.error('Error rejecting milestone:', error)
    return NextResponse.json(
      {
        error: 'Failed to reject milestone',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
