// @ts-nocheck
/**
 * Inbox Chat Handler
 *
 * Handles all inbox-related intents routed from the main chat system.
 * Provides a conversational interface to manage communications across
 * all integrated channels.
 *
 * Supported operations:
 * - Check messages (urgent, unread, filtered by channel)
 * - Reply to messages
 * - Forward/delegate messages
 * - Search across all channels
 * - Set priorities
 * - Snooze/archive
 * - Get summaries
 * - Compose new messages
 */

import { ConversationContext } from '../conversation-manager'
import {
  ConversationalInbox,
  createConversationalInbox,
  normalizeChannel,
  ConversationalInboxContext,
  PendingInboxAction,
} from '../../inbox/conversational-inbox'
import { Channel, CHANNEL_INFO } from '../../inbox'
import { AIPriority } from '../../inbox/types'

// ============================================================================
// TYPES
// ============================================================================

export interface InboxHandlerResult {
  success: boolean
  message: string
  data?: any
  suggestedFollowUps?: string[]
  pendingAction?: PendingInboxAction
  requiresConfirmation?: boolean
  confirmationMessage?: string
}

export interface InboxIntent {
  type: InboxIntentType
  entities: InboxEntities
  confidence: number
  rawQuery: string
}

export type InboxIntentType =
  | 'check_urgent'
  | 'check_unread'
  | 'check_all'
  | 'filter_channel'
  | 'reply'
  | 'forward'
  | 'search'
  | 'set_priority'
  | 'snooze'
  | 'archive'
  | 'summarize'
  | 'compose'
  | 'stats'
  | 'mark_read'
  | 'mark_unread'
  | 'star'
  | 'unstar'
  | 'delete'
  | 'help'
  | 'unknown'

export interface InboxEntities {
  channel?: string
  person?: string
  searchQuery?: string
  replyContent?: string
  forwardTo?: string
  priority?: string
  snoozeTime?: string
  messageReference?: string
  composeRecipient?: string
  composeSubject?: string
  composeBody?: string
}

// Cache of ConversationalInbox instances per user
const inboxInstances = new Map<string, ConversationalInbox>()

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Main inbox handler - routes inbox intents to appropriate handlers
 */
export async function handleInboxIntent(
  intent: InboxIntent,
  context: ConversationContext
): Promise<InboxHandlerResult> {
  // Get or create inbox instance for this user
  const inbox = getInboxInstance(context.userId)

  // Route to appropriate handler based on intent type
  switch (intent.type) {
    case 'check_urgent':
      return handleCheckUrgent(inbox, intent, context)

    case 'check_unread':
      return handleCheckUnread(inbox, intent, context)

    case 'check_all':
      return handleCheckAll(inbox, intent, context)

    case 'filter_channel':
      return handleFilterChannel(inbox, intent, context)

    case 'reply':
      return handleReply(inbox, intent, context)

    case 'forward':
      return handleForward(inbox, intent, context)

    case 'search':
      return handleSearch(inbox, intent, context)

    case 'set_priority':
      return handleSetPriority(inbox, intent, context)

    case 'snooze':
      return handleSnooze(inbox, intent, context)

    case 'archive':
      return handleArchive(inbox, intent, context)

    case 'summarize':
      return handleSummarize(inbox, intent, context)

    case 'compose':
      return handleCompose(inbox, intent, context)

    case 'stats':
      return handleStats(inbox, intent, context)

    case 'mark_read':
      return handleMarkRead(inbox, intent, context)

    case 'mark_unread':
      return handleMarkUnread(inbox, intent, context)

    case 'star':
      return handleStar(inbox, intent, context)

    case 'unstar':
      return handleUnstar(inbox, intent, context)

    case 'delete':
      return handleDelete(inbox, intent, context)

    case 'help':
      return handleHelp(inbox, intent, context)

    default:
      return handleUnknown(inbox, intent, context)
  }
}

// ============================================================================
// INTENT HANDLERS
// ============================================================================

/**
 * Check urgent messages
 */
async function handleCheckUrgent(
  inbox: ConversationalInbox,
  intent: InboxIntent,
  context: ConversationContext
): Promise<InboxHandlerResult> {
  const result = await inbox.processQuery('show urgent messages')

  return {
    success: true,
    message: result.response,
    data: result.data,
    suggestedFollowUps: result.actions || [
      'Reply to first message',
      'Mark as handled',
      'Show all messages',
    ],
  }
}

/**
 * Check unread messages
 */
async function handleCheckUnread(
  inbox: ConversationalInbox,
  intent: InboxIntent,
  context: ConversationContext
): Promise<InboxHandlerResult> {
  const result = await inbox.processQuery('show unread messages')

  return {
    success: true,
    message: result.response,
    data: result.data,
    suggestedFollowUps: result.actions || [
      'Reply to one',
      'Mark all as read',
      'Filter by channel',
    ],
  }
}

/**
 * Check all recent messages
 */
async function handleCheckAll(
  inbox: ConversationalInbox,
  intent: InboxIntent,
  context: ConversationContext
): Promise<InboxHandlerResult> {
  const result = await inbox.processQuery('show my messages')

  return {
    success: true,
    message: result.response,
    data: result.data,
    suggestedFollowUps: result.actions || [
      'Show urgent only',
      'Filter by channel',
      'Search messages',
    ],
  }
}

/**
 * Filter by channel
 */
async function handleFilterChannel(
  inbox: ConversationalInbox,
  intent: InboxIntent,
  context: ConversationContext
): Promise<InboxHandlerResult> {
  const channel = intent.entities.channel

  if (!channel) {
    return {
      success: true,
      message: `Which channel would you like to see? I can show you messages from:

- Email (Gmail/Outlook)
- Slack
- Discord
- LinkedIn
- SMS/Text
- WhatsApp
- Teams
- Twitter/X
- Instagram
- Telegram`,
      suggestedFollowUps: [
        'Show Slack messages',
        'Show emails',
        'Show LinkedIn messages',
        'Show SMS',
      ],
    }
  }

  const normalizedChannel = normalizeChannel(channel)
  if (!normalizedChannel) {
    return {
      success: false,
      message: `I don't recognize "${channel}" as a channel. Try "email", "slack", "sms", etc.`,
      suggestedFollowUps: ['Show available channels', 'Show all messages'],
    }
  }

  const result = await inbox.processQuery(`show my ${normalizedChannel} messages`)

  return {
    success: true,
    message: result.response,
    data: result.data,
    suggestedFollowUps: result.actions || [
      'Reply to one',
      'Filter by another channel',
      'Show all messages',
    ],
  }
}

/**
 * Reply to a message
 */
async function handleReply(
  inbox: ConversationalInbox,
  intent: InboxIntent,
  context: ConversationContext
): Promise<InboxHandlerResult> {
  const { person, replyContent, messageReference } = intent.entities

  // Build the query based on what we have
  let query = 'reply'
  if (person) query += ` to ${person}`
  if (messageReference) query += ` to ${messageReference}`
  if (replyContent) query += ` saying ${replyContent}`

  const result = await inbox.processQuery(query)

  // Check if we need more info
  if (result.pendingAction) {
    if (!result.pendingAction.targetThreadId && !person) {
      return {
        success: true,
        message: 'Which message would you like to reply to? You can say "reply to John" or select from your recent messages.',
        pendingAction: result.pendingAction,
        suggestedFollowUps: ['Show recent messages', 'Cancel'],
      }
    }

    if (!replyContent) {
      return {
        success: true,
        message: `What would you like to say${person ? ` to ${person}` : ''}?`,
        pendingAction: result.pendingAction,
        suggestedFollowUps: ['Cancel reply'],
      }
    }
  }

  return {
    success: true,
    message: result.response,
    data: result.data,
    suggestedFollowUps: result.actions || [
      'Send another reply',
      'Archive conversation',
      'Show inbox',
    ],
  }
}

/**
 * Forward a message
 */
async function handleForward(
  inbox: ConversationalInbox,
  intent: InboxIntent,
  context: ConversationContext
): Promise<InboxHandlerResult> {
  const { forwardTo, messageReference, person } = intent.entities

  let query = 'forward'
  if (messageReference) query += ` ${messageReference}`
  if (person) query += ` ${person}'s message`
  if (forwardTo) query += ` to ${forwardTo}`

  const result = await inbox.processQuery(query)

  if (result.pendingAction && !forwardTo) {
    return {
      success: true,
      message: 'Who would you like to forward this to?',
      pendingAction: result.pendingAction,
      suggestedFollowUps: ['Cancel forward'],
    }
  }

  return {
    success: true,
    message: result.response,
    data: result.data,
    suggestedFollowUps: result.actions || [
      'Add a note',
      'Forward to someone else',
      'Show inbox',
    ],
  }
}

/**
 * Search messages
 */
async function handleSearch(
  inbox: ConversationalInbox,
  intent: InboxIntent,
  context: ConversationContext
): Promise<InboxHandlerResult> {
  const { searchQuery, person, channel } = intent.entities

  const query = searchQuery || person

  if (!query) {
    return {
      success: true,
      message: 'What would you like to search for? You can search by person, subject, content, or deal/project name.',
      suggestedFollowUps: [
        'Search for [name]',
        'Find emails about [topic]',
        'Show all messages',
      ],
    }
  }

  let searchStr = `find messages about ${query}`
  if (channel) searchStr += ` in ${channel}`

  const result = await inbox.processQuery(searchStr)

  return {
    success: true,
    message: result.response,
    data: result.data,
    suggestedFollowUps: result.actions || [
      'Read first result',
      'Reply to one',
      'Refine search',
    ],
  }
}

/**
 * Set message priority
 */
async function handleSetPriority(
  inbox: ConversationalInbox,
  intent: InboxIntent,
  context: ConversationContext
): Promise<InboxHandlerResult> {
  const { priority, messageReference } = intent.entities

  const priorityValue = priority?.toLowerCase() || 'urgent'

  // Validate priority
  const validPriorities = ['urgent', 'important', 'normal', 'low']
  if (!validPriorities.includes(priorityValue)) {
    return {
      success: true,
      message: 'What priority would you like to set? Options are: urgent, important, normal, or low.',
      suggestedFollowUps: [
        'Mark as urgent',
        'Mark as important',
        'Mark as low priority',
      ],
    }
  }

  const result = await inbox.processQuery(`mark ${messageReference || 'this'} as ${priorityValue}`)

  return {
    success: true,
    message: result.response,
    data: result.data,
    suggestedFollowUps: result.actions || [
      'Show urgent messages',
      'Show inbox',
    ],
  }
}

/**
 * Snooze a message
 */
async function handleSnooze(
  inbox: ConversationalInbox,
  intent: InboxIntent,
  context: ConversationContext
): Promise<InboxHandlerResult> {
  const { snoozeTime, messageReference } = intent.entities

  if (!snoozeTime) {
    return {
      success: true,
      message: 'When would you like to be reminded about this message? You can say "tomorrow", "in 2 hours", "next Monday", etc.',
      suggestedFollowUps: [
        'Tomorrow morning',
        'In 2 hours',
        'Next week',
        'Cancel',
      ],
    }
  }

  const result = await inbox.processQuery(`remind me about ${messageReference || 'this'} ${snoozeTime}`)

  return {
    success: true,
    message: result.response,
    data: result.data,
    suggestedFollowUps: result.actions || [
      'Undo snooze',
      'Show inbox',
    ],
  }
}

/**
 * Archive a message
 */
async function handleArchive(
  inbox: ConversationalInbox,
  intent: InboxIntent,
  context: ConversationContext
): Promise<InboxHandlerResult> {
  const result = await inbox.processQuery('archive this message')

  return {
    success: true,
    message: result.response,
    data: result.data,
    suggestedFollowUps: result.actions || [
      'Undo archive',
      'Show inbox',
    ],
  }
}

/**
 * Summarize messages
 */
async function handleSummarize(
  inbox: ConversationalInbox,
  intent: InboxIntent,
  context: ConversationContext
): Promise<InboxHandlerResult> {
  const { channel } = intent.entities

  let query = 'summarize my messages'
  if (channel) {
    const normalizedChannel = normalizeChannel(channel)
    if (normalizedChannel) {
      query = `summarize my ${normalizedChannel} messages`
    }
  }

  const result = await inbox.processQuery(query)

  return {
    success: true,
    message: result.response,
    data: result.data,
    suggestedFollowUps: result.actions || [
      'Show urgent messages',
      'Reply to first priority',
      'Show full inbox',
    ],
  }
}

/**
 * Compose a new message
 */
async function handleCompose(
  inbox: ConversationalInbox,
  intent: InboxIntent,
  context: ConversationContext
): Promise<InboxHandlerResult> {
  const { channel, composeRecipient, composeSubject, composeBody } = intent.entities

  // Build compose query
  let query = 'send'
  if (channel) {
    const normalizedChannel = normalizeChannel(channel)
    if (normalizedChannel) {
      query += ` a ${normalizedChannel} message`
    }
  } else {
    query += ' a message'
  }
  if (composeRecipient) query += ` to ${composeRecipient}`
  if (composeBody) query += ` saying ${composeBody}`

  const result = await inbox.processQuery(query)

  // Check what info we still need
  if (result.pendingAction) {
    if (!channel) {
      return {
        success: true,
        message: `How would you like to send this message?

Choose a channel:
- Email
- Slack
- LinkedIn
- SMS/Text
- WhatsApp
- Twitter DM
- Teams
- Discord
- Telegram`,
        pendingAction: result.pendingAction,
        suggestedFollowUps: [
          'Send via Email',
          'Send via Slack',
          'Send via LinkedIn',
          'Send via SMS',
        ],
      }
    }

    if (!composeRecipient) {
      return {
        success: true,
        message: `Who would you like to send the ${channel} message to?`,
        pendingAction: result.pendingAction,
        suggestedFollowUps: ['Cancel'],
      }
    }

    if (!composeBody) {
      return {
        success: true,
        message: `What would you like to say to ${composeRecipient}?`,
        pendingAction: result.pendingAction,
        suggestedFollowUps: ['Cancel'],
      }
    }
  }

  return {
    success: true,
    message: result.response,
    data: result.data,
    suggestedFollowUps: result.actions || [
      'Send another message',
      'Show inbox',
    ],
  }
}

/**
 * Get inbox statistics
 */
async function handleStats(
  inbox: ConversationalInbox,
  intent: InboxIntent,
  context: ConversationContext
): Promise<InboxHandlerResult> {
  const result = await inbox.processQuery('show inbox stats')

  return {
    success: true,
    message: result.response,
    data: result.data,
    suggestedFollowUps: result.actions || [
      'Show urgent messages',
      'Connect more channels',
      'Show inbox',
    ],
  }
}

/**
 * Mark messages as read
 */
async function handleMarkRead(
  inbox: ConversationalInbox,
  intent: InboxIntent,
  context: ConversationContext
): Promise<InboxHandlerResult> {
  const result = await inbox.processQuery('mark as read')

  return {
    success: true,
    message: result.response,
    data: result.data,
    suggestedFollowUps: result.actions || [
      'Mark as unread',
      'Show inbox',
    ],
  }
}

/**
 * Mark messages as unread
 */
async function handleMarkUnread(
  inbox: ConversationalInbox,
  intent: InboxIntent,
  context: ConversationContext
): Promise<InboxHandlerResult> {
  const result = await inbox.processQuery('mark as unread')

  return {
    success: true,
    message: result.response,
    data: result.data,
    suggestedFollowUps: result.actions || [
      'Show unread messages',
      'Show inbox',
    ],
  }
}

/**
 * Star a message
 */
async function handleStar(
  inbox: ConversationalInbox,
  intent: InboxIntent,
  context: ConversationContext
): Promise<InboxHandlerResult> {
  const result = await inbox.processQuery('star this message')

  return {
    success: true,
    message: result.response,
    data: result.data,
    suggestedFollowUps: result.actions || [
      'Show starred messages',
      'Show inbox',
    ],
  }
}

/**
 * Unstar a message
 */
async function handleUnstar(
  inbox: ConversationalInbox,
  intent: InboxIntent,
  context: ConversationContext
): Promise<InboxHandlerResult> {
  const result = await inbox.processQuery('remove star from this message')

  return {
    success: true,
    message: result.response,
    data: result.data,
    suggestedFollowUps: result.actions || [
      'Show starred messages',
      'Show inbox',
    ],
  }
}

/**
 * Delete a message
 */
async function handleDelete(
  inbox: ConversationalInbox,
  intent: InboxIntent,
  context: ConversationContext
): Promise<InboxHandlerResult> {
  return {
    success: true,
    message: 'Are you sure you want to delete this message? This action cannot be undone. Archiving is usually a better option.',
    requiresConfirmation: true,
    confirmationMessage: 'Delete this message permanently?',
    suggestedFollowUps: [
      'Yes, delete it',
      'No, archive instead',
      'Cancel',
    ],
  }
}

/**
 * Show help for inbox commands
 */
async function handleHelp(
  inbox: ConversationalInbox,
  intent: InboxIntent,
  context: ConversationContext
): Promise<InboxHandlerResult> {
  const helpMessage = `I can help you manage your unified inbox across all channels. Here's what I can do:

**Check Messages**
- "Any urgent messages?"
- "Show my unread messages"
- "What's in my inbox?"

**Filter by Channel**
- "Show me my Slack messages"
- "Any new emails?"
- "Check my LinkedIn messages"

**Reply & Compose**
- "Reply to John's email saying I'll call tomorrow"
- "Send a Slack message to Sarah about the meeting"
- "Text Mike that I'm running late"

**Forward & Delegate**
- "Forward that to Sarah"
- "Send this to the team"

**Search**
- "Find emails about the Acme deal"
- "Search for messages from John"
- "Show me all messages about the proposal"

**Organize**
- "Mark that as urgent"
- "Archive this conversation"
- "Remind me about this tomorrow"
- "Star this message"

**Summarize**
- "Summarize my unread messages"
- "What should I focus on today?"

**Connected Channels**
Email, Slack, Discord, LinkedIn, SMS, WhatsApp, Teams, Twitter/X, Instagram, Telegram, iMessage`

  return {
    success: true,
    message: helpMessage,
    suggestedFollowUps: [
      'Check urgent messages',
      'Show inbox stats',
      'Connect a new channel',
    ],
  }
}

/**
 * Handle unknown intent
 */
async function handleUnknown(
  inbox: ConversationalInbox,
  intent: InboxIntent,
  context: ConversationContext
): Promise<InboxHandlerResult> {
  // Try to process the raw query directly
  const result = await inbox.processQuery(intent.rawQuery)

  if (result.response && !result.response.includes("I can help you manage")) {
    return {
      success: true,
      message: result.response,
      data: result.data,
      suggestedFollowUps: result.actions,
    }
  }

  return {
    success: false,
    message: `I'm not sure what you'd like to do with your inbox. Try asking:
- "Show my messages"
- "Any urgent emails?"
- "Reply to John"
- "Search for [topic]"`,
    suggestedFollowUps: [
      'Show inbox',
      'Help with inbox commands',
    ],
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get or create inbox instance for user
 */
function getInboxInstance(userId: string): ConversationalInbox {
  if (!inboxInstances.has(userId)) {
    inboxInstances.set(userId, createConversationalInbox(userId))
  }
  return inboxInstances.get(userId)!
}

/**
 * Clear inbox instance cache (for testing or cleanup)
 */
export function clearInboxInstance(userId: string): void {
  inboxInstances.delete(userId)
}

/**
 * Clear all inbox instances
 */
export function clearAllInboxInstances(): void {
  inboxInstances.clear()
}

/**
 * Classify an inbox-related query into an intent
 * Used by the main chat system to route to this handler
 */
export function classifyInboxQuery(query: string): InboxIntent {
  const lower = query.toLowerCase()

  // Detect intent type from keywords
  let type: InboxIntentType = 'unknown'
  const entities: InboxEntities = {}

  // Check urgent/unread
  if (lower.includes('urgent') || lower.includes('emergency') || lower.includes('critical')) {
    type = 'check_urgent'
  } else if (lower.includes('unread') || lower.includes('new message')) {
    type = 'check_unread'
  }

  // Check for channel filter
  const channelPatterns: Record<string, string> = {
    'slack': 'slack',
    'email': 'email',
    'gmail': 'gmail',
    'outlook': 'outlook',
    'linkedin': 'linkedin',
    'sms': 'sms',
    'text message': 'sms',
    'texts': 'sms',
    'whatsapp': 'whatsapp',
    'teams': 'teams',
    'discord': 'discord',
    'twitter': 'twitter',
    'instagram': 'instagram',
    'telegram': 'telegram',
    'imessage': 'imessage',
  }

  for (const [pattern, channel] of Object.entries(channelPatterns)) {
    if (lower.includes(pattern)) {
      entities.channel = channel
      if (type === 'unknown') type = 'filter_channel'
      break
    }
  }

  // Check for reply
  if (lower.includes('reply') || lower.includes('respond')) {
    type = 'reply'
    // Extract reply content after "saying" or ":"
    const sayingMatch = query.match(/(?:saying|:)\s*(.+)$/i)
    if (sayingMatch) {
      entities.replyContent = sayingMatch[1].trim()
    }
  }

  // Check for forward
  if (lower.includes('forward') || lower.includes('send to') || lower.includes('delegate')) {
    type = 'forward'
    // Extract recipient after "to"
    const toMatch = query.match(/(?:to|forward to)\s+(\w+)/i)
    if (toMatch) {
      entities.forwardTo = toMatch[1]
    }
  }

  // Check for search
  if (lower.includes('search') || lower.includes('find') || lower.includes('look for')) {
    type = 'search'
    // Extract search query
    const searchMatch = query.match(/(?:search|find|look for)\s+(?:messages?\s+)?(?:about\s+)?(.+?)(?:\s+in|\s*$)/i)
    if (searchMatch) {
      entities.searchQuery = searchMatch[1].trim()
    }
  }

  // Check for priority
  if (lower.includes('mark as') || lower.includes('set priority') || lower.includes('make urgent')) {
    type = 'set_priority'
    if (lower.includes('urgent')) entities.priority = 'urgent'
    else if (lower.includes('important')) entities.priority = 'important'
    else if (lower.includes('low')) entities.priority = 'low'
    else if (lower.includes('normal')) entities.priority = 'normal'
  }

  // Check for snooze
  if (lower.includes('snooze') || lower.includes('remind me') || lower.includes('later')) {
    type = 'snooze'
    // Extract time
    const timeMatch = query.match(/(?:snooze|remind me|later)\s*(?:about this)?\s*(.+?)$/i)
    if (timeMatch) {
      entities.snoozeTime = timeMatch[1].trim()
    }
  }

  // Check for archive
  if (lower.includes('archive') || lower.includes('done with')) {
    type = 'archive'
  }

  // Check for summarize
  if (lower.includes('summarize') || lower.includes('summary') || lower.includes('overview')) {
    type = 'summarize'
  }

  // Check for compose
  if (lower.includes('send') || lower.includes('compose') || lower.includes('write')) {
    if (type !== 'forward') {
      type = 'compose'
      // Extract recipient
      const recipientMatch = query.match(/(?:to|message)\s+(\w+)/i)
      if (recipientMatch) {
        entities.composeRecipient = recipientMatch[1]
      }
      // Extract body
      const bodyMatch = query.match(/(?:saying|about|:)\s*(.+)$/i)
      if (bodyMatch) {
        entities.composeBody = bodyMatch[1].trim()
      }
    }
  }

  // Check for stats
  if (lower.includes('stats') || lower.includes('statistics') || lower.includes('how many')) {
    type = 'stats'
  }

  // Check for read/unread
  if (lower.includes('mark as read') || lower.includes('mark read')) {
    type = 'mark_read'
  } else if (lower.includes('mark as unread') || lower.includes('mark unread')) {
    type = 'mark_unread'
  }

  // Check for star
  if (lower.includes('star') && !lower.includes('unstar')) {
    type = 'star'
  } else if (lower.includes('unstar') || lower.includes('remove star')) {
    type = 'unstar'
  }

  // Check for delete
  if (lower.includes('delete') || lower.includes('trash')) {
    type = 'delete'
  }

  // Check for help
  if (lower.includes('help') || lower.includes('what can') || lower.includes('how do i')) {
    type = 'help'
  }

  // Default to check_all if just showing inbox
  if (type === 'unknown' && (lower.includes('inbox') || lower.includes('messages') || lower.includes('show'))) {
    type = 'check_all'
  }

  // Extract person mentioned
  const personPatterns = [
    /(?:from|to)\s+(\w+)/i,
    /(\w+)'s\s+(?:message|email|slack)/i,
    /(?:reply|respond)\s+to\s+(\w+)/i,
  ]

  for (const pattern of personPatterns) {
    const match = query.match(pattern)
    if (match) {
      entities.person = match[1]
      break
    }
  }

  return {
    type,
    entities,
    confidence: type === 'unknown' ? 0.3 : 0.8,
    rawQuery: query,
  }
}

/**
 * Check if a query is inbox-related
 */
export function isInboxQuery(query: string): boolean {
  const lower = query.toLowerCase()

  const inboxKeywords = [
    'inbox',
    'messages',
    'email',
    'emails',
    'slack',
    'unread',
    'urgent message',
    'reply',
    'forward',
    'compose',
    'send message',
    'send to',
    'linkedin message',
    'sms',
    'text message',
    'whatsapp',
    'teams message',
    'discord',
    'snooze',
    'archive',
    'summarize messages',
    'communication',
    'dm',
    'direct message',
  ]

  return inboxKeywords.some(keyword => lower.includes(keyword))
}

// ============================================================================
// TOOL DEFINITIONS FOR CHAT SYSTEM
// ============================================================================

export const inboxTools = {
  handleInboxIntent,
  classifyInboxQuery,
  isInboxQuery,
  clearInboxInstance,
  clearAllInboxInstances,
}

export default inboxTools
