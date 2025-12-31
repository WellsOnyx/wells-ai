/**
 * CRM Single Campaign API
 *
 * GET /api/crm/campaigns/[id] - Get a single campaign with stats
 * PUT /api/crm/campaigns/[id] - Update a campaign
 * DELETE /api/crm/campaigns/[id] - Delete a campaign
 * PATCH /api/crm/campaigns/[id] - Change campaign status (start/pause/resume/cancel)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignStats,
  getCampaignMessages,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  scheduleCampaign,
  duplicateCampaign
} from '@/lib/crm/campaigns'
import type { Campaign } from '@/lib/crm/types'

// ============================================================================
// GET - Get a single campaign with optional stats and messages
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

    const { searchParams } = new URL(request.url)

    // Get stats if requested
    let stats = undefined
    if (searchParams.get('stats') === 'true') {
      stats = await getCampaignStats(userId, campaignId)
    }

    // Get messages if requested
    let messages = undefined
    if (searchParams.get('messages') === 'true') {
      const messageStatus = searchParams.get('messageStatus') || undefined
      const messageLimit = parseInt(searchParams.get('messageLimit') || '50', 10)
      const messageOffset = parseInt(searchParams.get('messageOffset') || '0', 10)

      messages = await getCampaignMessages(userId, campaignId, {
        status: messageStatus,
        limit: messageLimit,
        offset: messageOffset
      })
    }

    return NextResponse.json({
      campaign,
      stats,
      messages
    })
  } catch (error) {
    console.error('Error fetching campaign:', error)
    return NextResponse.json(
      { error: 'Failed to fetch campaign' },
      { status: 500 }
    )
  }
}

// ============================================================================
// PUT - Update a campaign
// ============================================================================

interface UpdateCampaignRequest {
  name?: string
  description?: string
  channel?: Campaign['channel']
  subject?: string
  body?: string
  listIds?: string[]
  tagFilters?: string[]
  templateId?: string
  sendRateLimit?: number
  timezone?: string
  scheduledAt?: string
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const campaignId = params.id
    const body = (await request.json()) as UpdateCampaignRequest

    // Check campaign exists and is editable
    const existing = await getCampaign(userId, campaignId)

    if (!existing) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    if (!['draft', 'scheduled'].includes(existing.status)) {
      return NextResponse.json(
        { error: `Cannot edit campaign with status: ${existing.status}` },
        { status: 400 }
      )
    }

    // Update the campaign
    const campaign = await updateCampaign(userId, campaignId, body)

    if (!campaign) {
      return NextResponse.json(
        { error: 'No changes provided' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      campaign
    })
  } catch (error) {
    console.error('Error updating campaign:', error)
    return NextResponse.json(
      { error: 'Failed to update campaign' },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE - Delete a campaign
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const campaignId = params.id
    const deleted = await deleteCampaign(userId, campaignId)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Campaign not found or cannot be deleted (must be draft or cancelled)' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      deleted: true
    })
  } catch (error) {
    console.error('Error deleting campaign:', error)
    return NextResponse.json(
      { error: 'Failed to delete campaign' },
      { status: 500 }
    )
  }
}

// ============================================================================
// PATCH - Change campaign status or duplicate
// ============================================================================

interface PatchCampaignRequest {
  action: 'start' | 'pause' | 'resume' | 'cancel' | 'schedule' | 'duplicate'
  scheduledAt?: string // Required for 'schedule' action
  newName?: string // Optional for 'duplicate' action
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const campaignId = params.id
    const body = (await request.json()) as PatchCampaignRequest

    if (!body.action) {
      return NextResponse.json(
        { error: 'action is required (start, pause, resume, cancel, schedule, or duplicate)' },
        { status: 400 }
      )
    }

    let result: { success: boolean; error?: string; campaign?: any }

    switch (body.action) {
      case 'start':
        result = await startCampaign(userId, campaignId)
        break

      case 'pause':
        result = await pauseCampaign(userId, campaignId)
        break

      case 'resume':
        result = await resumeCampaign(userId, campaignId)
        break

      case 'cancel':
        result = await cancelCampaign(userId, campaignId)
        break

      case 'schedule':
        if (!body.scheduledAt) {
          return NextResponse.json(
            { error: 'scheduledAt is required for schedule action' },
            { status: 400 }
          )
        }
        result = await scheduleCampaign(userId, campaignId, body.scheduledAt)
        break

      case 'duplicate':
        const newCampaign = await duplicateCampaign(userId, campaignId, body.newName)
        if (newCampaign) {
          result = { success: true, campaign: newCampaign }
        } else {
          result = { success: false, error: 'Campaign not found' }
        }
        break

      default:
        return NextResponse.json(
          { error: `Invalid action: ${body.action}` },
          { status: 400 }
        )
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    // Get updated campaign
    const campaign = result.campaign || await getCampaign(userId, campaignId)

    return NextResponse.json({
      success: true,
      action: body.action,
      campaign
    })
  } catch (error) {
    console.error('Error updating campaign status:', error)
    return NextResponse.json(
      { error: 'Failed to update campaign status' },
      { status: 500 }
    )
  }
}
