/**
 * Disconnect Calendar
 *
 * Remove calendar connection and revoke tokens
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { UnifiedCalendarService } from '@/lib/integrations/calendar/unified'
import { revokeTokens } from '@/lib/integrations/calendar/oauth'
import { decryptCredential, getUserEncryptionKey } from '@/lib/settings/credential-storage'
import { CalendarProvider } from '@/lib/integrations/calendar/types'

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
    const { provider } = body as { provider: CalendarProvider }

    if (!provider || !['google', 'microsoft', 'apple'].includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider. Must be: google, microsoft, or apple' },
        { status: 400 }
      )
    }

    // Get connection to revoke tokens
    const connection = await UnifiedCalendarService.getConnection(userId, provider)

    if (connection) {
      // Decrypt and revoke access token
      try {
        const userKey = getUserEncryptionKey(userId)
        const accessToken = decryptCredential(connection.accessToken, userKey)
        await revokeTokens(provider, accessToken)
      } catch (error) {
        console.error(`[Calendar Disconnect] Failed to revoke ${provider} tokens:`, error)
        // Continue with disconnection even if revoke fails
      }
    }

    // Disconnect calendar (removes tokens from database)
    await UnifiedCalendarService.disconnectCalendar(userId, provider)

    return NextResponse.json({
      success: true,
      message: `${provider} calendar disconnected successfully`
    })
  } catch (error) {
    console.error('[Calendar Disconnect] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to disconnect calendar',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Support DELETE method for backward compatibility
export async function DELETE(request: NextRequest) {
  return POST(request)
}
