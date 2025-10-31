import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { sendCampaign } from '@/lib/gtm/campaign-engine'

/**
 * POST /api/gtm/campaign/[id]/approve
 *
 * Approve and send campaign
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const campaignId = resolvedParams.id

    // Get user's campaigns
    const client = await clerkClient()
    const user = await client.users.getUser(userId)

    const campaigns = (user.publicMetadata.gtmCampaigns as any[]) || []
    const campaign = campaigns.find((c) => c.id === campaignId)

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get Instantly API key
    const instantlyApiKey = user.privateMetadata.instantlyApiKey as string | undefined

    if (!instantlyApiKey) {
      return NextResponse.json(
        { error: 'Instantly not connected. Please add API key.' },
        { status: 400 }
      )
    }

    // Approve all messages
    campaign.messages.forEach((msg: any) => {
      msg.approved = true
    })

    // Send campaign
    console.log(`Sending campaign ${campaignId}...`)
    const result = await sendCampaign({ campaign, instantlyApiKey })

    // Update campaign status
    campaign.status = 'sent'

    // Save back to user metadata
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...user.publicMetadata,
        gtmCampaigns: campaigns,
      },
    })

    console.log(`✅ Campaign sent: ${result.sent} emails, ${result.failed} failed`)

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error: any) {
    console.error('Error approving campaign:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to approve campaign' },
      { status: 500 }
    )
  }
}
