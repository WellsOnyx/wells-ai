// @ts-nocheck
/**
 * Organization Details API
 *
 * GET /api/organizations/[orgId] - Get organization
 * PATCH /api/organizations/[orgId] - Update organization
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getOrganization,
  updateOrganization,
  getOrganizationMember,
} from '@/lib/teams/team-service'
import { canManageSettings } from '@/lib/teams/permissions'
import { logActivity } from '@/lib/teams/activity'

// ============================================================================
// GET - Get Organization
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

    // Check if user is member
    const member = await getOrganizationMember(orgId, userId)
    if (!member) {
      return NextResponse.json(
        { error: 'Not a member of this organization' },
        { status: 403 }
      )
    }

    // Get organization
    const organization = await getOrganization(orgId)

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      organization,
      member,
    })
  } catch (error) {
    console.error('Error fetching organization:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    )
  }
}

// ============================================================================
// PATCH - Update Organization
// ============================================================================

export async function PATCH(
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
    const canManage = await canManageSettings(userId, orgId)
    if (!canManage) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description, logoUrl, website, industry, companySize, settings } = body

    // Update organization
    const organization = await updateOrganization(orgId, {
      name,
      description,
      logoUrl,
      website,
      industry,
      companySize,
      settings,
    })

    // Log activity
    await logActivity(
      orgId,
      userId,
      'organization.updated',
      'organization',
      orgId,
      { changes: body }
    )

    return NextResponse.json({
      success: true,
      organization,
    })
  } catch (error) {
    console.error('Error updating organization:', error)
    return NextResponse.json(
      { error: 'Failed to update organization' },
      { status: 500 }
    )
  }
}
