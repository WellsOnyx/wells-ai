import { NextRequest, NextResponse } from 'next/server'
import { getActiveNegotiations } from '@/lib/negotiation-db'
import { monitorAPI } from '@/lib/monitoring'

/**
 * Get Active Negotiations
 * GET /api/negotiation/active
 *
 * Returns list of all active negotiation rooms
 */
export async function GET(req: NextRequest) {
  const monitor = monitorAPI('/api/negotiation/active', 'GET')

  try {
    const active = await getActiveNegotiations()

    monitor.end(true, { count: active.length })

    return NextResponse.json({
      negotiations: active,
      count: active.length,
    })
  } catch (error) {
    monitor.end(false)
    console.error('[API] Get active negotiations error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch active negotiations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
