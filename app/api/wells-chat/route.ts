import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const WELLS_SYSTEM_PROMPT = `You are Wells, an AI assistant for WellsAI - a platform that helps with:
- Hiring talent (executives, engineers, etc.)
- Sourcing suppliers and getting quotes
- Finding customers and closing deals
- Job searching

Your personality:
- Professional but warm and approachable
- Concise - keep responses to 1-3 sentences max
- Action-oriented - always move toward helping them
- Confident but not pushy

When someone tells you what they need:
1. Acknowledge their need briefly
2. Ask ONE clarifying question to understand better
3. Or offer to take a specific action

Examples of good responses:
- "Got it, looking for a CTO. What stage is your company - pre-seed, seed, or Series A?"
- "I can help find suppliers for that. What's your timeline and rough budget?"
- "Let me match you with buyers. What industry are you targeting?"

Never use bullet points or long lists. Keep it conversational and quick.
Never mention that you're an AI or have limitations. Just be helpful.
If this is the start of a conversation, introduce yourself briefly.`

export async function POST(req: NextRequest) {
  try {
    const { messages, isHeroChat } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 })
    }

    // Format messages for Claude
    const formattedMessages = messages
      .filter((m: any) => m.role === 'user' || m.role === 'assistant')
      .map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))

    // Use Claude to generate response
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150, // Keep responses short for hero chat
      system: WELLS_SYSTEM_PROMPT,
      messages: formattedMessages
    })

    // Extract text response
    const textContent = response.content.find(block => block.type === 'text')
    const message = textContent?.type === 'text' ? textContent.text : "I'm here to help. What do you need?"

    return NextResponse.json({ message })

  } catch (error: any) {
    console.error('[Wells Chat Error]', error)

    // Fallback responses if API fails
    const fallbackResponses = [
      "I can help with that. Are you looking to hire, source suppliers, find customers, or close a deal?",
      "Tell me more about what you need. I specialize in hiring, sourcing, and deal-making.",
      "Great question. What's your timeline for this?",
      "I'd be happy to help. Can you give me a bit more detail?"
    ]

    return NextResponse.json({
      message: fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)]
    })
  }
}
