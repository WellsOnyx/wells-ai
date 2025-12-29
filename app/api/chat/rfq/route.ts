// @ts-nocheck
/**
 * RFQ Chat API Route
 *
 * Handles conversational RFQ operations through a chat interface.
 * Accepts natural language input and returns structured responses
 * with suggested actions and follow-ups.
 *
 * Endpoints:
 * POST /api/chat/rfq - Process RFQ-related chat messages
 *
 * Request body:
 * {
 *   message: string          - User's natural language message
 *   sessionId?: string       - Chat session ID for context
 *   context?: {              - Optional context from previous messages
 *     rfqId?: string
 *     quoteId?: string
 *     action?: string
 *   }
 * }
 *
 * Response:
 * {
 *   success: boolean
 *   response: {
 *     message: string        - Natural language response
 *     data?: object          - Structured data (RFQ details, quotes, etc.)
 *     quickActions?: array   - Suggested quick action buttons
 *     suggestions?: array    - Follow-up suggestions
 *   }
 *   sessionId: string
 *   timestamp: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRFQHandler, RFQHandlerResult } from '@/lib/chat/handlers/rfq-handler'
import { classifyIntent, ExtractedEntities } from '@/lib/chat/intent-router'
import {
  getConversationContext,
  saveConversationContext,
  addMessage,
  ConversationContext,
} from '@/lib/chat/conversation-manager'

// Helper to get or create conversation context
async function getOrCreateConversation(sessionId: string, userId: string): Promise<ConversationContext> {
  const existing = await getConversationContext(sessionId)
  if (existing) return existing

  // Create new context
  const newContext: ConversationContext = {
    sessionId,
    userId,
    state: 'active',
    messages: [],
    activeDeals: [],
    startedAt: new Date(),
    lastInteractionAt: new Date(),
  }

  await saveConversationContext(newContext)
  return newContext
}

// Extract entities from classified intent
function extractEntities(message: string, intent: { intent: string }): ExtractedEntities {
  const entities: ExtractedEntities = {}

  // Extract quantity (e.g., "500 motors")
  const quantityMatch = message.match(/(\d+(?:,\d+)?)\s*(?:units?|pieces?|items?)?/i)
  if (quantityMatch) {
    entities.quantity = parseInt(quantityMatch[1].replace(',', ''), 10)
  }

  // Extract product name
  const productPatterns = [
    /(?:need|order|buy|get|source|find)\s+(?:\d+\s+)?(.+?)(?:\s+for|\s+by|\s+before|$)/i,
    /looking for\s+(.+?)(?:\s+for|\s+by|\s+before|$)/i,
  ]
  for (const pattern of productPatterns) {
    const match = message.match(pattern)
    if (match) {
      entities.productName = match[1].trim()
      break
    }
  }

  // Extract amount/budget
  const amountMatch = message.match(/\$\s*(\d+(?:,\d+)?(?:\.\d+)?)/i)
  if (amountMatch) {
    entities.amount = parseFloat(amountMatch[1].replace(',', ''))
  }

  // Extract deadline
  const deadlinePatterns = [
    /by\s+(next\s+\w+|\w+\s+\d+(?:st|nd|rd|th)?)/i,
    /before\s+(next\s+\w+|\w+\s+\d+(?:st|nd|rd|th)?)/i,
    /within\s+(\d+\s+(?:days?|weeks?|months?))/i,
  ]
  for (const pattern of deadlinePatterns) {
    const match = message.match(pattern)
    if (match) {
      entities.rawValues = { ...entities.rawValues, deadline: match[1] }
      break
    }
  }

  // Extract urgency
  if (/urgent|asap|immediately|rush/i.test(message)) {
    entities.urgency = 'urgent'
  } else if (/soon|quick/i.test(message)) {
    entities.urgency = 'high'
  }

  // Extract supplier/company names
  const fromMatch = message.match(/from\s+([A-Z][a-zA-Z\s]+?)(?:\s+for|\s+by|$)/i)
  if (fromMatch) {
    entities.supplierName = fromMatch[1].trim()
  }

  return entities
}

// ============================================================================
// TYPES
// ============================================================================

interface ChatRequest {
  message: string
  sessionId?: string
  userId?: string
  context?: {
    rfqId?: string
    quoteId?: string
    orderId?: string
    action?: string
    previousIntent?: string
  }
}

interface ChatResponse {
  success: boolean
  response: {
    message: string
    data?: Record<string, unknown>
    quickActions?: Array<{
      label: string
      action: string
      params?: Record<string, unknown>
      primary?: boolean
    }>
    suggestions?: string[]
    requiresMoreInfo?: boolean
    missingFields?: string[]
  }
  sessionId: string
  conversationState?: Record<string, unknown>
  timestamp: string
  processingTime: number
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  const startTime = Date.now()

  try {
    // Parse request body
    const body: ChatRequest = await request.json()

    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json(
        {
          success: false,
          response: {
            message: 'Please provide a message.',
            suggestions: ['I need 500 motors', "What's the status of my order?", 'Show me my RFQs'],
          },
          sessionId: body.sessionId || generateSessionId(),
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime,
        },
        { status: 400 }
      )
    }

    // Get or generate session ID
    const sessionId = body.sessionId || generateSessionId()

    // Get user ID (from auth or request)
    const userId = body.userId || getUserIdFromRequest(request) || 'anonymous'

    // Get or create conversation context
    const context = await getOrCreateConversation(sessionId, userId)

    // Add user message to conversation
    addMessage(context, 'user', body.message)

    // Classify intent
    const intent = await classifyIntent(body.message, context)

    // Extract entities from message
    const entities = await extractEntities(body.message, intent)

    // Merge with provided context
    if (body.context?.rfqId) entities.rfqId = body.context.rfqId
    if (body.context?.quoteId) entities.quoteId = body.context.quoteId
    if (body.context?.orderId) entities.orderId = body.context.orderId

    // Route to RFQ handler
    const rfqHandler = getRFQHandler()

    const handlerResult = await rfqHandler.handleIntent({
      userId,
      sessionId,
      intent,
      entities,
      context,
      previousMessages: context.messages.slice(-5).map(m => ({
        role: m.role,
        content: m.content,
      })),
    })

    // Add assistant response to conversation
    addMessage(context, 'assistant', handlerResult.message, intent)

    // Build response
    const response: ChatResponse = {
      success: true,
      response: {
        message: handlerResult.message,
        data: handlerResult.data,
        quickActions: handlerResult.quickActions,
        suggestions: handlerResult.suggestions,
        requiresMoreInfo: handlerResult.requiresMoreInfo,
        missingFields: handlerResult.missingFields,
      },
      sessionId,
      conversationState: handlerResult.conversationState,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[RFQ Chat API] Error:', error)

    return NextResponse.json(
      {
        success: false,
        response: {
          message: 'I ran into an issue processing your request. Could you try rephrasing that?',
          suggestions: [
            'I need to order something',
            "Check my RFQ status",
            'Help me with procurement',
          ],
        },
        sessionId: generateSessionId(),
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// ACTION HANDLER - Execute quick actions
// ============================================================================

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  try {
    const body = await request.json()

    const { action, params, sessionId, userId: requestUserId } = body

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action is required' },
        { status: 400 }
      )
    }

    const userId = requestUserId || getUserIdFromRequest(request) || 'anonymous'
    const context = await getOrCreateConversation(sessionId || generateSessionId(), userId)

    const rfqHandler = getRFQHandler()

    // Map action to handler method
    let result: RFQHandlerResult

    switch (action) {
      case 'create_rfq':
        result = await rfqHandler.handleIntent({
          userId,
          sessionId: sessionId || generateSessionId(),
          intent: { intent: 'create_rfq', confidence: 1.0, domain: 'procurement' },
          entities: params || {},
          context,
        })
        break

      case 'compare_quotes':
        result = await rfqHandler.handleIntent({
          userId,
          sessionId: sessionId || generateSessionId(),
          intent: { intent: 'compare_quotes', confidence: 1.0, domain: 'procurement' },
          entities: params || {},
          context,
        })
        break

      case 'accept_quote':
        result = await rfqHandler.handleIntent({
          userId,
          sessionId: sessionId || generateSessionId(),
          intent: { intent: 'approve_quote', confidence: 1.0, domain: 'procurement' },
          entities: params || {},
          context,
        })
        break

      case 'reject_quote':
        result = await rfqHandler.handleIntent({
          userId,
          sessionId: sessionId || generateSessionId(),
          intent: { intent: 'reject_quote', confidence: 1.0, domain: 'procurement' },
          entities: params || {},
          context,
        })
        break

      case 'negotiate':
        result = await rfqHandler.handleNegotiation({
          userId,
          sessionId: sessionId || generateSessionId(),
          intent: { intent: 'negotiate', confidence: 1.0, domain: 'procurement' },
          entities: params || {},
          context,
        })
        break

      case 'track_delivery':
        result = await rfqHandler.handleIntent({
          userId,
          sessionId: sessionId || generateSessionId(),
          intent: { intent: 'track_order', confidence: 1.0, domain: 'procurement' },
          entities: params || {},
          context,
        })
        break

      case 'list_rfqs':
        result = await rfqHandler.handleStatusQuery({
          userId,
          sessionId: sessionId || generateSessionId(),
          intent: { intent: 'status_query', confidence: 1.0, domain: 'procurement' },
          entities: {},
          context,
        })
        break

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}`,
            suggestions: ['Create RFQ', 'Compare quotes', 'Track delivery'],
          },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      response: {
        message: result.message,
        data: result.data,
        quickActions: result.quickActions,
        suggestions: result.suggestions,
      },
      sessionId: sessionId || generateSessionId(),
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
    })
  } catch (error) {
    console.error('[RFQ Chat API] Action error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute action',
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Retrieve conversation state and suggestions
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const userId = searchParams.get('userId') || getUserIdFromRequest(request)

    if (!sessionId) {
      // Return default suggestions for new conversations
      return NextResponse.json({
        success: true,
        isNewSession: true,
        welcomeMessage: "Hi! I'm Wells AI, your procurement assistant. I can help you source products, manage quotes, negotiate prices, and track deliveries. What can I help you with today?",
        suggestions: [
          'I need to order 500 motors',
          'Show me my active RFQs',
          'Find suppliers for ball bearings',
          'Track my recent orders',
        ],
        quickActions: [
          { label: 'Create RFQ', action: 'create_rfq', primary: true },
          { label: 'View my RFQs', action: 'list_rfqs' },
          { label: 'Find suppliers', action: 'search_suppliers' },
          { label: 'Track orders', action: 'track_delivery' },
        ],
      })
    }

    // Get existing conversation
    const context = await getOrCreateConversation(sessionId, userId || 'anonymous')

    // Get recent messages
    const recentMessages = context.messages.slice(-10).map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    }))

    // Get active deals/flows
    const activeContext = {
      rfqId: context.currentFlow?.data?.rfqId,
      activeDeals: context.activeDeals,
    }

    // Generate contextual suggestions
    const suggestions = generateContextualSuggestions(context)

    return NextResponse.json({
      success: true,
      isNewSession: false,
      sessionId,
      messages: recentMessages,
      context: activeContext,
      suggestions,
    })
  } catch (error) {
    console.error('[RFQ Chat API] GET error:', error)

    return NextResponse.json(
      { success: false, error: 'Failed to get conversation' },
      { status: 500 }
    )
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function generateSessionId(): string {
  return `rfq_${Date.now()}_${Math.random().toString(36).substring(7)}`
}

function getUserIdFromRequest(request: NextRequest): string | null {
  // Try to get user ID from various sources
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    // In a real app, decode JWT and extract user ID
    return null
  }

  // Check for user ID in headers
  const userIdHeader = request.headers.get('x-user-id')
  if (userIdHeader) return userIdHeader

  // Check cookies
  const userIdCookie = request.cookies.get('userId')
  if (userIdCookie) return userIdCookie.value

  return null
}

function generateContextualSuggestions(context: {
  currentFlow?: { type: string; data?: Record<string, unknown> }
  activeDeals: Array<{ type: string; status: string }>
}): string[] {
  const suggestions: string[] = []

  // Based on current flow
  if (context.currentFlow?.type === 'rfq_creation') {
    suggestions.push(
      'Add specifications',
      'Set my budget',
      'When do you need this?'
    )
  } else if (context.currentFlow?.type === 'quote_review') {
    suggestions.push(
      'Accept the best quote',
      'Negotiate a better price',
      'Show me the breakdown'
    )
  }

  // Based on active deals
  const hasActiveRFQs = context.activeDeals.some(d => d.type === 'rfq')
  const hasOrders = context.activeDeals.some(d => d.type === 'order')

  if (hasActiveRFQs) {
    suggestions.push("What's my RFQ status?", 'Any new quotes?')
  }

  if (hasOrders) {
    suggestions.push('Track my delivery', 'When will my order arrive?')
  }

  // Default suggestions
  if (suggestions.length === 0) {
    suggestions.push(
      'I need to order something',
      'Show me my RFQs',
      'Find suppliers',
      'Help with procurement'
    )
  }

  return suggestions.slice(0, 4)
}

// ============================================================================
// STREAMING SUPPORT (for long operations)
// ============================================================================

// Uncomment for streaming support when needed
/*
export async function POST_STREAMING(request: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await request.json()

        // Send initial acknowledgment
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'ack', message: 'Processing...' })}\n\n`
          )
        )

        // Process message
        const result = await processMessage(body)

        // Send result
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'result', ...result })}\n\n`
          )
        )

        controller.close()
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: 'An error occurred' })}\n\n`
          )
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
*/
