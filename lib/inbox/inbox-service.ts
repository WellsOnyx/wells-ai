// Unified Inbox Service
// Core service for managing messages across all channels
// Includes campaign reply detection for cold start campaigns

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
import {
  detectCampaignReply,
  linkMessageToCampaign,
  getCampaignContext,
  getCampaignReplies,
  CampaignMatch,
  CampaignContext,
} from './campaign-linker';

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
    const threadIds = Array.from(new Set(messages.map(m => m.threadId)));
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

  // ============================================================================
  // CAMPAIGN LINKING METHODS
  // ============================================================================

  /**
   * Ingest a new message into the inbox with campaign reply detection
   * This is the main entry point for receiving messages from providers (Gmail, SMS, etc.)
   */
  async ingestMessage(message: {
    userId: string;
    accountId: string;
    provider: InboxProvider;
    externalMessageId?: string;
    threadId?: string;
    externalThreadId?: string;
    direction: 'inbound' | 'outbound';
    fromAddress?: string;
    fromName?: string;
    fromPhone?: string;
    toAddresses?: string[];
    ccAddresses?: string[];
    subject?: string;
    bodyText?: string;
    bodyHtml?: string;
    attachments?: any[];
    headers?: Record<string, string>;
    sentAt?: Date;
    receivedAt?: Date;
  }): Promise<{
    messageId: string;
    threadId: string;
    isCampaignReply: boolean;
    campaignMatch?: CampaignMatch;
  }> {
    const messageId = this.generateId();
    const threadId = message.threadId || this.generateId();
    const now = new Date();

    // Check if this is a campaign reply (only for inbound messages)
    let campaignMatch: CampaignMatch | null = null;
    if (message.direction === 'inbound') {
      try {
        campaignMatch = await detectCampaignReply({
          fromAddress: message.fromAddress,
          fromPhone: message.fromPhone,
          subject: message.subject,
          bodyText: message.bodyText,
          bodyHtml: message.bodyHtml,
          headers: message.headers,
          provider: message.provider,
          userId: message.userId,
        });
      } catch (error) {
        console.error('Error detecting campaign reply:', error);
        // Continue without campaign linking
      }
    }

    // Create or update thread
    if (!message.threadId) {
      // Create new thread
      await sql.query(
        `INSERT INTO inbox_threads (
          id, user_id, account_id, provider, external_thread_id,
          subject, snippet, participants, labels,
          is_read, message_count, last_message_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )`,
        [
          threadId,
          message.userId,
          message.accountId,
          message.provider,
          message.externalThreadId || null,
          message.subject || null,
          (message.bodyText || '').substring(0, 150),
          JSON.stringify([{ email: message.fromAddress, name: message.fromName }]),
          ['inbox'],
          false,
          1,
          message.receivedAt || message.sentAt || now,
          now,
          now,
        ]
      );
    } else {
      // Update existing thread
      await sql.query(
        `UPDATE inbox_threads SET
          message_count = message_count + 1,
          last_message_at = $1,
          snippet = $2,
          is_read = false,
          updated_at = NOW()
        WHERE id = $3`,
        [
          message.receivedAt || message.sentAt || now,
          (message.bodyText || '').substring(0, 150),
          threadId,
        ]
      );
    }

    // Insert the message
    await sql.query(
      `INSERT INTO inbox_messages_v2 (
        id, thread_id, account_id, user_id, provider,
        external_message_id, direction, from_address, from_name,
        to_addresses, cc_addresses, subject, body_text, body_html,
        attachments, is_read, sent_at, received_at, created_at,
        campaign_id, campaign_outreach_id, is_campaign_reply
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
      )`,
      [
        messageId,
        threadId,
        message.accountId,
        message.userId,
        message.provider,
        message.externalMessageId || null,
        message.direction,
        message.fromAddress || null,
        message.fromName || null,
        JSON.stringify(message.toAddresses || []),
        JSON.stringify(message.ccAddresses || []),
        message.subject || null,
        message.bodyText || null,
        message.bodyHtml || null,
        JSON.stringify(message.attachments || []),
        false,
        message.sentAt || null,
        message.receivedAt || null,
        now,
        campaignMatch?.campaignId || null,
        campaignMatch?.outreachId || null,
        !!campaignMatch,
      ]
    );

    // If campaign reply detected, link the thread and update stats
    if (campaignMatch) {
      try {
        await linkMessageToCampaign(messageId, threadId, campaignMatch, message.userId);
        console.log(`Linked message ${messageId} to campaign ${campaignMatch.campaignName}`);
      } catch (error) {
        console.error('Error linking message to campaign:', error);
      }
    }

    return {
      messageId,
      threadId,
      isCampaignReply: !!campaignMatch,
      campaignMatch: campaignMatch || undefined,
    };
  }

  /**
   * Get campaign context for a thread
   * Returns campaign info if this thread is a reply to a cold start campaign
   */
  async getThreadCampaignContext(threadId: string, userId: string): Promise<CampaignContext | null> {
    return getCampaignContext(threadId, userId);
  }

  /**
   * Get a single thread with campaign context included
   */
  async getThreadWithCampaign(request: GetThreadRequest): Promise<GetThreadResponse & { campaignContext?: CampaignContext }> {
    const baseResponse = await this.getThread(request);

    // Check if thread has campaign context
    const campaignContext = await this.getThreadCampaignContext(request.threadId, request.userId);

    return {
      ...baseResponse,
      campaignContext: campaignContext || undefined,
    };
  }

  /**
   * Get all campaign reply threads
   */
  async getCampaignReplyThreads(request: {
    userId: string;
    campaignId?: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
    limit?: number;
    offset?: number;
  }): Promise<GetThreadsResponse> {
    const { userId, campaignId, sentiment, limit = 50, offset = 0 } = request;

    let query = `
      SELECT * FROM inbox_threads
      WHERE user_id = $1
        AND campaign_id IS NOT NULL
    `;
    const params: any[] = [userId];
    let paramIndex = 2;

    if (campaignId) {
      query += ` AND campaign_id = $${paramIndex}`;
      params.push(campaignId);
      paramIndex++;
    }

    if (sentiment) {
      query += ` AND ai_sentiment = $${paramIndex}`;
      params.push(sentiment);
      paramIndex++;
    }

    // Get total count
    const countResult = await sql.query(`SELECT COUNT(*) FROM (${query}) AS count_query`, params);
    const total = parseInt(countResult.rows[0].count);

    // Add sorting and pagination
    query += ` ORDER BY last_message_at DESC NULLS LAST`;
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
   * Get campaign reply statistics for dashboard
   */
  async getCampaignReplyStats(campaignId: string): Promise<{
    totalReplies: number;
    positiveReplies: number;
    negativeReplies: number;
    neutralReplies: number;
    replyRate: number;
    avgResponseTime?: number;
    hotLeads: number;
  }> {
    const result = await sql.query(
      `SELECT
        COUNT(*) as total_replies,
        COUNT(*) FILTER (WHERE ai_sentiment = 'positive') as positive_replies,
        COUNT(*) FILTER (WHERE ai_sentiment = 'negative') as negative_replies,
        COUNT(*) FILTER (WHERE ai_sentiment = 'neutral') as neutral_replies
      FROM inbox_threads
      WHERE campaign_id = $1`,
      [campaignId]
    );

    // Get campaign stats for reply rate calculation
    const campaignResult = await sql.query(
      `SELECT total_sent, total_replied FROM coldstart_campaigns WHERE id = $1`,
      [campaignId]
    );

    const stats = result.rows[0];
    const campaign = campaignResult.rows[0] || { total_sent: 0, total_replied: 0 };

    const replyRate = campaign.total_sent > 0
      ? (campaign.total_replied / campaign.total_sent) * 100
      : 0;

    // Count hot leads (positive sentiment + high priority)
    const hotLeadsResult = await sql.query(
      `SELECT COUNT(*) as hot_leads
      FROM inbox_threads
      WHERE campaign_id = $1
        AND ai_sentiment = 'positive'
        AND ai_priority IN ('urgent', 'important')`,
      [campaignId]
    );

    return {
      totalReplies: parseInt(stats.total_replies) || 0,
      positiveReplies: parseInt(stats.positive_replies) || 0,
      negativeReplies: parseInt(stats.negative_replies) || 0,
      neutralReplies: parseInt(stats.neutral_replies) || 0,
      replyRate: Math.round(replyRate * 100) / 100,
      hotLeads: parseInt(hotLeadsResult.rows[0]?.hot_leads) || 0,
    };
  }

  /**
   * Manually link a thread to a campaign
   * Use this if auto-detection missed a reply
   */
  async manuallyLinkToCampaign(
    threadId: string,
    campaignId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get campaign details
      const campaignResult = await sql.query(
        `SELECT id, name FROM coldstart_campaigns WHERE id = $1`,
        [campaignId]
      );

      if (campaignResult.rows.length === 0) {
        return { success: false, error: 'Campaign not found' };
      }

      const campaign = campaignResult.rows[0];

      // Update thread
      await sql.query(
        `UPDATE inbox_threads
        SET
          campaign_id = $1,
          campaign_match_method = 'manual',
          campaign_match_confidence = 1.0,
          ai_category = 'campaign_reply',
          labels = array_append(array_remove(labels, 'campaign_reply'), 'campaign_reply'),
          updated_at = NOW()
        WHERE id = $2 AND user_id = $3`,
        [campaignId, threadId, userId]
      );

      // Update campaign reply count
      await sql.query(
        `UPDATE coldstart_campaigns
        SET total_replied = total_replied + 1, updated_at = NOW()
        WHERE id = $1`,
        [campaignId]
      );

      return { success: true };
    } catch (error: any) {
      console.error('Error manually linking to campaign:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unlink a thread from a campaign
   */
  async unlinkFromCampaign(threadId: string, userId: string): Promise<{ success: boolean }> {
    try {
      // Get current campaign ID before unlinking
      const threadResult = await sql.query(
        `SELECT campaign_id FROM inbox_threads WHERE id = $1 AND user_id = $2`,
        [threadId, userId]
      );

      const campaignId = threadResult.rows[0]?.campaign_id;

      // Update thread to remove campaign link
      await sql.query(
        `UPDATE inbox_threads
        SET
          campaign_id = NULL,
          campaign_outreach_id = NULL,
          campaign_contact_id = NULL,
          campaign_match_method = NULL,
          campaign_match_confidence = NULL,
          labels = array_remove(labels, 'campaign_reply'),
          updated_at = NOW()
        WHERE id = $1 AND user_id = $2`,
        [threadId, userId]
      );

      // Decrement campaign reply count if was linked
      if (campaignId) {
        await sql.query(
          `UPDATE coldstart_campaigns
          SET total_replied = GREATEST(0, total_replied - 1), updated_at = NOW()
          WHERE id = $1`,
          [campaignId]
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Error unlinking from campaign:', error);
      return { success: false };
    }
  }

  // Utility methods

  private mapRowToThread(row: any): InboxThread & {
    campaignId?: string;
    campaignOutreachId?: string;
    campaignMatchMethod?: string;
    campaignMatchConfidence?: number;
  } {
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
      // Campaign linking fields
      campaignId: row.campaign_id || undefined,
      campaignOutreachId: row.campaign_outreach_id || undefined,
      campaignMatchMethod: row.campaign_match_method || undefined,
      campaignMatchConfidence: row.campaign_match_confidence ? parseFloat(row.campaign_match_confidence) : undefined,
    };
  }

  private mapRowToMessage(row: any): InboxMessage & {
    campaignId?: string;
    campaignOutreachId?: string;
    isCampaignReply?: boolean;
  } {
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
      // Campaign linking fields
      campaignId: row.campaign_id || undefined,
      campaignOutreachId: row.campaign_outreach_id || undefined,
      isCampaignReply: row.is_campaign_reply || false,
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
