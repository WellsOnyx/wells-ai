// @ts-nocheck
/**
 * Unified Chat API
 * Handles chat requests from both Wells AI and Grain & Vault
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  createConversation,
  getConversation,
  addMessage,
  getMessages,
  getRecentContext,
  updateUserContext,
  switchProduct,
  updateConversation,
} from '@/lib/chat/unified-chat-service'
import {
  buildSystemPrompt,
  extractTopicsAndEntities,
  generateConversationTitle,
} from '@/lib/chat/context-builder'
import { ProductType } from '@/lib/chat/personas'
import {
  getAccountByClerkId,
  getWallets,
  getCreditLine,
  getTransactions,
} from '@/lib/treasury-db'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface UnifiedChatRequest {
  messages: ChatMessage[]
  product: ProductType
  journey?: string
  conversationId?: string
  treasuryContext?: {
    accountId?: string
    companyName?: string
    grainBalance?: number
    creditLine?: number
  }
  masterKey?: string
}

// ============================================================================
// POST - Send message
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get user auth (optional for anonymous)
    const { userId } = await auth().catch(() => ({ userId: null }))

    const body = await request.json() as UnifiedChatRequest
    const { messages, product, journey, conversationId, treasuryContext, masterKey } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    if (!product || (product !== 'wellsai' && product !== 'grainvault')) {
      return NextResponse.json(
        { error: 'Valid product (wellsai or grainvault) is required' },
        { status: 400 }
      )
    }

    // Validate master mode access
    const isMasterMode = journey === 'master'
    if (isMasterMode && masterKey !== process.env.COLD_START_MASTER_KEY) {
      return NextResponse.json(
        { error: 'Invalid master key' },
        { status: 403 }
      )
    }

    // Get or create conversation
    let conversation
    if (conversationId) {
      conversation = await getConversation(conversationId)
      if (!conversation) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        )
      }

      // Update product context if switched
      if (conversation.currentProduct !== product) {
        conversation = await switchProduct(conversationId, product)
      }
    } else if (userId) {
      // Create new conversation
      conversation = await createConversation({
        userId,
        product,
        journey,
        metadata: {
          startedAt: new Date().toISOString(),
          initialProduct: product,
        },
      })
    } else {
      // Anonymous user - no persistence
      conversation = null
    }

    // Get user context for personalization
    const userContext = userId ? await getRecentContext(userId) : null

    // Build enhanced system prompt
    const systemPrompt = await buildSystemPrompt({
      product,
      journey,
      userContext: userContext?.userContext || null,
      conversationId: conversation?.id,
      treasuryContext,
    })

    // Get tools based on product and journey
    const tools = getToolsForContext(product, journey)

    // Call Claude
    const startTime = Date.now()
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    })
    const latencyMs = Date.now() - startTime

    // Extract response text and tool use
    const textBlock = response.content.find(block => block.type === 'text')
    const toolUse = response.content.find(block => block.type === 'tool_use')
    const assistantMessage = textBlock?.type === 'text' ? textBlock.text : ''

    // Save messages to database if conversation exists
    if (conversation && userId) {
      // Save user message
      const userMessage = messages[messages.length - 1]
      await addMessage({
        conversationId: conversation.id,
        role: 'user',
        content: userMessage.content,
        productContext: product,
      })

      // Extract topics and entities from user message
      const { topics, entities } = await extractTopicsAndEntities(userMessage.content)

      // Update user context with topics
      if (topics.length > 0) {
        const existingTopics = userContext?.userContext?.recentTopics || []
        const updatedTopics = [...new Set([...topics, ...existingTopics])].slice(0, 10)

        await updateUserContext(userId, {
          recentTopics: updatedTopics,
          keyEntities: {
            ...(userContext?.userContext?.keyEntities || {}),
            ...entities,
          },
        })
      }

      // Save assistant message
      await addMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: assistantMessage,
        productContext: product,
        toolUse: toolUse ? { name: toolUse.name, input: toolUse.input } : undefined,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        modelUsed: 'claude-sonnet-4-20250514',
        latencyMs,
      })

      // Generate title if this is the first exchange
      if (conversation.messageCount === 0) {
        const conversationMessages = await getMessages(conversation.id)
        const title = await generateConversationTitle(conversationMessages)
        await updateConversation(conversation.id, { title })
      }
    }

    // Handle tool use (delegate to existing handlers)
    if (toolUse && toolUse.type === 'tool_use') {
      // For now, return tool use to be handled by the existing system
      // In future, we can move tool handlers here
      return NextResponse.json({
        message: assistantMessage,
        toolUse: {
          name: toolUse.name,
          input: toolUse.input,
        },
        conversationId: conversation?.id,
      })
    }

    // Return response
    return NextResponse.json({
      message: assistantMessage,
      conversationId: conversation?.id,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      latencyMs,
    })
  } catch (error) {
    console.error('Unified chat error:', error)

    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { error: 'AI service not configured' },
          { status: 503 }
        )
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again in a moment.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Retrieve conversation history
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')
    const product = searchParams.get('product') as ProductType | null

    if (conversationId) {
      // Get specific conversation with messages
      const conversation = await getConversation(conversationId)
      if (!conversation) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        )
      }

      if (conversation.clerkUserId !== userId) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        )
      }

      const messages = await getMessages(conversationId)

      return NextResponse.json({
        conversation,
        messages,
      })
    } else {
      // Get conversation list
      const { conversations, total } = await getConversationHistory(userId, {
        product: product || undefined,
        limit: 50,
      })

      return NextResponse.json({
        conversations,
        total,
      })
    }
  } catch (error) {
    console.error('Error fetching conversation history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversation history' },
      { status: 500 }
    )
  }
}

// ============================================================================
// TOOL SELECTION
// ============================================================================

function getToolsForContext(product: ProductType, journey?: string): Anthropic.Tool[] {
  // Treasury tools for Grain & Vault
  if (product === 'grainvault') {
    return [
      {
        name: 'get_balance',
        description: 'Get the current GRAIN balance, credit line, and available credit',
        input_schema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'prepare_payment',
        description: 'Prepare a GRAIN payment for authorization (requires user approval)',
        input_schema: {
          type: 'object' as const,
          properties: {
            recipient: { type: 'string', description: 'Recipient wallet address or email' },
            amount: { type: 'number', description: 'Amount of GRAIN to send' },
            memo: { type: 'string', description: 'Optional payment memo' },
          },
          required: ['recipient', 'amount'],
        },
      },
      {
        name: 'get_transactions',
        description: 'Get recent transaction history',
        input_schema: {
          type: 'object' as const,
          properties: {
            limit: { type: 'number', description: 'Number of transactions to return' },
          },
          required: [],
        },
      },
    ]
  }

  // Master tools
  if (journey === 'master') {
    return [
      {
        name: 'save_credential',
        description: 'Save an API key, session cookie, or credential',
        input_schema: {
          type: 'object' as const,
          properties: {
            key: {
              type: 'string',
              enum: ['APOLLO_API_KEY', 'LINKEDIN_SESSION_COOKIE', 'OWNER_EMAIL'],
            },
            value: { type: 'string' },
          },
          required: ['key', 'value'],
        },
      },
      {
        name: 'cold_start_command',
        description: 'Execute a Cold Start Protocol command',
        input_schema: {
          type: 'object' as const,
          properties: {
            command: { type: 'string', description: 'Natural language command' },
          },
          required: ['command'],
        },
      },
    ]
  }

  // Wells AI tools (default)
  return [
    {
      name: 'capture_lead',
      description: 'Capture user requirements and notify the team',
      input_schema: {
        type: 'object' as const,
        properties: {
          requirements: { type: 'string', description: 'Detailed summary of what the user needs' },
          journey: { type: 'string', enum: ['founder', 'buyer', 'seller', 'jobs'] },
          intent: { type: 'string', description: 'Specific intent (hire, source, sell, etc)' },
          budget: { type: 'number', description: 'Budget amount if mentioned' },
          timeline: { type: 'string', description: 'Timeline or urgency' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        },
        required: ['requirements', 'journey'],
      },
    },
  ]
}

// ============================================================================
// OPTIONS - CORS
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}
