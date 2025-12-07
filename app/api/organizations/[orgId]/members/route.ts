// @ts-nocheck
/**
 * Organization Members API
 *
 * GET /api/organizations/[orgId]/members - List members
 * POST /api/organizations/[orgId]/members - Invite member
 * DELETE /api/organizations/[orgId]/members - Remove member
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getOrganizationMembers,
  inviteToOrganization,
  removeFromOrganization,
  getOrganization,
} from '@/lib/teams/team-service'
import { canInviteMembers, canRemoveMembers } from '@/lib/teams/permissions'
import { logActivity } from '@/lib/teams/activity'

// ============================================================================
// GET - List Members
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { orgId } = await params

    // Get members
    const members = await getOrganizationMembers(orgId)

    return NextResponse.json({
      members,
    })
  } catch (error) {
    console.error('Error fetching members:', error)
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST - Invite Member
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { orgId } = await params

    // Check permissions
    const canInvite = await canInviteMembers(userId, orgId)
    if (!canInvite) {
      return NextResponse.json(
        { error: 'Insufficient permissions to invite members' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, role, message } = body

    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required' },
        { status: 400 }
      )
    }

    if (!['admin', 'member', 'viewer'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    // Create invite
    const invite = await inviteToOrganization(orgId, email, role, userId, message)

    // Log activity
    await logActivity(
      orgId,
      userId,
      'member.invited',
      'invite',
      invite.id,
      { email, role }
    )

    // TODO: Send invite email

    return NextResponse.json({
      success: true,
      invite,
      inviteUrl: `${process.env.NEXT_PUBLIC_URL}/invites/${invite.token}`,
    })
  } catch (error) {
    console.error('Error inviting member:', error)
    return NextResponse.json(
      { error: 'Failed to invite member' },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE - Remove Member
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { orgId } = await params
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('userId')

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'userId query parameter is required' },
        { status: 400 }
      )
    }

    // Check permissions
    const { canRemove, reason } = await canRemoveMembers(userId, orgId, targetUserId)
    if (!canRemove) {
      return NextResponse.json(
        { error: reason || 'Insufficient permissions to remove members' },
        { status: 403 }
      )
    }

    // Remove member
    await removeFromOrganization(orgId, targetUserId)

    // Log activity
    await logActivity(
      orgId,
      userId,
      'member.removed',
      'member',
      targetUserId,
      { removedBy: userId }
    )

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error removing member:', error)
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    )
  }
}
