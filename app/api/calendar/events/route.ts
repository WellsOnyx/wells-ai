/**
 * Calendar Events API
 *
 * CRUD operations for calendar events
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { UnifiedCalendarService } from '@/lib/integrations/calendar/unified'
import {
  CreateEventRequest,
  UpdateEventRequest,
  DeleteEventRequest,
  ListEventsRequest
} from '@/lib/integrations/calendar/types'

/**
 * GET - List calendar events
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
    const listRequest: ListEventsRequest = {
      provider: searchParams.get('provider') as any,
      startDate: searchParams.get('startDate') || new Date().toISOString(),
      endDate: searchParams.get('endDate') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      maxResults: parseInt(searchParams.get('maxResults') || '100'),
      showDeleted: searchParams.get('showDeleted') === 'true',
      search: searchParams.get('search') || undefined
    }

    const events = await UnifiedCalendarService.listEvents(userId, listRequest)

    return NextResponse.json({
      success: true,
      events,
      count: events.length
    })
  } catch (error) {
    console.error('[Calendar Events GET] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to list events',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST - Create calendar event
 */
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
    const createRequest = body as CreateEventRequest

    // Validate required fields
    if (!createRequest.title) {
      return NextResponse.json(
        { error: 'Event title is required' },
        { status: 400 }
      )
    }

    if (!createRequest.startTime || !createRequest.endTime) {
      return NextResponse.json(
        { error: 'Start time and end time are required' },
        { status: 400 }
      )
    }

    const event = await UnifiedCalendarService.createEvent(userId, createRequest)

    return NextResponse.json({
      success: true,
      event,
      message: 'Event created successfully'
    })
  } catch (error) {
    console.error('[Calendar Events POST] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to create event',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Update calendar event
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const updateRequest = body as UpdateEventRequest

    if (!updateRequest.eventId || !updateRequest.provider) {
      return NextResponse.json(
        { error: 'Event ID and provider are required' },
        { status: 400 }
      )
    }

    const event = await UnifiedCalendarService.updateEvent(userId, updateRequest)

    return NextResponse.json({
      success: true,
      event,
      message: 'Event updated successfully'
    })
  } catch (error) {
    console.error('[Calendar Events PATCH] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to update event',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Delete calendar event
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const deleteRequest = body as DeleteEventRequest

    if (!deleteRequest.eventId || !deleteRequest.provider) {
      return NextResponse.json(
        { error: 'Event ID and provider are required' },
        { status: 400 }
      )
    }

    await UnifiedCalendarService.deleteEvent(userId, deleteRequest)

    return NextResponse.json({
      success: true,
      message: 'Event deleted successfully'
    })
  } catch (error) {
    console.error('[Calendar Events DELETE] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to delete event',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
