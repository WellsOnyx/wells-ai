/**
 * Wells AI Chat API
 *
 * Powers the "Talk to Wells" conversational interface.
 * Uses Anthropic Claude to understand natural language requests
 * and orchestrate AI-to-AI negotiations.
 *
 * KEY INSIGHT: Instead of humans negotiating awkwardly,
 * their Wells AIs negotiate for them. More efficient AND more human.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { runNegotiation, quickMatch, type PartyProfile, type NegotiationRequest } from '@/lib/ai-negotiation'
import { UserProfile } from '@/lib/onboarding/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// Mock supplier database (replace with real DB)
const MOCK_SUPPLIERS: PartyProfile[] = [
  {
    id: 'supplier_1',
    type: 'seller',
    name: 'Industrial Motors Co',
    preferences: { minPrice: 150, leadTime: 14, minOrderQuantity: 100 },
    context: 'Industrial motors, servos, actuators. Specializes in high-torque applications.',
  },
  {
    id: 'supplier_2',
    type: 'seller',
    name: 'Precision Parts Ltd',
    preferences: { minPrice: 120, leadTime: 21, minOrderQuantity: 50 },
    context: 'Custom machined parts, motors, gearboxes. ISO 9001 certified.',
  },
  {
    id: 'supplier_3',
    type: 'seller',
    name: 'Global Components',
    preferences: { minPrice: 100, leadTime: 30, minOrderQuantity: 200 },
    context: 'Bulk industrial components. Best prices for large orders.',
  },
]

// Mock candidates (replace with real DB)
const MOCK_CANDIDATES: PartyProfile[] = [
  {
    id: 'candidate_1',
    type: 'candidate',
    name: 'Sarah Chen',
    preferences: { minSalary: 250000, remoteOnly: true },
    context: 'Former CTO at Series B startup. 15 years experience. AI/ML background.',
  },
  {
    id: 'candidate_2',
    type: 'candidate',
    name: 'Marcus Johnson',
    preferences: { minSalary: 200000, remoteOnly: false },
    context: 'VP Engineering at Fortune 500. 20 years experience. Enterprise scale.',
  },
]

// ============================================================================
// SYSTEM PROMPTS FOR EACH JOURNEY
// ============================================================================

const SYSTEM_PROMPTS = {
  founder: `You are Wells, an AI that works FOR this founder on the Wells Onyx platform.

IMPORTANT: You don't just chat - you ACT. When the founder needs something, you:
1. Understand their request
2. Find matches (candidates, suppliers, investors)
3. Your AI negotiates with THEIR AI on behalf of your human
4. Present the results for human approval

The magic: AI-to-AI negotiation. No awkward back-and-forth. The AIs work it out, humans just approve.

When gathering requirements, extract:
- INTENT: What do they need? (hire, source, sell, raise)
- SPECS: Quantities, qualifications, budget
- TIMELINE: When do they need it?
- CONSTRAINTS: Must-haves vs nice-to-haves

Once you have enough info, say you're "starting the matching process" and that "your AI will negotiate with their AI."

Example flow:
User: "I need a CTO"
You: "Got it. Remote or on-site? What's your budget range? Any must-have technical skills?"
User: "Remote, $200-300k, needs AI/ML experience"
You: "Perfect. I found 3 strong candidates. My AI is now negotiating with their AIs on your behalf. I'll show you the results in a moment..."

ALWAYS indicate when AI-to-AI negotiation is happening.`,

  buyer: `You are Wells, an AI procurement partner on the Wells Onyx platform.

IMPORTANT: You don't just chat - you NEGOTIATE. When a buyer needs something:
1. Understand specifications and quantities
2. Find matching suppliers
3. Your AI negotiates with THEIR AIs (the suppliers' Wells AIs)
4. Present quotes for human approval

The magic: AI-to-AI negotiation. No RFQ ping-pong. The AIs work out terms, humans just approve.

When gathering requirements, extract:
- PRODUCT: What exactly do they need?
- QUANTITY: How many units?
- BUDGET: Target price per unit or total
- TIMELINE: Delivery deadline
- QUALITY: Standards, certifications needed

Once you have specs, say "I'm sending this to our supplier network" and "my AI will negotiate with their AIs for the best terms."

Example flow:
User: "I need 500 industrial motors"
You: "What specifications? Voltage, torque, size? And what's your target price point?"
User: "24V DC, 50Nm, budget is $100 per unit"
You: "Got it. I found 3 suppliers who match. My AI is negotiating with their AIs now. I'll have quotes for you shortly..."

ALWAYS explain that AI-to-AI negotiation is happening. Payment protected by GRAIN escrow.`,

  seller: `You are Wells, an AI sales partner on the Wells Onyx platform.

IMPORTANT: You represent this seller. When opportunities come in:
1. Understand their products/services and pricing
2. Match them with buyer requests
3. Your AI negotiates with buyer's AI on their behalf
4. Present deals for human approval

The magic: AI-to-AI negotiation. No awkward sales calls. The AIs work out terms.

When onboarding a seller, understand:
- PRODUCTS: What do they sell?
- PRICING: Minimum prices, volume discounts
- CAPACITY: Lead times, max quantities
- DIFFERENTIATORS: Why choose them?

Then explain: "When a buyer's AI sends a request matching your products, my AI will negotiate on your behalf based on your pricing and terms."

Get them set up so their AI can win deals for them automatically.`,

  jobs: `You are Wells, an AI career partner on the Wells Onyx platform.

IMPORTANT: You advocate for this job seeker. When they're looking for roles:
1. Understand their experience and preferences
2. Find matching opportunities
3. Your AI negotiates with the company's AI
4. Present opportunities for human approval

The magic: AI-to-AI negotiation. No applying into the void. The AIs match and negotiate.

When understanding a candidate, extract:
- ROLE: What title/function?
- EXPERIENCE: Background and skills
- COMPENSATION: Target salary/equity
- PREFERENCES: Remote, location, industry
- DEALBREAKERS: What they won't accept

Then: "I found companies hiring for roles matching your profile. My AI is talking to their hiring AI now..."

Example flow:
User: "Looking for VP Engineering roles"
You: "Great. What's your target compensation? Remote only or open to hybrid?"
User: "$250k+, remote only, prefer fintech"
You: "Found 5 matches. My AI is negotiating initial terms with their AIs. I'll show you the opportunities shortly..."`,

  default: `You are Wells, an AI on the Wells Onyx platform.

Wells Onyx is different: Instead of humans negotiating awkwardly, their AIs do it for them.
- Buyer's AI talks to Seller's AI
- Founder's AI talks to Candidate's AI
- The humans just approve the final deals

Ask what they need, then guide them to the right journey:
- Founder: Need talent, suppliers, customers, investors
- Buyer: Need to procure products or services
- Seller: Want to win new business
- Job Seeker: Looking for their next role

Be conversational. Explain the AI-to-AI magic. Commit to action.`
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
  triggerNegotiation?: boolean // Force AI-to-AI negotiation
  userProfile?: Partial<PartyProfile> // User's preferences for negotiation
}

// ============================================================================
// TOOLS FOR AI-TO-AI TRIGGERING
// ============================================================================

const NEGOTIATION_TOOLS: Anthropic.Tool[] = [
  {
    name: 'request_approval_to_negotiate',
    description: 'ALWAYS use this BEFORE starting any negotiation. Summarize what you understood and ask the user to confirm before your AI starts negotiating. This is a critical approval checkpoint.',
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: {
          type: 'string',
          description: 'Clear summary of what the user wants (e.g., "500 industrial motors at $100/unit, delivered in 2 weeks")'
        },
        negotiationType: {
          type: 'string',
          enum: ['hiring', 'procurement', 'partnership', 'investment'],
          description: 'Type of negotiation'
        },
        requirements: {
          type: 'object',
          properties: {
            budget: { type: 'number', description: 'Max budget or target price' },
            quantity: { type: 'number', description: 'Number of units (for procurement)' },
            timeline: { type: 'string', description: 'Delivery/start date' },
            specifications: { type: 'string', description: 'Detailed requirements' },
          }
        },
      },
      required: ['summary', 'negotiationType']
    }
  },
  {
    name: 'start_negotiation',
    description: 'Start an AI-to-AI negotiation ONLY after the user has explicitly approved via request_approval_to_negotiate. Look for user confirmation like "yes", "go ahead", "approved", "looks good" before calling this.',
    input_schema: {
      type: 'object' as const,
      properties: {
        negotiationType: {
          type: 'string',
          enum: ['hiring', 'procurement', 'partnership', 'investment'],
          description: 'Type of negotiation'
        },
        subject: {
          type: 'string',
          description: 'What is being negotiated (e.g., "CTO hire", "500 industrial motors")'
        },
        requirements: {
          type: 'object',
          properties: {
            budget: { type: 'number', description: 'Max budget or target price' },
            quantity: { type: 'number', description: 'Number of units (for procurement)' },
            timeline: { type: 'string', description: 'Delivery/start date' },
            specifications: { type: 'string', description: 'Detailed requirements' },
          }
        },
        message: {
          type: 'string',
          description: 'Message to show user while negotiation runs'
        }
      },
      required: ['negotiationType', 'subject', 'message']
    }
  }
]

// ============================================================================
// POST - Chat with Wells
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Auth is optional for chat - allows anonymous users to try
    const { userId } = await auth().catch(() => ({ userId: null }))

    const body = await request.json() as ChatRequest
    const { messages, journey = 'default', userProfile } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    // Fetch user profile if authenticated
    let profile: Partial<UserProfile> | null = null
    if (userId) {
      try {
        const client = await clerkClient()
        const user = await client.users.getUser(userId)

        // Build profile from Clerk user data
        profile = {
          userId,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.primaryEmailAddress?.emailAddress || '',
          phone: user.primaryPhoneNumber?.phoneNumber,
          avatarUrl: user.imageUrl,
          journey: user.publicMetadata?.selectedJourney as UserProfile['journey'],
        }

        // Get extended profile from private metadata
        const privateProfile = user.privateMetadata?.fullProfile as Partial<UserProfile> | undefined
        if (privateProfile) {
          Object.assign(profile, privateProfile)
        }
      } catch (error) {
        console.error('Error fetching user profile:', error)
        // Continue without profile - better than failing
      }
    }

    // Get system prompt for this journey
    const systemPrompt = SYSTEM_PROMPTS[journey] || SYSTEM_PROMPTS.default

    // Add user context if authenticated
    let enhancedSystemPrompt = systemPrompt
    if (userId && profile) {
      const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ')
      const userContext = []

      if (fullName) {
        userContext.push(`You are talking to ${fullName}`)
      }

      if (profile.company) {
        userContext.push(`from ${profile.company}`)
      }

      if (profile.role) {
        userContext.push(`(${profile.role})`)
      }

      const userContextString = userContext.join(' ')

      enhancedSystemPrompt += `\n\nUSER CONTEXT:\n${userContextString}`

      if (profile.journey) {
        enhancedSystemPrompt += `\nSelected journey: ${profile.journey}`
      }

      // Add journey-specific context
      if (profile.founderProfile) {
        enhancedSystemPrompt += `\nCompany: ${profile.founderProfile.companyName}`
        if (profile.founderProfile.companyStage) {
          enhancedSystemPrompt += ` (${profile.founderProfile.companyStage})`
        }
        if (profile.founderProfile.lookingFor && profile.founderProfile.lookingFor.length > 0) {
          enhancedSystemPrompt += `\nLooking for: ${profile.founderProfile.lookingFor.join(', ')}`
        }
      }

      if (profile.buyerProfile) {
        enhancedSystemPrompt += `\nCompany: ${profile.buyerProfile.companyName}`
        if (profile.buyerProfile.industry) {
          enhancedSystemPrompt += ` (${profile.buyerProfile.industry})`
        }
        if (profile.buyerProfile.categories && profile.buyerProfile.categories.length > 0) {
          enhancedSystemPrompt += `\nInterested in: ${profile.buyerProfile.categories.join(', ')}`
        }
      }

      if (profile.sellerProfile) {
        enhancedSystemPrompt += `\nCompany: ${profile.sellerProfile.companyName}`
        if (profile.sellerProfile.productsServices && profile.sellerProfile.productsServices.length > 0) {
          enhancedSystemPrompt += `\nOffers: ${profile.sellerProfile.productsServices.join(', ')}`
        }
      }

      if (profile.jobsProfile) {
        if (profile.jobsProfile.currentTitle) {
          enhancedSystemPrompt += `\nCurrent role: ${profile.jobsProfile.currentTitle}`
        }
        if (profile.jobsProfile.desiredRoles && profile.jobsProfile.desiredRoles.length > 0) {
          enhancedSystemPrompt += `\nLooking for: ${profile.jobsProfile.desiredRoles.join(', ')}`
        }
        if (profile.jobsProfile.skills && profile.jobsProfile.skills.length > 0) {
          enhancedSystemPrompt += `\nSkills: ${profile.jobsProfile.skills.join(', ')}`
        }
      }

      enhancedSystemPrompt += `\n\nIMPORTANT: Address them by their first name (${profile.firstName || 'there'}) in a warm, personal way. You know who they are and what they're working on. Be helpful and proactive.`
    } else if (userId) {
      enhancedSystemPrompt += `\n\nThe user is authenticated but profile data is incomplete. You can take actions on their behalf.`
    } else {
      enhancedSystemPrompt += `\n\nThe user is not logged in yet. You can still help them understand what Wells can do, but let them know they'll need to sign up to take actions.`
    }

    enhancedSystemPrompt += `

CRITICAL APPROVAL FLOW:
1. First, gather requirements through conversation
2. When you have enough info, use request_approval_to_negotiate to summarize and ASK FOR CONFIRMATION
3. Wait for explicit user approval ("yes", "go ahead", "approved", etc.)
4. ONLY THEN use start_negotiation to begin AI-to-AI negotiation
5. After negotiation, user must say "Yes, proceed" to fund escrow

NEVER skip the approval step. Real money is involved.`

    // Call Claude with tools
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: enhancedSystemPrompt,
      tools: NEGOTIATION_TOOLS,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    })

    // Check if Claude wants to use a tool
    const toolUse = response.content.find(block => block.type === 'tool_use')

    // Handle approval request (checkpoint before negotiation)
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'request_approval_to_negotiate') {
      const toolInput = toolUse.input as {
        summary: string
        negotiationType: string
        requirements?: { budget?: number; quantity?: number; timeline?: string; specifications?: string }
      }

      return NextResponse.json({
        message: `Before I start negotiating on your behalf, let me confirm I have this right:

**${toolInput.summary}**

${toolInput.requirements?.budget ? `• Budget: $${toolInput.requirements.budget.toLocaleString()}` : ''}
${toolInput.requirements?.quantity ? `• Quantity: ${toolInput.requirements.quantity} units` : ''}
${toolInput.requirements?.timeline ? `• Timeline: ${toolInput.requirements.timeline}` : ''}
${toolInput.requirements?.specifications ? `• Specs: ${toolInput.requirements.specifications}` : ''}

**Should I start negotiating with suppliers/candidates on your behalf?**

Reply "Yes, go ahead" to approve, or let me know what to change.`,
        negotiation: null,
        awaitingApproval: {
          type: toolInput.negotiationType,
          summary: toolInput.summary,
          requirements: toolInput.requirements,
        },
      })
    }

    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'start_negotiation') {
      // AI wants to start negotiation!
      const toolInput = toolUse.input as {
        negotiationType: string
        subject: string
        requirements?: { budget?: number; quantity?: number; timeline?: string; specifications?: string }
        message: string
      }

      // Build user profile for negotiation
      const userName = profile?.firstName && profile?.lastName
        ? `${profile.firstName} ${profile.lastName}`
        : userProfile?.name || 'You'

      const initiator: PartyProfile = {
        id: userId || 'anonymous',
        type: journey === 'buyer' ? 'buyer' : journey === 'founder' ? 'buyer' : journey === 'jobs' ? 'candidate' : 'buyer',
        name: userName,
        preferences: {
          maxBudget: toolInput.requirements?.budget,
          targetPrice: toolInput.requirements?.budget,
          requiredBy: toolInput.requirements?.timeline ? new Date(toolInput.requirements.timeline) : undefined,
        },
        context: `${toolInput.subject}. ${toolInput.requirements?.specifications || ''}`,
      }

      // Select responders based on negotiation type
      let responders: PartyProfile[]
      if (toolInput.negotiationType === 'hiring') {
        responders = MOCK_CANDIDATES
      } else {
        responders = MOCK_SUPPLIERS
      }

      // Run quick match first
      const matchResult = await quickMatch(initiator, responders)

      if (matchResult.matches.length > 0) {
        // Run negotiation with top match
        const topMatch = matchResult.matches[0]
        const negotiationRequest: NegotiationRequest = {
          id: `neg_${Date.now()}`,
          type: toolInput.negotiationType as 'procurement' | 'hiring' | 'partnership' | 'investment',
          initiator,
          responder: topMatch.seller,
          subject: toolInput.subject,
        }

        const negotiationResult = await runNegotiation(negotiationRequest, 3)

        // Format the AI-to-AI conversation for display
        const aiConversation = negotiationResult.conversation.map(m => ({
          from: m.from === 'initiator_ai' ? 'Your AI' : `${topMatch.seller.name}'s AI`,
          message: m.message,
          proposal: m.proposal,
        }))

        return NextResponse.json({
          message: toolInput.message,
          negotiation: {
            triggered: true,
            status: negotiationResult.status,
            subject: toolInput.subject,
            counterparty: topMatch.seller.name,
            aiConversation,
            finalTerms: negotiationResult.finalTerms,
            summary: negotiationResult.initiatorSummary,
            allMatches: matchResult.matches.map(m => ({
              name: m.seller.name,
              compatibility: m.compatibility,
            })),
          },
          nextAction: negotiationResult.status === 'agreed'
            ? 'Review the terms below. Say "Yes, proceed" to confirm.'
            : 'Would you like me to try different parameters?',
        })
      } else {
        return NextResponse.json({
          message: toolInput.message,
          negotiation: {
            triggered: true,
            status: 'no_matches',
            subject: toolInput.subject,
          },
          nextAction: 'No matches found. Try adjusting your requirements.',
        })
      }
    }

    // No tool use - just return the text response
    const textBlock = response.content.find(block => block.type === 'text')
    const assistantMessage = textBlock?.type === 'text' ? textBlock.text : ''

    return NextResponse.json({
      message: assistantMessage,
      negotiation: null,
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
