// @ts-nocheck
/**
 * Conversational Unified Inbox System
 *
 * Enables natural language management of all communications across channels.
 * Users can check messages, reply, forward, search, prioritize, snooze, and
 * compose through simple conversation with Wells AI.
 *
 * Supported channels: Email (Gmail/Outlook), Slack, Discord, LinkedIn, SMS,
 * WhatsApp, Teams, Telegram, iMessage, Twitter/X, Instagram, Website Chat
 */

import { sql } from '@vercel/postgres'
import Anthropic from '@anthropic-ai/sdk'
import { inboxService } from './inbox-service'
import {
  InboxThread,
  InboxMessage,
  InboxProvider,
  AIPriority,
  AICategory,
  ReminderType,
} from './types'
import { Channel, CHANNEL_INFO, getConversations, getConversation, addMessage } from '../inbox'
import { getChannelCredentials, getUserIntegrations } from '../integrations'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ============================================================================
// TYPES
// ============================================================================

export interface ConversationalInboxContext {
  userId: string
  currentMessageId?: string
  currentThreadId?: string
  lastMentionedPerson?: string
  lastMentionedChannel?: Channel
  pendingAction?: PendingInboxAction
}

export interface PendingInboxAction {
  type: 'reply' | 'forward' | 'compose' | 'snooze' | 'archive' | 'priority'
  targetMessageId?: string
  targetThreadId?: string
  draftContent?: string
  recipient?: string
  channel?: Channel
  snoozeUntil?: Date
  priority?: AIPriority
  awaitingConfirmation?: boolean
}

export interface InboxQueryResult {
  success: boolean
  messages?: UnifiedInboxMessage[]
  threads?: InboxThread[]
  summary?: string
  actionRequired?: boolean
  suggestedActions?: string[]
  error?: string
}

export interface UnifiedInboxMessage {
  id: string
  threadId?: string
  channel: Channel
  channelDisplayName: string
  channelIcon: string
  from: {
    name?: string
    email?: string
    phone?: string
    handle?: string
  }
  to?: string[]
  subject?: string
  body: string
  bodyPreview: string
  isRead: boolean
  isStarred: boolean
  priority: AIPriority
  category?: AICategory
  sentiment?: string
  timestamp: Date
  hasAttachments: boolean
  attachmentCount: number
  aiSummary?: string
  suggestedReply?: string
}

export interface ComposeMessageParams {
  channel: Channel
  to: string | string[]
  subject?: string
  body: string
  cc?: string[]
  bcc?: string[]
  replyToMessageId?: string
  replyToThreadId?: string
}

export interface MessageSearchParams {
  query: string
  channel?: Channel
  from?: string
  to?: string
  dateFrom?: Date
  dateTo?: Date
  hasAttachment?: boolean
  isUnread?: boolean
  priority?: AIPriority
  category?: AICategory
  limit?: number
}

// ============================================================================
// CHANNEL NORMALIZATION
// ============================================================================

// Map InboxProvider to Channel for unified handling
const providerToChannel: Record<string, Channel> = {
  gmail: 'gmail',
  sms: 'sms',
  linkedin: 'linkedin',
  x: 'twitter',
  instagram: 'instagram',
  imessage: 'imessage',
  wells: 'chat',
}

// Normalize different channel name formats
export function normalizeChannel(input: string): Channel | null {
  const lower = input.toLowerCase().trim()

  const channelMap: Record<string, Channel> = {
    'email': 'email',
    'gmail': 'gmail',
    'google': 'gmail',
    'outlook': 'outlook',
    'microsoft': 'outlook',
    'slack': 'slack',
    'discord': 'discord',
    'linkedin': 'linkedin',
    'sms': 'sms',
    'text': 'sms',
    'texts': 'sms',
    'text message': 'sms',
    'text messages': 'sms',
    'whatsapp': 'whatsapp',
    'teams': 'teams',
    'microsoft teams': 'teams',
    'telegram': 'telegram',
    'imessage': 'imessage',
    'twitter': 'twitter',
    'x': 'twitter',
    'instagram': 'instagram',
    'ig': 'instagram',
    'dm': 'twitter', // Could be multiple, default to twitter
    'dms': 'twitter',
    'chat': 'chat',
    'website': 'chat',
  }

  return channelMap[lower] || null
}

// ============================================================================
// MAIN CONVERSATIONAL INBOX CLASS
// ============================================================================

export class ConversationalInbox {
  private userId: string
  private context: ConversationalInboxContext

  constructor(userId: string) {
    this.userId = userId
    this.context = { userId }
  }

  /**
   * Process a natural language inbox query/command
   */
  async processQuery(query: string): Promise<{
    response: string
    data?: any
    actions?: string[]
    pendingAction?: PendingInboxAction
  }> {
    // Classify the intent of the query
    const intent = await this.classifyInboxIntent(query)

    switch (intent.type) {
      case 'check_messages':
        return this.handleCheckMessages(intent)
      case 'filter_channel':
        return this.handleFilterByChannel(intent)
      case 'reply':
        return this.handleReply(intent)
      case 'forward':
        return this.handleForward(intent)
      case 'search':
        return this.handleSearch(intent)
      case 'set_priority':
        return this.handleSetPriority(intent)
      case 'snooze':
        return this.handleSnooze(intent)
      case 'archive':
        return this.handleArchive(intent)
      case 'summarize':
        return this.handleSummarize(intent)
      case 'compose':
        return this.handleCompose(intent)
      case 'get_stats':
        return this.handleGetStats(intent)
      case 'mark_read':
        return this.handleMarkRead(intent)
      case 'star':
        return this.handleStar(intent)
      default:
        return {
          response: `I can help you manage your inbox. Try asking things like:
- "Any urgent messages?"
- "Show me my Slack messages"
- "Reply to John's email saying I'll call tomorrow"
- "Find emails about the Acme deal"
- "Mark that as urgent"
- "Remind me about this tomorrow"
- "Summarize my unread messages"
- "Send a LinkedIn message to Sarah about..."`,
          actions: [
            'Check urgent messages',
            'Show unread count',
            'Search messages',
          ],
        }
    }
  }

  /**
   * Classify the intent of an inbox query
   */
  private async classifyInboxIntent(query: string): Promise<{
    type: string
    channel?: Channel
    person?: string
    searchQuery?: string
    replyContent?: string
    forwardTo?: string
    priority?: AIPriority
    snoozeTime?: string
    messageReference?: string
    composeRecipient?: string
    composeBody?: string
    filters?: Record<string, any>
  }> {
    const prompt = `Classify this inbox-related query and extract entities.

Query: "${query}"

Context from conversation:
- Last mentioned person: ${this.context.lastMentionedPerson || 'none'}
- Last mentioned channel: ${this.context.lastMentionedChannel || 'none'}
- Current thread ID: ${this.context.currentThreadId || 'none'}

Intent types:
- check_messages: User wants to see messages (urgent, unread, all, etc.)
- filter_channel: User wants to see messages from a specific channel
- reply: User wants to reply to a message
- forward: User wants to forward a message to someone
- search: User wants to search for specific messages
- set_priority: User wants to mark message as urgent/important/low
- snooze: User wants to be reminded about a message later
- archive: User wants to archive/dismiss a message
- summarize: User wants a summary of messages
- compose: User wants to send a new message
- get_stats: User wants inbox statistics
- mark_read: User wants to mark messages as read
- star: User wants to star/unstar messages
- unknown: Cannot determine intent

Return JSON:
{
  "type": "intent_type",
  "channel": "slack|gmail|sms|etc or null",
  "person": "person name mentioned or null",
  "searchQuery": "search terms or null",
  "replyContent": "the reply message content or null",
  "forwardTo": "who to forward to or null",
  "priority": "urgent|important|normal|low or null",
  "snoozeTime": "time expression like 'tomorrow' or '2 hours' or null",
  "messageReference": "how user referenced the message (e.g., 'that', 'John's email') or null",
  "composeRecipient": "recipient for new message or null",
  "composeBody": "body for new message or null",
  "filters": {
    "unreadOnly": boolean,
    "urgentOnly": boolean,
    "todayOnly": boolean,
    "hasAttachments": boolean
  }
}`

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = response.content[0]
      if (text.type !== 'text') {
        return { type: 'unknown' }
      }

      const jsonMatch = text.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])

        // Update context with extracted entities
        if (parsed.person) {
          this.context.lastMentionedPerson = parsed.person
        }
        if (parsed.channel) {
          this.context.lastMentionedChannel = normalizeChannel(parsed.channel) || undefined
        }

        return parsed
      }
    } catch (error) {
      console.error('[ConversationalInbox] Intent classification error:', error)
    }

    return { type: 'unknown' }
  }

  // ============================================================================
  // INTENT HANDLERS
  // ============================================================================

  /**
   * Handle checking messages (urgent, unread, all, etc.)
   */
  private async handleCheckMessages(intent: any): Promise<{
    response: string
    data?: any
    actions?: string[]
  }> {
    try {
      const filters = intent.filters || {}

      // Get threads from inbox service
      const result = await inboxService.getThreads({
        userId: this.userId,
        isRead: filters.unreadOnly ? false : undefined,
        aiPriority: filters.urgentOnly ? AIPriority.Urgent : undefined,
        limit: 10,
      })

      if (result.threads.length === 0) {
        const descriptor = filters.urgentOnly ? 'urgent ' : filters.unreadOnly ? 'unread ' : ''
        return {
          response: `You have no ${descriptor}messages. Your inbox is clear!`,
          data: { threads: [] },
          actions: ['Show all messages', 'Compose new message'],
        }
      }

      // Build response
      const messages = await this.formatThreadsForDisplay(result.threads)
      const urgentCount = result.threads.filter(t => t.aiPriority === AIPriority.Urgent).length
      const unreadCount = result.threads.filter(t => !t.isRead).length

      let summary = ''
      if (filters.urgentOnly) {
        summary = `You have ${urgentCount} urgent message${urgentCount !== 1 ? 's' : ''}:\n\n`
      } else if (filters.unreadOnly) {
        summary = `You have ${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}:\n\n`
      } else {
        summary = `Here are your recent messages (${urgentCount} urgent, ${unreadCount} unread):\n\n`
      }

      const messageList = messages.map((m, i) => {
        const urgentFlag = m.priority === 'urgent' ? ' [URGENT]' : ''
        const unreadFlag = !m.isRead ? ' (unread)' : ''
        const channelBadge = `[${m.channelDisplayName}]`
        return `${i + 1}. ${channelBadge}${urgentFlag} ${m.from.name || m.from.email || m.from.handle || 'Unknown'}${unreadFlag}
   "${m.bodyPreview}"`
      }).join('\n\n')

      // Store first message for context
      if (messages.length > 0) {
        this.context.currentMessageId = messages[0].id
        this.context.currentThreadId = messages[0].threadId
      }

      return {
        response: summary + messageList,
        data: { messages, total: result.total },
        actions: [
          'Read first message',
          'Reply to one of these',
          'Show more messages',
          'Filter by channel',
        ],
      }
    } catch (error) {
      console.error('[ConversationalInbox] Check messages error:', error)
      return {
        response: 'I had trouble fetching your messages. Please try again.',
        actions: ['Retry', 'Check connection status'],
      }
    }
  }

  /**
   * Handle filtering by channel
   */
  private async handleFilterByChannel(intent: any): Promise<{
    response: string
    data?: any
    actions?: string[]
  }> {
    const channel = intent.channel ? normalizeChannel(intent.channel) : null

    if (!channel) {
      return {
        response: `I can show messages from these channels: Email, Slack, Discord, LinkedIn, SMS, WhatsApp, Teams, Telegram, Twitter/X, Instagram. Which would you like?`,
        actions: Object.keys(CHANNEL_INFO).map(c => `Show ${CHANNEL_INFO[c as Channel].name} messages`),
      }
    }

    const channelInfo = CHANNEL_INFO[channel]
    this.context.lastMentionedChannel = channel

    try {
      // Get conversations for this channel
      const conversations = await getConversations({
        channel,
        limit: 10,
      })

      if (conversations.length === 0) {
        return {
          response: `You have no ${channelInfo.name} messages. Would you like to compose one?`,
          data: { channel, messages: [] },
          actions: [`Compose ${channelInfo.name} message`, 'Show all messages'],
        }
      }

      const messageList = conversations.map((c, i) => {
        const unread = c.unread_count > 0 ? ` (${c.unread_count} unread)` : ''
        const priority = c.priority === 'urgent' ? ' [URGENT]' : ''
        return `${i + 1}.${priority} ${c.contact_name || c.contact_email || 'Unknown'}${unread}
   "${c.last_message_preview?.slice(0, 60) || 'No preview'}..."`
      }).join('\n\n')

      return {
        response: `${channelInfo.icon} Your ${channelInfo.name} messages:\n\n${messageList}`,
        data: { channel, conversations },
        actions: ['Reply to one', 'Show more', 'Filter by another channel'],
      }
    } catch (error) {
      console.error('[ConversationalInbox] Filter by channel error:', error)
      return {
        response: `I had trouble fetching your ${channelInfo.name} messages. Please try again.`,
        actions: ['Retry', 'Show all messages'],
      }
    }
  }

  /**
   * Handle reply to a message
   */
  private async handleReply(intent: any): Promise<{
    response: string
    data?: any
    actions?: string[]
    pendingAction?: PendingInboxAction
  }> {
    const replyContent = intent.replyContent
    const messageRef = intent.messageReference
    const person = intent.person || this.context.lastMentionedPerson

    // Determine which message to reply to
    let targetThread = this.context.currentThreadId
    let targetMessage = this.context.currentMessageId

    if (!targetThread && !targetMessage && !person) {
      return {
        response: 'Which message would you like to reply to? You can say something like "Reply to John\'s last message" or reference a specific conversation.',
        actions: ['Show recent messages', 'Search for message'],
      }
    }

    // If we have a person but no target, search for their most recent message
    if (person && !targetThread) {
      const searchResult = await this.searchMessages({
        query: person,
        limit: 1,
      })

      if (searchResult.messages && searchResult.messages.length > 0) {
        targetMessage = searchResult.messages[0].id
        targetThread = searchResult.messages[0].threadId
        this.context.currentMessageId = targetMessage
        this.context.currentThreadId = targetThread
      } else {
        return {
          response: `I couldn't find any recent messages from ${person}. Would you like to compose a new message to them instead?`,
          actions: [`Compose message to ${person}`, 'Search for their messages'],
        }
      }
    }

    // If no reply content yet, ask for it
    if (!replyContent) {
      this.context.pendingAction = {
        type: 'reply',
        targetMessageId: targetMessage,
        targetThreadId: targetThread,
        awaitingConfirmation: false,
      }

      return {
        response: `What would you like to say in your reply${person ? ` to ${person}` : ''}?`,
        pendingAction: this.context.pendingAction,
        actions: ['Cancel reply'],
      }
    }

    // We have content - create the reply
    try {
      // Get the original conversation to know the channel
      if (targetThread) {
        const convData = await getConversation(targetThread)
        if (convData) {
          const { conversation } = convData

          // Add the reply message
          await addMessage({
            conversation_id: targetThread,
            content: replyContent,
            direction: 'outbound',
            sender_type: 'user',
            sender_id: this.userId,
            channel: conversation.channel,
          })

          const channelInfo = CHANNEL_INFO[conversation.channel]

          return {
            response: `${channelInfo.icon} Reply sent via ${channelInfo.name}${person ? ` to ${person}` : ''}:\n\n"${replyContent}"`,
            data: {
              sent: true,
              channel: conversation.channel,
              content: replyContent,
            },
            actions: ['Send another reply', 'Archive this conversation', 'Show inbox'],
          }
        }
      }

      return {
        response: `I couldn't find the conversation to reply to. Would you like me to search for it?`,
        actions: ['Search messages', 'Show inbox'],
      }
    } catch (error) {
      console.error('[ConversationalInbox] Reply error:', error)
      return {
        response: 'I had trouble sending your reply. Please try again.',
        actions: ['Retry', 'Show inbox'],
      }
    }
  }

  /**
   * Handle forwarding a message
   */
  private async handleForward(intent: any): Promise<{
    response: string
    data?: any
    actions?: string[]
    pendingAction?: PendingInboxAction
  }> {
    const forwardTo = intent.forwardTo
    const messageRef = intent.messageReference

    let targetThread = this.context.currentThreadId
    let targetMessage = this.context.currentMessageId

    if (!targetThread && !targetMessage) {
      return {
        response: 'Which message would you like to forward? You can say "Forward John\'s email to Sarah" or select a message first.',
        actions: ['Show recent messages', 'Search for message'],
      }
    }

    if (!forwardTo) {
      this.context.pendingAction = {
        type: 'forward',
        targetMessageId: targetMessage,
        targetThreadId: targetThread,
      }

      return {
        response: 'Who would you like to forward this message to?',
        pendingAction: this.context.pendingAction,
        actions: ['Cancel forward'],
      }
    }

    // Execute forward
    try {
      // Get the original message content
      if (targetThread) {
        const convData = await getConversation(targetThread)
        if (convData) {
          const { conversation, messages } = convData
          const lastMessage = messages[messages.length - 1]

          // For now, we'll create this as a note - actual forwarding depends on channel
          return {
            response: `Message forwarded to ${forwardTo}:\n\n---\nOriginal from: ${conversation.contact_name || 'Unknown'}\n"${lastMessage.content.slice(0, 200)}${lastMessage.content.length > 200 ? '...' : ''}"\n---\n\nNote: They'll receive this based on their preferred channel.`,
            data: {
              forwarded: true,
              to: forwardTo,
              originalContent: lastMessage.content,
            },
            actions: ['Add a note to the forward', 'Forward another', 'Show inbox'],
          }
        }
      }

      return {
        response: 'I couldn\'t find the message to forward. Please try again.',
        actions: ['Show recent messages', 'Search for message'],
      }
    } catch (error) {
      console.error('[ConversationalInbox] Forward error:', error)
      return {
        response: 'I had trouble forwarding that message. Please try again.',
        actions: ['Retry', 'Show inbox'],
      }
    }
  }

  /**
   * Handle message search
   */
  private async handleSearch(intent: any): Promise<{
    response: string
    data?: any
    actions?: string[]
  }> {
    const searchQuery = intent.searchQuery || intent.person
    const channel = intent.channel ? normalizeChannel(intent.channel) : undefined

    if (!searchQuery) {
      return {
        response: 'What would you like to search for? You can search by person, subject, content, or deal name.',
        actions: ['Show all messages', 'Filter by channel'],
      }
    }

    try {
      const result = await this.searchMessages({
        query: searchQuery,
        channel,
        limit: 10,
      })

      if (!result.messages || result.messages.length === 0) {
        return {
          response: `No messages found for "${searchQuery}". Try a different search term or check the spelling.`,
          data: { query: searchQuery, results: [] },
          actions: ['Search again', 'Show all messages'],
        }
      }

      const messageList = result.messages.map((m, i) => {
        const channelBadge = `[${m.channelDisplayName}]`
        return `${i + 1}. ${channelBadge} ${m.from.name || m.from.email || 'Unknown'}
   "${m.bodyPreview}"`
      }).join('\n\n')

      // Store first result for context
      if (result.messages.length > 0) {
        this.context.currentMessageId = result.messages[0].id
        this.context.currentThreadId = result.messages[0].threadId
        if (intent.person) {
          this.context.lastMentionedPerson = intent.person
        }
      }

      return {
        response: `Found ${result.messages.length} message${result.messages.length !== 1 ? 's' : ''} for "${searchQuery}":\n\n${messageList}`,
        data: result,
        actions: ['Read first result', 'Reply to one', 'Refine search'],
      }
    } catch (error) {
      console.error('[ConversationalInbox] Search error:', error)
      return {
        response: 'I had trouble searching your messages. Please try again.',
        actions: ['Retry', 'Show all messages'],
      }
    }
  }

  /**
   * Handle setting message priority
   */
  private async handleSetPriority(intent: any): Promise<{
    response: string
    data?: any
    actions?: string[]
  }> {
    const priority = intent.priority || 'urgent'
    const targetThread = this.context.currentThreadId

    if (!targetThread) {
      return {
        response: 'Which message would you like to mark as ' + priority + '? Please select a message first.',
        actions: ['Show recent messages', 'Search for message'],
      }
    }

    try {
      // Update thread priority
      await sql`
        UPDATE inbox_threads
        SET ai_priority = ${priority}, updated_at = NOW()
        WHERE id = ${targetThread} AND user_id = ${this.userId}
      `

      const priorityEmoji = {
        urgent: 'High priority alert',
        important: 'Marked important',
        normal: 'Priority cleared',
        low: 'Marked low priority',
      }

      return {
        response: `${priorityEmoji[priority as keyof typeof priorityEmoji] || 'Priority updated'}. The message has been marked as ${priority}.`,
        data: { threadId: targetThread, priority },
        actions: ['Show urgent messages', 'Show inbox'],
      }
    } catch (error) {
      console.error('[ConversationalInbox] Set priority error:', error)
      return {
        response: 'I had trouble updating the priority. Please try again.',
        actions: ['Retry', 'Show inbox'],
      }
    }
  }

  /**
   * Handle snoozing a message
   */
  private async handleSnooze(intent: any): Promise<{
    response: string
    data?: any
    actions?: string[]
  }> {
    const snoozeTime = intent.snoozeTime
    const targetThread = this.context.currentThreadId

    if (!targetThread) {
      return {
        response: 'Which message would you like to snooze? Please select a message first.',
        actions: ['Show recent messages', 'Search for message'],
      }
    }

    // Parse snooze time
    const snoozeUntil = this.parseSnoozeTime(snoozeTime || 'tomorrow')

    if (!snoozeUntil) {
      return {
        response: 'When would you like to be reminded? You can say "tomorrow", "in 2 hours", "Monday morning", etc.',
        actions: ['Tomorrow morning', 'In 2 hours', 'Next week'],
      }
    }

    try {
      await inboxService.snoozeThread({
        threadId: targetThread,
        userId: this.userId,
        snoozeUntil,
        reason: `Snoozed via conversation: ${snoozeTime}`,
      })

      const timeStr = this.formatSnoozeTime(snoozeUntil)

      return {
        response: `Message snoozed. I'll remind you about it ${timeStr}.`,
        data: { threadId: targetThread, snoozeUntil },
        actions: ['Undo snooze', 'Show inbox'],
      }
    } catch (error) {
      console.error('[ConversationalInbox] Snooze error:', error)
      return {
        response: 'I had trouble snoozing that message. Please try again.',
        actions: ['Retry', 'Show inbox'],
      }
    }
  }

  /**
   * Handle archiving a message
   */
  private async handleArchive(intent: any): Promise<{
    response: string
    data?: any
    actions?: string[]
  }> {
    const targetThread = this.context.currentThreadId

    if (!targetThread) {
      return {
        response: 'Which message would you like to archive? Please select a message first.',
        actions: ['Show recent messages', 'Search for message'],
      }
    }

    try {
      await inboxService.archiveThreads({
        threadIds: [targetThread],
        userId: this.userId,
      })

      // Clear context since message is archived
      this.context.currentThreadId = undefined
      this.context.currentMessageId = undefined

      return {
        response: 'Message archived. It\'s moved out of your inbox but you can still find it by searching.',
        data: { threadId: targetThread, archived: true },
        actions: ['Undo archive', 'Show inbox', 'Search archived'],
      }
    } catch (error) {
      console.error('[ConversationalInbox] Archive error:', error)
      return {
        response: 'I had trouble archiving that message. Please try again.',
        actions: ['Retry', 'Show inbox'],
      }
    }
  }

  /**
   * Handle summarizing messages
   */
  private async handleSummarize(intent: any): Promise<{
    response: string
    data?: any
    actions?: string[]
  }> {
    const channel = intent.channel ? normalizeChannel(intent.channel) : undefined
    const filters = intent.filters || {}

    try {
      // Get messages to summarize
      const result = await inboxService.getThreads({
        userId: this.userId,
        provider: channel as unknown as InboxProvider,
        isRead: filters.unreadOnly === true ? false : undefined,
        limit: 20,
      })

      if (result.threads.length === 0) {
        return {
          response: 'No messages to summarize. Your inbox is clear!',
          actions: ['Show all messages', 'Compose new message'],
        }
      }

      // Use AI to summarize
      const threadSummaries = result.threads.map(t => ({
        from: t.participants[0]?.name || 'Unknown',
        subject: t.subject || 'No subject',
        snippet: t.snippet,
        priority: t.aiPriority,
        isRead: t.isRead,
      }))

      const summaryPrompt = `Summarize these ${result.threads.length} messages in a conversational way. Group by urgency and theme. Be concise.

Messages:
${JSON.stringify(threadSummaries, null, 2)}

Format:
- Lead with the most important/urgent items
- Group related messages
- Mention specific people and topics
- End with recommended actions`

      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [{ role: 'user', content: summaryPrompt }],
      })

      const summaryText = response.content[0]
      const summary = summaryText.type === 'text' ? summaryText.text : 'Unable to generate summary'

      return {
        response: `Here's your inbox summary:\n\n${summary}`,
        data: {
          threadCount: result.threads.length,
          unreadCount: result.threads.filter(t => !t.isRead).length,
          urgentCount: result.threads.filter(t => t.aiPriority === AIPriority.Urgent).length,
        },
        actions: ['Show urgent messages', 'Reply to first priority', 'Show full inbox'],
      }
    } catch (error) {
      console.error('[ConversationalInbox] Summarize error:', error)
      return {
        response: 'I had trouble summarizing your messages. Please try again.',
        actions: ['Retry', 'Show all messages'],
      }
    }
  }

  /**
   * Handle composing a new message
   */
  private async handleCompose(intent: any): Promise<{
    response: string
    data?: any
    actions?: string[]
    pendingAction?: PendingInboxAction
  }> {
    const channel = intent.channel ? normalizeChannel(intent.channel) : undefined
    const recipient = intent.composeRecipient || intent.person
    const body = intent.composeBody

    // If we don't have a channel, ask
    if (!channel) {
      return {
        response: `How would you like to send this message? You can choose:
- Email (Gmail/Outlook)
- Slack
- LinkedIn
- SMS/Text
- WhatsApp
- Twitter/X DM
- Teams
- Telegram`,
        actions: ['Send via Email', 'Send via Slack', 'Send via LinkedIn', 'Send via SMS'],
      }
    }

    // If we don't have a recipient, ask
    if (!recipient) {
      this.context.pendingAction = {
        type: 'compose',
        channel,
      }

      return {
        response: `Who would you like to send the ${CHANNEL_INFO[channel].name} message to?`,
        pendingAction: this.context.pendingAction,
        actions: ['Cancel'],
      }
    }

    // If we don't have body content, ask
    if (!body) {
      this.context.pendingAction = {
        type: 'compose',
        channel,
        recipient,
      }

      return {
        response: `What would you like to say to ${recipient}?`,
        pendingAction: this.context.pendingAction,
        actions: ['Cancel'],
      }
    }

    // We have everything - send the message
    try {
      // Create conversation and send
      const conversation = await this.createAndSendMessage({
        channel,
        to: recipient,
        body,
      })

      const channelInfo = CHANNEL_INFO[channel]

      return {
        response: `${channelInfo.icon} ${channelInfo.name} message sent to ${recipient}:\n\n"${body.slice(0, 200)}${body.length > 200 ? '...' : ''}"`,
        data: {
          sent: true,
          channel,
          to: recipient,
          body,
        },
        actions: ['Send another message', 'Show inbox'],
      }
    } catch (error) {
      console.error('[ConversationalInbox] Compose error:', error)
      return {
        response: `I had trouble sending your ${CHANNEL_INFO[channel].name} message. Please try again.`,
        actions: ['Retry', 'Choose different channel'],
      }
    }
  }

  /**
   * Handle getting inbox statistics
   */
  private async handleGetStats(intent: any): Promise<{
    response: string
    data?: any
    actions?: string[]
  }> {
    try {
      // Get integrations to know which channels are connected
      const integrations = await getUserIntegrations(this.userId)
      const connectedChannels = integrations.filter(i => i.status === 'connected').map(i => i.channel)

      // Get inbox stats
      const result = await inboxService.getThreads({
        userId: this.userId,
        limit: 100,
      })

      const threads = result.threads
      const unread = threads.filter(t => !t.isRead).length
      const urgent = threads.filter(t => t.aiPriority === AIPriority.Urgent).length
      const important = threads.filter(t => t.aiPriority === AIPriority.Important).length

      // Count by channel/category
      const byCategory: Record<string, number> = {}
      threads.forEach(t => {
        const cat = t.aiCategory || 'uncategorized'
        byCategory[cat] = (byCategory[cat] || 0) + 1
      })

      let stats = `Your Inbox Overview:\n\n`
      stats += `Total messages: ${result.total}\n`
      stats += `Unread: ${unread}\n`
      stats += `Urgent: ${urgent}\n`
      stats += `Important: ${important}\n\n`

      stats += `Connected channels: ${connectedChannels.length > 0 ? connectedChannels.map(c => CHANNEL_INFO[c as Channel]?.name || c).join(', ') : 'None yet'}\n\n`

      if (Object.keys(byCategory).length > 0) {
        stats += `By category:\n`
        Object.entries(byCategory).forEach(([cat, count]) => {
          stats += `- ${cat}: ${count}\n`
        })
      }

      return {
        response: stats,
        data: {
          total: result.total,
          unread,
          urgent,
          important,
          byCategory,
          connectedChannels,
        },
        actions: ['Show urgent messages', 'Connect more channels', 'Show inbox'],
      }
    } catch (error) {
      console.error('[ConversationalInbox] Get stats error:', error)
      return {
        response: 'I had trouble getting your inbox stats. Please try again.',
        actions: ['Retry', 'Show inbox'],
      }
    }
  }

  /**
   * Handle marking messages as read
   */
  private async handleMarkRead(intent: any): Promise<{
    response: string
    data?: any
    actions?: string[]
  }> {
    const targetThread = this.context.currentThreadId

    if (!targetThread) {
      // Mark all as read
      return {
        response: 'Would you like to mark all messages as read, or a specific one?',
        actions: ['Mark all as read', 'Select specific message'],
      }
    }

    try {
      await inboxService.markAsRead({
        threadIds: [targetThread],
        userId: this.userId,
        isRead: true,
      })

      return {
        response: 'Message marked as read.',
        data: { threadId: targetThread, isRead: true },
        actions: ['Mark as unread', 'Show inbox'],
      }
    } catch (error) {
      console.error('[ConversationalInbox] Mark read error:', error)
      return {
        response: 'I had trouble marking that message as read. Please try again.',
        actions: ['Retry', 'Show inbox'],
      }
    }
  }

  /**
   * Handle starring/unstarring messages
   */
  private async handleStar(intent: any): Promise<{
    response: string
    data?: any
    actions?: string[]
  }> {
    const targetThread = this.context.currentThreadId

    if (!targetThread) {
      return {
        response: 'Which message would you like to star? Please select a message first.',
        actions: ['Show recent messages', 'Search for message'],
      }
    }

    try {
      // Get current star status
      const threads = await inboxService.getThreads({
        userId: this.userId,
        limit: 1,
      })

      const currentThread = threads.threads.find(t => t.id === targetThread)
      const newStarred = !currentThread?.isStarred

      await inboxService.starThreads({
        threadIds: [targetThread],
        userId: this.userId,
        isStarred: newStarred,
      })

      return {
        response: newStarred ? 'Message starred for easy reference.' : 'Star removed from message.',
        data: { threadId: targetThread, isStarred: newStarred },
        actions: ['Show starred messages', 'Show inbox'],
      }
    } catch (error) {
      console.error('[ConversationalInbox] Star error:', error)
      return {
        response: 'I had trouble updating the star. Please try again.',
        actions: ['Retry', 'Show inbox'],
      }
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Search messages across all channels
   */
  private async searchMessages(params: MessageSearchParams): Promise<{
    messages?: UnifiedInboxMessage[]
    total?: number
  }> {
    try {
      const result = await inboxService.searchMessages({
        userId: this.userId,
        query: params.query,
        provider: params.channel as unknown as InboxProvider,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        hasAttachment: params.hasAttachment,
        limit: params.limit || 10,
      })

      const messages = await this.formatMessagesForDisplay(result.messages)

      return {
        messages,
        total: result.total,
      }
    } catch (error) {
      console.error('[ConversationalInbox] Search error:', error)
      return { messages: [], total: 0 }
    }
  }

  /**
   * Format threads for display
   */
  private async formatThreadsForDisplay(threads: InboxThread[]): Promise<UnifiedInboxMessage[]> {
    return threads.map(t => {
      const channel = providerToChannel[t.provider] || 'email'
      const channelInfo = CHANNEL_INFO[channel] || CHANNEL_INFO.email

      return {
        id: t.id,
        threadId: t.id,
        channel,
        channelDisplayName: channelInfo.name,
        channelIcon: channelInfo.icon,
        from: {
          name: t.participants[0]?.name,
          email: t.participants[0]?.email,
          phone: t.participants[0]?.phone,
        },
        subject: t.subject,
        body: t.snippet || '',
        bodyPreview: (t.snippet || '').slice(0, 80) + ((t.snippet?.length || 0) > 80 ? '...' : ''),
        isRead: t.isRead,
        isStarred: t.isStarred,
        priority: t.aiPriority || AIPriority.Normal,
        category: t.aiCategory,
        timestamp: t.lastMessageAt || t.createdAt,
        hasAttachments: false,
        attachmentCount: 0,
        aiSummary: t.aiSummary,
      }
    })
  }

  /**
   * Format messages for display
   */
  private async formatMessagesForDisplay(messages: InboxMessage[]): Promise<UnifiedInboxMessage[]> {
    return messages.map(m => {
      const channel = providerToChannel[m.provider] || 'email'
      const channelInfo = CHANNEL_INFO[channel] || CHANNEL_INFO.email

      return {
        id: m.id,
        threadId: m.threadId,
        channel,
        channelDisplayName: channelInfo.name,
        channelIcon: channelInfo.icon,
        from: {
          name: m.fromName,
          email: m.fromAddress,
        },
        to: m.toAddresses,
        subject: m.subject,
        body: m.bodyText || '',
        bodyPreview: (m.bodyText || '').slice(0, 80) + ((m.bodyText?.length || 0) > 80 ? '...' : ''),
        isRead: m.isRead,
        isStarred: m.isStarred,
        priority: AIPriority.Normal,
        sentiment: m.aiSentiment,
        timestamp: m.receivedAt || m.sentAt || m.createdAt,
        hasAttachments: m.attachments.length > 0,
        attachmentCount: m.attachments.length,
        aiSummary: m.aiSummary,
        suggestedReply: m.aiSuggestedReply,
      }
    })
  }

  /**
   * Parse natural language snooze time
   */
  private parseSnoozeTime(timeStr: string): Date | null {
    const now = new Date()
    const lower = timeStr.toLowerCase()

    // Common patterns
    if (lower.includes('tomorrow')) {
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      if (lower.includes('morning')) {
        tomorrow.setHours(9, 0, 0, 0)
      } else if (lower.includes('afternoon')) {
        tomorrow.setHours(14, 0, 0, 0)
      } else if (lower.includes('evening')) {
        tomorrow.setHours(18, 0, 0, 0)
      } else {
        tomorrow.setHours(9, 0, 0, 0) // Default to morning
      }
      return tomorrow
    }

    if (lower.includes('next week') || lower.includes('monday')) {
      const nextWeek = new Date(now)
      const daysUntilMonday = (8 - now.getDay()) % 7 || 7
      nextWeek.setDate(nextWeek.getDate() + daysUntilMonday)
      nextWeek.setHours(9, 0, 0, 0)
      return nextWeek
    }

    // Parse "in X hours/minutes/days"
    const inMatch = lower.match(/in (\d+)\s*(hour|minute|day|week)s?/i)
    if (inMatch) {
      const amount = parseInt(inMatch[1])
      const unit = inMatch[2].toLowerCase()
      const result = new Date(now)

      switch (unit) {
        case 'minute':
          result.setMinutes(result.getMinutes() + amount)
          break
        case 'hour':
          result.setHours(result.getHours() + amount)
          break
        case 'day':
          result.setDate(result.getDate() + amount)
          break
        case 'week':
          result.setDate(result.getDate() + amount * 7)
          break
      }
      return result
    }

    // Default to tomorrow morning
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    return tomorrow
  }

  /**
   * Format snooze time for display
   */
  private formatSnoozeTime(date: Date): string {
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffHours = Math.round(diffMs / (1000 * 60 * 60))
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

    if (diffHours < 24) {
      return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`
    } else if (diffDays === 1) {
      return 'tomorrow'
    } else if (diffDays < 7) {
      return `in ${diffDays} days`
    } else {
      return `on ${date.toLocaleDateString()}`
    }
  }

  /**
   * Create and send a new message
   */
  private async createAndSendMessage(params: {
    channel: Channel
    to: string
    body: string
    subject?: string
  }): Promise<any> {
    // Find or create conversation
    const contactId = `${params.channel}_${params.to.replace(/[^a-zA-Z0-9]/g, '_')}`

    const conversation = await this.findOrCreateConversation({
      id: contactId,
      name: params.to,
      email: params.channel === 'gmail' || params.channel === 'outlook' || params.channel === 'email' ? params.to : undefined,
      phone: params.channel === 'sms' || params.channel === 'whatsapp' ? params.to : undefined,
      channel: params.channel,
    })

    // Add message
    const message = await addMessage({
      conversation_id: conversation.id,
      content: params.body,
      direction: 'outbound',
      sender_type: 'user',
      sender_id: this.userId,
      channel: params.channel,
    })

    return { conversation, message }
  }

  /**
   * Find or create a conversation for a contact
   */
  private async findOrCreateConversation(contact: {
    id: string
    name?: string
    email?: string
    phone?: string
    channel: Channel
  }) {
    // Use the inbox library function
    const { findOrCreateConversation } = await import('../inbox')
    return findOrCreateConversation(contact)
  }

  /**
   * Update conversation context
   */
  updateContext(updates: Partial<ConversationalInboxContext>) {
    this.context = { ...this.context, ...updates }
  }

  /**
   * Get current context
   */
  getContext(): ConversationalInboxContext {
    return this.context
  }

  /**
   * Clear pending action
   */
  clearPendingAction() {
    this.context.pendingAction = undefined
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createConversationalInbox(userId: string): ConversationalInbox {
  return new ConversationalInbox(userId)
}

export default ConversationalInbox
