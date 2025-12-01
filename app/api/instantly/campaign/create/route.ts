/**
 * POST /api/instantly/campaign/create
 * Create Instantly campaign
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  createInstantlyCampaign,
  createCampaignFromTemplate,
  type InstantlyCampaignConfig,
  WELLS_CAMPAIGN_TEMPLATES
} from '@/lib/email/instantly'
import { getUserEmailConfig } from '@/lib/email-config'
import { z } from 'zod'

const CreateCampaignSchema = z.object({
  name: z.string().min(1),
  template: z.enum(['exec-search', 'partnership', 'custom']).optional(),
  fromEmail: z.string().email().optional(),
  sequence: z.array(z.object({
    subject: z.string().min(1),
    body: z.string().min(1),
    delayInDays: z.number().min(0)
  })).optional(),
  trackOpens: z.boolean().default(true),
  trackClicks: z.boolean().default(true),
  dailyLimit: z.number().min(1).max(200).default(50)
})

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request
    const body = await req.json()
    const validation = CreateCampaignSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validation.error.errors
        },
        { status: 400 }
      )
    }

    const data = validation.data

    // Get user's email config for fromEmail if not provided
    let fromEmail = data.fromEmail

    if (!fromEmail) {
      const config = await getUserEmailConfig(userId)
      fromEmail = config?.fromEmail
    }

    if (!fromEmail) {
      return NextResponse.json(
        {
          error: 'No from email configured. Please set up email configuration first.'
        },
        { status: 400 }
      )
    }

    // Create campaign based on template or custom
    let result

    if (data.template && data.template !== 'custom') {
      // Use template
      result = await createCampaignFromTemplate(data.template, fromEmail)
    } else {
      // Custom campaign
      if (!data.sequence || data.sequence.length === 0) {
        return NextResponse.json(
          {
            error: 'Custom campaigns require at least one sequence step'
          },
          { status: 400 }
        )
      }

      const config: InstantlyCampaignConfig = {
        name: data.name,
        fromEmail,
        sequence: data.sequence,
        trackOpens: data.trackOpens,
        trackClicks: data.trackClicks,
        dailyLimit: data.dailyLimit
      }

      result = await createInstantlyCampaign(config)
    }

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to create campaign',
          details: result.error
        },
        { status: 500 }
      )
    }

    console.log(` Created Instantly campaign: ${result.campaignId} for user ${userId}`)

    return NextResponse.json({
      success: true,
      campaignId: result.campaignId,
      message: `Campaign "${data.name}" created successfully`
    })
  } catch (error) {
    console.error('[CAMPAIGN-CREATE] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create campaign',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/instantly/campaign/create
 * Get available campaign templates
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const templates = Object.entries(WELLS_CAMPAIGN_TEMPLATES).map(([key, value]) => ({
      id: key,
      name: value.name,
      steps: value.sequence.length,
      preview: value.sequence[0].subject
    }))

    return NextResponse.json({
      templates
    })
  } catch (error) {
    console.error('[CAMPAIGN-CREATE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get templates' },
      { status: 500 }
    )
  }
}
