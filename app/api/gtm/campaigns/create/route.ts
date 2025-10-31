import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createCampaign } from '@/lib/gtm/campaign-engine'
import {
  requireGTMAccess,
  getGTMCredentials,
} from '@/lib/gtm/onboarding-check'

/**
 * POST /api/gtm/campaigns/create
 *
 * Create GTM campaign (does NOT send - creates draft for approval)
 *
 * SAFETY: Requires user to be logged in AND onboarded
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // CRITICAL: Check onboarding status
    await requireGTMAccess(userId)

    const body = await request.json()
    const {
      userRequest,
      productDescription,
      userRelationship,
    } = body

    if (!userRequest) {
      return NextResponse.json(
        { error: 'userRequest is required' },
        { status: 400 }
      )
    }

    // Get user's GTM credentials
    const credentials = await getGTMCredentials(userId)

    console.log(`[GTM] Creating campaign for user ${userId}...`)
    console.log(`  Request: ${userRequest}`)
    console.log(`  Using Wells AI stack: ${credentials.usingWellsStack}`)

    // Create campaign (DRAFT - not sent yet)
    const campaign = await createCampaign({
      userId,
      userRequest,
      notionApiKey: credentials.notionApiKey,
      notionDealsDbId: credentials.notionDealsDbId,
      instantlyApiKey: credentials.instantlyApiKey,
      userRelationship: userRelationship || 'cold',
      productDescription:
        productDescription || 'AI-powered B2B solution',
      twilioFrom: credentials.twilioFrom,
    })

    // Save campaign to user metadata for approval
    const client = await clerkClient()
    const user = await client.users.getUser(userId)

    const existingCampaigns =
      (user.publicMetadata.gtmCampaigns as any[]) || []
    existingCampaigns.push(campaign)

    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...user.publicMetadata,
        gtmCampaigns: existingCampaigns,
      },
    })

    console.log(`[GTM] ✅ Campaign created: ${campaign.id}`)
    console.log(`  Prospects: ${campaign.prospects.length}`)
    console.log(`  Messages: ${campaign.messages.length}`)

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        prospectCount: campaign.prospects.length,
        messageCount: campaign.messages.length,
        channels: {
          email: campaign.messages.filter((m) => m.channel === 'email')
            .length,
          sms: campaign.messages.filter(
            (m) => m.channel === 'sms' && m.canSend
          ).length,
          linkedin: campaign.messages.filter(
            (m) => m.channel === 'linkedin'
          ).length,
        },
        usingWellsStack: campaign.usingWellsStack,
        status: campaign.status,
      },
    })
  } catch (error: any) {
    console.error('[GTM] Campaign creation error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to create campaign',
        needsOnboarding: error.message?.includes('not configured'),
      },
      { status: 500 }
    )
  }
}
