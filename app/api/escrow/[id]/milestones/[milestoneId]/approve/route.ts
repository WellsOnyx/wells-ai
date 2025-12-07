// @ts-nocheck
/**
 * POST /api/escrow/[id]/milestones/[milestoneId]/approve
 *
 * Approve a completed milestone (buyer action)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { approveMilestone, getEscrow } from '@/lib/escrow/escrow-service'
import { ApproveMilestoneRequest } from '@/lib/escrow/types'

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
        { error: 'Only the buyer can approve milestones' },
        { status: 403 }
      )
    }

    const milestone = escrow.milestones.find(m => m.id === milestoneId)
    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }

    if (milestone.status !== 'completed') {
      return NextResponse.json(
        { error: 'Milestone must be completed before approval' },
        { status: 400 }
      )
    }

    // Approve the milestone
    const updatedMilestone = await approveMilestone(milestoneId, userId)

    return NextResponse.json({
      milestone: updatedMilestone,
      message: 'Milestone approved. Funds can now be released.',
    })
  } catch (error) {
    console.error('Error approving milestone:', error)
    return NextResponse.json(
      {
        error: 'Failed to approve milestone',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
