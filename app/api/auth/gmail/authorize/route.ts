/**
 * GET /api/auth/gmail/authorize
 * Initiate Gmail OAuth flow
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getGmailAuthUrl } from '@/lib/email/gmail'

export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?redirect=/settings/email`
      )
    }

    // Generate OAuth URL
    const authUrl = getGmailAuthUrl(userId)

    console.log(`[GMAIL-OAUTH] Redirecting user ${userId} to Gmail authorization`)

    // Redirect to Google OAuth
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('[GMAIL-OAUTH] Authorization error:', error)

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/email?error=auth_failed`
    )
  }
}
