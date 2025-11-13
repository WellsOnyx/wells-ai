/**
 * Database operations for unified inbox
 */

import { query } from '@/lib/db'
import {
  InboundMessage,
  OutboundMessage,
  MessageThread,
  Contact,
  AutoResponseRule,
  WebhookEvent,
  InboxFilters,
  MessageChannel,
  MessageIntent,
  MessageUrgency,
} from './types'

/**
 * Inbound Messages
 */
export const InboundMessages = {
  async create(
    message: Omit<InboundMessage, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<InboundMessage> {
    const result = await query<InboundMessage>(
      `INSERT INTO inbound_messages (
        user_id, channel, channel_message_id,
        sender_id, sender_name, sender_email, sender_phone, sender_metadata,
        subject, body, html_body, attachments,
        thread_id, internal_thread_id, parent_message_id, is_thread_start,
        intent, urgency, sentiment, entities, action_items,
        requires_response, suggested_response,
        raw_payload, headers, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26
      ) RETURNING *`,
      [
        message.userId,
        message.channel,
        message.channelMessageId,
        message.senderId,
        message.senderName,
        message.senderEmail,
        message.senderPhone,
        JSON.stringify(message.senderMetadata || {}),
        message.subject,
        message.body,
        message.htmlBody,
        JSON.stringify(message.attachments || []),
        message.threadId,
        message.internalThreadId,
        message.parentMessageId,
        message.isThreadStart,
        message.intent,
        message.urgency,
        message.sentiment,
        JSON.stringify(message.entities || {}),
        JSON.stringify(message.actionItems || []),
        message.requiresResponse,
        message.suggestedResponse,
        JSON.stringify(message.rawPayload || {}),
        JSON.stringify(message.headers || {}),
        JSON.stringify(message.metadata || {}),
      ]
    )
    return result.rows[0]
  },

  async findById(id: string): Promise<InboundMessage | null> {
    const result = await query<InboundMessage>(
      'SELECT * FROM inbound_messages WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  },

  async findByUser(
    userId: string,
    filters?: InboxFilters,
    limit: number = 50
  ): Promise<InboundMessage[]> {
    let sql = 'SELECT * FROM inbound_messages WHERE user_id = $1'
    const params: any[] = [userId]
    let paramIndex = 2

    if (filters?.channel) {
      sql += ` AND channel = $${paramIndex}`
      params.push(filters.channel)
      paramIndex++
    }

    if (filters?.sender) {
      sql += ` AND (sender_email = $${paramIndex} OR sender_phone = $${paramIndex})`
      params.push(filters.sender)
      paramIndex++
    }

    if (filters?.intent) {
      sql += ` AND intent = $${paramIndex}`
      params.push(filters.intent)
      paramIndex++
    }

    if (filters?.urgency) {
      sql += ` AND urgency = $${paramIndex}`
      params.push(filters.urgency)
      paramIndex++
    }

    if (filters?.requiresResponse !== undefined) {
      sql += ` AND requires_response = $${paramIndex}`
      params.push(filters.requiresResponse)
      paramIndex++
    }

    if (filters?.unprocessedOnly) {
      sql += ' AND processed_at IS NULL'
    }

    if (filters?.dateFrom) {
      sql += ` AND created_at >= $${paramIndex}`
      params.push(filters.dateFrom)
      paramIndex++
    }

    if (filters?.dateTo) {
      sql += ` AND created_at <= $${paramIndex}`
      params.push(filters.dateTo)
      paramIndex++
    }

    if (filters?.searchQuery) {
      sql += ` AND (
        to_tsvector('english', body) @@ plainto_tsquery('english', $${paramIndex})
        OR to_tsvector('english', COALESCE(subject, '')) @@ plainto_tsquery('english', $${paramIndex})
      )`
      params.push(filters.searchQuery)
      paramIndex++
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex}`
    params.push(limit)

    const result = await query<InboundMessage>(sql, params)
    return result.rows
  },

  async findByThread(threadId: string): Promise<InboundMessage[]> {
    const result = await query<InboundMessage>(
      'SELECT * FROM inbound_messages WHERE internal_thread_id = $1 ORDER BY created_at ASC',
      [threadId]
    )
    return result.rows
  },

  async markProcessed(
    id: string,
    understanding: {
      intent?: MessageIntent
      urgency?: MessageUrgency
      sentiment?: string
      entities?: Record<string, any>
      actionItems?: any[]
      requiresResponse?: boolean
      suggestedResponse?: string
    }
  ): Promise<InboundMessage | null> {
    const result = await query<InboundMessage>(
      `UPDATE inbound_messages SET
        processed_at = NOW(),
        intent = COALESCE($2, intent),
        urgency = COALESCE($3, urgency),
        sentiment = COALESCE($4, sentiment),
        entities = COALESCE($5, entities),
        action_items = COALESCE($6, action_items),
        requires_response = COALESCE($7, requires_response),
        suggested_response = COALESCE($8, suggested_response)
      WHERE id = $1 RETURNING *`,
      [
        id,
        understanding.intent,
        understanding.urgency,
        understanding.sentiment,
        JSON.stringify(understanding.entities || {}),
        JSON.stringify(understanding.actionItems || []),
        understanding.requiresResponse,
        understanding.suggestedResponse,
      ]
    )
    return result.rows[0] || null
  },

  async markResponded(id: string, responseMessageId: string): Promise<void> {
    await query(
      'UPDATE inbound_messages SET responded_at = NOW(), response_message_id = $2 WHERE id = $1',
      [id, responseMessageId]
    )
  },

  async getUnprocessedCount(userId: string): Promise<number> {
    const result = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM inbound_messages WHERE user_id = $1 AND processed_at IS NULL',
      [userId]
    )
    return parseInt(result.rows[0]?.count || '0')
  },

  async getRequiringResponseCount(userId: string): Promise<number> {
    const result = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM inbound_messages WHERE user_id = $1 AND requires_response = true AND responded_at IS NULL',
      [userId]
    )
    return parseInt(result.rows[0]?.count || '0')
  },
}

/**
 * Message Threads
 */
export const MessageThreads = {
  async create(
    thread: Omit<MessageThread, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<MessageThread> {
    const result = await query<MessageThread>(
      `INSERT INTO message_threads (
        user_id, channel, platform_thread_id, subject,
        participants, message_count, status,
        thread_summary, thread_context
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        thread.userId,
        thread.channel,
        thread.platformThreadId,
        thread.subject,
        JSON.stringify(thread.participants || []),
        thread.messageCount,
        thread.status,
        thread.threadSummary,
        JSON.stringify(thread.threadContext || {}),
      ]
    )
    return result.rows[0]
  },

  async findById(id: string): Promise<MessageThread | null> {
    const result = await query<MessageThread>(
      'SELECT * FROM message_threads WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  },

  async findByPlatformThreadId(
    userId: string,
    channel: MessageChannel,
    platformThreadId: string
  ): Promise<MessageThread | null> {
    const result = await query<MessageThread>(
      'SELECT * FROM message_threads WHERE user_id = $1 AND channel = $2 AND platform_thread_id = $3',
      [userId, channel, platformThreadId]
    )
    return result.rows[0] || null
  },

  async findByUser(userId: string, status?: string): Promise<MessageThread[]> {
    let sql = 'SELECT * FROM message_threads WHERE user_id = $1'
    const params: any[] = [userId]

    if (status) {
      sql += ' AND status = $2'
      params.push(status)
    }

    sql += ' ORDER BY last_message_at DESC'

    const result = await query<MessageThread>(sql, params)
    return result.rows
  },

  async updateSummary(id: string, summary: string): Promise<void> {
    await query('UPDATE message_threads SET thread_summary = $2 WHERE id = $1', [id, summary])
  },

  async updateStatus(id: string, status: MessageThread['status']): Promise<void> {
    await query('UPDATE message_threads SET status = $2 WHERE id = $1', [id, status])
  },
}

/**
 * Outbound Messages
 */
export const OutboundMessages = {
  async create(
    message: Omit<OutboundMessage, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<OutboundMessage> {
    const result = await query<OutboundMessage>(
      `INSERT INTO outbound_messages (
        user_id, in_reply_to, thread_id,
        channel, recipient_id, recipient_email, recipient_phone,
        subject, body, html_body, attachments,
        status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        message.userId,
        message.inReplyTo,
        message.threadId,
        message.channel,
        message.recipientId,
        message.recipientEmail,
        message.recipientPhone,
        message.subject,
        message.body,
        message.htmlBody,
        JSON.stringify(message.attachments || []),
        message.status,
        JSON.stringify(message.metadata || {}),
      ]
    )
    return result.rows[0]
  },

  async findById(id: string): Promise<OutboundMessage | null> {
    const result = await query<OutboundMessage>(
      'SELECT * FROM outbound_messages WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  },

  async findPendingApproval(userId: string): Promise<OutboundMessage[]> {
    const result = await query<OutboundMessage>(
      'SELECT * FROM outbound_messages WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC',
      [userId, 'pending_approval']
    )
    return result.rows
  },

  async approve(id: string, approvedBy: string): Promise<OutboundMessage | null> {
    const result = await query<OutboundMessage>(
      'UPDATE outbound_messages SET status = $2, approved_by = $3, approved_at = NOW() WHERE id = $1 RETURNING *',
      [id, 'approved', approvedBy]
    )
    return result.rows[0] || null
  },

  async markSent(
    id: string,
    platformMessageId: string,
    platformResponse?: Record<string, any>
  ): Promise<void> {
    await query(
      'UPDATE outbound_messages SET status = $2, platform_message_id = $3, platform_response = $4, sent_at = NOW() WHERE id = $1',
      [id, 'sent', platformMessageId, JSON.stringify(platformResponse || {})]
    )
  },

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await query(
      'UPDATE outbound_messages SET status = $2, error_message = $3 WHERE id = $1',
      [id, 'failed', errorMessage]
    )
  },
}

/**
 * Contacts
 */
export const Contacts = {
  async findOrCreate(params: {
    userId: string
    email?: string
    phone?: string
    name?: string
    channel?: MessageChannel
  }): Promise<Contact> {
    const { userId, email, phone, name, channel } = params

    if (!email && !phone) {
      throw new Error('Either email or phone required')
    }

    // Try to find existing
    let sql = 'SELECT * FROM contacts WHERE user_id = $1 AND '
    const queryParams: any[] = [userId]

    if (email) {
      sql += 'email = $2'
      queryParams.push(email)
    } else {
      sql += 'phone = $2'
      queryParams.push(phone)
    }

    const existing = await query<Contact>(sql, queryParams)

    if (existing.rows[0]) {
      return existing.rows[0]
    }

    // Create new
    const result = await query<Contact>(
      `INSERT INTO contacts (
        user_id, email, phone, name, preferred_channel,
        first_contact_date, last_contact_date,
        total_messages_received, importance_score
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), 0, 50)
      ON CONFLICT (user_id, email) DO UPDATE SET
        phone = COALESCE(contacts.phone, $3),
        name = COALESCE(contacts.name, $4)
      RETURNING *`,
      [userId, email, phone, name, channel]
    )

    return result.rows[0]
  },

  async findByUser(userId: string, limit: number = 100): Promise<Contact[]> {
    const result = await query<Contact>(
      'SELECT * FROM contacts WHERE user_id = $1 ORDER BY importance_score DESC, last_contact_date DESC LIMIT $2',
      [userId, limit]
    )
    return result.rows
  },

  async updateRelationship(
    id: string,
    updates: {
      relationshipType?: string
      importanceScore?: number
      relationshipNotes?: string
    }
  ): Promise<void> {
    const fields: string[] = []
    const params: any[] = [id]
    let paramIndex = 2

    if (updates.relationshipType !== undefined) {
      fields.push(`relationship_type = $${paramIndex}`)
      params.push(updates.relationshipType)
      paramIndex++
    }

    if (updates.importanceScore !== undefined) {
      fields.push(`importance_score = $${paramIndex}`)
      params.push(updates.importanceScore)
      paramIndex++
    }

    if (updates.relationshipNotes !== undefined) {
      fields.push(`relationship_notes = $${paramIndex}`)
      params.push(updates.relationshipNotes)
      paramIndex++
    }

    if (fields.length > 0) {
      await query(`UPDATE contacts SET ${fields.join(', ')} WHERE id = $1`, params)
    }
  },
}

/**
 * Auto-Response Rules
 */
export const AutoResponseRules = {
  async findActiveRules(userId: string): Promise<AutoResponseRule[]> {
    const result = await query<AutoResponseRule>(
      'SELECT * FROM auto_response_rules WHERE user_id = $1 AND enabled = true ORDER BY priority DESC',
      [userId]
    )
    return result.rows
  },

  async create(
    rule: Omit<AutoResponseRule, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<AutoResponseRule> {
    const result = await query<AutoResponseRule>(
      `INSERT INTO auto_response_rules (
        user_id, name, enabled, priority,
        channel_filter, sender_filter, intent_filter, urgency_filter,
        keyword_filters, time_window,
        action_type, response_template, forward_to,
        require_approval, cooldown_hours, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      [
        rule.userId,
        rule.name,
        rule.enabled,
        rule.priority,
        rule.channelFilter,
        rule.senderFilter,
        rule.intentFilter,
        rule.urgencyFilter,
        JSON.stringify(rule.keywordFilters || []),
        JSON.stringify(rule.timeWindow || {}),
        rule.actionType,
        rule.responseTemplate,
        rule.forwardTo,
        rule.requireApproval,
        rule.cooldownHours,
        JSON.stringify(rule.metadata || {}),
      ]
    )
    return result.rows[0]
  },
}

/**
 * Webhook Events
 */
export const WebhookEvents = {
  async create(
    event: Omit<WebhookEvent, 'id' | 'createdAt'>
  ): Promise<WebhookEvent> {
    const result = await query<WebhookEvent>(
      `INSERT INTO webhook_events (
        source, event_type, event_id,
        signature, signature_valid,
        raw_payload, headers, processed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        event.source,
        event.eventType,
        event.eventId,
        event.signature,
        event.signatureValid,
        JSON.stringify(event.rawPayload),
        JSON.stringify(event.headers || {}),
        false,
      ]
    )
    return result.rows[0]
  },

  async markProcessed(
    id: string,
    success: boolean,
    createdMessageId?: string,
    errorMessage?: string
  ): Promise<void> {
    await query(
      'UPDATE webhook_events SET processed = true, processed_at = NOW(), created_message_id = $2, error_message = $3 WHERE id = $1',
      [id, createdMessageId, errorMessage]
    )
  },
}
