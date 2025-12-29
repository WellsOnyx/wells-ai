// @ts-nocheck
/**
 * Conversational Inbox API Route
 *
 * Provides a chat-based interface for managing communications across all channels.
 * Users can interact with their unified inbox through natural language.
 *
 * Endpoints:
 * POST /api/chat/inbox - Process inbox chat query
 *
 * Example queries:
 * - "Any urgent messages?"
 * - "Show me my Slack messages"
 * - "Reply to John's email saying I'll call tomorrow"
 * - "Forward that to Sarah"
 * - "Find emails about the Acme deal"
 * - "Mark that as urgent"
 * - "Remind me about this tomorrow"
 * - "Summarize my unread messages"
 * - "Send a LinkedIn message to Sarah about the partnership"
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  handleInboxIntent,
  classifyInboxQuery,
  isInboxQuery,
  InboxIntent,
  InboxIntentType,
  InboxEntities,
} from '@/lib/chat/handlers/inbox-handler'
import {
  ConversationalInbox,
  createConversationalInbox,
  PendingInboxAction,
} from '@/lib/inbox/conversational-inbox'
import { Channel, CHANNEL_INFO } from '@/lib/inbox'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ============================================================================
// TYPES
// ============================================================================

interface ChatInboxRequest {
  message: string
  conversationId?: string
  context?: {
    lastMessageId?: string
    lastThreadId?: string
    lastMentionedPerson?: string
    lastMentionedChannel?: string
    pendingAction?: PendingInboxAction
  }
}

interface ChatInboxResponse {
  success: boolean
  response: string
  data?: any
  suggestedActions?: string[]
  context?: {
    messageId?: string
    threadId?: string
    person?: string
    channel?: string
    pendingAction?: PendingInboxAction
  }
  requiresConfirmation?: boolean
  confirmationMessage?: string
  conversationId?: string
}

// Store conversation context in memory (in production, use Redis or database)
const conversationContexts = new Map<string, {
  inbox: ConversationalInbox
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  lastActivity: Date
}>()

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<ChatInboxResponse>> {
  try {
    // Authenticate user
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({
        success: false,
        response: 'Please sign in to access your inbox.',
      }, { status: 401 })
    }

    // Parse request
    const body: ChatInboxRequest = await request.json()
    const { message, conversationId, context } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({
        success: false,
        response: 'Please provide a message.',
      }, { status: 400 })
    }

    // Get or create conversation context
    const convId = conversationId || `inbox_${userId}_${Date.now()}`
    let convContext = conversationContexts.get(convId)

    if (!convContext) {
      convContext = {
        inbox: createConversationalInbox(userId),
        messages: [],
        lastActivity: new Date(),
      }
      conversationContexts.set(convId, convContext)
    }

    // Update context if provided
    if (context) {
      if (context.lastMessageId) {
        convContext.inbox.updateContext({ currentMessageId: context.lastMessageId })
      }
      if (context.lastThreadId) {
        convContext.inbox.updateContext({ currentThreadId: context.lastThreadId })
      }
      if (context.lastMentionedPerson) {
        convContext.inbox.updateContext({ lastMentionedPerson: context.lastMentionedPerson })
      }
      if (context.lastMentionedChannel) {
        convContext.inbox.updateContext({ lastMentionedChannel: context.lastMentionedChannel as Channel })
      }
      if (context.pendingAction) {
        convContext.inbox.updateContext({ pendingAction: context.pendingAction })
      }
    }

    // Check if this is a pending action response
    const currentContext = convContext.inbox.getContext()
    if (currentContext.pendingAction) {
      const result = await handlePendingAction(
        convContext.inbox,
        message,
        currentContext.pendingAction
      )

      // Update conversation history
      convContext.messages.push({ role: 'user', content: message })
      convContext.messages.push({ role: 'assistant', content: result.response })
      convContext.lastActivity = new Date()

      return NextResponse.json({
        success: result.success,
        response: result.response,
        data: result.data,
        suggestedActions: result.suggestedActions,
        context: {
          messageId: currentContext.currentMessageId,
          threadId: currentContext.currentThreadId,
          person: currentContext.lastMentionedPerson,
          channel: currentContext.lastMentionedChannel,
          pendingAction: result.pendingAction,
        },
        conversationId: convId,
      })
    }

    // Classify the intent using AI for better accuracy
    const intent = await classifyIntentWithAI(message, convContext.messages)

    // Handle the intent
    const result = await handleInboxIntent(intent, {
      userId,
      conversationId: convId,
      journey: 'inbox',
      mode: 'inbox_chat',
    })

    // Update conversation history
    convContext.messages.push({ role: 'user', content: message })
    convContext.messages.push({ role: 'assistant', content: result.message })
    convContext.lastActivity = new Date()

    // Keep only last 20 messages for context
    if (convContext.messages.length > 40) {
      convContext.messages = convContext.messages.slice(-40)
    }

    // Update inbox context based on result
    const updatedContext = convContext.inbox.getContext()

    return NextResponse.json({
      success: result.success,
      response: result.message,
      data: result.data,
      suggestedActions: result.suggestedFollowUps,
      context: {
        messageId: updatedContext.currentMessageId,
        threadId: updatedContext.currentThreadId,
        person: updatedContext.lastMentionedPerson,
        channel: updatedContext.lastMentionedChannel,
        pendingAction: result.pendingAction,
      },
      requiresConfirmation: result.requiresConfirmation,
      confirmationMessage: result.confirmationMessage,
      conversationId: convId,
    })

  } catch (error) {
    console.error('[Chat Inbox API] Error:', error)

    return NextResponse.json({
      success: false,
      response: 'I encountered an error processing your request. Please try again.',
      suggestedActions: ['Try again', 'Show inbox', 'Get help'],
    }, { status: 500 })
  }
}

// ============================================================================
// GET HANDLER - Get inbox status
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
      }, { status: 401 })
    }

    // Get inbox instance
    const inbox = createConversationalInbox(userId)

    // Get quick stats
    const result = await inbox.processQuery('show inbox stats')

    return NextResponse.json({
      success: true,
      stats: result.data,
      summary: result.response,
      suggestedActions: result.actions,
    })

  } catch (error) {
    console.error('[Chat Inbox API] GET Error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to get inbox status',
    }, { status: 500 })
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Classify intent using AI for more accurate understanding
 */
async function classifyIntentWithAI(
  message: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<InboxIntent> {
  // First try simple pattern matching
  const simpleIntent = classifyInboxQuery(message)

  // If we got a good match, use it
  if (simpleIntent.confidence >= 0.7) {
    return simpleIntent
  }

  // Use AI for more complex queries
  try {
    const recentHistory = conversationHistory.slice(-6)

    const prompt = `Classify this inbox management query and extract entities.

Query: "${message}"

Recent conversation:
${recentHistory.map(m => `${m.role}: ${m.content}`).join('\n')}

Intent types (choose one):
- check_urgent: Check urgent messages
- check_unread: Check unread messages
- check_all: Show all/recent messages
- filter_channel: Filter by channel (email, slack, sms, etc.)
- reply: Reply to a message
- forward: Forward/delegate a message
- search: Search for messages
- set_priority: Mark as urgent/important/low
- snooze: Snooze/remind later
- archive: Archive/dismiss message
- summarize: Summarize messages
- compose: Send new message
- stats: Get inbox statistics
- mark_read: Mark as read
- mark_unread: Mark as unread
- star: Star a message
- unstar: Remove star
- delete: Delete message
- help: Get help
- unknown: Cannot determine

Return JSON:
{
  "type": "intent_type",
  "entities": {
    "channel": "slack|gmail|sms|etc or null",
    "person": "person name or null",
    "searchQuery": "search terms or null",
    "replyContent": "reply message or null",
    "forwardTo": "forward recipient or null",
    "priority": "urgent|important|normal|low or null",
    "snoozeTime": "time expression or null",
    "messageReference": "message reference or null",
    "composeRecipient": "recipient or null",
    "composeSubject": "subject or null",
    "composeBody": "message body or null"
  },
  "confidence": 0.0-1.0
}`

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0]
    if (text.type === 'text') {
      const jsonMatch = text.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          type: parsed.type as InboxIntentType,
          entities: parsed.entities || {},
          confidence: parsed.confidence || 0.8,
          rawQuery: message,
        }
      }
    }
  } catch (error) {
    console.error('[Chat Inbox API] AI classification error:', error)
  }

  // Fall back to simple classification
  return simpleIntent
}

/**
 * Handle pending action continuation
 */
async function handlePendingAction(
  inbox: ConversationalInbox,
  message: string,
  pendingAction: PendingInboxAction
): Promise<{
  success: boolean
  response: string
  data?: any
  suggestedActions?: string[]
  pendingAction?: PendingInboxAction
}> {
  const lower = message.toLowerCase()

  // Check for cancel
  if (lower.includes('cancel') || lower.includes('never mind') || lower === 'no') {
    inbox.clearPendingAction()
    return {
      success: true,
      response: 'Cancelled. What else can I help you with?',
      suggestedActions: ['Show inbox', 'Check urgent messages'],
    }
  }

  // Process based on pending action type
  switch (pendingAction.type) {
    case 'reply': {
      // The message is the reply content
      const result = await inbox.processQuery(`reply saying ${message}`)
      return {
        success: true,
        response: result.response,
        data: result.data,
        suggestedActions: result.actions,
        pendingAction: result.pendingAction,
      }
    }

    case 'forward': {
      if (!pendingAction.recipient) {
        // The message is the recipient
        inbox.updateContext({
          pendingAction: { ...pendingAction, recipient: message },
        })
        return {
          success: true,
          response: `Got it. I'll forward to ${message}. Would you like to add a note?`,
          suggestedActions: ['No, just forward it', 'Add a note'],
          pendingAction: { ...pendingAction, recipient: message },
        }
      }
      // Execute forward with note
      const result = await inbox.processQuery(`forward to ${pendingAction.recipient}`)
      return {
        success: true,
        response: result.response,
        data: result.data,
        suggestedActions: result.actions,
      }
    }

    case 'compose': {
      if (!pendingAction.channel) {
        // The message specifies the channel
        const channel = message.toLowerCase().replace(/via|using|through/g, '').trim()
        const result = await inbox.processQuery(`send ${channel} message`)
        return {
          success: true,
          response: result.response,
          data: result.data,
          suggestedActions: result.actions,
          pendingAction: result.pendingAction,
        }
      }
      if (!pendingAction.recipient) {
        // The message is the recipient
        const result = await inbox.processQuery(`send to ${message}`)
        return {
          success: true,
          response: result.response,
          data: result.data,
          suggestedActions: result.actions,
          pendingAction: result.pendingAction,
        }
      }
      // The message is the body
      const result = await inbox.processQuery(`send message saying ${message}`)
      return {
        success: true,
        response: result.response,
        data: result.data,
        suggestedActions: result.actions,
      }
    }

    case 'snooze': {
      // The message is the snooze time
      const result = await inbox.processQuery(`snooze until ${message}`)
      return {
        success: true,
        response: result.response,
        data: result.data,
        suggestedActions: result.actions,
      }
    }

    case 'priority': {
      // The message is the priority level
      const result = await inbox.processQuery(`mark as ${message}`)
      return {
        success: true,
        response: result.response,
        data: result.data,
        suggestedActions: result.actions,
      }
    }

    default: {
      inbox.clearPendingAction()
      const result = await inbox.processQuery(message)
      return {
        success: true,
        response: result.response,
        data: result.data,
        suggestedActions: result.actions,
        pendingAction: result.pendingAction,
      }
    }
  }
}

// ============================================================================
// CLEANUP
// ============================================================================

// Clean up old conversation contexts periodically
setInterval(() => {
  const now = new Date()
  const maxAge = 30 * 60 * 1000 // 30 minutes

  for (const [id, context] of conversationContexts.entries()) {
    if (now.getTime() - context.lastActivity.getTime() > maxAge) {
      conversationContexts.delete(id)
    }
  }
}, 5 * 60 * 1000) // Every 5 minutes
