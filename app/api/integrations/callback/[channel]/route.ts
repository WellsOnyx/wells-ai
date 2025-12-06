import { NextRequest, NextResponse } from 'next/server'
import { storeOAuthTokens, updateIntegrationStatus } from '@/lib/integrations'
import { Channel } from '@/lib/inbox'

export const dynamic = 'force-dynamic'

// OAuth token endpoints for each provider
const TOKEN_ENDPOINTS: Record<string, string> = {
  gmail: 'https://oauth2.googleapis.com/token',
  outlook: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  slack: 'https://slack.com/api/oauth.v2.access',
  twitter: 'https://api.twitter.com/2/oauth2/token',
  instagram: 'https://api.instagram.com/oauth/access_token',
  linkedin: 'https://www.linkedin.com/oauth/v2/accessToken',
}

// User info endpoints to get account name
const USER_INFO_ENDPOINTS: Record<string, string> = {
  gmail: 'https://www.googleapis.com/oauth2/v2/userinfo',
  outlook: 'https://graph.microsoft.com/v1.0/me',
  slack: 'https://slack.com/api/users.identity',
  twitter: 'https://api.twitter.com/2/users/me',
  linkedin: 'https://api.linkedin.com/v2/me',
}

// GET /api/integrations/callback/[channel] - OAuth callback
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channel: string }> }
) {
  try {
    const { channel } = await params
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // Base URL for redirects
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wellsonyx.io'
    const settingsUrl = `${baseUrl}/settings/integrations`

    // Handle OAuth errors
    if (error) {
      console.error(`[OAuth] Error for ${channel}:`, error, errorDescription)
      return NextResponse.redirect(
        `${settingsUrl}?error=${encodeURIComponent(errorDescription || error)}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${settingsUrl}?error=${encodeURIComponent('Missing authorization code')}`
      )
    }

    // Decode state to get userId and channel
    let stateData: { userId: string; channel: string }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    } catch {
      return NextResponse.redirect(
        `${settingsUrl}?error=${encodeURIComponent('Invalid state parameter')}`
      )
    }

    const { userId } = stateData

    if (!userId) {
      return NextResponse.redirect(
        `${settingsUrl}?error=${encodeURIComponent('User not authenticated')}`
      )
    }

    // Exchange code for tokens
    const tokenEndpoint = TOKEN_ENDPOINTS[channel]
    if (!tokenEndpoint) {
      return NextResponse.redirect(
        `${settingsUrl}?error=${encodeURIComponent('Unsupported OAuth provider')}`
      )
    }

    const redirectUri = `${baseUrl}/api/integrations/callback/${channel}`

    const tokenResponse = await exchangeCodeForTokens(
      channel,
      code,
      redirectUri,
      tokenEndpoint
    )

    if (!tokenResponse.success) {
      await updateIntegrationStatus(userId, channel as Channel, 'error', tokenResponse.error)
      return NextResponse.redirect(
        `${settingsUrl}?error=${encodeURIComponent(tokenResponse.error || 'Failed to get tokens')}`
      )
    }

    // Get user info
    const accountInfo = await getUserInfo(channel, tokenResponse.access_token)

    // Store tokens in database
    await storeOAuthTokens(
      userId,
      channel as Channel,
      {
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        expires_in: tokenResponse.expires_in,
        scope: tokenResponse.scope,
      },
      accountInfo
    )

    console.log(`[OAuth] Successfully connected ${channel} for user ${userId}`)

    return NextResponse.redirect(`${settingsUrl}?success=${channel}`)
  } catch (error: any) {
    console.error('[OAuth] Callback error:', error)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wellsonyx.io'
    return NextResponse.redirect(
      `${baseUrl}/settings/integrations?error=${encodeURIComponent('OAuth callback failed')}`
    )
  }
}

// Exchange authorization code for tokens
async function exchangeCodeForTokens(
  channel: string,
  code: string,
  redirectUri: string,
  tokenEndpoint: string
): Promise<{
  success: boolean
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  error?: string
}> {
  const clientId = getClientId(channel)
  const clientSecret = getClientSecret(channel)

  if (!clientId || !clientSecret) {
    return { success: false, error: `OAuth not configured for ${channel}` }
  }

  try {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    })

    // Slack needs different format
    if (channel === 'slack') {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      })

      const data = await response.json()

      if (!data.ok) {
        return { success: false, error: data.error || 'Slack OAuth failed' }
      }

      return {
        success: true,
        access_token: data.authed_user?.access_token || data.access_token,
        refresh_token: data.refresh_token,
        scope: data.scope,
      }
    }

    // Twitter uses Basic auth
    if (channel === 'twitter') {
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      params.delete('client_id')
      params.delete('client_secret')
      params.set('code_verifier', 'challenge') // Simplified - should use PKCE

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${basicAuth}`,
        },
        body: params.toString(),
      })

      const data = await response.json()

      if (data.error) {
        return { success: false, error: data.error_description || data.error }
      }

      return {
        success: true,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        scope: data.scope,
      }
    }

    // Instagram uses form data
    if (channel === 'instagram') {
      const formData = new FormData()
      formData.append('client_id', clientId)
      formData.append('client_secret', clientSecret)
      formData.append('code', code)
      formData.append('redirect_uri', redirectUri)
      formData.append('grant_type', 'authorization_code')

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.error_message) {
        return { success: false, error: data.error_message }
      }

      return {
        success: true,
        access_token: data.access_token,
        // Instagram short-lived tokens - would need to exchange for long-lived
      }
    }

    // Standard OAuth2 flow (Gmail, Outlook, LinkedIn)
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    const data = await response.json()

    if (data.error) {
      return { success: false, error: data.error_description || data.error }
    }

    return {
      success: true,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      scope: data.scope,
    }
  } catch (error: any) {
    console.error(`[OAuth] Token exchange error for ${channel}:`, error)
    return { success: false, error: error.message }
  }
}

// Get user info from the provider
async function getUserInfo(
  channel: string,
  accessToken: string
): Promise<{ name?: string; id?: string }> {
  const endpoint = USER_INFO_ENDPOINTS[channel]
  if (!endpoint) return {}

  try {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const data = await response.json()

    switch (channel) {
      case 'gmail':
        return { name: data.email, id: data.id }
      case 'outlook':
        return { name: data.mail || data.userPrincipalName, id: data.id }
      case 'slack':
        return { name: data.user?.name || data.user?.email, id: data.user?.id }
      case 'twitter':
        return { name: `@${data.data?.username}`, id: data.data?.id }
      case 'linkedin':
        return {
          name: `${data.localizedFirstName} ${data.localizedLastName}`,
          id: data.id
        }
      default:
        return {}
    }
  } catch (error) {
    console.error(`[OAuth] Error fetching user info for ${channel}:`, error)
    return {}
  }
}

// Get client ID from environment
function getClientId(channel: string): string {
  const envMap: Record<string, string> = {
    gmail: process.env.GOOGLE_CLIENT_ID || '',
    outlook: process.env.MICROSOFT_CLIENT_ID || '',
    slack: process.env.SLACK_CLIENT_ID || '',
    twitter: process.env.TWITTER_CLIENT_ID || '',
    instagram: process.env.INSTAGRAM_CLIENT_ID || '',
    linkedin: process.env.LINKEDIN_CLIENT_ID || '',
  }
  return envMap[channel] || ''
}

// Get client secret from environment
function getClientSecret(channel: string): string {
  const envMap: Record<string, string> = {
    gmail: process.env.GOOGLE_CLIENT_SECRET || '',
    outlook: process.env.MICROSOFT_CLIENT_SECRET || '',
    slack: process.env.SLACK_CLIENT_SECRET || '',
    twitter: process.env.TWITTER_CLIENT_SECRET || '',
    instagram: process.env.INSTAGRAM_CLIENT_SECRET || '',
    linkedin: process.env.LINKEDIN_CLIENT_SECRET || '',
  }
  return envMap[channel] || ''
}
