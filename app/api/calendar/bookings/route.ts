/**
 * GET /api/calendar/bookings
 * Get user's upcoming calendar bookings
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { CalendarService } from '@/lib/integrations/calendar'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get upcoming bookings
    const bookings = await CalendarService.getUpcomingBookings(userId)

    return NextResponse.json({
      success: true,
      bookings: bookings.map(b => ({
        id: b.id,
        uid: b.uid,
        title: b.title,
        startTime: b.startTime,
        endTime: b.endTime,
        attendees: b.attendees,
        meetingUrl: b.meetingUrl,
        location: b.location,
        status: b.status,
      })),
    })
  } catch (error: any) {
    console.error('[CALENDAR] Bookings error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get bookings' },
      { status: 500 }
    )
  }
}
