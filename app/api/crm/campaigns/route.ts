/**
 * CRM Campaigns API
 *
 * GET /api/crm/campaigns - List all campaigns
 * POST /api/crm/campaigns - Create a new campaign
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getCampaigns,
  createCampaign,
  getUserCampaignStats
} from '@/lib/crm/campaigns'
import type { Campaign } from '@/lib/crm/types'

export const dynamic = 'force-dynamic'

// ============================================================================
// GET - List all campaigns with filtering
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // Return aggregate stats if requested
    if (searchParams.get('stats') === 'true') {
      const days = parseInt(searchParams.get('days') || '30', 10)
      const stats = await getUserCampaignStats(userId, { days })

      return NextResponse.json({ stats })
    }

    const options = {
      status: searchParams.get('status') as Campaign['status'] | undefined,
      channel: searchParams.get('channel') as Campaign['channel'] | undefined,
      limit: parseInt(searchParams.get('limit') || '50', 10),
      offset: parseInt(searchParams.get('offset') || '0', 10),
      sortBy: searchParams.get('sortBy') || 'created_at',
      sortDir: (searchParams.get('sortDir') as 'asc' | 'desc') || 'desc'
    }

    const result = await getCampaigns(userId, options)

    return NextResponse.json({
      campaigns: result.campaigns,
      total: result.total,
      limit: options.limit,
      offset: options.offset,
      hasMore: options.offset + result.campaigns.length < result.total
    })
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST - Create a new campaign
// ============================================================================

interface CreateCampaignRequest {
  name: string
  description?: string
  channel: Campaign['channel']
  subject?: string
  body: string
  listIds?: string[]
  tagFilters?: string[]
  templateId?: string
  sendRateLimit?: number
  timezone?: string
  scheduledAt?: string
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as CreateCampaignRequest

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: 'Campaign name is required' },
        { status: 400 }
      )
    }

    if (!body.channel) {
      return NextResponse.json(
        { error: 'Channel is required (email, sms, twitter, linkedin, or multi)' },
        { status: 400 }
      )
    }

    if (!body.body) {
      return NextResponse.json(
        { error: 'Message body is required' },
        { status: 400 }
      )
    }

    // Validate channel
    const validChannels = ['email', 'sms', 'twitter', 'linkedin', 'multi']
    if (!validChannels.includes(body.channel)) {
      return NextResponse.json(
        { error: `Invalid channel. Must be one of: ${validChannels.join(', ')}` },
        { status: 400 }
      )
    }

    // Email requires subject
    if (body.channel === 'email' && !body.subject) {
      return NextResponse.json(
        { error: 'Subject is required for email campaigns' },
        { status: 400 }
      )
    }

    // Create the campaign
    const campaign = await createCampaign(userId, {
      name: body.name,
      description: body.description,
      channel: body.channel,
      subject: body.subject,
      body: body.body,
      listIds: body.listIds,
      tagFilters: body.tagFilters,
      templateId: body.templateId,
      sendRateLimit: body.sendRateLimit,
      timezone: body.timezone
    })

    // Schedule if scheduledAt provided
    if (body.scheduledAt) {
      const { scheduleCampaign } = await import('@/lib/crm/campaigns')
      await scheduleCampaign(userId, campaign.id, body.scheduledAt)
      campaign.status = 'scheduled'
      campaign.scheduled_at = body.scheduledAt
    }

    return NextResponse.json({
      success: true,
      campaign
    })
  } catch (error) {
    console.error('Error creating campaign:', error)
    return NextResponse.json(
      { error: 'Failed to create campaign' },
      { status: 500 }
    )
  }
}
