/**
 * GET /api/auth/gmail/callback
 * OAuth callback handler for Gmail
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { PrismaClient } from '@prisma/client'
import {
  exchangeGmailCode,
  getGmailUserEmail
} from '@/lib/email/gmail'
import {
  encryptCredential,
  getUserEncryptionKey
} from '@/lib/settings/credential-storage'

const prisma = new PrismaClient()

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state') // userId
    const error = searchParams.get('error')

    // Check for OAuth errors
    if (error) {
      console.error('[GMAIL-OAUTH] OAuth error:', error)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/email?error=oauth_failed&message=${encodeURIComponent(error)}`
      )
    }

    // Validate code
    if (!code) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/email?error=missing_code`
      )
    }

    // Authenticate user
    const { userId: authenticatedUserId } = await auth()

    if (!authenticatedUserId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?redirect=/settings/email`
      )
    }

    // Verify state matches authenticated user
    if (state && state !== authenticatedUserId) {
      console.error('[GMAIL-OAUTH] State mismatch - possible CSRF')
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/email?error=invalid_state`
      )
    }

    // Exchange code for tokens
    console.log('[GMAIL-OAUTH] Exchanging authorization code for tokens...')
    const tokens = await exchangeGmailCode(code)

    // Get user's email address
    const emailAddress = await getGmailUserEmail(tokens.access_token)
    console.log(`[GMAIL-OAUTH] Authenticated as: ${emailAddress}`)

    // Encrypt tokens
    const userKey = getUserEncryptionKey(authenticatedUserId)
    const encryptedAccessToken = encryptCredential(tokens.access_token, userKey)
    const encryptedRefreshToken = encryptCredential(tokens.refresh_token, userKey)

    // Save to database
    await prisma.userEmailConfig.upsert({
      where: { userId: authenticatedUserId },
      update: {
        provider: 'GMAIL_OAUTH',
        fromEmail: emailAddress,
        oauthToken: encryptedAccessToken,
        oauthRefresh: encryptedRefreshToken,
        oauthExpiry: new Date(tokens.expiry_date),
        isVerified: true,
        testStatus: 'SUCCESS',
        updatedAt: new Date()
      },
      create: {
        userId: authenticatedUserId,
        provider: 'GMAIL_OAUTH',
        fromEmail: emailAddress,
        oauthToken: encryptedAccessToken,
        oauthRefresh: encryptedRefreshToken,
        oauthExpiry: new Date(tokens.expiry_date),
        isVerified: true,
        testStatus: 'SUCCESS'
      }
    })

    console.log(`✅ Gmail OAuth configured for user ${authenticatedUserId}`)

    // Redirect to settings with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/email?success=gmail_connected&email=${encodeURIComponent(emailAddress)}`
    )
  } catch (error) {
    console.error('[GMAIL-OAUTH] Callback error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/email?error=oauth_failed&message=${encodeURIComponent(errorMessage)}`
    )
  }
}
