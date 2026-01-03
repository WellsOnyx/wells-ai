// @ts-nocheck
/**
 * Twitter Sender
 *
 * Send DMs and tweets on behalf of users via their connected Twitter/X account.
 * Uses Twitter API v2 with OAuth 2.0 (User Context).
 *
 * STATUS: STUB - Prepared for OAuth integration
 *
 * TODO:
 * - Implement OAuth 2.0 PKCE flow for user authorization
 * - Add DM sending via Twitter API v2
 * - Add tweet posting
 * - Handle Twitter rate limits (aggressive)
 * - Store and manage user tokens
 *
 * Note: Twitter API access requires elevated access tier ($100/mo minimum)
 * for DM functionality.
 */

import { query } from '@/lib/db'
import {
  IChannelSender,
  ChannelMessage,
  UserChannelCredentials,
  SendResult,
  RateLimitStatus,
  DEFAULT_RATE_LIMITS,
} from './channel-sender'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'

// ============================================================================
// CONFIGURATION
// ============================================================================

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID || ''
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET || ''
const TWITTER_REDIRECT_URI = process.env.TWITTER_REDIRECT_URI || 'https://wellsonyx.com/api/integrations/twitter/callback'

// For OAuth 1.0a (Wells-owned account)
const TWITTER_API_KEY = process.env.TWITTER_API_KEY || ''
const TWITTER_API_KEY_SECRET = process.env.TWITTER_API_KEY_SECRET || ''
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN || ''
const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET || ''

const TWITTER_API_BASE = 'https://api.twitter.com/2'
const TWITTER_AUTH_URL = 'https://twitter.com/i/oauth2/authorize'
const TWITTER_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'

// ============================================================================
// TWITTER DM SENDER CLASS
// ============================================================================

export class TwitterDMSender implements IChannelSender {
  readonly channelType = 'twitter_dm' as const

  /**
   * Send a DM via Twitter
   *
   * TODO: Implement actual Twitter DM sending
   */
  async send(
    message: ChannelMessage,
    credentials: UserChannelCredentials
  ): Promise<SendResult> {
    // TODO: Implement Twitter DM sending
    // For now, return a stub response

    console.warn('[TwitterDMSender] Twitter DM sending not yet implemented')

    // Check if we have credentials at all
    if (!credentials.accessToken) {
      return {
        success: false,
        channel: this.channelType,
        error: 'Twitter not connected. Twitter DM sending requires user authorization.',
        retryable: false,
      }
    }

    // TODO: Actual implementation
    // 1. Get recipient's Twitter user ID from handle
    // 2. Check if we can DM them (they follow us or DMs are open)
    // 3. Send DM via POST /dm_conversations/with/:participant_id/messages

    try {
      // Placeholder: Will implement actual DM sending
      const recipientId = message.to as string  // Should be Twitter user ID

      // Validate token
      const accessToken = await this.getValidToken(credentials)

      // Send DM (placeholder)
      const response = await this.sendDM(accessToken, recipientId, message.body)

      await this.recordSend(credentials.userId)

      return {
        success: true,
        messageId: uuidv4(),
        providerMessageId: response.eventId,
        channel: this.channelType,
        sentAt: new Date(),
      }
    } catch (error: any) {
      console.error('[TwitterDMSender] Send failed:', error)

      return {
        success: false,
        channel: this.channelType,
        error: error.message || 'Failed to send Twitter DM',
        retryable: true,
      }
    }
  }

  /**
   * Actually send a DM via Twitter API
   *
   * TODO: Implement this properly
   */
  private async sendDM(
    accessToken: string,
    recipientId: string,
    text: string
  ): Promise<{ eventId: string; conversationId: string }> {
    // TODO: Implement actual API call
    // const response = await fetch(
    //   `${TWITTER_API_BASE}/dm_conversations/with/${recipientId}/messages`,
    //   {
    //     method: 'POST',
    //     headers: {
    //       'Authorization': `Bearer ${accessToken}`,
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({ text }),
    //   }
    // )

    throw new Error('Twitter DM sending not implemented - requires elevated API access')
  }

  /**
   * Get a valid access token, refreshing if needed
   */
  private async getValidToken(credentials: UserChannelCredentials): Promise<string> {
    if (credentials.tokenExpiry && credentials.tokenExpiry > new Date(Date.now() + 5 * 60 * 1000)) {
      return credentials.accessToken!
    }

    if (!credentials.refreshToken) {
      throw new Error('No refresh token available')
    }

    // Refresh token
    const response = await fetch(TWITTER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        refresh_token: credentials.refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to refresh Twitter token')
    }

    const tokens = await response.json()

    // Update stored tokens
    await query(
      `UPDATE channel_credentials SET
        access_token = $1,
        refresh_token = COALESCE($2, refresh_token),
        token_expiry = $3,
        updated_at = NOW()
       WHERE user_id = $4 AND channel = $5`,
      [
        tokens.access_token,
        tokens.refresh_token,
        new Date(Date.now() + tokens.expires_in * 1000),
        credentials.userId,
        this.channelType,
      ]
    )

    return tokens.access_token
  }

  /**
   * Validate credentials
   */
  async validateCredentials(credentials: UserChannelCredentials): Promise<boolean> {
    if (!credentials.accessToken && !credentials.refreshToken) {
      return false
    }

    try {
      const accessToken = await this.getValidToken(credentials)

      const response = await fetch(`${TWITTER_API_BASE}/users/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      return response.ok
    } catch (error) {
      console.error('[TwitterDMSender] Credential validation failed:', error)
      return false
    }
  }

  /**
   * Refresh credentials
   */
  async refreshCredentials(credentials: UserChannelCredentials): Promise<UserChannelCredentials> {
    const accessToken = await this.getValidToken(credentials)

    return {
      ...credentials,
      accessToken,
      tokenExpiry: new Date(Date.now() + 7200000), // 2 hours
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(userId: string): Promise<RateLimitStatus> {
    const limits = DEFAULT_RATE_LIMITS.twitter_dm
    const now = new Date()
    const hourAgo = new Date(now.getTime() - 3600000)
    const dayAgo = new Date(now.getTime() - 86400000)

    const hourlyResult = await query(
      `SELECT COUNT(*)::int as count FROM channel_sends
       WHERE user_id = $1 AND channel = $2 AND sent_at > $3`,
      [userId, this.channelType, hourAgo]
    )

    const dailyResult = await query(
      `SELECT COUNT(*)::int as count FROM channel_sends
       WHERE user_id = $1 AND channel = $2 AND sent_at > $3`,
      [userId, this.channelType, dayAgo]
    )

    const sentInHour = hourlyResult?.rows?.[0]?.count || 0
    const sentToday = dailyResult?.rows?.[0]?.count || 0

    const remaining = Math.min(
      (limits.perHour || 50) - sentInHour,
      (limits.perDay || 100) - sentToday
    )

    return {
      channel: this.channelType,
      userId,
      canSend: remaining > 0,
      remaining: Math.max(0, remaining),
      limit: limits.perHour || 50,
      windowStart: hourAgo,
      windowEnd: now,
      resetAt: new Date(now.getTime() + 3600000),
      sentInWindow: sentInHour,
      sentToday,
      sentThisWeek: sentToday,
    }
  }

  /**
   * Check if we can send now
   */
  async canSendNow(userId: string): Promise<boolean> {
    const status = await this.getRateLimitStatus(userId)
    return status.canSend
  }

  /**
   * Record a send for rate limiting
   */
  private async recordSend(userId: string): Promise<void> {
    try {
      await query(
        `INSERT INTO channel_sends (id, user_id, channel, sent_at)
         VALUES ($1, $2, $3, NOW())`,
        [uuidv4(), userId, this.channelType]
      )
    } catch (error) {
      console.error('[TwitterDMSender] Failed to record send:', error)
    }
  }
}

// ============================================================================
// TWITTER TWEET SENDER CLASS
// ============================================================================

export class TwitterTweetSender implements IChannelSender {
  readonly channelType = 'twitter_tweet' as const

  /**
   * Post a tweet on behalf of user
   *
   * TODO: Implement actual tweet posting
   */
  async send(
    message: ChannelMessage,
    credentials: UserChannelCredentials
  ): Promise<SendResult> {
    console.warn('[TwitterTweetSender] Tweet posting not yet implemented')

    if (!credentials.accessToken) {
      return {
        success: false,
        channel: this.channelType,
        error: 'Twitter not connected. Tweet posting requires user authorization.',
        retryable: false,
      }
    }

    try {
      // TODO: Implement actual tweet posting
      // const response = await fetch(`${TWITTER_API_BASE}/tweets`, {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${accessToken}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ text: message.body }),
      // })

      throw new Error('Tweet posting not implemented')
    } catch (error: any) {
      return {
        success: false,
        channel: this.channelType,
        error: error.message || 'Failed to post tweet',
        retryable: true,
      }
    }
  }

  async validateCredentials(credentials: UserChannelCredentials): Promise<boolean> {
    // Same as DM sender
    return new TwitterDMSender().validateCredentials(credentials)
  }

  async refreshCredentials(credentials: UserChannelCredentials): Promise<UserChannelCredentials> {
    return new TwitterDMSender().refreshCredentials(credentials)
  }

  async getRateLimitStatus(userId: string): Promise<RateLimitStatus> {
    const limits = DEFAULT_RATE_LIMITS.twitter_tweet
    const now = new Date()
    const hourAgo = new Date(now.getTime() - 3600000)

    const result = await query(
      `SELECT COUNT(*)::int as count FROM channel_sends
       WHERE user_id = $1 AND channel = $2 AND sent_at > $3`,
      [userId, this.channelType, hourAgo]
    )

    const sentInHour = result?.rows?.[0]?.count || 0
    const remaining = (limits.perHour || 25) - sentInHour

    return {
      channel: this.channelType,
      userId,
      canSend: remaining > 0,
      remaining: Math.max(0, remaining),
      limit: limits.perHour || 25,
      windowStart: hourAgo,
      windowEnd: now,
      resetAt: new Date(now.getTime() + 3600000),
      sentInWindow: sentInHour,
      sentToday: sentInHour,
      sentThisWeek: sentInHour,
    }
  }

  async canSendNow(userId: string): Promise<boolean> {
    const status = await this.getRateLimitStatus(userId)
    return status.canSend
  }
}

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Generate Twitter OAuth 2.0 PKCE authorization URL
 */
export function getTwitterAuthUrl(state: string): {
  url: string
  codeVerifier: string
} {
  if (!TWITTER_CLIENT_ID) {
    throw new Error('Twitter OAuth not configured')
  }

  // Generate PKCE challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: TWITTER_CLIENT_ID,
    redirect_uri: TWITTER_REDIRECT_URI,
    scope: 'tweet.read tweet.write users.read dm.read dm.write offline.access',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  return {
    url: `${TWITTER_AUTH_URL}?${params.toString()}`,
    codeVerifier,
  }
}

/**
 * Exchange Twitter auth code for tokens
 */
export async function exchangeTwitterCode(
  code: string,
  codeVerifier: string
): Promise<{
  accessToken: string
  refreshToken: string
  expiryDate: Date
  userId: string
  username: string
}> {
  const response = await fetch(TWITTER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: TWITTER_REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Twitter token exchange failed: ${error.error_description || error.error}`)
  }

  const tokens = await response.json()

  // Get user info
  const userResponse = await fetch(`${TWITTER_API_BASE}/users/me`, {
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
    },
  })

  if (!userResponse.ok) {
    throw new Error('Failed to get Twitter user info')
  }

  const userData = await userResponse.json()

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: new Date(Date.now() + tokens.expires_in * 1000),
    userId: userData.data.id,
    username: userData.data.username,
  }
}

/**
 * Connect a Twitter account for a user
 */
export async function connectTwitterAccount(
  userId: string,
  tokenData: {
    accessToken: string
    refreshToken: string
    expiryDate: Date
    twitterUserId: string
    username: string
  }
): Promise<UserChannelCredentials> {
  const id = uuidv4()

  // Check for existing
  const existing = await query(
    `SELECT id FROM channel_credentials WHERE user_id = $1 AND channel = $2`,
    [userId, 'twitter_dm']
  )

  const credentials: UserChannelCredentials = {
    userId,
    channel: 'twitter_dm',
    accessToken: tokenData.accessToken,
    refreshToken: tokenData.refreshToken,
    tokenExpiry: tokenData.expiryDate,
    email: tokenData.username, // Using email field for username
    displayName: `@${tokenData.username}`,
    isActive: true,
    errorCount: 0,
  }

  if (existing?.rows?.length > 0) {
    await query(
      `UPDATE channel_credentials SET
        access_token = $1,
        refresh_token = $2,
        token_expiry = $3,
        email = $4,
        display_name = $5,
        is_active = true,
        error_count = 0,
        last_error = NULL,
        updated_at = NOW()
       WHERE user_id = $6 AND channel = $7`,
      [
        tokenData.accessToken,
        tokenData.refreshToken,
        tokenData.expiryDate,
        tokenData.username,
        `@${tokenData.username}`,
        userId,
        'twitter_dm',
      ]
    )
  } else {
    await query(
      `INSERT INTO channel_credentials (
        id, user_id, channel,
        access_token, refresh_token, token_expiry,
        email, display_name,
        is_active, error_count,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, 0, NOW(), NOW())`,
      [
        id,
        userId,
        'twitter_dm',
        tokenData.accessToken,
        tokenData.refreshToken,
        tokenData.expiryDate,
        tokenData.username,
        `@${tokenData.username}`,
      ]
    )
  }

  return credentials
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

export const twitterDMSender = new TwitterDMSender()
export const twitterTweetSender = new TwitterTweetSender()

export default {
  twitterDMSender,
  twitterTweetSender,
  getTwitterAuthUrl,
  exchangeTwitterCode,
  connectTwitterAccount,
}
