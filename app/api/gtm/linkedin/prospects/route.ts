/**
 * LinkedIn Prospects API
 *
 * Manages prospect lists for LinkedIn campaigns
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  identifySweetSpotCandidates,
  type TargetCandidate
} from '@/lib/gtm/sourcing-engine'
import {
  generateConnectionRequest,
  generate3TouchSequence,
  type ConnectionRequest,
  type LinkedInMessage
} from '@/lib/gtm/linkedin-integration'
import type { RoleQualification } from '@/lib/gtm/sourcing-qualification'

/**
 * POST /api/gtm/linkedin/prospects
 * Generate prospect list from qualification
 *
 * This is where we apply the 80-90% targeting logic
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
      candidatePool
    }: {
      qualification: RoleQualification
      candidatePool: any[] // Raw candidates from LinkedIn, Apollo, etc.
    } = body

    if (!qualification) {
      return NextResponse.json(
        { error: 'Qualification required' },
        { status: 400 }
      )
    }

    if (!candidatePool || candidatePool.length === 0) {
      return NextResponse.json(
        { error: 'Candidate pool required' },
        { status: 400 }
      )
    }

    // Apply 80-90% targeting (Step 1 from PROPRIETARY_METHOD.md)
    const sweetSpotCandidates = await identifySweetSpotCandidates(
      qualification,
      candidatePool
    )

    console.log('[LINKEDIN_PROSPECTS]', {
      userId,
      totalCandidates: candidatePool.length,
      sweetSpotCandidates: sweetSpotCandidates.length,
      qualification: qualification.roleTitle
    })

    return NextResponse.json({
      success: true,
      prospects: sweetSpotCandidates,
      stats: {
        total: candidatePool.length,
        sweetSpot: sweetSpotCandidates.length,
        percentage: Math.round((sweetSpotCandidates.length / candidatePool.length) * 100)
      }
    })
  } catch (error: any) {
    console.error('[LINKEDIN_PROSPECTS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to generate prospect list' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/gtm/linkedin/prospects/messages
 * Generate connection requests and message sequences for prospects
 */
export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      prospects,
      qualification,
      campaignId
    }: {
      prospects: TargetCandidate[]
      qualification: RoleQualification
      campaignId: string
    } = body

    if (!prospects || prospects.length === 0) {
      return NextResponse.json(
        { error: 'Prospects required' },
        { status: 400 }
      )
    }

    if (!qualification) {
      return NextResponse.json(
        { error: 'Qualification required' },
        { status: 400 }
      )
    }

    // Generate connection requests
    const connectionRequests: ConnectionRequest[] = prospects.map(prospect =>
      generateConnectionRequest(prospect, qualification)
    )

    // Generate 3-touch sequences
    const messageSequences: Record<string, LinkedInMessage[]> = {}
    prospects.forEach(prospect => {
      messageSequences[prospect.id] = generate3TouchSequence(
        prospect,
        qualification,
        campaignId
      )
    })

    console.log('[LINKEDIN_MESSAGES_GENERATED]', {
      userId,
      prospects: prospects.length,
      connectionRequests: connectionRequests.length,
      messageSequences: Object.keys(messageSequences).length
    })

    return NextResponse.json({
      success: true,
      connectionRequests,
      messageSequences
    })
  } catch (error: any) {
    console.error('[LINKEDIN_PROSPECTS_MESSAGES_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to generate messages' },
      { status: 500 }
    )
  }
}
