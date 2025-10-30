import { NextRequest, NextResponse } from 'next/server'
import { monitorAPI } from '@/lib/monitoring'
import { query } from '@/lib/db'

/**
 * Slack OAuth Handler
 * GET /api/slack/oauth
 *
 * Handles Slack app installation OAuth flow
 */
export async function GET(req: NextRequest) {
  const monitor = monitorAPI('/api/slack/oauth', 'GET')

  try {
    const searchParams = req.nextUrl.searchParams
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    // Handle OAuth error
    if (error) {
      monitor.end(false)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/integrations?error=slack_oauth_denied`
      )
    }

    // Verify code exists
    if (!code) {
      monitor.end(false)
      return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 })
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/slack/oauth`,
      }),
    })

    const tokenData = await tokenResponse.json()

    if (!tokenData.ok) {
      console.error('[SLACK] OAuth token error:', tokenData)
      monitor.end(false)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/integrations?error=slack_oauth_failed`
      )
    }

    // Store installation in database
    await query(
      `INSERT INTO slack_installations (
        team_id,
        team_name,
        bot_user_id,
        bot_token,
        scope,
        app_id,
        authed_user_id,
        authed_user_token,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (team_id) DO UPDATE SET
        bot_token = $4,
        scope = $5,
        updated_at = NOW()`,
      [
        tokenData.team.id,
        tokenData.team.name,
        tokenData.bot_user_id,
        tokenData.access_token,
        tokenData.scope,
        tokenData.app_id,
        tokenData.authed_user?.id,
        tokenData.authed_user?.access_token,
        JSON.stringify({
          incoming_webhook: tokenData.incoming_webhook,
          enterprise: tokenData.enterprise,
        }),
      ]
    )

    console.log('[SLACK] App installed successfully for team:', tokenData.team.name)

    monitor.end(true)

    // Redirect to success page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/integrations?success=slack_connected&team=${encodeURIComponent(tokenData.team.name)}`
    )
  } catch (error) {
    monitor.end(false)
    console.error('[SLACK] OAuth error:', error)

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/integrations?error=slack_oauth_error`
    )
  }
}

// Removed getSlackOAuthURL - not needed as route export
