/**
 * Founder Unified Inbox Service - Wells AI
 *
 * A comprehensive, founder-centric inbox that aggregates ALL communication channels
 * in one place with Wells AI inline in every thread.
 *
 * Features:
 * - Multi-channel aggregation (email, SMS, social, messaging apps, e-commerce)
 * - Smart categorization for founders (deals, hiring, investors, etc.)
 * - AI-powered summaries, replies, and action extraction
 * - Project and deal linking
 * - Real-time sync across all channels
 *
 * Built on top of existing /lib/inbox/inbox-service.ts patterns.
 */

import { sqlQuery as sql } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';

// =====================================================
// TYPES
// =====================================================

/**
 * All supported inbox channels
 */
export type InboxChannel =
  | 'email'
  | 'gmail'
  | 'outlook'
  | 'sms'
  | 'imessage'
  | 'whatsapp'
  | 'slack'
  | 'teams'
  | 'discord'
  | 'twitter'
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'shopify'
  | 'intercom'
  | 'wells_internal';

/**
 * Founder-specific categorization
 */
export type FounderCategory =
  | 'deals'
  | 'sales_inquiry'
  | 'customer_support'
  | 'hiring'
  | 'candidate'
  | 'investor'
  | 'partner'
  | 'vendor'
  | 'legal'
  | 'finance'
  | 'team'
  | 'personal'
  | 'newsletter'
  | 'spam';

/**
 * Thread priority levels
 */
export type ThreadPriority = 'urgent' | 'high' | 'normal' | 'low';

/**
 * Sort options for inbox
 */
export type InboxSortBy = 'date' | 'priority' | 'ai_importance';

/**
 * Participant in a thread
 */
export interface Participant {
  id?: string;
  email?: string;
  phone?: string;
  handle?: string;
  name?: string;
  avatarUrl?: string;
  channel?: InboxChannel;
  isVIP?: boolean;
  company?: string;
}

/**
 * Unified thread across all channels
 */
export interface UnifiedThread {
  id: string;
  channel: InboxChannel;
  externalId: string;
  accountId?: string;
  participants: Participant[];
  subject?: string;
  preview: string;
  category: FounderCategory;
  priority: ThreadPriority;
  isRead: boolean;
  isStarred: boolean;
  isSnoozed: boolean;
  snoozeUntil?: Date;
  isArchived: boolean;
  isTrashed: boolean;
  lastMessageAt: Date;
  messageCount: number;
  hasAttachments: boolean;
  aiSummary?: string;
  suggestedReplies?: string[];
  linkedProjectId?: string;
  linkedDealId?: string;
  tags: string[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Individual message within a thread
 */
export interface UnifiedMessage {
  id: string;
  threadId: string;
  channel: InboxChannel;
  externalId?: string;
  direction: 'inbound' | 'outbound';
  from: Participant;
  to: Participant[];
  cc?: Participant[];
  bcc?: Participant[];
  subject?: string;
  bodyText: string;
  bodyHtml?: string;
  attachments: MessageAttachment[];
  sentAt?: Date;
  receivedAt?: Date;
  isRead: boolean;
  aiAnalysis?: MessageAIAnalysis;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Message attachment
 */
export interface MessageAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
}

/**
 * AI analysis of a message
 */
export interface MessageAIAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  entities: ExtractedEntity[];
  actionItems: ActionItem[];
  summary?: string;
}

/**
 * Entity extracted from message
 */
export interface ExtractedEntity {
  type: 'person' | 'company' | 'date' | 'amount' | 'email' | 'phone' | 'location';
  value: string;
  confidence: number;
}

/**
 * Action item extracted from message
 */
export interface ActionItem {
  description: string;
  dueDate?: Date;
  priority: 'high' | 'medium' | 'low';
  assignee?: string;
}

/**
 * Connected channel account
 */
export interface ConnectedChannel {
  id: string;
  userId: string;
  channel: InboxChannel;
  accountName: string;
  accountEmail?: string;
  accountHandle?: string;
  isActive: boolean;
  lastSyncAt?: Date;
  syncStatus: 'idle' | 'syncing' | 'error';
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Inbox statistics
 */
export interface InboxStats {
  totalThreads: number;
  unreadCount: number;
  byCategory: Record<FounderCategory, number>;
  byChannel: Record<InboxChannel, number>;
  byPriority: Record<ThreadPriority, number>;
  avgResponseTimeHours: number;
  pendingReplies: number;
  todayReceived: number;
  todaySent: number;
}

/**
 * Filter options for inbox
 */
export interface InboxFilters {
  channels?: InboxChannel[];
  categories?: FounderCategory[];
  priorities?: ThreadPriority[];
  isRead?: boolean;
  isStarred?: boolean;
  isSnoozed?: boolean;
  isArchived?: boolean;
  hasAttachments?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  linkedProjectId?: string;
  linkedDealId?: string;
  tags?: string[];
  participantEmail?: string;
  sortBy?: InboxSortBy;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Reply options
 */
export interface ReplyOptions {
  bodyHtml?: string;
  attachments?: MessageAttachment[];
  scheduleFor?: Date;
  trackOpens?: boolean;
  trackClicks?: boolean;
}

/**
 * AI tone options for reply generation
 */
export type ReplyTone = 'professional' | 'casual' | 'friendly' | 'formal' | 'empathetic' | 'assertive';

// =====================================================
// ANTHROPIC CLIENT
// =====================================================

const anthropic = new Anthropic();

// =====================================================
// CHANNEL PROVIDERS (Stubs for future implementation)
// =====================================================

/**
 * Base interface for channel providers
 */
interface ChannelProvider {
  channel: InboxChannel;
  connect(userId: string, credentials: Record<string, string>): Promise<ConnectedChannel>;
  disconnect(userId: string): Promise<void>;
  sync(accountId: string): Promise<{ threads: UnifiedThread[]; messages: UnifiedMessage[] }>;
  sendMessage(accountId: string, threadId: string, message: string, options?: ReplyOptions): Promise<UnifiedMessage>;
  markRead(accountId: string, threadId: string): Promise<void>;
}

/**
 * iMessage Provider Stub
 * Uses Apple Business Chat API or Beeper API for iMessage integration
 */
class IMessageProvider implements ChannelProvider {
  channel: InboxChannel = 'imessage';

  async connect(userId: string, credentials: Record<string, string>): Promise<ConnectedChannel> {
    // TODO: Implement Apple Business Chat or Beeper API integration
    // Apple Business Chat: https://developer.apple.com/business-chat/
    // Beeper API: https://www.beeper.com/api
    console.log('[iMessage] Connect stub called for user:', userId);
    throw new Error('iMessage integration not yet implemented. Consider using Beeper API for cross-platform support.');
  }

  async disconnect(userId: string): Promise<void> {
    console.log('[iMessage] Disconnect stub called for user:', userId);
  }

  async sync(accountId: string): Promise<{ threads: UnifiedThread[]; messages: UnifiedMessage[] }> {
    console.log('[iMessage] Sync stub called for account:', accountId);
    return { threads: [], messages: [] };
  }

  async sendMessage(accountId: string, threadId: string, message: string): Promise<UnifiedMessage> {
    console.log('[iMessage] Send stub called:', { accountId, threadId, message });
    throw new Error('iMessage send not yet implemented');
  }

  async markRead(accountId: string, threadId: string): Promise<void> {
    console.log('[iMessage] Mark read stub called:', { accountId, threadId });
  }
}

/**
 * Instagram DM Provider Stub
 * Uses Instagram Graph API for DM functionality
 */
class InstagramProvider implements ChannelProvider {
  channel: InboxChannel = 'instagram';

  // Instagram Graph API endpoints
  private baseUrl = 'https://graph.instagram.com';

  async connect(userId: string, credentials: Record<string, string>): Promise<ConnectedChannel> {
    // TODO: Implement Instagram Graph API OAuth flow
    // Requires: instagram_basic, instagram_manage_messages, pages_manage_metadata scopes
    // Documentation: https://developers.facebook.com/docs/instagram-api/guides/messaging
    console.log('[Instagram] Connect stub called for user:', userId);

    const { accessToken, instagramAccountId } = credentials;

    if (!accessToken || !instagramAccountId) {
      throw new Error('Instagram connection requires accessToken and instagramAccountId');
    }

    // Verify token and get account info
    // const response = await fetch(`${this.baseUrl}/${instagramAccountId}?fields=id,username&access_token=${accessToken}`);

    throw new Error('Instagram DM integration not yet implemented. Requires Meta Business verification.');
  }

  async disconnect(userId: string): Promise<void> {
    console.log('[Instagram] Disconnect stub called for user:', userId);
  }

  async sync(accountId: string): Promise<{ threads: UnifiedThread[]; messages: UnifiedMessage[] }> {
    // GET /{ig-user-id}/conversations to fetch conversations
    // GET /{conversation-id}/messages to fetch messages
    console.log('[Instagram] Sync stub called for account:', accountId);
    return { threads: [], messages: [] };
  }

  async sendMessage(accountId: string, threadId: string, message: string): Promise<UnifiedMessage> {
    // POST /{ig-user-id}/messages with recipient and message
    console.log('[Instagram] Send stub called:', { accountId, threadId, message });
    throw new Error('Instagram send not yet implemented');
  }

  async markRead(accountId: string, threadId: string): Promise<void> {
    console.log('[Instagram] Mark read stub called:', { accountId, threadId });
  }
}

/**
 * Shopify Customer Messages Provider Stub
 * Uses Shopify Admin API for customer communication
 */
class ShopifyProvider implements ChannelProvider {
  channel: InboxChannel = 'shopify';

  async connect(userId: string, credentials: Record<string, string>): Promise<ConnectedChannel> {
    // TODO: Implement Shopify OAuth and Admin API integration
    // Requires: read_customers, write_customers, read_orders scopes
    // Uses Shopify Inbox API: https://shopify.dev/docs/api/admin-rest/2024-01/resources/customer
    console.log('[Shopify] Connect stub called for user:', userId);

    const { shopDomain, accessToken } = credentials;

    if (!shopDomain || !accessToken) {
      throw new Error('Shopify connection requires shopDomain and accessToken');
    }

    throw new Error('Shopify integration not yet implemented');
  }

  async disconnect(userId: string): Promise<void> {
    console.log('[Shopify] Disconnect stub called for user:', userId);
  }

  async sync(accountId: string): Promise<{ threads: UnifiedThread[]; messages: UnifiedMessage[] }> {
    // Use Shopify Inbox API or Customer Events API
    console.log('[Shopify] Sync stub called for account:', accountId);
    return { threads: [], messages: [] };
  }

  async sendMessage(accountId: string, threadId: string, message: string): Promise<UnifiedMessage> {
    console.log('[Shopify] Send stub called:', { accountId, threadId, message });
    throw new Error('Shopify send not yet implemented');
  }

  async markRead(accountId: string, threadId: string): Promise<void> {
    console.log('[Shopify] Mark read stub called:', { accountId, threadId });
  }
}

/**
 * Twitter/X DM Provider Stub
 * Uses Twitter API v2 for DM functionality
 */
class TwitterProvider implements ChannelProvider {
  channel: InboxChannel = 'twitter';

  async connect(userId: string, credentials: Record<string, string>): Promise<ConnectedChannel> {
    // Implementation exists in /lib/inbox/providers/twitter-dm.ts
    // This stub delegates to that implementation
    console.log('[Twitter] Connect stub - delegating to twitter-dm.ts');

    const { getAuthorizationUrl, exchangeCodeForTokens } = await import('@/lib/inbox/providers/twitter-dm');

    // Return auth URL for OAuth flow
    throw new Error('Use getTwitterAuthUrl() to initiate OAuth flow');
  }

  async disconnect(userId: string): Promise<void> {
    console.log('[Twitter] Disconnect stub called for user:', userId);
  }

  async sync(accountId: string): Promise<{ threads: UnifiedThread[]; messages: UnifiedMessage[] }> {
    const { fetchDMConversations, getThreadMessages } = await import('@/lib/inbox/providers/twitter-dm');
    // Delegate to existing implementation
    console.log('[Twitter] Sync delegating to twitter-dm.ts for account:', accountId);
    return { threads: [], messages: [] };
  }

  async sendMessage(accountId: string, threadId: string, message: string): Promise<UnifiedMessage> {
    const { sendDM } = await import('@/lib/inbox/providers/twitter-dm');
    console.log('[Twitter] Send delegating to twitter-dm.ts');
    throw new Error('Use sendTwitterDM() directly');
  }

  async markRead(accountId: string, threadId: string): Promise<void> {
    const { markThreadAsRead } = await import('@/lib/inbox/providers/twitter-dm');
    await markThreadAsRead(threadId);
  }
}

/**
 * LinkedIn Messages Provider Stub
 * Uses LinkedIn API for messaging
 */
class LinkedInProvider implements ChannelProvider {
  channel: InboxChannel = 'linkedin';

  async connect(userId: string, credentials: Record<string, string>): Promise<ConnectedChannel> {
    // TODO: Implement LinkedIn OAuth 2.0 flow
    // Requires: r_emailaddress, r_liteprofile, w_member_social scopes
    // Note: LinkedIn messaging API has limited access, requires partner program
    // Documentation: https://docs.microsoft.com/en-us/linkedin/shared/integrations/communications/messages
    console.log('[LinkedIn] Connect stub called for user:', userId);

    throw new Error('LinkedIn messaging requires LinkedIn Partner Program access. Contact LinkedIn for API access.');
  }

  async disconnect(userId: string): Promise<void> {
    console.log('[LinkedIn] Disconnect stub called for user:', userId);
  }

  async sync(accountId: string): Promise<{ threads: UnifiedThread[]; messages: UnifiedMessage[] }> {
    // GET /messages endpoint (requires partner access)
    console.log('[LinkedIn] Sync stub called for account:', accountId);
    return { threads: [], messages: [] };
  }

  async sendMessage(accountId: string, threadId: string, message: string): Promise<UnifiedMessage> {
    console.log('[LinkedIn] Send stub called:', { accountId, threadId, message });
    throw new Error('LinkedIn send not yet implemented');
  }

  async markRead(accountId: string, threadId: string): Promise<void> {
    console.log('[LinkedIn] Mark read stub called:', { accountId, threadId });
  }
}

/**
 * Facebook Messenger Provider Stub
 * Uses Meta Graph API for Messenger
 */
class FacebookMessengerProvider implements ChannelProvider {
  channel: InboxChannel = 'facebook';

  async connect(userId: string, credentials: Record<string, string>): Promise<ConnectedChannel> {
    // TODO: Implement Facebook Login and Messenger Platform API
    // Requires: pages_messaging, pages_read_engagement scopes
    // Documentation: https://developers.facebook.com/docs/messenger-platform
    console.log('[Facebook] Connect stub called for user:', userId);

    const { accessToken, pageId } = credentials;

    if (!accessToken || !pageId) {
      throw new Error('Facebook connection requires accessToken and pageId');
    }

    throw new Error('Facebook Messenger integration not yet implemented. Requires Meta Business verification.');
  }

  async disconnect(userId: string): Promise<void> {
    console.log('[Facebook] Disconnect stub called for user:', userId);
  }

  async sync(accountId: string): Promise<{ threads: UnifiedThread[]; messages: UnifiedMessage[] }> {
    // GET /{page-id}/conversations to fetch conversations
    console.log('[Facebook] Sync stub called for account:', accountId);
    return { threads: [], messages: [] };
  }

  async sendMessage(accountId: string, threadId: string, message: string): Promise<UnifiedMessage> {
    // POST /me/messages with messaging_type and recipient
    console.log('[Facebook] Send stub called:', { accountId, threadId, message });
    throw new Error('Facebook send not yet implemented');
  }

  async markRead(accountId: string, threadId: string): Promise<void> {
    // POST /me/messages with sender_action: 'mark_seen'
    console.log('[Facebook] Mark read stub called:', { accountId, threadId });
  }
}

// Provider registry
const channelProviders: Partial<Record<InboxChannel, ChannelProvider>> = {
  imessage: new IMessageProvider(),
  instagram: new InstagramProvider(),
  shopify: new ShopifyProvider(),
  twitter: new TwitterProvider(),
  linkedin: new LinkedInProvider(),
  facebook: new FacebookMessengerProvider(),
};

// =====================================================
// CORE INBOX FUNCTIONS
// =====================================================

/**
 * Get unified inbox with all threads across all channels
 */
export async function getUnifiedInbox(
  userId: string,
  filters: InboxFilters = {}
): Promise<{ threads: UnifiedThread[]; total: number; hasMore: boolean }> {
  const {
    channels,
    categories,
    priorities,
    isRead,
    isStarred,
    isSnoozed,
    isArchived = false,
    hasAttachments,
    dateFrom,
    dateTo,
    search,
    linkedProjectId,
    linkedDealId,
    tags,
    participantEmail,
    sortBy = 'date',
    sortOrder = 'desc',
    limit = 50,
    offset = 0,
  } = filters;

  let query = `
    SELECT * FROM unified_inbox_threads
    WHERE user_id = $1
    AND is_archived = $2
    AND is_trashed = false
  `;
  const params: unknown[] = [userId, isArchived];
  let paramIndex = 3;

  // Apply filters
  if (channels && channels.length > 0) {
    query += ` AND channel = ANY($${paramIndex})`;
    params.push(channels);
    paramIndex++;
  }

  if (categories && categories.length > 0) {
    query += ` AND category = ANY($${paramIndex})`;
    params.push(categories);
    paramIndex++;
  }

  if (priorities && priorities.length > 0) {
    query += ` AND priority = ANY($${paramIndex})`;
    params.push(priorities);
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

  if (isSnoozed !== undefined) {
    query += ` AND is_snoozed = $${paramIndex}`;
    params.push(isSnoozed);
    paramIndex++;
  }

  if (hasAttachments !== undefined) {
    query += ` AND has_attachments = $${paramIndex}`;
    params.push(hasAttachments);
    paramIndex++;
  }

  if (dateFrom) {
    query += ` AND last_message_at >= $${paramIndex}`;
    params.push(dateFrom.toISOString());
    paramIndex++;
  }

  if (dateTo) {
    query += ` AND last_message_at <= $${paramIndex}`;
    params.push(dateTo.toISOString());
    paramIndex++;
  }

  if (search) {
    query += ` AND (
      to_tsvector('english', subject) @@ plainto_tsquery('english', $${paramIndex})
      OR to_tsvector('english', preview) @@ plainto_tsquery('english', $${paramIndex})
    )`;
    params.push(search);
    paramIndex++;
  }

  if (linkedProjectId) {
    query += ` AND linked_project_id = $${paramIndex}`;
    params.push(linkedProjectId);
    paramIndex++;
  }

  if (linkedDealId) {
    query += ` AND linked_deal_id = $${paramIndex}`;
    params.push(linkedDealId);
    paramIndex++;
  }

  if (tags && tags.length > 0) {
    query += ` AND tags && $${paramIndex}`;
    params.push(tags);
    paramIndex++;
  }

  if (participantEmail) {
    query += ` AND participants @> $${paramIndex}`;
    params.push(JSON.stringify([{ email: participantEmail }]));
    paramIndex++;
  }

  // Get total count
  const countQuery = `SELECT COUNT(*) FROM (${query}) AS count_query`;
  const countResult = await sql(countQuery, params);
  const total = parseInt(countResult.rows[0]?.count || '0');

  // Apply sorting
  let orderBy = 'last_message_at';
  if (sortBy === 'priority') {
    orderBy = `CASE priority
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'normal' THEN 3
      WHEN 'low' THEN 4
    END`;
  } else if (sortBy === 'ai_importance') {
    orderBy = 'ai_importance_score';
  }

  query += ` ORDER BY ${orderBy} ${sortOrder === 'asc' ? 'ASC' : 'DESC'} NULLS LAST`;
  query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await sql(query, params);
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
  const threadResult = await sql`
    SELECT * FROM unified_inbox_threads
    WHERE id = ${threadId} AND user_id = ${userId}
  `;

  if (threadResult.rows.length === 0) {
    return null;
  }

  const thread = mapRowToThread(threadResult.rows[0]);

  // Get messages
  const messagesResult = await sql`
    SELECT * FROM unified_inbox_messages
    WHERE thread_id = ${threadId}
    ORDER BY COALESCE(received_at, sent_at, created_at) ASC
  `;

  const messages = messagesResult.rows.map(mapRowToMessage);

  return { thread, messages };
}

/**
 * Mark thread as read
 */
export async function markRead(threadId: string, userId: string): Promise<void> {
  await sql`
    UPDATE unified_inbox_threads
    SET is_read = true, updated_at = NOW()
    WHERE id = ${threadId} AND user_id = ${userId}
  `;

  await sql`
    UPDATE unified_inbox_messages
    SET is_read = true
    WHERE thread_id = ${threadId}
  `;
}

/**
 * Mark thread as unread
 */
export async function markUnread(threadId: string, userId: string): Promise<void> {
  await sql`
    UPDATE unified_inbox_threads
    SET is_read = false, updated_at = NOW()
    WHERE id = ${threadId} AND user_id = ${userId}
  `;
}

/**
 * Star a thread
 */
export async function star(threadId: string, userId: string): Promise<void> {
  await sql`
    UPDATE unified_inbox_threads
    SET is_starred = true, updated_at = NOW()
    WHERE id = ${threadId} AND user_id = ${userId}
  `;
}

/**
 * Unstar a thread
 */
export async function unstar(threadId: string, userId: string): Promise<void> {
  await sql`
    UPDATE unified_inbox_threads
    SET is_starred = false, updated_at = NOW()
    WHERE id = ${threadId} AND user_id = ${userId}
  `;
}

/**
 * Archive a thread
 */
export async function archive(threadId: string, userId: string): Promise<void> {
  await sql`
    UPDATE unified_inbox_threads
    SET is_archived = true, updated_at = NOW()
    WHERE id = ${threadId} AND user_id = ${userId}
  `;
}

/**
 * Move thread to trash
 */
export async function trash(threadId: string, userId: string): Promise<void> {
  await sql`
    UPDATE unified_inbox_threads
    SET is_trashed = true, updated_at = NOW()
    WHERE id = ${threadId} AND user_id = ${userId}
  `;
}

/**
 * Restore thread from trash
 */
export async function restore(threadId: string, userId: string): Promise<void> {
  await sql`
    UPDATE unified_inbox_threads
    SET is_trashed = false, is_archived = false, updated_at = NOW()
    WHERE id = ${threadId} AND user_id = ${userId}
  `;
}

/**
 * Snooze a thread until a specific date/time
 */
export async function snooze(threadId: string, userId: string, until: Date): Promise<void> {
  await sql`
    UPDATE unified_inbox_threads
    SET
      is_snoozed = true,
      snooze_until = ${until.toISOString()},
      updated_at = NOW()
    WHERE id = ${threadId} AND user_id = ${userId}
  `;

  // Create snooze record for processing
  await sql`
    INSERT INTO unified_inbox_snooze (id, user_id, thread_id, snooze_until, created_at)
    VALUES (${crypto.randomUUID()}, ${userId}, ${threadId}, ${until.toISOString()}, NOW())
    ON CONFLICT (thread_id) DO UPDATE SET snooze_until = ${until.toISOString()}
  `;
}

/**
 * Unsnooze a thread
 */
export async function unsnooze(threadId: string, userId: string): Promise<void> {
  await sql`
    UPDATE unified_inbox_threads
    SET is_snoozed = false, snooze_until = NULL, updated_at = NOW()
    WHERE id = ${threadId} AND user_id = ${userId}
  `;

  await sql`
    DELETE FROM unified_inbox_snooze
    WHERE thread_id = ${threadId} AND user_id = ${userId}
  `;
}

/**
 * Process snoozed threads that are due
 */
export async function processSnoozedThreads(): Promise<number> {
  const result = await sql`
    SELECT thread_id, user_id FROM unified_inbox_snooze
    WHERE snooze_until <= NOW()
  `;

  for (const row of result.rows) {
    await unsnooze(row.thread_id, row.user_id);
  }

  return result.rows.length;
}

/**
 * Manually categorize a thread
 */
export async function categorize(
  threadId: string,
  userId: string,
  category: FounderCategory
): Promise<void> {
  await sql`
    UPDATE unified_inbox_threads
    SET category = ${category}, updated_at = NOW()
    WHERE id = ${threadId} AND user_id = ${userId}
  `;
}

// =====================================================
// AI FEATURES
// =====================================================

/**
 * Generate AI summary for a thread
 */
export async function generateSummary(
  threadId: string,
  userId: string
): Promise<{ summary: string; keyPoints: string[]; sentiment: string }> {
  const threadData = await getThread(threadId, userId);

  if (!threadData) {
    throw new Error('Thread not found');
  }

  const { thread, messages } = threadData;

  // Build context for Claude
  const messageContext = messages.map(m => `
[${m.direction === 'inbound' ? 'From' : 'To'}: ${m.from.name || m.from.email || 'Unknown'}]
${m.subject ? `Subject: ${m.subject}` : ''}
${m.bodyText}
---`).join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Analyze this ${thread.channel} conversation thread and provide:
1. A concise summary (2-3 sentences)
2. Key points (3-5 bullet points)
3. Overall sentiment (positive, neutral, negative, urgent)

Thread:
${messageContext}

Return as JSON:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "sentiment": "..."
}`,
    }],
  });

  const textContent = response.content[0];
  if (textContent.type !== 'text') {
    throw new Error('Unexpected response from AI');
  }

  const result = JSON.parse(textContent.text);

  // Store summary in thread
  await sql`
    UPDATE unified_inbox_threads
    SET ai_summary = ${result.summary}, updated_at = NOW()
    WHERE id = ${threadId} AND user_id = ${userId}
  `;

  return result;
}

/**
 * Generate reply suggestions for a thread
 */
export async function suggestReplies(
  threadId: string,
  userId: string,
  tone: ReplyTone = 'professional'
): Promise<string[]> {
  const threadData = await getThread(threadId, userId);

  if (!threadData) {
    throw new Error('Thread not found');
  }

  const { thread, messages } = threadData;
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage || lastMessage.direction === 'outbound') {
    return [];
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Generate 3 ${tone} reply suggestions for this ${thread.channel} message.

Category: ${thread.category}
From: ${lastMessage.from.name || lastMessage.from.email}
Message: ${lastMessage.bodyText}

Return as JSON array of strings: ["reply1", "reply2", "reply3"]`,
    }],
  });

  const textContent = response.content[0];
  if (textContent.type !== 'text') {
    return [];
  }

  const suggestions = JSON.parse(textContent.text);

  // Store suggestions in thread
  await sql`
    UPDATE unified_inbox_threads
    SET suggested_replies = ${JSON.stringify(suggestions)}, updated_at = NOW()
    WHERE id = ${threadId} AND user_id = ${userId}
  `;

  return suggestions;
}

/**
 * Draft a reply based on natural language instruction
 */
export async function draftReply(
  threadId: string,
  userId: string,
  instruction: string
): Promise<{ draft: string; tone: string; suggestedSubject?: string }> {
  const threadData = await getThread(threadId, userId);

  if (!threadData) {
    throw new Error('Thread not found');
  }

  const { thread, messages } = threadData;
  const recentMessages = messages.slice(-5);

  const context = recentMessages.map(m => `
[${m.direction === 'inbound' ? 'Them' : 'You'}]: ${m.bodyText}`).join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Draft a reply for this ${thread.channel} conversation.

Category: ${thread.category}
Recent conversation:
${context}

Instruction: ${instruction}

Examples of instructions:
- "politely decline" -> Generate a polite decline message
- "schedule a call next week" -> Generate a scheduling message
- "ask for more details about pricing" -> Generate an inquiry about pricing
- "thank them and confirm" -> Generate a grateful confirmation

Return as JSON:
{
  "draft": "The full reply text...",
  "tone": "professional|casual|friendly|formal",
  "suggestedSubject": "Re: ... (if applicable)"
}`,
    }],
  });

  const textContent = response.content[0];
  if (textContent.type !== 'text') {
    throw new Error('Failed to generate draft');
  }

  return JSON.parse(textContent.text);
}

/**
 * Auto-categorize uncategorized threads using AI
 */
export async function autoCategorizeThreads(userId: string): Promise<number> {
  // Get uncategorized threads
  const result = await sql`
    SELECT id, subject, preview, channel, participants
    FROM unified_inbox_threads
    WHERE user_id = ${userId}
    AND (category IS NULL OR category = 'spam')
    LIMIT 50
  `;

  if (result.rows.length === 0) {
    return 0;
  }

  // Batch categorize with AI
  const threadsContext = result.rows.map(t => `
ID: ${t.id}
Channel: ${t.channel}
Subject: ${t.subject || 'N/A'}
Preview: ${t.preview}
Participants: ${JSON.stringify(t.participants)}`).join('\n---\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Categorize these messages for a founder/CEO. Categories are:
- deals: Active sales/business deals
- sales_inquiry: Potential sales leads
- customer_support: Customer issues or questions
- hiring: Job postings, recruiting
- candidate: Job applicants, interview requests
- investor: Investor communications, fundraising
- partner: Partnership opportunities
- vendor: Supplier/vendor communications
- legal: Legal matters, contracts
- finance: Financial, accounting, banking
- team: Internal team communications
- personal: Personal messages
- newsletter: Marketing emails, subscriptions
- spam: Unwanted or irrelevant

Threads:
${threadsContext}

Return JSON array: [{"id": "...", "category": "...", "priority": "urgent|high|normal|low"}]`,
    }],
  });

  const textContent = response.content[0];
  if (textContent.type !== 'text') {
    return 0;
  }

  const categorizations = JSON.parse(textContent.text);

  // Update threads
  for (const cat of categorizations) {
    await sql`
      UPDATE unified_inbox_threads
      SET category = ${cat.category}, priority = ${cat.priority}, updated_at = NOW()
      WHERE id = ${cat.id} AND user_id = ${userId}
    `;
  }

  return categorizations.length;
}

/**
 * Extract action items from a thread
 */
export async function extractActionItems(
  threadId: string,
  userId: string
): Promise<ActionItem[]> {
  const threadData = await getThread(threadId, userId);

  if (!threadData) {
    throw new Error('Thread not found');
  }

  const { messages } = threadData;

  const context = messages.map(m => `
[${m.from.name || m.from.email}]: ${m.bodyText}`).join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Extract all action items and todos from this conversation.

Conversation:
${context}

Return JSON array of action items:
[{
  "description": "What needs to be done",
  "dueDate": "ISO date if mentioned, null otherwise",
  "priority": "high|medium|low",
  "assignee": "Who should do it if clear, null otherwise"
}]`,
    }],
  });

  const textContent = response.content[0];
  if (textContent.type !== 'text') {
    return [];
  }

  return JSON.parse(textContent.text);
}

/**
 * Detect if a thread requires urgent attention
 */
export async function detectUrgency(
  threadId: string,
  userId: string
): Promise<{ isUrgent: boolean; reason?: string; suggestedAction?: string }> {
  const threadData = await getThread(threadId, userId);

  if (!threadData) {
    throw new Error('Thread not found');
  }

  const { thread, messages } = threadData;
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage) {
    return { isUrgent: false };
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Analyze if this message requires urgent attention (for a busy founder/CEO).

Channel: ${thread.channel}
Category: ${thread.category}
From: ${lastMessage.from.name || lastMessage.from.email}
Message: ${lastMessage.bodyText}

Consider urgency factors:
- Time-sensitive deadlines
- Customer emergencies
- Financial/legal matters
- Team crises
- Investor/board communications

Return JSON:
{
  "isUrgent": boolean,
  "reason": "Why it's urgent (if applicable)",
  "suggestedAction": "What to do immediately (if urgent)"
}`,
    }],
  });

  const textContent = response.content[0];
  if (textContent.type !== 'text') {
    return { isUrgent: false };
  }

  const result = JSON.parse(textContent.text);

  // Update thread priority if urgent
  if (result.isUrgent) {
    await sql`
      UPDATE unified_inbox_threads
      SET priority = 'urgent', updated_at = NOW()
      WHERE id = ${threadId} AND user_id = ${userId}
    `;
  }

  return result;
}

// =====================================================
// REPLY & SEND
// =====================================================

/**
 * Send a reply to a thread via the original channel
 */
export async function sendReply(
  threadId: string,
  userId: string,
  message: string,
  options?: ReplyOptions
): Promise<UnifiedMessage> {
  const threadData = await getThread(threadId, userId);

  if (!threadData) {
    throw new Error('Thread not found');
  }

  const { thread } = threadData;

  // Get the channel provider
  const provider = channelProviders[thread.channel];

  // For channels with existing implementations, delegate
  if (thread.channel === 'gmail') {
    const { sendMessage } = await import('@/lib/inbox/providers/gmail');
    // Delegate to Gmail provider
    throw new Error('Use Gmail provider directly for sending');
  }

  if (thread.channel === 'sms') {
    const { sendSMS } = await import('@/lib/inbox/providers/sms');
    // Delegate to SMS provider
    throw new Error('Use SMS provider directly for sending');
  }

  if (thread.channel === 'twitter') {
    const { sendDM } = await import('@/lib/inbox/providers/twitter-dm');
    // Delegate to Twitter provider
    throw new Error('Use Twitter provider directly for sending');
  }

  // For stub providers
  if (provider) {
    return await provider.sendMessage(thread.accountId || '', threadId, message, options);
  }

  throw new Error(`Sending via ${thread.channel} not yet implemented`);
}

/**
 * Forward a thread to another channel or recipient
 */
export async function forwardThread(
  threadId: string,
  userId: string,
  to: { channel: InboxChannel; address: string },
  message?: string
): Promise<void> {
  const threadData = await getThread(threadId, userId);

  if (!threadData) {
    throw new Error('Thread not found');
  }

  const { thread, messages } = threadData;

  // Build forward content
  const forwardContent = `
${message ? message + '\n\n---\nForwarded conversation:\n' : ''}
Original conversation on ${thread.channel}:
${messages.map(m => `[${m.from.name || m.from.email}]: ${m.bodyText}`).join('\n\n')}
`;

  // Send via target channel
  console.log(`[Forward] Forwarding thread ${threadId} to ${to.channel}:${to.address}`);
  console.log(`[Forward] Content: ${forwardContent.substring(0, 200)}...`);

  // TODO: Implement actual forwarding based on target channel
  throw new Error(`Forwarding to ${to.channel} not yet implemented`);
}

/**
 * Create a new thread/conversation
 */
export async function createThread(
  userId: string,
  channel: InboxChannel,
  to: Participant[],
  subject: string | undefined,
  message: string
): Promise<UnifiedThread> {
  const threadId = crypto.randomUUID();

  // Create thread record
  await sql`
    INSERT INTO unified_inbox_threads (
      id, user_id, channel, external_id,
      participants, subject, preview,
      category, priority, is_read, is_starred,
      is_snoozed, is_archived, is_trashed,
      last_message_at, message_count, has_attachments,
      tags, created_at, updated_at
    ) VALUES (
      ${threadId}, ${userId}, ${channel}, ${threadId},
      ${JSON.stringify(to)}, ${subject || null}, ${message.substring(0, 200)},
      'personal', 'normal', false, false,
      false, false, false,
      NOW(), 1, false,
      ${JSON.stringify([])}, NOW(), NOW()
    )
  `;

  // Create initial message
  const messageId = crypto.randomUUID();
  await sql`
    INSERT INTO unified_inbox_messages (
      id, thread_id, channel, direction,
      from_participant, to_participants,
      subject, body_text, is_read,
      sent_at, created_at
    ) VALUES (
      ${messageId}, ${threadId}, ${channel}, 'outbound',
      ${JSON.stringify({ id: userId })}, ${JSON.stringify(to)},
      ${subject || null}, ${message}, true,
      NOW(), NOW()
    )
  `;

  // Auto-categorize the new thread
  setTimeout(() => {
    autoCategorizeThreads(userId).catch(console.error);
  }, 100);

  const result = await sql`
    SELECT * FROM unified_inbox_threads WHERE id = ${threadId}
  `;

  return mapRowToThread(result.rows[0]);
}

// =====================================================
// LINKING
// =====================================================

/**
 * Link a thread to a founder project
 */
export async function linkToProject(
  threadId: string,
  userId: string,
  projectId: string
): Promise<void> {
  // Verify project exists and user has access
  const projectResult = await sql`
    SELECT id FROM founder_projects
    WHERE id = ${projectId} AND owner_id = ${userId}
  `;

  if (projectResult.rows.length === 0) {
    throw new Error('Project not found or access denied');
  }

  await sql`
    UPDATE unified_inbox_threads
    SET linked_project_id = ${projectId}, updated_at = NOW()
    WHERE id = ${threadId} AND user_id = ${userId}
  `;
}

/**
 * Link a thread to a deal/RFQ
 */
export async function linkToDeal(
  threadId: string,
  userId: string,
  dealId: string
): Promise<void> {
  await sql`
    UPDATE unified_inbox_threads
    SET linked_deal_id = ${dealId}, updated_at = NOW()
    WHERE id = ${threadId} AND user_id = ${userId}
  `;
}

/**
 * Create a task from thread content
 */
export async function createTaskFromThread(
  threadId: string,
  userId: string,
  instruction?: string
): Promise<{ taskId: string; title: string; description: string }> {
  const threadData = await getThread(threadId, userId);

  if (!threadData) {
    throw new Error('Thread not found');
  }

  const { thread, messages } = threadData;

  // Use AI to generate task details
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Create a task from this conversation.

${instruction ? `User instruction: ${instruction}\n` : ''}

Subject: ${thread.subject || 'N/A'}
Category: ${thread.category}
Messages:
${messages.slice(-5).map(m => `[${m.from.name || m.from.email}]: ${m.bodyText}`).join('\n')}

Return JSON:
{
  "title": "Brief task title",
  "description": "Detailed description of what needs to be done",
  "dueDate": "ISO date if applicable, null otherwise",
  "priority": "high|medium|low"
}`,
    }],
  });

  const textContent = response.content[0];
  if (textContent.type !== 'text') {
    throw new Error('Failed to generate task');
  }

  const taskData = JSON.parse(textContent.text);
  const taskId = crypto.randomUUID();

  // Create task (integrate with project tasks if linked)
  if (thread.linkedProjectId) {
    const { createTask } = await import('@/lib/founder/project-tasks');
    await createTask(userId, thread.linkedProjectId, taskData.title, {
      description: taskData.description,
      priority: taskData.priority,
      dueDate: taskData.dueDate ? new Date(taskData.dueDate) : undefined,
    });
  }

  return {
    taskId,
    title: taskData.title,
    description: taskData.description,
  };
}

// =====================================================
// CHANNEL MANAGEMENT
// =====================================================

/**
 * Get all connected channels for a user
 */
export async function getConnectedChannels(userId: string): Promise<ConnectedChannel[]> {
  const result = await sql`
    SELECT * FROM unified_inbox_channels
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;

  return result.rows.map((row): ConnectedChannel => ({
    id: row.id,
    userId: row.user_id,
    channel: row.channel,
    accountName: row.account_name,
    accountEmail: row.account_email,
    accountHandle: row.account_handle,
    isActive: row.is_active,
    lastSyncAt: row.last_sync_at,
    syncStatus: row.sync_status,
    errorMessage: row.error_message,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Connect a new channel
 */
export async function connectChannel(
  userId: string,
  channel: InboxChannel,
  credentials: Record<string, string>
): Promise<ConnectedChannel> {
  const provider = channelProviders[channel];

  if (provider) {
    return await provider.connect(userId, credentials);
  }

  // For channels without stub providers, use direct implementations
  if (channel === 'gmail') {
    const { handleOAuthCallback } = await import('@/lib/inbox/providers/gmail');
    throw new Error('Use Gmail OAuth flow directly');
  }

  if (channel === 'sms' || channel === 'whatsapp') {
    const twilio = await import('@/lib/inbox/providers/sms');
    throw new Error('SMS/WhatsApp configured via Twilio settings');
  }

  throw new Error(`Channel ${channel} connection not implemented`);
}

/**
 * Disconnect a channel
 */
export async function disconnectChannel(
  userId: string,
  channelId: string
): Promise<void> {
  await sql`
    UPDATE unified_inbox_channels
    SET is_active = false, updated_at = NOW()
    WHERE id = ${channelId} AND user_id = ${userId}
  `;
}

/**
 * Force sync a specific channel
 */
export async function syncChannel(
  userId: string,
  channelId: string
): Promise<{ threadsAdded: number; messagesAdded: number }> {
  // Update sync status
  await sql`
    UPDATE unified_inbox_channels
    SET sync_status = 'syncing', updated_at = NOW()
    WHERE id = ${channelId} AND user_id = ${userId}
  `;

  try {
    // Get channel details
    const channelResult = await sql`
      SELECT * FROM unified_inbox_channels
      WHERE id = ${channelId} AND user_id = ${userId}
    `;

    if (channelResult.rows.length === 0) {
      throw new Error('Channel not found');
    }

    const channelData = channelResult.rows[0];
    const provider = channelProviders[channelData.channel as InboxChannel];

    let result = { threads: [] as UnifiedThread[], messages: [] as UnifiedMessage[] };

    if (provider) {
      result = await provider.sync(channelId);
    }

    // Update sync status
    await sql`
      UPDATE unified_inbox_channels
      SET
        sync_status = 'idle',
        last_sync_at = NOW(),
        error_message = NULL,
        updated_at = NOW()
      WHERE id = ${channelId}
    `;

    return {
      threadsAdded: result.threads.length,
      messagesAdded: result.messages.length,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await sql`
      UPDATE unified_inbox_channels
      SET
        sync_status = 'error',
        error_message = ${errorMessage},
        updated_at = NOW()
      WHERE id = ${channelId}
    `;

    throw error;
  }
}

// =====================================================
// STATS
// =====================================================

/**
 * Get inbox statistics for a user
 */
export async function getInboxStats(userId: string): Promise<InboxStats> {
  // Total and unread counts
  const totalResult = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_read = false) as unread,
      COUNT(*) FILTER (WHERE is_read = false AND direction = 'inbound' AND last_message_at > NOW() - INTERVAL '24 hours') as pending_replies
    FROM unified_inbox_threads
    WHERE user_id = ${userId} AND is_trashed = false AND is_archived = false
  `;

  // By category
  const categoryResult = await sql`
    SELECT category, COUNT(*) as count
    FROM unified_inbox_threads
    WHERE user_id = ${userId} AND is_trashed = false AND is_archived = false
    GROUP BY category
  `;

  const byCategory = {} as Record<FounderCategory, number>;
  for (const row of categoryResult.rows) {
    byCategory[row.category as FounderCategory] = parseInt(row.count);
  }

  // By channel
  const channelResult = await sql`
    SELECT channel, COUNT(*) as count
    FROM unified_inbox_threads
    WHERE user_id = ${userId} AND is_trashed = false AND is_archived = false
    GROUP BY channel
  `;

  const byChannel = {} as Record<InboxChannel, number>;
  for (const row of channelResult.rows) {
    byChannel[row.channel as InboxChannel] = parseInt(row.count);
  }

  // By priority
  const priorityResult = await sql`
    SELECT priority, COUNT(*) as count
    FROM unified_inbox_threads
    WHERE user_id = ${userId} AND is_trashed = false AND is_archived = false
    GROUP BY priority
  `;

  const byPriority = {} as Record<ThreadPriority, number>;
  for (const row of priorityResult.rows) {
    byPriority[row.priority as ThreadPriority] = parseInt(row.count);
  }

  // Today's activity
  const todayResult = await sql`
    SELECT
      COUNT(*) FILTER (WHERE direction = 'inbound') as received,
      COUNT(*) FILTER (WHERE direction = 'outbound') as sent
    FROM unified_inbox_messages m
    JOIN unified_inbox_threads t ON m.thread_id = t.id
    WHERE t.user_id = ${userId}
    AND m.created_at > NOW() - INTERVAL '24 hours'
  `;

  // Average response time (simplified)
  const responseTimeResult = await sql`
    SELECT AVG(EXTRACT(EPOCH FROM (m2.created_at - m1.created_at)) / 3600) as avg_hours
    FROM unified_inbox_messages m1
    JOIN unified_inbox_messages m2 ON m1.thread_id = m2.thread_id
    JOIN unified_inbox_threads t ON m1.thread_id = t.id
    WHERE t.user_id = ${userId}
    AND m1.direction = 'inbound'
    AND m2.direction = 'outbound'
    AND m2.created_at > m1.created_at
    AND m1.created_at > NOW() - INTERVAL '30 days'
  `;

  return {
    totalThreads: parseInt(totalResult.rows[0]?.total || '0'),
    unreadCount: parseInt(totalResult.rows[0]?.unread || '0'),
    byCategory,
    byChannel,
    byPriority,
    avgResponseTimeHours: parseFloat(responseTimeResult.rows[0]?.avg_hours || '0'),
    pendingReplies: parseInt(totalResult.rows[0]?.pending_replies || '0'),
    todayReceived: parseInt(todayResult.rows[0]?.received || '0'),
    todaySent: parseInt(todayResult.rows[0]?.sent || '0'),
  };
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Map database row to UnifiedThread
 */
function mapRowToThread(row: Record<string, unknown>): UnifiedThread {
  return {
    id: row.id as string,
    channel: row.channel as InboxChannel,
    externalId: row.external_id as string,
    accountId: row.account_id as string | undefined,
    participants: (row.participants as Participant[]) || [],
    subject: row.subject as string | undefined,
    preview: row.preview as string,
    category: (row.category as FounderCategory) || 'personal',
    priority: (row.priority as ThreadPriority) || 'normal',
    isRead: row.is_read as boolean,
    isStarred: row.is_starred as boolean,
    isSnoozed: row.is_snoozed as boolean,
    snoozeUntil: row.snooze_until ? new Date(row.snooze_until as string) : undefined,
    isArchived: row.is_archived as boolean,
    isTrashed: row.is_trashed as boolean,
    lastMessageAt: new Date(row.last_message_at as string),
    messageCount: row.message_count as number,
    hasAttachments: row.has_attachments as boolean,
    aiSummary: row.ai_summary as string | undefined,
    suggestedReplies: row.suggested_replies as string[] | undefined,
    linkedProjectId: row.linked_project_id as string | undefined,
    linkedDealId: row.linked_deal_id as string | undefined,
    tags: (row.tags as string[]) || [],
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

/**
 * Map database row to UnifiedMessage
 */
function mapRowToMessage(row: Record<string, unknown>): UnifiedMessage {
  return {
    id: row.id as string,
    threadId: row.thread_id as string,
    channel: row.channel as InboxChannel,
    externalId: row.external_id as string | undefined,
    direction: row.direction as 'inbound' | 'outbound',
    from: (row.from_participant as Participant) || {},
    to: (row.to_participants as Participant[]) || [],
    cc: row.cc_participants as Participant[] | undefined,
    bcc: row.bcc_participants as Participant[] | undefined,
    subject: row.subject as string | undefined,
    bodyText: row.body_text as string,
    bodyHtml: row.body_html as string | undefined,
    attachments: (row.attachments as MessageAttachment[]) || [],
    sentAt: row.sent_at ? new Date(row.sent_at as string) : undefined,
    receivedAt: row.received_at ? new Date(row.received_at as string) : undefined,
    isRead: row.is_read as boolean,
    aiAnalysis: row.ai_analysis as MessageAIAnalysis | undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: new Date(row.created_at as string),
  };
}

// =====================================================
// EXPORTS
// =====================================================

export default {
  // Core inbox
  getUnifiedInbox,
  getThread,
  markRead,
  markUnread,
  star,
  unstar,
  archive,
  trash,
  restore,
  snooze,
  unsnooze,
  processSnoozedThreads,
  categorize,

  // AI features
  generateSummary,
  suggestReplies,
  draftReply,
  autoCategorizeThreads,
  extractActionItems,
  detectUrgency,

  // Reply & send
  sendReply,
  forwardThread,
  createThread,

  // Linking
  linkToProject,
  linkToDeal,
  createTaskFromThread,

  // Channel management
  getConnectedChannels,
  connectChannel,
  disconnectChannel,
  syncChannel,

  // Stats
  getInboxStats,
};
