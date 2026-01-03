// @ts-nocheck
/**
 * Send Queue
 *
 * Queued message sending with:
 * - Rate limiting per channel per user
 * - Retry logic with exponential backoff
 * - Priority ordering
 * - Batch processing
 * - Status tracking
 *
 * This is the central orchestrator for all outbound messages.
 * Messages go into the queue, get processed respecting rate limits,
 * and retry on failure.
 */

import { query } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import {
  ChannelType,
  ChannelMessage,
  UserChannelCredentials,
  SendResult,
  getChannelSender,
  registerChannelSender,
  DEFAULT_RATE_LIMITS,
  isWellsChannel,
} from './channel-sender'
import { gmailSender } from './gmail-sender'
import { outlookSender } from './outlook-sender'
import { twitterDMSender, twitterTweetSender } from './twitter-sender'
import { linkedInDMSender, linkedInInMailSender } from './linkedin-sender'
import { userSMSSender, wellsSMSSender } from './sms-sender'

// ============================================================================
// REGISTER ALL SENDERS
// ============================================================================

// Register all senders on module load
registerChannelSender(gmailSender)
registerChannelSender(outlookSender)
registerChannelSender(twitterDMSender)
registerChannelSender(twitterTweetSender)
registerChannelSender(linkedInDMSender)
registerChannelSender(linkedInInMailSender)
registerChannelSender(userSMSSender)
registerChannelSender(wellsSMSSender)

// ============================================================================
// TYPES
// ============================================================================

export type QueuedMessageStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'retry'
  | 'cancelled'
  | 'rate_limited'

export type MessagePriority = 1 | 2 | 3 | 4 | 5  // 5 = highest

export interface QueuedMessage {
  id: string
  userId: string

  // Channel info
  channel: ChannelType
  fallbackChannel?: ChannelType

  // Recipient
  to: string
  toName?: string

  // Content
  subject?: string
  body: string
  htmlBody?: string

  // Threading
  threadId?: string
  inReplyTo?: string
  references?: string

  // Campaign/tracking
  campaignId?: string
  trackingId?: string

  // Queue management
  priority: MessagePriority
  status: QueuedMessageStatus
  scheduledFor?: Date

  // Retry logic
  retryCount: number
  maxRetries: number
  nextRetryAt?: Date
  lastError?: string

  // Provider info
  providerMessageId?: string
  sentAt?: Date

  // Metadata
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface QueueOptions {
  priority?: MessagePriority
  scheduledFor?: Date
  maxRetries?: number
  campaignId?: string
  trackingId?: string
  fallbackChannel?: ChannelType
  metadata?: Record<string, any>
}

export interface ProcessOptions {
  batchSize?: number
  channel?: ChannelType
  userId?: string
  dryRun?: boolean
}

export interface ProcessResult {
  processed: number
  sent: number
  failed: number
  rateLimited: number
  skipped: number
}

// ============================================================================
// QUEUE MANAGEMENT
// ============================================================================

/**
 * Add a message to the send queue
 */
export async function queueMessage(
  userId: string,
  channel: ChannelType,
  message: ChannelMessage,
  options: QueueOptions = {}
): Promise<QueuedMessage> {
  const id = uuidv4()
  const now = new Date()

  const queuedMessage: QueuedMessage = {
    id,
    userId,
    channel,
    fallbackChannel: options.fallbackChannel,
    to: Array.isArray(message.to) ? message.to[0] : message.to,
    toName: message.toName,
    subject: message.subject,
    body: message.body,
    htmlBody: message.htmlBody,
    threadId: message.threadId,
    inReplyTo: message.inReplyTo,
    references: message.references,
    campaignId: options.campaignId || message.campaignId,
    trackingId: options.trackingId || message.trackingId || uuidv4(),
    priority: options.priority || 3,
    status: 'pending',
    scheduledFor: options.scheduledFor,
    retryCount: 0,
    maxRetries: options.maxRetries ?? 3,
    metadata: options.metadata || message.metadata,
    createdAt: now,
    updatedAt: now,
  }

  await query(
    `INSERT INTO message_queue (
      id, user_id, channel, fallback_channel,
      to_address, to_name, subject, body, html_body,
      thread_id, in_reply_to, references_header,
      campaign_id, tracking_id,
      priority, status, scheduled_for,
      retry_count, max_retries,
      metadata, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
    )`,
    [
      id,
      userId,
      channel,
      options.fallbackChannel,
      queuedMessage.to,
      queuedMessage.toName,
      queuedMessage.subject,
      queuedMessage.body,
      queuedMessage.htmlBody,
      queuedMessage.threadId,
      queuedMessage.inReplyTo,
      queuedMessage.references,
      queuedMessage.campaignId,
      queuedMessage.trackingId,
      queuedMessage.priority,
      'pending',
      options.scheduledFor,
      0,
      queuedMessage.maxRetries,
      JSON.stringify(options.metadata || {}),
      now,
      now,
    ]
  )

  return queuedMessage
}

/**
 * Queue multiple messages at once
 */
export async function queueMessages(
  userId: string,
  messages: Array<{
    channel: ChannelType
    message: ChannelMessage
    options?: QueueOptions
  }>
): Promise<QueuedMessage[]> {
  const results: QueuedMessage[] = []

  for (const { channel, message, options } of messages) {
    const queued = await queueMessage(userId, channel, message, options)
    results.push(queued)
  }

  return results
}

/**
 * Get messages from the queue
 */
export async function getQueuedMessages(
  filters: {
    userId?: string
    channel?: ChannelType
    status?: QueuedMessageStatus | QueuedMessageStatus[]
    campaignId?: string
    limit?: number
    offset?: number
  } = {}
): Promise<QueuedMessage[]> {
  const conditions: string[] = []
  const params: any[] = []
  let paramIndex = 1

  if (filters.userId) {
    conditions.push(`user_id = $${paramIndex}`)
    params.push(filters.userId)
    paramIndex++
  }

  if (filters.channel) {
    conditions.push(`channel = $${paramIndex}`)
    params.push(filters.channel)
    paramIndex++
  }

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
    conditions.push(`status = ANY($${paramIndex})`)
    params.push(statuses)
    paramIndex++
  }

  if (filters.campaignId) {
    conditions.push(`campaign_id = $${paramIndex}`)
    params.push(filters.campaignId)
    paramIndex++
  }

  const limit = filters.limit || 100
  const offset = filters.offset || 0
  params.push(limit, offset)

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const result = await query(
    `SELECT * FROM message_queue
     ${whereClause}
     ORDER BY priority DESC, scheduled_for ASC NULLS FIRST, created_at ASC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  )

  return (result?.rows || []).map(mapQueuedMessageRow)
}

/**
 * Get a single queued message
 */
export async function getQueuedMessage(messageId: string): Promise<QueuedMessage | null> {
  const result = await query(
    `SELECT * FROM message_queue WHERE id = $1`,
    [messageId]
  )

  return result?.rows?.[0] ? mapQueuedMessageRow(result.rows[0]) : null
}

/**
 * Cancel a queued message
 */
export async function cancelQueuedMessage(messageId: string): Promise<boolean> {
  const result = await query(
    `UPDATE message_queue
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND status IN ('pending', 'retry', 'rate_limited')`,
    [messageId]
  )

  return (result?.rowCount || 0) > 0
}

/**
 * Cancel all pending messages for a campaign
 */
export async function cancelCampaign(campaignId: string): Promise<number> {
  const result = await query(
    `UPDATE message_queue
     SET status = 'cancelled', updated_at = NOW()
     WHERE campaign_id = $1 AND status IN ('pending', 'retry', 'rate_limited')`,
    [campaignId]
  )

  return result?.rowCount || 0
}

// ============================================================================
// QUEUE PROCESSING
// ============================================================================

/**
 * Process queued messages
 *
 * This is called by a cron job or worker to actually send messages.
 */
export async function processQueue(
  options: ProcessOptions = {},
  getCredentials: (userId: string, channel: ChannelType) => Promise<UserChannelCredentials | null>
): Promise<ProcessResult> {
  const batchSize = options.batchSize || 50
  const now = new Date()

  // Build query for messages to process
  const conditions: string[] = [
    `status IN ('pending', 'retry')`,
    `(scheduled_for IS NULL OR scheduled_for <= $1)`,
    `(next_retry_at IS NULL OR next_retry_at <= $1)`,
  ]
  const params: any[] = [now]
  let paramIndex = 2

  if (options.channel) {
    conditions.push(`channel = $${paramIndex}`)
    params.push(options.channel)
    paramIndex++
  }

  if (options.userId) {
    conditions.push(`user_id = $${paramIndex}`)
    params.push(options.userId)
    paramIndex++
  }

  params.push(batchSize)

  // Get messages to process
  const result = await query(
    `SELECT * FROM message_queue
     WHERE ${conditions.join(' AND ')}
     ORDER BY priority DESC, scheduled_for ASC NULLS FIRST, created_at ASC
     LIMIT $${paramIndex}
     FOR UPDATE SKIP LOCKED`,
    params
  )

  const messages = (result?.rows || []).map(mapQueuedMessageRow)

  const stats: ProcessResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    rateLimited: 0,
    skipped: 0,
  }

  for (const message of messages) {
    stats.processed++

    if (options.dryRun) {
      stats.skipped++
      continue
    }

    try {
      // Mark as processing
      await query(
        `UPDATE message_queue SET status = 'processing', updated_at = NOW() WHERE id = $1`,
        [message.id]
      )

      // Get the sender
      const sender = getChannelSender(message.channel)
      if (!sender) {
        await markMessageFailed(message.id, 'No sender for channel')
        stats.failed++
        continue
      }

      // Check rate limits
      const canSend = await sender.canSendNow(message.userId)
      if (!canSend) {
        await markMessageRateLimited(message.id)
        stats.rateLimited++
        continue
      }

      // Get credentials
      let credentials = await getCredentials(message.userId, message.channel)

      // If no user credentials and not a Wells channel, try fallback
      if (!credentials && !isWellsChannel(message.channel)) {
        if (message.fallbackChannel) {
          const fallbackSender = getChannelSender(message.fallbackChannel)
          if (fallbackSender) {
            credentials = await getCredentials(message.userId, message.fallbackChannel)
            if (credentials || isWellsChannel(message.fallbackChannel)) {
              // Use fallback channel
              const sendResult = await sendViaChannel(
                fallbackSender,
                message,
                credentials || { userId: message.userId, channel: message.fallbackChannel, isActive: true, errorCount: 0 }
              )

              if (sendResult.success) {
                await markMessageSent(message.id, sendResult.providerMessageId)
                stats.sent++
              } else {
                await handleSendFailure(message, sendResult)
                stats.failed++
              }
              continue
            }
          }
        }

        // No credentials and no fallback
        await markMessageFailed(message.id, 'No credentials available')
        stats.failed++
        continue
      }

      // For Wells channels, create dummy credentials
      if (!credentials && isWellsChannel(message.channel)) {
        credentials = {
          userId: message.userId,
          channel: message.channel,
          isActive: true,
          errorCount: 0,
        }
      }

      // Send the message
      const sendResult = await sendViaChannel(sender, message, credentials!)

      if (sendResult.success) {
        await markMessageSent(message.id, sendResult.providerMessageId)
        stats.sent++
      } else {
        await handleSendFailure(message, sendResult)
        stats.failed++
      }
    } catch (error: any) {
      console.error(`[SendQueue] Error processing message ${message.id}:`, error)
      await handleSendFailure(message, {
        success: false,
        channel: message.channel,
        error: error.message,
        retryable: true,
      })
      stats.failed++
    }
  }

  return stats
}

/**
 * Send via a channel sender
 */
async function sendViaChannel(
  sender: any,
  message: QueuedMessage,
  credentials: UserChannelCredentials
): Promise<SendResult> {
  const channelMessage: ChannelMessage = {
    channel: message.channel,
    to: message.to,
    toName: message.toName,
    subject: message.subject,
    body: message.body,
    htmlBody: message.htmlBody,
    threadId: message.threadId,
    inReplyTo: message.inReplyTo,
    references: message.references,
    trackingId: message.trackingId,
    campaignId: message.campaignId,
    metadata: message.metadata,
  }

  return sender.send(channelMessage, credentials)
}

/**
 * Mark a message as sent
 */
async function markMessageSent(messageId: string, providerMessageId?: string): Promise<void> {
  await query(
    `UPDATE message_queue
     SET status = 'sent', provider_message_id = $2, sent_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [messageId, providerMessageId]
  )
}

/**
 * Mark a message as failed
 */
async function markMessageFailed(messageId: string, error: string): Promise<void> {
  await query(
    `UPDATE message_queue
     SET status = 'failed', last_error = $2, updated_at = NOW()
     WHERE id = $1`,
    [messageId, error]
  )
}

/**
 * Mark a message as rate limited
 */
async function markMessageRateLimited(messageId: string): Promise<void> {
  // Schedule retry in 5 minutes
  const nextRetry = new Date(Date.now() + 5 * 60 * 1000)

  await query(
    `UPDATE message_queue
     SET status = 'rate_limited', next_retry_at = $2, updated_at = NOW()
     WHERE id = $1`,
    [messageId, nextRetry]
  )
}

/**
 * Handle send failure with retry logic
 */
async function handleSendFailure(message: QueuedMessage, result: SendResult): Promise<void> {
  const newRetryCount = message.retryCount + 1

  if (result.retryable && newRetryCount <= message.maxRetries) {
    // Calculate exponential backoff: 1min, 5min, 15min, 30min
    const backoffMinutes = Math.min(30, Math.pow(2, newRetryCount) + 1)
    const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000)

    await query(
      `UPDATE message_queue
       SET status = 'retry',
           retry_count = $2,
           next_retry_at = $3,
           last_error = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [message.id, newRetryCount, nextRetry, result.error]
    )
  } else {
    await query(
      `UPDATE message_queue
       SET status = 'failed',
           retry_count = $2,
           last_error = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [message.id, newRetryCount, result.error]
    )
  }
}

// ============================================================================
// QUEUE STATS
// ============================================================================

export interface QueueStats {
  pending: number
  processing: number
  sent: number
  failed: number
  retry: number
  rateLimited: number
  cancelled: number
  byChannel: Record<ChannelType, number>
  oldestPending?: Date
}

/**
 * Get queue statistics
 */
export async function getQueueStats(userId?: string): Promise<QueueStats> {
  const userFilter = userId ? 'WHERE user_id = $1' : ''
  const params = userId ? [userId] : []

  const statusResult = await query(
    `SELECT status, COUNT(*)::int as count
     FROM message_queue
     ${userFilter}
     GROUP BY status`,
    params
  )

  const channelResult = await query(
    `SELECT channel, COUNT(*)::int as count
     FROM message_queue
     ${userFilter}
     ${userId ? 'AND' : 'WHERE'} status IN ('pending', 'retry', 'rate_limited')
     GROUP BY channel`,
    params
  )

  const oldestResult = await query(
    `SELECT created_at
     FROM message_queue
     ${userFilter}
     ${userId ? 'AND' : 'WHERE'} status = 'pending'
     ORDER BY created_at ASC
     LIMIT 1`,
    params
  )

  const stats: QueueStats = {
    pending: 0,
    processing: 0,
    sent: 0,
    failed: 0,
    retry: 0,
    rateLimited: 0,
    cancelled: 0,
    byChannel: {} as Record<ChannelType, number>,
    oldestPending: oldestResult?.rows?.[0]?.created_at,
  }

  for (const row of statusResult?.rows || []) {
    const count = row.count || 0
    switch (row.status) {
      case 'pending': stats.pending = count; break
      case 'processing': stats.processing = count; break
      case 'sent': stats.sent = count; break
      case 'failed': stats.failed = count; break
      case 'retry': stats.retry = count; break
      case 'rate_limited': stats.rateLimited = count; break
      case 'cancelled': stats.cancelled = count; break
    }
  }

  for (const row of channelResult?.rows || []) {
    stats.byChannel[row.channel as ChannelType] = row.count || 0
  }

  return stats
}

// ============================================================================
// CREDENTIALS HELPER
// ============================================================================

/**
 * Get user credentials for a channel from the database
 */
export async function getUserChannelCredentials(
  userId: string,
  channel: ChannelType
): Promise<UserChannelCredentials | null> {
  const result = await query(
    `SELECT * FROM channel_credentials
     WHERE user_id = $1 AND channel = $2 AND is_active = true`,
    [userId, channel]
  )

  if (!result?.rows?.[0]) {
    return null
  }

  const row = result.rows[0]

  return {
    userId: row.user_id,
    channel: row.channel,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    tokenExpiry: row.token_expiry ? new Date(row.token_expiry) : undefined,
    accountSid: row.account_sid,
    authToken: row.auth_token,
    fromNumber: row.from_number,
    email: row.email,
    displayName: row.display_name,
    signature: row.signature,
    isActive: row.is_active,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
    errorCount: row.error_count || 0,
    lastError: row.last_error,
  }
}

/**
 * Get all active credentials for a user
 */
export async function getUserCredentials(userId: string): Promise<UserChannelCredentials[]> {
  const result = await query(
    `SELECT * FROM channel_credentials
     WHERE user_id = $1 AND is_active = true
     ORDER BY channel`,
    [userId]
  )

  return (result?.rows || []).map((row: any) => ({
    userId: row.user_id,
    channel: row.channel,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    tokenExpiry: row.token_expiry ? new Date(row.token_expiry) : undefined,
    accountSid: row.account_sid,
    authToken: row.auth_token,
    fromNumber: row.from_number,
    email: row.email,
    displayName: row.display_name,
    signature: row.signature,
    isActive: row.is_active,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
    errorCount: row.error_count || 0,
    lastError: row.last_error,
  }))
}

// ============================================================================
// HELPERS
// ============================================================================

function mapQueuedMessageRow(row: any): QueuedMessage {
  return {
    id: row.id,
    userId: row.user_id,
    channel: row.channel,
    fallbackChannel: row.fallback_channel,
    to: row.to_address,
    toName: row.to_name,
    subject: row.subject,
    body: row.body,
    htmlBody: row.html_body,
    threadId: row.thread_id,
    inReplyTo: row.in_reply_to,
    references: row.references_header,
    campaignId: row.campaign_id,
    trackingId: row.tracking_id,
    priority: row.priority,
    status: row.status,
    scheduledFor: row.scheduled_for ? new Date(row.scheduled_for) : undefined,
    retryCount: row.retry_count || 0,
    maxRetries: row.max_retries || 3,
    nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at) : undefined,
    lastError: row.last_error,
    providerMessageId: row.provider_message_id,
    sentAt: row.sent_at ? new Date(row.sent_at) : undefined,
    metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  queueMessage,
  queueMessages,
  getQueuedMessages,
  getQueuedMessage,
  cancelQueuedMessage,
  cancelCampaign,
  processQueue,
  getQueueStats,
  getUserChannelCredentials,
  getUserCredentials,
}
