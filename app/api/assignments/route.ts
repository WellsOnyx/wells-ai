// @ts-nocheck
/**
 * Assignments API
 *
 * POST /api/assignments - Assign entity to user
 * GET /api/assignments - Get user's assignments
 * PATCH /api/assignments/[id] - Update assignment
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  assignToUser,
  getMyAssignments,
  reassign,
  completeAssignment,
  unassign,
} from '@/lib/teams/assignments'
import { logActivity } from '@/lib/teams/activity'

// ============================================================================
// POST - Assign Entity
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
    const { entityType, entityId, assigneeId, orgId } = body

    if (!entityType || !entityId || !assigneeId) {
      return NextResponse.json(
        { error: 'entityType, entityId, and assigneeId are required' },
        { status: 400 }
      )
    }

    // Create assignment
    const assignment = await assignToUser(
      entityType,
      entityId,
      assigneeId,
      userId
    )

    // Log activity
    if (orgId) {
      await logActivity(
        orgId,
        userId,
        `${entityType}.assigned` as any,
        entityType,
        entityId,
        { assignedTo: assigneeId }
      )
    }

    return NextResponse.json({
      success: true,
      assignment,
    })
  } catch (error) {
    console.error('Error creating assignment:', error)
    return NextResponse.json(
      { error: 'Failed to create assignment' },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Get Assignments
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as 'active' | 'completed' | 'reassigned' | undefined
    const entityType = searchParams.get('entityType') as any
    const limit = parseInt(searchParams.get('limit') || '100')

    // Get assignments
    const assignments = await getMyAssignments(userId, {
      status,
      entityType,
      limit,
    })

    return NextResponse.json({
      assignments,
    })
  } catch (error) {
    console.error('Error fetching assignments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assignments' },
      { status: 500 }
    )
  }
}

// ============================================================================
// PATCH - Update Assignment
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
    const { assignmentId, action, newAssigneeId, orgId } = body

    if (!assignmentId || !action) {
      return NextResponse.json(
        { error: 'assignmentId and action are required' },
        { status: 400 }
      )
    }

    let result

    if (action === 'complete') {
      result = await completeAssignment(assignmentId)
    } else if (action === 'reassign') {
      if (!newAssigneeId) {
        return NextResponse.json(
          { error: 'newAssigneeId is required for reassignment' },
          { status: 400 }
        )
      }
      result = await reassign(assignmentId, newAssigneeId, userId)
    } else if (action === 'unassign') {
      // Get assignment details first
      const assignments = await getMyAssignments(userId, { limit: 1000 })
      const assignment = assignments.find(a => a.id === assignmentId)
      if (assignment) {
        await unassign(assignment.entityType as any, assignment.entityId)
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

    // Log activity
    if (orgId && result) {
      await logActivity(
        orgId,
        userId,
        `${result.entityType}.${action}` as any,
        result.entityType,
        result.entityId,
        { action }
      )
    }

    return NextResponse.json({
      success: true,
      assignment: result,
    })
  } catch (error) {
    console.error('Error updating assignment:', error)
    return NextResponse.json(
      { error: 'Failed to update assignment' },
      { status: 500 }
    )
  }
}
