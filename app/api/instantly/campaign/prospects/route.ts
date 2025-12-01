/**
 * POST /api/instantly/campaign/prospects
 * Add prospects to Instantly campaign
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  addProspectsToCampaign,
  type InstantlyProspect
} from '@/lib/email/instantly'
import { z } from 'zod'

const ProspectSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  customVariables: z.record(z.string()).optional()
})

const AddProspectsSchema = z.object({
  campaignId: z.string().min(1),
  prospects: z.array(ProspectSchema).min(1)
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
    const validation = AddProspectsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validation.error.errors
        },
        { status: 400 }
      )
    }

    const { campaignId, prospects } = validation.data

    // Add prospects to campaign
    const result = await addProspectsToCampaign(campaignId, prospects)

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to add prospects',
          details: result.errors
        },
        { status: 500 }
      )
    }

    console.log(` Added ${result.added} prospects to campaign ${campaignId}`)

    return NextResponse.json({
      success: true,
      added: result.added,
      failed: result.failed,
      errors: result.errors,
      message: `Added ${result.added} prospect(s) to campaign`
    })
  } catch (error) {
    console.error('[PROSPECTS-ADD] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to add prospects',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
