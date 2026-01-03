// @ts-nocheck
/**
 * SMS Sender
 *
 * Send SMS messages via Twilio. Supports two modes:
 *
 * 1. User's Twilio - Send from user's own Twilio account/number
 * 2. Wells Twilio - Send from Wells' Twilio account (fallback)
 *
 * The user mode allows sending FROM the user's business number,
 * which is more personal and gets better response rates.
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

// Wells Twilio (fallback)
const WELLS_TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || ''
const WELLS_TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || ''
const WELLS_TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || ''

const TWILIO_API_URL = 'https://api.twilio.com/2010-04-01'

// ============================================================================
// USER SMS SENDER CLASS
// ============================================================================

export class UserSMSSender implements IChannelSender {
  readonly channelType = 'sms_user' as const

  /**
   * Send SMS from user's Twilio account
   */
  async send(
    message: ChannelMessage,
    credentials: UserChannelCredentials
  ): Promise<SendResult> {
    if (!credentials.accountSid || !credentials.authToken || !credentials.fromNumber) {
      return {
        success: false,
        channel: this.channelType,
        error: 'Twilio credentials not configured. Connect your Twilio account first.',
        retryable: false,
      }
    }

    try {
      const toNumber = Array.isArray(message.to) ? message.to[0] : message.to

      // Validate phone number format
      const normalizedTo = this.normalizePhone(toNumber)
      if (!normalizedTo) {
        return {
          success: false,
          channel: this.channelType,
          error: `Invalid phone number: ${toNumber}`,
          retryable: false,
        }
      }

      // Add tracking link if placeholder exists
      let body = message.body
      if (message.trackingId && body.includes('[LINK]')) {
        const trackingUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/r/${message.trackingId}`
        body = body.replace(/\[LINK\]/g, trackingUrl)
      }

      // Send via Twilio
      const response = await fetch(
        `${TWILIO_API_URL}/Accounts/${credentials.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: normalizedTo,
            From: credentials.fromNumber,
            Body: body,
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Twilio error: ${response.status}`)
      }

      const result = await response.json()

      // Record send
      await this.recordSend(credentials.userId)

      // Store message
      await this.storeSentMessage(credentials, message, normalizedTo, result.sid)

      return {
        success: true,
        messageId: uuidv4(),
        providerMessageId: result.sid,
        channel: this.channelType,
        sentAt: new Date(),
      }
    } catch (error: any) {
      console.error('[UserSMSSender] Send failed:', error)

      const isRateLimit = error.message?.includes('rate limit') || error.message?.includes('21610')
      const isAuthError = error.message?.includes('20003') || error.message?.includes('invalid credentials')

      return {
        success: false,
        channel: this.channelType,
        error: error.message || 'Failed to send SMS',
        retryable: isRateLimit || (!isAuthError),
      }
    }
  }

  /**
   * Normalize phone number to E.164 format
   */
  private normalizePhone(phone: string): string | null {
    const digits = phone.replace(/\D/g, '')

    if (digits.length === 10) {
      return `+1${digits}`
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`
    } else if (digits.length > 10 && !phone.startsWith('+')) {
      return `+${digits}`
    } else if (phone.startsWith('+')) {
      return phone
    }

    // Invalid
    if (digits.length < 10) {
      return null
    }

    return `+${digits}`
  }

  /**
   * Validate Twilio credentials
   */
  async validateCredentials(credentials: UserChannelCredentials): Promise<boolean> {
    if (!credentials.accountSid || !credentials.authToken) {
      return false
    }

    try {
      const response = await fetch(
        `${TWILIO_API_URL}/Accounts/${credentials.accountSid}.json`,
        {
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString('base64'),
          },
        }
      )

      return response.ok
    } catch (error) {
      console.error('[UserSMSSender] Credential validation failed:', error)
      return false
    }
  }

  /**
   * No refresh needed for Twilio (API key based)
   */
  async refreshCredentials(credentials: UserChannelCredentials): Promise<UserChannelCredentials> {
    return credentials
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(userId: string): Promise<RateLimitStatus> {
    const limits = DEFAULT_RATE_LIMITS.sms_user
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
      (limits.perHour || 30) - sentInHour,
      (limits.perDay || 100) - sentToday
    )

    return {
      channel: this.channelType,
      userId,
      canSend: remaining > 0,
      remaining: Math.max(0, remaining),
      limit: limits.perHour || 30,
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
      console.error('[UserSMSSender] Failed to record send:', error)
    }
  }

  /**
   * Store sent message for tracking
   */
  private async storeSentMessage(
    credentials: UserChannelCredentials,
    message: ChannelMessage,
    toNumber: string,
    twilioSid: string
  ): Promise<void> {
    const messageId = uuidv4()

    try {
      await query(
        `INSERT INTO channel_messages (
          id, user_id, channel, provider_message_id,
          from_address, to_address, body,
          tracking_id, campaign_id, status, sent_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'sent', NOW())`,
        [
          messageId,
          credentials.userId,
          this.channelType,
          twilioSid,
          credentials.fromNumber,
          toNumber,
          message.body,
          message.trackingId,
          message.campaignId,
        ]
      )
    } catch (error) {
      console.error('[UserSMSSender] Failed to store message:', error)
    }
  }
}

// ============================================================================
// WELLS SMS SENDER CLASS (FALLBACK)
// ============================================================================

export class WellsSMSSender implements IChannelSender {
  readonly channelType = 'sms_wells' as const

  /**
   * Send SMS from Wells' Twilio account
   */
  async send(
    message: ChannelMessage,
    credentials: UserChannelCredentials
  ): Promise<SendResult> {
    if (!WELLS_TWILIO_ACCOUNT_SID || !WELLS_TWILIO_AUTH_TOKEN || !WELLS_TWILIO_PHONE_NUMBER) {
      return {
        success: false,
        channel: this.channelType,
        error: 'Wells Twilio not configured',
        retryable: false,
      }
    }

    try {
      const toNumber = Array.isArray(message.to) ? message.to[0] : message.to

      // Normalize phone
      const normalizedTo = this.normalizePhone(toNumber)
      if (!normalizedTo) {
        return {
          success: false,
          channel: this.channelType,
          error: `Invalid phone number: ${toNumber}`,
          retryable: false,
        }
      }

      // Add tracking link if placeholder exists
      let body = message.body
      if (message.trackingId && body.includes('[LINK]')) {
        const trackingUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/r/${message.trackingId}`
        body = body.replace(/\[LINK\]/g, trackingUrl)
      }

      // Send via Wells Twilio
      const response = await fetch(
        `${TWILIO_API_URL}/Accounts/${WELLS_TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${WELLS_TWILIO_ACCOUNT_SID}:${WELLS_TWILIO_AUTH_TOKEN}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: normalizedTo,
            From: WELLS_TWILIO_PHONE_NUMBER,
            Body: body,
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Twilio error: ${response.status}`)
      }

      const result = await response.json()

      // Record send (using Wells internal ID for rate limiting)
      await this.recordSend(credentials.userId)

      // Store message
      await this.storeSentMessage(credentials, message, normalizedTo, result.sid)

      return {
        success: true,
        messageId: uuidv4(),
        providerMessageId: result.sid,
        channel: this.channelType,
        sentAt: new Date(),
      }
    } catch (error: any) {
      console.error('[WellsSMSSender] Send failed:', error)

      return {
        success: false,
        channel: this.channelType,
        error: error.message || 'Failed to send SMS via Wells',
        retryable: true,
      }
    }
  }

  /**
   * Normalize phone number
   */
  private normalizePhone(phone: string): string | null {
    const digits = phone.replace(/\D/g, '')

    if (digits.length === 10) {
      return `+1${digits}`
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`
    } else if (digits.length > 10 && !phone.startsWith('+')) {
      return `+${digits}`
    } else if (phone.startsWith('+')) {
      return phone
    }

    if (digits.length < 10) {
      return null
    }

    return `+${digits}`
  }

  /**
   * Wells credentials are always valid if configured
   */
  async validateCredentials(_credentials: UserChannelCredentials): Promise<boolean> {
    return !!(WELLS_TWILIO_ACCOUNT_SID && WELLS_TWILIO_AUTH_TOKEN && WELLS_TWILIO_PHONE_NUMBER)
  }

  async refreshCredentials(credentials: UserChannelCredentials): Promise<UserChannelCredentials> {
    return credentials
  }

  /**
   * Rate limit status for Wells SMS
   */
  async getRateLimitStatus(userId: string): Promise<RateLimitStatus> {
    const limits = DEFAULT_RATE_LIMITS.sms_wells
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
      console.error('[WellsSMSSender] Failed to record send:', error)
    }
  }

  private async storeSentMessage(
    credentials: UserChannelCredentials,
    message: ChannelMessage,
    toNumber: string,
    twilioSid: string
  ): Promise<void> {
    const messageId = uuidv4()

    try {
      await query(
        `INSERT INTO channel_messages (
          id, user_id, channel, provider_message_id,
          from_address, to_address, body,
          tracking_id, campaign_id, status, sent_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'sent', NOW())`,
        [
          messageId,
          credentials.userId,
          this.channelType,
          twilioSid,
          WELLS_TWILIO_PHONE_NUMBER,
          toNumber,
          message.body,
          message.trackingId,
          message.campaignId,
        ]
      )
    } catch (error) {
      console.error('[WellsSMSSender] Failed to store message:', error)
    }
  }
}

// ============================================================================
// TWILIO ACCOUNT CONNECTION
// ============================================================================

/**
 * Connect a user's Twilio account
 */
export async function connectTwilioAccount(
  userId: string,
  twilioData: {
    accountSid: string
    authToken: string
    fromNumber: string
    friendlyName?: string
  }
): Promise<UserChannelCredentials> {
  const id = uuidv4()

  // Validate the credentials first
  const testResponse = await fetch(
    `${TWILIO_API_URL}/Accounts/${twilioData.accountSid}.json`,
    {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${twilioData.accountSid}:${twilioData.authToken}`).toString('base64'),
      },
    }
  )

  if (!testResponse.ok) {
    throw new Error('Invalid Twilio credentials')
  }

  const existing = await query(
    `SELECT id FROM channel_credentials WHERE user_id = $1 AND channel = $2`,
    [userId, 'sms_user']
  )

  const credentials: UserChannelCredentials = {
    userId,
    channel: 'sms_user',
    accountSid: twilioData.accountSid,
    authToken: twilioData.authToken,
    fromNumber: twilioData.fromNumber,
    displayName: twilioData.friendlyName || twilioData.fromNumber,
    isActive: true,
    errorCount: 0,
  }

  if (existing?.rows?.length > 0) {
    await query(
      `UPDATE channel_credentials SET
        account_sid = $1,
        auth_token = $2,
        from_number = $3,
        display_name = $4,
        is_active = true,
        error_count = 0,
        last_error = NULL,
        updated_at = NOW()
       WHERE user_id = $5 AND channel = $6`,
      [
        twilioData.accountSid,
        twilioData.authToken,
        twilioData.fromNumber,
        twilioData.friendlyName || twilioData.fromNumber,
        userId,
        'sms_user',
      ]
    )
  } else {
    await query(
      `INSERT INTO channel_credentials (
        id, user_id, channel,
        account_sid, auth_token, from_number,
        display_name,
        is_active, error_count,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, 0, NOW(), NOW())`,
      [
        id,
        userId,
        'sms_user',
        twilioData.accountSid,
        twilioData.authToken,
        twilioData.fromNumber,
        twilioData.friendlyName || twilioData.fromNumber,
      ]
    )
  }

  return credentials
}

/**
 * Get user's phone numbers from their Twilio account
 */
export async function getUserTwilioNumbers(
  accountSid: string,
  authToken: string
): Promise<Array<{ number: string; friendlyName: string }>> {
  const response = await fetch(
    `${TWILIO_API_URL}/Accounts/${accountSid}/IncomingPhoneNumbers.json`,
    {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
    }
  )

  if (!response.ok) {
    throw new Error('Failed to fetch Twilio phone numbers')
  }

  const data = await response.json()

  return (data.incoming_phone_numbers || []).map((num: any) => ({
    number: num.phone_number,
    friendlyName: num.friendly_name,
  }))
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

export const userSMSSender = new UserSMSSender()
export const wellsSMSSender = new WellsSMSSender()

export default {
  userSMSSender,
  wellsSMSSender,
  connectTwilioAccount,
  getUserTwilioNumbers,
}
