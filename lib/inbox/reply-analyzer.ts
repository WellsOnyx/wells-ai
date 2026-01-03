/**
 * Reply Analyzer Service
 *
 * AI-powered analysis of campaign replies using Anthropic Claude.
 * Analyzes sentiment, intent, buying signals, and generates response suggestions.
 */

import Anthropic from '@anthropic-ai/sdk';
import { sql } from '@vercel/postgres';
import { CampaignReplyMatch } from './reply-matcher';

// =====================================================
// TYPES
// =====================================================

export type Sentiment = 'positive' | 'negative' | 'neutral';

export type ReplyIntent =
  | 'interested'
  | 'not_interested'
  | 'meeting_request'
  | 'question'
  | 'forward_request'
  | 'unsubscribe'
  | 'out_of_office'
  | 'do_not_contact'
  | 'pricing_inquiry'
  | 'competitor_mention'
  | 'timing_issue'
  | 'unclear';

export interface BuyingSignal {
  signal: string;
  strength: 'strong' | 'medium' | 'weak';
  quote?: string;
}

export interface Objection {
  objection: string;
  type: 'budget' | 'timing' | 'authority' | 'need' | 'competitor' | 'trust' | 'other';
  quote?: string;
}

export interface ReplyAnalysis {
  // Core sentiment
  sentiment: Sentiment;
  sentimentScore: number; // -1 to 1

  // Intent classification
  intent: ReplyIntent;
  intentConfidence: number; // 0 to 1

  // Buying signals and objections
  buyingSignals: BuyingSignal[];
  objections: Objection[];

  // Key phrases
  keyPhrases: string[];

  // Response suggestion
  suggestedResponse: string;

  // Hot lead scoring
  isHotLead: boolean;
  leadScore: number; // 0 to 100
  leadScoreReasons: string[];

  // Additional metadata
  metadata: {
    hasMeetingRequest: boolean;
    hasQuestion: boolean;
    mentionsCompetitor: boolean;
    mentionsTimeline: boolean;
    mentionsBudget: boolean;
    isAutoReply: boolean;
    language: string;
  };
}

export interface AnalysisContext {
  originalSubject?: string;
  originalBody?: string;
  contactName?: string;
  companyName?: string;
  contactTitle?: string;
  campaignName?: string;
  previousReplies?: string[];
}

// =====================================================
// REPLY ANALYZER SERVICE
// =====================================================

export class ReplyAnalyzerService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Analyze a reply using Claude AI
   */
  async analyzeReply(
    replyBody: string,
    replySubject?: string,
    context?: AnalysisContext
  ): Promise<ReplyAnalysis> {
    // Build context for Claude
    const contextInfo = context
      ? `
CONTEXT:
- Contact: ${context.contactName || 'Unknown'} ${context.contactTitle ? `(${context.contactTitle})` : ''} at ${context.companyName || 'Unknown Company'}
- Campaign: ${context.campaignName || 'Unknown Campaign'}
- Original Subject: ${context.originalSubject || 'N/A'}
- Original Message: ${context.originalBody ? context.originalBody.slice(0, 500) : 'N/A'}
${context.previousReplies ? `- Previous Replies: ${context.previousReplies.length} exchanges` : ''}
`
      : '';

    const prompt = `Analyze this reply to a cold outreach email/message. Provide structured analysis.

${contextInfo}
REPLY SUBJECT: ${replySubject || '(no subject)'}

REPLY BODY:
${replyBody}

Analyze and respond with JSON in this exact format:
{
  "sentiment": "positive" | "negative" | "neutral",
  "sentimentScore": <number from -1 to 1>,
  "intent": "interested" | "not_interested" | "meeting_request" | "question" | "forward_request" | "unsubscribe" | "out_of_office" | "do_not_contact" | "pricing_inquiry" | "competitor_mention" | "timing_issue" | "unclear",
  "intentConfidence": <number from 0 to 1>,
  "buyingSignals": [
    {"signal": "<description>", "strength": "strong" | "medium" | "weak", "quote": "<exact quote from message>"}
  ],
  "objections": [
    {"objection": "<description>", "type": "budget" | "timing" | "authority" | "need" | "competitor" | "trust" | "other", "quote": "<exact quote>"}
  ],
  "keyPhrases": ["<important phrases extracted>"],
  "suggestedResponse": "<brief 2-3 sentence suggested reply>",
  "isHotLead": <boolean - true if shows genuine interest and should be contacted immediately>,
  "leadScore": <number 0-100>,
  "leadScoreReasons": ["<reasons for the score>"],
  "metadata": {
    "hasMeetingRequest": <boolean>,
    "hasQuestion": <boolean>,
    "mentionsCompetitor": <boolean>,
    "mentionsTimeline": <boolean>,
    "mentionsBudget": <boolean>,
    "isAutoReply": <boolean>,
    "language": "<detected language>"
  }
}

Key scoring guidelines:
- Hot lead (score 80-100): Expresses genuine interest, requests meeting/call, asks specific questions, mentions budget/timeline
- Warm lead (score 50-79): Shows interest but has objections, asks general questions, needs nurturing
- Cold lead (score 20-49): Politely declines, timing issues, refers elsewhere
- Dead lead (score 0-19): Hard no, unsubscribe, do not contact, out of office

Auto-reply detection: Out of office messages, vacation autoreplies, or "I am away" messages should have isAutoReply: true and intent: "out_of_office"`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from Claude response');
    }

    const analysis = JSON.parse(jsonMatch[0]) as ReplyAnalysis;

    return analysis;
  }

  /**
   * Analyze a reply match and update the database
   */
  async analyzeAndStore(match: CampaignReplyMatch): Promise<ReplyAnalysis> {
    // Get context from campaign and original message
    const context = await this.getAnalysisContext(match);

    // Run analysis
    const analysis = await this.analyzeReply(
      match.replyBody,
      match.replySubject,
      context
    );

    // Store analysis results
    await this.storeAnalysis(match.id, analysis);

    return analysis;
  }

  /**
   * Batch analyze multiple pending replies
   */
  async analyzePendingReplies(limit = 10): Promise<{
    analyzed: number;
    hotLeads: number;
    errors: number;
  }> {
    // Get pending matches
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
        reply_received_at
      FROM campaign_reply_matches
      WHERE status = 'pending'
      ORDER BY reply_received_at ASC
      LIMIT ${limit}
    `;

    let analyzed = 0;
    let hotLeads = 0;
    let errors = 0;

    for (const row of result.rows) {
      try {
        const match: CampaignReplyMatch = {
          id: row.id,
          inboxMessageId: row.inbox_message_id,
          inboxThreadId: row.inbox_thread_id,
          campaignId: row.campaign_id,
          variantId: row.variant_id,
          originalMessageId: row.original_message_id,
          contactId: row.contact_id,
          matchMethod: row.match_method,
          matchConfidence: parseFloat(row.match_confidence),
          channel: row.channel,
          replyFrom: row.reply_from,
          replySubject: row.reply_subject,
          replyBody: row.reply_body,
          replyReceivedAt: new Date(row.reply_received_at),
          status: 'pending',
        };

        const analysis = await this.analyzeAndStore(match);
        analyzed++;

        if (analysis.isHotLead) {
          hotLeads++;
        }
      } catch (error) {
        console.error(`Error analyzing reply ${row.id}:`, error);
        errors++;
      }
    }

    return { analyzed, hotLeads, errors };
  }

  /**
   * Get context for analysis from database
   */
  private async getAnalysisContext(match: CampaignReplyMatch): Promise<AnalysisContext> {
    const context: AnalysisContext = {};

    // Get contact info
    if (match.contactId) {
      const contactResult = await sql`
        SELECT first_name, last_name, company_name, title
        FROM outreach_contacts
        WHERE id = ${match.contactId}
      `;
      if (contactResult.rows.length > 0) {
        const contact = contactResult.rows[0];
        context.contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
        context.companyName = contact.company_name;
        context.contactTitle = contact.title;
      }
    }

    // Get original message
    if (match.originalMessageId) {
      const messageResult = await sql`
        SELECT subject, body
        FROM outreach_messages
        WHERE id = ${match.originalMessageId}
      `;
      if (messageResult.rows.length > 0) {
        const message = messageResult.rows[0];
        context.originalSubject = message.subject;
        context.originalBody = message.body;
      }
    }

    // Get campaign info
    if (match.campaignId) {
      const campaignResult = await sql`
        SELECT name
        FROM outreach_campaigns
        WHERE id = ${match.campaignId}
      `;
      if (campaignResult.rows.length > 0) {
        context.campaignName = campaignResult.rows[0].name;
      }
    }

    return context;
  }

  /**
   * Store analysis results in database
   */
  private async storeAnalysis(matchId: string, analysis: ReplyAnalysis): Promise<void> {
    // Use sql.query for array support
    await sql.query(
      `UPDATE campaign_reply_matches
       SET
         sentiment = $1,
         sentiment_score = $2,
         intent = $3,
         intent_confidence = $4,
         buying_signals = $5,
         objections = $6,
         key_phrases = $7,
         suggested_response = $8,
         is_hot_lead = $9,
         lead_score = $10,
         lead_score_reasons = $11,
         analysis_metadata = $12,
         analyzed_at = NOW(),
         status = 'analyzed',
         updated_at = NOW()
       WHERE id = $13`,
      [
        analysis.sentiment,
        analysis.sentimentScore,
        analysis.intent,
        analysis.intentConfidence,
        JSON.stringify(analysis.buyingSignals),
        JSON.stringify(analysis.objections),
        analysis.keyPhrases,
        analysis.suggestedResponse,
        analysis.isHotLead,
        analysis.leadScore,
        JSON.stringify(analysis.leadScoreReasons),
        JSON.stringify(analysis.metadata),
        matchId,
      ]
    );

    // Update contact status if hot lead
    if (analysis.isHotLead) {
      const matchResult = await sql`
        SELECT contact_id FROM campaign_reply_matches WHERE id = ${matchId}
      `;
      if (matchResult.rows.length > 0 && matchResult.rows[0].contact_id) {
        await sql`
          UPDATE outreach_contacts
          SET
            status = 'responded',
            last_response_at = NOW(),
            updated_at = NOW()
          WHERE id = ${matchResult.rows[0].contact_id}
        `;
      }
    }
  }

  /**
   * Get analysis for a reply match
   */
  async getAnalysis(matchId: string): Promise<ReplyAnalysis | null> {
    const result = await sql`
      SELECT
        sentiment,
        sentiment_score,
        intent,
        intent_confidence,
        buying_signals,
        objections,
        key_phrases,
        suggested_response,
        is_hot_lead,
        lead_score,
        lead_score_reasons,
        analysis_metadata
      FROM campaign_reply_matches
      WHERE id = ${matchId}
        AND status != 'pending'
    `;

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      sentiment: row.sentiment as Sentiment,
      sentimentScore: parseFloat(row.sentiment_score || '0'),
      intent: row.intent as ReplyIntent,
      intentConfidence: parseFloat(row.intent_confidence || '0'),
      buyingSignals: row.buying_signals || [],
      objections: row.objections || [],
      keyPhrases: row.key_phrases || [],
      suggestedResponse: row.suggested_response || '',
      isHotLead: row.is_hot_lead || false,
      leadScore: row.lead_score || 0,
      leadScoreReasons: row.lead_score_reasons || [],
      metadata: row.analysis_metadata || {},
    };
  }

  /**
   * Quick sentiment check (faster, less detailed)
   */
  async quickSentimentCheck(text: string): Promise<{ sentiment: Sentiment; score: number }> {
    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Analyze the sentiment of this message. Respond with JSON: {"sentiment": "positive"|"negative"|"neutral", "score": <number from -1 to 1>}

Message: ${text.slice(0, 500)}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return { sentiment: 'neutral', score: 0 };
    }

    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          sentiment: result.sentiment || 'neutral',
          score: result.score || 0,
        };
      }
    } catch (e) {
      // Fall back to neutral
    }

    return { sentiment: 'neutral', score: 0 };
  }

  /**
   * Detect if message is an auto-reply
   */
  isAutoReply(subject?: string, body?: string): boolean {
    const autoReplyPatterns = [
      /out of office/i,
      /automatic reply/i,
      /auto-?reply/i,
      /away from (my )?desk/i,
      /on vacation/i,
      /on leave/i,
      /on holiday/i,
      /will return/i,
      /limited access/i,
      /i am currently (away|out|unavailable)/i,
      /thank you for your email.*respond/i,
      /your message has been received/i,
    ];

    const textToCheck = `${subject || ''} ${body || ''}`;

    return autoReplyPatterns.some(pattern => pattern.test(textToCheck));
  }
}

// Export singleton instance
export const replyAnalyzer = new ReplyAnalyzerService();
