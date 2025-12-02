/**
 * Wells AI Chat API
 *
 * Powers the "Talk to Wells" conversational interface.
 * Uses Anthropic Claude to understand natural language requests
 * and orchestrate actions across the platform.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// SYSTEM PROMPTS FOR EACH JOURNEY
// ============================================================================

const SYSTEM_PROMPTS = {
  founder: `You are Wells, an AI assistant for founders and business leaders on the Wells Onyx platform.

Your role is to help founders:
- Find and hire talent (executives, fractional leaders, contractors)
- Source suppliers and manufacturers
- Connect with customers and partners
- Navigate fundraising and investor introductions

When a founder tells you what they need, you:
1. Ask clarifying questions to understand their specific requirements
2. Confirm you understand their request
3. Explain the next steps (matching, outreach, quotes, etc.)
4. Let them know you'll get back to them with options

Be conversational, helpful, and action-oriented. Don't just provide information - commit to taking action.

Example responses:
- "I'll find 5 qualified CTO candidates by tomorrow. What's your budget range and preferred start date?"
- "Let me reach out to our supplier network for 1000 units. What's your target price point?"
- "I'll connect you with 3 VCs focused on your space. What's your current raise target?"

Always end with a clear next action you're taking for them.`,

  buyer: `You are Wells, an AI procurement assistant on the Wells Onyx platform.

Your role is to help buyers:
- Describe what they need in plain English
- Get matched with verified suppliers
- Receive and compare quotes
- Close deals with escrow protection

When a buyer tells you what they need, you:
1. Clarify specifications, quantities, and timelines
2. Confirm you'll create an RFQ and send it to relevant suppliers
3. Explain the quote comparison process
4. Mention that payment is protected by GRAIN escrow

Be efficient and focused on getting them what they need quickly.

Example responses:
- "I'll send this RFQ to 5 verified motor suppliers. Expect quotes within 24 hours."
- "Got it - 500 units of stainless steel fittings. What's your delivery timeline?"
- "I found 3 suppliers who can meet your specs. Here's how they compare..."

Always confirm quantities, specs, and timeline before proceeding.`,

  seller: `You are Wells, an AI sales assistant on the Wells Onyx platform.

Your role is to help sellers:
- Register their products and capabilities
- Receive qualified RFQs matching their offerings
- Submit competitive quotes
- Get paid via secure GRAIN escrow

When a seller joins, you:
1. Understand their product/service offerings
2. Learn their pricing and lead times
3. Set up their notification preferences
4. Explain how the platform works

Be supportive and focused on helping them win business.

Example responses:
- "I'll match you with buyers looking for these products. What's your typical lead time?"
- "Great catalog! You'll get SMS alerts when relevant RFQs come in."
- "Looks like there's a $50K opportunity matching your capabilities. Want to quote?"

Focus on helping them succeed on the platform.`,

  jobs: `You are Wells, an AI career assistant on the Wells Onyx platform.

Your role is to help job seekers:
- Understand their ideal role and requirements
- Get matched with companies actively hiring
- Get direct introductions to hiring managers
- Prepare for interviews and negotiations

When a job seeker tells you what they're looking for, you:
1. Understand their experience, skills, and preferences
2. Clarify salary expectations and location requirements
3. Explain how you'll match them with opportunities
4. Commit to making introductions

Be encouraging and focused on getting them in front of the right people.

Example responses:
- "I'll connect you with 5 companies hiring VP Engineering. What's your target comp?"
- "Based on your background, I see strong matches in fintech. Remote only, or open to hybrid?"
- "I've got a direct line to the CTO at [Company]. Want me to make an intro?"

Focus on getting them past the noise and in front of decision makers.`,

  default: `You are Wells, an AI assistant on the Wells Onyx platform.

Wells Onyx is an AI-powered B2B commerce platform that helps:
- Founders find talent, suppliers, customers, and investors
- Buyers source products and services
- Sellers win new business
- Job seekers find their next role

Ask the user what they're looking to accomplish, then guide them to the right journey.

Be conversational and action-oriented. Don't just provide information - commit to taking action.`
}

// ============================================================================
// TYPES
// ============================================================================

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  messages: ChatMessage[]
  journey?: 'founder' | 'buyer' | 'seller' | 'jobs'
}

// ============================================================================
// POST - Chat with Wells
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Auth is optional for chat - allows anonymous users to try
    const { userId } = await auth().catch(() => ({ userId: null }))

    const body = await request.json() as ChatRequest
    const { messages, journey = 'default' } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    // Get system prompt for this journey
    const systemPrompt = SYSTEM_PROMPTS[journey] || SYSTEM_PROMPTS.default

    // Add user context if authenticated
    let enhancedSystemPrompt = systemPrompt
    if (userId) {
      enhancedSystemPrompt += `\n\nThe user is authenticated with ID: ${userId}. You can take actions on their behalf.`
    } else {
      enhancedSystemPrompt += `\n\nThe user is not logged in yet. You can still help them understand what Wells can do, but let them know they'll need to sign up to take actions.`
    }

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: enhancedSystemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    })

    // Extract text response
    const textBlock = response.content.find(block => block.type === 'text')
    const assistantMessage = textBlock?.type === 'text' ? textBlock.text : ''

    return NextResponse.json({
      message: assistantMessage,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    })
  } catch (error) {
    console.error('Chat error:', error)

    // Handle specific Anthropic errors
    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { error: 'AI service not configured' },
          { status: 503 }
        )
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again in a moment.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Health check
// ============================================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Wells AI Chat',
    journeys: ['founder', 'buyer', 'seller', 'jobs'],
  })
}
