// @ts-nocheck
/**
 * Activity Feed API
 *
 * GET /api/activity - Get activity feed for organization
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getOrganizationActivity } from '@/lib/teams/activity'
import { getOrganizationMember } from '@/lib/teams/team-service'

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
    const orgId = searchParams.get('orgId')
    const actionType = searchParams.get('actionType')
    const entityType = searchParams.get('entityType')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!orgId) {
      return NextResponse.json(
        { error: 'orgId is required' },
        { status: 400 }
      )
    }

    // Check if user is member
    const member = await getOrganizationMember(orgId, userId)
    if (!member) {
      return NextResponse.json(
        { error: 'Not a member of this organization' },
        { status: 403 }
      )
    }

    // Get activity
    const { activities, total } = await getOrganizationActivity(orgId, {
      actionType: actionType as any,
      entityType: entityType || undefined,
      limit,
      offset,
    })

    return NextResponse.json({
      activities,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Error fetching activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activity' },
      { status: 500 }
    )
  }
}
