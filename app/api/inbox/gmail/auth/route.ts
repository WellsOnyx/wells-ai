/**
 * Gmail OAuth Authentication Initiation
 * GET /api/inbox/gmail/auth
 *
 * Starts the OAuth flow by redirecting to Google
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAuthUrl } from '@/lib/inbox/providers/gmail'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get userId from Clerk session
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - please sign in' },
        { status: 401 }
      )
    }

    // Validate environment variables
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('[Gmail Auth] Missing credentials:', {
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        hasRedirectUri: !!process.env.GOOGLE_REDIRECT_URI
      })
      return NextResponse.json(
        {
          success: false,
          error: 'Gmail integration not configured. Please contact support.',
        },
        { status: 500 }
      )
    }

    // Get redirect URI from query or use default
    const searchParams = request.nextUrl.searchParams
    const redirectUri = searchParams.get('redirect_uri') || process.env.GOOGLE_REDIRECT_URI

    // Generate OAuth URL
    const authUrl = getAuthUrl(userId, redirectUri)

    // Return the auth URL for the frontend to redirect
    return NextResponse.json({
      success: true,
      authUrl,
    })
  } catch (error: any) {
    console.error('[Gmail Auth] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
