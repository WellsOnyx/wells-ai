// @ts-nocheck
/**
 * Channels Index
 *
 * Unified exports for the channel sender system.
 * This module allows WellsAI to send messages on behalf of users
 * through their connected accounts (Gmail, Outlook, Twitter, LinkedIn, Twilio).
 */

// ============================================================================
// CORE TYPES & INTERFACES
// ============================================================================

export {
  // Types
  type ChannelType,
  type ChannelCategory,
  type ChannelMessage,
  type ChannelAttachment,
  type SendResult,
  type UserChannelCredentials,
  type RateLimitStatus,
  type RateLimitConfig,

  // Interface
  type IChannelSender,

  // Constants
  DEFAULT_RATE_LIMITS,

  // Registry
  registerChannelSender,
  getChannelSender,
  getRegisteredChannels,

  // Helpers
  getChannelCategory,
  getFallbackChannel,
  isUserAuthenticatedChannel,
  isWellsChannel,
  getChannelDisplayName,

  // Unified send
  sendMessage,
} from './channel-sender'

// ============================================================================
// EMAIL SENDERS
// ============================================================================

export {
  gmailSender,
  GmailSender,
  getGmailAuthUrl,
  exchangeGmailCode,
  connectGmailAccount,
} from './gmail-sender'

export {
  outlookSender,
  OutlookSender,
  getOutlookAuthUrl,
  exchangeOutlookCode,
  connectOutlookAccount,
} from './outlook-sender'

// ============================================================================
// SOCIAL SENDERS
// ============================================================================

export {
  twitterDMSender,
  twitterTweetSender,
  TwitterDMSender,
  TwitterTweetSender,
  getTwitterAuthUrl,
  exchangeTwitterCode,
  connectTwitterAccount,
} from './twitter-sender'

export {
  linkedInDMSender,
  linkedInInMailSender,
  LinkedInDMSender,
  LinkedInInMailSender,
  getLinkedInAuthUrl,
  exchangeLinkedInCode,
  connectLinkedInAccount,
  getQueuedLinkedInMessages,
  markLinkedInMessageSent,
  skipLinkedInMessage,
  getNextLinkedInMessage,
} from './linkedin-sender'

// ============================================================================
// SMS SENDERS
// ============================================================================

export {
  userSMSSender,
  wellsSMSSender,
  UserSMSSender,
  WellsSMSSender,
  connectTwilioAccount,
  getUserTwilioNumbers,
} from './sms-sender'

// ============================================================================
// SEND QUEUE
// ============================================================================

export {
  // Queue types
  type QueuedMessage,
  type QueuedMessageStatus,
  type MessagePriority,
  type QueueOptions,
  type ProcessOptions,
  type ProcessResult,
  type QueueStats,

  // Queue operations
  queueMessage,
  queueMessages,
  getQueuedMessages,
  getQueuedMessage,
  cancelQueuedMessage,
  cancelCampaign,

  // Queue processing
  processQueue,
  getQueueStats,

  // Credentials
  getUserChannelCredentials,
  getUserCredentials,
} from './send-queue'

// ============================================================================
// CONVENIENCE FUNCTIONS FOR COLD START INTEGRATION
// ============================================================================

import { query } from '@/lib/db'
import { gmailSender, GmailSender } from './gmail-sender'
import { outlookSender, OutlookSender } from './outlook-sender'
import { userSMSSender, UserSMSSender } from './sms-sender'
import { UserChannelCredentials, ChannelMessage, SendResult } from './channel-sender'

/**
 * Get user's email credentials (Gmail or Outlook)
 */
export async function getUserEmailCredentials(userId: string): Promise<UserChannelCredentials | null> {
  // Try Gmail first
  const gmailResult = await query(
    `SELECT * FROM channel_credentials
     WHERE user_id = $1 AND channel = 'email_gmail' AND is_active = true`,
    [userId]
  )

  if (gmailResult?.rows?.[0]) {
    const row = gmailResult.rows[0]
    return {
      userId: row.user_id,
      channel: 'email_gmail',
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      tokenExpiry: row.token_expiry ? new Date(row.token_expiry) : undefined,
      email: row.email,
      displayName: row.display_name,
      signature: row.signature,
      isActive: row.is_active,
      errorCount: row.error_count || 0,
      lastError: row.last_error,
    }
  }

  // Try Outlook
  const outlookResult = await query(
    `SELECT * FROM channel_credentials
     WHERE user_id = $1 AND channel = 'email_outlook' AND is_active = true`,
    [userId]
  )

  if (outlookResult?.rows?.[0]) {
    const row = outlookResult.rows[0]
    return {
      userId: row.user_id,
      channel: 'email_outlook',
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      tokenExpiry: row.token_expiry ? new Date(row.token_expiry) : undefined,
      email: row.email,
      displayName: row.display_name,
      signature: row.signature,
      isActive: row.is_active,
      errorCount: row.error_count || 0,
      lastError: row.last_error,
    }
  }

  return null
}

/**
 * Get user's SMS credentials (Twilio)
 */
export async function getUserSMSCredentials(userId: string): Promise<UserChannelCredentials | null> {
  const result = await query(
    `SELECT * FROM channel_credentials
     WHERE user_id = $1 AND channel = 'sms_user' AND is_active = true`,
    [userId]
  )

  if (!result?.rows?.[0]) {
    return null
  }

  const row = result.rows[0]
  return {
    userId: row.user_id,
    channel: 'sms_user',
    accountSid: row.account_sid,
    authToken: row.auth_token,
    fromNumber: row.from_number,
    displayName: row.display_name,
    isActive: row.is_active,
    errorCount: row.error_count || 0,
    lastError: row.last_error,
  }
}

/**
 * Send email via user's account (Gmail or Outlook)
 */
export async function sendEmailViaUserAccount(
  userId: string,
  options: {
    to: string | string[]
    subject: string
    htmlBody: string
    text?: string
    trackingId?: string
    campaignId?: string
  }
): Promise<SendResult> {
  const credentials = await getUserEmailCredentials(userId)

  if (!credentials) {
    return {
      success: false,
      channel: 'email_gmail',
      error: 'No email account connected',
      retryable: false,
    }
  }

  const message: ChannelMessage = {
    channel: credentials.channel,
    to: options.to,
    subject: options.subject,
    body: options.text || options.htmlBody.replace(/<[^>]*>/g, ''),
    htmlBody: options.htmlBody,
    trackingId: options.trackingId,
    campaignId: options.campaignId,
  }

  if (credentials.channel === 'email_gmail') {
    return gmailSender.send(message, credentials)
  } else if (credentials.channel === 'email_outlook') {
    return outlookSender.send(message, credentials)
  }

  return {
    success: false,
    channel: credentials.channel,
    error: 'Unknown email provider',
    retryable: false,
  }
}

/**
 * Send SMS via user's Twilio account
 */
export async function sendSMSViaUserAccount(
  userId: string,
  options: {
    to: string
    body: string
    trackingId?: string
    campaignId?: string
  }
): Promise<SendResult> {
  const credentials = await getUserSMSCredentials(userId)

  if (!credentials) {
    return {
      success: false,
      channel: 'sms_user',
      error: 'No Twilio account connected',
      retryable: false,
    }
  }

  const message: ChannelMessage = {
    channel: 'sms_user',
    to: options.to,
    body: options.body,
    trackingId: options.trackingId,
    campaignId: options.campaignId,
  }

  return userSMSSender.send(message, credentials)
}

/**
 * Get all connected channels for a user
 */
export async function getUserConnectedChannels(userId: string): Promise<{
  email?: { provider: 'gmail' | 'outlook'; email: string }
  sms?: { fromNumber: string }
  twitter?: { username: string }
  linkedin?: { name: string }
}> {
  const result = await query(
    `SELECT channel, email, display_name, from_number
     FROM channel_credentials
     WHERE user_id = $1 AND is_active = true`,
    [userId]
  )

  const channels: any = {}

  for (const row of result?.rows || []) {
    if (row.channel === 'email_gmail') {
      channels.email = { provider: 'gmail', email: row.email }
    } else if (row.channel === 'email_outlook') {
      channels.email = { provider: 'outlook', email: row.email }
    } else if (row.channel === 'sms_user') {
      channels.sms = { fromNumber: row.from_number }
    } else if (row.channel === 'twitter_dm') {
      channels.twitter = { username: row.display_name }
    } else if (row.channel === 'linkedin_dm') {
      channels.linkedin = { name: row.display_name }
    }
  }

  return channels
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  // Email
  gmailSender,
  outlookSender,
  getGmailAuthUrl: () => import('./gmail-sender').then(m => m.getGmailAuthUrl),
  getOutlookAuthUrl: () => import('./outlook-sender').then(m => m.getOutlookAuthUrl),

  // Social
  twitterDMSender,
  twitterTweetSender,
  linkedInDMSender,
  linkedInInMailSender,

  // SMS
  userSMSSender,
  wellsSMSSender,

  // Convenience
  getUserEmailCredentials,
  getUserSMSCredentials,
  sendEmailViaUserAccount,
  sendSMSViaUserAccount,
  getUserConnectedChannels,
}
