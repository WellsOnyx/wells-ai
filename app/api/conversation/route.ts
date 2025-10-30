import { NextRequest, NextResponse } from 'next/server'
import { monitorAPI } from '@/lib/monitoring'
import {
  parseIntent,
  executeIntent,
  generateResponse,
  getConversationContext,
  updateConversationContext,
  ConversationContext,
} from '@/lib/conversational-engine'

/**
 * Conversational API Endpoint
 * POST /api/conversation
 *
 * Unified conversational interface for all platforms
 * Handles natural language procurement and finance conversations
 */
export async function POST(req: NextRequest) {
  const monitor = monitorAPI('/api/conversation', 'POST')

  try {
    const body = await req.json()
    const { message, userId, conversationId, platform, metadata } = body

    // Validation
    if (!message || !userId) {
      monitor.end(false)
      return NextResponse.json(
        { error: 'Message and userId are required' },
        { status: 400 }
      )
    }

    // Generate conversation ID if not provided
    const actualConversationId =
      conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const actualPlatform = platform || 'web'

    console.log('[CONVERSATION] Processing:', {
      conversationId: actualConversationId,
      userId,
      platform: actualPlatform,
      message: message.substring(0, 50),
    })

    // Load conversation context
    const context = await getConversationContext(actualConversationId, userId, actualPlatform)

    // Parse user intent using AI
    const parsedIntent = await parseIntent(message, context)

    console.log('[CONVERSATION] Intent parsed:', {
      intent: parsedIntent.intent,
      confidence: parsedIntent.confidence,
      needsClarification: parsedIntent.needsClarification,
    })

    // Handle clarification requests
    if (parsedIntent.needsClarification) {
      // Save context for next turn
      await updateConversationContext(
        actualConversationId,
        message,
        parsedIntent.clarificationQuestion || '',
        parsedIntent
      )

      monitor.end(true, { needsClarification: true })

      return NextResponse.json({
        conversationId: actualConversationId,
        needsClarification: true,
        clarificationQuestion:
          parsedIntent.clarificationQuestion ||
          'Could you provide more details to help me with your request?',
        intent: parsedIntent.intent,
        entities: parsedIntent.entities,
      })
    }

    // Execute the intent
    const executionResult = await executeIntent(parsedIntent, userId)

    console.log('[CONVERSATION] Intent executed:', {
      success: executionResult.success,
      intent: parsedIntent.intent,
    })

    // Generate conversational response
    const aiResponse = await generateResponse(parsedIntent, executionResult, context)

    // Update conversation context
    await updateConversationContext(
      actualConversationId,
      message,
      aiResponse,
      parsedIntent
    )

    monitor.end(true, { intent: parsedIntent.intent, success: executionResult.success })

    // Return response
    return NextResponse.json({
      conversationId: actualConversationId,
      response: aiResponse,
      success: executionResult.success,
      intent: parsedIntent.intent,
      data: executionResult.data,
      metadata: {
        confidence: parsedIntent.confidence,
        platform: actualPlatform,
      },
    })
  } catch (error) {
    monitor.end(false)
    console.error('[CONVERSATION] Error:', error)

    // Generate friendly error response
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'I encountered an error processing your request. Please try again or rephrase your message.'

    return NextResponse.json(
      {
        error: errorMessage,
        success: false,
        response:
          "I'm sorry, I had trouble understanding that request. Could you try rephrasing it? For example:\n• \"Create a PO for 100 chairs from Acme Corp for $5000\"\n• \"What's my inventory status?\"\n• \"Show me suppliers in Texas\"",
      },
      { status: 500 }
    )
  }
}

/**
 * GET handler - Get conversation history
 * GET /api/conversation?conversationId=xxx
 */
export async function GET(req: NextRequest) {
  const monitor = monitorAPI('/api/conversation', 'GET')

  try {
    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversationId')
    const userId = searchParams.get('userId')

    if (!conversationId || !userId) {
      monitor.end(false)
      return NextResponse.json(
        { error: 'conversationId and userId are required' },
        { status: 400 }
      )
    }

    // Load conversation context
    const context = await getConversationContext(conversationId, userId, 'web')

    monitor.end(true)

    return NextResponse.json({
      conversationId,
      history: context.history,
      currentIntent: context.currentIntent,
      entities: context.entities,
      metadata: context.metadata,
    })
  } catch (error) {
    monitor.end(false)
    console.error('[CONVERSATION] Get history error:', error)

    return NextResponse.json(
      { error: 'Failed to retrieve conversation history' },
      { status: 500 }
    )
  }
}

/**
 * DELETE handler - Clear conversation
 * DELETE /api/conversation?conversationId=xxx
 */
export async function DELETE(req: NextRequest) {
  const monitor = monitorAPI('/api/conversation', 'DELETE')

  try {
    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversationId')

    if (!conversationId) {
      monitor.end(false)
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 })
    }

    // Delete conversation context from database
    const { query } = await import('@/lib/db')
    await query('DELETE FROM conversation_contexts WHERE conversation_id = $1', [conversationId])

    monitor.end(true)

    return NextResponse.json({
      success: true,
      message: 'Conversation cleared',
    })
  } catch (error) {
    monitor.end(false)
    console.error('[CONVERSATION] Delete conversation error:', error)

    return NextResponse.json({ error: 'Failed to clear conversation' }, { status: 500 })
  }
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
