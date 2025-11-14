/**
 * Google Calendar OAuth Callback
 *
 * Handles OAuth authorization code exchange and saves connection
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { exchangeCodeForTokens, getUserInfo } from '@/lib/integrations/calendar/oauth'
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle OAuth errors
    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/calendar?error=${encodeURIComponent(error)}`
      )
    }

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing authorization code or state' },
        { status: 400 }
      )
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens('google', code, state)

    // Get user info from Google
    const userInfo = await getUserInfo('google', tokens.accessToken)

    // Save connection to database
    await UnifiedCalendarService.saveConnection(
      userId,
      'google',
      tokens,
      userInfo.email,
      userInfo.displayName || userInfo.email,
      userInfo.id,
      false // isPrimary - user can set this in settings
    )

    // Redirect to settings with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/calendar?success=google`
    )
  } catch (error) {
    console.error('[Google OAuth Callback] Error:', error)

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/calendar?error=${encodeURIComponent(
        error instanceof Error ? error.message : 'Failed to connect Google Calendar'
      )}`
    )
  }
}
