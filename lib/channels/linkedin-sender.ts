// @ts-nocheck
/**
 * LinkedIn Sender
 *
 * Send messages on behalf of users via their connected LinkedIn account.
 *
 * STATUS: STUB - LinkedIn does NOT have a public messaging API
 *
 * REALITY CHECK:
 * LinkedIn's API does NOT support sending messages programmatically.
 * The only options are:
 *
 * 1. Sales Navigator API ($$$) - Enterprise only, requires partnership
 * 2. Marketing API - Only for ads and company pages
 * 3. Browser Extension - Automates the actual LinkedIn UI (gray area)
 * 4. Manual Queue - User copy-pastes from a queue (what we do)
 *
 * This sender creates a QUEUE of messages for users to manually send.
 * It's honest about the limitation: "Here's your message - paste it into LinkedIn."
 *
 * TODO:
 * - Integrate with browser extension for semi-automation
 * - Add LinkedIn Sales Navigator API if we get partnership
 * - Explore LinkedIn's new "Message API" beta program
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

// LinkedIn OAuth (for profile info, not messaging)
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || ''
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || ''
const LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || 'https://wellsonyx.com/api/integrations/linkedin/callback'

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const LINKEDIN_API_URL = 'https://api.linkedin.com/v2'

// ============================================================================
// LINKEDIN DM SENDER CLASS
// ============================================================================

export class LinkedInDMSender implements IChannelSender {
  readonly channelType = 'linkedin_dm' as const

  /**
   * "Send" a LinkedIn DM
   *
   * IMPORTANT: This doesn't actually send - it queues for manual sending.
   * LinkedIn has no public messaging API.
   */
  async send(
    message: ChannelMessage,
    credentials: UserChannelCredentials
  ): Promise<SendResult> {
    console.log('[LinkedInDMSender] Queuing message for manual sending (no API available)')

    try {
      // Queue the message for manual sending
      const queueId = await this.queueMessage(credentials.userId, message)

      // Record for rate limiting (even queued messages count)
      await this.recordSend(credentials.userId)

      return {
        success: true,
        messageId: queueId,
        channel: this.channelType,
        queued: true,
        sentAt: new Date(),
        // Include instructions for the user
        rateLimitInfo: undefined,
      }
    } catch (error: any) {
      console.error('[LinkedInDMSender] Queue failed:', error)

      return {
        success: false,
        channel: this.channelType,
        error: error.message || 'Failed to queue LinkedIn message',
        retryable: true,
      }
    }
  }

  /**
   * Queue a message for manual sending
   */
  private async queueMessage(userId: string, message: ChannelMessage): Promise<string> {
    const id = uuidv4()
    const recipientId = Array.isArray(message.to) ? message.to[0] : message.to

    await query(
      `INSERT INTO linkedin_message_queue (
        id, user_id, recipient_identifier, recipient_name,
        message_type, content, character_count,
        status, priority, campaign_id,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 3, $8, NOW(), NOW())`,
      [
        id,
        userId,
        recipientId,
        message.toName || recipientId,
        message.subject ? 'inmail' : 'dm',
        message.body,
        message.body.length,
        message.campaignId,
      ]
    )

    return id
  }

  /**
   * Validate credentials
   *
   * For LinkedIn, we just check if we have profile access.
   * We can't actually validate messaging ability since there's no API.
   */
  async validateCredentials(credentials: UserChannelCredentials): Promise<boolean> {
    if (!credentials.accessToken) {
      return false
    }

    try {
      // Check if token works for basic profile
      const response = await fetch(`${LINKEDIN_API_URL}/me`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      })

      return response.ok
    } catch (error) {
      console.error('[LinkedInDMSender] Credential validation failed:', error)
      return false
    }
  }

  /**
   * Refresh credentials
   */
  async refreshCredentials(credentials: UserChannelCredentials): Promise<UserChannelCredentials> {
    // LinkedIn tokens are long-lived (60 days) and don't have refresh tokens
    // in the basic scope. Would need to re-authorize.
    console.warn('[LinkedInDMSender] LinkedIn tokens cannot be refreshed - user must re-authorize')

    return credentials
  }

  /**
   * Get rate limit status
   *
   * Important: LinkedIn is VERY strict about messaging limits.
   * Even with Sales Navigator, you get ~100 InMails/month.
   */
  async getRateLimitStatus(userId: string): Promise<RateLimitStatus> {
    const limits = DEFAULT_RATE_LIMITS.linkedin_dm
    const now = new Date()
    const hourAgo = new Date(now.getTime() - 3600000)
    const dayAgo = new Date(now.getTime() - 86400000)
    const weekAgo = new Date(now.getTime() - 7 * 86400000)

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

    const weeklyResult = await query(
      `SELECT COUNT(*)::int as count FROM channel_sends
       WHERE user_id = $1 AND channel = $2 AND sent_at > $3`,
      [userId, this.channelType, weekAgo]
    )

    const sentInHour = hourlyResult?.rows?.[0]?.count || 0
    const sentToday = dailyResult?.rows?.[0]?.count || 0
    const sentThisWeek = weeklyResult?.rows?.[0]?.count || 0

    const remaining = Math.min(
      (limits.perHour || 20) - sentInHour,
      (limits.perDay || 50) - sentToday,
      (limits.perWeek || 100) - sentThisWeek
    )

    return {
      channel: this.channelType,
      userId,
      canSend: remaining > 0,
      remaining: Math.max(0, remaining),
      limit: limits.perWeek || 100,
      windowStart: weekAgo,
      windowEnd: now,
      resetAt: new Date(weekAgo.getTime() + 7 * 86400000),
      sentInWindow: sentInHour,
      sentToday,
      sentThisWeek,
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
      console.error('[LinkedInDMSender] Failed to record send:', error)
    }
  }
}

// ============================================================================
// LINKEDIN INMAIL SENDER CLASS
// ============================================================================

export class LinkedInInMailSender implements IChannelSender {
  readonly channelType = 'linkedin_inmail' as const

  /**
   * "Send" an InMail
   *
   * Same limitation - queues for manual sending.
   * InMails require Sales Navigator and are even more limited.
   */
  async send(
    message: ChannelMessage,
    credentials: UserChannelCredentials
  ): Promise<SendResult> {
    console.log('[LinkedInInMailSender] Queuing InMail for manual sending')

    try {
      const id = uuidv4()

      await query(
        `INSERT INTO linkedin_message_queue (
          id, user_id, recipient_identifier, recipient_name,
          message_type, subject, content, character_count,
          status, priority, campaign_id,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'inmail', $5, $6, $7, 'pending', 3, $8, NOW(), NOW())`,
        [
          id,
          credentials.userId,
          Array.isArray(message.to) ? message.to[0] : message.to,
          message.toName,
          message.subject,
          message.body,
          message.body.length,
          message.campaignId,
        ]
      )

      await this.recordSend(credentials.userId)

      return {
        success: true,
        messageId: id,
        channel: this.channelType,
        queued: true,
        sentAt: new Date(),
      }
    } catch (error: any) {
      return {
        success: false,
        channel: this.channelType,
        error: error.message || 'Failed to queue InMail',
        retryable: true,
      }
    }
  }

  async validateCredentials(credentials: UserChannelCredentials): Promise<boolean> {
    return new LinkedInDMSender().validateCredentials(credentials)
  }

  async refreshCredentials(credentials: UserChannelCredentials): Promise<UserChannelCredentials> {
    return credentials
  }

  async getRateLimitStatus(userId: string): Promise<RateLimitStatus> {
    const limits = DEFAULT_RATE_LIMITS.linkedin_inmail
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 86400000)

    const result = await query(
      `SELECT COUNT(*)::int as count FROM channel_sends
       WHERE user_id = $1 AND channel = $2 AND sent_at > $3`,
      [userId, this.channelType, weekAgo]
    )

    const sentThisWeek = result?.rows?.[0]?.count || 0
    const remaining = (limits.perWeek || 50) - sentThisWeek

    return {
      channel: this.channelType,
      userId,
      canSend: remaining > 0,
      remaining: Math.max(0, remaining),
      limit: limits.perWeek || 50,
      windowStart: weekAgo,
      windowEnd: now,
      resetAt: new Date(weekAgo.getTime() + 7 * 86400000),
      sentInWindow: sentThisWeek,
      sentToday: sentThisWeek,
      sentThisWeek,
    }
  }

  async canSendNow(userId: string): Promise<boolean> {
    const status = await this.getRateLimitStatus(userId)
    return status.canSend
  }

  private async recordSend(userId: string): Promise<void> {
    try {
      await query(
        `INSERT INTO channel_sends (id, user_id, channel, sent_at)
         VALUES ($1, $2, $3, NOW())`,
        [uuidv4(), userId, this.channelType]
      )
    } catch (error) {
      console.error('[LinkedInInMailSender] Failed to record send:', error)
    }
  }
}

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Generate LinkedIn OAuth URL
 *
 * Note: This only gives us profile access, NOT messaging ability.
 */
export function getLinkedInAuthUrl(state: string): string {
  if (!LINKEDIN_CLIENT_ID) {
    throw new Error('LinkedIn OAuth not configured')
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINKEDIN_CLIENT_ID,
    redirect_uri: LINKEDIN_REDIRECT_URI,
    state,
    scope: 'r_liteprofile r_emailaddress',
  })

  return `${LINKEDIN_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange LinkedIn auth code for tokens
 */
export async function exchangeLinkedInCode(code: string): Promise<{
  accessToken: string
  expiryDate: Date
  email?: string
  name?: string
  linkedinId?: string
}> {
  const response = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: LINKEDIN_REDIRECT_URI,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`LinkedIn token exchange failed: ${error.error_description || error.error}`)
  }

  const tokens = await response.json()

  // Get user profile
  const profileResponse = await fetch(`${LINKEDIN_API_URL}/me`, {
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
    },
  })

  let profile: any = {}
  if (profileResponse.ok) {
    profile = await profileResponse.json()
  }

  // Get email
  const emailResponse = await fetch(`${LINKEDIN_API_URL}/emailAddress?q=members&projection=(elements*(handle~))`, {
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
    },
  })

  let email: string | undefined
  if (emailResponse.ok) {
    const emailData = await emailResponse.json()
    email = emailData.elements?.[0]?.['handle~']?.emailAddress
  }

  return {
    accessToken: tokens.access_token,
    expiryDate: new Date(Date.now() + tokens.expires_in * 1000),
    email,
    name: `${profile.localizedFirstName || ''} ${profile.localizedLastName || ''}`.trim() || undefined,
    linkedinId: profile.id,
  }
}

/**
 * Connect a LinkedIn account for a user
 */
export async function connectLinkedInAccount(
  userId: string,
  tokenData: {
    accessToken: string
    expiryDate: Date
    email?: string
    name?: string
    linkedinId?: string
  }
): Promise<UserChannelCredentials> {
  const id = uuidv4()

  const existing = await query(
    `SELECT id FROM channel_credentials WHERE user_id = $1 AND channel = $2`,
    [userId, 'linkedin_dm']
  )

  const credentials: UserChannelCredentials = {
    userId,
    channel: 'linkedin_dm',
    accessToken: tokenData.accessToken,
    tokenExpiry: tokenData.expiryDate,
    email: tokenData.email,
    displayName: tokenData.name,
    isActive: true,
    errorCount: 0,
  }

  if (existing?.rows?.length > 0) {
    await query(
      `UPDATE channel_credentials SET
        access_token = $1,
        token_expiry = $2,
        email = $3,
        display_name = $4,
        is_active = true,
        error_count = 0,
        last_error = NULL,
        updated_at = NOW()
       WHERE user_id = $5 AND channel = $6`,
      [
        tokenData.accessToken,
        tokenData.expiryDate,
        tokenData.email,
        tokenData.name,
        userId,
        'linkedin_dm',
      ]
    )
  } else {
    await query(
      `INSERT INTO channel_credentials (
        id, user_id, channel,
        access_token, token_expiry,
        email, display_name,
        is_active, error_count,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, 0, NOW(), NOW())`,
      [
        id,
        userId,
        'linkedin_dm',
        tokenData.accessToken,
        tokenData.expiryDate,
        tokenData.email,
        tokenData.name,
      ]
    )
  }

  return credentials
}

// ============================================================================
// QUEUE MANAGEMENT
// ============================================================================

/**
 * Get queued messages for a user to manually send
 */
export async function getQueuedLinkedInMessages(
  userId: string,
  status: 'pending' | 'sent' | 'skipped' = 'pending'
): Promise<any[]> {
  const result = await query(
    `SELECT * FROM linkedin_message_queue
     WHERE user_id = $1 AND status = $2
     ORDER BY priority DESC, created_at ASC
     LIMIT 50`,
    [userId, status]
  )

  return result?.rows || []
}

/**
 * Mark a queued message as sent
 */
export async function markLinkedInMessageSent(
  userId: string,
  messageId: string
): Promise<void> {
  await query(
    `UPDATE linkedin_message_queue
     SET status = 'sent', sent_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [messageId, userId]
  )
}

/**
 * Skip a queued message
 */
export async function skipLinkedInMessage(
  userId: string,
  messageId: string,
  reason?: string
): Promise<void> {
  await query(
    `UPDATE linkedin_message_queue
     SET status = 'skipped', notes = $3, updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [messageId, userId, reason]
  )
}

/**
 * Get the next message to send
 */
export async function getNextLinkedInMessage(userId: string): Promise<any | null> {
  const result = await query(
    `SELECT * FROM linkedin_message_queue
     WHERE user_id = $1 AND status = 'pending'
     ORDER BY priority DESC, created_at ASC
     LIMIT 1`,
    [userId]
  )

  return result?.rows?.[0] || null
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

export const linkedInDMSender = new LinkedInDMSender()
export const linkedInInMailSender = new LinkedInInMailSender()

export default {
  linkedInDMSender,
  linkedInInMailSender,
  getLinkedInAuthUrl,
  exchangeLinkedInCode,
  connectLinkedInAccount,
  getQueuedLinkedInMessages,
  markLinkedInMessageSent,
  skipLinkedInMessage,
  getNextLinkedInMessage,
}
