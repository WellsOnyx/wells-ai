/**
 * POST /api/calendar/schedule
 * Schedule a meeting via calendar integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { CalendarService, rateLimiter } from '@/lib/integrations/calendar'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const canProceed = await rateLimiter.checkLimit(userId)
    if (!canProceed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const {
      title,
      description,
      startTime,
      endTime,
      durationMinutes,
      attendees,
      location,
      timezone,
    } = body

    // Validation
    if (!title || !startTime || !attendees || attendees.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: title, startTime, attendees' },
        { status: 400 }
      )
    }

    // Schedule meeting
    const booking = await CalendarService.scheduleMeeting(userId, {
      title,
      description,
      startTime,
      endTime,
      durationMinutes: durationMinutes || 30,
      attendees,
      location,
      timezone: timezone || 'America/Los_Angeles',
    })

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        uid: booking.uid,
        title: booking.title,
        startTime: booking.startTime,
        endTime: booking.endTime,
        attendees: booking.attendees,
        meetingUrl: booking.meetingUrl,
        location: booking.location,
        status: booking.status,
      },
    })
  } catch (error: any) {
    console.error('[CALENDAR] Schedule error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to schedule meeting' },
      { status: 500 }
    )
  }
}
