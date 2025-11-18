// app/api/chat/wells-v2/route.ts
// Layer 2: Anthropic API only (no Prisma)

import Anthropic from '@anthropic-ai/sdk'

// Lazy initialization to avoid module-level failures
let anthropicClient: Anthropic | null = null

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

export async function POST(req: Request) {
  const startTime = Date.now()

  try {
    const { message } = await req.json()

    if (!message) {
      return Response.json({ error: 'Message is required' }, { status: 400 })
    }

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

    return Response.json({
      response: assistantMessage,
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
