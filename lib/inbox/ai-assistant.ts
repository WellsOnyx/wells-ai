/**
 * AI Assistant for Unified Inbox
 * ================================
 * Claude-powered AI features for the inbox:
 * - Smart categorization (leads, replies, spam, important)
 * - AI-generated reply suggestions
 * - Campaign reply matching
 * - Priority scoring
 * - Sentiment analysis
 * - Action item extraction
 *
 * Designed for speed - async processing that doesn't block UI
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '@/lib/db';
import {
  UnifiedMessage,
  UnifiedThread,
  AICategory,
  AIPriority,
  AISentiment,
  AIEntity,
  ActionItem,
  getThread,
  updateMessageAIAnalysis,
} from './unified-inbox';

// =====================================================
// ANTHROPIC CLIENT
// =====================================================

const anthropic = new Anthropic();

// Use efficient model for bulk operations
const FAST_MODEL = 'claude-3-5-haiku-20241022';
const SMART_MODEL = 'claude-sonnet-4-20250514';

// =====================================================
// TYPES
// =====================================================

export interface AIAnalysisResult {
  category: AICategory;
  priority: AIPriority;
  sentiment: AISentiment;
  summary?: string;
  suggestedReply?: string;
  entities?: AIEntity[];
  actionItems?: ActionItem[];
  isCampaignReply?: boolean;
  campaignId?: string;
  confidence: number;
}

export interface ReplyTone {
  name: string;
  description: string;
  systemPrompt: string;
}

export const REPLY_TONES: Record<string, ReplyTone> = {
  professional: {
    name: 'Professional',
    description: 'Formal and business-appropriate',
    systemPrompt: 'Write in a professional, business-appropriate tone. Be clear and concise.',
  },
  friendly: {
    name: 'Friendly',
    description: 'Warm and approachable',
    systemPrompt: 'Write in a warm, friendly tone while remaining professional. Be personable.',
  },
  casual: {
    name: 'Casual',
    description: 'Relaxed and conversational',
    systemPrompt: 'Write in a casual, conversational tone. Be natural and relaxed.',
  },
  formal: {
    name: 'Formal',
    description: 'Very formal and structured',
    systemPrompt: 'Write in a very formal, structured tone. Use proper business language.',
  },
  empathetic: {
    name: 'Empathetic',
    description: 'Understanding and supportive',
    systemPrompt: 'Write with empathy and understanding. Show that you care about their situation.',
  },
  assertive: {
    name: 'Assertive',
    description: 'Direct and confident',
    systemPrompt: 'Write in a direct, confident tone. Be clear about your position while remaining respectful.',
  },
};

// =====================================================
// MESSAGE CATEGORIZATION
// =====================================================

/**
 * Categorize a message using AI
 */
export async function categorizeMessage(
  message: UnifiedMessage,
  userId: string
): Promise<AIAnalysisResult> {
  const prompt = `Analyze this ${message.channel} message and categorize it.

From: ${message.from.name || message.from.address}
Subject: ${message.subject || 'N/A'}
Body:
${message.bodyText?.substring(0, 2000) || message.snippet || '(empty)'}

Categorize this message into one of these categories:
- lead: A potential sales lead or business opportunity
- reply: A reply to a previous conversation
- spam: Unwanted or promotional content
- important: Urgent or important business matter
- newsletter: Marketing newsletters or subscriptions
- transactional: Order confirmations, receipts, notifications
- campaign_reply: Reply to a cold outreach campaign
- personal: Personal correspondence
- support: Customer support request
- sales: Sales pitch from someone trying to sell to you

Also determine:
- Priority: urgent, high, normal, low
- Sentiment: positive, neutral, negative, urgent

Return JSON only:
{
  "category": "...",
  "priority": "...",
  "sentiment": "...",
  "summary": "One sentence summary",
  "confidence": 0.0-1.0
}`;

  try {
    const response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const result = JSON.parse(text);

    // Check for campaign reply match
    const campaignMatch = await matchToCampaign(message, userId);

    return {
      category: campaignMatch ? 'campaign_reply' : result.category,
      priority: result.priority || 'normal',
      sentiment: result.sentiment || 'neutral',
      summary: result.summary,
      confidence: result.confidence || 0.7,
      isCampaignReply: !!campaignMatch,
      campaignId: campaignMatch?.campaignId,
    };
  } catch (error) {
    console.error('[AIAssistant] Categorization error:', error);
    return {
      category: 'personal',
      priority: 'normal',
      sentiment: 'neutral',
      confidence: 0,
    };
  }
}

/**
 * Batch categorize multiple messages
 */
export async function batchCategorizeMessages(
  messages: UnifiedMessage[],
  userId: string
): Promise<Map<string, AIAnalysisResult>> {
  const results = new Map<string, AIAnalysisResult>();

  // Process in chunks to avoid rate limits
  const chunkSize = 10;
  for (let i = 0; i < messages.length; i += chunkSize) {
    const chunk = messages.slice(i, i + chunkSize);

    const promises = chunk.map(async (message) => {
      try {
        const result = await categorizeMessage(message, userId);
        results.set(message.id, result);

        // Update database
        await updateMessageAIAnalysis(message.id, userId, {
          category: result.category,
          priority: result.priority,
          sentiment: result.sentiment,
          summary: result.summary,
        });
      } catch (error) {
        console.error(`[AIAssistant] Error categorizing message ${message.id}:`, error);
      }
    });

    await Promise.all(promises);
  }

  return results;
}

// =====================================================
// CAMPAIGN REPLY MATCHING
// =====================================================

/**
 * Match a message to an outreach campaign
 */
async function matchToCampaign(
  message: UnifiedMessage,
  userId: string
): Promise<{ campaignId: string; messageId: string; confidence: number } | null> {
  if (message.direction !== 'inbound') {
    return null;
  }

  const fromAddress = message.from.address.toLowerCase();

  // Check if we've sent outreach to this person
  const outreachResult = await query(
    `SELECT om.id as message_id, om.campaign_id, om.subject, oc.email
     FROM outreach_messages om
     JOIN outreach_contacts oc ON om.contact_id = oc.id
     WHERE om.user_id = $1
     AND om.status = 'sent'
     AND LOWER(oc.email) = $2
     ORDER BY om.sent_at DESC
     LIMIT 1`,
    [userId, fromAddress]
  );

  if (outreachResult.rows.length > 0) {
    const match = outreachResult.rows[0];

    // Calculate confidence based on subject similarity
    let confidence = 0.9;
    if (message.subject && match.subject) {
      const similarity = calculateSimilarity(
        message.subject.toLowerCase().replace(/^re:\s*/i, ''),
        match.subject.toLowerCase()
      );
      confidence = Math.max(0.7, Math.min(1.0, similarity + 0.3));
    }

    return {
      campaignId: match.campaign_id,
      messageId: match.message_id,
      confidence,
    };
  }

  // Check by subject pattern
  if (message.subject) {
    const subjectMatch = await query(
      `SELECT om.id as message_id, om.campaign_id
       FROM outreach_messages om
       WHERE om.user_id = $1
       AND om.status = 'sent'
       AND SIMILARITY(LOWER(om.subject), LOWER($2)) > 0.5
       ORDER BY SIMILARITY(LOWER(om.subject), LOWER($2)) DESC
       LIMIT 1`,
      [userId, message.subject.replace(/^re:\s*/i, '')]
    );

    if (subjectMatch.rows.length > 0) {
      return {
        campaignId: subjectMatch.rows[0].campaign_id,
        messageId: subjectMatch.rows[0].message_id,
        confidence: 0.7,
      };
    }
  }

  return null;
}

/**
 * Simple string similarity (Jaccard)
 */
function calculateSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

// =====================================================
// REPLY SUGGESTIONS
// =====================================================

/**
 * Generate reply suggestions for a message
 */
export async function generateReplySuggestions(
  threadId: string,
  userId: string,
  options?: {
    tone?: keyof typeof REPLY_TONES;
    count?: number;
    instruction?: string;
  }
): Promise<string[]> {
  const threadData = await getThread(threadId, userId);

  if (!threadData) {
    throw new Error('Thread not found');
  }

  const { thread, messages } = threadData;
  const lastInbound = messages.filter((m) => m.direction === 'inbound').pop();

  if (!lastInbound) {
    return [];
  }

  // Build conversation context
  const recentMessages = messages.slice(-5);
  const context = recentMessages
    .map((m) => `[${m.direction === 'inbound' ? 'Them' : 'You'}]: ${m.bodyText?.substring(0, 500) || ''}`)
    .join('\n\n');

  const tone = REPLY_TONES[options?.tone || 'professional'];
  const count = options?.count || 3;

  const prompt = `Generate ${count} reply suggestions for this ${thread.primaryChannel} conversation.

${tone.systemPrompt}

${options?.instruction ? `User instruction: ${options.instruction}\n` : ''}

Conversation context:
${context}

Message to reply to:
From: ${lastInbound.from.name || lastInbound.from.address}
${lastInbound.subject ? `Subject: ${lastInbound.subject}` : ''}
${lastInbound.bodyText?.substring(0, 1000) || lastInbound.snippet}

Generate ${count} different reply options. Keep them ${thread.primaryChannel === 'sms' ? 'very short (under 160 chars)' : 'concise but complete'}.

Return as JSON array of strings only:
["Reply 1", "Reply 2", "Reply 3"]`;

  try {
    const response = await anthropic.messages.create({
      model: SMART_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';

    // Extract JSON from response
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }

    return [];
  } catch (error) {
    console.error('[AIAssistant] Reply generation error:', error);
    return [];
  }
}

/**
 * Draft a reply based on instruction
 */
export async function draftReply(
  threadId: string,
  userId: string,
  instruction: string,
  options?: {
    tone?: keyof typeof REPLY_TONES;
  }
): Promise<{
  draft: string;
  subject?: string;
  alternatives: string[];
}> {
  const threadData = await getThread(threadId, userId);

  if (!threadData) {
    throw new Error('Thread not found');
  }

  const { thread, messages } = threadData;
  const recentMessages = messages.slice(-5);

  const context = recentMessages
    .map((m) => `[${m.direction === 'inbound' ? 'Them' : 'You'}]: ${m.bodyText?.substring(0, 500) || ''}`)
    .join('\n\n');

  const tone = REPLY_TONES[options?.tone || 'professional'];

  const prompt = `Draft a reply for this ${thread.primaryChannel} conversation.

${tone.systemPrompt}

User instruction: "${instruction}"

Examples of instructions and how to interpret them:
- "say yes" -> Accept/agree to their request
- "decline politely" -> Politely decline their request
- "schedule a call" -> Suggest scheduling a call
- "ask for more details" -> Request additional information
- "thank them and confirm" -> Express gratitude and confirm

Conversation context:
${context}

Subject: ${thread.subject || 'N/A'}

Write a reply following the instruction. ${thread.primaryChannel === 'sms' ? 'Keep it very short.' : ''}

Return JSON:
{
  "draft": "The reply text",
  "subject": "Re: subject (for email only, null for SMS)",
  "alternatives": ["Alternative reply 1", "Alternative reply 2"]
}`;

  try {
    const response = await anthropic.messages.create({
      model: SMART_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';

    // Extract JSON
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }

    return {
      draft: text,
      alternatives: [],
    };
  } catch (error) {
    console.error('[AIAssistant] Draft error:', error);
    throw error;
  }
}

// =====================================================
// ENTITY & ACTION EXTRACTION
// =====================================================

/**
 * Extract entities from a message
 */
export async function extractEntities(
  message: UnifiedMessage
): Promise<AIEntity[]> {
  const prompt = `Extract entities from this message:

${message.bodyText?.substring(0, 2000) || message.snippet || ''}

Extract:
- dates (meetings, deadlines, events)
- amounts (prices, quantities, percentages)
- people (names mentioned)
- companies (company names)
- phone numbers
- email addresses
- locations (cities, addresses)

Return JSON array only:
[{"type": "date", "value": "next Tuesday at 3pm", "confidence": 0.9}, ...]`;

  try {
    const response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';

    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }

    return [];
  } catch (error) {
    console.error('[AIAssistant] Entity extraction error:', error);
    return [];
  }
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
    return [];
  }

  const { messages } = threadData;

  const context = messages
    .map((m) => `[${m.from.name || m.from.address}]: ${m.bodyText?.substring(0, 500) || ''}`)
    .join('\n\n');

  const prompt = `Extract action items and tasks from this conversation:

${context}

Identify tasks, requests, commitments, and things that need follow-up.

Return JSON array:
[{
  "description": "What needs to be done",
  "dueDate": "ISO date if mentioned, null otherwise",
  "priority": "high/medium/low",
  "assignee": "Who should do it if clear"
}]`;

  try {
    const response = await anthropic.messages.create({
      model: SMART_MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';

    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }

    return [];
  } catch (error) {
    console.error('[AIAssistant] Action extraction error:', error);
    return [];
  }
}

// =====================================================
// THREAD SUMMARY
// =====================================================

/**
 * Generate a summary of a thread
 */
export async function summarizeThread(
  threadId: string,
  userId: string
): Promise<{
  summary: string;
  keyPoints: string[];
  sentiment: AISentiment;
  suggestedAction?: string;
}> {
  const threadData = await getThread(threadId, userId);

  if (!threadData) {
    throw new Error('Thread not found');
  }

  const { thread, messages } = threadData;

  const context = messages
    .map((m) => {
      const sender = m.direction === 'inbound' ? (m.from.name || m.from.address) : 'You';
      return `[${sender}]: ${m.bodyText?.substring(0, 500) || m.snippet || ''}`;
    })
    .join('\n\n');

  const prompt = `Summarize this ${thread.primaryChannel} conversation:

${context}

Provide:
1. A concise summary (2-3 sentences)
2. Key points (3-5 bullets)
3. Overall sentiment
4. Suggested next action (if any)

Return JSON:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "sentiment": "positive/neutral/negative/urgent",
  "suggestedAction": "What to do next, or null"
}`;

  try {
    const response = await anthropic.messages.create({
      model: SMART_MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';

    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }

    return {
      summary: 'Unable to generate summary',
      keyPoints: [],
      sentiment: 'neutral',
    };
  } catch (error) {
    console.error('[AIAssistant] Summary error:', error);
    throw error;
  }
}

// =====================================================
// AUTO-PROCESSING
// =====================================================

/**
 * Process new messages in the background
 * Called after sync completes
 */
export async function processNewMessages(
  userId: string,
  messageIds: string[]
): Promise<void> {
  if (messageIds.length === 0) {
    return;
  }

  // Fetch messages
  const result = await query(
    `SELECT * FROM unified_messages
     WHERE id = ANY($1) AND user_id = $2
     AND ai_category IS NULL`,
    [messageIds, userId]
  );

  if (result.rows.length === 0) {
    return;
  }

  console.log(`[AIAssistant] Processing ${result.rows.length} new messages`);

  // Categorize messages
  const messages = result.rows.map(mapRowToMessage);
  await batchCategorizeMessages(messages, userId);
}

/**
 * Auto-categorize uncategorized messages for a user
 */
export async function autoCategorizeInbox(
  userId: string,
  limit = 50
): Promise<number> {
  const result = await query(
    `SELECT * FROM unified_messages
     WHERE user_id = $1
     AND ai_category IS NULL
     AND is_trashed = false
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  if (result.rows.length === 0) {
    return 0;
  }

  const messages = result.rows.map(mapRowToMessage);
  await batchCategorizeMessages(messages, userId);

  return messages.length;
}

// =====================================================
// HELPERS
// =====================================================

function mapRowToMessage(row: any): UnifiedMessage {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    channel: row.channel,
    channelMessageId: row.channel_message_id,
    channelThreadId: row.channel_thread_id,
    threadId: row.thread_id,
    direction: row.direction,
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
    aiCategory: row.ai_category,
    aiPriority: row.ai_priority,
    aiSentiment: row.ai_sentiment,
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
  // Categorization
  categorizeMessage,
  batchCategorizeMessages,

  // Replies
  generateReplySuggestions,
  draftReply,
  REPLY_TONES,

  // Extraction
  extractEntities,
  extractActionItems,

  // Summary
  summarizeThread,

  // Auto-processing
  processNewMessages,
  autoCategorizeInbox,
};
