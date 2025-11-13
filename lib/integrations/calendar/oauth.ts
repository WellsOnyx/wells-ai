/**
 * OAuth Flow Management for Calendar Integrations
 *
 * Handles OAuth 2.0 flows for:
 * - Google Calendar
 * - Microsoft Graph (Outlook/365)
 * - Apple Calendar (Sign in with Apple)
 */

import crypto from 'crypto'
import { CalendarProvider, OAuthConfig, OAuthState, OAuthTokens, CalendarAuthError } from './types'

// ==========================================
// OAUTH CONFIGURATIONS
// ==========================================

export function getOAuthConfig(provider: CalendarProvider): OAuthConfig {
  switch (provider) {
    case 'google':
      return {
        provider: 'google',
        clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
        redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/connect/google`,
        scopes: [
          'https://www.googleapis.com/auth/calendar', // Read/write calendar events
          'https://www.googleapis.com/auth/userinfo.email', // Get user email
          'https://www.googleapis.com/auth/userinfo.profile' // Get user name
        ],
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token'
      }

    case 'microsoft':
      return {
        provider: 'microsoft',
        clientId: process.env.MICROSOFT_CLIENT_ID!,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
        redirectUri: process.env.MICROSOFT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/connect/microsoft`,
        scopes: [
          'https://graph.microsoft.com/Calendars.ReadWrite', // Read/write calendars
          'https://graph.microsoft.com/User.Read', // Get user profile
          'offline_access' // Get refresh token
        ],
        authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
      }

    case 'apple':
      return {
        provider: 'apple',
        clientId: process.env.APPLE_CLIENT_ID!, // Service ID
        clientSecret: generateAppleClientSecret(), // JWT generated from private key
        redirectUri: process.env.APPLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/connect/apple`,
        scopes: [
          'name',
          'email'
        ],
        authorizationUrl: 'https://appleid.apple.com/auth/authorize',
        tokenUrl: 'https://appleid.apple.com/auth/token'
      }

    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}

// ==========================================
// OAUTH STATE MANAGEMENT
// ==========================================

// In-memory store for OAuth state (replace with Redis in production)
const stateStore = new Map<string, OAuthState>()

// State expires after 10 minutes
const STATE_EXPIRY_MS = 10 * 60 * 1000

/**
 * Generate OAuth state parameter with CSRF protection
 */
export function generateOAuthState(
  userId: string,
  provider: CalendarProvider,
  isPrimary: boolean = false,
  returnUrl?: string
): string {
  const nonce = crypto.randomBytes(32).toString('hex')
  const stateId = crypto.randomBytes(16).toString('hex')

  const state: OAuthState = {
    userId,
    provider,
    returnUrl,
    isPrimary,
    nonce,
    createdAt: Date.now()
  }

  stateStore.set(stateId, state)

  // Clean up expired states
  setTimeout(() => stateStore.delete(stateId), STATE_EXPIRY_MS)

  return stateId
}

/**
 * Validate and retrieve OAuth state
 */
export function validateOAuthState(stateId: string): OAuthState {
  const state = stateStore.get(stateId)

  if (!state) {
    throw new CalendarAuthError('Invalid or expired OAuth state', 'google')
  }

  // Check if expired
  if (Date.now() - state.createdAt > STATE_EXPIRY_MS) {
    stateStore.delete(stateId)
    throw new CalendarAuthError('OAuth state expired', state.provider)
  }

  // Don't delete yet - might need for token validation
  return state
}

/**
 * Clean up OAuth state after use
 */
export function cleanupOAuthState(stateId: string): void {
  stateStore.delete(stateId)
}

// ==========================================
// AUTHORIZATION URL GENERATION
// ==========================================

/**
 * Generate OAuth authorization URL
 */
export function generateAuthorizationUrl(
  provider: CalendarProvider,
  userId: string,
  isPrimary: boolean = false,
  returnUrl?: string
): string {
  const config = getOAuthConfig(provider)
  const state = generateOAuthState(userId, provider, isPrimary, returnUrl)

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
    access_type: 'offline', // For Google: get refresh token
    prompt: 'consent' // Force consent to get refresh token
  })

  // Provider-specific parameters
  if (provider === 'microsoft') {
    params.set('response_mode', 'query')
  }

  if (provider === 'apple') {
    params.set('response_mode', 'form_post')
  }

  return `${config.authorizationUrl}?${params.toString()}`
}

// ==========================================
// TOKEN EXCHANGE
// ==========================================

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForTokens(
  provider: CalendarProvider,
  code: string,
  stateId: string
): Promise<OAuthTokens> {
  const config = getOAuthConfig(provider)
  const state = validateOAuthState(stateId)

  if (state.provider !== provider) {
    throw new CalendarAuthError('Provider mismatch in OAuth flow', provider)
  }

  try {
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code'
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'unknown' }))
      throw new CalendarAuthError(
        `Token exchange failed: ${error.error_description || error.error}`,
        provider,
        error
      )
    }

    const data = await response.json()

    // Calculate token expiration
    const expiresIn = data.expires_in || 3600 // Default 1 hour
    const expiresAt = new Date(Date.now() + expiresIn * 1000)

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      scope: data.scope || config.scopes.join(' '),
      tokenType: data.token_type || 'Bearer'
    }
  } catch (error) {
    if (error instanceof CalendarAuthError) {
      throw error
    }
    throw new CalendarAuthError(
      `Failed to exchange code for tokens: ${error instanceof Error ? error.message : 'unknown error'}`,
      provider,
      error
    )
  } finally {
    // Clean up state
    cleanupOAuthState(stateId)
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  provider: CalendarProvider,
  refreshToken: string
): Promise<OAuthTokens> {
  const config = getOAuthConfig(provider)

  try {
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'unknown' }))
      throw new CalendarAuthError(
        `Token refresh failed: ${error.error_description || error.error}`,
        provider,
        error
      )
    }

    const data = await response.json()

    // Calculate token expiration
    const expiresIn = data.expires_in || 3600
    const expiresAt = new Date(Date.now() + expiresIn * 1000)

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Some providers don't return new refresh token
      expiresAt,
      scope: data.scope || config.scopes.join(' '),
      tokenType: data.token_type || 'Bearer'
    }
  } catch (error) {
    if (error instanceof CalendarAuthError) {
      throw error
    }
    throw new CalendarAuthError(
      `Failed to refresh access token: ${error instanceof Error ? error.message : 'unknown error'}`,
      provider,
      error
    )
  }
}

/**
 * Revoke OAuth tokens (disconnect calendar)
 */
export async function revokeTokens(
  provider: CalendarProvider,
  accessToken: string
): Promise<void> {
  try {
    let revokeUrl: string

    switch (provider) {
      case 'google':
        revokeUrl = `https://oauth2.googleapis.com/revoke?token=${accessToken}`
        break

      case 'microsoft':
        // Microsoft doesn't have a revoke endpoint, tokens expire naturally
        return

      case 'apple':
        revokeUrl = 'https://appleid.apple.com/auth/revoke'
        break

      default:
        return
    }

    await fetch(revokeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: provider === 'apple' ? new URLSearchParams({
        client_id: process.env.APPLE_CLIENT_ID!,
        client_secret: generateAppleClientSecret(),
        token: accessToken,
        token_type_hint: 'access_token'
      }) : undefined
    })

    // Don't throw on revoke errors - connection will be removed regardless
  } catch (error) {
    console.error(`Failed to revoke ${provider} tokens:`, error)
  }
}

// ==========================================
// APPLE-SPECIFIC HELPERS
// ==========================================

/**
 * Generate Apple client secret (JWT)
 * Apple requires a JWT signed with your private key as the client secret
 */
function generateAppleClientSecret(): string {
  try {
    const jwt = require('jsonwebtoken')

    const teamId = process.env.APPLE_TEAM_ID!
    const clientId = process.env.APPLE_CLIENT_ID!
    const keyId = process.env.APPLE_KEY_ID!
    const privateKey = process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n')

    const now = Math.floor(Date.now() / 1000)

    const payload = {
      iss: teamId,
      iat: now,
      exp: now + 86400 * 180, // 180 days (Apple's max)
      aud: 'https://appleid.apple.com',
      sub: clientId
    }

    return jwt.sign(payload, privateKey, {
      algorithm: 'ES256',
      keyid: keyId
    })
  } catch (error) {
    console.error('Failed to generate Apple client secret:', error)
    throw new CalendarAuthError('Failed to generate Apple client secret', 'apple', error)
  }
}

// ==========================================
// USER INFO RETRIEVAL
// ==========================================

/**
 * Get user info from provider using access token
 */
export async function getUserInfo(
  provider: CalendarProvider,
  accessToken: string
): Promise<{ email: string; displayName?: string; id: string }> {
  try {
    let url: string
    let headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }

    switch (provider) {
      case 'google':
        url = 'https://www.googleapis.com/oauth2/v2/userinfo'
        break

      case 'microsoft':
        url = 'https://graph.microsoft.com/v1.0/me'
        break

      case 'apple':
        // Apple returns user info in the initial authorization response
        // Subsequent calls require different approach
        throw new Error('Apple user info should be captured during initial authorization')

      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }

    const response = await fetch(url, { headers })

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`)
    }

    const data = await response.json()

    // Normalize response across providers
    if (provider === 'google') {
      return {
        id: data.id,
        email: data.email,
        displayName: data.name
      }
    } else if (provider === 'microsoft') {
      return {
        id: data.id,
        email: data.mail || data.userPrincipalName,
        displayName: data.displayName
      }
    }

    throw new Error('Unexpected provider in getUserInfo')
  } catch (error) {
    throw new CalendarAuthError(
      `Failed to get user info: ${error instanceof Error ? error.message : 'unknown error'}`,
      provider,
      error
    )
  }
}

// ==========================================
// TOKEN VALIDATION
// ==========================================

/**
 * Check if access token needs refresh (expires in < 5 minutes)
 */
export function needsTokenRefresh(expiresAt: Date): boolean {
  const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000
  return expiresAt.getTime() < fiveMinutesFromNow
}

/**
 * Validate OAuth configuration
 */
export function validateOAuthConfig(provider: CalendarProvider): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  try {
    const config = getOAuthConfig(provider)

    if (!config.clientId) {
      errors.push(`${provider.toUpperCase()}_CLIENT_ID not configured`)
    }
    if (!config.clientSecret && provider !== 'apple') {
      errors.push(`${provider.toUpperCase()}_CLIENT_SECRET not configured`)
    }
    if (!config.redirectUri) {
      errors.push(`${provider.toUpperCase()}_REDIRECT_URI not configured`)
    }

    // Apple-specific validation
    if (provider === 'apple') {
      if (!process.env.APPLE_TEAM_ID) errors.push('APPLE_TEAM_ID not configured')
      if (!process.env.APPLE_KEY_ID) errors.push('APPLE_KEY_ID not configured')
      if (!process.env.APPLE_PRIVATE_KEY) errors.push('APPLE_PRIVATE_KEY not configured')
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown configuration error')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
