/**
 * Partner Leaderboard API
 *
 * GET - Get top partners leaderboard (public)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getLeaderboard } from '@/lib/partners/service'

export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20')
    const leaderboard = await getLeaderboard(limit)

    return NextResponse.json({ leaderboard })
  } catch (error) {
    console.error('Leaderboard GET error:', error)
    return NextResponse.json({ error: 'Failed to get leaderboard' }, { status: 500 })
  }
}
