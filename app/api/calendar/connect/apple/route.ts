/**
 * Apple Calendar OAuth Callback (Sign in with Apple)
 *
 * Handles OAuth authorization code exchange and saves connection
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { exchangeCodeForTokens } from '@/lib/integrations/calendar/oauth'
import { UnifiedCalendarService } from '@/lib/integrations/calendar/unified'

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    // Apple uses form_post response_mode, so we get data in POST body
    const formData = await request.formData()
    const code = formData.get('code') as string
    const state = formData.get('state') as string
    const error = formData.get('error') as string
    const user = formData.get('user') as string // JSON string with user info (only first time)

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
    const tokens = await exchangeCodeForTokens('apple', code, state)

    // Parse user info (only provided on first authorization)
    let userInfo = {
      email: '',
      displayName: '',
      id: ''
    }

    if (user) {
      try {
        const userData = JSON.parse(user)
        userInfo = {
          email: userData.email || '',
          displayName: `${userData.name?.firstName || ''} ${userData.name?.lastName || ''}`.trim(),
          id: userData.sub || ''
        }
      } catch (e) {
        console.error('Failed to parse Apple user data:', e)
      }
    }

    // If no user info provided (subsequent logins), we need to get it from stored connection
    // For now, we'll use a placeholder and require user to enter it
    if (!userInfo.email) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/calendar/apple-setup?state=${state}`
      )
    }

    // Save connection to database
    await UnifiedCalendarService.saveConnection(
      userId,
      'apple',
      tokens,
      userInfo.email,
      userInfo.displayName || userInfo.email,
      userInfo.id,
      false // isPrimary - user can set this in settings
    )

    // Redirect to settings with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/calendar?success=apple`
    )
  } catch (error) {
    console.error('[Apple OAuth Callback] Error:', error)

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/calendar?error=${encodeURIComponent(
        error instanceof Error ? error.message : 'Failed to connect Apple Calendar'
      )}`
    )
  }
}

// Also support GET for testing
export async function GET(request: NextRequest) {
  return POST(request)
}
