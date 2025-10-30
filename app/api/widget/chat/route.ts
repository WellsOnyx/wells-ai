import { NextRequest, NextResponse } from 'next/server'
import { monitorAPI } from '@/lib/monitoring'

/**
 * Widget Chat API
 * POST /api/widget/chat
 *
 * Handles chat messages from embedded widget
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
    // For now, accept any key except 'demo' for tracking purposes

    // Simple response system (avoiding Anthropic TypeScript issues)
    const lowerMessage = message.toLowerCase()

    let aiResponse: string

    if (lowerMessage.includes('hello') || lowerMessage.includes('hi ') || lowerMessage === 'hi') {
      aiResponse = "Hi! I'm Wells AI, your procurement assistant. I can help you find suppliers, get quotes, and streamline your purchasing process. What are you looking for today?"
    } else if (lowerMessage.includes('rfq') || lowerMessage.includes('quote') || lowerMessage.includes('request')) {
      aiResponse = "I can help you create an RFQ! Please tell me: What product or service do you need, what quantity, and when do you need it by?"
    } else if (lowerMessage.includes('supplier') || lowerMessage.includes('vendor')) {
      aiResponse = "I can connect you with verified suppliers in our network. What type of supplier are you looking for? You can specify industry, location, or product category."
    } else if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('how much')) {
      aiResponse = "Wells AI charges just 33 basis points (0.33%) on closed deals. We handle everything: supplier matching, negotiation, contracts, and ERP integration. Want to start a quote request?"
    } else if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
      aiResponse = "I can help you:\n• Find and match suppliers\n• Create RFQs (Request for Quote)\n• Negotiate deals in real-time\n• Auto-generate contracts\n• Sync to your ERP system\n\nWhat would you like to do?"
    } else {
      aiResponse = "I understand you're looking for: \"" + message.substring(0, 50) + (message.length > 50 ? '..."' : '"') + ". Let me help! Would you like to create an RFQ for this? I'll need to know the quantity and deadline."
    }

    // Log conversation (simplified - could store in database)
    console.log('[WIDGET] Chat:', {
      apiKey: apiKey?.substring(0, 8) + '...',
      url: context?.url,
      message: message.substring(0, 50),
      conversationId,
    })

    monitor.end(true, { conversationId })

    return NextResponse.json({
      response: aiResponse,
      conversationId,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    monitor.end(false)
    console.error('[API] Widget chat error:', error)

    return NextResponse.json(
      {
        error: 'Failed to process message',
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
