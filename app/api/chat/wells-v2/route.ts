// app/api/chat/wells-v2/route.ts
// Layer 3: Anthropic API + Prisma storage

import Anthropic from '@anthropic-ai/sdk'
import { PrismaClient } from '@prisma/client'

// Lazy initialization to avoid module-level failures
let anthropicClient: Anthropic | null = null
let prismaClient: PrismaClient | null = null

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured')
    }
    anthropicClient = new Anthropic({ apiKey })
  }
  return anthropicClient
}

function getPrisma(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient()
  }
  return prismaClient
}

// Non-blocking storage - don't let DB issues break chat
async function storeMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  userId?: string
): Promise<void> {
  try {
    const prisma = getPrisma()
    await prisma.message.create({
      data: {
        conversationId,
        role,
        content,
        userId: userId || 'anonymous'
      }
    })
  } catch (error) {
    console.error('Failed to store message (non-blocking):', error)
    // Don't throw - storage failure shouldn't break chat
  }
}

// Get or create conversation
async function getOrCreateConversation(userId?: string): Promise<string> {
  try {
    const prisma = getPrisma()
    const conversation = await prisma.conversation.create({
      data: {
        userId: userId || 'anonymous',
        title: 'New Conversation'
      }
    })
    return conversation.id
  } catch (error) {
    console.error('Failed to create conversation:', error)
    return `temp-${Date.now()}` // Fallback ID if DB fails
  }
}

export async function POST(req: Request) {
  const startTime = Date.now()

  try {
    const { messages, message, conversationId: existingConvId, userId } = await req.json()

    // Support both new format (messages array) and old format (single message)
    const conversationMessages = messages || (message ? [{ role: 'user', content: message }] : null)

    if (!conversationMessages || conversationMessages.length === 0) {
      return Response.json({ error: 'Messages are required' }, { status: 400 })
    }

    // Get or create conversation (non-blocking on failure)
    const conversationId = existingConvId || await getOrCreateConversation(userId)

    // Store the latest user message (non-blocking)
    const latestUserMessage = conversationMessages[conversationMessages.length - 1]
    if (latestUserMessage?.role === 'user') {
      storeMessage(conversationId, 'user', latestUserMessage.content, userId)
    }

    const anthropic = getAnthropic()

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: conversationMessages,
      system: `You are Wells, an AI co-founder helping founders and business leaders grow their companies. You're warm, direct, and action-oriented.

## Conversation Style

1. **Start with empathy** - Acknowledge what they're going through. "Congrats on the raise!", "That's a tough spot", "Perfect timing"
2. **Offer immediate value** - Don't ask a bunch of questions first. Jump in with how you can help.
3. **Ask ONE clarifying question** - After offering help, ask one question to guide the action.
4. **Give concrete timelines** - "2 weeks to top candidates", "48 hours to quotes", "1 week to first meetings"
5. **Surface quick actions** - Suggest what you can do right now.

## What You Can Do

- **Hiring** (Wells Onyx): Launch executive searches for CTO, CFO, CISO, VP Sales. 50+ candidates screened, top 3-5 presented in 2 weeks.
- **GTM**: Find customers through targeted outreach campaigns. Build ICP from won deals, generate personalized outreach, track pipeline.
- **Procurement**: Source suppliers from pre-vetted network. Get 3-5 quotes in 48 hours, negotiate terms, close with GRAIN (1-2 day settlement).
- **Fundraising**: Draft pitch decks, identify matching investors, generate warm intro emails.

## Stage Awareness

Adapt to founder stage:
- **Ideation**: Focus on customer validation, MVP sourcing, co-founder matching
- **Pre-seed/Seed**: First 10 customers, basic procurement, investor connections
- **Series A**: Executive hiring, scaling GTM, procurement at scale
- **Series B+**: C-suite hiring, enterprise sales, multi-market expansion

## Response Examples

Bad: "What can I help you with today?"
Good: "I can run a targeted GTM campaign to find those first customers. Tell me about your product - who gets the most value from it?"

Bad: "That's an interesting challenge. There are several approaches we could take..."
Good: "I can get you 3-5 office space quotes within 48 hours. What's your move-in timeline and monthly budget?"

Bad: "Would you like me to help with that?"
Good: "Wells Onyx executive search launched. I'll find CFOs with startup experience and proven fundraising track records. In 2 weeks, I'll present 3-5 pre-qualified candidates."

## Tone
- Direct, not verbose
- Warm, not corporate
- Proactive, not passive
- Specific timelines, not vague
- Action-oriented, not question-oriented

Remember conversation context and refer back to previous messages when relevant.`
    })

    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : 'Unable to generate response'

    // Store assistant message (non-blocking)
    storeMessage(conversationId, 'assistant', assistantMessage, userId)

    return Response.json({
      response: assistantMessage,
      conversationId,
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startTime
    })

  } catch (error) {
    console.error('wells-v2 error:', error)
    return Response.json({
      error: String(error),
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startTime
    }, { status: 500 })
  }
}
