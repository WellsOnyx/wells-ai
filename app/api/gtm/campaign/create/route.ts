import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createCampaign } from '@/lib/gtm/campaign-engine'

/**
 * POST /api/gtm/campaign/create
 *
 * Create GTM campaign from user request
 *
 * Request body:
 * {
 *   "request": "Find me customers who buy vegetables"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { request: userRequest } = body

    if (!userRequest) {
      return NextResponse.json({ error: 'Request required' }, { status: 400 })
    }

    // Get user's Notion credentials
    const client = await clerkClient()
    const user = await client.users.getUser(userId)

    const notionApiKey = user.privateMetadata.notionApiKey as string | undefined
    const notionDealsDbId = user.privateMetadata.notionDealsDbId as string | undefined

    if (!notionApiKey || !notionDealsDbId) {
      return NextResponse.json(
        { error: 'Notion not connected. Please connect Notion first.' },
        { status: 400 }
      )
    }

    // Create campaign
    console.log(`Creating GTM campaign for user ${userId}...`)
    console.log(`Request: "${userRequest}"`)

    const campaign = await createCampaign({
      userId,
      userRequest,
      notionApiKey,
      notionDealsDbId,
    })

    // Store campaign in user metadata
    const existingCampaigns = (user.publicMetadata.gtmCampaigns as any[]) || []
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...user.publicMetadata,
        gtmCampaigns: [...existingCampaigns, campaign],
      },
    })

    console.log(`✅ Campaign created: ${campaign.id}`)

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        status: campaign.status,
        prospectCount: campaign.prospects.length,
        messageCount: campaign.messages.length,
        icp: campaign.icp,
        prospects: campaign.prospects.slice(0, 5), // First 5 for preview
      },
    })
  } catch (error: any) {
    console.error('Error creating campaign:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create campaign' },
      { status: 500 }
    )
  }
}
