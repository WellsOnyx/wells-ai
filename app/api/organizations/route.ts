// @ts-nocheck
/**
 * Organizations API
 *
 * POST /api/organizations - Create organization
 * GET /api/organizations - List user's organizations
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  createOrganization,
  getUserOrganizations,
} from '@/lib/teams/team-service'
import { logActivity } from '@/lib/teams/activity'

// ============================================================================
// POST - Create Organization
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
    const { name, slug, description, industry, companySize, country } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      )
    }

    // Create organization
    const organization = await createOrganization(name, userId, {
      slug,
      description,
      industry,
      companySize,
      country,
    })

    // Log activity
    await logActivity(
      organization.id,
      userId,
      'organization.created',
      'organization',
      organization.id,
      { name }
    )

    return NextResponse.json({
      success: true,
      organization,
    })
  } catch (error) {
    console.error('Error creating organization:', error)
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - List Organizations
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

    // Get user's organizations
    const organizations = await getUserOrganizations(userId)

    return NextResponse.json({
      organizations,
    })
  } catch (error) {
    console.error('Error fetching organizations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    )
  }
}
