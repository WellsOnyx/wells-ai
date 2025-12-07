// @ts-nocheck
/**
 * Handoffs API
 *
 * POST /api/handoffs - Initiate handoff
 * GET /api/handoffs - Get pending handoffs
 * PATCH /api/handoffs - Accept/decline handoff
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  initiateHandoff,
  acceptHandoff,
  declineHandoff,
  getPendingHandoffs,
} from '@/lib/teams/handoffs'
import { logActivity } from '@/lib/teams/activity'

// ============================================================================
// POST - Initiate Handoff
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { orgId, entityType, entityId, toUserId, reason, message } = body

    if (!orgId || !entityType || !entityId || !toUserId) {
      return NextResponse.json(
        { error: 'orgId, entityType, entityId, and toUserId are required' },
        { status: 400 }
      )
    }

    // Initiate handoff
    const handoff = await initiateHandoff(
      orgId,
      entityType,
      entityId,
      userId,
      toUserId,
      reason,
      message
    )

    // Log activity
    await logActivity(
      orgId,
      userId,
      'handoff.initiated',
      entityType,
      entityId,
      { handoffId: handoff.id, toUser: toUserId }
    )

    return NextResponse.json({
      success: true,
      handoff,
    })
  } catch (error) {
    console.error('Error initiating handoff:', error)
    return NextResponse.json(
      { error: 'Failed to initiate handoff' },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Get Pending Handoffs
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get pending handoffs
    const handoffs = await getPendingHandoffs(userId)

    return NextResponse.json({
      handoffs,
    })
  } catch (error) {
    console.error('Error fetching handoffs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch handoffs' },
      { status: 500 }
    )
  }
}

// ============================================================================
// PATCH - Accept/Decline Handoff
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { handoffId, action, reason, orgId } = body

    if (!handoffId || !action) {
      return NextResponse.json(
        { error: 'handoffId and action are required' },
        { status: 400 }
      )
    }

    let handoff

    if (action === 'accept') {
      handoff = await acceptHandoff(handoffId, userId)

      // Log activity
      if (orgId) {
        await logActivity(
          orgId,
          userId,
          'handoff.accepted',
          handoff.entityType,
          handoff.entityId,
          { handoffId }
        )
      }
    } else if (action === 'decline') {
      handoff = await declineHandoff(handoffId, userId, reason)

      // Log activity
      if (orgId) {
        await logActivity(
          orgId,
          userId,
          'handoff.declined',
          handoff.entityType,
          handoff.entityId,
          { handoffId, reason }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      handoff,
    })
  } catch (error) {
    console.error('Error processing handoff:', error)
    return NextResponse.json(
      { error: 'Failed to process handoff' },
      { status: 500 }
    )
  }
}
