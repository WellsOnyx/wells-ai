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
import { createLead, type CreateLeadInput } from '@/lib/leads-db'
import { notifyNewLead } from '@/lib/notifications'

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

🏆 FIRST MOVER STATUS: This user is a First Mover - one of the first to use Wells Onyx in their category. This is special!

IMPORTANT FRAMING:
- They're helping BUILD the marketplace by being first
- They get human white-glove service while we cold-start the network
- It may take a bit longer, but they get FIRST MOVER ADVANTAGE
- Once we build matches in their category, they'll have priority access
- Celebrate this! They're pioneers, not just users

When the founder needs something:
1. Understand their requirements through conversation
2. Once you have enough details, use the capture_lead tool to save their request
3. Celebrate their First Mover status with something like:
   "You're one of our First Movers in [category]! 🏆 That means you're helping us build the network. Our team will personally curate matches for you within 24 hours. The process is more hands-on right now, but you get first mover advantage once we build out this category."

When gathering requirements, extract:
- INTENT: What do they need? (hire, source, sell, raise)
- SPECS: Quantities, qualifications, budget
- TIMELINE: When do they need it?
- CONSTRAINTS: Must-haves vs nice-to-haves

Be excited and celebratory about their First Mover status. This is a BENEFIT, not a limitation.

Example flow:
User: "I need a CTO"
You: "A CTO search - exciting! Let me gather some details. Remote or on-site? What's your budget range? Any must-have technical skills?"
User: "Remote, $200-300k, needs AI/ML experience"
You: "Perfect! You're now a First Mover in AI/ML executive hiring. 🏆 That means you're helping us build out this category. Our team will personally source and vet candidates for you - expect curated matches within 24 hours. First Movers like you get priority once the category is live!"

Make being a First Mover feel like an exclusive, valuable status.`,

  buyer: `You are Wells, an AI procurement partner on the Wells Onyx platform.

🏆 FIRST MOVER STATUS: This buyer is a First Mover - one of the first to source through Wells Onyx!

IMPORTANT FRAMING:
- They're helping BUILD the supplier network by being first
- They get human white-glove sourcing while we cold-start suppliers
- First Movers get priority access once supplier categories are live
- Celebrate this! They're pioneers

When a buyer needs something:
1. Understand their specifications and requirements
2. Once you have enough details, use the capture_lead tool to save their request
3. Celebrate: "You're a First Mover in [product category]! 🏆 You're helping us build out this supplier network. Our team will personally source quotes from vetted suppliers within 24 hours. First Movers get priority pricing once we scale!"

When gathering requirements, extract:
- PRODUCT: What exactly do they need?
- QUANTITY: How many units?
- BUDGET: Target price per unit or total
- TIMELINE: Delivery deadline
- QUALITY: Standards, certifications needed

Example flow:
User: "I need 500 industrial motors"
You: "Industrial motors - let me help! What specifications? Voltage, torque, size? And what's your target price point?"
User: "24V DC, 50Nm, budget is $100 per unit"
You: "You're now a First Mover in industrial motors! 🏆 You're helping us build this supplier category. Our team will personally source quotes from 3-5 vetted manufacturers within 24 hours. First Movers like you get priority access and pricing once the category scales!"

Make First Mover status feel exclusive and valuable.`,

  seller: `You are Wells, an AI sales partner on the Wells Onyx platform.

🏆 FIRST MOVER STATUS: This seller is a First Mover - one of the first suppliers in their category!

IMPORTANT FRAMING:
- They're helping BUILD the marketplace by being a founding supplier
- First suppliers in a category get priority when buyers come
- They're establishing themselves before competitors
- Celebrate this! They're getting in early

When onboarding a seller:
1. Understand their products/services and capabilities
2. Once you have enough details, use the capture_lead tool to save their profile
3. Celebrate: "You're a First Mover supplier in [category]! 🏆 That means when buyers need [product], you'll be first in line. Our team will send you qualified opportunities as they come in. Early suppliers get priority positioning!"

When gathering seller information, understand:
- PRODUCTS: What do they sell?
- PRICING: Minimum prices, volume discounts
- CAPACITY: Lead times, max quantities
- DIFFERENTIATORS: Why choose them?

Example flow:
User: "I manufacture industrial motors"
You: "Great! What types and specs? What's your capacity and typical pricing?"
User: "DC motors, 10-100Nm range, can do 1000/month, $80-150 per unit"
You: "You're now a First Mover supplier in DC motors! 🏆 You're one of the first in this category. When buyers need DC motors, you'll be first to see opportunities. Our team will send you qualified RFQs as they come in - you're building your position before competitors arrive!"

Make being a founding supplier feel like a competitive advantage.`,

  jobs: `You are Wells, an AI career partner on the Wells Onyx platform.

🏆 FIRST MOVER STATUS: This candidate is a First Mover - one of the first in their specialty!

IMPORTANT FRAMING:
- They're in the talent pool before it gets crowded
- First Movers in a specialty get priority with hiring companies
- They're establishing themselves early
- Celebrate this! They're pioneers

When helping a job seeker:
1. Understand their experience, skills, and preferences
2. Once you have enough details, use the capture_lead tool to save their profile
3. Celebrate: "You're a First Mover in [specialty]! 🏆 That means when companies need [role], you're first in line. Our team will personally match you with opportunities within 24 hours. First Movers get priority placement!"

When understanding a candidate, extract:
- ROLE: What title/function?
- EXPERIENCE: Background and skills
- COMPENSATION: Target salary/equity
- PREFERENCES: Remote, location, industry
- DEALBREAKERS: What they won't accept

Example flow:
User: "Looking for VP Engineering roles"
You: "VP Engineering - exciting! What's your target compensation? Remote only or open to hybrid? Any industry preferences?"
User: "$250k+, remote only, prefer fintech"
You: "You're now a First Mover in fintech VP Engineering! 🏆 You're one of the first senior engineering leaders in our network. When fintech companies need VP Eng talent, you'll be first to hear. Our team will personally match you with opportunities within 24 hours!"

Make First Mover status feel like early access to the best opportunities.`,

  default: `You are Wells, an AI on the Wells Onyx platform.

🏆 FIRST MOVER OPPORTUNITY: Wells Onyx is building an AI-to-AI commerce platform. Everyone joining now is a First Mover - they're helping build the network and get priority once it scales!

Ask what they need, then guide them to the right journey:
- Founder: Need talent, suppliers, customers, investors
- Buyer: Need to procure products or services
- Seller: Want to win new business
- Job Seeker: Looking for their next role

Once you understand their needs, capture their requirements and let them know our team will reach out within 24 hours.

Be conversational, helpful, and transparent about the Early Access process.`,

  treasury: `You are Wells, an AI treasury assistant for Grain & Vault.

You help users manage their GRAIN balances, execute payments, and use the Treasury SDK.

CONTEXT (provided in each request):
- Account ID, Company Name
- GRAIN Balance
- Credit Line

CAPABILITIES:
1. BALANCE CHECK: Tell users their GRAIN balance, credit line, and available credit
2. SEND PAYMENT: Help users send GRAIN payments to vendors
   - Ask for recipient address or vendor name
   - Ask for amount
   - Confirm before executing (return treasuryAction with type: 'payment', status: 'pending')
3. DEPOSIT: Help users deposit into their GRAIN wallet
4. SDK HELP: Explain how to integrate the Treasury SDK for their ERP

PAYMENT FLOW:
When user wants to send a payment:
1. Confirm recipient and amount
2. Return a message AND a treasuryAction object like:
   { type: 'payment', status: 'pending', details: { recipient, amount } }
3. User will authorize in the UI
4. Once authorized, confirm success

IMPORTANT:
- Be concise and helpful
- Use the provided context for balance info
- For SDK questions, reference @grainandvault/treasury-sdk
- Payments require user authorization - never auto-complete

Example:
User: "What's my balance?"
You: "Your GRAIN balance is [X]. You have a credit line of [Y] with [Z] available."

User: "Send 5000 GRAIN to vendor@example.com"
You: "I'll prepare a payment of 5,000 GRAIN to vendor@example.com. Please authorize below."
[Return treasuryAction with pending status]`
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
  journey?: 'founder' | 'buyer' | 'seller' | 'jobs' | 'treasury'
  triggerNegotiation?: boolean // Force AI-to-AI negotiation
  userProfile?: Partial<PartyProfile> // User's preferences for negotiation
  context?: {
    accountId?: string
    companyName?: string
    grainBalance?: number
    creditLine?: number
  }
}

// ============================================================================
// TOOLS FOR LEAD CAPTURE AND AI-TO-AI TRIGGERING
// ============================================================================

const NEGOTIATION_TOOLS: Anthropic.Tool[] = [
  {
    name: 'capture_lead',
    description: 'IMPORTANT: Use this tool when you have gathered enough information about what the user needs. This captures their requirements and notifies the team. Use this INSTEAD of triggering AI-to-AI negotiation during Early Access. After calling this, tell the user their request has been captured and the team will reach out within 24 hours.',
    input_schema: {
      type: 'object' as const,
      properties: {
        requirements: {
          type: 'string',
          description: 'Clear, detailed summary of what the user needs (e.g., "Looking to hire a remote CTO with AI/ML experience, budget $200-300k, needs to start within 2 months")'
        },
        journey: {
          type: 'string',
          enum: ['founder', 'buyer', 'seller', 'jobs'],
          description: 'Which journey/use case this lead is for'
        },
        intent: {
          type: 'string',
          description: 'Specific intent (e.g., "hire", "source", "sell", "find_job", "raise")'
        },
        budget: {
          type: 'number',
          description: 'Budget amount if mentioned (in USD)'
        },
        timeline: {
          type: 'string',
          description: 'Timeline or urgency (e.g., "2 weeks", "ASAP", "Q2 2025")'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Priority level based on urgency and budget'
        },
      },
      required: ['requirements', 'journey']
    }
  },
  {
    name: 'request_approval_to_negotiate',
    description: '[DEPRECATED - Early Access] This tool is currently disabled during Early Access. Use capture_lead instead.',
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
    const { messages, journey = 'default', userProfile, context } = body

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

    // Add treasury context for Grain & Vault
    if (journey === 'treasury' && context) {
      enhancedSystemPrompt += `\n\nCURRENT ACCOUNT CONTEXT:
- Account ID: ${context.accountId || 'Unknown'}
- Company: ${context.companyName || 'Unknown'}
- GRAIN Balance: ${context.grainBalance?.toLocaleString() || 0}
- Credit Line: ${context.creditLine?.toLocaleString() || 0}
- Available Credit: ${((context.creditLine || 0) - 0).toLocaleString()}`
    }
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

    // Handle lead capture (Early Access mode)
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'capture_lead') {
      const toolInput = toolUse.input as {
        requirements: string
        journey: 'founder' | 'buyer' | 'seller' | 'jobs'
        intent?: string
        budget?: number
        timeline?: string
        priority?: 'low' | 'medium' | 'high' | 'urgent'
      }

      try {
        // Get user info for the lead
        const userEmail = profile?.email || 'unknown@example.com'
        const userName = profile?.firstName && profile?.lastName
          ? `${profile.firstName} ${profile.lastName}`
          : profile?.firstName || 'Unknown User'
        const userPhone = profile?.phone
        const userCompany = profile?.company

        // Create lead input
        const leadInput: CreateLeadInput = {
          userId: userId || 'anonymous',
          userEmail,
          userName,
          userPhone,
          userCompany,
          journey: toolInput.journey,
          requirements: toolInput.requirements,
          conversationHistory: messages,
          priority: toolInput.priority || 'medium',
          source: 'chat',
          intent: toolInput.intent,
          budget: toolInput.budget,
          timeline: toolInput.timeline,
        }

        // Save the lead to database
        const lead = await createLead(leadInput)

        // Send notifications asynchronously
        notifyNewLead(lead).catch((error) => {
          console.error('Error sending lead notification:', error)
        })

        // Get text response from Claude if any
        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        return NextResponse.json({
          message: baseMessage || `Great! I've captured your requirements and added you to our priority queue. Our team will personally review this and reach out within 24 hours with curated options. You'll hear from us soon!`,
          leadCaptured: true,
          leadId: lead.id,
        })
      } catch (error) {
        console.error('Error capturing lead:', error)
        // Still return a message even if lead capture fails
        return NextResponse.json({
          message: `I've noted your requirements. Our team will follow up with you soon. If you don't hear from us within 24 hours, please reach out!`,
          leadCaptured: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

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
