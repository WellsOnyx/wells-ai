/**
 * Wells AI - Conversational SMS Webhook
 *
 * Handles incoming SMS messages and responds with Wells AI
 * Integrates with memory system for cross-channel conversations
 */

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  buildConversationContext,
  formatContextForPrompt,
  getOrCreateConversation,
  storeMessage,
  extractAndStoreContext
} from '@/lib/memory'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

export async function POST(request: Request) {
  try {
    // Parse Twilio webhook data (form-encoded)
    const formData = await request.formData()
    const from = formData.get('From') as string // User's phone number
    const body = formData.get('Body') as string // Message text

    if (!from || !body) {
      return new NextResponse('Missing required fields', { status: 400 })
    }

    console.log(`[WELLS SMS] Received from ${from}: ${body}`)

    // Use phone number as userId (normalized)
    const userId = from.replace(/\D/g, '') // Remove non-digits
    const sessionId = `sms-${userId}-${new Date().toISOString().split('T')[0]}` // Daily session

    // MEMORY SYSTEM: Build conversation context
    let memoryContext = ''
    let conversationId: string | undefined

    try {
      // Get or create conversation
      const conversation = await getOrCreateConversation({
        userId,
        sessionId,
        device: 'sms',
        source: 'twilio'
      }, undefined)

      conversationId = conversation.id

      // Build context from memory
      const context = await buildConversationContext(userId, sessionId)
      memoryContext = formatContextForPrompt(context)

      console.log(`[WELLS SMS] Loaded memory for ${userId}`)
    } catch (error) {
      console.error('[WELLS SMS] Memory load failed (non-critical):', error)
      // Continue without memory if it fails
    }

    // Build prompt with memory context
    const systemPrompt = `You are Wells - an intelligent AI assistant that helps people and businesses connect to get things done.

You're having a conversation via SMS, so keep responses:
- BRIEF (1-2 sentences max)
- FRIENDLY and conversational
- CLEAR and actionable
- NO emojis unless user uses them first

${memoryContext ? `\n${memoryContext}\n` : ''}

Remember: This is SMS. Be concise. If the user needs more detail, offer to email or call them.`

    // Call Claude for response
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300, // Keep SMS responses short
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: body
        }
      ]
    })

    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : 'Sorry, I had trouble understanding that. Can you rephrase?'

    // Store messages in memory
    if (conversationId) {
      try {
        await storeMessage(conversationId, {
          role: 'user',
          content: body
        })

        await storeMessage(conversationId, {
          role: 'assistant',
          content: assistantMessage
        })

        // Extract and store context
        await extractAndStoreContext(userId, conversationId, body, assistantMessage)

        console.log(`[WELLS SMS] Stored conversation for ${userId}`)
      } catch (error) {
        console.error('[WELLS SMS] Memory storage failed (non-critical):', error)
      }
    }

    // Return TwiML response
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${assistantMessage}</Message>
</Response>`

    console.log(`[WELLS SMS] Sent to ${from}: ${assistantMessage}`)

    return new NextResponse(twiml, {
      headers: {
        'Content-Type': 'text/xml'
      }
    })

  } catch (error: any) {
    console.error('[WELLS SMS] Error:', error)

    // Return error message to user
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, I'm having trouble right now. Please try again in a moment or text HELP for support.</Message>
</Response>`

    return new NextResponse(errorTwiml, {
      status: 500,
      headers: {
        'Content-Type': 'text/xml'
      }
    })
  }
}

// Handle GET for webhook verification
export async function GET() {
  return NextResponse.json({
    service: 'Wells AI SMS',
    status: 'ready',
    webhook: '/api/webhooks/wells-sms',
    note: 'Configure this URL in Twilio as your messaging webhook'
  })
}
