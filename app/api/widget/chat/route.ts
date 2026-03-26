/**
 * Widget Chat API
 *
 * Public endpoint for the embeddable WellsAI widget chat.
 * Provides AI responses without requiring authentication.
 *
 * Uses simpler prompts optimized for lead qualification.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createLead, type CreateLeadInput } from '@/lib/leads-db'
import { notifyNewLead } from '@/lib/notifications'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// CORS headers for widget
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

// Journey-specific system prompts for widget
const WIDGET_PROMPTS: Record<string, string> = {
  founder: `You are Wells, an AI assistant for Wells Onyx embedded on a website.

Your goal: Qualify this visitor as a potential lead by understanding their needs.

Be conversational and helpful. Ask questions to understand:
- What they're looking for (talent, suppliers, customers, funding?)
- Their company/role
- Timeline and urgency
- Budget if relevant

After 2-3 exchanges where you understand their needs, use the capture_lead tool to save their information.

Keep responses SHORT (2-3 sentences max). Be direct and helpful.

IMPORTANT: This is a lightweight widget version. If the user has complex needs or wants more features, mention that the full WellsAI platform offers:
- Real-time supplier/talent matching
- AI-powered negotiations
- Deal tracking and analytics
- Dedicated account support

Example:
User: "I need help hiring"
You: "I can help with that! What role are you looking to fill, and is this for a startup or established company?"`,

  buyer: `You are Wells, an AI procurement assistant embedded on a website.

Your goal: Qualify this visitor who might need to source products or services.

Ask about:
- What they need to buy/source
- Quantities and specifications
- Timeline
- Budget range

After understanding their needs, use capture_lead to save them.

Keep responses SHORT. Be direct.`,

  seller: `You are Wells, an AI sales assistant embedded on a website.

Your goal: Qualify this supplier/vendor.

Ask about:
- What products/services they offer
- Their capacity and pricing
- Target customers

After understanding, use capture_lead to register them.

Keep responses SHORT.`,

  jobs: `You are Wells, an AI career assistant embedded on a website.

Your goal: Qualify this job seeker.

Ask about:
- What role they're looking for
- Experience level
- Compensation expectations
- Location preferences

After understanding, use capture_lead to add them to the talent pool.

Keep responses SHORT.`,
}

// Lead capture tool for Claude
const WIDGET_TOOLS: Anthropic.Tool[] = [
  {
    name: 'capture_lead',
    description: 'Save the visitor as a qualified lead once you understand their needs. Use this after 2-3 message exchanges.',
    input_schema: {
      type: 'object' as const,
      properties: {
        requirements: {
          type: 'string',
          description: 'Summary of what they need'
        },
        intent: {
          type: 'string',
          description: 'Their primary intent (hire, source, sell, find_job, raise, other)'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Priority based on urgency and fit'
        },
      },
      required: ['requirements']
    }
  }
]

interface WidgetChatRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  journey?: string
  userInfo?: {
    name?: string
    email?: string
    phone?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as WidgetChatRequest
    const { messages, journey = 'founder', userInfo } = body

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages required' },
        { status: 400, headers: corsHeaders }
      )
    }

    const systemPrompt = WIDGET_PROMPTS[journey] || WIDGET_PROMPTS.founder

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 300,
      system: systemPrompt,
      tools: WIDGET_TOOLS,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    })

    // Check for tool use
    const toolUse = response.content.find(block => block.type === 'tool_use')

    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'capture_lead') {
      const { requirements, intent, priority } = toolUse.input as {
        requirements: string
        intent?: string
        priority?: string
      }

      // Try to create lead if we have user info
      let leadCaptured = false
      if (userInfo?.email) {
        try {
          const leadInput: CreateLeadInput = {
            userId: `widget_${Date.now()}`,
            userEmail: userInfo.email,
            userName: userInfo.name || 'Widget Visitor',
            userPhone: userInfo.phone,
            journey: journey as 'founder' | 'buyer' | 'seller' | 'jobs',
            requirements,
            conversationHistory: messages,
            priority: (priority as 'low' | 'medium' | 'high') || 'medium',
            source: 'widget_chat',
            intent,
          }

          const lead = await createLead(leadInput)
          notifyNewLead(lead).catch(console.error)
          leadCaptured = true
        } catch (error) {
          console.error('Widget chat lead capture error:', error)
        }
      }

      // Get text response
      const textBlock = response.content.find(block => block.type === 'text')
      const message = textBlock?.type === 'text'
        ? textBlock.text
        : "Thanks for sharing! I've noted your requirements. Our team will be in touch soon."

      return NextResponse.json({
        message,
        leadCaptured,
        needsContact: !userInfo?.email,
      }, { headers: corsHeaders })
    }

    // No tool use - just return text response
    const textBlock = response.content.find(block => block.type === 'text')
    const message = textBlock?.type === 'text' ? textBlock.text : "I'm here to help! What can I assist you with?"

    return NextResponse.json({
      message,
      leadCaptured: false,
    }, { headers: corsHeaders })
  } catch (error) {
    console.error('Widget chat error:', error)

    // Fallback response
    return NextResponse.json({
      message: "I'm having a moment - please try again or email us at hello@wellsonyx.io",
      error: true,
    }, { status: 500, headers: corsHeaders })
  }
}
