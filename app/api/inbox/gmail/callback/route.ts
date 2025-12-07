/**
 * Gmail OAuth Callback Handler
 * GET /api/inbox/gmail/callback
 *
 * Handles the OAuth callback from Google, exchanges code for tokens,
 * saves the account, and triggers initial sync
 */

import { NextRequest, NextResponse } from 'next/server'
import { handleOAuthCallback } from '@/lib/inbox/providers/gmail'
import { storeOAuthTokens } from '@/lib/integrations'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Check for OAuth errors
    if (error) {
      console.error('[Gmail Callback] OAuth error:', error)
      return NextResponse.redirect(
        new URL(
          `/inbox?error=${encodeURIComponent('Gmail authorization failed: ' + error)}`,
          request.url
        )
      )
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.json(
        { success: false, error: 'Missing code or state parameter' },
        { status: 400 }
      )
    }

    // Decode state to get userId
    let userId: string
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'))
      userId = stateData.userId

      if (!userId) {
        throw new Error('userId not found in state')
      }
    } catch (error) {
      console.error('[Gmail Callback] Invalid state:', error)
      return NextResponse.json(
        { success: false, error: 'Invalid state parameter' },
        { status: 400 }
      )
    }

    // Get redirect URI if provided
    const redirectUri = searchParams.get('redirect_uri') || process.env.GOOGLE_REDIRECT_URI

    // Handle OAuth callback and save account
    const account = await handleOAuthCallback(code, userId, redirectUri)

    console.log(`[Gmail Callback] Account connected: ${account.email} for user ${userId}`)

    // Also store in channel_integrations table for unified inbox
    await storeOAuthTokens(
      userId,
      'gmail',
      {
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_in: Math.floor((account.expires_at.getTime() - Date.now()) / 1000),
        scope: 'gmail',
      },
      {
        name: account.email,
        id: account.id,
      }
    )

    // Redirect back to inbox with success
    return NextResponse.redirect(
      new URL(
        `/inbox?gmail_connected=${encodeURIComponent(account.email)}`,
        request.url
      )
    )
  } catch (error: any) {
    console.error('[Gmail Callback] Error:', error)

    // Redirect with error message
    return NextResponse.redirect(
      new URL(
        `/inbox?error=${encodeURIComponent('Failed to connect Gmail: ' + error.message)}`,
        request.url
      )
    )
  }
}
