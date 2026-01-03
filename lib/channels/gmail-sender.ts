// @ts-nocheck
/**
 * Gmail Sender
 *
 * Send emails on behalf of users via their connected Gmail account.
 * Uses OAuth 2.0 for authentication.
 *
 * Flow:
 * 1. User connects Gmail via OAuth
 * 2. We store their refresh token
 * 3. When sending, we get a fresh access token
 * 4. Email is sent FROM their Gmail address
 */

import { google } from 'googleapis'
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

const GMAIL_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GMAIL_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const GMAIL_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://wellsonyx.com/api/integrations/gmail/callback'

// ============================================================================
// GMAIL SENDER CLASS
// ============================================================================

export class GmailSender implements IChannelSender {
  readonly channelType = 'email_gmail' as const

  private getOAuth2Client() {
    return new google.auth.OAuth2(
      GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET,
      GMAIL_REDIRECT_URI
    )
  }

  /**
   * Send an email via Gmail
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

      const oauth2Client = this.getOAuth2Client()
      oauth2Client.setCredentials({ access_token: accessToken })

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

      // Build MIME message
      const mimeMessage = this.buildMimeMessage(message, credentials)
      const encodedMessage = Buffer.from(mimeMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      // Send
      const sendOptions: any = {
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      }

      if (message.threadId) {
        sendOptions.requestBody.threadId = message.threadId
      }

      const response = await gmail.users.messages.send(sendOptions)

      // Record the send for rate limiting
      await this.recordSend(credentials.userId)

      // Store sent message
      await this.storeSentMessage(credentials, message, response.data.id!)

      return {
        success: true,
        messageId: uuidv4(),
        providerMessageId: response.data.id!,
        channel: this.channelType,
        sentAt: new Date(),
      }
    } catch (error: any) {
      console.error('[GmailSender] Send failed:', error)

      // Check for specific error types
      const isRateLimit = error.code === 429 || error.message?.includes('rate limit')
      const isAuthError = error.code === 401 || error.code === 403

      return {
        success: false,
        channel: this.channelType,
        error: error.message || 'Failed to send via Gmail',
        errorCode: error.code?.toString(),
        retryable: isRateLimit || (!isAuthError),
      }
    }
  }

  /**
   * Build a MIME message for Gmail
   */
  private buildMimeMessage(
    message: ChannelMessage,
    credentials: UserChannelCredentials
  ): string {
    const boundary = `----=_Part_${Date.now()}`
    const toList = Array.isArray(message.to) ? message.to.join(', ') : message.to
    const fromEmail = credentials.email || 'user@gmail.com'
    const fromName = credentials.displayName

    // Add signature if available
    let htmlContent = message.htmlBody || message.body
    if (credentials.signature) {
      htmlContent += `<br><br>${credentials.signature}`
    }

    const lines: string[] = [
      `From: ${fromName ? `"${fromName}" <${fromEmail}>` : fromEmail}`,
      `To: ${toList}`,
    ]

    if (message.subject) {
      lines.push(`Subject: ${message.subject}`)
    }

    lines.push(`MIME-Version: 1.0`)

    // Threading headers
    if (message.inReplyTo) {
      lines.push(`In-Reply-To: ${message.inReplyTo}`)
      lines.push(`References: ${message.references || message.inReplyTo}`)
    }

    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    lines.push('')
    lines.push(`--${boundary}`)
    lines.push('Content-Type: text/plain; charset=UTF-8')
    lines.push('')
    lines.push(message.body.replace(/<[^>]*>/g, ''))
    lines.push('')
    lines.push(`--${boundary}`)
    lines.push('Content-Type: text/html; charset=UTF-8')
    lines.push('')
    lines.push(htmlContent)
    lines.push(`--${boundary}--`)

    return lines.join('\n')
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

    const oauth2Client = this.getOAuth2Client()
    oauth2Client.setCredentials({
      refresh_token: credentials.refreshToken,
    })

    const { credentials: newCreds } = await oauth2Client.refreshAccessToken()

    // Update stored tokens
    await query(
      `UPDATE channel_credentials SET
        access_token = $1,
        token_expiry = $2,
        updated_at = NOW()
       WHERE user_id = $3 AND channel = $4`,
      [newCreds.access_token, new Date(newCreds.expiry_date!), credentials.userId, this.channelType]
    )

    return newCreds.access_token!
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
      const oauth2Client = this.getOAuth2Client()
      oauth2Client.setCredentials({ access_token: accessToken })

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
      await gmail.users.getProfile({ userId: 'me' })

      return true
    } catch (error) {
      console.error('[GmailSender] Credential validation failed:', error)
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
    const limits = DEFAULT_RATE_LIMITS.email_gmail
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
      sentThisWeek: sentToday, // simplified
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
      console.error('[GmailSender] Failed to record send:', error)
    }
  }

  /**
   * Store sent message for tracking
   */
  private async storeSentMessage(
    credentials: UserChannelCredentials,
    message: ChannelMessage,
    providerMessageId: string
  ): Promise<void> {
    const messageId = uuidv4()
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
          providerMessageId,
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
      console.error('[GmailSender] Failed to store message:', error)
    }
  }
}

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Generate Gmail OAuth URL for user authorization
 */
export function getGmailAuthUrl(state: string): string {
  if (!GMAIL_CLIENT_ID) {
    throw new Error('Gmail OAuth not configured')
  }

  const oauth2Client = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REDIRECT_URI
  )

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    state,
    prompt: 'consent',
  })
}

/**
 * Exchange Gmail auth code for tokens
 */
export async function exchangeGmailCode(code: string): Promise<{
  accessToken: string
  refreshToken: string
  expiryDate: Date
  email: string
  name?: string
}> {
  const oauth2Client = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REDIRECT_URI
  )

  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)

  // Get user info
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  const userInfo = await oauth2.userinfo.get()

  if (!tokens.refresh_token) {
    throw new Error('No refresh token received. User may need to revoke access and re-authorize.')
  }

  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token,
    expiryDate: new Date(tokens.expiry_date || Date.now() + 3600000),
    email: userInfo.data.email!,
    name: userInfo.data.name || undefined,
  }
}

/**
 * Connect a Gmail account for a user
 */
export async function connectGmailAccount(
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
    [userId, 'email_gmail']
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
        'email_gmail',
      ]
    )

    return {
      userId,
      channel: 'email_gmail',
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
      'email_gmail',
      tokenData.accessToken,
      tokenData.refreshToken,
      tokenData.expiryDate,
      tokenData.email,
      tokenData.name,
    ]
  )

  return {
    userId,
    channel: 'email_gmail',
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

export const gmailSender = new GmailSender()

export default gmailSender
