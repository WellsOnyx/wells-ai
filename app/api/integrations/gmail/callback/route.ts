// @ts-nocheck
/**
 * Gmail OAuth Callback Handler
 *
 * Handles the OAuth callback from Google after user authorizes Gmail access.
 * Exchanges auth code for tokens and stores the connected account.
 */

import { NextRequest, NextResponse } from 'next/server'
import { exchangeGmailCode, connectEmailAccount } from '@/lib/email/email-passthrough'
import { query } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

// ============================================================================
// CALLBACK HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Handle OAuth errors
  if (error) {
    console.error('[Gmail OAuth] Authorization denied:', error)
    return NextResponse.redirect(
      new URL(`/settings/integrations?error=${encodeURIComponent(error)}`, request.url)
    )
  }

  // Validate required params
  if (!code) {
    console.error('[Gmail OAuth] Missing authorization code')
    return NextResponse.redirect(
      new URL('/settings/integrations?error=missing_code', request.url)
    )
  }

  // Parse state to get user ID and redirect URL
  let userId: string
  let redirectUrl: string = '/settings/integrations'

  try {
    if (state) {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
      userId = stateData.userId
      redirectUrl = stateData.redirectUrl || redirectUrl
    } else {
      // Fallback: try to get user from session/cookie
      // This is a simplified version - in production, verify the session
      userId = 'unknown'
    }
  } catch (e) {
    console.error('[Gmail OAuth] Failed to parse state:', e)
    userId = 'unknown'
  }

  try {
    // Exchange code for tokens
    console.log('[Gmail OAuth] Exchanging code for tokens...')
    const tokenData = await exchangeGmailCode(code)

    console.log(`[Gmail OAuth] Got tokens for ${tokenData.email}`)

    // Verify we have a valid user ID
    if (userId === 'unknown') {
      // Try to find user by email
      const userResult = await query(
        `SELECT id FROM users WHERE email = $1 LIMIT 1`,
        [tokenData.email]
      )

      if (userResult?.rows?.[0]) {
        userId = userResult.rows[0].id
      } else {
        // Create a temporary session ID for guest users
        userId = `guest_${uuidv4()}`
      }
    }

    // Connect the email account
    const account = await connectEmailAccount(userId, 'gmail', {
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      expiryDate: tokenData.expiryDate,
      email: tokenData.email,
      name: tokenData.name,
    })

    console.log(`[Gmail OAuth] Connected account ${account.id} for user ${userId}`)

    // Log the connection event
    await logIntegrationEvent(userId, 'gmail', 'connected', {
      email: tokenData.email,
      accountId: account.id,
    })

    // Redirect with success
    const successUrl = new URL(redirectUrl, request.url)
    successUrl.searchParams.set('success', 'gmail_connected')
    successUrl.searchParams.set('email', tokenData.email)

    return NextResponse.redirect(successUrl)
  } catch (error: any) {
    console.error('[Gmail OAuth] Failed to exchange code:', error)

    // Log the failure
    await logIntegrationEvent(userId, 'gmail', 'connection_failed', {
      error: error.message,
    })

    const errorUrl = new URL(redirectUrl, request.url)
    errorUrl.searchParams.set('error', 'gmail_connection_failed')
    errorUrl.searchParams.set('message', encodeURIComponent(error.message || 'Unknown error'))

    return NextResponse.redirect(errorUrl)
  }
}

// ============================================================================
// OAUTH INITIATION ENDPOINT
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, redirectUrl } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      )
    }

    // Import here to avoid circular dependency
    const { getGmailAuthUrl } = await import('@/lib/email/email-passthrough')

    // Create state with user info
    const state = Buffer.from(
      JSON.stringify({
        userId,
        redirectUrl: redirectUrl || '/settings/integrations',
        timestamp: Date.now(),
      })
    ).toString('base64')

    const authUrl = getGmailAuthUrl(state)

    return NextResponse.json({ authUrl })
  } catch (error: any) {
    console.error('[Gmail OAuth] Failed to generate auth URL:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to initiate OAuth' },
      { status: 500 }
    )
  }
}

// ============================================================================
// HELPERS
// ============================================================================

async function logIntegrationEvent(
  userId: string,
  provider: string,
  event: string,
  metadata: Record<string, any>
): Promise<void> {
  try {
    await query(
      `INSERT INTO integration_events (id, user_id, provider, event, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [uuidv4(), userId, provider, event, JSON.stringify(metadata)]
    )
  } catch (error) {
    console.error('[Gmail OAuth] Failed to log event:', error)
  }
}
