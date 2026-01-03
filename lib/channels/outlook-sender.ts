// @ts-nocheck
/**
 * Outlook Sender
 *
 * Send emails on behalf of users via their connected Microsoft/Outlook account.
 * Uses Microsoft Graph API with OAuth 2.0.
 *
 * Flow:
 * 1. User connects Outlook via Microsoft OAuth
 * 2. We store their refresh token
 * 3. When sending, we get a fresh access token
 * 4. Email is sent FROM their Outlook address
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

// ============================================================================
// CONFIGURATION
// ============================================================================

const MS_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || ''
const MS_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || ''
const MS_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || 'https://wellsonyx.com/api/integrations/outlook/callback'
const MS_SCOPES = ['openid', 'profile', 'email', 'offline_access', 'Mail.Send', 'Mail.ReadWrite']

const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const MS_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const MS_GRAPH_URL = 'https://graph.microsoft.com/v1.0'

// ============================================================================
// OUTLOOK SENDER CLASS
// ============================================================================

export class OutlookSender implements IChannelSender {
  readonly channelType = 'email_outlook' as const

  /**
   * Send an email via Outlook/Microsoft Graph
   */
  async send(
    message: ChannelMessage,
    credentials: UserChannelCredentials
  ): Promise<SendResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        channel: this.channelType,
        error: 'No access token',
        retryable: false,
      }
    }

    try {
      // Get fresh token if needed
      const accessToken = await this.getValidToken(credentials)

      // Build message payload
      const graphMessage = this.buildGraphMessage(message, credentials)

      // Send via Graph API
      const response = await fetch(`${MS_GRAPH_URL}/me/sendMail`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: graphMessage,
          saveToSentItems: true,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || `Microsoft send failed: ${response.status}`)
      }

      // Record the send for rate limiting
      await this.recordSend(credentials.userId)

      // Store sent message
      const messageId = uuidv4()
      await this.storeSentMessage(credentials, message, messageId)

      return {
        success: true,
        messageId,
        channel: this.channelType,
        sentAt: new Date(),
      }
    } catch (error: any) {
      console.error('[OutlookSender] Send failed:', error)

      const isRateLimit = error.message?.includes('rate limit') || error.message?.includes('429')
      const isAuthError = error.message?.includes('401') || error.message?.includes('403') || error.message?.includes('unauthorized')

      return {
        success: false,
        channel: this.channelType,
        error: error.message || 'Failed to send via Outlook',
        retryable: isRateLimit || (!isAuthError),
      }
    }
  }

  /**
   * Build Microsoft Graph message payload
   */
  private buildGraphMessage(
    message: ChannelMessage,
    credentials: UserChannelCredentials
  ): any {
    // Add signature if available
    let htmlContent = message.htmlBody || message.body
    if (credentials.signature) {
      htmlContent += `<br><br>${credentials.signature}`
    }

    const toRecipients = (Array.isArray(message.to) ? message.to : [message.to])
      .map(email => ({
        emailAddress: { address: email },
      }))

    const graphMessage: any = {
      subject: message.subject || '',
      body: {
        contentType: 'HTML',
        content: htmlContent,
      },
      toRecipients,
    }

    // Threading headers for replies
    if (message.inReplyTo) {
      graphMessage.internetMessageHeaders = [
        { name: 'In-Reply-To', value: message.inReplyTo },
        { name: 'References', value: message.references || message.inReplyTo },
      ]
    }

    return graphMessage
  }

  /**
   * Get a valid access token, refreshing if needed
   */
  private async getValidToken(credentials: UserChannelCredentials): Promise<string> {
    // Check if token is still valid (with 5 min buffer)
    if (credentials.tokenExpiry && credentials.tokenExpiry > new Date(Date.now() + 5 * 60 * 1000)) {
      return credentials.accessToken!
    }

    // Need to refresh
    if (!credentials.refreshToken) {
      throw new Error('No refresh token available')
    }

    const response = await fetch(MS_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET,
        refresh_token: credentials.refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to refresh Microsoft token')
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
        tokens.refresh_token || null,
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

      const response = await fetch(`${MS_GRAPH_URL}/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      return response.ok
    } catch (error) {
      console.error('[OutlookSender] Credential validation failed:', error)
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
      tokenExpiry: new Date(Date.now() + 3600000), // 1 hour
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(userId: string): Promise<RateLimitStatus> {
    const limits = DEFAULT_RATE_LIMITS.email_outlook
    const now = new Date()
    const hourAgo = new Date(now.getTime() - 3600000)
    const dayAgo = new Date(now.getTime() - 86400000)

    // Get send counts
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
      (limits.perHour || 100) - sentInHour,
      (limits.perDay || 500) - sentToday
    )

    return {
      channel: this.channelType,
      userId,
      canSend: remaining > 0,
      remaining: Math.max(0, remaining),
      limit: limits.perHour || 100,
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
      console.error('[OutlookSender] Failed to record send:', error)
    }
  }

  /**
   * Store sent message for tracking
   */
  private async storeSentMessage(
    credentials: UserChannelCredentials,
    message: ChannelMessage,
    messageId: string
  ): Promise<void> {
    const threadId = message.threadId || uuidv4()

    try {
      await query(
        `INSERT INTO channel_messages (
          id, thread_id, user_id, channel, provider_message_id,
          from_address, to_address, subject, body, html_body,
          tracking_id, campaign_id, status, sent_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'sent', NOW())`,
        [
          messageId,
          threadId,
          credentials.userId,
          this.channelType,
          messageId,
          credentials.email,
          Array.isArray(message.to) ? message.to.join(', ') : message.to,
          message.subject,
          message.body,
          message.htmlBody,
          message.trackingId,
          message.campaignId,
        ]
      )
    } catch (error) {
      console.error('[OutlookSender] Failed to store message:', error)
    }
  }
}

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Generate Microsoft OAuth URL for user authorization
 */
export function getOutlookAuthUrl(state: string): string {
  if (!MS_CLIENT_ID) {
    throw new Error('Microsoft OAuth not configured')
  }

  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: MS_REDIRECT_URI,
    response_mode: 'query',
    scope: MS_SCOPES.join(' '),
    state,
    prompt: 'consent',
  })

  return `${MS_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange Microsoft auth code for tokens
 */
export async function exchangeOutlookCode(code: string): Promise<{
  accessToken: string
  refreshToken: string
  expiryDate: Date
  email: string
  name?: string
}> {
  const response = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      code,
      redirect_uri: MS_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Microsoft token exchange failed: ${error.error_description || error.error}`)
  }

  const tokens = await response.json()

  // Get user info from Microsoft Graph
  const userResponse = await fetch(`${MS_GRAPH_URL}/me`, {
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
    },
  })

  if (!userResponse.ok) {
    throw new Error('Failed to get Microsoft user info')
  }

  const userInfo = await userResponse.json()

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: new Date(Date.now() + tokens.expires_in * 1000),
    email: userInfo.mail || userInfo.userPrincipalName,
    name: userInfo.displayName,
  }
}

/**
 * Connect an Outlook account for a user
 */
export async function connectOutlookAccount(
  userId: string,
  tokenData: {
    accessToken: string
    refreshToken: string
    expiryDate: Date
    email: string
    name?: string
  }
): Promise<UserChannelCredentials> {
  const id = uuidv4()

  // Check for existing
  const existing = await query(
    `SELECT id FROM channel_credentials WHERE user_id = $1 AND channel = $2`,
    [userId, 'email_outlook']
  )

  if (existing?.rows?.length > 0) {
    // Update existing
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
        tokenData.email,
        tokenData.name,
        userId,
        'email_outlook',
      ]
    )

    return {
      userId,
      channel: 'email_outlook',
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      tokenExpiry: tokenData.expiryDate,
      email: tokenData.email,
      displayName: tokenData.name,
      isActive: true,
      errorCount: 0,
    }
  }

  // Create new
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
      'email_outlook',
      tokenData.accessToken,
      tokenData.refreshToken,
      tokenData.expiryDate,
      tokenData.email,
      tokenData.name,
    ]
  )

  return {
    userId,
    channel: 'email_outlook',
    accessToken: tokenData.accessToken,
    refreshToken: tokenData.refreshToken,
    tokenExpiry: tokenData.expiryDate,
    email: tokenData.email,
    displayName: tokenData.name,
    isActive: true,
    errorCount: 0,
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const outlookSender = new OutlookSender()

export default outlookSender
