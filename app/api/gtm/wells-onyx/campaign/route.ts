import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { quickLaunch, approveCampaign, previewCampaign, type Campaign } from '@/lib/gtm/wells-onyx-launcher'
import { z } from 'zod'

/**
 * POST /api/gtm/wells-onyx/campaign
 *
 * Create a new Wells Onyx GTM campaign
 *
 * Request body:
 * {
 *   "practiceGroupId": "cybersecurity",
 *   "targetCount": 25,
 *   "instantlyApiKey": "optional-key"
 * }
 *
 * Response:
 * {
 *   "campaignId": "wo_gtm_123",
 *   "practiceGroup": "Cybersecurity & Data Privacy Leadership",
 *   "prospects": 25,
 *   "messages": [...],
 *   "status": "draft"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate request body
    const CreateCampaignSchema = z.object({
      practiceGroupId: z.string().min(1, 'Practice group ID is required'),
      targetCount: z.number().min(1).max(100).optional().default(25),
      instantlyApiKey: z.string().optional(),
      instantlyCampaignId: z.string().optional(),
    })

    const body = await request.json()
    const validatedData = CreateCampaignSchema.parse(body)

    console.log(`[WELLS ONYX GTM] Creating campaign for practice group: ${validatedData.practiceGroupId}`)

    // Create campaign using wells-onyx-launcher
    const campaign = await quickLaunch({
      practiceGroupId: validatedData.practiceGroupId,
      targetCount: validatedData.targetCount,
      instantlyApiKey: validatedData.instantlyApiKey,
    })

    // Store campaign in database
    const dbCampaign = await prisma.wellsOnyxCampaign.create({
      data: {
        campaignId: campaign.id,
        userId,
        practiceGroupId: campaign.practiceGroup.id,
        practiceGroupName: campaign.practiceGroup.name,
        status: 'DRAFT',
        prospectCount: campaign.prospects.length,
        messageCount: campaign.messages.length,
        approvedCount: 0,
        sentCount: 0,
        practiceGroupData: campaign.practiceGroup as any,
        prospectsData: campaign.prospects as any,
        messagesData: campaign.messages as any,
        instantlyApiKey: validatedData.instantlyApiKey,
        instantlyCampaignId: validatedData.instantlyCampaignId,
      },
    })

    console.log(`[WELLS ONYX GTM] Campaign created: ${campaign.id}`)
    console.log(`[WELLS ONYX GTM] Database ID: ${dbCampaign.id}`)

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      practiceGroup: campaign.practiceGroup.name,
      prospects: campaign.prospects.length,
      messages: campaign.messages.map(m => ({
        prospectEmail: m.prospectEmail,
        channel: m.channel,
        subject: m.subject,
        body: m.body,
        approved: m.approved,
      })),
      status: campaign.status,
      preview: previewCampaign(campaign),
    })
  } catch (error: any) {
    console.error('[WELLS ONYX GTM] Error creating campaign:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create campaign' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/gtm/wells-onyx/campaign?campaignId=wo_gtm_123
 *
 * Retrieve campaign status and details
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
    }

    // Fetch campaign from database
    const dbCampaign = await prisma.wellsOnyxCampaign.findUnique({
      where: { campaignId },
    })

    if (!dbCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Verify ownership
    if (dbCampaign.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Reconstruct campaign object
    const campaign: Campaign = {
      id: dbCampaign.campaignId,
      practiceGroup: dbCampaign.practiceGroupData as any,
      prospects: dbCampaign.prospectsData as any,
      messages: dbCampaign.messagesData as any,
      status: dbCampaign.status.toLowerCase() as any,
      createdAt: dbCampaign.createdAt,
    }

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      practiceGroup: dbCampaign.practiceGroupName,
      status: campaign.status,
      prospects: dbCampaign.prospectCount,
      messages: campaign.messages,
      approvedCount: dbCampaign.approvedCount,
      sentCount: dbCampaign.sentCount,
      createdAt: dbCampaign.createdAt,
      updatedAt: dbCampaign.updatedAt,
      approvedAt: dbCampaign.approvedAt,
      sentAt: dbCampaign.sentAt,
    })
  } catch (error: any) {
    console.error('[WELLS ONYX GTM] Error retrieving campaign:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve campaign' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/gtm/wells-onyx/campaign
 *
 * Approve/reject individual messages or send campaign
 *
 * Request body:
 * {
 *   "campaignId": "wo_gtm_123",
 *   "action": "approve_message" | "reject_message" | "approve_all" | "send",
 *   "messageIndex": 0,  // For approve_message/reject_message
 *   "instantlyApiKey": "key"  // For send action
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate request body
    const UpdateCampaignSchema = z.object({
      campaignId: z.string().min(1, 'Campaign ID is required'),
      action: z.enum(['approve_message', 'reject_message', 'approve_all', 'send']),
      messageIndex: z.number().min(0).optional(),
      instantlyApiKey: z.string().optional(),
      instantlyCampaignId: z.string().optional(),
    })

    const body = await request.json()
    const validatedData = UpdateCampaignSchema.parse(body)

    // Fetch campaign from database
    const dbCampaign = await prisma.wellsOnyxCampaign.findUnique({
      where: { campaignId: validatedData.campaignId },
    })

    if (!dbCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Verify ownership
    if (dbCampaign.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Reconstruct campaign object
    let campaign: Campaign = {
      id: dbCampaign.campaignId,
      practiceGroup: dbCampaign.practiceGroupData as any,
      prospects: dbCampaign.prospectsData as any,
      messages: dbCampaign.messagesData as any,
      status: dbCampaign.status.toLowerCase() as any,
      createdAt: dbCampaign.createdAt,
    }

    // Handle different actions
    switch (validatedData.action) {
      case 'approve_message':
        if (validatedData.messageIndex === undefined) {
          return NextResponse.json({ error: 'messageIndex required for approve_message' }, { status: 400 })
        }

        if (validatedData.messageIndex >= campaign.messages.length) {
          return NextResponse.json({ error: 'Invalid messageIndex' }, { status: 400 })
        }

        campaign.messages[validatedData.messageIndex].approved = true

        // Update database
        await prisma.wellsOnyxCampaign.update({
          where: { campaignId: validatedData.campaignId },
          data: {
            messagesData: campaign.messages as any,
            approvedCount: campaign.messages.filter(m => m.approved).length,
            status: campaign.messages.every(m => m.approved) ? 'READY' : 'DRAFT',
          },
        })

        console.log(`[WELLS ONYX GTM] Message ${validatedData.messageIndex} approved`)

        return NextResponse.json({
          success: true,
          message: 'Message approved',
          approvedCount: campaign.messages.filter(m => m.approved).length,
          totalMessages: campaign.messages.length,
        })

      case 'reject_message':
        if (validatedData.messageIndex === undefined) {
          return NextResponse.json({ error: 'messageIndex required for reject_message' }, { status: 400 })
        }

        if (validatedData.messageIndex >= campaign.messages.length) {
          return NextResponse.json({ error: 'Invalid messageIndex' }, { status: 400 })
        }

        campaign.messages[validatedData.messageIndex].approved = false

        // Update database
        await prisma.wellsOnyxCampaign.update({
          where: { campaignId: validatedData.campaignId },
          data: {
            messagesData: campaign.messages as any,
            approvedCount: campaign.messages.filter(m => m.approved).length,
          },
        })

        console.log(`[WELLS ONYX GTM] Message ${validatedData.messageIndex} rejected`)

        return NextResponse.json({
          success: true,
          message: 'Message rejected',
          approvedCount: campaign.messages.filter(m => m.approved).length,
          totalMessages: campaign.messages.length,
        })

      case 'approve_all':
        campaign.messages.forEach(m => m.approved = true)

        // Update database
        await prisma.wellsOnyxCampaign.update({
          where: { campaignId: validatedData.campaignId },
          data: {
            messagesData: campaign.messages as any,
            approvedCount: campaign.messages.length,
            status: 'READY',
            approvedAt: new Date(),
          },
        })

        console.log(`[WELLS ONYX GTM] All ${campaign.messages.length} messages approved`)

        return NextResponse.json({
          success: true,
          message: 'All messages approved',
          approvedCount: campaign.messages.length,
          status: 'ready',
        })

      case 'send':
        // Verify messages are approved
        const unapprovedCount = campaign.messages.filter(m => !m.approved).length
        if (unapprovedCount > 0) {
          return NextResponse.json(
            { error: `${unapprovedCount} messages not approved. Approve all messages before sending.` },
            { status: 400 }
          )
        }

        // Get API key
        const apiKey = validatedData.instantlyApiKey || dbCampaign.instantlyApiKey || process.env.INSTANTLY_API_KEY
        if (!apiKey) {
          return NextResponse.json(
            { error: 'Instantly API key required. Provide instantlyApiKey in request or environment.' },
            { status: 400 }
          )
        }

        // Update status to SENDING
        await prisma.wellsOnyxCampaign.update({
          where: { campaignId: validatedData.campaignId },
          data: { status: 'SENDING' },
        })

        console.log(`[WELLS ONYX GTM] Sending campaign ${validatedData.campaignId}...`)

        // Send via Instantly
        const result = await approveCampaign({
          campaign,
          instantlyApiKey: apiKey,
          instantlyCampaignId: validatedData.instantlyCampaignId || dbCampaign.instantlyCampaignId || undefined,
        })

        // Update campaign status
        campaign.messages.forEach(m => m.sent = true)
        campaign.status = 'sent'

        // Update database
        await prisma.wellsOnyxCampaign.update({
          where: { campaignId: validatedData.campaignId },
          data: {
            messagesData: campaign.messages as any,
            sentCount: result.sent,
            status: 'SENT',
            sentAt: new Date(),
          },
        })

        console.log(`[WELLS ONYX GTM] Campaign sent: ${result.sent} messages`)

        return NextResponse.json({
          success: true,
          message: 'Campaign sent successfully',
          sent: result.sent,
          failed: result.failed,
          status: 'sent',
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('[WELLS ONYX GTM] Error updating campaign:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to update campaign' },
      { status: 500 }
    )
  }
}
