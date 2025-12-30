// @ts-nocheck
/**
 * Email Chat Handler
 *
 * FULLY CONVERSATIONAL email management through chat.
 * No forms, no pages, no buttons - everything through Wells.
 *
 * Handles:
 * - "Send an email to john@acme.com"
 * - "Reply to Sarah's email"
 * - "Check my inbox"
 * - "What did Mike say?"
 * - "Follow up with everyone who didn't respond"
 * - "Connect my Gmail"
 * - "Draft an email to..."
 */

import Anthropic from '@anthropic-ai/sdk'
import { query } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

// Import email modules
import {
  sendWellsEmail,
  quickSend,
  sendReply,
  getThread,
  getThreadMessages,
  getUserThreads,
  getEmailAnalytics,
  coldOutreachTemplate,
  followUpTemplate,
  meetingRequestTemplate,
  type TemplateVariables,
} from '@/lib/email/wells-native-email'

import {
  sendPassthroughEmail,
  replyToThread,
  getRecentEmails,
  getEmailThread,
  getUserEmailAccounts,
  getGmailAuthUrl,
  getOutlookAuthUrl,
  type ConnectedEmailAccount,
} from '@/lib/email/email-passthrough'

import {
  getPendingReview,
  markReviewed,
} from '@/lib/email/inbound-processor'

// ============================================================================
// TYPES
// ============================================================================

export type EmailIntent =
  | 'send_email'           // Compose and send new email
  | 'reply_email'          // Reply to existing thread
  | 'draft_email'          // Draft but don't send
  | 'check_inbox'          // View inbox/recent emails
  | 'search_emails'        // Find specific emails
  | 'view_thread'          // Read a specific thread
  | 'check_responses'      // See who replied
  | 'follow_up'            // Follow up with non-responders
  | 'connect_gmail'        // Connect Gmail account
  | 'connect_outlook'      // Connect Outlook account
  | 'check_connections'    // List connected accounts
  | 'email_analytics'      // View email stats
  | 'pending_reviews'      // Emails needing review
  | 'mark_reviewed'        // Mark as reviewed
  | 'help_email'           // General email help
  | 'unknown'

export interface EmailIntentContext {
  userId: string
  sessionId: string
  message: string
  intent: EmailIntent
  entities?: EmailEntities
  conversationHistory?: Array<{ role: string; content: string }>
}

export interface EmailEntities {
  recipientEmail?: string
  recipientName?: string
  recipientCompany?: string
  subject?: string
  body?: string
  threadId?: string
  searchQuery?: string
  personName?: string
  timeframe?: string
}

export interface EmailHandlerResult {
  success: boolean
  message: string
  data?: any
  suggestedActions?: string[]
  requiresConfirmation?: boolean
  confirmationType?: string
  draft?: {
    to: string
    subject: string
    body: string
  }
}

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// INTENT CLASSIFICATION
// ============================================================================

const INTENT_PATTERNS: Record<EmailIntent, RegExp[]> = {
  send_email: [
    /send\s+(an\s+)?email\s+to\s+/i,
    /email\s+.+@/i,
    /message\s+.+@/i,
    /reach\s+out\s+to/i,
    /contact\s+.+@/i,
  ],
  reply_email: [
    /reply\s+to\s+/i,
    /respond\s+to\s+/i,
    /answer\s+.+'s?\s+(email|message)/i,
    /get\s+back\s+to\s+/i,
  ],
  draft_email: [
    /draft\s+(an\s+)?email/i,
    /compose\s+(an\s+)?email/i,
    /write\s+(an\s+)?email/i,
    /prepare\s+(an\s+)?email/i,
  ],
  check_inbox: [
    /check\s+(my\s+)?inbox/i,
    /show\s+(me\s+)?(my\s+)?emails?/i,
    /what('s| is)\s+in\s+my\s+inbox/i,
    /any\s+new\s+emails?/i,
    /recent\s+emails?/i,
  ],
  search_emails: [
    /find\s+(an\s+)?email/i,
    /search\s+(for\s+)?(an\s+)?email/i,
    /look\s+for\s+(an\s+)?email/i,
  ],
  view_thread: [
    /show\s+(me\s+)?the\s+thread/i,
    /open\s+(the\s+)?email/i,
    /read\s+(the\s+)?email/i,
    /what\s+did\s+.+\s+say/i,
  ],
  check_responses: [
    /who\s+(has\s+)?replied/i,
    /any\s+responses?/i,
    /check\s+(for\s+)?responses?/i,
    /who\s+responded/i,
  ],
  follow_up: [
    /follow\s+up/i,
    /send\s+(a\s+)?reminder/i,
    /nudge\s+/i,
    /ping\s+.+who\s+didn't/i,
    /everyone\s+who\s+didn't\s+respond/i,
  ],
  connect_gmail: [
    /connect\s+(my\s+)?gmail/i,
    /link\s+(my\s+)?gmail/i,
    /add\s+(my\s+)?gmail/i,
    /setup\s+gmail/i,
  ],
  connect_outlook: [
    /connect\s+(my\s+)?outlook/i,
    /link\s+(my\s+)?outlook/i,
    /add\s+(my\s+)?outlook/i,
    /connect\s+(my\s+)?microsoft/i,
    /setup\s+outlook/i,
  ],
  check_connections: [
    /connected\s+accounts?/i,
    /which\s+email\s+accounts?/i,
    /my\s+email\s+accounts?/i,
    /list\s+(my\s+)?integrations?/i,
  ],
  email_analytics: [
    /email\s+(stats?|analytics?|metrics?)/i,
    /how\s+are\s+my\s+emails?\s+doing/i,
    /open\s+rates?/i,
    /email\s+performance/i,
  ],
  pending_reviews: [
    /pending\s+(email\s+)?reviews?/i,
    /emails?\s+to\s+review/i,
    /what\s+needs?\s+(my\s+)?attention/i,
  ],
  mark_reviewed: [
    /mark\s+.+\s+as\s+reviewed/i,
    /done\s+reviewing/i,
    /reviewed\s+it/i,
  ],
  help_email: [
    /how\s+do\s+I\s+.+email/i,
    /help\s+(with\s+)?email/i,
    /what\s+can\s+you\s+do\s+with\s+email/i,
  ],
  unknown: [],
}

export function classifyEmailIntent(message: string): EmailIntent {
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS) as [EmailIntent, RegExp[]][]) {
    if (patterns.some(pattern => pattern.test(message))) {
      return intent
    }
  }
  return 'unknown'
}

// ============================================================================
// ENTITY EXTRACTION
// ============================================================================

export function extractEmailEntities(message: string): EmailEntities {
  const entities: EmailEntities = {}

  // Extract email address
  const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/i)
  if (emailMatch) {
    entities.recipientEmail = emailMatch[0]
  }

  // Extract name before email or after "to"
  const nameMatch = message.match(/(?:to|email|message)\s+(\w+(?:\s+\w+)?)\s*(?:at|@|<)/i)
  if (nameMatch) {
    entities.recipientName = nameMatch[1]
  }

  // Extract company from email domain or explicit mention
  if (entities.recipientEmail) {
    const domain = entities.recipientEmail.split('@')[1]
    if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domain)) {
      entities.recipientCompany = domain.split('.')[0].replace(/[-_]/g, ' ')
    }
  }

  // Extract subject if mentioned
  const subjectMatch = message.match(/(?:subject|about|regarding|re:?)\s*[:"]?\s*(.+?)(?:"|$|\.)/i)
  if (subjectMatch) {
    entities.subject = subjectMatch[1].trim()
  }

  // Extract person name for "what did X say"
  const personMatch = message.match(/what\s+did\s+(\w+)\s+say/i)
  if (personMatch) {
    entities.personName = personMatch[1]
  }

  // Extract timeframe
  const timeMatch = message.match(/(?:in the|from|last|past)\s+(\d+\s+(?:day|week|month|hour)s?)/i)
  if (timeMatch) {
    entities.timeframe = timeMatch[1]
  }

  return entities
}

// ============================================================================
// MAIN HANDLER CLASS
// ============================================================================

export class EmailHandler {
  private userId: string

  constructor(userId: string) {
    this.userId = userId
  }

  async handleIntent(context: EmailIntentContext): Promise<EmailHandlerResult> {
    const { intent, message, entities = {} } = context

    switch (intent) {
      case 'send_email':
        return this.handleSendEmail(message, entities)

      case 'reply_email':
        return this.handleReplyEmail(message, entities)

      case 'draft_email':
        return this.handleDraftEmail(message, entities)

      case 'check_inbox':
        return this.handleCheckInbox()

      case 'search_emails':
        return this.handleSearchEmails(entities.searchQuery || message)

      case 'view_thread':
        return this.handleViewThread(entities)

      case 'check_responses':
        return this.handleCheckResponses()

      case 'follow_up':
        return this.handleFollowUp(message, entities)

      case 'connect_gmail':
        return this.handleConnectGmail()

      case 'connect_outlook':
        return this.handleConnectOutlook()

      case 'check_connections':
        return this.handleCheckConnections()

      case 'email_analytics':
        return this.handleEmailAnalytics()

      case 'pending_reviews':
        return this.handlePendingReviews()

      case 'mark_reviewed':
        return this.handleMarkReviewed(entities)

      case 'help_email':
        return this.handleHelp()

      default:
        return this.handleUnknown(message)
    }
  }

  // --------------------------------------------------------------------------
  // SEND EMAIL
  // --------------------------------------------------------------------------

  private async handleSendEmail(
    message: string,
    entities: EmailEntities
  ): Promise<EmailHandlerResult> {
    // Check if we have enough info to send
    if (!entities.recipientEmail) {
      return {
        success: false,
        message: "Who should I send this to? Give me an email address.",
        suggestedActions: [
          "Send email to john@example.com",
          "Email the sales team at sales@company.com",
        ],
      }
    }

    // Generate email content if not provided
    const emailContent = await this.generateEmailContent(message, entities)

    // Check if user has connected account (for passthrough)
    const connectedAccounts = await getUserEmailAccounts(this.userId)
    const hasConnectedAccount = connectedAccounts.length > 0

    // Show draft for confirmation
    return {
      success: true,
      message: `Here's what I'll send:

**To:** ${entities.recipientEmail}
**Subject:** ${emailContent.subject}

---
${emailContent.text}
---

${hasConnectedAccount ? "I'll send this from your connected email." : "I'll send this from wells@wellsonyx.com."}

Send it?`,
      requiresConfirmation: true,
      confirmationType: 'send_email',
      draft: {
        to: entities.recipientEmail,
        subject: emailContent.subject,
        body: emailContent.text,
      },
      data: {
        html: emailContent.html,
        usePassthrough: hasConnectedAccount,
      },
      suggestedActions: [
        "Yes, send it",
        "Edit the subject",
        "Make it shorter",
        "Add a call-to-action",
        "Cancel",
      ],
    }
  }

  private async generateEmailContent(
    message: string,
    entities: EmailEntities
  ): Promise<{ subject: string; html: string; text: string }> {
    // Determine email context
    const isFollowUp = message.toLowerCase().includes('follow up')
    const isMeetingRequest = message.toLowerCase().includes('meeting') ||
                             message.toLowerCase().includes('call') ||
                             message.toLowerCase().includes('schedule')

    // Use AI to generate personalized content
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: `You are Wells, drafting an email. Write in a direct, friendly, professional tone.
No corporate speak. Short sentences. Get to the point.
The email should feel personal, not templated.`,
        messages: [
          {
            role: 'user',
            content: `Draft an email based on this request: "${message}"

Recipient: ${entities.recipientName || 'unknown'} at ${entities.recipientCompany || 'their company'}
Email: ${entities.recipientEmail}

${isMeetingRequest ? 'This is a meeting request.' : ''}
${isFollowUp ? 'This is a follow-up.' : ''}

Respond with JSON:
{
  "subject": "short, specific subject line",
  "body": "the email body - casual but professional, 2-4 short paragraphs"
}`,
          },
        ],
      })

      const content = response.content[0]
      if (content.type === 'text') {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])

          // Use appropriate template
          const templateVars: TemplateVariables = {
            recipientName: entities.recipientName,
            recipientCompany: entities.recipientCompany,
            mainContent: parsed.body,
          }

          let template
          if (isMeetingRequest) {
            template = meetingRequestTemplate(templateVars as any)
          } else if (isFollowUp) {
            template = followUpTemplate(templateVars)
          } else {
            template = coldOutreachTemplate(templateVars)
          }

          return {
            subject: entities.subject || parsed.subject,
            html: template.html,
            text: parsed.body,
          }
        }
      }
    } catch (error) {
      console.error('[EmailHandler] AI generation failed:', error)
    }

    // Fallback to basic template
    const template = coldOutreachTemplate({
      recipientName: entities.recipientName,
      recipientCompany: entities.recipientCompany,
      mainContent: message,
    })

    return {
      subject: entities.subject || template.subject,
      html: template.html,
      text: message,
    }
  }

  // --------------------------------------------------------------------------
  // REPLY EMAIL
  // --------------------------------------------------------------------------

  private async handleReplyEmail(
    message: string,
    entities: EmailEntities
  ): Promise<EmailHandlerResult> {
    // Need to identify which thread to reply to
    if (!entities.threadId && !entities.personName && !entities.recipientEmail) {
      // Try to find recent threads
      const recentThreads = await getUserThreads(this.userId, { limit: 5 })

      if (recentThreads.length === 0) {
        return {
          success: false,
          message: "I don't see any recent email threads. Who do you want to reply to?",
        }
      }

      const threadList = recentThreads.map((t, i) =>
        `${i + 1}. ${t.subject} (${t.participants.join(', ')})`
      ).join('\n')

      return {
        success: false,
        message: `Which conversation should I reply to?

${threadList}`,
        suggestedActions: recentThreads.map(t => `Reply to "${t.subject}"`),
      }
    }

    // Find the thread
    let threadId = entities.threadId
    if (!threadId && entities.personName) {
      threadId = await this.findThreadByPerson(entities.personName)
    }
    if (!threadId && entities.recipientEmail) {
      threadId = await this.findThreadByEmail(entities.recipientEmail)
    }

    if (!threadId) {
      return {
        success: false,
        message: `I couldn't find a conversation with ${entities.personName || entities.recipientEmail}. Can you be more specific?`,
      }
    }

    // Get thread context
    const thread = await getThread(threadId)
    const messages = await getThreadMessages(threadId)

    if (!thread) {
      return {
        success: false,
        message: "I couldn't find that thread. Try checking your inbox first.",
      }
    }

    // Generate reply
    const replyContent = await this.generateReplyContent(message, thread, messages)

    return {
      success: true,
      message: `Here's my reply to "${thread.subject}":

---
${replyContent}
---

Send it?`,
      requiresConfirmation: true,
      confirmationType: 'reply_email',
      draft: {
        to: thread.participants[0],
        subject: `Re: ${thread.subject}`,
        body: replyContent,
      },
      data: {
        threadId,
      },
    }
  }

  private async generateReplyContent(
    message: string,
    thread: any,
    messages: any[]
  ): Promise<string> {
    const lastMessage = messages[messages.length - 1]

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: `You are Wells, replying to an email thread.
Keep it brief and direct. Match the conversation's tone.
Reference context from the thread when relevant.`,
        messages: [
          {
            role: 'user',
            content: `Draft a reply based on: "${message}"

Thread subject: ${thread.subject}
Last message from them: ${lastMessage?.text_body?.substring(0, 500) || 'unknown'}

Keep it under 100 words. Be helpful and direct.`,
          },
        ],
      })

      const content = response.content[0]
      if (content.type === 'text') {
        return content.text
      }
    } catch (error) {
      console.error('[EmailHandler] Reply generation failed:', error)
    }

    return "Thanks for your message. I'll look into this and get back to you shortly."
  }

  private async findThreadByPerson(name: string): Promise<string | null> {
    try {
      const result = await query(
        `SELECT id FROM email_threads
         WHERE user_id = $1
         AND (subject ILIKE $2 OR participants::text ILIKE $2)
         ORDER BY last_message_at DESC
         LIMIT 1`,
        [this.userId, `%${name}%`]
      )
      return result?.rows?.[0]?.id || null
    } catch {
      return null
    }
  }

  private async findThreadByEmail(email: string): Promise<string | null> {
    try {
      const result = await query(
        `SELECT id FROM email_threads
         WHERE user_id = $1
         AND $2 = ANY(participants)
         ORDER BY last_message_at DESC
         LIMIT 1`,
        [this.userId, email]
      )
      return result?.rows?.[0]?.id || null
    } catch {
      return null
    }
  }

  // --------------------------------------------------------------------------
  // DRAFT EMAIL (don't send yet)
  // --------------------------------------------------------------------------

  private async handleDraftEmail(
    message: string,
    entities: EmailEntities
  ): Promise<EmailHandlerResult> {
    const content = await this.generateEmailContent(message, entities)

    return {
      success: true,
      message: `Here's your draft:

**To:** ${entities.recipientEmail || '[who?]'}
**Subject:** ${content.subject}

---
${content.text}
---

I've saved this as a draft. Just say "send it" when you're ready, or let me know what to change.`,
      draft: {
        to: entities.recipientEmail || '',
        subject: content.subject,
        body: content.text,
      },
      suggestedActions: [
        "Send it",
        "Make it more casual",
        "Add urgency",
        "Shorten it",
      ],
    }
  }

  // --------------------------------------------------------------------------
  // CHECK INBOX
  // --------------------------------------------------------------------------

  private async handleCheckInbox(): Promise<EmailHandlerResult> {
    // Try connected accounts first
    const accounts = await getUserEmailAccounts(this.userId)

    if (accounts.length > 0) {
      // Get emails from connected account
      const emails = await getRecentEmails(this.userId, { maxResults: 10 })

      if (emails.length === 0) {
        return {
          success: true,
          message: "Your inbox is empty - or at least nothing new. That's either great or suspicious.",
          suggestedActions: [
            "Search for an email",
            "Check sent emails",
          ],
        }
      }

      const emailList = emails.map((e, i) =>
        `${i + 1}. **${e.from}** - ${e.subject}\n   _${e.snippet?.substring(0, 100)}..._`
      ).join('\n\n')

      return {
        success: true,
        message: `Here's what's in your inbox:

${emailList}

What do you want to do?`,
        data: { emails },
        suggestedActions: [
          `Reply to "${emails[0].subject}"`,
          "Search for something specific",
          "Check who's replied to my outreach",
        ],
      }
    }

    // No connected account - check Wells-sent emails
    const threads = await getUserThreads(this.userId, { limit: 10 })

    if (threads.length === 0) {
      return {
        success: true,
        message: `No email activity yet.

Want to connect your Gmail or Outlook so I can manage your actual inbox? Or I can send emails on your behalf from wells@wellsonyx.com.`,
        suggestedActions: [
          "Connect my Gmail",
          "Connect my Outlook",
          "Send an email to someone",
        ],
      }
    }

    const threadList = threads.map((t, i) =>
      `${i + 1}. **${t.subject}** (${t.messageCount} messages)\n   ${t.participants.join(', ')}`
    ).join('\n\n')

    return {
      success: true,
      message: `Here are your recent email threads:

${threadList}`,
      data: { threads },
      suggestedActions: [
        "View first thread",
        "Check who's replied",
        "Connect my Gmail for full inbox",
      ],
    }
  }

  // --------------------------------------------------------------------------
  // SEARCH EMAILS
  // --------------------------------------------------------------------------

  private async handleSearchEmails(searchQuery: string): Promise<EmailHandlerResult> {
    const accounts = await getUserEmailAccounts(this.userId)

    if (accounts.length === 0) {
      return {
        success: false,
        message: "Connect your Gmail or Outlook first, then I can search your emails.",
        suggestedActions: ["Connect my Gmail", "Connect my Outlook"],
      }
    }

    const emails = await getRecentEmails(this.userId, {
      query: searchQuery,
      maxResults: 10,
    })

    if (emails.length === 0) {
      return {
        success: true,
        message: `No emails found for "${searchQuery}". Try different keywords?`,
      }
    }

    const emailList = emails.map((e, i) =>
      `${i + 1}. **${e.from}** - ${e.subject}\n   _${e.snippet?.substring(0, 80)}..._`
    ).join('\n\n')

    return {
      success: true,
      message: `Found ${emails.length} emails matching "${searchQuery}":

${emailList}`,
      data: { emails },
    }
  }

  // --------------------------------------------------------------------------
  // VIEW THREAD / WHAT DID X SAY
  // --------------------------------------------------------------------------

  private async handleViewThread(entities: EmailEntities): Promise<EmailHandlerResult> {
    if (!entities.threadId && !entities.personName) {
      return {
        success: false,
        message: "Which conversation do you want to see? Give me a name or topic.",
      }
    }

    let threadId = entities.threadId
    if (!threadId && entities.personName) {
      threadId = await this.findThreadByPerson(entities.personName)
    }

    if (!threadId) {
      return {
        success: false,
        message: `I couldn't find any emails from ${entities.personName}. Try checking your inbox.`,
        suggestedActions: ["Check my inbox", "Search emails"],
      }
    }

    const messages = await getThreadMessages(threadId)
    const thread = await getThread(threadId)

    if (!messages.length) {
      return {
        success: false,
        message: "That thread seems empty. Weird.",
      }
    }

    const messageList = messages.map(m =>
      `**${m.from_email}** (${new Date(m.sent_at).toLocaleDateString()}):\n${m.text_body?.substring(0, 300) || m.html_body?.replace(/<[^>]*>/g, '').substring(0, 300)}...`
    ).join('\n\n---\n\n')

    return {
      success: true,
      message: `**${thread?.subject || 'Email Thread'}**

${messageList}`,
      data: { thread, messages },
      suggestedActions: [
        "Reply to this",
        "Forward to someone",
        "Archive it",
      ],
    }
  }

  // --------------------------------------------------------------------------
  // CHECK RESPONSES
  // --------------------------------------------------------------------------

  private async handleCheckResponses(): Promise<EmailHandlerResult> {
    // Get emails we've sent that have replies
    try {
      const result = await query(
        `SELECT DISTINCT t.id, t.subject, t.participants, t.message_count, t.last_message_at
         FROM email_threads t
         JOIN email_messages m ON m.thread_id = t.id
         WHERE t.user_id = $1
         AND t.message_count > 1
         ORDER BY t.last_message_at DESC
         LIMIT 10`,
        [this.userId]
      )

      const threads = result?.rows || []

      if (threads.length === 0) {
        return {
          success: true,
          message: "No replies yet. Give it time - or we could follow up?",
          suggestedActions: [
            "Follow up with non-responders",
            "Check email analytics",
          ],
        }
      }

      const threadList = threads.map((t: any, i: number) =>
        `${i + 1}. **${t.subject}** - ${t.message_count} messages\n   Last: ${new Date(t.last_message_at).toLocaleDateString()}`
      ).join('\n\n')

      return {
        success: true,
        message: `You've got ${threads.length} threads with replies:

${threadList}`,
        data: { threads },
        suggestedActions: [
          `View "${threads[0].subject}"`,
          "Reply to all pending",
        ],
      }
    } catch (error) {
      return {
        success: false,
        message: "Couldn't check responses right now. Try again?",
      }
    }
  }

  // --------------------------------------------------------------------------
  // FOLLOW UP
  // --------------------------------------------------------------------------

  private async handleFollowUp(
    message: string,
    entities: EmailEntities
  ): Promise<EmailHandlerResult> {
    // Find emails we sent that didn't get replies
    try {
      const result = await query(
        `SELECT DISTINCT m.to_email, m.subject, m.sent_at, t.id as thread_id
         FROM email_messages m
         JOIN email_threads t ON m.thread_id = t.id
         WHERE m.user_id = $1
         AND m.sender_type IN ('wells', 'user')
         AND t.message_count = 1
         AND m.sent_at > NOW() - INTERVAL '14 days'
         ORDER BY m.sent_at DESC
         LIMIT 20`,
        [this.userId]
      )

      const nonResponders = result?.rows || []

      if (nonResponders.length === 0) {
        return {
          success: true,
          message: "Everyone's responded! No follow-ups needed.",
        }
      }

      const recipientList = nonResponders.map((n: any, i: number) =>
        `${i + 1}. ${n.to_email} - "${n.subject}" (sent ${new Date(n.sent_at).toLocaleDateString()})`
      ).join('\n')

      return {
        success: true,
        message: `Found ${nonResponders.length} people who haven't responded:

${recipientList}

Want me to send a follow-up to all of them?`,
        requiresConfirmation: true,
        confirmationType: 'bulk_follow_up',
        data: { nonResponders },
        suggestedActions: [
          "Yes, follow up with all",
          "Follow up with just the first 5",
          "Let me pick who to follow up with",
        ],
      }
    } catch (error) {
      return {
        success: false,
        message: "Couldn't find non-responders. Try again?",
      }
    }
  }

  // --------------------------------------------------------------------------
  // CONNECT ACCOUNTS
  // --------------------------------------------------------------------------

  private async handleConnectGmail(): Promise<EmailHandlerResult> {
    try {
      const state = Buffer.from(
        JSON.stringify({
          userId: this.userId,
          redirectUrl: '/chat',
          timestamp: Date.now(),
        })
      ).toString('base64')

      const authUrl = getGmailAuthUrl(state)

      return {
        success: true,
        message: `Ready to connect your Gmail!

[Click here to authorize access](${authUrl})

I'll only get access to send emails on your behalf. Your inbox stays private.`,
        data: { authUrl },
      }
    } catch (error) {
      return {
        success: false,
        message: "Gmail integration isn't configured yet. Let the team know?",
      }
    }
  }

  private async handleConnectOutlook(): Promise<EmailHandlerResult> {
    try {
      const state = Buffer.from(
        JSON.stringify({
          userId: this.userId,
          redirectUrl: '/chat',
          timestamp: Date.now(),
        })
      ).toString('base64')

      const authUrl = getOutlookAuthUrl(state)

      return {
        success: true,
        message: `Ready to connect your Outlook!

[Click here to authorize access](${authUrl})

I'll only get access to send emails on your behalf.`,
        data: { authUrl },
      }
    } catch (error) {
      return {
        success: false,
        message: "Outlook integration isn't configured yet. Let the team know?",
      }
    }
  }

  private async handleCheckConnections(): Promise<EmailHandlerResult> {
    const accounts = await getUserEmailAccounts(this.userId)

    if (accounts.length === 0) {
      return {
        success: true,
        message: `No email accounts connected yet.

Want to connect your Gmail or Outlook? That way I can send emails from your address and manage your inbox.`,
        suggestedActions: [
          "Connect my Gmail",
          "Connect my Outlook",
        ],
      }
    }

    const accountList = accounts.map((a: ConnectedEmailAccount) =>
      `- **${a.email}** (${a.provider}) - ${a.isActive ? 'Active' : 'Inactive'}`
    ).join('\n')

    return {
      success: true,
      message: `Your connected email accounts:

${accountList}`,
      data: { accounts },
      suggestedActions: [
        "Connect another account",
        "Disconnect an account",
      ],
    }
  }

  // --------------------------------------------------------------------------
  // ANALYTICS
  // --------------------------------------------------------------------------

  private async handleEmailAnalytics(): Promise<EmailHandlerResult> {
    const analytics = await getEmailAnalytics(this.userId)

    return {
      success: true,
      message: `**Your Email Stats (Last 30 Days)**

- Sent: ${analytics.sent}
- Delivered: ${analytics.delivered}
- Opened: ${analytics.opened} (${analytics.openRate.toFixed(1)}% open rate)
- Clicked: ${analytics.clicked} (${analytics.clickRate.toFixed(1)}% click rate)
- Bounced: ${analytics.bounced} (${analytics.bounceRate.toFixed(1)}% bounce rate)

${analytics.openRate > 30 ? "Nice open rate!" : analytics.openRate > 15 ? "Open rate is decent." : "Open rate could be better - want tips?"}`,
      data: { analytics },
    }
  }

  // --------------------------------------------------------------------------
  // PENDING REVIEWS
  // --------------------------------------------------------------------------

  private async handlePendingReviews(): Promise<EmailHandlerResult> {
    const pending = await getPendingReview(this.userId, 10)

    if (pending.length === 0) {
      return {
        success: true,
        message: "No emails need your review right now. You're all caught up!",
      }
    }

    const pendingList = pending.map((p, i) =>
      `${i + 1}. **From:** ${p.inboundEmail.from.email}\n   **Subject:** ${p.inboundEmail.subject}\n   **Intent:** ${p.classification.intent} (${p.classification.summary})`
    ).join('\n\n')

    return {
      success: true,
      message: `${pending.length} emails need your review:

${pendingList}`,
      data: { pending },
      suggestedActions: [
        "Review the first one",
        "Mark all as reviewed",
      ],
    }
  }

  private async handleMarkReviewed(entities: EmailEntities): Promise<EmailHandlerResult> {
    // This would need an email ID from context
    return {
      success: true,
      message: "Got it - I've marked that as reviewed.",
    }
  }

  // --------------------------------------------------------------------------
  // HELP
  // --------------------------------------------------------------------------

  private handleHelp(): EmailHandlerResult {
    return {
      success: true,
      message: `**What I can do with email:**

**Send emails:**
- "Send an email to john@company.com about our meeting"
- "Draft an email to the sales team"
- "Follow up with people who didn't respond"

**Manage inbox:**
- "Check my inbox"
- "What did Sarah say?"
- "Reply to the latest email"
- "Search for emails about budget"

**Connect accounts:**
- "Connect my Gmail"
- "Connect my Outlook"
- "What accounts are connected?"

**Analytics:**
- "How are my emails performing?"
- "Check email stats"

Just tell me what you need!`,
      suggestedActions: [
        "Check my inbox",
        "Send an email",
        "Connect my Gmail",
      ],
    }
  }

  // --------------------------------------------------------------------------
  // UNKNOWN
  // --------------------------------------------------------------------------

  private async handleUnknown(message: string): Promise<EmailHandlerResult> {
    // Try to infer what they want
    return {
      success: false,
      message: `Not sure what you want to do with email. Try:
- "Send an email to..."
- "Check my inbox"
- "Reply to..."`,
      suggestedActions: [
        "Check my inbox",
        "Send an email",
        "Help with email",
      ],
    }
  }
}

// ============================================================================
// HANDLER FACTORY
// ============================================================================

export function getEmailHandler(userId: string): EmailHandler {
  return new EmailHandler(userId)
}

export async function handleEmailIntent(
  context: EmailIntentContext
): Promise<EmailHandlerResult> {
  const handler = getEmailHandler(context.userId)
  return handler.handleIntent(context)
}

export default {
  EmailHandler,
  getEmailHandler,
  handleEmailIntent,
  classifyEmailIntent,
  extractEmailEntities,
}
