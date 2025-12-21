/**
 * Debug endpoint to check Google OAuth configuration
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || ''
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || ''
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || ''

    // Check for issues
    const issues: string[] = []

    if (!clientId) {
      issues.push('GOOGLE_CLIENT_ID is not set')
    } else if (clientId.includes('\n') || clientId.includes('\r')) {
      issues.push('GOOGLE_CLIENT_ID contains newline characters')
    } else if (!clientId.includes('.apps.googleusercontent.com')) {
      issues.push('GOOGLE_CLIENT_ID does not look like a valid Google Client ID')
    }

    if (!clientSecret) {
      issues.push('GOOGLE_CLIENT_SECRET is not set')
    } else if (clientSecret.includes('\n') || clientSecret.includes('\r')) {
      issues.push('GOOGLE_CLIENT_SECRET contains newline characters')
    }

    if (!redirectUri) {
      issues.push('GOOGLE_REDIRECT_URI is not set')
    } else if (redirectUri.includes('\n') || redirectUri.includes('\r')) {
      issues.push('GOOGLE_REDIRECT_URI contains newline characters')
    }

    // Generate the actual OAuth URL to see what it looks like
    let oauthUrl = ''
    let oauthError = ''
    try {
      const { getAuthUrl } = await import('@/lib/inbox/providers/gmail')
      oauthUrl = getAuthUrl(userId, undefined, '/settings/integrations')
    } catch (e: any) {
      oauthError = e.message
    }

    return NextResponse.json({
      status: issues.length === 0 ? 'OK' : 'ISSUES_FOUND',
      issues,
      config: {
        clientId: clientId ? `${clientId.substring(0, 20)}...` : 'NOT SET',
        clientIdLength: clientId.length,
        clientSecretSet: !!clientSecret,
        clientSecretLength: clientSecret.length,
        redirectUri: redirectUri || 'NOT SET',
      },
      oauthUrl: oauthUrl ? oauthUrl.substring(0, 200) + '...' : 'FAILED TO GENERATE',
      oauthError,
      // Show the actual client_id in the URL
      urlClientId: oauthUrl ? new URL(oauthUrl).searchParams.get('client_id') : null,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
