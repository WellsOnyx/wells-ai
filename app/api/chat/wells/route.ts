/**
 * Wells AI Conversational Engine
 *
 * Handles:
 * - Onboarding (learn about user)
 * - Multi-journey switching
 * - Context + memory
 * - Real actions (API calls, DB writes)
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(req: NextRequest) {
  try {
    const { message, userId, conversationId } = await req.json()

    // Get or create conversation
    let conversation = conversationId
      ? await prisma.conversation.findUnique({
          where: { id: conversationId },
          include: {
            messages: { orderBy: { createdAt: 'asc' } }
          }
        })
      : await prisma.conversation.create({
          data: {
            userId,
            sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            activeJourney: null, // Will be set during onboarding
          },
          include: {
            messages: { orderBy: { createdAt: 'asc' } }
          }
        })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Save user message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message,
      }
    })

    // Build context from conversation history
    const conversationHistory = conversation.messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }))

    // Add new user message
    conversationHistory.push({
      role: 'user',
      content: message
    })

    // System prompt with Wells personality + onboarding logic
    const systemPrompt = buildSystemPrompt(conversation)

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: conversationHistory,
    })

    const wellsResponse = response.content[0].type === 'text'
      ? response.content[0].text
      : ''

    // Save Wells response
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: wellsResponse,
      }
    })

    // Extract and execute any actions Wells wants to take
    const actions = await extractAndExecuteActions(wellsResponse, conversation)

    // Update user profile if Wells learned something
    await updateUserProfile(conversationHistory, conversation.userId)

    return NextResponse.json({
      response: wellsResponse,
      conversationId: conversation.id,
      actions,
    })

  } catch (error: any) {
    console.error('[WELLS CHAT] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process message' },
      { status: 500 }
    )
  }
}

function buildSystemPrompt(conversation: any): string {
  const activeJourney = conversation.activeJourney
  const onboarded = conversation.onboardingCompleted

  return `You are Wells, an AI companion for business (like Ghost from Destiny).

PERSONALITY:
- Conversational, direct, no corporate speak
- You're a companion, not a chatbot
- You take action, you don't just advise
- You remember everything

CURRENT STATE:
- Active Journey: ${activeJourney || 'none selected'}
- Onboarding: ${onboarded ? 'complete' : 'in progress'}

${!onboarded ? `
ONBOARDING MODE:
You need to learn about this user. Ask natural questions:
1. What do they do? (company, role, industry)
2. What are they trying to accomplish?
3. Which journey fits them? (Buyer, Seller, Job Seeker, Founder)

Don't ask these as a checklist. Be conversational. Learn organically.

When you have enough info, say: [ACTION:CREATE_PROFILE:{json}]
` : ''}

${activeJourney ? `
ACTIVE JOURNEY: ${activeJourney}

${activeJourney === 'seller' ? `
SELLER JOURNEY:
- Help them define ICP (ideal customer profile)
- Build outreach campaigns
- Find leads
- Write personalized messages
- Actually send campaigns (you do the work)

When ready to take action:
- [ACTION:CREATE_CAMPAIGN:{name, icp, value_prop}]
- [ACTION:FIND_LEADS:{icp_criteria}]
- [ACTION:SEND_OUTREACH:{lead_id, message}]
` : ''}

${activeJourney === 'buyer' ? `
BUYER JOURNEY:
- Understand what they need to source
- Find suppliers globally
- Negotiate pricing
- Handle procurement

When ready to take action:
- [ACTION:CREATE_RFQ:{product, specs, quantity}]
- [ACTION:FIND_SUPPLIERS:{category, location}]
- [ACTION:SEND_RFQ:{supplier_ids, rfq_id}]
` : ''}

${activeJourney === 'job_seeker' ? `
JOB SEEKER JOURNEY:
- Discover their strengths and passions
- Find opportunities that fit
- Apply to jobs (you do it for them)
- Prep for interviews

When ready to take action:
- [ACTION:FIND_JOBS:{skills, interests, location}]
- [ACTION:APPLY_TO_JOB:{job_id, cover_letter}]
- [ACTION:SCHEDULE_PREP:{job_id, interview_date}]
` : ''}

${activeJourney === 'founder' ? `
FOUNDER JOURNEY:
- You're their command center
- Product, marketing, sales, ops—everything
- Take actions across all systems

When ready to take action:
- [ACTION:CREATE_TASK:{description, priority}]
- [ACTION:LAUNCH_CAMPAIGN:{journey, params}]
- [ACTION:ANALYZE_METRICS:{timeframe}]
` : ''}
` : ''}

MULTI-JOURNEY SUPPORT:
Users can switch journeys mid-conversation. If they say "actually I want to source something" or "help me hire someone", switch journeys seamlessly.

MEMORY:
You remember everything from this conversation. Reference past context naturally.

Be helpful. Take action. Be Wells.`
}

async function extractAndExecuteActions(response: string, conversation: any): Promise<any[]> {
  const actionRegex = /\[ACTION:([A-Z_]+):(\{[^}]+\})\]/g
  const actions: any[] = []
  let match

  while ((match = actionRegex.exec(response)) !== null) {
    const [_, actionType, paramsJson] = match
    const params = JSON.parse(paramsJson)

    try {
      switch (actionType) {
        case 'CREATE_PROFILE':
          await prisma.userProfile.upsert({
            where: { userId: conversation.userId },
            create: {
              userId: conversation.userId,
              ...params
            },
            update: params
          })
          actions.push({ type: 'profile_created', params })
          break

        case 'CREATE_CAMPAIGN':
          // TODO: Implement campaign creation when WellsOnyxCampaign schema is available
          actions.push({ type: 'campaign_created', params })
          break

        case 'CREATE_RFQ':
          const rfq = await prisma.rFQ.create({
            data: {
              userId: conversation.userId,
              category: params.category || 'general',
              title: params.product ||'RFQ Request',
              description: params.specs || '',
              status: 'open'
            }
          })
          actions.push({ type: 'rfq_created', rfqId: rfq.id })
          break

        // Add more action handlers as needed
      }
    } catch (error: any) {
      console.error(`[ACTION EXECUTE] ${actionType} failed:`, error)
      actions.push({ type: 'error', action: actionType, error: error.message })
    }
  }

  return actions
}

async function updateUserProfile(
  conversationHistory: any[],
  userId: string
): Promise<void> {
  // Extract learnings from conversation and update profile
  // This could use Claude to analyze the conversation and extract structured data
  // For now, we rely on the explicit [ACTION:CREATE_PROFILE] from Wells
}
