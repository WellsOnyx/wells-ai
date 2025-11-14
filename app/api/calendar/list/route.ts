/**
 * List Connected Calendars
 *
 * Get user's connected calendar accounts
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { UnifiedCalendarService } from '@/lib/integrations/calendar/unified'

export async function GET(request: NextRequest) {
  try {
    const authResult = await auth()
    const userId = authResult.userId

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    // Get all connected calendars
    const connections = await UnifiedCalendarService.getConnections(userId)

    // Remove sensitive data before sending to client
    const safeConnections = connections.map(conn => ({
      id: conn.id,
      provider: conn.provider,
      email: conn.email,
      displayName: conn.displayName,
      connected: conn.connected,
      isPrimary: conn.isPrimary,
      createdAt: conn.createdAt,
      lastSyncAt: conn.lastSyncAt
    }))

    return NextResponse.json({
      success: true,
      connections: safeConnections,
      count: safeConnections.length
    })
  } catch (error) {
    console.error('[Calendar List] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to list calendars',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
