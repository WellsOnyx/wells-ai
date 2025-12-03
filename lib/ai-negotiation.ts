/**
 * Wells AI-to-AI Negotiation Engine
 *
 * The core insight: Instead of humans negotiating awkwardly,
 * their AIs negotiate for them. More efficient AND more human.
 *
 * How it works:
 * 1. Buyer's Wells AI knows what they need, budget, timeline
 * 2. Seller's Wells AI knows their products, pricing, capacity
 * 3. The two AIs negotiate in milliseconds
 * 4. Humans just approve the final deal
 *
 * "Yes, proceed" = deal done
 */

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

export interface PartyProfile {
  id: string
  type: 'buyer' | 'seller' | 'founder' | 'candidate' | 'investor'
  name: string
  preferences: {
    // Buyer preferences
    maxBudget?: number
    targetPrice?: number
    requiredBy?: Date
    qualityPriority?: 'low' | 'medium' | 'high'

    // Seller preferences
    minPrice?: number
    targetMargin?: number
    leadTime?: number
    minOrderQuantity?: number

    // Candidate preferences
    minSalary?: number
    targetSalary?: number
    remoteOnly?: boolean
    industries?: string[]

    // Founder/hiring preferences
    maxSalary?: number
    startDate?: Date
    roleRequirements?: string[]
  }
  context: string // Natural language description of what they want/offer
}

export interface NegotiationRequest {
  id: string
  type: 'procurement' | 'hiring' | 'partnership' | 'investment'
  initiator: PartyProfile
  responder: PartyProfile
  subject: string // "500 industrial motors" or "CTO role" or "Series A"
  initialTerms?: Record<string, unknown>
}

export interface NegotiationMessage {
  round: number
  from: 'initiator_ai' | 'responder_ai'
  proposal: {
    price?: number
    quantity?: number
    timeline?: string
    salary?: number
    equity?: number
    terms?: string[]
  }
  reasoning: string // AI's internal reasoning (visible to their human)
  message: string // What they "said" to the other AI
  accepted: boolean
  counterOffer: boolean
}

export interface NegotiationResult {
  id: string
  status: 'agreed' | 'no_deal' | 'needs_human_input'
  rounds: number
  finalTerms?: {
    price?: number
    quantity?: number
    timeline?: string
    salary?: number
    equity?: number
    deliverables?: string[]
  }
  conversation: NegotiationMessage[]
  initiatorSummary: string // Summary for the buyer/founder
  responderSummary: string // Summary for the seller/candidate
  humanApprovalNeeded: {
    initiator: boolean
    responder: boolean
  }
}

// ============================================================================
// AI-TO-AI NEGOTIATION
// ============================================================================

/**
 * Run a full AI-to-AI negotiation
 * Returns when either:
 * - Both AIs agree on terms
 * - Max rounds reached (needs human input)
 * - One AI determines no deal is possible
 */
export async function runNegotiation(
  request: NegotiationRequest,
  maxRounds: number = 5
): Promise<NegotiationResult> {
  const conversation: NegotiationMessage[] = []
  let currentRound = 0
  let agreed = false
  let noDeal = false

  // Initial proposal from initiator's AI
  let lastProposal = await generateProposal(
    request,
    'initiator_ai',
    conversation,
    currentRound
  )
  conversation.push(lastProposal)

  while (currentRound < maxRounds && !agreed && !noDeal) {
    currentRound++

    // Responder's AI evaluates and responds
    const response = await generateProposal(
      request,
      'responder_ai',
      conversation,
      currentRound
    )
    conversation.push(response)

    if (response.accepted) {
      agreed = true
      break
    }

    if (!response.counterOffer) {
      noDeal = true
      break
    }

    // Initiator's AI evaluates counter-offer
    const counter = await generateProposal(
      request,
      'initiator_ai',
      conversation,
      currentRound
    )
    conversation.push(counter)

    if (counter.accepted) {
      agreed = true
      break
    }

    if (!counter.counterOffer) {
      noDeal = true
      break
    }

    lastProposal = counter
  }

  // Generate summaries for both parties
  const summaries = await generateSummaries(request, conversation, agreed)

  return {
    id: `neg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    status: agreed ? 'agreed' : noDeal ? 'no_deal' : 'needs_human_input',
    rounds: currentRound,
    finalTerms: agreed ? extractFinalTerms(conversation) : undefined,
    conversation,
    initiatorSummary: summaries.initiator,
    responderSummary: summaries.responder,
    humanApprovalNeeded: {
      initiator: agreed, // If agreed, need human to confirm
      responder: agreed,
    },
  }
}

// ============================================================================
// PROPOSAL GENERATION
// ============================================================================

async function generateProposal(
  request: NegotiationRequest,
  role: 'initiator_ai' | 'responder_ai',
  history: NegotiationMessage[],
  round: number
): Promise<NegotiationMessage> {
  const party = role === 'initiator_ai' ? request.initiator : request.responder
  const otherParty = role === 'initiator_ai' ? request.responder : request.initiator

  const systemPrompt = `You are the AI negotiator for ${party.name}. You are negotiating ${request.subject} with ${otherParty.name}'s AI.

Your client's profile:
- Type: ${party.type}
- Context: ${party.context}
- Preferences: ${JSON.stringify(party.preferences)}

You must:
1. Advocate for your client's interests
2. Find mutually beneficial terms when possible
3. Be efficient - don't waste rounds on small differences
4. Know when to accept, counter-offer, or walk away

Respond in JSON format:
{
  "proposal": { "price": number, "quantity": number, "timeline": "string", "terms": ["string"] },
  "reasoning": "Your internal reasoning (your client will see this)",
  "message": "What you say to the other AI",
  "accepted": boolean,
  "counterOffer": boolean
}`

  const historyContext = history.length > 0
    ? `\n\nNegotiation history:\n${history.map(h =>
        `Round ${h.round} - ${h.from}: ${h.message}`
      ).join('\n')}`
    : '\n\nThis is the opening proposal.'

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Generate your ${round === 0 ? 'opening proposal' : 'response'} for this negotiation.${historyContext}`
    }]
  })

  const textBlock = response.content.find(block => block.type === 'text')
  const text = textBlock?.type === 'text' ? textBlock.text : '{}'

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] || '{}')

    return {
      round,
      from: role,
      proposal: parsed.proposal || {},
      reasoning: parsed.reasoning || '',
      message: parsed.message || '',
      accepted: parsed.accepted || false,
      counterOffer: parsed.counterOffer !== false, // Default to true
    }
  } catch {
    // Fallback if JSON parsing fails
    return {
      round,
      from: role,
      proposal: {},
      reasoning: 'Processing error',
      message: text.slice(0, 200),
      accepted: false,
      counterOffer: true,
    }
  }
}

// ============================================================================
// SUMMARIES
// ============================================================================

async function generateSummaries(
  request: NegotiationRequest,
  conversation: NegotiationMessage[],
  agreed: boolean
): Promise<{ initiator: string; responder: string }> {
  const conversationText = conversation.map(m =>
    `${m.from}: ${m.message}`
  ).join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Summarize this AI-to-AI negotiation for both parties.

Subject: ${request.subject}
Outcome: ${agreed ? 'Agreement reached' : 'No agreement'}

Conversation:
${conversationText}

Provide two brief summaries (2-3 sentences each):
1. For ${request.initiator.name} (the ${request.initiator.type})
2. For ${request.responder.name} (the ${request.responder.type})

Format as JSON: { "initiator": "summary", "responder": "summary" }`
    }]
  })

  const textBlock = response.content.find(block => block.type === 'text')
  const text = textBlock?.type === 'text' ? textBlock.text : '{}'

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    return JSON.parse(jsonMatch?.[0] || '{}')
  } catch {
    return {
      initiator: agreed ? 'Your AI reached an agreement. Review the terms below.' : 'No agreement was reached. You may want to adjust your requirements.',
      responder: agreed ? 'Your AI reached an agreement. Review the terms below.' : 'No agreement was reached. The other party\'s requirements may not match your offerings.',
    }
  }
}

function extractFinalTerms(conversation: NegotiationMessage[]): NegotiationResult['finalTerms'] {
  // Get the last accepted proposal
  for (let i = conversation.length - 1; i >= 0; i--) {
    if (conversation[i].accepted || i === conversation.length - 1) {
      return conversation[i].proposal as NegotiationResult['finalTerms']
    }
  }
  return undefined
}

// ============================================================================
// QUICK MATCH - For simple cases
// ============================================================================

/**
 * Quick match for simple buyer-seller scenarios
 * Used when preferences clearly align
 */
export async function quickMatch(
  buyer: PartyProfile,
  sellers: PartyProfile[]
): Promise<{
  matches: Array<{
    seller: PartyProfile
    compatibility: number
    suggestedTerms: Record<string, unknown>
  }>
}> {
  const matchPrompt = `You are matching a buyer with potential sellers.

Buyer: ${buyer.name}
Needs: ${buyer.context}
Budget: ${buyer.preferences.maxBudget || 'Not specified'}
Timeline: ${buyer.preferences.requiredBy || 'Flexible'}

Sellers:
${sellers.map((s, i) => `${i + 1}. ${s.name}: ${s.context}`).join('\n')}

Rate each seller 0-100 on compatibility and suggest terms.
Return JSON: { "matches": [{ "index": number, "compatibility": number, "suggestedTerms": {} }] }`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: matchPrompt }]
  })

  const textBlock = response.content.find(block => block.type === 'text')
  const text = textBlock?.type === 'text' ? textBlock.text : '{}'

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] || '{ "matches": [] }')

    return {
      matches: (parsed.matches || []).map((m: { index: number; compatibility: number; suggestedTerms: Record<string, unknown> }) => ({
        seller: sellers[m.index] || sellers[0],
        compatibility: m.compatibility,
        suggestedTerms: m.suggestedTerms || {},
      })).filter((m: { seller: PartyProfile; compatibility: number }) => m.compatibility > 50)
        .sort((a: { compatibility: number }, b: { compatibility: number }) => b.compatibility - a.compatibility)
    }
  } catch {
    return { matches: [] }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const AItoAI = {
  runNegotiation,
  quickMatch,
}

export default AItoAI
