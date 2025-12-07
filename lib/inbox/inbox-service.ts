// Unified Inbox Service
// Core service for managing messages across all channels

import { sql } from '@vercel/postgres';
import Anthropic from '@anthropic-ai/sdk';
import {
  InboxThread,
  InboxMessage,
  InboxContact,
  InboxDraft,
  InboxReminder,
  GetThreadsRequest,
  GetThreadsResponse,
  GetThreadRequest,
  GetThreadResponse,
  SearchMessagesRequest,
  SearchMessagesResponse,
  MarkAsReadRequest,
  StarThreadRequest,
  ArchiveThreadRequest,
  SnoozeThreadRequest,
  AddReminderRequest,
  GenerateAISummaryRequest,
  GenerateAISummaryResponse,
  SuggestReplyRequest,
  SuggestReplyResponse,
  SendMessageRequest,
  SendMessageResponse,
  InboxProvider,
  AIPriority,
  AICategory,
  AISentiment,
  AIExtractedEntity,
} from './types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export class InboxService {
  /**
   * Get threads with filtering and pagination
   */
  async getThreads(request: GetThreadsRequest): Promise<GetThreadsResponse> {
    const {
      userId,
      accountId,
      provider,
      labels,
      isRead,
      isStarred,
      aiCategory,
      aiPriority,
      search,
      limit = 50,
      offset = 0,
    } = request;

    let query = `
      SELECT * FROM inbox_threads
      WHERE user_id = $1
    `;
    const params: any[] = [userId];
    let paramIndex = 2;

    if (accountId) {
      query += ` AND account_id = $${paramIndex}`;
      params.push(accountId);
      paramIndex++;
    }

    if (provider) {
      query += ` AND provider = $${paramIndex}`;
      params.push(provider);
      paramIndex++;
    }

    if (labels && labels.length > 0) {
      query += ` AND labels && $${paramIndex}`;
      params.push(labels);
      paramIndex++;
    }

    if (isRead !== undefined) {
      query += ` AND is_read = $${paramIndex}`;
      params.push(isRead);
      paramIndex++;
    }

    if (isStarred !== undefined) {
      query += ` AND is_starred = $${paramIndex}`;
      params.push(isStarred);
      paramIndex++;
    }

    if (aiCategory) {
      query += ` AND ai_category = $${paramIndex}`;
      params.push(aiCategory);
      paramIndex++;
    }

    if (aiPriority) {
      query += ` AND ai_priority = $${paramIndex}`;
      params.push(aiPriority);
      paramIndex++;
    }

    if (search) {
      query += ` AND (
        to_tsvector('english', subject) @@ plainto_tsquery('english', $${paramIndex})
        OR to_tsvector('english', snippet) @@ plainto_tsquery('english', $${paramIndex})
      )`;
      params.push(search);
      paramIndex++;
    }

    // Get total count
    const countResult = await sql.query(`SELECT COUNT(*) FROM (${query}) AS count_query`, params);
    const total = parseInt(countResult.rows[0].count);

    // Add sorting and pagination
    query += ` ORDER BY last_message_at DESC NULLS LAST, created_at DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await sql.query(query, params);

    const threads: InboxThread[] = result.rows.map(this.mapRowToThread);

    return {
      threads,
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get a single thread with all messages
   */
  async getThread(request: GetThreadRequest): Promise<GetThreadResponse> {
    const { threadId, userId } = request;

    // Get thread
    const threadResult = await sql.query(
      `SELECT * FROM inbox_threads WHERE id = $1 AND user_id = $2`,
      [threadId, userId]
    );

    if (threadResult.rows.length === 0) {
      throw new Error('Thread not found');
    }

    const thread = this.mapRowToThread(threadResult.rows[0]);

    // Get messages
    const messagesResult = await sql.query(
      `SELECT * FROM inbox_messages_v2 WHERE thread_id = $1 ORDER BY received_at ASC, created_at ASC`,
      [threadId]
    );

    const messages: InboxMessage[] = messagesResult.rows.map(this.mapRowToMessage);

    // Try to get contact info
    let contact: InboxContact | undefined;
    if (thread.participants.length > 0) {
      const participant = thread.participants[0];
      if (participant.email || participant.phone) {
        const contactResult = await sql.query(
          `SELECT * FROM inbox_contacts WHERE user_id = $1 AND (email = $2 OR phone = $3) LIMIT 1`,
          [userId, participant.email || null, participant.phone || null]
        );
        if (contactResult.rows.length > 0) {
          contact = this.mapRowToContact(contactResult.rows[0]);
        }
      }
    }

    return {
      thread,
      messages,
      contact,
    };
  }

  /**
   * Get a single message
   */
  async getMessage(messageId: string, userId: string): Promise<InboxMessage | null> {
    const result = await sql.query(
      `SELECT * FROM inbox_messages_v2 WHERE id = $1 AND user_id = $2`,
      [messageId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToMessage(result.rows[0]);
  }

  /**
   * Mark threads as read or unread
   */
  async markAsRead(request: MarkAsReadRequest): Promise<void> {
    const { threadIds, userId, isRead } = request;

    await sql.query(
      `UPDATE inbox_threads SET is_read = $1, updated_at = NOW() WHERE id = ANY($2) AND user_id = $3`,
      [isRead, threadIds, userId]
    );

    // Also update messages in these threads
    await sql.query(
      `UPDATE inbox_messages_v2 SET is_read = $1 WHERE thread_id = ANY($2) AND user_id = $3`,
      [isRead, threadIds, userId]
    );
  }

  /**
   * Star or unstar threads
   */
  async starThreads(request: StarThreadRequest): Promise<void> {
    const { threadIds, userId, isStarred } = request;

    await sql.query(
      `UPDATE inbox_threads SET is_starred = $1, updated_at = NOW() WHERE id = ANY($2) AND user_id = $3`,
      [isStarred, threadIds, userId]
    );
  }

  /**
   * Archive threads (add 'archived' label, remove 'inbox' label)
   */
  async archiveThreads(request: ArchiveThreadRequest): Promise<void> {
    const { threadIds, userId } = request;

    await sql.query(
      `UPDATE inbox_threads
       SET labels = array_append(array_remove(labels, 'inbox'), 'archived'),
           updated_at = NOW()
       WHERE id = ANY($1) AND user_id = $2`,
      [threadIds, userId]
    );
  }

  /**
   * Move threads to trash
   */
  async trashThreads(threadIds: string[], userId: string): Promise<void> {
    await sql.query(
      `UPDATE inbox_threads
       SET labels = array_append(array_remove(array_remove(labels, 'inbox'), 'archived'), 'trash'),
           updated_at = NOW()
       WHERE id = ANY($1) AND user_id = $2`,
      [threadIds, userId]
    );
  }

  /**
   * Restore threads from trash
   */
  async restoreThreads(threadIds: string[], userId: string): Promise<void> {
    await sql.query(
      `UPDATE inbox_threads
       SET labels = array_append(array_remove(labels, 'trash'), 'inbox'),
           updated_at = NOW()
       WHERE id = ANY($1) AND user_id = $2`,
      [threadIds, userId]
    );
  }

  /**
   * Snooze a thread until a specific time
   */
  async snoozeThread(request: SnoozeThreadRequest): Promise<void> {
    const { threadId, userId, snoozeUntil, reason } = request;

    // Create snooze entry
    await sql.query(
      `INSERT INTO inbox_snooze (id, user_id, thread_id, snooze_until, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [this.generateId(), userId, threadId, snoozeUntil, reason || null]
    );

    // Update thread
    await sql.query(
      `UPDATE inbox_threads
       SET is_snoozed = true,
           snooze_until = $1,
           labels = array_remove(labels, 'inbox'),
           updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [snoozeUntil, threadId, userId]
    );
  }

  /**
   * Unsnooze a thread
   */
  async unsnoozeThread(threadId: string, userId: string): Promise<void> {
    // Remove snooze entry
    await sql.query(
      `DELETE FROM inbox_snooze WHERE thread_id = $1 AND user_id = $2`,
      [threadId, userId]
    );

    // Update thread
    await sql.query(
      `UPDATE inbox_threads
       SET is_snoozed = false,
           snooze_until = NULL,
           labels = array_append(labels, 'inbox'),
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [threadId, userId]
    );
  }

  /**
   * Process snoozed threads that are ready to be unsnoozed
   */
  async processSnoozeQueue(): Promise<void> {
    const result = await sql.query(
      `SELECT thread_id, user_id FROM inbox_snooze WHERE snooze_until <= NOW()`
    );

    for (const row of result.rows) {
      await this.unsnoozeThread(row.thread_id, row.user_id);
    }
  }

  /**
   * Add a reminder for a thread or message
   */
  async addReminder(request: AddReminderRequest): Promise<string> {
    const { threadId, messageId, userId, remindAt, reminderType, note } = request;

    const id = this.generateId();

    await sql.query(
      `INSERT INTO inbox_reminders (id, user_id, thread_id, message_id, remind_at, reminder_type, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, userId, threadId, messageId || null, remindAt, reminderType, note || null]
    );

    return id;
  }

  /**
   * Remove a reminder
   */
  async removeReminder(reminderId: string, userId: string): Promise<void> {
    await sql.query(
      `DELETE FROM inbox_reminders WHERE id = $1 AND user_id = $2`,
      [reminderId, userId]
    );
  }

  /**
   * Get pending reminders for a user
   */
  async getPendingReminders(userId: string): Promise<InboxReminder[]> {
    const result = await sql.query(
      `SELECT * FROM inbox_reminders
       WHERE user_id = $1 AND is_completed = false AND remind_at <= NOW()
       ORDER BY remind_at ASC`,
      [userId]
    );

    return result.rows.map(this.mapRowToReminder);
  }

  /**
   * Mark reminder as completed
   */
  async completeReminder(reminderId: string, userId: string): Promise<void> {
    await sql.query(
      `UPDATE inbox_reminders
       SET is_completed = true, completed_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [reminderId, userId]
    );
  }

  /**
   * Search messages with full-text search
   */
  async searchMessages(request: SearchMessagesRequest): Promise<SearchMessagesResponse> {
    const {
      userId,
      query,
      provider,
      dateFrom,
      dateTo,
      hasAttachment,
      limit = 50,
      offset = 0,
    } = request;

    let sqlQuery = `
      SELECT m.*, t.subject as thread_subject
      FROM inbox_messages_v2 m
      JOIN inbox_threads t ON m.thread_id = t.id
      WHERE m.user_id = $1
      AND (
        to_tsvector('english', m.body_text) @@ plainto_tsquery('english', $2)
        OR to_tsvector('english', m.subject) @@ plainto_tsquery('english', $2)
      )
    `;
    const params: any[] = [userId, query];
    let paramIndex = 3;

    if (provider) {
      sqlQuery += ` AND m.provider = $${paramIndex}`;
      params.push(provider);
      paramIndex++;
    }

    if (dateFrom) {
      sqlQuery += ` AND m.received_at >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      sqlQuery += ` AND m.received_at <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }

    if (hasAttachment !== undefined) {
      if (hasAttachment) {
        sqlQuery += ` AND jsonb_array_length(m.attachments) > 0`;
      } else {
        sqlQuery += ` AND jsonb_array_length(m.attachments) = 0`;
      }
    }

    // Get total count
    const countResult = await sql.query(`SELECT COUNT(*) FROM (${sqlQuery}) AS count_query`, params);
    const total = parseInt(countResult.rows[0].count);

    // Add sorting and pagination
    sqlQuery += ` ORDER BY m.received_at DESC NULLS LAST`;
    sqlQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await sql.query(sqlQuery, params);

    const messages: InboxMessage[] = result.rows.map(this.mapRowToMessage);

    // Get unique thread IDs and fetch those threads
    const threadIds = [...new Set(messages.map(m => m.threadId))];
    const threadsResult = await sql.query(
      `SELECT * FROM inbox_threads WHERE id = ANY($1)`,
      [threadIds]
    );

    const threads: InboxThread[] = threadsResult.rows.map(this.mapRowToThread);

    return {
      messages,
      threads,
      total,
    };
  }

  /**
   * Generate AI summary for a thread
   */
  async getAISummary(request: GenerateAISummaryRequest): Promise<GenerateAISummaryResponse> {
    const { threadId, userId } = request;

    // Get thread with messages
    const { thread, messages } = await this.getThread({ threadId, userId });

    // Build context for Claude
    const messagesContext = messages.map(m =>
      `${m.direction === 'inbound' ? 'From' : 'To'}: ${m.fromName || m.fromAddress}
Date: ${m.receivedAt || m.sentAt}
${m.subject ? `Subject: ${m.subject}` : ''}

${m.bodyText || ''}
---`
    ).join('\n\n');

    const prompt = `Analyze this email/message thread and provide:
1. A concise summary (2-3 sentences)
2. Priority level (urgent, important, normal, low)
3. Category (deals, recruiting, support, newsletter, personal, marketing, spam)
4. Suggested action
5. Extracted entities (dates, amounts, people, companies)

Thread:
${messagesContext}

Respond in JSON format:
{
  "summary": "...",
  "priority": "...",
  "category": "...",
  "suggestedAction": "...",
  "entities": [{"type": "date", "value": "...", "confidence": 0.9}, ...]
}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const analysis = JSON.parse(content.text);

    // Update thread with AI analysis
    await sql.query(
      `UPDATE inbox_threads
       SET ai_summary = $1,
           ai_priority = $2,
           ai_category = $3,
           ai_suggested_action = $4,
           updated_at = NOW()
       WHERE id = $5 AND user_id = $6`,
      [
        analysis.summary,
        analysis.priority,
        analysis.category,
        analysis.suggestedAction,
        threadId,
        userId,
      ]
    );

    return {
      summary: analysis.summary,
      priority: analysis.priority as AIPriority,
      category: analysis.category as AICategory,
      suggestedAction: analysis.suggestedAction,
      entities: analysis.entities as AIExtractedEntity[],
    };
  }

  /**
   * Suggest AI reply for a message
   */
  async suggestReply(request: SuggestReplyRequest): Promise<SuggestReplyResponse> {
    const { messageId, userId, tone = 'professional', length = 'medium' } = request;

    // Get message and thread context
    const message = await this.getMessage(messageId, userId);
    if (!message) {
      throw new Error('Message not found');
    }

    const { thread, messages } = await this.getThread({ threadId: message.threadId, userId });

    // Build context
    const threadContext = messages.slice(-5).map(m =>
      `${m.direction === 'inbound' ? 'Them' : 'You'}: ${m.bodyText || ''}`
    ).join('\n\n');

    const lengthGuidance = {
      short: '1-2 sentences',
      medium: '2-4 sentences',
      long: '4-6 sentences',
    };

    const prompt = `Write ${lengthGuidance[length]} reply to this message in a ${tone} tone.

Context:
${threadContext}

Latest message to reply to:
${message.bodyText}

Provide 3 alternative replies in JSON format:
{
  "primary": "...",
  "alternatives": ["...", "..."]
}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const suggestions = JSON.parse(content.text);

    // Store suggested reply on message
    await sql.query(
      `UPDATE inbox_messages_v2 SET ai_suggested_reply = $1 WHERE id = $2`,
      [suggestions.primary, messageId]
    );

    return {
      suggestedReply: suggestions.primary,
      alternativeReplies: suggestions.alternatives,
    };
  }

  // Utility methods

  private mapRowToThread(row: any): InboxThread {
    return {
      id: row.id,
      userId: row.user_id,
      accountId: row.account_id,
      provider: row.provider as InboxProvider,
      externalThreadId: row.external_thread_id,
      subject: row.subject,
      snippet: row.snippet,
      participants: row.participants || [],
      labels: row.labels || [],
      isRead: row.is_read,
      isStarred: row.is_starred,
      isImportant: row.is_important,
      isSnoozed: row.is_snoozed,
      snoozeUntil: row.snooze_until,
      aiSummary: row.ai_summary,
      aiPriority: row.ai_priority as AIPriority,
      aiCategory: row.ai_category as AICategory,
      aiSuggestedAction: row.ai_suggested_action,
      messageCount: row.message_count,
      lastMessageAt: row.last_message_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToMessage(row: any): InboxMessage {
    return {
      id: row.id,
      threadId: row.thread_id,
      accountId: row.account_id,
      userId: row.user_id,
      provider: row.provider as InboxProvider,
      externalMessageId: row.external_message_id,
      direction: row.direction,
      fromAddress: row.from_address,
      fromName: row.from_name,
      toAddresses: row.to_addresses || [],
      ccAddresses: row.cc_addresses || [],
      bccAddresses: row.bcc_addresses || [],
      subject: row.subject,
      bodyText: row.body_text,
      bodyHtml: row.body_html,
      attachments: row.attachments || [],
      isRead: row.is_read,
      isStarred: row.is_starred,
      aiSummary: row.ai_summary,
      aiSentiment: row.ai_sentiment as AISentiment,
      aiEntities: row.ai_entities || [],
      aiSuggestedReply: row.ai_suggested_reply,
      sentAt: row.sent_at,
      receivedAt: row.received_at,
      createdAt: row.created_at,
    };
  }

  private mapRowToContact(row: any): InboxContact {
    return {
      id: row.id,
      userId: row.user_id,
      email: row.email,
      phone: row.phone,
      name: row.name,
      company: row.company,
      avatarUrl: row.avatar_url,
      linkedinUrl: row.linkedin_url,
      twitterHandle: row.twitter_handle,
      instagramHandle: row.instagram_handle,
      tags: row.tags || [],
      vip: row.vip,
      lastContactedAt: row.last_contacted_at,
      contactCount: row.contact_count,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToReminder(row: any): InboxReminder {
    return {
      id: row.id,
      userId: row.user_id,
      threadId: row.thread_id,
      messageId: row.message_id,
      remindAt: row.remind_at,
      reminderType: row.reminder_type,
      note: row.note,
      isCompleted: row.is_completed,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const inboxService = new InboxService();
