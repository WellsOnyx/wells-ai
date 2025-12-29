// @ts-nocheck
/**
 * Seller Chat API
 *
 * Conversational interface for the Wells AI Seller/GTM system.
 * Natural language to sales automation.
 *
 * Features:
 * - Lead discovery and qualification
 * - Outreach generation
 * - Pipeline management
 * - RFQ matching and quotes
 * - Sales insights and analytics
 * - Campaign automation
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { SellerHandler, SellerHandlerContext } from '@/lib/chat/handlers/seller-handler'
import { sql } from '@vercel/postgres'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

interface SellerChatRequest {
  message: string
  conversationId?: string
  context?: {
    lastMentionedLeadId?: string
    lastMentionedRfqId?: string
    activeLeadIds?: string[]
  }
}

interface SellerChatResponse {
  message: string
  intent: string
  action: string
  data?: any
  suggestions?: string[]
  followUpActions?: Array<{
    action: string
    label: string
    params?: Record<string, any>
  }>
  requiresConfirmation?: boolean
  confirmationMessage?: string
  conversationId?: string
}

// ============================================================================
// POST - Process seller chat message
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: SellerChatRequest = await request.json()
    const { message, conversationId, context } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Get or create seller profile
    const sellerId = await getOrCreateSellerId(userId)

    // Build context for the handler
    const handlerContext: SellerHandlerContext = {
      sellerId,
      conversationId,
      recentMessages: await getRecentMessages(conversationId),
      activeLeads: context?.activeLeadIds ? await getLeadsByIds(sellerId, context.activeLeadIds) : undefined,
      lastMentionedLead: context?.lastMentionedLeadId ? await getLeadById(sellerId, context.lastMentionedLeadId) : undefined,
    }

    // Process the message through the seller handler
    const result = await SellerHandler.handleSellerIntent(message, handlerContext)

    // Save conversation
    const savedConversationId = await saveConversation(
      userId,
      sellerId,
      message,
      result.response,
      conversationId
    )

    // Build response
    const response: SellerChatResponse = {
      message: result.response,
      intent: result.intent,
      action: result.action,
      data: result.data,
      suggestions: result.suggestions,
      followUpActions: result.followUpActions,
      requiresConfirmation: result.requiresConfirmation,
      confirmationMessage: result.confirmationMessage,
      conversationId: savedConversationId,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[SellerChat] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Get seller conversation history
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
    const limit = parseInt(searchParams.get('limit') || '50')

    // Get seller ID
    const sellerId = await getOrCreateSellerId(userId)

    if (conversationId) {
      // Get specific conversation
      const messages = await getConversationMessages(conversationId, limit)
      return NextResponse.json({ messages })
    } else {
      // Get list of conversations
      const conversations = await getSellerConversations(sellerId, limit)
      return NextResponse.json({ conversations })
    }
  } catch (error) {
    console.error('[SellerChat] Error fetching conversations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE - Delete conversation
// ============================================================================

export async function DELETE(request: NextRequest) {
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

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID required' },
        { status: 400 }
      )
    }

    await sql`
      UPDATE seller_conversations
      SET status = 'deleted', updated_at = NOW()
      WHERE id = ${conversationId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[SellerChat] Error deleting conversation:', error)
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    )
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getOrCreateSellerId(userId: string): Promise<string> {
  try {
    // Check if seller profile exists
    const existing = await sql`
      SELECT id FROM seller_profiles WHERE clerk_user_id = ${userId}
    `

    if (existing.rows.length > 0) {
      return existing.rows[0].id
    }

    // Create new seller profile
    const result = await sql`
      INSERT INTO seller_profiles (clerk_user_id, created_at, updated_at)
      VALUES (${userId}, NOW(), NOW())
      RETURNING id
    `

    return result.rows[0].id
  } catch (error) {
    console.error('[SellerChat] Error getting seller ID:', error)
    // Return userId as fallback
    return userId
  }
}

async function getRecentMessages(
  conversationId?: string
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  if (!conversationId) return []

  try {
    const result = await sql`
      SELECT role, content
      FROM seller_conversation_messages
      WHERE conversation_id = ${conversationId}
      ORDER BY created_at DESC
      LIMIT 10
    `

    return result.rows.reverse().map(row => ({
      role: row.role as 'user' | 'assistant',
      content: row.content,
    }))
  } catch (error) {
    console.error('[SellerChat] Error getting recent messages:', error)
    return []
  }
}

async function getLeadsByIds(sellerId: string, leadIds: string[]): Promise<any[]> {
  if (leadIds.length === 0) return []

  try {
    const result = await sql`
      SELECT * FROM seller_leads
      WHERE seller_id = ${sellerId} AND id = ANY(${leadIds})
    `
    return result.rows
  } catch (error) {
    console.error('[SellerChat] Error getting leads:', error)
    return []
  }
}

async function getLeadById(sellerId: string, leadId: string): Promise<any | null> {
  try {
    const result = await sql`
      SELECT * FROM seller_leads
      WHERE seller_id = ${sellerId} AND id = ${leadId}
    `
    return result.rows[0] || null
  } catch (error) {
    console.error('[SellerChat] Error getting lead:', error)
    return null
  }
}

async function saveConversation(
  userId: string,
  sellerId: string,
  userMessage: string,
  assistantMessage: string,
  existingConversationId?: string
): Promise<string> {
  try {
    let conversationId = existingConversationId

    if (!conversationId) {
      // Create new conversation
      const convResult = await sql`
        INSERT INTO seller_conversations (
          seller_id, clerk_user_id, title, status, created_at, updated_at
        ) VALUES (
          ${sellerId}, ${userId}, ${userMessage.substring(0, 50)}, 'active', NOW(), NOW()
        )
        RETURNING id
      `
      conversationId = convResult.rows[0].id
    } else {
      // Update existing conversation
      await sql`
        UPDATE seller_conversations
        SET updated_at = NOW()
        WHERE id = ${conversationId}
      `
    }

    // Save user message
    await sql`
      INSERT INTO seller_conversation_messages (
        conversation_id, role, content, created_at
      ) VALUES (
        ${conversationId}, 'user', ${userMessage}, NOW()
      )
    `

    // Save assistant message
    await sql`
      INSERT INTO seller_conversation_messages (
        conversation_id, role, content, created_at
      ) VALUES (
        ${conversationId}, 'assistant', ${assistantMessage}, NOW()
      )
    `

    return conversationId
  } catch (error) {
    console.error('[SellerChat] Error saving conversation:', error)
    return existingConversationId || 'temp_' + Date.now()
  }
}

async function getConversationMessages(
  conversationId: string,
  limit: number
): Promise<Array<{ id: string; role: string; content: string; createdAt: Date }>> {
  try {
    const result = await sql`
      SELECT id, role, content, created_at
      FROM seller_conversation_messages
      WHERE conversation_id = ${conversationId}
      ORDER BY created_at ASC
      LIMIT ${limit}
    `

    return result.rows.map(row => ({
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: new Date(row.created_at),
    }))
  } catch (error) {
    console.error('[SellerChat] Error getting messages:', error)
    return []
  }
}

async function getSellerConversations(
  sellerId: string,
  limit: number
): Promise<Array<{ id: string; title: string; updatedAt: Date; messageCount: number }>> {
  try {
    const result = await sql`
      SELECT
        c.id,
        c.title,
        c.updated_at,
        COUNT(m.id) as message_count
      FROM seller_conversations c
      LEFT JOIN seller_conversation_messages m ON c.id = m.conversation_id
      WHERE c.seller_id = ${sellerId} AND c.status = 'active'
      GROUP BY c.id, c.title, c.updated_at
      ORDER BY c.updated_at DESC
      LIMIT ${limit}
    `

    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      updatedAt: new Date(row.updated_at),
      messageCount: parseInt(row.message_count),
    }))
  } catch (error) {
    console.error('[SellerChat] Error getting conversations:', error)
    return []
  }
}

// ============================================================================
// STREAMING ENDPOINT
// ============================================================================

export async function PATCH(request: NextRequest) {
  // Streaming version for real-time responses
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: SellerChatRequest = await request.json()
    const { message, conversationId, context } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const sellerId = await getOrCreateSellerId(userId)

    // Create a streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // First, send intent classification
          const handlerContext: SellerHandlerContext = {
            sellerId,
            conversationId,
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'thinking', message: 'Understanding your request...' })}\n\n`))

          // Process message
          const result = await SellerHandler.handleSellerIntent(message, handlerContext)

          // Stream the response in chunks
          const chunks = result.response.split('\n')
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: chunk + '\n' })}\n\n`))
            await new Promise(resolve => setTimeout(resolve, 50)) // Small delay for streaming effect
          }

          // Send final metadata
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            intent: result.intent,
            action: result.action,
            data: result.data,
            suggestions: result.suggestions,
            followUpActions: result.followUpActions,
          })}\n\n`))

          // Save conversation
          const savedId = await saveConversation(
            userId,
            sellerId,
            message,
            result.response,
            conversationId
          )

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'saved', conversationId: savedId })}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          console.error('[SellerChat] Streaming error:', error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'An error occurred' })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[SellerChat] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    )
  }
}

// ============================================================================
// OPTIONS - CORS
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}
