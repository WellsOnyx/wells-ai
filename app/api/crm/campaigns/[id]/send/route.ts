/**
 * CRM Campaign Send API
 *
 * POST /api/crm/campaigns/[id]/send - Start sending a campaign
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCampaign, startCampaign } from '@/lib/crm/campaigns'
import { sendCampaign } from '@/lib/crm/outreach'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Allow up to 5 minutes for campaign sending

// ============================================================================
// POST - Start sending the campaign
// ============================================================================

interface SendCampaignRequest {
  async?: boolean // If true, returns immediately and sends in background
  testMode?: boolean // If true, only sends to first contact
  testContactId?: string // Override to send test to specific contact
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const campaignId = params.id
    const body = (await request.json().catch(() => ({}))) as SendCampaignRequest

    // Get the campaign
    const campaign = await getCampaign(userId, campaignId)

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Check if campaign can be sent
    if (!['draft', 'scheduled', 'paused'].includes(campaign.status)) {
      return NextResponse.json(
        { error: `Cannot send campaign with status: ${campaign.status}` },
        { status: 400 }
      )
    }

    // Start the campaign (updates status)
    const startResult = await startCampaign(userId, campaignId)

    if (!startResult.success) {
      return NextResponse.json(
        { error: startResult.error },
        { status: 400 }
      )
    }

    // If async mode, return immediately
    if (body.async) {
      // In a production environment, you would queue this for background processing
      // For now, we just return that it's been queued

      // Fire and forget - send in background
      sendCampaign(userId, campaignId).catch(err => {
        console.error(`Background campaign send failed for ${campaignId}:`, err)
      })

      return NextResponse.json({
        success: true,
        status: 'sending',
        message: 'Campaign is being sent in the background',
        campaignId
      })
    }

    // Synchronous send - wait for completion
    const result = await sendCampaign(userId, campaignId)

    // Get updated campaign
    const updatedCampaign = await getCampaign(userId, campaignId)

    return NextResponse.json({
      success: true,
      status: 'sent',
      campaign: updatedCampaign,
      result: {
        total: result.total,
        sent: result.sent,
        failed: result.failed,
        errors: result.errors.slice(0, 10) // Limit error details
      }
    })
  } catch (error) {
    console.error('Error sending campaign:', error)
    return NextResponse.json(
      { error: 'Failed to send campaign' },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Get send status for a campaign
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const campaignId = params.id
    const campaign = await getCampaign(userId, campaignId)

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Calculate progress
    const progress = campaign.total_recipients > 0
      ? Math.round((campaign.sent_count / campaign.total_recipients) * 100)
      : 0

    return NextResponse.json({
      campaignId,
      status: campaign.status,
      progress,
      stats: {
        totalRecipients: campaign.total_recipients,
        sent: campaign.sent_count,
        delivered: campaign.delivered_count,
        opened: campaign.opened_count,
        clicked: campaign.clicked_count,
        replied: campaign.replied_count,
        bounced: campaign.bounced_count,
        unsubscribed: campaign.unsubscribed_count
      },
      startedAt: campaign.started_at,
      completedAt: campaign.completed_at
    })
  } catch (error) {
    console.error('Error getting campaign status:', error)
    return NextResponse.json(
      { error: 'Failed to get campaign status' },
      { status: 500 }
    )
  }
}
