/**
 * Microsoft Outlook/365 OAuth Callback
 *
 * Handles OAuth authorization code exchange and saves connection
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { exchangeCodeForTokens, getUserInfo } from '@/lib/integrations/calendar/oauth'
import { UnifiedCalendarService } from '@/lib/integrations/calendar/unified'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // Handle OAuth errors
    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/calendar?error=${encodeURIComponent(
          errorDescription || error
        )}`
      )
    }

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing authorization code or state' },
        { status: 400 }
      )
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens('microsoft', code, state)

    // Get user info from Microsoft Graph
    const userInfo = await getUserInfo('microsoft', tokens.accessToken)

    // Save connection to database
    await UnifiedCalendarService.saveConnection(
      userId,
      'microsoft',
      tokens,
      userInfo.email,
      userInfo.displayName || userInfo.email,
      userInfo.id,
      false // isPrimary - user can set this in settings
    )

    // Redirect to settings with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/calendar?success=microsoft`
    )
  } catch (error) {
    console.error('[Microsoft OAuth Callback] Error:', error)

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/calendar?error=${encodeURIComponent(
        error instanceof Error ? error.message : 'Failed to connect Microsoft Calendar'
      )}`
    )
  }
}
