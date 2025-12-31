/**
 * Trust Profile API
 *
 * GET /api/trust/profile - Get current user's trust profile
 * GET /api/trust/profile?userId=xxx - Get specific user's trust summary
 * POST /api/trust/profile - Create/update trust profile
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getTrustProfile,
  getOrCreateTrustProfile,
  getTrustSummary,
  recalculateTrustScore,
  JourneyType,
} from '@/lib/reputation'

export async function GET(request: NextRequest) {
  try {
    const { userId: currentUserId } = await auth()
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('userId')

    // If requesting another user, return public summary only
    if (targetUserId && targetUserId !== currentUserId) {
      const summary = await getTrustSummary(targetUserId)
      if (!summary) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      return NextResponse.json({ summary })
    }

    // Must be authenticated to get own profile
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get full profile for current user
    const profile = await getTrustProfile(currentUserId)
    const summary = await getTrustSummary(currentUserId)

    return NextResponse.json({
      profile,
      summary,
    })
  } catch (error) {
    console.error('Trust profile error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get profile' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { journey, recalculate } = body

    // Create or get profile
    const profile = await getOrCreateTrustProfile(
      userId,
      (journey as JourneyType) || 'buyer'
    )

    // Optionally recalculate score
    let calculation = null
    if (recalculate) {
      calculation = await recalculateTrustScore(userId)
    }

    const summary = await getTrustSummary(userId)

    return NextResponse.json({
      profile,
      summary,
      calculation,
    })
  } catch (error) {
    console.error('Trust profile error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create profile' },
      { status: 500 }
    )
  }
}
