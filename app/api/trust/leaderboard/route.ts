/**
 * Trust Leaderboard API
 *
 * GET /api/trust/leaderboard - Get trust leaderboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { getLeaderboard, JourneyType } from '@/lib/reputation'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const journey = searchParams.get('journey') as JourneyType | null
    const limit = parseInt(searchParams.get('limit') || '50')

    const leaderboard = await getLeaderboard(journey || undefined, limit)

    return NextResponse.json({ leaderboard })
  } catch (error) {
    console.error('Leaderboard error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get leaderboard' },
      { status: 500 }
    )
  }
}
