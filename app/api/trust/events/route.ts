/**
 * Trust Events API
 *
 * GET /api/trust/events - Get user's trust events
 * POST /api/trust/events - Record a new trust event
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  recordTrustEvent,
  getUserEvents,
  recalculateTrustScore,
} from '@/lib/reputation'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const includeExpired = searchParams.get('includeExpired') === 'true'

    const events = await getUserEvents(userId, limit, includeExpired)

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Trust events error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get events' },
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
    const {
      eventType,
      relatedEntityType,
      relatedEntityId,
      counterpartyId,
      description,
      metadata,
    } = body

    if (!eventType) {
      return NextResponse.json(
        { error: 'eventType is required' },
        { status: 400 }
      )
    }

    // Record the event
    const event = await recordTrustEvent({
      userId,
      eventType,
      relatedEntityType,
      relatedEntityId,
      counterpartyId,
      description,
      metadata,
    })

    // Get updated scores
    const calculation = await recalculateTrustScore(userId)

    return NextResponse.json({
      event,
      calculation,
    })
  } catch (error) {
    console.error('Trust event error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to record event' },
      { status: 500 }
    )
  }
}
