/**
 * Calendar Availability API
 *
 * Check free/busy status across connected calendars
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { UnifiedCalendarService } from '@/lib/integrations/calendar/unified'
import { CheckAvailabilityRequest } from '@/lib/integrations/calendar/types'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const availabilityRequest = body as CheckAvailabilityRequest

    // Validate required fields
    if (!availabilityRequest.startDate || !availabilityRequest.endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    const availability = await UnifiedCalendarService.checkAvailability(
      userId,
      availabilityRequest
    )

    return NextResponse.json({
      success: true,
      availability
    })
  } catch (error) {
    console.error('[Calendar Availability] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to check availability',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET - Quick availability check (simplified)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate') || new Date().toISOString()
    const endDate = searchParams.get('endDate') || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const provider = searchParams.get('provider') as any
    const durationMinutes = parseInt(searchParams.get('durationMinutes') || '30')

    const availability = await UnifiedCalendarService.checkAvailability(userId, {
      provider,
      startDate,
      endDate,
      durationMinutes
    })

    return NextResponse.json({
      success: true,
      availability
    })
  } catch (error) {
    console.error('[Calendar Availability GET] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to check availability',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
