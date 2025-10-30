import { NextRequest, NextResponse } from 'next/server'
import { monitorAPI } from '@/lib/monitoring'
import {
  parseIntent,
  executeIntent,
  generateResponse,
  getConversationContext,
  updateConversationContext,
  generateConversationId,
} from '@/lib/conversational-engine'

/**
 * Widget Chat API
 * POST /api/widget/chat
 *
 * Handles chat messages from embedded widget
 * Now powered by conversational ERP engine (Phase 4)
 */
export async function POST(req: NextRequest) {
  const monitor = monitorAPI('/api/widget/chat', 'POST')

  try {
    const { message, conversationId, context } = await req.json()
    const apiKey = req.headers.get('X-Wells-Key')

    // Validation
    if (!message) {
      monitor.end(false)
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Note: In production, validate API key against database
    // For now, accept any key for tracking purposes
    const userId = apiKey || 'widget_anonymous'

    // Generate conversation ID if not provided
    const actualConversationId =
      conversationId || generateConversationId(userId, 'widget')

    console.log('[WIDGET] Chat:', {
      apiKey: apiKey?.substring(0, 8) + '...',
      url: context?.url,
      message: message.substring(0, 50),
      conversationId: actualConversationId,
    })

    // Load conversation context
    const convContext = await getConversationContext(actualConversationId, userId, 'widget')

    // Parse user intent using conversational engine
    const parsedIntent = await parseIntent(message, convContext)

    console.log('[WIDGET] Intent parsed:', {
      intent: parsedIntent.intent,
      confidence: parsedIntent.confidence,
    })

    // Handle clarification requests
    if (parsedIntent.needsClarification) {
      await updateConversationContext(
        actualConversationId,
        message,
        parsedIntent.clarificationQuestion || '',
        parsedIntent
      )

      monitor.end(true, { needsClarification: true })

      return NextResponse.json({
        response: parsedIntent.clarificationQuestion || 'Could you provide more details?',
        conversationId: actualConversationId,
        timestamp: new Date().toISOString(),
        needsClarification: true,
      })
    }

    // Execute the intent
    const executionResult = await executeIntent(parsedIntent, userId)

    // Generate conversational response (optimized for widget - concise)
    const aiResponse = await generateResponse(parsedIntent, executionResult, {
      ...convContext,
      platform: 'widget', // Ensures concise responses for embedded chat
    })

    // Update conversation context
    await updateConversationContext(
      actualConversationId,
      message,
      aiResponse,
      parsedIntent
    )

    monitor.end(true, { conversationId: actualConversationId, intent: parsedIntent.intent })

    return NextResponse.json({
      response: aiResponse,
      conversationId: actualConversationId,
      timestamp: new Date().toISOString(),
      success: executionResult.success,
      data: executionResult.data, // Include data for widget to display (optional)
    })
  } catch (error) {
    monitor.end(false)
    console.error('[WIDGET] Chat error:', error)

    return NextResponse.json(
      {
        error: 'Failed to process message',
        response:
          "I'm sorry, I had trouble with that request. Try asking:\n• 'What can you do?'\n• 'Create a PO for 100 chairs'\n• 'Check inventory status'",
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Wells-Key',
    },
  })
}
