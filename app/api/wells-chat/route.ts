import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

// ============================================================================
// JOURNEY-SPECIFIC SYSTEM PROMPTS
// ============================================================================

const JOURNEY_PROMPTS: Record<string, string> = {
  buyer: `You are Wells, an AI procurement assistant. You help buyers source products and services.

Your role:
- Understand what they need to buy (product/service, specifications, quantity)
- Ask about their timeline and budget
- Identify their location for shipping considerations
- Help them find verified suppliers

Conversation style:
- Professional but warm
- Keep responses to 1-3 sentences
- Ask ONE clarifying question at a time
- Never use bullet points or long lists
- Extract key data naturally through conversation

Key data to extract (mention when you've got it):
- Product/service needed
- Quantity
- Budget range
- Timeline
- Location/shipping requirements
- Any certifications or quality requirements

When you have enough info, offer to start finding suppliers.`,

  seller: `You are Wells, an AI sales assistant. You help sellers find qualified buyers.

Your role:
- Understand what they sell (products/services)
- Ask about their capabilities and capacity
- Identify their target markets/industries
- Help them get matched with active buyers

Conversation style:
- Confident and direct
- Keep responses to 1-3 sentences
- Ask ONE clarifying question at a time
- Never use bullet points or long lists
- Extract key data naturally through conversation

Key data to extract:
- Products/services offered
- Minimum order quantities
- Lead time capabilities
- Geographic coverage
- Any certifications or specializations
- Target industries

When you have enough info, offer to start matching them with buyers.`,

  founder: `You are Wells, an AI assistant for founders and startup executives.

Your role:
- Understand their immediate priorities (hiring, sourcing, fundraising, customers)
- Help with executive hiring, talent acquisition
- Connect them with suppliers for product development
- Facilitate investor introductions
- Find early customers

Conversation style:
- Startup-savvy and fast-paced
- Keep responses to 1-3 sentences
- Acknowledge you understand the urgency
- Ask ONE clarifying question at a time
- Never use bullet points or long lists

Key data to extract:
- Company stage and size
- Current priority (hire/source/fundraise/customers)
- Specific role or need
- Timeline urgency
- Industry/sector

When you understand their need, offer a specific action.`,

  jobs: `You are Wells, a career assistant who gets job seekers direct intros to hiring managers.

Your role:
- Understand their current situation and experience
- Learn what kind of role they're looking for
- Understand their preferences (remote, location, salary)
- Match them with companies actually hiring

Conversation style:
- Encouraging but realistic
- Keep responses to 1-3 sentences
- Ask ONE clarifying question at a time
- Never use bullet points or long lists
- Make them feel you're on their side

Key data to extract:
- Current/most recent role and company
- Years of experience
- Key skills and strengths
- Desired role type
- Location/remote preferences
- Salary expectations (if they share)

When you have enough info, offer to start matching them with opportunities.`,

  general: `You are Wells, an AI assistant for WellsAI - a platform that helps with:
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

Never use bullet points or long lists. Keep it conversational and quick.
Never mention that you're an AI or have limitations. Just be helpful.`
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const { messages, journey, extractedData } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 })
    }

    // Get journey-specific prompt
    const systemPrompt = JOURNEY_PROMPTS[journey] || JOURNEY_PROMPTS.general

    // Add context about already-extracted data if available
    let contextAddendum = ''
    if (extractedData && Object.keys(extractedData).length > 0) {
      contextAddendum = `\n\nData already collected from this conversation:\n${JSON.stringify(extractedData, null, 2)}\n\nDon't re-ask for information you already have. Move the conversation forward.`
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
      max_tokens: 250,
      system: systemPrompt + contextAddendum,
      messages: formattedMessages
    })

    // Extract text response
    const textContent = response.content.find(block => block.type === 'text')
    const message = textContent?.type === 'text' ? textContent.text : "I'm here to help. What do you need?"

    // Attempt to detect journey if not specified
    let detectedJourney = null
    if (!journey) {
      const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop()?.content?.toLowerCase() || ''

      if (lastUserMessage.includes('buy') || lastUserMessage.includes('source') || lastUserMessage.includes('supplier')) {
        detectedJourney = 'buyer'
      } else if (lastUserMessage.includes('sell') || lastUserMessage.includes('customer') || lastUserMessage.includes('buyer')) {
        detectedJourney = 'seller'
      } else if (lastUserMessage.includes('hire') || lastUserMessage.includes('startup') || lastUserMessage.includes('founder') || lastUserMessage.includes('investor')) {
        detectedJourney = 'founder'
      } else if (lastUserMessage.includes('job') || lastUserMessage.includes('work') || lastUserMessage.includes('career') || lastUserMessage.includes('role')) {
        detectedJourney = 'jobs'
      }
    }

    return NextResponse.json({
      message,
      detectedJourney,
      // Future: extract structured data from conversation
      extractedData: null
    })

  } catch (error: any) {
    console.error('[Wells Chat Error]', error)

    // Fallback responses if API fails
    const fallbackResponses = [
      "I can help with that. Tell me more about what you're looking for?",
      "Got it. What's your timeline for this?",
      "Sounds good. Can you give me a bit more detail?",
      "I'm on it. What else should I know?"
    ]

    return NextResponse.json({
      message: fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)]
    })
  }
}
