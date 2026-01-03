/**
 * Unified Inbox - Core Logic
 * ===========================
 * Superhuman-style inbox that aggregates messages from all channels
 * Fast, keyboard-driven, AI-augmented, delightful
 *
 * Features:
 * - Unified message model across Gmail, Outlook, SMS, Twitter DM, LinkedIn, etc.
 * - Thread/conversation grouping
 * - AI-powered categorization and reply suggestions
 * - Quick actions (archive, snooze, reply, forward)
 * - Smart categorization (leads, replies, spam, important)
 * - Campaign reply matching
 */

import { query, sqlQuery, withTransaction } from '@/lib/db';
import crypto from 'crypto';

// =====================================================
// TYPES
// =====================================================

export type InboxChannel =
  | 'gmail'
  | 'outlook'
  | 'sms'
  | 'twitter_dm'
  | 'linkedin'
  | 'whatsapp'
  | 'slack'
  | 'imessage'
  | 'instagram'
  | 'wells_internal';

export type MessageDirection = 'inbound' | 'outbound';

export type AICategory =
  | 'lead'
  | 'reply'
  | 'spam'
  | 'important'
  | 'newsletter'
  | 'transactional'
  | 'campaign_reply'
  | 'personal'
  | 'support'
  | 'sales';

export type AIPriority = 'urgent' | 'high' | 'normal' | 'low';

export type AISentiment = 'positive' | 'neutral' | 'negative' | 'urgent';

export type QuickAction =
  | 'archive'
  | 'trash'
  | 'star'
  | 'unstar'
  | 'read'
  | 'unread'
  | 'snooze'
  | 'spam'
  | 'not_spam';

// Channel display configuration
export const CHANNEL_CONFIG: Record<InboxChannel, {
  name: string;
  icon: string;
  color: string;
  bgColor: string;
}> = {
  gmail: { name: 'Gmail', icon: 'Mail', color: '#EA4335', bgColor: 'bg-red-500/20' },
  outlook: { name: 'Outlook', icon: 'Mail', color: '#0078D4', bgColor: 'bg-blue-500/20' },
  sms: { name: 'SMS', icon: 'MessageSquare', color: '#22C55E', bgColor: 'bg-green-500/20' },
  twitter_dm: { name: 'Twitter', icon: 'Twitter', color: '#1DA1F2', bgColor: 'bg-sky-500/20' },
  linkedin: { name: 'LinkedIn', icon: 'Linkedin', color: '#0A66C2', bgColor: 'bg-blue-600/20' },
  whatsapp: { name: 'WhatsApp', icon: 'MessageCircle', color: '#25D366', bgColor: 'bg-green-500/20' },
  slack: { name: 'Slack', icon: 'Hash', color: '#4A154B', bgColor: 'bg-purple-500/20' },
  imessage: { name: 'iMessage', icon: 'MessageCircle', color: '#34C759', bgColor: 'bg-green-500/20' },
  instagram: { name: 'Instagram', icon: 'Instagram', color: '#E4405F', bgColor: 'bg-pink-500/20' },
  wells_internal: { name: 'Wells', icon: 'Zap', color: '#8B5CF6', bgColor: 'bg-violet-500/20' },
};

// Message participant
export interface Participant {
  address: string; // email, phone, or handle
  name?: string;
  avatarUrl?: string;
}

// Attachment
export interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
}

// AI Entity extracted from message
export interface AIEntity {
  type: 'date' | 'amount' | 'person' | 'company' | 'phone' | 'email' | 'location';
  value: string;
  confidence: number;
}

// Action item extracted from message
export interface ActionItem {
  description: string;
  dueDate?: Date;
  priority: 'high' | 'medium' | 'low';
}

// Unified Message
export interface UnifiedMessage {
  id: string;
  userId: string;
  accountId?: string;
  channel: InboxChannel;
  channelMessageId?: string;
  channelThreadId?: string;
  threadId?: string;
  direction: MessageDirection;
  from: Participant;
  to: Participant[];
  cc?: Participant[];
  bcc?: Participant[];
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  snippet?: string;
  attachments: Attachment[];
  hasAttachments: boolean;
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
  isTrashed: boolean;
  isSpam: boolean;
  isDraft: boolean;
  labels: string[];
  aiCategory?: AICategory;
  aiPriority?: AIPriority;
  aiSentiment?: AISentiment;
  aiSummary?: string;
  aiSuggestedReply?: string;
  aiEntities?: AIEntity[];
  aiActionItems?: ActionItem[];
  matchedCampaignId?: string;
  matchedOutreachMessageId?: string;
  isCampaignReply: boolean;
  campaignMatchConfidence?: number;
  contactId?: string;
  isSnoozed: boolean;
  snoozeUntil?: Date;
  sentAt?: Date;
  receivedAt?: Date;
  readAt?: Date;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Unified Thread
export interface UnifiedThread {
  id: string;
  userId: string;
  subject?: string;
  snippet?: string;
  participants: Participant[];
  participantCount: number;
  primaryChannel: InboxChannel;
  messageCount: number;
  unreadCount: number;
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
  isTrashed: boolean;
  isSpam: boolean;
  isSnoozed: boolean;
  snoozeUntil?: Date;
  labels: string[];
  aiCategory?: AICategory;
  aiPriority?: AIPriority;
  aiSummary?: string;
  aiSuggestedAction?: string;
  isCampaignReply: boolean;
  matchedCampaignId?: string;
  firstMessageAt?: Date;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Filter options
export interface InboxFilters {
  channels?: InboxChannel[];
  categories?: AICategory[];
  priorities?: AIPriority[];
  isRead?: boolean;
  isStarred?: boolean;
  isArchived?: boolean;
  isTrashed?: boolean;
  isSpam?: boolean;
  isSnoozed?: boolean;
  isCampaignReply?: boolean;
  search?: string;
  from?: string;
  labels?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

// Inbox stats
export interface InboxStats {
  total: number;
  unread: number;
  starred: number;
  archived: number;
  snoozed: number;
  spam: number;
  campaignReplies: number;
  byChannel: Record<string, number>;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
}

// =====================================================
// CORE INBOX FUNCTIONS
// =====================================================

/**
 * Get threads with filtering, pagination, and optimistic loading
 */
export async function getThreads(
  userId: string,
  filters: InboxFilters = {}
): Promise<{ threads: UnifiedThread[]; total: number; hasMore: boolean }> {
  const {
    channels,
    categories,
    priorities,
    isRead,
    isStarred,
    isArchived = false,
    isTrashed = false,
    isSpam = false,
    isSnoozed,
    isCampaignReply,
    search,
    from,
    labels,
    dateFrom,
    dateTo,
    limit = 50,
    offset = 0,
  } = filters;

  let queryText = `
    SELECT * FROM unified_threads
    WHERE user_id = $1
    AND is_archived = $2
    AND is_trashed = $3
    AND is_spam = $4
  `;
  const params: any[] = [userId, isArchived, isTrashed, isSpam];
  let paramIndex = 5;

  // Apply filters
  if (channels && channels.length > 0) {
    queryText += ` AND primary_channel = ANY($${paramIndex})`;
    params.push(channels);
    paramIndex++;
  }

  if (categories && categories.length > 0) {
    queryText += ` AND ai_category = ANY($${paramIndex})`;
    params.push(categories);
    paramIndex++;
  }

  if (priorities && priorities.length > 0) {
    queryText += ` AND ai_priority = ANY($${paramIndex})`;
    params.push(priorities);
    paramIndex++;
  }

  if (isRead !== undefined) {
    queryText += ` AND is_read = $${paramIndex}`;
    params.push(isRead);
    paramIndex++;
  }

  if (isStarred !== undefined) {
    queryText += ` AND is_starred = $${paramIndex}`;
    params.push(isStarred);
    paramIndex++;
  }

  if (isSnoozed !== undefined) {
    queryText += ` AND is_snoozed = $${paramIndex}`;
    params.push(isSnoozed);
    paramIndex++;
  }

  if (isCampaignReply !== undefined) {
    queryText += ` AND is_campaign_reply = $${paramIndex}`;
    params.push(isCampaignReply);
    paramIndex++;
  }

  if (search) {
    queryText += ` AND (
      to_tsvector('english', COALESCE(subject, '')) @@ plainto_tsquery('english', $${paramIndex})
      OR to_tsvector('english', COALESCE(snippet, '')) @@ plainto_tsquery('english', $${paramIndex})
    )`;
    params.push(search);
    paramIndex++;
  }

  if (labels && labels.length > 0) {
    queryText += ` AND labels && $${paramIndex}`;
    params.push(labels);
    paramIndex++;
  }

  if (dateFrom) {
    queryText += ` AND last_message_at >= $${paramIndex}`;
    params.push(dateFrom.toISOString());
    paramIndex++;
  }

  if (dateTo) {
    queryText += ` AND last_message_at <= $${paramIndex}`;
    params.push(dateTo.toISOString());
    paramIndex++;
  }

  // Count total
  const countQuery = `SELECT COUNT(*) FROM (${queryText}) AS count_query`;
  const countResult = await query(countQuery, params);
  const total = parseInt(countResult.rows[0]?.count || '0');

  // Add sorting and pagination
  queryText += ` ORDER BY last_message_at DESC NULLS LAST`;
  queryText += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await query(queryText, params);
  const threads = result.rows.map(mapRowToThread);

  return {
    threads,
    total,
    hasMore: offset + limit < total,
  };
}

/**
 * Get a single thread with all messages
 */
export async function getThread(
  threadId: string,
  userId: string
): Promise<{ thread: UnifiedThread; messages: UnifiedMessage[] } | null> {
  // Get thread
  const threadResult = await query(
    'SELECT * FROM unified_threads WHERE id = $1 AND user_id = $2',
    [threadId, userId]
  );

  if (threadResult.rows.length === 0) {
    return null;
  }

  const thread = mapRowToThread(threadResult.rows[0]);

  // Get messages
  const messagesResult = await query(
    `SELECT * FROM unified_messages
     WHERE thread_id = $1
     ORDER BY COALESCE(received_at, sent_at, created_at) ASC`,
    [threadId]
  );

  const messages = messagesResult.rows.map(mapRowToMessage);

  return { thread, messages };
}

/**
 * Get a single message
 */
export async function getMessage(
  messageId: string,
  userId: string
): Promise<UnifiedMessage | null> {
  const result = await query(
    'SELECT * FROM unified_messages WHERE id = $1 AND user_id = $2',
    [messageId, userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToMessage(result.rows[0]);
}

/**
 * Search messages with full-text search
 */
export async function searchMessages(
  userId: string,
  searchQuery: string,
  filters: Omit<InboxFilters, 'search'> = {}
): Promise<{ messages: UnifiedMessage[]; total: number }> {
  const {
    channels,
    categories,
    dateFrom,
    dateTo,
    limit = 50,
    offset = 0,
  } = filters;

  let queryText = `
    SELECT * FROM unified_messages
    WHERE user_id = $1
    AND is_trashed = false
    AND (
      to_tsvector('english', COALESCE(body_text, '')) @@ plainto_tsquery('english', $2)
      OR to_tsvector('english', COALESCE(subject, '')) @@ plainto_tsquery('english', $2)
    )
  `;
  const params: any[] = [userId, searchQuery];
  let paramIndex = 3;

  if (channels && channels.length > 0) {
    queryText += ` AND channel = ANY($${paramIndex})`;
    params.push(channels);
    paramIndex++;
  }

  if (categories && categories.length > 0) {
    queryText += ` AND ai_category = ANY($${paramIndex})`;
    params.push(categories);
    paramIndex++;
  }

  if (dateFrom) {
    queryText += ` AND COALESCE(received_at, sent_at) >= $${paramIndex}`;
    params.push(dateFrom.toISOString());
    paramIndex++;
  }

  if (dateTo) {
    queryText += ` AND COALESCE(received_at, sent_at) <= $${paramIndex}`;
    params.push(dateTo.toISOString());
    paramIndex++;
  }

  // Count total
  const countQuery = `SELECT COUNT(*) FROM (${queryText}) AS count_query`;
  const countResult = await query(countQuery, params);
  const total = parseInt(countResult.rows[0]?.count || '0');

  // Add sorting and pagination
  queryText += ` ORDER BY COALESCE(received_at, sent_at) DESC`;
  queryText += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await query(queryText, params);
  const messages = result.rows.map(mapRowToMessage);

  return { messages, total };
}

// =====================================================
// QUICK ACTIONS (Superhuman-style)
// =====================================================

/**
 * Archive threads (with undo support)
 */
export async function archiveThreads(
  userId: string,
  threadIds: string[]
): Promise<{ success: boolean; actionId: string }> {
  const actionId = crypto.randomUUID();

  await withTransaction(async (client) => {
    // Save current state for undo
    for (const threadId of threadIds) {
      const current = await client.query(
        'SELECT is_archived FROM unified_threads WHERE id = $1 AND user_id = $2',
        [threadId, userId]
      );

      if (current.rows.length > 0) {
        await client.query(
          `INSERT INTO inbox_action_log (id, user_id, action_type, target_type, target_id, previous_state)
           VALUES ($1, $2, 'archive', 'thread', $3, $4)`,
          [crypto.randomUUID(), userId, threadId, JSON.stringify(current.rows[0])]
        );
      }
    }

    // Archive threads
    await client.query(
      `UPDATE unified_threads
       SET is_archived = true, updated_at = NOW()
       WHERE id = ANY($1) AND user_id = $2`,
      [threadIds, userId]
    );

    // Archive messages in threads
    await client.query(
      `UPDATE unified_messages
       SET is_archived = true, updated_at = NOW()
       WHERE thread_id = ANY($1) AND user_id = $2`,
      [threadIds, userId]
    );
  });

  return { success: true, actionId };
}

/**
 * Trash threads
 */
export async function trashThreads(
  userId: string,
  threadIds: string[]
): Promise<{ success: boolean; actionId: string }> {
  const actionId = crypto.randomUUID();

  await withTransaction(async (client) => {
    // Save current state for undo
    for (const threadId of threadIds) {
      const current = await client.query(
        'SELECT is_trashed FROM unified_threads WHERE id = $1 AND user_id = $2',
        [threadId, userId]
      );

      if (current.rows.length > 0) {
        await client.query(
          `INSERT INTO inbox_action_log (id, user_id, action_type, target_type, target_id, previous_state)
           VALUES ($1, $2, 'trash', 'thread', $3, $4)`,
          [crypto.randomUUID(), userId, threadId, JSON.stringify(current.rows[0])]
        );
      }
    }

    // Trash threads
    await client.query(
      `UPDATE unified_threads
       SET is_trashed = true, updated_at = NOW()
       WHERE id = ANY($1) AND user_id = $2`,
      [threadIds, userId]
    );

    // Trash messages
    await client.query(
      `UPDATE unified_messages
       SET is_trashed = true, updated_at = NOW()
       WHERE thread_id = ANY($1) AND user_id = $2`,
      [threadIds, userId]
    );
  });

  return { success: true, actionId };
}

/**
 * Star/unstar threads
 */
export async function starThreads(
  userId: string,
  threadIds: string[],
  starred: boolean
): Promise<void> {
  await query(
    `UPDATE unified_threads
     SET is_starred = $1, updated_at = NOW()
     WHERE id = ANY($2) AND user_id = $3`,
    [starred, threadIds, userId]
  );
}

/**
 * Mark threads as read/unread
 */
export async function markThreadsRead(
  userId: string,
  threadIds: string[],
  read: boolean
): Promise<void> {
  await withTransaction(async (client) => {
    // Update threads
    await client.query(
      `UPDATE unified_threads
       SET is_read = $1, unread_count = CASE WHEN $1 THEN 0 ELSE unread_count END, updated_at = NOW()
       WHERE id = ANY($2) AND user_id = $3`,
      [read, threadIds, userId]
    );

    // Update messages
    await client.query(
      `UPDATE unified_messages
       SET is_read = $1, read_at = CASE WHEN $1 THEN NOW() ELSE NULL END, updated_at = NOW()
       WHERE thread_id = ANY($2) AND user_id = $3`,
      [read, threadIds, userId]
    );
  });
}

/**
 * Snooze thread until a specific time
 */
export async function snoozeThread(
  userId: string,
  threadId: string,
  until: Date,
  reason?: string
): Promise<void> {
  await withTransaction(async (client) => {
    // Update thread
    await client.query(
      `UPDATE unified_threads
       SET is_snoozed = true, snooze_until = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [until.toISOString(), threadId, userId]
    );

    // Add to snooze queue
    await client.query(
      `INSERT INTO inbox_snooze_queue (id, user_id, thread_id, snooze_until, reason)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (thread_id) DO UPDATE SET snooze_until = $4, reason = $5`,
      [crypto.randomUUID(), userId, threadId, until.toISOString(), reason || null]
    );
  });
}

/**
 * Unsnooze thread
 */
export async function unsnoozeThread(
  userId: string,
  threadId: string
): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE unified_threads
       SET is_snoozed = false, snooze_until = NULL, updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [threadId, userId]
    );

    await client.query(
      `DELETE FROM inbox_snooze_queue WHERE thread_id = $1 AND user_id = $2`,
      [threadId, userId]
    );
  });
}

/**
 * Mark as spam
 */
export async function markAsSpam(
  userId: string,
  threadIds: string[]
): Promise<void> {
  await query(
    `UPDATE unified_threads
     SET is_spam = true, ai_category = 'spam', updated_at = NOW()
     WHERE id = ANY($1) AND user_id = $2`,
    [threadIds, userId]
  );
}

/**
 * Undo last action (within time window)
 */
export async function undoAction(
  userId: string,
  actionId: string
): Promise<boolean> {
  const result = await withTransaction(async (client) => {
    // Get the action
    const actionResult = await client.query(
      `SELECT * FROM inbox_action_log
       WHERE id = $1 AND user_id = $2 AND undone = false AND expires_at > NOW()`,
      [actionId, userId]
    );

    if (actionResult.rows.length === 0) {
      return false;
    }

    const action = actionResult.rows[0];
    const previousState = action.previous_state;

    // Restore previous state based on action type
    if (action.action_type === 'archive') {
      await client.query(
        `UPDATE unified_threads SET is_archived = $1, updated_at = NOW() WHERE id = $2`,
        [previousState.is_archived, action.target_id]
      );
      await client.query(
        `UPDATE unified_messages SET is_archived = $1, updated_at = NOW() WHERE thread_id = $2`,
        [previousState.is_archived, action.target_id]
      );
    } else if (action.action_type === 'trash') {
      await client.query(
        `UPDATE unified_threads SET is_trashed = $1, updated_at = NOW() WHERE id = $2`,
        [previousState.is_trashed, action.target_id]
      );
      await client.query(
        `UPDATE unified_messages SET is_trashed = $1, updated_at = NOW() WHERE thread_id = $2`,
        [previousState.is_trashed, action.target_id]
      );
    }

    // Mark action as undone
    await client.query(
      `UPDATE inbox_action_log SET undone = true, undone_at = NOW() WHERE id = $1`,
      [actionId]
    );

    return true;
  });

  return result;
}

// =====================================================
// STATS & COUNTS
// =====================================================

/**
 * Get inbox statistics for dashboard
 */
export async function getInboxStats(userId: string): Promise<InboxStats> {
  // Total counts
  const countsResult = await query(
    `SELECT
       COUNT(*) FILTER (WHERE is_archived = false AND is_trashed = false AND is_spam = false) as total,
       COUNT(*) FILTER (WHERE is_read = false AND is_archived = false AND is_trashed = false AND is_spam = false) as unread,
       COUNT(*) FILTER (WHERE is_starred = true AND is_trashed = false) as starred,
       COUNT(*) FILTER (WHERE is_archived = true AND is_trashed = false) as archived,
       COUNT(*) FILTER (WHERE is_snoozed = true AND is_trashed = false) as snoozed,
       COUNT(*) FILTER (WHERE is_spam = true AND is_trashed = false) as spam,
       COUNT(*) FILTER (WHERE is_campaign_reply = true AND is_trashed = false) as campaign_replies
     FROM unified_threads WHERE user_id = $1`,
    [userId]
  );

  // By channel
  const channelResult = await query(
    `SELECT primary_channel, COUNT(*) as count
     FROM unified_threads
     WHERE user_id = $1 AND is_archived = false AND is_trashed = false
     GROUP BY primary_channel`,
    [userId]
  );

  // By category
  const categoryResult = await query(
    `SELECT ai_category, COUNT(*) as count
     FROM unified_threads
     WHERE user_id = $1 AND is_archived = false AND is_trashed = false AND ai_category IS NOT NULL
     GROUP BY ai_category`,
    [userId]
  );

  // By priority
  const priorityResult = await query(
    `SELECT ai_priority, COUNT(*) as count
     FROM unified_threads
     WHERE user_id = $1 AND is_archived = false AND is_trashed = false AND ai_priority IS NOT NULL
     GROUP BY ai_priority`,
    [userId]
  );

  const counts = countsResult.rows[0] || {};
  const byChannel: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byPriority: Record<string, number> = {};

  for (const row of channelResult.rows) {
    byChannel[row.primary_channel] = parseInt(row.count);
  }

  for (const row of categoryResult.rows) {
    byCategory[row.ai_category] = parseInt(row.count);
  }

  for (const row of priorityResult.rows) {
    byPriority[row.ai_priority] = parseInt(row.count);
  }

  return {
    total: parseInt(counts.total || '0'),
    unread: parseInt(counts.unread || '0'),
    starred: parseInt(counts.starred || '0'),
    archived: parseInt(counts.archived || '0'),
    snoozed: parseInt(counts.snoozed || '0'),
    spam: parseInt(counts.spam || '0'),
    campaignReplies: parseInt(counts.campaign_replies || '0'),
    byChannel,
    byCategory,
    byPriority,
  };
}

// =====================================================
// MESSAGE CREATION & UPDATES
// =====================================================

/**
 * Create a new message (from sync or send)
 */
export async function createMessage(
  userId: string,
  data: Partial<UnifiedMessage> & {
    channel: InboxChannel;
    direction: MessageDirection;
    from: Participant;
    to: Participant[];
  }
): Promise<UnifiedMessage> {
  const messageId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Determine or create thread
  let threadId = data.threadId;
  if (!threadId && data.channelThreadId) {
    // Try to find existing thread by channel thread ID
    const existingThread = await query(
      `SELECT id FROM unified_threads
       WHERE user_id = $1 AND id IN (
         SELECT thread_id FROM unified_messages WHERE channel_thread_id = $2
       )`,
      [userId, data.channelThreadId]
    );

    if (existingThread.rows.length > 0) {
      threadId = existingThread.rows[0].id;
    }
  }

  // Create new thread if needed
  if (!threadId) {
    threadId = crypto.randomUUID();
    const participants = [data.from, ...data.to, ...(data.cc || [])];

    await query(
      `INSERT INTO unified_threads (
        id, user_id, subject, snippet, participants, participant_count,
        primary_channel, message_count, unread_count, is_read,
        first_message_at, last_message_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9, $10, $10, $11, $11)`,
      [
        threadId,
        userId,
        data.subject || null,
        data.snippet || (data.bodyText?.substring(0, 100) || null),
        JSON.stringify(participants),
        participants.length,
        data.channel,
        data.direction === 'inbound' ? 1 : 0,
        data.direction === 'outbound',
        data.receivedAt?.toISOString() || data.sentAt?.toISOString() || now,
        now,
      ]
    );
  }

  // Insert message
  await query(
    `INSERT INTO unified_messages (
      id, user_id, account_id, channel, channel_message_id, channel_thread_id,
      thread_id, direction, from_address, from_name, from_avatar_url,
      to_addresses, cc_addresses, bcc_addresses, subject, body_text, body_html,
      snippet, attachments, is_read, is_draft, labels, sent_at, received_at,
      synced_at, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
      $17, $18, $19, $20, $21, $22, $23, $24, $25, $25, $25
    )`,
    [
      messageId,
      userId,
      data.accountId || null,
      data.channel,
      data.channelMessageId || null,
      data.channelThreadId || null,
      threadId,
      data.direction,
      data.from.address,
      data.from.name || null,
      data.from.avatarUrl || null,
      JSON.stringify(data.to),
      JSON.stringify(data.cc || []),
      JSON.stringify(data.bcc || []),
      data.subject || null,
      data.bodyText || null,
      data.bodyHtml || null,
      data.snippet || (data.bodyText?.substring(0, 100) || null),
      JSON.stringify(data.attachments || []),
      data.direction === 'outbound',
      data.isDraft || false,
      JSON.stringify(data.labels || []),
      data.sentAt?.toISOString() || null,
      data.receivedAt?.toISOString() || null,
      now,
    ]
  );

  return getMessage(messageId, userId) as Promise<UnifiedMessage>;
}

/**
 * Update message AI analysis
 */
export async function updateMessageAIAnalysis(
  messageId: string,
  userId: string,
  analysis: {
    category?: AICategory;
    priority?: AIPriority;
    sentiment?: AISentiment;
    summary?: string;
    suggestedReply?: string;
    entities?: AIEntity[];
    actionItems?: ActionItem[];
  }
): Promise<void> {
  await query(
    `UPDATE unified_messages
     SET
       ai_category = COALESCE($3, ai_category),
       ai_priority = COALESCE($4, ai_priority),
       ai_sentiment = COALESCE($5, ai_sentiment),
       ai_summary = COALESCE($6, ai_summary),
       ai_suggested_reply = COALESCE($7, ai_suggested_reply),
       ai_entities = COALESCE($8, ai_entities),
       ai_action_items = COALESCE($9, ai_action_items),
       updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [
      messageId,
      userId,
      analysis.category || null,
      analysis.priority || null,
      analysis.sentiment || null,
      analysis.summary || null,
      analysis.suggestedReply || null,
      analysis.entities ? JSON.stringify(analysis.entities) : null,
      analysis.actionItems ? JSON.stringify(analysis.actionItems) : null,
    ]
  );

  // Also update thread category/priority
  const message = await getMessage(messageId, userId);
  if (message?.threadId) {
    await query(
      `UPDATE unified_threads
       SET
         ai_category = COALESCE($3, ai_category),
         ai_priority = COALESCE($4, ai_priority),
         updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [message.threadId, userId, analysis.category || null, analysis.priority || null]
    );
  }
}

// =====================================================
// HELPERS
// =====================================================

function mapRowToThread(row: any): UnifiedThread {
  return {
    id: row.id,
    userId: row.user_id,
    subject: row.subject,
    snippet: row.snippet,
    participants: row.participants || [],
    participantCount: row.participant_count || 0,
    primaryChannel: row.primary_channel as InboxChannel,
    messageCount: row.message_count || 0,
    unreadCount: row.unread_count || 0,
    isRead: row.is_read || false,
    isStarred: row.is_starred || false,
    isArchived: row.is_archived || false,
    isTrashed: row.is_trashed || false,
    isSpam: row.is_spam || false,
    isSnoozed: row.is_snoozed || false,
    snoozeUntil: row.snooze_until ? new Date(row.snooze_until) : undefined,
    labels: row.labels || [],
    aiCategory: row.ai_category as AICategory | undefined,
    aiPriority: row.ai_priority as AIPriority | undefined,
    aiSummary: row.ai_summary,
    aiSuggestedAction: row.ai_suggested_action,
    isCampaignReply: row.is_campaign_reply || false,
    matchedCampaignId: row.matched_campaign_id,
    firstMessageAt: row.first_message_at ? new Date(row.first_message_at) : undefined,
    lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRowToMessage(row: any): UnifiedMessage {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    channel: row.channel as InboxChannel,
    channelMessageId: row.channel_message_id,
    channelThreadId: row.channel_thread_id,
    threadId: row.thread_id,
    direction: row.direction as MessageDirection,
    from: {
      address: row.from_address,
      name: row.from_name,
      avatarUrl: row.from_avatar_url,
    },
    to: row.to_addresses || [],
    cc: row.cc_addresses,
    bcc: row.bcc_addresses,
    subject: row.subject,
    bodyText: row.body_text,
    bodyHtml: row.body_html,
    snippet: row.snippet,
    attachments: row.attachments || [],
    hasAttachments: row.has_attachments || false,
    isRead: row.is_read || false,
    isStarred: row.is_starred || false,
    isArchived: row.is_archived || false,
    isTrashed: row.is_trashed || false,
    isSpam: row.is_spam || false,
    isDraft: row.is_draft || false,
    labels: row.labels || [],
    aiCategory: row.ai_category as AICategory | undefined,
    aiPriority: row.ai_priority as AIPriority | undefined,
    aiSentiment: row.ai_sentiment as AISentiment | undefined,
    aiSummary: row.ai_summary,
    aiSuggestedReply: row.ai_suggested_reply,
    aiEntities: row.ai_entities,
    aiActionItems: row.ai_action_items,
    matchedCampaignId: row.matched_campaign_id,
    matchedOutreachMessageId: row.matched_outreach_message_id,
    isCampaignReply: row.is_campaign_reply || false,
    campaignMatchConfidence: row.campaign_match_confidence,
    contactId: row.contact_id,
    isSnoozed: row.is_snoozed || false,
    snoozeUntil: row.snooze_until ? new Date(row.snooze_until) : undefined,
    sentAt: row.sent_at ? new Date(row.sent_at) : undefined,
    receivedAt: row.received_at ? new Date(row.received_at) : undefined,
    readAt: row.read_at ? new Date(row.read_at) : undefined,
    syncedAt: new Date(row.synced_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// =====================================================
// EXPORTS
// =====================================================

export default {
  // Core operations
  getThreads,
  getThread,
  getMessage,
  searchMessages,
  createMessage,
  updateMessageAIAnalysis,

  // Quick actions
  archiveThreads,
  trashThreads,
  starThreads,
  markThreadsRead,
  snoozeThread,
  unsnoozeThread,
  markAsSpam,
  undoAction,

  // Stats
  getInboxStats,

  // Constants
  CHANNEL_CONFIG,
};
