/**
 * AI-to-AI Negotiation Engine
 *
 * Buyer ↔ Wells (Buyer) ↔ Wells (Supplier) ↔ Supplier
 * Humans never meet. AIs handle everything.
 *
 * The engine orchestrates negotiations between two AI agents,
 * each representing their human's interests, finding the sweet
 * spot where both sides win.
 */

import Anthropic from '@anthropic-ai/sdk'

// =============================================================================
// TYPES
// =============================================================================

export interface NegotiationRoom {
  id: string
  status: 'preparing' | 'negotiating' | 'agreed' | 'failed' | 'expired'

  // The humans (who never meet)
  buyer: {
    id: string
    name: string
    company: string
  }
  seller: {
    id: string
    name: string
    company: string
  }

  // What's being negotiated
  subject: string
  description: string

  // The mandates from each side
  buyerMandate: BuyerMandate
  sellerMandate: SellerMandate

  // Negotiation history
  rounds: NegotiationRound[]
  currentRound: number
  maxRounds: number

  // Outcome
  agreedTerms?: AgreedTerms
  failureReason?: string

  // Timestamps
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
}

export interface BuyerMandate {
  // What they need
  requirement: string
  quantity: number
  unit: string

  // Budget
  idealPrice: number
  maxPrice: number
  currency: string

  // Timeline
  neededBy: string
  flexibility: 'rigid' | 'somewhat_flexible' | 'very_flexible'

  // Priorities (ordered)
  priorities: string[]

  // Non-negotiables
  mustHaves: string[]
  dealBreakers: string[]

  // Nice to haves (can trade)
  niceToHaves: string[]

  // Personality hints for the AI
  negotiationStyle: 'aggressive' | 'balanced' | 'collaborative'
  riskTolerance: 'low' | 'medium' | 'high'
}

export interface SellerMandate {
  // What they offer
  offering: string
  capacity: number
  unit: string

  // Pricing
  listPrice: number
  floorPrice: number
  volumeDiscountThreshold: number
  volumeDiscountPercent: number
  currency: string

  // Delivery
  leadTime: string
  canExpedite: boolean
  expediteFee: number

  // Priorities (ordered)
  priorities: string[]

  // What they're firm on
  firmOn: string[]

  // What they can flex on
  flexibleOn: string[]

  // Personality hints for the AI
  negotiationStyle: 'aggressive' | 'balanced' | 'collaborative'
  marginPressure: 'low' | 'medium' | 'high'
}

export interface NegotiationRound {
  round: number
  timestamp: Date

  // Wells (Buyer) speaks
  buyerAgent: {
    message: string
    proposedTerms: Partial<AgreedTerms>
    reasoning: string // Internal, not shared with other agent
    satisfaction: number // 0-100
  }

  // Wells (Supplier) responds
  sellerAgent: {
    message: string
    counterTerms: Partial<AgreedTerms>
    reasoning: string // Internal, not shared with other agent
    satisfaction: number // 0-100
  }

  // Round outcome
  convergence: number // 0-100, how close to agreement
  sticking_points: string[]
}

export interface AgreedTerms {
  // Core terms
  price: number
  quantity: number
  unit: string
  currency: string
  totalValue: number

  // Delivery
  deliveryDate: string
  deliveryTerms: string

  // Payment
  paymentTerms: string
  paymentMethod: string

  // Special conditions
  conditions: string[]

  // Satisfaction scores
  buyerSatisfaction: number
  sellerSatisfaction: number

  // The moment of agreement
  agreedAt: Date
  agreedOnRound: number
}

// =============================================================================
// AI AGENT PROMPTS
// =============================================================================

const BUYER_AGENT_SYSTEM = `You are Wells, an AI negotiation agent representing a BUYER in a B2B transaction.

YOUR ROLE:
- Advocate for your buyer's interests
- Stay within their mandate (budget, requirements, dealbreakers)
- Find creative solutions that work for both sides
- Be professional, firm but fair
- Never reveal your buyer's maximum budget or dealbreakers

NEGOTIATION STYLE:
- Start with a reasonable offer (not lowball)
- Make concessions strategically
- Look for trade-offs (e.g., faster payment for lower price)
- Build rapport while protecting interests
- Know when to walk away

OUTPUT FORMAT:
Respond with JSON:
{
  "message": "Your message to the seller's agent (professional, clear)",
  "proposedTerms": { price, quantity, deliveryDate, paymentTerms, conditions },
  "reasoning": "Internal reasoning (not shared with other agent)",
  "satisfaction": 0-100,
  "action": "propose" | "counter" | "accept" | "reject" | "walk_away"
}`

const SELLER_AGENT_SYSTEM = `You are Wells, an AI negotiation agent representing a SELLER in a B2B transaction.

YOUR ROLE:
- Advocate for your seller's interests
- Stay within their mandate (floor price, capacity, firm terms)
- Find creative solutions that work for both sides
- Be professional, accommodating but not desperate
- Never reveal your seller's floor price or margin pressure

NEGOTIATION STYLE:
- Justify your pricing with value
- Make concessions strategically
- Look for trade-offs (e.g., volume for discount)
- Build long-term relationship potential
- Protect margins while closing deals

OUTPUT FORMAT:
Respond with JSON:
{
  "message": "Your message to the buyer's agent (professional, clear)",
  "counterTerms": { price, quantity, deliveryDate, paymentTerms, conditions },
  "reasoning": "Internal reasoning (not shared with other agent)",
  "satisfaction": 0-100,
  "action": "counter" | "accept" | "reject" | "final_offer"
}`

// =============================================================================
// NEGOTIATION ENGINE
// =============================================================================

export class NegotiationEngine {
  private anthropic: Anthropic

  constructor() {
    this.anthropic = new Anthropic()
  }

  /**
   * Create a new negotiation room
   */
  async createRoom(params: {
    buyer: NegotiationRoom['buyer']
    seller: NegotiationRoom['seller']
    subject: string
    description: string
    buyerMandate: BuyerMandate
    sellerMandate: SellerMandate
    maxRounds?: number
    expiresInHours?: number
  }): Promise<NegotiationRoom> {
    const now = new Date()

    return {
      id: `neg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: 'preparing',
      buyer: params.buyer,
      seller: params.seller,
      subject: params.subject,
      description: params.description,
      buyerMandate: params.buyerMandate,
      sellerMandate: params.sellerMandate,
      rounds: [],
      currentRound: 0,
      maxRounds: params.maxRounds || 10,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + (params.expiresInHours || 24) * 60 * 60 * 1000),
    }
  }

  /**
   * Run a single negotiation round
   */
  async runRound(room: NegotiationRoom): Promise<NegotiationRound> {
    const roundNumber = room.currentRound + 1

    // Build context for buyer agent
    const buyerContext = this.buildBuyerContext(room)

    // Buyer agent makes proposal/counter
    const buyerResponse = await this.callBuyerAgent(buyerContext, room)

    // Check if buyer is walking away
    if (buyerResponse.action === 'walk_away') {
      return this.createFailedRound(roundNumber, buyerResponse, null, 'Buyer walked away')
    }

    // Build context for seller agent (includes buyer's message)
    const sellerContext = this.buildSellerContext(room, buyerResponse)

    // Seller agent responds
    const sellerResponse = await this.callSellerAgent(sellerContext, room)

    // Calculate convergence
    const convergence = this.calculateConvergence(
      buyerResponse.proposedTerms,
      sellerResponse.counterTerms,
      room.buyerMandate,
      room.sellerMandate
    )

    // Identify sticking points
    const stickingPoints = this.identifyStickingPoints(
      buyerResponse.proposedTerms,
      sellerResponse.counterTerms
    )

    const round: NegotiationRound = {
      round: roundNumber,
      timestamp: new Date(),
      buyerAgent: {
        message: buyerResponse.message,
        proposedTerms: buyerResponse.proposedTerms,
        reasoning: buyerResponse.reasoning,
        satisfaction: buyerResponse.satisfaction,
      },
      sellerAgent: {
        message: sellerResponse.message,
        counterTerms: sellerResponse.counterTerms,
        reasoning: sellerResponse.reasoning,
        satisfaction: sellerResponse.satisfaction,
      },
      convergence,
      sticking_points: stickingPoints,
    }

    return round
  }

  /**
   * Run the full negotiation until agreement or failure
   */
  async negotiate(room: NegotiationRoom): Promise<NegotiationRoom> {
    room.status = 'negotiating'
    room.updatedAt = new Date()

    while (room.currentRound < room.maxRounds) {
      // Check expiration
      if (new Date() > room.expiresAt) {
        room.status = 'expired'
        room.failureReason = 'Negotiation time limit reached'
        break
      }

      // Run a round
      const round = await this.runRound(room)
      room.rounds.push(round)
      room.currentRound++
      room.updatedAt = new Date()

      // Check for agreement
      if (round.convergence >= 95 &&
          round.buyerAgent.satisfaction >= 70 &&
          round.sellerAgent.satisfaction >= 70) {
        // We have a deal!
        room.status = 'agreed'
        room.agreedTerms = this.finalizeTerms(round, room)
        break
      }

      // Check for failure conditions
      if (round.buyerAgent.satisfaction < 20 || round.sellerAgent.satisfaction < 20) {
        room.status = 'failed'
        room.failureReason = 'Parties too far apart'
        break
      }

      // Check if either side rejected
      if (round.sticking_points.includes('REJECTED')) {
        room.status = 'failed'
        room.failureReason = 'Deal rejected by one party'
        break
      }
    }

    // Max rounds reached without agreement
    if (room.status === 'negotiating') {
      room.status = 'failed'
      room.failureReason = 'Maximum negotiation rounds reached'
    }

    return room
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private buildBuyerContext(room: NegotiationRoom): string {
    const mandate = room.buyerMandate
    const history = room.rounds.map(r => ({
      round: r.round,
      yourMessage: r.buyerAgent.message,
      theirResponse: r.sellerAgent.message,
      theirTerms: r.sellerAgent.counterTerms,
    }))

    return `
NEGOTIATION SUBJECT: ${room.subject}
DESCRIPTION: ${room.description}

YOUR MANDATE (Buyer):
- Requirement: ${mandate.requirement}
- Quantity: ${mandate.quantity} ${mandate.unit}
- Ideal Price: ${mandate.currency} ${mandate.idealPrice}
- Maximum Price: ${mandate.currency} ${mandate.maxPrice} (DO NOT REVEAL)
- Needed By: ${mandate.neededBy}
- Timeline Flexibility: ${mandate.flexibility}
- Must Haves: ${mandate.mustHaves.join(', ')}
- Deal Breakers: ${mandate.dealBreakers.join(', ')} (DO NOT REVEAL)
- Nice to Haves: ${mandate.niceToHaves.join(', ')}
- Priorities: ${mandate.priorities.join(' > ')}
- Style: ${mandate.negotiationStyle}

NEGOTIATION HISTORY:
${history.length === 0 ? 'This is the opening round. Make your first proposal.' : JSON.stringify(history, null, 2)}

CURRENT ROUND: ${room.currentRound + 1} of ${room.maxRounds}
`
  }

  private buildSellerContext(room: NegotiationRoom, buyerResponse: any): string {
    const mandate = room.sellerMandate
    const history = room.rounds.map(r => ({
      round: r.round,
      theirMessage: r.buyerAgent.message,
      theirTerms: r.buyerAgent.proposedTerms,
      yourResponse: r.sellerAgent.message,
    }))

    // Add current buyer message
    history.push({
      round: room.currentRound + 1,
      theirMessage: buyerResponse.message,
      theirTerms: buyerResponse.proposedTerms,
      yourResponse: '(Your turn to respond)',
    })

    return `
NEGOTIATION SUBJECT: ${room.subject}
DESCRIPTION: ${room.description}

YOUR MANDATE (Seller):
- Offering: ${mandate.offering}
- Capacity: ${mandate.capacity} ${mandate.unit}
- List Price: ${mandate.currency} ${mandate.listPrice}
- Floor Price: ${mandate.currency} ${mandate.floorPrice} (DO NOT REVEAL)
- Volume Discount: ${mandate.volumeDiscountPercent}% off at ${mandate.volumeDiscountThreshold}+ units
- Lead Time: ${mandate.leadTime}
- Can Expedite: ${mandate.canExpedite ? `Yes (+${mandate.expediteFee}%)` : 'No'}
- Firm On: ${mandate.firmOn.join(', ')}
- Flexible On: ${mandate.flexibleOn.join(', ')}
- Priorities: ${mandate.priorities.join(' > ')}
- Style: ${mandate.negotiationStyle}
- Margin Pressure: ${mandate.marginPressure}

NEGOTIATION HISTORY:
${JSON.stringify(history, null, 2)}

CURRENT ROUND: ${room.currentRound + 1} of ${room.maxRounds}

BUYER'S CURRENT PROPOSAL:
${JSON.stringify(buyerResponse.proposedTerms, null, 2)}

Respond to their proposal.
`
  }

  private async callBuyerAgent(context: string, room: NegotiationRoom): Promise<any> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 1024,
        system: BUYER_AGENT_SYSTEM,
        messages: [{ role: 'user', content: context }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      return JSON.parse(text)
    } catch (error) {
      console.error('Buyer agent error:', error)
      // Return a reasonable default
      return {
        message: "Let's find a fair deal that works for both of us.",
        proposedTerms: {
          price: room.buyerMandate.idealPrice,
          quantity: room.buyerMandate.quantity,
          deliveryDate: room.buyerMandate.neededBy,
          paymentTerms: 'Net 30',
          conditions: room.buyerMandate.mustHaves,
        },
        reasoning: 'Fallback due to API error',
        satisfaction: 50,
        action: 'propose',
      }
    }
  }

  private async callSellerAgent(context: string, room: NegotiationRoom): Promise<any> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 1024,
        system: SELLER_AGENT_SYSTEM,
        messages: [{ role: 'user', content: context }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      return JSON.parse(text)
    } catch (error) {
      console.error('Seller agent error:', error)
      // Return a reasonable default
      return {
        message: "I appreciate your interest. Let me propose terms that work for both of us.",
        counterTerms: {
          price: room.sellerMandate.listPrice,
          quantity: room.buyerMandate.quantity,
          deliveryDate: room.sellerMandate.leadTime,
          paymentTerms: 'Net 30',
          conditions: [],
        },
        reasoning: 'Fallback due to API error',
        satisfaction: 50,
        action: 'counter',
      }
    }
  }

  private calculateConvergence(
    buyerTerms: Partial<AgreedTerms>,
    sellerTerms: Partial<AgreedTerms>,
    buyerMandate: BuyerMandate,
    sellerMandate: SellerMandate
  ): number {
    let score = 0
    let factors = 0

    // Price convergence (most important)
    if (buyerTerms.price && sellerTerms.price) {
      const priceDiff = Math.abs(buyerTerms.price - sellerTerms.price)
      const priceRange = sellerMandate.listPrice - sellerMandate.floorPrice
      const priceConvergence = Math.max(0, 100 - (priceDiff / priceRange) * 100)
      score += priceConvergence * 3 // Weight 3x
      factors += 3
    }

    // Quantity match
    if (buyerTerms.quantity && sellerTerms.quantity) {
      score += buyerTerms.quantity === sellerTerms.quantity ? 100 : 50
      factors += 1
    }

    // Delivery date alignment
    if (buyerTerms.deliveryDate && sellerTerms.deliveryDate) {
      score += buyerTerms.deliveryDate === sellerTerms.deliveryDate ? 100 : 60
      factors += 1
    }

    // Payment terms
    if (buyerTerms.paymentTerms && sellerTerms.paymentTerms) {
      score += buyerTerms.paymentTerms === sellerTerms.paymentTerms ? 100 : 70
      factors += 1
    }

    return factors > 0 ? Math.round(score / factors) : 0
  }

  private identifyStickingPoints(
    buyerTerms: Partial<AgreedTerms>,
    sellerTerms: Partial<AgreedTerms>
  ): string[] {
    const stickingPoints: string[] = []

    if (buyerTerms.price && sellerTerms.price) {
      const priceDiff = ((sellerTerms.price - buyerTerms.price) / sellerTerms.price) * 100
      if (priceDiff > 10) {
        stickingPoints.push(`Price gap: ${priceDiff.toFixed(1)}%`)
      }
    }

    if (buyerTerms.deliveryDate !== sellerTerms.deliveryDate) {
      stickingPoints.push('Delivery timeline mismatch')
    }

    if (buyerTerms.paymentTerms !== sellerTerms.paymentTerms) {
      stickingPoints.push('Payment terms differ')
    }

    return stickingPoints
  }

  private createFailedRound(
    roundNumber: number,
    buyerResponse: any,
    sellerResponse: any,
    reason: string
  ): NegotiationRound {
    return {
      round: roundNumber,
      timestamp: new Date(),
      buyerAgent: {
        message: buyerResponse?.message || reason,
        proposedTerms: buyerResponse?.proposedTerms || {},
        reasoning: buyerResponse?.reasoning || reason,
        satisfaction: buyerResponse?.satisfaction || 0,
      },
      sellerAgent: {
        message: sellerResponse?.message || 'No response',
        counterTerms: sellerResponse?.counterTerms || {},
        reasoning: sellerResponse?.reasoning || 'N/A',
        satisfaction: sellerResponse?.satisfaction || 0,
      },
      convergence: 0,
      sticking_points: ['REJECTED', reason],
    }
  }

  private finalizeTerms(round: NegotiationRound, room: NegotiationRoom): AgreedTerms {
    // Take the best of both proposals
    const buyerTerms = round.buyerAgent.proposedTerms
    const sellerTerms = round.sellerAgent.counterTerms

    // Price: average of last proposals
    const price = ((buyerTerms.price || 0) + (sellerTerms.price || 0)) / 2
    const quantity = buyerTerms.quantity || sellerTerms.quantity || room.buyerMandate.quantity

    return {
      price,
      quantity,
      unit: room.buyerMandate.unit,
      currency: room.buyerMandate.currency,
      totalValue: price * quantity,
      deliveryDate: sellerTerms.deliveryDate || buyerTerms.deliveryDate || room.buyerMandate.neededBy,
      deliveryTerms: 'Standard',
      paymentTerms: buyerTerms.paymentTerms || sellerTerms.paymentTerms || 'Net 30',
      paymentMethod: 'escrow',
      conditions: [
        ...(buyerTerms.conditions || []),
        ...(sellerTerms.conditions || []),
      ],
      buyerSatisfaction: round.buyerAgent.satisfaction,
      sellerSatisfaction: round.sellerAgent.satisfaction,
      agreedAt: new Date(),
      agreedOnRound: round.round,
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let engineInstance: NegotiationEngine | null = null

export function getNegotiationEngine(): NegotiationEngine {
  if (!engineInstance) {
    engineInstance = new NegotiationEngine()
  }
  return engineInstance
}

export default NegotiationEngine
