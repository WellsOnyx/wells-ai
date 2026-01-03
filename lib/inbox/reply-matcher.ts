/**
 * Reply Matcher Service
 *
 * Matches incoming messages to cold-start outreach campaigns.
 * Supports multiple matching strategies:
 * 1. Email: In-Reply-To header, References header, subject line matching
 * 2. SMS: Phone number + recent outreach window
 * 3. LinkedIn: Thread ID matching
 * 4. AI inference: When headers fail, use content analysis
 */

import { sql } from '@vercel/postgres';

// =====================================================
// TYPES
// =====================================================

export type MatchMethod =
  | 'in_reply_to'
  | 'references'
  | 'subject'
  | 'phone_number'
  | 'email_thread'
  | 'linkedin_thread'
  | 'ai_inference';

export type ReplyChannel = 'email' | 'sms' | 'linkedin' | 'whatsapp' | 'twitter';

export interface IncomingMessage {
  id: string;
  threadId?: string;
  channel: ReplyChannel;
  fromAddress: string; // email, phone, or handle
  toAddress?: string;
  subject?: string;
  body: string;
  bodyHtml?: string;
  receivedAt: Date;

  // Email-specific headers
  inReplyTo?: string;
  references?: string[];
  messageId?: string;

  // Provider info
  provider?: string;
  externalId?: string;
}

export interface MatchResult {
  matched: boolean;
  confidence: number;
  method: MatchMethod;
  campaignId?: string;
  variantId?: string;
  originalMessageId?: string;
  contactId?: string;
  metadata?: Record<string, any>;
}

export interface CampaignReplyMatch {
  id: string;
  inboxMessageId: string;
  inboxThreadId?: string;
  campaignId?: string;
  variantId?: string;
  originalMessageId?: string;
  contactId?: string;
  matchMethod: MatchMethod;
  matchConfidence: number;
  channel: ReplyChannel;
  replyFrom: string;
  replySubject?: string;
  replyBody: string;
  replyReceivedAt: Date;
  status: 'pending' | 'analyzed' | 'notified' | 'actioned' | 'dismissed';
}

// =====================================================
// REPLY MATCHER SERVICE
// =====================================================

export class ReplyMatcherService {
  // Default reply window for SMS (48 hours)
  private readonly SMS_REPLY_WINDOW_HOURS = 48;

  // Subject line normalization patterns
  private readonly SUBJECT_PREFIXES = /^(re:|fwd:|fw:|\[.*?\])\s*/gi;

  /**
   * Match an incoming message to a campaign outreach
   */
  async matchReply(message: IncomingMessage): Promise<MatchResult> {
    // Try matching strategies in order of confidence
    let result: MatchResult;

    switch (message.channel) {
      case 'email':
        result = await this.matchEmailReply(message);
        break;
      case 'sms':
        result = await this.matchSmsReply(message);
        break;
      case 'linkedin':
        result = await this.matchLinkedInReply(message);
        break;
      default:
        result = { matched: false, confidence: 0, method: 'ai_inference' };
    }

    // If we found a match, store it
    if (result.matched && result.campaignId) {
      await this.storeMatch(message, result);
    }

    return result;
  }

  /**
   * Match email reply using headers and subject
   */
  private async matchEmailReply(message: IncomingMessage): Promise<MatchResult> {
    // Strategy 1: In-Reply-To header (highest confidence)
    if (message.inReplyTo) {
      const match = await this.matchByInReplyTo(message.inReplyTo);
      if (match.matched) {
        return { ...match, method: 'in_reply_to', confidence: 1.0 };
      }
    }

    // Strategy 2: References header
    if (message.references && message.references.length > 0) {
      const match = await this.matchByReferences(message.references);
      if (match.matched) {
        return { ...match, method: 'references', confidence: 0.95 };
      }
    }

    // Strategy 3: Subject line matching
    if (message.subject) {
      const match = await this.matchBySubject(message.subject, message.fromAddress);
      if (match.matched) {
        return { ...match, method: 'subject', confidence: 0.8 };
      }
    }

    // Strategy 4: Email address + recent outreach
    const match = await this.matchByEmailAddress(message.fromAddress);
    if (match.matched) {
      return { ...match, method: 'email_thread', confidence: 0.7 };
    }

    return { matched: false, confidence: 0, method: 'ai_inference' };
  }

  /**
   * Match SMS reply by phone number
   */
  private async matchSmsReply(message: IncomingMessage): Promise<MatchResult> {
    const normalizedPhone = this.normalizePhoneNumber(message.fromAddress);

    // Look for recent outreach to this phone number
    const result = await sql`
      SELECT
        sol.id,
        sol.campaign_id,
        sol.variant_id,
        sol.contact_id,
        sol.message_id,
        sol.sent_at,
        oc.first_name,
        oc.last_name,
        oc.company_name
      FROM sms_outreach_log sol
      LEFT JOIN outreach_contacts oc ON sol.contact_id = oc.id
      WHERE sol.to_phone_normalized = ${normalizedPhone}
        AND (sol.reply_window_expires_at IS NULL OR sol.reply_window_expires_at > NOW())
      ORDER BY sol.sent_at DESC
      LIMIT 1
    `;

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        matched: true,
        confidence: 0.95,
        method: 'phone_number',
        campaignId: row.campaign_id,
        variantId: row.variant_id,
        originalMessageId: row.message_id,
        contactId: row.contact_id,
        metadata: {
          contactName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
          companyName: row.company_name,
          originalSentAt: row.sent_at,
        },
      };
    }

    return { matched: false, confidence: 0, method: 'phone_number' };
  }

  /**
   * Match LinkedIn reply by thread
   */
  private async matchLinkedInReply(message: IncomingMessage): Promise<MatchResult> {
    // LinkedIn messages come with thread IDs
    if (message.threadId) {
      const result = await sql`
        SELECT
          om.id as message_id,
          om.campaign_id,
          om.variant_id,
          om.contact_id,
          oc.first_name,
          oc.last_name,
          oc.company_name,
          oc.linkedin_url
        FROM outreach_messages om
        LEFT JOIN campaign_contacts cc ON cc.message_id = om.id
        LEFT JOIN outreach_contacts oc ON om.contact_id = oc.id
        WHERE om.provider_message_id = ${message.threadId}
          OR om.subject = ${message.threadId}
        ORDER BY om.sent_at DESC
        LIMIT 1
      `;

      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          matched: true,
          confidence: 0.9,
          method: 'linkedin_thread',
          campaignId: row.campaign_id,
          variantId: row.variant_id,
          originalMessageId: row.message_id,
          contactId: row.contact_id,
          metadata: {
            contactName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
            companyName: row.company_name,
            linkedinUrl: row.linkedin_url,
          },
        };
      }
    }

    return { matched: false, confidence: 0, method: 'linkedin_thread' };
  }

  /**
   * Match by In-Reply-To header
   */
  private async matchByInReplyTo(inReplyTo: string): Promise<MatchResult> {
    const result = await sql`
      SELECT
        om.id as message_id,
        cc.campaign_id,
        om.variant_id,
        om.contact_id,
        oc.first_name,
        oc.last_name,
        oc.company_name,
        oc.email
      FROM outreach_messages om
      LEFT JOIN campaign_contacts cc ON cc.message_id = om.id
      LEFT JOIN outreach_contacts oc ON om.contact_id = oc.id
      WHERE om.message_id_header = ${inReplyTo}
         OR om.provider_message_id = ${inReplyTo}
      LIMIT 1
    `;

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        matched: true,
        confidence: 1.0,
        method: 'in_reply_to',
        campaignId: row.campaign_id,
        variantId: row.variant_id,
        originalMessageId: row.message_id,
        contactId: row.contact_id,
        metadata: {
          contactName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
          companyName: row.company_name,
          email: row.email,
        },
      };
    }

    return { matched: false, confidence: 0, method: 'in_reply_to' };
  }

  /**
   * Match by References header chain
   */
  private async matchByReferences(references: string[]): Promise<MatchResult> {
    // Check each reference ID
    for (const ref of references) {
      const result = await sql`
        SELECT
          om.id as message_id,
          cc.campaign_id,
          om.variant_id,
          om.contact_id,
          oc.first_name,
          oc.last_name,
          oc.company_name
        FROM outreach_messages om
        LEFT JOIN campaign_contacts cc ON cc.message_id = om.id
        LEFT JOIN outreach_contacts oc ON om.contact_id = oc.id
        WHERE om.message_id_header = ${ref}
           OR om.provider_message_id = ${ref}
           OR ${ref} = ANY(om.references_header)
        LIMIT 1
      `;

      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          matched: true,
          confidence: 0.95,
          method: 'references',
          campaignId: row.campaign_id,
          variantId: row.variant_id,
          originalMessageId: row.message_id,
          contactId: row.contact_id,
          metadata: {
            matchedReference: ref,
            contactName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
            companyName: row.company_name,
          },
        };
      }
    }

    return { matched: false, confidence: 0, method: 'references' };
  }

  /**
   * Match by normalized subject line
   */
  private async matchBySubject(subject: string, fromEmail: string): Promise<MatchResult> {
    const normalizedSubject = this.normalizeSubject(subject);

    // Find outreach with matching subject to this email
    const result = await sql`
      SELECT
        om.id as message_id,
        cc.campaign_id,
        om.variant_id,
        om.contact_id,
        om.subject as original_subject,
        oc.first_name,
        oc.last_name,
        oc.company_name
      FROM outreach_messages om
      LEFT JOIN campaign_contacts cc ON cc.message_id = om.id
      LEFT JOIN outreach_contacts oc ON om.contact_id = oc.id
      WHERE oc.email = ${fromEmail.toLowerCase()}
        AND om.sent_at > NOW() - INTERVAL '30 days'
      ORDER BY om.sent_at DESC
      LIMIT 10
    `;

    // Check for subject match
    for (const row of result.rows) {
      const originalNormalized = this.normalizeSubject(row.original_subject || '');
      if (this.subjectsMatch(normalizedSubject, originalNormalized)) {
        return {
          matched: true,
          confidence: 0.8,
          method: 'subject',
          campaignId: row.campaign_id,
          variantId: row.variant_id,
          originalMessageId: row.message_id,
          contactId: row.contact_id,
          metadata: {
            originalSubject: row.original_subject,
            matchedSubject: subject,
            contactName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
            companyName: row.company_name,
          },
        };
      }
    }

    return { matched: false, confidence: 0, method: 'subject' };
  }

  /**
   * Match by email address with recent outreach
   */
  private async matchByEmailAddress(email: string): Promise<MatchResult> {
    const result = await sql`
      SELECT
        om.id as message_id,
        cc.campaign_id,
        om.variant_id,
        om.contact_id,
        om.subject,
        om.sent_at,
        oc.first_name,
        oc.last_name,
        oc.company_name
      FROM outreach_messages om
      LEFT JOIN campaign_contacts cc ON cc.message_id = om.id
      LEFT JOIN outreach_contacts oc ON om.contact_id = oc.id
      WHERE oc.email = ${email.toLowerCase()}
        AND om.sent_at > NOW() - INTERVAL '14 days'
        AND om.status = 'sent'
      ORDER BY om.sent_at DESC
      LIMIT 1
    `;

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        matched: true,
        confidence: 0.7,
        method: 'email_thread',
        campaignId: row.campaign_id,
        variantId: row.variant_id,
        originalMessageId: row.message_id,
        contactId: row.contact_id,
        metadata: {
          originalSubject: row.subject,
          originalSentAt: row.sent_at,
          contactName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
          companyName: row.company_name,
        },
      };
    }

    return { matched: false, confidence: 0, method: 'email_thread' };
  }

  /**
   * Store a matched reply in the database
   */
  private async storeMatch(
    message: IncomingMessage,
    result: MatchResult
  ): Promise<string> {
    const insertResult = await sql`
      INSERT INTO campaign_reply_matches (
        inbox_message_id,
        inbox_thread_id,
        campaign_id,
        variant_id,
        original_message_id,
        contact_id,
        match_method,
        match_confidence,
        match_metadata,
        channel,
        reply_from,
        reply_subject,
        reply_body,
        reply_received_at,
        status
      ) VALUES (
        ${message.id},
        ${message.threadId || null},
        ${result.campaignId || null},
        ${result.variantId || null},
        ${result.originalMessageId || null},
        ${result.contactId || null},
        ${result.method},
        ${result.confidence},
        ${JSON.stringify(result.metadata || {})},
        ${message.channel},
        ${message.fromAddress},
        ${message.subject || null},
        ${message.body},
        ${message.receivedAt.toISOString()},
        'pending'
      )
      RETURNING id
    `;

    const matchId = insertResult.rows[0].id;

    // Update inbox message with campaign reply info
    await sql`
      UPDATE inbox_messages
      SET
        is_campaign_reply = true,
        campaign_reply_match_id = ${matchId}
      WHERE id = ${message.id}
    `;

    return matchId;
  }

  /**
   * Get all pending reply matches for analysis
   */
  async getPendingMatches(limit = 50): Promise<CampaignReplyMatch[]> {
    const result = await sql`
      SELECT
        id,
        inbox_message_id,
        inbox_thread_id,
        campaign_id,
        variant_id,
        original_message_id,
        contact_id,
        match_method,
        match_confidence,
        channel,
        reply_from,
        reply_subject,
        reply_body,
        reply_received_at,
        status
      FROM campaign_reply_matches
      WHERE status = 'pending'
      ORDER BY reply_received_at ASC
      LIMIT ${limit}
    `;

    return result.rows.map(row => ({
      id: row.id,
      inboxMessageId: row.inbox_message_id,
      inboxThreadId: row.inbox_thread_id,
      campaignId: row.campaign_id,
      variantId: row.variant_id,
      originalMessageId: row.original_message_id,
      contactId: row.contact_id,
      matchMethod: row.match_method as MatchMethod,
      matchConfidence: parseFloat(row.match_confidence),
      channel: row.channel as ReplyChannel,
      replyFrom: row.reply_from,
      replySubject: row.reply_subject,
      replyBody: row.reply_body,
      replyReceivedAt: new Date(row.reply_received_at),
      status: row.status,
    }));
  }

  /**
   * Get match by ID
   */
  async getMatch(matchId: string): Promise<CampaignReplyMatch | null> {
    const result = await sql`
      SELECT
        id,
        inbox_message_id,
        inbox_thread_id,
        campaign_id,
        variant_id,
        original_message_id,
        contact_id,
        match_method,
        match_confidence,
        channel,
        reply_from,
        reply_subject,
        reply_body,
        reply_received_at,
        status
      FROM campaign_reply_matches
      WHERE id = ${matchId}
    `;

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      inboxMessageId: row.inbox_message_id,
      inboxThreadId: row.inbox_thread_id,
      campaignId: row.campaign_id,
      variantId: row.variant_id,
      originalMessageId: row.original_message_id,
      contactId: row.contact_id,
      matchMethod: row.match_method as MatchMethod,
      matchConfidence: parseFloat(row.match_confidence),
      channel: row.channel as ReplyChannel,
      replyFrom: row.reply_from,
      replySubject: row.reply_subject,
      replyBody: row.reply_body,
      replyReceivedAt: new Date(row.reply_received_at),
      status: row.status,
    };
  }

  /**
   * Log an SMS outreach for later reply matching
   */
  async logSmsOutreach(params: {
    userId: string;
    campaignId?: string;
    variantId?: string;
    contactId?: string;
    messageId?: string;
    fromPhone: string;
    toPhone: string;
    body: string;
    providerMessageId?: string;
    replyWindowHours?: number;
  }): Promise<string> {
    const normalizedPhone = this.normalizePhoneNumber(params.toPhone);
    const replyWindowHours = params.replyWindowHours || this.SMS_REPLY_WINDOW_HOURS;

    const result = await sql`
      INSERT INTO sms_outreach_log (
        user_id,
        campaign_id,
        variant_id,
        contact_id,
        message_id,
        from_phone,
        to_phone,
        to_phone_normalized,
        body,
        provider_message_id,
        reply_window_expires_at
      ) VALUES (
        ${params.userId},
        ${params.campaignId || null},
        ${params.variantId || null},
        ${params.contactId || null},
        ${params.messageId || null},
        ${params.fromPhone},
        ${params.toPhone},
        ${normalizedPhone},
        ${params.body},
        ${params.providerMessageId || null},
        NOW() + INTERVAL '${replyWindowHours} hours'
      )
      RETURNING id
    `;

    return result.rows[0].id;
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Normalize phone number to E.164 format
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let digits = phone.replace(/\D/g, '');

    // Handle US numbers
    if (digits.length === 10) {
      digits = '1' + digits;
    }

    // Add + prefix
    return '+' + digits;
  }

  /**
   * Normalize subject line for comparison
   */
  private normalizeSubject(subject: string): string {
    return subject
      .toLowerCase()
      .replace(this.SUBJECT_PREFIXES, '')
      .trim();
  }

  /**
   * Check if two subjects match (allowing for variations)
   */
  private subjectsMatch(subject1: string, subject2: string): boolean {
    // Exact match
    if (subject1 === subject2) return true;

    // One contains the other
    if (subject1.includes(subject2) || subject2.includes(subject1)) return true;

    // Levenshtein distance for fuzzy matching
    const distance = this.levenshteinDistance(subject1, subject2);
    const maxLength = Math.max(subject1.length, subject2.length);
    const similarity = 1 - distance / maxLength;

    return similarity > 0.8;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}

// Export singleton instance
export const replyMatcher = new ReplyMatcherService();
