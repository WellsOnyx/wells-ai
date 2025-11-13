/**
 * GET /api/calendar/status
 * Get user's calendar connection status
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

    // Get connection
    const connection = await CalendarService.getConnection(userId)

    if (!connection) {
      return NextResponse.json({
        connected: false,
        provider: null,
        calendarEmail: null,
      })
    }

    return NextResponse.json({
      connected: connection.connected,
      provider: connection.provider,
      calendarEmail: connection.calendarEmail,
      lastSyncAt: connection.lastSyncAt,
    })
  } catch (error: any) {
    console.error('[CALENDAR] Status error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get calendar status' },
      { status: 500 }
    )
  }
}
