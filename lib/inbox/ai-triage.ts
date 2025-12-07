/**
 * AI-powered message triage
 *
 * Analyzes incoming messages and:
 * - Assigns priority (urgent, important, normal, low)
 * - Categorizes (deals, recruiting, support, newsletter, personal)
 * - Generates summary
 * - Suggests reply
 * - Extracts action items
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface TriageResult {
  priority: 'urgent' | 'important' | 'normal' | 'low';
  category: string;
  summary: string;
  suggestedReply?: string;
  actionItems?: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  labels?: string[];
  shouldNotify?: boolean;
  estimatedResponseTime?: string;
}

export interface InboxMessage {
  id: string;
  provider: string;
  from: any;
  to: any;
  subject?: string;
  body: string;
  thread_id?: string;
  direction: 'inbound' | 'outbound';
  metadata?: any;
}

/**
 * Triage a message using AI
 */
export async function triageMessage(message: InboxMessage): Promise<TriageResult> {
  try {
    // Build context about the message
    const context = await buildMessageContext(message);

    // Create prompt for Claude
    const prompt = `Analyze this ${message.provider} message and provide triage information.

FROM: ${JSON.stringify(message.from)}
TO: ${JSON.stringify(message.to)}
SUBJECT: ${message.subject || 'N/A'}
BODY:
${message.body}

${context ? `CONTEXT:\n${context}` : ''}

Please analyze this message and provide:

1. PRIORITY: urgent, important, normal, or low
   - urgent: requires immediate action (customer issues, time-sensitive deals, emergencies)
   - important: significant but not urgent (partnership opportunities, important updates)
   - normal: standard business communication
   - low: newsletters, automated emails, non-actionable

2. CATEGORY: The main topic (deals, recruiting, support, newsletter, personal, etc.)

3. SUMMARY: A concise 1-2 sentence summary

4. SENTIMENT: positive, neutral, negative, or urgent

5. ACTION ITEMS: List any specific actions required (if any)

6. SUGGESTED REPLY: A brief professional reply if appropriate (optional)

7. LABELS: Relevant tags for organization

8. SHOULD_NOTIFY: Whether this requires immediate notification

9. ESTIMATED_RESPONSE_TIME: How quickly this should be responded to (e.g., "within 1 hour", "same day", "within 3 days", "no response needed")

Return your analysis in this JSON format:
{
  "priority": "urgent|important|normal|low",
  "category": "string",
  "summary": "string",
  "sentiment": "positive|neutral|negative|urgent",
  "actionItems": ["string"],
  "suggestedReply": "string (optional)",
  "labels": ["string"],
  "shouldNotify": boolean,
  "estimatedResponseTime": "string"
}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const result: TriageResult = JSON.parse(jsonMatch[0]);

    // Store triage result
    await storeTriage(message.id, result);

    return result;

  } catch (error) {
    console.error('Error triaging message:', error);

    // Return default triage if AI fails
    return {
      priority: 'normal',
      category: 'uncategorized',
      summary: message.subject || message.body.substring(0, 100),
      sentiment: 'neutral',
      estimatedResponseTime: 'within 3 days'
    };
  }
}

/**
 * Build context about the message
 */
async function buildMessageContext(message: InboxMessage): Promise<string> {
  const context: string[] = [];

  try {
    // Get sender history if available
    const senderEmail = message.from.email || message.from.phone;
    if (senderEmail) {
      const { data: previousMessages } = await supabase
        .from('inbox_messages_v2')
        .select('subject, body, created_at')
        .contains('from', { email: senderEmail })
        .order('created_at', { ascending: false })
        .limit(3);

      if (previousMessages && previousMessages.length > 0) {
        context.push(`Previous messages from sender: ${previousMessages.length}`);
        context.push('Recent topics: ' + previousMessages.map(m =>
          m.subject || m.body.substring(0, 50)
        ).join('; '));
      }
    }

    // Get thread context if part of thread
    if (message.thread_id) {
      const { data: thread } = await supabase
        .from('inbox_threads')
        .select('subject, message_count, labels')
        .eq('id', message.thread_id)
        .single();

      if (thread) {
        context.push(`Thread: ${thread.subject}`);
        context.push(`Messages in thread: ${thread.message_count}`);
        if (thread.labels && thread.labels.length > 0) {
          context.push(`Thread labels: ${thread.labels.join(', ')}`);
        }
      }
    }

    // Add provider-specific context
    if (message.provider === 'sms') {
      context.push('This is an SMS message (typically more urgent)');
    } else if (message.provider === 'wells_internal') {
      context.push('This is an internal Wells message');
    }

    return context.join('\n');

  } catch (error) {
    console.error('Error building context:', error);
    return '';
  }
}

/**
 * Store triage result
 */
async function storeTriage(messageId: string, result: TriageResult): Promise<void> {
  try {
    await supabase
      .from('message_triage')
      .insert({
        message_id: messageId,
        priority: result.priority,
        category: result.category,
        summary: result.summary,
        sentiment: result.sentiment,
        action_items: result.actionItems,
        suggested_reply: result.suggestedReply,
        labels: result.labels,
        should_notify: result.shouldNotify,
        estimated_response_time: result.estimatedResponseTime,
        triaged_at: new Date().toISOString()
      });

    // Update message with triage data
    await supabase
      .from('inbox_messages_v2')
      .update({
        priority: result.priority,
        category: result.category,
        summary: result.summary
      })
      .eq('id', messageId);

    // Update thread labels
    if (result.labels && result.labels.length > 0) {
      const { data: message } = await supabase
        .from('inbox_messages_v2')
        .select('thread_id')
        .eq('id', messageId)
        .single();

      if (message?.thread_id) {
        const { data: thread } = await supabase
          .from('inbox_threads')
          .select('labels')
          .eq('id', message.thread_id)
          .single();

        const existingLabels = thread?.labels || [];
        const newLabels = Array.from(new Set([...existingLabels, ...result.labels]));

        await supabase
          .from('inbox_threads')
          .update({ labels: newLabels })
          .eq('id', message.thread_id);
      }
    }

  } catch (error) {
    console.error('Error storing triage:', error);
  }
}

/**
 * Batch triage multiple messages
 */
export async function batchTriageMessages(messages: InboxMessage[]): Promise<Map<string, TriageResult>> {
  const results = new Map<string, TriageResult>();

  // Process in parallel with concurrency limit
  const CONCURRENCY = 5;
  const chunks = [];

  for (let i = 0; i < messages.length; i += CONCURRENCY) {
    chunks.push(messages.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async (message) => {
        try {
          const result = await triageMessage(message);
          return { id: message.id, result };
        } catch (error) {
          console.error(`Error triaging message ${message.id}:`, error);
          return null;
        }
      })
    );

    chunkResults.forEach(item => {
      if (item) {
        results.set(item.id, item.result);
      }
    });
  }

  return results;
}

/**
 * Get smart reply suggestions
 */
export async function getSmartReplySuggestions(
  message: InboxMessage,
  count: number = 3
): Promise<string[]> {
  try {
    const prompt = `Generate ${count} brief, professional reply suggestions for this message:

FROM: ${JSON.stringify(message.from)}
SUBJECT: ${message.subject || 'N/A'}
BODY: ${message.body}

Provide ${count} different reply options ranging from brief acknowledgment to more detailed responses.
Return as a JSON array of strings.`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return [];
    }

    const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    return JSON.parse(jsonMatch[0]);

  } catch (error) {
    console.error('Error generating smart replies:', error);
    return [];
  }
}

/**
 * Auto-categorize and label message
 */
export async function autoLabelMessage(message: InboxMessage): Promise<string[]> {
  const triage = await triageMessage(message);
  return triage.labels || [];
}

/**
 * Detect if message requires urgent attention
 */
export async function detectUrgency(message: InboxMessage): Promise<boolean> {
  const triage = await triageMessage(message);
  return triage.priority === 'urgent' || triage.sentiment === 'urgent';
}

/**
 * Extract entities from message (people, companies, dates, amounts)
 */
export async function extractEntities(message: InboxMessage): Promise<{
  people: string[];
  companies: string[];
  dates: string[];
  amounts: string[];
  emails: string[];
  phones: string[];
}> {
  try {
    const prompt = `Extract entities from this message:

${message.body}

Return JSON with arrays for: people, companies, dates, amounts, emails, phones`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return { people: [], companies: [], dates: [], amounts: [], emails: [], phones: [] };
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { people: [], companies: [], dates: [], amounts: [], emails: [], phones: [] };
    }

    return JSON.parse(jsonMatch[0]);

  } catch (error) {
    console.error('Error extracting entities:', error);
    return { people: [], companies: [], dates: [], amounts: [], emails: [], phones: [] };
  }
}
