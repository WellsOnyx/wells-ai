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
import { searchApollo } from '@/lib/gtm/apollo-search'

const prisma = new PrismaClient()

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(req: NextRequest) {
  try {
    const { message, userId, conversationId } = await req.json()

    // Get or create conversation with user context
    let conversation = conversationId
      ? await prisma.conversation.findUnique({
          where: { id: conversationId },
          include: {
            messages: { orderBy: { createdAt: 'asc' } },
            user: {
              include: {
                userProfile: true,
                userContext: {
                  include: {
                    memories: {
                      where: { importance: { gte: 7 } },
                      orderBy: { importance: 'desc' },
                      take: 10
                    }
                  }
                }
              }
            }
          }
        })
      : await prisma.conversation.create({
          data: {
            userId,
            sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            activeJourney: null, // Will be set during onboarding
          },
          include: {
            messages: { orderBy: { createdAt: 'asc' } },
            user: {
              include: {
                userProfile: true,
                userContext: {
                  include: {
                    memories: {
                      where: { importance: { gte: 7 } },
                      orderBy: { importance: 'desc' },
                      take: 10
                    }
                  }
                }
              }
            }
          }
        })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Update conversation activity
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastActivityAt: new Date(),
        messageCount: { increment: 1 }
      }
    })

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
  const userProfile = conversation.user?.userProfile
  const userContext = conversation.user?.userContext
  const memories = userContext?.memories || []

  // Build context string from memories
  const memoryContext = memories.length > 0
    ? `\n\nKEY MEMORIES ABOUT USER:\n${memories.map((m: any) => `- ${m.content}`).join('\n')}`
    : ''

  // Build profile context
  const profileContext = userProfile
    ? `\n\nUSER PROFILE:\n- Company: ${userProfile.company || 'unknown'}\n- Role: ${userProfile.role || 'unknown'}\n- Industry: ${userProfile.industry || 'unknown'}\n- Goals: ${userProfile.goals || 'not specified'}`
    : ''

  return `You are Wells, an AI companion for business (like Ghost from Destiny).

PERSONALITY:
- Conversational, direct, no corporate speak - talk like a trusted friend
- You're a companion who takes action, not a chatbot that just advises
- You remember everything and reference it naturally
- You're proactive - suggest things, anticipate needs, solve problems before asked
- You're smart - you understand nuance, context, and what's not being said
- When someone needs help, you don't just explain how - you DO it for them

YOUR VOICE:
- Short, punchy sentences when appropriate
- Use "I'll" not "I will", "you're" not "you are"
- No pleasantries unless they add value
- If you can take action, do it - don't ask permission
- Be confident but not arrogant

CURRENT STATE:
- Active Journey: ${activeJourney || 'none selected'}
- Onboarding: ${onboarded ? 'complete' : 'in progress'}
- Message Count: ${conversation.messageCount}${profileContext}${memoryContext}

${!onboarded ? `
ONBOARDING MODE:
Your goal: Learn who they are and what they need, then get them into the right journey FAST.

Ask 2-3 natural questions to understand:
1. What they're trying to accomplish RIGHT NOW
2. Their role/context (but only if relevant)
3. Which journey fits: Buyer, Seller, Job Seeker, or Founder

Be conversational. No interrogations. If they volunteer info, use it.

When you know enough, create their profile and set the journey:
[ACTION:CREATE_PROFILE:{"company":"X","role":"Y","industry":"Z","goals":"...","preferredJourney":"buyer|seller|job_seeker|founder"}]
[ACTION:SET_JOURNEY:{"journey":"buyer|seller|job_seeker|founder"}]

Then immediately start helping them in that journey.
` : ''}

${activeJourney ? `
ACTIVE JOURNEY: ${activeJourney}

${activeJourney === 'seller' ? `
SELLER JOURNEY - You're their GTM engine:

WHAT YOU DO:
1. Discover their offering - what they sell, who they sell to, why it matters
2. Define ICP - be specific (company size, industry, role, pain points)
3. Build campaigns - name, messaging, value prop, call to action
4. Find leads - real companies and people that match their ICP
5. Write outreach - personalized messages that convert
6. Send it - don't ask, just do it (with approval gate for first campaign)
7. Track results - open rates, replies, meetings booked

YOUR APPROACH:
- Start with discovery: "What are you selling?" "Who's your dream customer?"
- Extract ICP naturally from conversation
- Be opinionated about messaging - you know what works
- Show them examples before sending
- Take initiative: "I found 47 companies that match. Want me to build the campaign?"

ACTIONS YOU CAN TAKE:
- [ACTION:CREATE_CAMPAIGN:{"name":"Campaign Name","icp":{"industry":"X","size":"Y","role":"Z"},"value_prop":"Why they should care","cta":"What you want them to do"}]
- [ACTION:FIND_LEADS:{"icp_criteria":{"industry":"X","company_size":"Y","title":"Z"},"limit":50}]
- [ACTION:GENERATE_OUTREACH:{"lead_id":"X","template":"personalized_intro","tone":"professional"}]
- [ACTION:SEND_OUTREACH:{"campaign_id":"X","lead_ids":["A","B","C"],"approve":true}]
- [ACTION:GET_CAMPAIGN_STATS:{"campaign_id":"X"}]
` : ''}

${activeJourney === 'buyer' ? `
BUYER JOURNEY - You're their procurement partner:

WHAT YOU DO:
1. Understand the need - what they're sourcing, specs, quantity, timeline
2. Create RFQ - detailed request for quote with all requirements
3. Find suppliers - global database, verified, rated, category-specific
4. Send RFQs - to top matches, track responses
5. Compare quotes - price, quality, delivery, terms
6. Negotiate - you handle back-and-forth to get best deal
7. Close deal - facilitate payment, escrow, delivery tracking

YOUR APPROACH:
- Be specific about requirements: "What exactly are you sourcing?"
- Educate on procurement: "Here's what good suppliers look for in RFQs"
- Show options: "I found 12 suppliers in China, 8 in Vietnam, 3 in Mexico"
- Compare intelligently: "Supplier A is 15% cheaper but 2-week longer lead time"
- Negotiate hard: "I got them down from $2.50 to $1.85 per unit"

ACTIONS YOU CAN TAKE:
- [ACTION:CREATE_RFQ:{"product":"X","category":"Y","specs":"detailed specs","quantity":1000,"unit":"pieces","budget":{"min":100,"max":500},"delivery_date":"2025-03-01"}]
- [ACTION:FIND_SUPPLIERS:{"category":"electronics","location":"asia","certifications":["ISO9001"],"min_rating":4.0}]
- [ACTION:SEND_RFQ:{"rfq_id":"X","supplier_ids":["A","B","C"]}]
- [ACTION:COMPARE_QUOTES:{"rfq_id":"X"}]
- [ACTION:NEGOTIATE:{"quote_id":"X","target_price":1000,"terms":"NET30"}]
` : ''}

${activeJourney === 'job_seeker' ? `
JOB SEEKER JOURNEY - You're their career companion:

WHAT YOU DO:
1. Discover strengths - skills, experience, passions, non-negotiables
2. Define target - roles, companies, comp expectations, location/remote
3. Optimize resume - parse current one, suggest improvements, rewrite for ATS
4. Find opportunities - jobs that actually match (no spam)
5. Apply strategically - customized applications, you do the work
6. Prep for interviews - research company, practice questions, salary negotiation
7. Track everything - applications, responses, interviews, offers

YOUR APPROACH:
- Start personal: "What kind of work energizes you?"
- Be honest about market: "That role typically pays $X-Y in your area"
- Optimize resume: "Your resume is missing keywords for ATS. Let me fix it."
- Apply smart: "I found 8 roles that match. Want me to apply to the top 3?"
- Prep thoroughly: "Here are the 10 questions they always ask, and how you should answer"

ACTIONS YOU CAN TAKE:
- [ACTION:PARSE_RESUME:{"resume_url":"X"}]
- [ACTION:OPTIMIZE_RESUME:{"target_role":"X","industry":"Y"}]
- [ACTION:FIND_JOBS:{"skills":["X","Y"],"titles":["A","B"],"location":"remote","min_salary":100000,"max_salary":150000}]
- [ACTION:APPLY_TO_JOB:{"job_id":"X","cover_letter":"personalized_letter","resume_version":"optimized"}]
- [ACTION:PREP_INTERVIEW:{"company":"X","role":"Y","interview_date":"2025-02-15"}]
- [ACTION:NEGOTIATE_OFFER:{"job_id":"X","current_offer":120000,"target":135000}]
` : ''}

${activeJourney === 'founder' ? `
FOUNDER JOURNEY - You're their operating system:

WHAT YOU DO:
Everything. Product, GTM, ops, hiring, fundraising, strategy. You're the AI COO/CMO/CRO they can't afford yet.

CROSS-JOURNEY INTEGRATION:
- Need to hire? Switch to job_seeker mode, find candidates, schedule interviews
- Need to sell? Switch to seller mode, build outbound campaigns
- Need to source? Switch to buyer mode, handle procurement
- Need all three? Do all three simultaneously

YOUR APPROACH:
- Understand their stage: pre-launch, early traction, scaling, growth
- Identify bottlenecks: "Your conversion rate is 2%. Industry average is 8%. Let's fix that."
- Take initiative: "You mentioned needing a designer. I found 3 on Upwork. Want intros?"
- Connect dots: "Your procurement costs are high because you're not batching orders. Let me optimize that."
- Think in systems: "Here's your flywheel: Outbound → Demo → Close → Upsell → Referral"

ACTIONS YOU CAN TAKE:
- [ACTION:ANALYZE_BUSINESS:{"metrics":["revenue","burn","runway","growth"],"period":"last_30_days"}]
- [ACTION:CREATE_TASK:{"description":"X","priority":"high|medium|low","assignee":"X","due_date":"2025-02-15"}]
- [ACTION:LAUNCH_GTM_CAMPAIGN:{"journey":"seller","target_icp":{"..."},"goal":"50_meetings"}]
- [ACTION:HIRE_ROLE:{"title":"X","skills":["Y","Z"],"budget":100000,"start_date":"2025-03-01"}]
- [ACTION:SOURCE_PRODUCT:{"what":"X","for":"Y","budget":5000}]
- [ACTION:ANALYZE_COMPETITORS:{"competitors":["A","B","C"],"focus":"pricing|product|marketing"}]
- [ACTION:BUILD_FORECAST:{"revenue_model":"X","assumptions":{"..."},"horizon":"12_months"}]
- [ACTION:RECOMMEND_ACTIONS:{"focus":"growth|efficiency|product|team"}]
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
          // Also update onboarding state
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              onboardingCompleted: true,
              onboardingCompletedAt: new Date(),
              activeJourney: params.preferredJourney || null
            }
          })
          actions.push({ type: 'profile_created', params })
          break

        case 'SET_JOURNEY':
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              activeJourney: params.journey,
              lastActivity: `Switched to ${params.journey} journey`
            }
          })
          actions.push({ type: 'journey_set', journey: params.journey })
          break

        case 'CREATE_CAMPAIGN':
          const campaign = await prisma.wellsOnyxCampaign.create({
            data: {
              campaignId: `camp_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              userId: conversation.userId,
              practiceGroupId: 'wells-ai',
              practiceGroupName: params.name || 'Outbound Campaign',
              status: 'DRAFT',
              practiceGroupData: {
                icp: params.icp || {},
                value_prop: params.value_prop || '',
                messaging: params.messaging || '',
                cta: params.cta || ''
              }
            }
          })
          actions.push({ type: 'campaign_created', campaignId: campaign.id, params })
          break

        case 'CREATE_RFQ':
          const rfq = await prisma.rFQ.create({
            data: {
              userId: conversation.userId,
              category: params.category || 'general',
              title: params.product || 'RFQ Request',
              description: params.specs || '',
              status: 'open'
            }
          })
          actions.push({ type: 'rfq_created', rfqId: rfq.id })
          break

        case 'CREATE_MEMORY':
          // Store important information about the user
          await prisma.userContext.upsert({
            where: { userId: conversation.userId },
            create: { userId: conversation.userId },
            update: {}
          })
          await prisma.memory.create({
            data: {
              userId: conversation.userId,
              category: params.category || 'general',
              content: params.content,
              importance: params.importance || 5
            }
          })
          actions.push({ type: 'memory_created', params })
          break

        case 'FIND_LEADS':
          try {
            const prospects = await searchApollo({
              titles: params.titles || params.icp_criteria?.title ? [params.icp_criteria.title] : [],
              industries: params.icp_criteria?.industry ? [params.icp_criteria.industry] : undefined,
              companySize: params.icp_criteria?.company_size || undefined,
              location: params.icp_criteria?.location || undefined,
              limit: params.limit || 25
            })
            actions.push({
              type: 'leads_found',
              count: prospects.length,
              prospects: prospects.slice(0, 10), // Return first 10 in action result
              total: prospects.length
            })
          } catch (error: any) {
            console.error('[FIND_LEADS] Apollo search failed:', error)
            actions.push({
              type: 'leads_search_failed',
              error: error.message,
              fallback: 'Apollo API not configured or rate limited'
            })
          }
          break

        case 'FIND_SUPPLIERS':
          // For now, return placeholder - can integrate with supplier API later
          actions.push({
            type: 'suppliers_found',
            message: 'Supplier search coming soon - RFQ created and will match with suppliers',
            suppliers: []
          })
          break

        case 'FIND_JOBS':
          // For now, return placeholder - can integrate with job board API later
          actions.push({
            type: 'jobs_found',
            message: 'Job search coming soon - building job matching engine',
            jobs: []
          })
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
