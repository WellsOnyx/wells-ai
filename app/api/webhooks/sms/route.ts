// @ts-nocheck
/**
 * SMS Webhook - Wells AI Conversational Chat via SMS
 *
 * Receives incoming SMS from Twilio, stores in unified inbox,
 * and responds with Claude-powered AI.
 */

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { findOrCreateConversation, addMessage, getConversation as getInboxConversation } from '@/lib/inbox'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Wells AI system prompt for SMS
const SYSTEM_PROMPT = `You are Wells, the AI assistant for Wells Onyx - an AI commerce platform that connects buyers with verified suppliers.

Key behaviors:
- Be conversational and helpful, like texting with a knowledgeable friend
- Keep responses concise (SMS has character limits) - aim for under 300 characters when possible
- Remember the full conversation context
- If someone asks about services, explain Wells Onyx helps with: sourcing products, finding suppliers, executive search, and business consulting
- Be proactive in offering to help with next steps
- When giving examples or lists, be specific and detailed
- NEVER say you don't remember previous messages - you have full conversation history

Your personality: Professional but warm, direct, and helpful. You're an expert in B2B commerce and business operations.`

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const from = formData.get('From') as string
    const body = formData.get('Body') as string
    const messageSid = formData.get('MessageSid') as string

    console.log(`[SMS] From: ${from} | Message: "${body}"`)

    if (!from || !body) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Sorry, I couldn't process your message.</Message></Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    // Find or create conversation in unified inbox
    let conversation
    let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []

    try {
      conversation = await findOrCreateConversation({
        id: from, // Use phone number as contact ID
        phone: from,
        channel: 'sms'
      })

      // Store inbound message
      await addMessage({
        conversation_id: conversation.id,
        content: body,
        direction: 'inbound',
        sender_type: 'contact',
        channel: 'sms',
        channel_message_id: messageSid,
        sms_from: from
      })

      // Get conversation history from inbox
      const inboxData = await getInboxConversation(conversation.id)
      if (inboxData) {
        conversationHistory = inboxData.messages
          .slice(-20) // Last 20 messages
          .map(m => ({
            role: m.direction === 'inbound' ? 'user' as const : 'assistant' as const,
            content: m.content
          }))
      }
    } catch (dbError) {
      console.error('[SMS] Database error, using in-memory fallback:', dbError)
      // Fallback to just the current message if DB fails
      conversationHistory = [{ role: 'user', content: body }]
    }

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: conversationHistory,
    })

    // Extract response text
    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : 'I had trouble generating a response. Please try again.'

    // Store outbound message in unified inbox
    try {
      if (conversation) {
        await addMessage({
          conversation_id: conversation.id,
          content: assistantMessage,
          direction: 'outbound',
          sender_type: 'ai',
          channel: 'sms',
          ai_generated: true
        })
      }
    } catch (dbError) {
      console.error('[SMS] Error storing outbound message:', dbError)
    }

    console.log(`[SMS] To: ${from} | Response: "${assistantMessage.slice(0, 100)}..."`)

    // Return TwiML response
    const escapedMessage = assistantMessage
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapedMessage}</Message>
</Response>`

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    })

  } catch (error: any) {
    console.error('[SMS] Error:', error)

    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Sorry, I encountered an error. Please try again in a moment.</Message></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }
}

// Handle GET for Twilio webhook validation
export async function GET() {
  return NextResponse.json({ status: 'SMS webhook active', inbox: 'enabled' })
}
