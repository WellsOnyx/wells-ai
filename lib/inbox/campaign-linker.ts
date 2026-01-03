/**
 * Campaign Reply Linker
 *
 * Detects and links incoming inbox messages to cold start campaigns.
 * Updates campaign stats when replies are detected.
 * Provides campaign context for inbox threads.
 */

import { sql } from '@vercel/postgres';

// ============================================================================
// TYPES
// ============================================================================

export interface CampaignMatch {
  campaignId: string;
  campaignName: string;
  outreachId: string;
  contactId: string;
  variantId?: string;
  channel: string;
  matchMethod: 'email' | 'phone' | 'subject' | 'tracking_id' | 'thread_reference';
  matchConfidence: number;
  originalSentAt?: Date;
  originalSubject?: string;
  originalBody?: string;
}

export interface CampaignContext {
  campaign: {
    id: string;
    name: string;
    status: string;
    totalSent: number;
    totalReplied: number;
    replyRate: number;
  };
  outreach: {
    id: string;
    channel: string;
    sentAt: Date;
    subject?: string;
    status: string;
  };
  contact: {
    id: string;
    email?: string;
    phone?: string;
    fullName?: string;
    company?: string;
  };
  variant?: {
    id: string;
    name: string;
    sent: number;
    opened: number;
    clicked: number;
  };
}

export interface LinkResult {
  linked: boolean;
  match?: CampaignMatch;
  error?: string;
}

// ============================================================================
// CAMPAIGN REPLY DETECTION
// ============================================================================

/**
 * Detect if an incoming message is a reply to a cold start campaign
 * Uses multiple matching strategies in order of confidence:
 * 1. Email address match (highest confidence)
 * 2. Phone number match (for SMS)
 * 3. Subject line similarity
 * 4. Tracking ID in headers/body
 */
export async function detectCampaignReply(
  message: {
    fromAddress?: string;
    fromPhone?: string;
    subject?: string;
    bodyText?: string;
    bodyHtml?: string;
    headers?: Record<string, string>;
    provider: string;
    userId: string;
  }
): Promise<CampaignMatch | null> {
  // Strategy 1: Match by email address
  if (message.fromAddress) {
    const emailMatch = await matchByEmail(message.fromAddress, message.userId);
    if (emailMatch) {
      return { ...emailMatch, matchMethod: 'email', matchConfidence: 0.95 };
    }
  }

  // Strategy 2: Match by phone number (for SMS replies)
  if (message.fromPhone || message.provider === 'sms') {
    const phone = message.fromPhone || extractPhoneFromAddress(message.fromAddress);
    if (phone) {
      const phoneMatch = await matchByPhone(phone, message.userId);
      if (phoneMatch) {
        return { ...phoneMatch, matchMethod: 'phone', matchConfidence: 0.95 };
      }
    }
  }

  // Strategy 3: Match by tracking ID in email headers or body
  const trackingId = extractTrackingId(message.headers, message.bodyText, message.bodyHtml);
  if (trackingId) {
    const trackingMatch = await matchByTrackingId(trackingId);
    if (trackingMatch) {
      return { ...trackingMatch, matchMethod: 'tracking_id', matchConfidence: 0.99 };
    }
  }

  // Strategy 4: Match by In-Reply-To or References headers
  if (message.headers) {
    const inReplyTo = message.headers['in-reply-to'] || message.headers['In-Reply-To'];
    const references = message.headers['references'] || message.headers['References'];

    if (inReplyTo || references) {
      const headerMatch = await matchByEmailHeaders(inReplyTo, references, message.userId);
      if (headerMatch) {
        return { ...headerMatch, matchMethod: 'thread_reference', matchConfidence: 0.92 };
      }
    }
  }

  // Strategy 5: Match by subject line similarity (lower confidence)
  if (message.subject && message.fromAddress) {
    const subjectMatch = await matchBySubject(
      message.subject,
      message.fromAddress,
      message.userId
    );
    if (subjectMatch) {
      return { ...subjectMatch, matchMethod: 'subject', matchConfidence: 0.75 };
    }
  }

  return null;
}

/**
 * Match by email address - find most recent outreach to this email
 */
async function matchByEmail(email: string, userId: string): Promise<Omit<CampaignMatch, 'matchMethod' | 'matchConfidence'> | null> {
  const result = await sql`
    SELECT
      o.id as outreach_id,
      o.campaign_id,
      o.contact_id,
      o.variant_id,
      o.channel,
      o.sent_at,
      o.subject,
      o.body,
      c.name as campaign_name,
      con.email
    FROM coldstart_outreach o
    JOIN coldstart_campaigns c ON o.campaign_id = c.id
    JOIN coldstart_contacts con ON o.contact_id = con.id
    WHERE LOWER(con.email) = LOWER(${email})
      AND o.status IN ('sent', 'delivered', 'opened', 'clicked')
    ORDER BY o.sent_at DESC
    LIMIT 1
  `;

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    outreachId: row.outreach_id,
    contactId: row.contact_id,
    variantId: row.variant_id,
    channel: row.channel,
    originalSentAt: row.sent_at ? new Date(row.sent_at) : undefined,
    originalSubject: row.subject,
    originalBody: row.body,
  };
}

/**
 * Match by phone number - for SMS campaign replies
 */
async function matchByPhone(phone: string, userId: string): Promise<Omit<CampaignMatch, 'matchMethod' | 'matchConfidence'> | null> {
  const normalizedPhone = normalizePhone(phone);

  const result = await sql`
    SELECT
      o.id as outreach_id,
      o.campaign_id,
      o.contact_id,
      o.variant_id,
      o.channel,
      o.sent_at,
      o.subject,
      o.body,
      c.name as campaign_name
    FROM coldstart_outreach o
    JOIN coldstart_campaigns c ON o.campaign_id = c.id
    JOIN coldstart_contacts con ON o.contact_id = con.id
    WHERE con.phone = ${normalizedPhone}
      AND o.channel = 'sms'
      AND o.status IN ('sent', 'delivered', 'opened', 'clicked')
    ORDER BY o.sent_at DESC
    LIMIT 1
  `;

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    outreachId: row.outreach_id,
    contactId: row.contact_id,
    variantId: row.variant_id,
    channel: row.channel,
    originalSentAt: row.sent_at ? new Date(row.sent_at) : undefined,
    originalSubject: row.subject,
    originalBody: row.body,
  };
}

/**
 * Match by tracking ID embedded in email
 */
async function matchByTrackingId(trackingId: string): Promise<Omit<CampaignMatch, 'matchMethod' | 'matchConfidence'> | null> {
  const result = await sql`
    SELECT
      o.id as outreach_id,
      o.campaign_id,
      o.contact_id,
      o.variant_id,
      o.channel,
      o.sent_at,
      o.subject,
      o.body,
      c.name as campaign_name
    FROM coldstart_outreach o
    JOIN coldstart_campaigns c ON o.campaign_id = c.id
    WHERE o.tracking_id = ${trackingId}
    LIMIT 1
  `;

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    outreachId: row.outreach_id,
    contactId: row.contact_id,
    variantId: row.variant_id,
    channel: row.channel,
    originalSentAt: row.sent_at ? new Date(row.sent_at) : undefined,
    originalSubject: row.subject,
    originalBody: row.body,
  };
}

/**
 * Match by email headers (In-Reply-To, References)
 */
async function matchByEmailHeaders(
  inReplyTo: string | undefined,
  references: string | undefined,
  userId: string
): Promise<Omit<CampaignMatch, 'matchMethod' | 'matchConfidence'> | null> {
  // Extract message IDs from headers
  const messageIds = extractMessageIds(inReplyTo, references);

  if (messageIds.length === 0) return null;

  // Look for outreach with matching message_id_header
  const result = await sql.query(
    `SELECT
      o.id as outreach_id,
      o.campaign_id,
      o.contact_id,
      o.variant_id,
      o.channel,
      o.sent_at,
      o.subject,
      o.body,
      c.name as campaign_name
    FROM coldstart_outreach o
    JOIN coldstart_campaigns c ON o.campaign_id = c.id
    WHERE o.message_id_header = ANY($1)
    ORDER BY o.sent_at DESC
    LIMIT 1`,
    [messageIds]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    outreachId: row.outreach_id,
    contactId: row.contact_id,
    variantId: row.variant_id,
    channel: row.channel,
    originalSentAt: row.sent_at ? new Date(row.sent_at) : undefined,
    originalSubject: row.subject,
    originalBody: row.body,
  };
}

/**
 * Match by subject line similarity
 */
async function matchBySubject(
  subject: string,
  fromEmail: string,
  userId: string
): Promise<Omit<CampaignMatch, 'matchMethod' | 'matchConfidence'> | null> {
  // Check for "Re:" prefix indicating a reply
  const isReply = /^(re:|fw:|fwd:)/i.test(subject.trim());

  // Strip reply/forward prefixes for comparison
  const cleanSubject = subject.replace(/^(re:|fw:|fwd:)\s*/gi, '').trim();

  if (!cleanSubject || cleanSubject.length < 5) return null;

  // Find recent outreach to this email with similar subject
  const result = await sql`
    SELECT
      o.id as outreach_id,
      o.campaign_id,
      o.contact_id,
      o.variant_id,
      o.channel,
      o.sent_at,
      o.subject,
      o.body,
      c.name as campaign_name,
      SIMILARITY(LOWER(o.subject), LOWER(${cleanSubject})) as similarity_score
    FROM coldstart_outreach o
    JOIN coldstart_campaigns c ON o.campaign_id = c.id
    JOIN coldstart_contacts con ON o.contact_id = con.id
    WHERE LOWER(con.email) = LOWER(${fromEmail})
      AND o.subject IS NOT NULL
      AND o.status IN ('sent', 'delivered', 'opened', 'clicked')
      AND SIMILARITY(LOWER(o.subject), LOWER(${cleanSubject})) > 0.5
    ORDER BY SIMILARITY(LOWER(o.subject), LOWER(${cleanSubject})) DESC, o.sent_at DESC
    LIMIT 1
  `;

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    outreachId: row.outreach_id,
    contactId: row.contact_id,
    variantId: row.variant_id,
    channel: row.channel,
    originalSentAt: row.sent_at ? new Date(row.sent_at) : undefined,
    originalSubject: row.subject,
    originalBody: row.body,
  };
}

// ============================================================================
// CAMPAIGN LINKING & STATS UPDATE
// ============================================================================

/**
 * Link an inbox thread to a campaign
 */
export async function linkThreadToCampaign(
  threadId: string,
  match: CampaignMatch,
  userId: string
): Promise<LinkResult> {
  try {
    // Update thread with campaign info
    await sql`
      UPDATE inbox_threads
      SET
        campaign_id = ${match.campaignId},
        campaign_outreach_id = ${match.outreachId},
        campaign_contact_id = ${match.contactId},
        campaign_match_method = ${match.matchMethod},
        campaign_match_confidence = ${match.matchConfidence},
        ai_category = 'campaign_reply',
        labels = array_append(array_remove(labels, 'campaign_reply'), 'campaign_reply'),
        updated_at = NOW()
      WHERE id = ${threadId} AND user_id = ${userId}
    `;

    // Update outreach status to 'replied'
    await sql`
      UPDATE coldstart_outreach
      SET
        status = 'replied',
        replied_at = NOW()
      WHERE id = ${match.outreachId}
        AND status IN ('sent', 'delivered', 'opened', 'clicked')
    `;

    // Update campaign reply count
    await sql`
      UPDATE coldstart_campaigns
      SET
        total_replied = total_replied + 1,
        updated_at = NOW()
      WHERE id = ${match.campaignId}
    `;

    // Update variant reply count if applicable
    if (match.variantId) {
      await sql`
        UPDATE coldstart_campaign_variants
        SET replied = COALESCE(replied, 0) + 1
        WHERE id = ${match.variantId}
      `;
    }

    return { linked: true, match };
  } catch (error: any) {
    console.error('Error linking thread to campaign:', error);
    return { linked: false, error: error.message };
  }
}

/**
 * Link an inbox message to a campaign (more granular tracking)
 */
export async function linkMessageToCampaign(
  messageId: string,
  threadId: string,
  match: CampaignMatch,
  userId: string
): Promise<LinkResult> {
  try {
    // Update message with campaign info
    await sql`
      UPDATE inbox_messages_v2
      SET
        campaign_id = ${match.campaignId},
        campaign_outreach_id = ${match.outreachId},
        is_campaign_reply = true
      WHERE id = ${messageId} AND user_id = ${userId}
    `;

    // Also link the thread
    return await linkThreadToCampaign(threadId, match, userId);
  } catch (error: any) {
    console.error('Error linking message to campaign:', error);
    return { linked: false, error: error.message };
  }
}

/**
 * Get campaign context for an inbox thread
 */
export async function getCampaignContext(threadId: string, userId: string): Promise<CampaignContext | null> {
  const threadResult = await sql`
    SELECT campaign_id, campaign_outreach_id, campaign_contact_id
    FROM inbox_threads
    WHERE id = ${threadId} AND user_id = ${userId}
  `;

  if (threadResult.rows.length === 0 || !threadResult.rows[0].campaign_id) {
    return null;
  }

  const thread = threadResult.rows[0];

  // Get campaign details
  const campaignResult = await sql`
    SELECT
      id, name, status,
      total_sent, total_replied,
      CASE WHEN total_sent > 0
        THEN ROUND((total_replied::DECIMAL / total_sent) * 100, 2)
        ELSE 0
      END as reply_rate
    FROM coldstart_campaigns
    WHERE id = ${thread.campaign_id}
  `;

  if (campaignResult.rows.length === 0) return null;
  const campaign = campaignResult.rows[0];

  // Get outreach details
  const outreachResult = await sql`
    SELECT id, channel, sent_at, subject, status, variant_id
    FROM coldstart_outreach
    WHERE id = ${thread.campaign_outreach_id}
  `;

  if (outreachResult.rows.length === 0) return null;
  const outreach = outreachResult.rows[0];

  // Get contact details
  const contactResult = await sql`
    SELECT id, email, phone, full_name, company_name as company
    FROM coldstart_contacts
    WHERE id = ${thread.campaign_contact_id}
  `;

  const contact = contactResult.rows[0] || {};

  // Get variant details if applicable
  let variant = undefined;
  if (outreach.variant_id) {
    const variantResult = await sql`
      SELECT id, name, sent, opened, clicked
      FROM coldstart_campaign_variants
      WHERE id = ${outreach.variant_id}
    `;
    if (variantResult.rows.length > 0) {
      variant = variantResult.rows[0];
    }
  }

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      totalSent: campaign.total_sent,
      totalReplied: campaign.total_replied,
      replyRate: parseFloat(campaign.reply_rate) || 0,
    },
    outreach: {
      id: outreach.id,
      channel: outreach.channel,
      sentAt: new Date(outreach.sent_at),
      subject: outreach.subject,
      status: outreach.status,
    },
    contact: {
      id: contact.id,
      email: contact.email,
      phone: contact.phone,
      fullName: contact.full_name,
      company: contact.company,
    },
    variant,
  };
}

/**
 * Get all campaign replies for a campaign
 */
export async function getCampaignReplies(
  campaignId: string,
  options: {
    limit?: number;
    offset?: number;
    sentiment?: 'positive' | 'negative' | 'neutral';
  } = {}
): Promise<{
  replies: Array<{
    threadId: string;
    subject: string;
    snippet: string;
    fromAddress: string;
    receivedAt: Date;
    aiSentiment?: string;
    contact?: { fullName?: string; company?: string };
  }>;
  total: number;
}> {
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  let query = `
    SELECT
      t.id as thread_id,
      t.subject,
      t.snippet,
      t.ai_sentiment,
      t.last_message_at,
      m.from_address,
      m.received_at,
      c.full_name,
      c.company_name as company
    FROM inbox_threads t
    LEFT JOIN inbox_messages_v2 m ON m.thread_id = t.id AND m.direction = 'inbound'
    LEFT JOIN coldstart_contacts c ON t.campaign_contact_id = c.id::text
    WHERE t.campaign_id = $1
  `;

  const params: any[] = [campaignId];
  let paramIndex = 2;

  if (options.sentiment) {
    query += ` AND t.ai_sentiment = $${paramIndex}`;
    params.push(options.sentiment);
    paramIndex++;
  }

  // Get total count
  const countResult = await sql.query(
    `SELECT COUNT(*) FROM (${query}) as count_query`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Add pagination
  query += ` ORDER BY t.last_message_at DESC`;
  query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await sql.query(query, params);

  return {
    replies: result.rows.map(row => ({
      threadId: row.thread_id,
      subject: row.subject,
      snippet: row.snippet,
      fromAddress: row.from_address,
      receivedAt: new Date(row.received_at || row.last_message_at),
      aiSentiment: row.ai_sentiment,
      contact: row.full_name ? {
        fullName: row.full_name,
        company: row.company,
      } : undefined,
    })),
    total,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

function extractPhoneFromAddress(address?: string): string | null {
  if (!address) return null;
  const phoneMatch = address.match(/\+?[\d\s\-\(\)]{10,}/);
  return phoneMatch ? phoneMatch[0] : null;
}

function extractTrackingId(
  headers?: Record<string, string>,
  bodyText?: string,
  bodyHtml?: string
): string | null {
  // Check custom header
  if (headers?.['x-tracking-id'] || headers?.['X-Tracking-Id']) {
    return headers['x-tracking-id'] || headers['X-Tracking-Id'];
  }

  // Check for tracking pixel or link in body
  const body = bodyHtml || bodyText || '';
  const trackingMatch = body.match(/[?&]t=([a-f0-9]{32})/i);
  if (trackingMatch) {
    return trackingMatch[1];
  }

  return null;
}

function extractMessageIds(inReplyTo?: string, references?: string): string[] {
  const ids: string[] = [];

  if (inReplyTo) {
    const match = inReplyTo.match(/<([^>]+)>/g);
    if (match) {
      ids.push(...match.map(m => m.slice(1, -1)));
    }
  }

  if (references) {
    const matches = references.match(/<([^>]+)>/g);
    if (matches) {
      ids.push(...matches.map(m => m.slice(1, -1)));
    }
  }

  return Array.from(new Set(ids));
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const campaignLinker = {
  detectCampaignReply,
  linkThreadToCampaign,
  linkMessageToCampaign,
  getCampaignContext,
  getCampaignReplies,
};
