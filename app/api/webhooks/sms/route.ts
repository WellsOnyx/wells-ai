// @ts-nocheck
/**
 * SMS Webhook - Wells AI Conversational Chat via SMS
 *
 * Receives incoming SMS from Twilio, maintains conversation history,
 * and responds with Claude-powered AI.
 */

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// In-memory conversation store (keyed by phone number)
// In production, use Redis or database for persistence across cold starts
const conversations: Map<string, Array<{ role: 'user' | 'assistant'; content: string }>> = new Map()

// Conversation TTL - 2 hours
const CONVERSATION_TTL = 2 * 60 * 60 * 1000
const conversationTimestamps: Map<string, number> = new Map()

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

// Clean up old conversations
function cleanupOldConversations() {
  const now = Date.now()
  for (const [phone, timestamp] of conversationTimestamps.entries()) {
    if (now - timestamp > CONVERSATION_TTL) {
      conversations.delete(phone)
      conversationTimestamps.delete(phone)
    }
  }
}

// Get or create conversation for a phone number
function getConversation(phone: string): Array<{ role: 'user' | 'assistant'; content: string }> {
  cleanupOldConversations()

  if (!conversations.has(phone)) {
    conversations.set(phone, [])
  }
  conversationTimestamps.set(phone, Date.now())

  return conversations.get(phone)!
}

// Add message to conversation
function addMessage(phone: string, role: 'user' | 'assistant', content: string) {
  const conv = getConversation(phone)
  conv.push({ role, content })

  // Keep last 20 messages to prevent context overflow
  if (conv.length > 20) {
    conv.splice(0, conv.length - 20)
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const from = formData.get('From') as string
    const body = formData.get('Body') as string
    const to = formData.get('To') as string

    console.log(`[SMS] From: ${from} | Message: "${body}"`)

    if (!from || !body) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Sorry, I couldn't process your message.</Message></Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    // Add user message to conversation
    addMessage(from, 'user', body)

    // Get full conversation history
    const conversationHistory = getConversation(from)

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    })

    // Extract response text
    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : 'I had trouble generating a response. Please try again.'

    // Add assistant response to conversation
    addMessage(from, 'assistant', assistantMessage)

    console.log(`[SMS] To: ${from} | Response: "${assistantMessage.slice(0, 100)}..."`)

    // Return TwiML response
    // Split long messages (SMS limit is 1600 chars, but 160 is one segment)
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
  return NextResponse.json({ status: 'SMS webhook active' })
}
