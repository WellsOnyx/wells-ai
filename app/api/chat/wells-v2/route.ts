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
    const { message, conversationId: existingConvId, userId } = await req.json()

    if (!message) {
      return Response.json({ error: 'Message is required' }, { status: 400 })
    }

    // Get or create conversation (non-blocking on failure)
    const conversationId = existingConvId || await getOrCreateConversation(userId)

    // Store user message (non-blocking)
    storeMessage(conversationId, 'user', message, userId)

    const anthropic = getAnthropic()

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: message
        }
      ],
      system: `You are Wells, an AI executive assistant. You help with professional tasks like scheduling, research, and communications. Be helpful, concise, and professional.`
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
