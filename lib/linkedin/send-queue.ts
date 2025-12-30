// @ts-nocheck
/**
 * LinkedIn Send Queue
 *
 * Since LinkedIn doesn't have a public messaging API,
 * we create a queue for manual sending.
 *
 * The flow:
 * 1. Wells drafts messages
 * 2. Messages go into the queue
 * 3. User copy-pastes from the queue to LinkedIn
 * 4. User marks messages as sent
 * 5. We track responses when user reports them
 *
 * This is honest about the manual step.
 * "Here's what to send - copy-paste it into LinkedIn."
 */

import { query } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { LinkedInProfile } from './profile-service'
import { DraftedMessage, MessageType } from './message-drafter'

// ============================================================================
// TYPES
// ============================================================================

export type QueuedMessageStatus =
  | 'pending'        // Ready to be sent
  | 'copied'         // User copied to clipboard
  | 'sent'           // User confirmed it was sent
  | 'response_received' // Got a response
  | 'declined'       // They declined/ignored
  | 'skipped'        // User decided not to send
  | 'error'          // Something went wrong

export interface QueuedMessage {
  id: string
  userId: string

  // Recipient info
  profileId: string
  linkedinUrl: string
  recipientName: string
  recipientTitle?: string
  recipientCompany?: string

  // Message content
  messageType: MessageType
  content: string
  characterCount: number
  subject?: string // For InMails

  // Tracking
  status: QueuedMessageStatus
  copiedAt?: Date
  sentAt?: Date
  responseAt?: Date
  responseContent?: string

  // Metadata
  campaignId?: string
  priority: number // 1-5, higher = more important
  scheduledFor?: Date // When to remind user to send
  personalizationFactors?: string[]
  wellsNotes?: string

  // Rate limiting awareness
  dailySendCount?: number // Track for limits
  weeklyConnectionCount?: number

  createdAt: Date
  updatedAt: Date
}

export interface QueueStats {
  pending: number
  copied: number
  sent: number
  responseReceived: number
  declined: number
  skipped: number
  totalThisWeek: number
  responseRate: number
  connectionRequestsThisWeek: number // LinkedIn limits to ~100/week
}

export interface QueueFilters {
  status?: QueuedMessageStatus | QueuedMessageStatus[]
  messageType?: MessageType | MessageType[]
  priority?: number
  campaignId?: string
  recipientCompany?: string
  limit?: number
  offset?: number
}

// ============================================================================
// QUEUE MANAGEMENT
// ============================================================================

/**
 * Add a message to the send queue
 */
export async function queueMessage(
  userId: string,
  profile: Partial<LinkedInProfile> & { id: string; linkedinUrl: string },
  draft: DraftedMessage,
  options: {
    campaignId?: string
    priority?: number
    scheduledFor?: Date
    subject?: string
  } = {}
): Promise<QueuedMessage> {
  const id = uuidv4()
  const now = new Date()

  // Check rate limits before queuing
  const limits = await checkRateLimits(userId)
  if (draft.type === 'connection_request' && limits.connectionRequestsThisWeek >= 100) {
    console.warn('LinkedIn connection request limit approaching')
  }

  const result = await query<QueuedMessage>(`
    INSERT INTO linkedin_messages_queue (
      id, user_id,
      profile_id, linkedin_url, recipient_name, recipient_title, recipient_company,
      message_type, content, character_count, subject,
      status, priority, scheduled_for, campaign_id,
      personalization_factors, wells_notes,
      created_at, updated_at
    ) VALUES (
      $1, $2,
      $3, $4, $5, $6, $7,
      $8, $9, $10, $11,
      $12, $13, $14, $15,
      $16, $17,
      $18, $19
    )
    RETURNING *
  `, [
    id,
    userId,
    profile.id,
    profile.linkedinUrl,
    profile.fullName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Unknown',
    profile.currentTitle,
    profile.currentCompany,
    draft.type,
    draft.content,
    draft.characterCount,
    options.subject,
    'pending',
    options.priority || 3,
    options.scheduledFor,
    options.campaignId,
    JSON.stringify(draft.personalizationFactors),
    draft.wellsNotes,
    now,
    now
  ])

  return result.rows[0]
}

/**
 * Get messages from the queue
 */
export async function getQueuedMessages(
  userId: string,
  filters: QueueFilters = {}
): Promise<QueuedMessage[]> {
  const conditions: string[] = ['user_id = $1']
  const params: any[] = [userId]
  let paramIndex = 2

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
    conditions.push(`status = ANY($${paramIndex})`)
    params.push(statuses)
    paramIndex++
  }

  if (filters.messageType) {
    const types = Array.isArray(filters.messageType) ? filters.messageType : [filters.messageType]
    conditions.push(`message_type = ANY($${paramIndex})`)
    params.push(types)
    paramIndex++
  }

  if (filters.priority) {
    conditions.push(`priority >= $${paramIndex}`)
    params.push(filters.priority)
    paramIndex++
  }

  if (filters.campaignId) {
    conditions.push(`campaign_id = $${paramIndex}`)
    params.push(filters.campaignId)
    paramIndex++
  }

  if (filters.recipientCompany) {
    conditions.push(`recipient_company ILIKE $${paramIndex}`)
    params.push(`%${filters.recipientCompany}%`)
    paramIndex++
  }

  const limit = filters.limit || 50
  const offset = filters.offset || 0
  params.push(limit, offset)

  const result = await query<QueuedMessage>(`
    SELECT * FROM linkedin_messages_queue
    WHERE ${conditions.join(' AND ')}
    ORDER BY
      CASE status WHEN 'pending' THEN 0 WHEN 'copied' THEN 1 ELSE 2 END,
      priority DESC,
      scheduled_for ASC NULLS LAST,
      created_at ASC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `, params)

  return result.rows
}

/**
 * Get a single queued message
 */
export async function getQueuedMessage(
  userId: string,
  messageId: string
): Promise<QueuedMessage | null> {
  const result = await query<QueuedMessage>(
    'SELECT * FROM linkedin_messages_queue WHERE id = $1 AND user_id = $2',
    [messageId, userId]
  )
  return result.rows[0] || null
}

/**
 * Get the next message to send
 */
export async function getNextToSend(userId: string): Promise<QueuedMessage | null> {
  const result = await query<QueuedMessage>(`
    SELECT * FROM linkedin_messages_queue
    WHERE user_id = $1
      AND status IN ('pending', 'copied')
      AND (scheduled_for IS NULL OR scheduled_for <= NOW())
    ORDER BY
      priority DESC,
      CASE status WHEN 'copied' THEN 0 ELSE 1 END,
      created_at ASC
    LIMIT 1
  `, [userId])

  return result.rows[0] || null
}

// ============================================================================
// STATUS UPDATES
// ============================================================================

/**
 * Mark a message as copied (user clicked copy)
 */
export async function markAsCopied(
  userId: string,
  messageId: string
): Promise<void> {
  await query(`
    UPDATE linkedin_messages_queue
    SET status = 'copied', copied_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND user_id = $2 AND status = 'pending'
  `, [messageId, userId])
}

/**
 * Mark a message as sent (user confirmed they sent it)
 */
export async function markAsSent(
  userId: string,
  messageId: string
): Promise<void> {
  await query(`
    UPDATE linkedin_messages_queue
    SET status = 'sent', sent_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'copied')
  `, [messageId, userId])

  // Update connection status on the profile
  const message = await getQueuedMessage(userId, messageId)
  if (message?.messageType === 'connection_request') {
    await query(`
      UPDATE linkedin_profiles
      SET connection_status = 'pending', updated_at = NOW()
      WHERE id = $1
    `, [message.profileId])
  }
}

/**
 * Record a response received
 */
export async function recordResponse(
  userId: string,
  messageId: string,
  responseContent?: string,
  responseType: 'positive' | 'negative' | 'neutral' = 'neutral'
): Promise<void> {
  await query(`
    UPDATE linkedin_messages_queue
    SET
      status = 'response_received',
      response_at = NOW(),
      response_content = $3,
      updated_at = NOW()
    WHERE id = $1 AND user_id = $2
  `, [messageId, userId, responseContent])

  // Update connection status
  const message = await getQueuedMessage(userId, messageId)
  if (message) {
    const newStatus = message.messageType === 'connection_request' && responseType === 'positive'
      ? 'connected'
      : undefined

    if (newStatus) {
      await query(`
        UPDATE linkedin_profiles
        SET connection_status = $1, updated_at = NOW()
        WHERE id = $2
      `, [newStatus, message.profileId])
    }
  }
}

/**
 * Mark as declined/ignored
 */
export async function markAsDeclined(
  userId: string,
  messageId: string
): Promise<void> {
  await query(`
    UPDATE linkedin_messages_queue
    SET status = 'declined', updated_at = NOW()
    WHERE id = $1 AND user_id = $2
  `, [messageId, userId])
}

/**
 * Skip a message (user chose not to send)
 */
export async function skipMessage(
  userId: string,
  messageId: string,
  reason?: string
): Promise<void> {
  await query(`
    UPDATE linkedin_messages_queue
    SET
      status = 'skipped',
      wells_notes = COALESCE(wells_notes, '') || $3,
      updated_at = NOW()
    WHERE id = $1 AND user_id = $2
  `, [messageId, userId, reason ? `\n[Skipped: ${reason}]` : ''])
}

/**
 * Update message content (regenerate)
 */
export async function updateMessageContent(
  userId: string,
  messageId: string,
  newContent: string,
  wellsNotes?: string
): Promise<void> {
  await query(`
    UPDATE linkedin_messages_queue
    SET
      content = $3,
      character_count = $4,
      wells_notes = COALESCE($5, wells_notes),
      status = 'pending',
      updated_at = NOW()
    WHERE id = $1 AND user_id = $2
  `, [messageId, userId, newContent, newContent.length, wellsNotes])
}

// ============================================================================
// QUEUE ANALYTICS
// ============================================================================

/**
 * Get queue statistics
 */
export async function getQueueStats(userId: string): Promise<QueueStats> {
  const result = await query<{
    status: QueuedMessageStatus
    count: number
    message_type: MessageType
  }>(`
    SELECT
      status,
      COUNT(*) as count,
      message_type
    FROM linkedin_messages_queue
    WHERE user_id = $1
    GROUP BY status, message_type
  `, [userId])

  const stats: QueueStats = {
    pending: 0,
    copied: 0,
    sent: 0,
    responseReceived: 0,
    declined: 0,
    skipped: 0,
    totalThisWeek: 0,
    responseRate: 0,
    connectionRequestsThisWeek: 0
  }

  for (const row of result.rows) {
    switch (row.status) {
      case 'pending': stats.pending += Number(row.count); break
      case 'copied': stats.copied += Number(row.count); break
      case 'sent': stats.sent += Number(row.count); break
      case 'response_received': stats.responseReceived += Number(row.count); break
      case 'declined': stats.declined += Number(row.count); break
      case 'skipped': stats.skipped += Number(row.count); break
    }
  }

  // Calculate weekly stats
  const weeklyResult = await query<{ count: number; connection_count: number }>(`
    SELECT
      COUNT(*) as count,
      COUNT(*) FILTER (WHERE message_type = 'connection_request') as connection_count
    FROM linkedin_messages_queue
    WHERE user_id = $1
      AND status = 'sent'
      AND sent_at >= NOW() - INTERVAL '7 days'
  `, [userId])

  if (weeklyResult.rows.length > 0) {
    stats.totalThisWeek = Number(weeklyResult.rows[0].count)
    stats.connectionRequestsThisWeek = Number(weeklyResult.rows[0].connection_count)
  }

  // Calculate response rate
  const totalSentOrResponded = stats.sent + stats.responseReceived + stats.declined
  if (totalSentOrResponded > 0) {
    stats.responseRate = (stats.responseReceived / totalSentOrResponded) * 100
  }

  return stats
}

/**
 * Check rate limits
 */
export async function checkRateLimits(userId: string): Promise<{
  connectionRequestsThisWeek: number
  connectionRequestsRemaining: number
  messagesThisWeek: number
  isNearLimit: boolean
  warning?: string
}> {
  const stats = await getQueueStats(userId)

  const WEEKLY_CONNECTION_LIMIT = 100
  const remaining = WEEKLY_CONNECTION_LIMIT - stats.connectionRequestsThisWeek
  const isNearLimit = remaining <= 10

  let warning: string | undefined
  if (remaining <= 0) {
    warning = "You've hit LinkedIn's weekly connection request limit (~100/week). Wait for the weekly reset."
  } else if (remaining <= 10) {
    warning = `Only ${remaining} connection requests left this week. Use them wisely.`
  } else if (remaining <= 25) {
    warning = `${remaining} connection requests remaining this week.`
  }

  return {
    connectionRequestsThisWeek: stats.connectionRequestsThisWeek,
    connectionRequestsRemaining: remaining,
    messagesThisWeek: stats.totalThisWeek,
    isNearLimit,
    warning
  }
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Queue multiple messages at once
 */
export async function bulkQueue(
  userId: string,
  messages: Array<{
    profile: Partial<LinkedInProfile> & { id: string; linkedinUrl: string }
    draft: DraftedMessage
    options?: { campaignId?: string; priority?: number }
  }>
): Promise<QueuedMessage[]> {
  const results: QueuedMessage[] = []

  for (const { profile, draft, options } of messages) {
    const queued = await queueMessage(userId, profile, draft, options)
    results.push(queued)
  }

  return results
}

/**
 * Clear the queue (remove pending messages)
 */
export async function clearQueue(
  userId: string,
  options: {
    status?: QueuedMessageStatus[]
    campaignId?: string
    olderThan?: Date
  } = {}
): Promise<number> {
  const conditions: string[] = ['user_id = $1']
  const params: any[] = [userId]
  let paramIndex = 2

  if (options.status) {
    conditions.push(`status = ANY($${paramIndex})`)
    params.push(options.status)
    paramIndex++
  } else {
    // Default to only clearing pending/skipped
    conditions.push(`status = ANY($${paramIndex})`)
    params.push(['pending', 'skipped'])
    paramIndex++
  }

  if (options.campaignId) {
    conditions.push(`campaign_id = $${paramIndex}`)
    params.push(options.campaignId)
    paramIndex++
  }

  if (options.olderThan) {
    conditions.push(`created_at < $${paramIndex}`)
    params.push(options.olderThan)
    paramIndex++
  }

  const result = await query(
    `DELETE FROM linkedin_messages_queue WHERE ${conditions.join(' AND ')}`,
    params
  )

  return result.rowCount
}

// ============================================================================
// COPY-PASTE HELPERS
// ============================================================================

/**
 * Format a message for easy copy-paste
 */
export function formatForCopyPaste(message: QueuedMessage): {
  displayText: string
  copyableText: string
  instructions: string
} {
  const instructions = {
    connection_request: `
1. Go to ${message.linkedinUrl}
2. Click "Connect"
3. Click "Add a note"
4. Paste the message below
5. Click "Send"
6. Come back and mark as sent`,

    inmail: `
1. Go to ${message.linkedinUrl}
2. Click "Message"
3. ${message.subject ? `Subject: ${message.subject}` : 'Add a subject line'}
4. Paste the message below
5. Click "Send"
6. Come back and mark as sent`,

    followup: `
1. Go to your LinkedIn messages
2. Find your conversation with ${message.recipientName}
3. Paste the message below
4. Click "Send"
5. Come back and mark as sent`,

    direct_message: `
1. Go to your LinkedIn messages
2. Search for ${message.recipientName}
3. Paste the message below
4. Click "Send"
5. Come back and mark as sent`,

    comment: `
1. Find ${message.recipientName}'s post
2. Click "Comment"
3. Paste the message below
4. Click "Post"
5. Come back and mark as sent`
  }

  return {
    displayText: `
**To: ${message.recipientName}**${message.recipientTitle ? ` (${message.recipientTitle})` : ''}${message.recipientCompany ? ` at ${message.recipientCompany}` : ''}
**Type:** ${message.messageType.replace('_', ' ')}
${message.characterCount > 0 ? `**Characters:** ${message.characterCount}` : ''}

---

${message.content}

---

${message.wellsNotes ? `*Wells' note: ${message.wellsNotes}*` : ''}
`,
    copyableText: message.content,
    instructions: instructions[message.messageType] || instructions.connection_request
  }
}

/**
 * Get formatted queue for chat display
 */
export function formatQueueForChat(messages: QueuedMessage[]): string {
  if (messages.length === 0) {
    return "Your LinkedIn queue is empty. Want me to draft some messages?"
  }

  const lines: string[] = [`**LinkedIn Queue** (${messages.length} messages)\n`]

  // Group by status
  const pending = messages.filter(m => m.status === 'pending')
  const copied = messages.filter(m => m.status === 'copied')

  if (copied.length > 0) {
    lines.push(`**Copied but not sent yet (${copied.length}):**`)
    for (const m of copied.slice(0, 3)) {
      lines.push(`- ${m.recipientName} (${m.messageType.replace('_', ' ')})`)
    }
    lines.push('')
  }

  if (pending.length > 0) {
    lines.push(`**Ready to send (${pending.length}):**`)
    for (const m of pending.slice(0, 5)) {
      lines.push(`- ${m.recipientName}${m.recipientCompany ? ` at ${m.recipientCompany}` : ''} (${m.messageType.replace('_', ' ')})`)
    }
    if (pending.length > 5) {
      lines.push(`... and ${pending.length - 5} more`)
    }
  }

  lines.push('')
  lines.push('Say "show next" to see the next message to send, or "show queue" for the full list.')

  return lines.join('\n')
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  queueMessage,
  getQueuedMessages,
  getQueuedMessage,
  getNextToSend,
  markAsCopied,
  markAsSent,
  recordResponse,
  markAsDeclined,
  skipMessage,
  updateMessageContent,
  getQueueStats,
  checkRateLimits,
  bulkQueue,
  clearQueue,
  formatForCopyPaste,
  formatQueueForChat
}
