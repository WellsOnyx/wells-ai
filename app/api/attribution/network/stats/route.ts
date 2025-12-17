// Attribution Network Stats API
// GET: Get dashboard stats

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getNetworkStatsResponse, getLeaderboard } from '@/lib/attribution/network-service'

export async function GET(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeLeaderboard = searchParams.get('leaderboard') === 'true'

    const stats = await getNetworkStatsResponse(userId)

    if (includeLeaderboard) {
      const leaderboard = await getLeaderboard(10)
      return NextResponse.json({ stats, leaderboard })
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Error getting network stats:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get network stats' },
      { status: 500 }
    )
  }
}
