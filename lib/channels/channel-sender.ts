// @ts-nocheck
/**
 * Channel Sender - Abstract Interface
 *
 * Unified interface for sending messages across all channels:
 * - Email (Gmail, Outlook, Wells native)
 * - Social (Twitter DMs, LinkedIn messages)
 * - SMS (User's Twilio, Wells Twilio)
 *
 * Each channel sender implements this interface, allowing WellsAI
 * to send on behalf of users when they've connected their accounts.
 */

// ============================================================================
// CHANNEL TYPES
// ============================================================================

export type ChannelType =
  | 'email_gmail'
  | 'email_outlook'
  | 'email_wells'      // Native Wells email (fallback)
  | 'twitter_dm'
  | 'twitter_tweet'
  | 'linkedin_dm'
  | 'linkedin_inmail'
  | 'sms_user'         // User's own Twilio
  | 'sms_wells'        // Wells Twilio (fallback)

export type ChannelCategory = 'email' | 'social' | 'sms'

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export interface ChannelMessage {
  id?: string
  channel: ChannelType

  // Recipient
  to: string | string[]     // Email addresses, phone numbers, or user IDs
  toName?: string           // Display name

  // Content
  subject?: string          // For email and InMail
  body: string              // Plain text or HTML
  htmlBody?: string         // Rich HTML (email only)

  // Threading
  threadId?: string         // For replies
  inReplyTo?: string        // Message ID being replied to
  references?: string       // Email references header

  // Attachments
  attachments?: ChannelAttachment[]

  // Tracking
  trackingId?: string       // For analytics
  campaignId?: string       // Link to campaign

  // Personalization tokens already resolved
  metadata?: Record<string, any>
}

export interface ChannelAttachment {
  filename: string
  content: string | Buffer
  contentType: string
  size?: number
}

// ============================================================================
// SEND RESULT
// ============================================================================

export interface SendResult {
  success: boolean
  messageId?: string          // Our internal ID
  providerMessageId?: string  // Provider's message ID
  channel: ChannelType
  sentAt?: Date

  // For queued/async sends
  queued?: boolean
  queuePosition?: number
  estimatedSendTime?: Date

  // Error handling
  error?: string
  errorCode?: string
  retryable?: boolean

  // Rate limit info
  rateLimitInfo?: {
    remaining: number
    resetAt: Date
    limit: number
  }
}

// ============================================================================
// USER CREDENTIALS
// ============================================================================

export interface UserChannelCredentials {
  userId: string
  channel: ChannelType

  // OAuth tokens (for Gmail, Outlook, Twitter, LinkedIn)
  accessToken?: string
  refreshToken?: string
  tokenExpiry?: Date

  // Direct credentials (for Twilio)
  accountSid?: string
  authToken?: string
  fromNumber?: string

  // Account info
  email?: string
  displayName?: string
  signature?: string

  // Status
  isActive: boolean
  lastUsedAt?: Date
  errorCount: number
  lastError?: string
}

// ============================================================================
// CHANNEL SENDER INTERFACE
// ============================================================================

export interface IChannelSender {
  /**
   * Channel type this sender handles
   */
  readonly channelType: ChannelType

  /**
   * Send a message
   */
  send(
    message: ChannelMessage,
    credentials: UserChannelCredentials
  ): Promise<SendResult>

  /**
   * Check if credentials are valid and not expired
   */
  validateCredentials(credentials: UserChannelCredentials): Promise<boolean>

  /**
   * Refresh credentials if needed (OAuth token refresh)
   */
  refreshCredentials?(credentials: UserChannelCredentials): Promise<UserChannelCredentials>

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(userId: string): Promise<RateLimitStatus>

  /**
   * Check if we can send right now
   */
  canSendNow(userId: string): Promise<boolean>
}

// ============================================================================
// RATE LIMITING
// ============================================================================

export interface RateLimitStatus {
  channel: ChannelType
  userId: string

  // Current status
  canSend: boolean
  remaining: number
  limit: number

  // Time windows
  windowStart: Date
  windowEnd: Date
  resetAt: Date

  // Historical
  sentInWindow: number
  sentToday: number
  sentThisWeek: number
}

export interface RateLimitConfig {
  channel: ChannelType

  // Limits per time window
  perMinute?: number
  perHour?: number
  perDay?: number
  perWeek?: number

  // Burst limits
  burstSize?: number
  burstWindow?: number  // seconds

  // Cool-down
  minDelayBetweenSends?: number  // milliseconds
}

// Default rate limits by channel
export const DEFAULT_RATE_LIMITS: Record<ChannelType, RateLimitConfig> = {
  email_gmail: {
    channel: 'email_gmail',
    perMinute: 10,
    perHour: 100,
    perDay: 500,
    minDelayBetweenSends: 1000,
  },
  email_outlook: {
    channel: 'email_outlook',
    perMinute: 10,
    perHour: 100,
    perDay: 500,
    minDelayBetweenSends: 1000,
  },
  email_wells: {
    channel: 'email_wells',
    perMinute: 20,
    perHour: 200,
    perDay: 1000,
    minDelayBetweenSends: 500,
  },
  twitter_dm: {
    channel: 'twitter_dm',
    perMinute: 5,
    perHour: 50,
    perDay: 100,
    minDelayBetweenSends: 5000,
  },
  twitter_tweet: {
    channel: 'twitter_tweet',
    perMinute: 5,
    perHour: 25,
    perDay: 50,
    minDelayBetweenSends: 10000,
  },
  linkedin_dm: {
    channel: 'linkedin_dm',
    perMinute: 2,
    perHour: 20,
    perDay: 50,
    perWeek: 100,  // LinkedIn is very strict
    minDelayBetweenSends: 10000,
  },
  linkedin_inmail: {
    channel: 'linkedin_inmail',
    perMinute: 1,
    perHour: 10,
    perDay: 25,
    perWeek: 50,
    minDelayBetweenSends: 30000,
  },
  sms_user: {
    channel: 'sms_user',
    perMinute: 5,
    perHour: 30,
    perDay: 100,
    minDelayBetweenSends: 2000,
  },
  sms_wells: {
    channel: 'sms_wells',
    perMinute: 10,
    perHour: 100,
    perDay: 500,
    minDelayBetweenSends: 1000,
  },
}

// ============================================================================
// CHANNEL REGISTRY
// ============================================================================

const channelSenders: Map<ChannelType, IChannelSender> = new Map()

/**
 * Register a channel sender
 */
export function registerChannelSender(sender: IChannelSender): void {
  channelSenders.set(sender.channelType, sender)
}

/**
 * Get a channel sender
 */
export function getChannelSender(channel: ChannelType): IChannelSender | undefined {
  return channelSenders.get(channel)
}

/**
 * Get all registered channels
 */
export function getRegisteredChannels(): ChannelType[] {
  return Array.from(channelSenders.keys())
}

// ============================================================================
// CHANNEL HELPERS
// ============================================================================

/**
 * Get the category for a channel
 */
export function getChannelCategory(channel: ChannelType): ChannelCategory {
  if (channel.startsWith('email_')) return 'email'
  if (channel.startsWith('twitter_') || channel.startsWith('linkedin_')) return 'social'
  if (channel.startsWith('sms_')) return 'sms'
  return 'email'  // default
}

/**
 * Get the fallback channel for a given channel
 */
export function getFallbackChannel(channel: ChannelType): ChannelType | null {
  const fallbacks: Partial<Record<ChannelType, ChannelType>> = {
    email_gmail: 'email_wells',
    email_outlook: 'email_wells',
    sms_user: 'sms_wells',
  }
  return fallbacks[channel] || null
}

/**
 * Check if a channel is a user-authenticated channel
 */
export function isUserAuthenticatedChannel(channel: ChannelType): boolean {
  return ['email_gmail', 'email_outlook', 'twitter_dm', 'twitter_tweet', 'linkedin_dm', 'linkedin_inmail', 'sms_user'].includes(channel)
}

/**
 * Check if a channel is a Wells-owned channel (fallback)
 */
export function isWellsChannel(channel: ChannelType): boolean {
  return ['email_wells', 'sms_wells'].includes(channel)
}

/**
 * Get display name for channel
 */
export function getChannelDisplayName(channel: ChannelType): string {
  const names: Record<ChannelType, string> = {
    email_gmail: 'Gmail',
    email_outlook: 'Outlook',
    email_wells: 'Wells Email',
    twitter_dm: 'Twitter DM',
    twitter_tweet: 'Tweet',
    linkedin_dm: 'LinkedIn Message',
    linkedin_inmail: 'LinkedIn InMail',
    sms_user: 'Your SMS',
    sms_wells: 'Wells SMS',
  }
  return names[channel] || channel
}

// ============================================================================
// UNIFIED SEND FUNCTION
// ============================================================================

export interface UnifiedSendOptions {
  userId: string
  message: ChannelMessage
  preferredChannel?: ChannelType
  allowFallback?: boolean
  requireUserAuth?: boolean  // Only send if user has connected account
}

/**
 * Send a message through the best available channel
 */
export async function sendMessage(
  options: UnifiedSendOptions,
  getUserCredentials: (userId: string, channel: ChannelType) => Promise<UserChannelCredentials | null>
): Promise<SendResult> {
  const { userId, message, preferredChannel, allowFallback = true, requireUserAuth = false } = options

  // Determine channel order to try
  const channelsToTry: ChannelType[] = []

  if (preferredChannel) {
    channelsToTry.push(preferredChannel)

    if (allowFallback) {
      const fallback = getFallbackChannel(preferredChannel)
      if (fallback) {
        channelsToTry.push(fallback)
      }
    }
  } else {
    channelsToTry.push(message.channel)

    if (allowFallback) {
      const fallback = getFallbackChannel(message.channel)
      if (fallback) {
        channelsToTry.push(fallback)
      }
    }
  }

  // Try each channel
  for (const channel of channelsToTry) {
    // Skip Wells channels if user auth required
    if (requireUserAuth && isWellsChannel(channel)) {
      continue
    }

    const sender = getChannelSender(channel)
    if (!sender) {
      console.warn(`[ChannelSender] No sender registered for channel: ${channel}`)
      continue
    }

    // Get credentials
    const credentials = await getUserCredentials(userId, channel)
    if (!credentials && isUserAuthenticatedChannel(channel)) {
      console.log(`[ChannelSender] No credentials for ${channel}, trying next channel`)
      continue
    }

    // For Wells channels, create a dummy credentials object
    const effectiveCredentials: UserChannelCredentials = credentials || {
      userId,
      channel,
      isActive: true,
      errorCount: 0,
    }

    // Check rate limits
    const canSend = await sender.canSendNow(userId)
    if (!canSend) {
      console.log(`[ChannelSender] Rate limited on ${channel}, trying next channel`)
      continue
    }

    // Validate credentials if user-authenticated
    if (isUserAuthenticatedChannel(channel) && credentials) {
      const isValid = await sender.validateCredentials(credentials)
      if (!isValid) {
        console.log(`[ChannelSender] Invalid credentials for ${channel}, trying next channel`)
        continue
      }
    }

    // Send!
    try {
      const result = await sender.send(
        { ...message, channel },
        effectiveCredentials
      )

      if (result.success) {
        return result
      }

      // If retryable error and we have fallback, continue
      if (result.retryable && allowFallback) {
        console.log(`[ChannelSender] Retryable error on ${channel}: ${result.error}`)
        continue
      }

      // Non-retryable error
      return result
    } catch (error: any) {
      console.error(`[ChannelSender] Error sending via ${channel}:`, error)

      if (allowFallback) {
        continue
      }

      return {
        success: false,
        channel,
        error: error.message || 'Unknown error',
        retryable: true,
      }
    }
  }

  // All channels failed
  return {
    success: false,
    channel: message.channel,
    error: 'All channels failed or unavailable',
    retryable: false,
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  registerChannelSender,
  getChannelSender,
  getRegisteredChannels,
  getChannelCategory,
  getFallbackChannel,
  isUserAuthenticatedChannel,
  isWellsChannel,
  getChannelDisplayName,
  sendMessage,
  DEFAULT_RATE_LIMITS,
}
