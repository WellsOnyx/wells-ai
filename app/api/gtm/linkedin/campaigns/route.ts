/**
 * LinkedIn Campaigns API
 *
 * Manages LinkedIn GTM campaigns for users
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  createLinkedInCampaign,
  generateLinkedInSearchCriteria,
  type LinkedInCampaign,
  type LinkedInSearchCriteria
} from '@/lib/gtm/linkedin-integration'
import type { RoleQualification } from '@/lib/gtm/sourcing-qualification'

/**
 * GET /api/gtm/linkedin/campaigns
 * List all LinkedIn campaigns for the user
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: Fetch campaigns from database
    // For now, return from Clerk metadata

    const campaigns: LinkedInCampaign[] = []

    return NextResponse.json({ campaigns })
  } catch (error: any) {
    console.error('[LINKEDIN_CAMPAIGNS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/gtm/linkedin/campaigns
 * Create a new LinkedIn campaign from qualification
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      qualification,
      searchCriteria,
      campaignName
    }: {
      qualification: RoleQualification
      searchCriteria?: LinkedInSearchCriteria
      campaignName?: string
    } = body

    if (!qualification) {
      return NextResponse.json(
        { error: 'Qualification required' },
        { status: 400 }
      )
    }

    // Generate search criteria from qualification if not provided
    const criteria = searchCriteria || generateLinkedInSearchCriteria(qualification)

    // Create campaign
    const campaign = await createLinkedInCampaign(
      userId,
      qualification,
      criteria
    )

    if (campaignName) {
      campaign.name = campaignName
    }

    // TODO: Save campaign to database

    console.log('[LINKEDIN_CAMPAIGN_CREATED]', {
      campaignId: campaign.id,
      userId,
      name: campaign.name
    })

    return NextResponse.json({
      success: true,
      campaign
    })
  } catch (error: any) {
    console.error('[LINKEDIN_CAMPAIGNS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create campaign' },
      { status: 500 }
    )
  }
}
