/**
 * Calendar Connection Management
 *
 * Initiate OAuth flow to connect calendar
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { generateAuthorizationUrl, validateOAuthConfig } from '@/lib/integrations/calendar/oauth'
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
    const { provider, isPrimary, returnUrl } = body as {
      provider: CalendarProvider
      isPrimary?: boolean
      returnUrl?: string
    }

    if (!provider || !['google', 'microsoft', 'apple'].includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider. Must be: google, microsoft, or apple' },
        { status: 400 }
      )
    }

    // Validate OAuth configuration for this provider
    const validation = validateOAuthConfig(provider)
    if (!validation.valid) {
      console.error(`[Calendar Connect] ${provider} OAuth not configured:`, validation.errors)
      return NextResponse.json(
        {
          error: `${provider} calendar integration is not configured`,
          details: validation.errors
        },
        { status: 503 }
      )
    }

    // Generate authorization URL
    const authUrl = generateAuthorizationUrl(
      provider,
      userId,
      isPrimary || false,
      returnUrl
    )

    return NextResponse.json({
      success: true,
      authorizationUrl: authUrl,
      provider
    })
  } catch (error) {
    console.error('[Calendar Connect] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to initiate calendar connection',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
