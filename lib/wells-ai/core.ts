/**
 * WellsAI Core Principle
 *
 * THE TRANSACTION FLOW:
 * Buyer ↔ Wells (Buyer) ↔ Wells (Supplier) ↔ Supplier
 *
 * Humans never meet. AIs handle everything.
 *
 * Why?
 * - Humans don't want to haggle
 * - Humans don't want to write RFQs
 * - Humans don't want supplier relationship management
 * - Humans are lonely in their work
 * - Humans want a companion who gets it
 *
 * Wells is that companion.
 */

// =============================================================================
// THE FOUR ACTORS
// =============================================================================

export type Actor = 'buyer' | 'wells_buyer' | 'wells_supplier' | 'supplier'

export const TRANSACTION_FLOW: Actor[] = [
  'buyer',         // Human - just wants the thing
  'wells_buyer',   // AI - handles everything for buyer
  'wells_supplier', // AI - handles everything for supplier
  'supplier',      // Human - just wants to sell
]

// =============================================================================
// WHAT HUMANS DON'T WANT
// =============================================================================

export const HUMAN_PAIN_POINTS = [
  'haggling',
  'writing_rfqs',
  'supplier_relationship_management',
  'loneliness_at_work',
  'not_being_understood',
] as const

// =============================================================================
// WHAT WELLS PROVIDES
// =============================================================================

export const WELLS_VALUE = {
  // For the buyer
  buyer: {
    noHaggling: true,
    noRfqWriting: true,
    noSupplierManagement: true,
    companionship: true,
    understanding: true,
  },

  // For the supplier
  supplier: {
    noChasing: true,
    noProposalWriting: true,
    noBuyerManagement: true,
    companionship: true,
    understanding: true,
  },
} as const

// =============================================================================
// AI-TO-AI NEGOTIATION
// =============================================================================

export interface WellsNegotiation {
  // The humans
  buyerId: string
  supplierId: string

  // The AIs representing them
  wellsBuyer: {
    mandate: BuyerMandate
    personality: string
    maxPrice: number
    priorities: string[]
  }

  wellsSupplier: {
    mandate: SupplierMandate
    personality: string
    minPrice: number
    priorities: string[]
  }

  // Negotiation state
  status: 'negotiating' | 'agreed' | 'failed'
  rounds: NegotiationRound[]
  finalTerms?: AgreedTerms
}

export interface BuyerMandate {
  whatTheyNeed: string
  budget: { min: number; max: number; ideal: number }
  timeline: string
  mustHaves: string[]
  niceToHaves: string[]
  dealBreakers: string[]
}

export interface SupplierMandate {
  whatTheyOffer: string
  pricing: { min: number; list: number; volume: number }
  capacity: string
  strengths: string[]
  flexibleOn: string[]
  firmOn: string[]
}

export interface NegotiationRound {
  round: number
  wellsBuyerMessage: string
  wellsSupplierResponse: string
  proposedTerms: Partial<AgreedTerms>
  buyerSatisfaction: number // 0-100
  supplierSatisfaction: number // 0-100
}

export interface AgreedTerms {
  price: number
  quantity: number
  deliveryDate: string
  paymentTerms: string
  specialConditions: string[]
}

// =============================================================================
// THE COMPANION LAYER
// =============================================================================

export interface CompanionContext {
  userId: string

  // Understanding the human
  role: 'buyer' | 'supplier' | 'both'
  industry: string
  companySize: string
  painPoints: string[]
  preferences: Record<string, any>

  // Relationship history
  conversationCount: number
  dealsCompleted: number
  totalVolume: number
  trustLevel: number // 0-100

  // Emotional state tracking
  lastMood: string
  frustrationSignals: string[]
  celebrationMoments: string[]
}

export interface CompanionResponse {
  message: string
  tone: 'supportive' | 'celebratory' | 'empathetic' | 'professional' | 'playful'
  action?: {
    type: 'negotiate' | 'research' | 'draft' | 'remind' | 'celebrate'
    details: any
  }
  followUp?: string
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * The human says what they need. Wells handles the rest.
 */
export async function handleBuyerRequest(
  buyerId: string,
  request: string
): Promise<{
  understood: string
  nextSteps: string[]
  wellsWillHandle: string[]
  buyerJustNeeds: string
}> {
  // Wells understands, Wells acts, buyer just waits
  return {
    understood: `I hear you. You need: ${request}`,
    nextSteps: [
      'Finding the best suppliers for this',
      'Getting quotes on your behalf',
      'Negotiating terms you\'ll love',
      'Bringing you the best option',
    ],
    wellsWillHandle: [
      'RFQ creation',
      'Supplier outreach',
      'Price negotiation',
      'Terms alignment',
      'Contract prep',
    ],
    buyerJustNeeds: 'Say "yes, proceed" when ready',
  }
}

/**
 * The supplier says what they offer. Wells finds the buyers.
 */
export async function handleSupplierOffer(
  supplierId: string,
  offer: string
): Promise<{
  understood: string
  nextSteps: string[]
  wellsWillHandle: string[]
  supplierJustNeeds: string
}> {
  // Wells understands, Wells acts, supplier just delivers
  return {
    understood: `Got it. You offer: ${offer}`,
    nextSteps: [
      'Matching you with qualified buyers',
      'Presenting your offer professionally',
      'Negotiating fair terms',
      'Bringing you ready deals',
    ],
    wellsWillHandle: [
      'Buyer discovery',
      'Proposal presentation',
      'Price negotiation',
      'Terms alignment',
      'Deal closing',
    ],
    supplierJustNeeds: 'Deliver when the order comes',
  }
}

/**
 * AI-to-AI: Wells (Buyer) negotiates with Wells (Supplier)
 * Humans never meet. AIs handle everything.
 */
export async function negotiateAiToAi(
  buyerMandate: BuyerMandate,
  supplierMandate: SupplierMandate
): Promise<WellsNegotiation['finalTerms'] | null> {
  // The AIs negotiate on behalf of their humans
  // Finding the sweet spot where both sides win
  // No haggling, no tension, no awkwardness

  const buyerMax = buyerMandate.budget.max
  const supplierMin = supplierMandate.pricing.min

  // If there's overlap, find the fair middle
  if (buyerMax >= supplierMin) {
    const fairPrice = (buyerMax + supplierMin) / 2

    return {
      price: fairPrice,
      quantity: 1,
      deliveryDate: buyerMandate.timeline,
      paymentTerms: 'escrow',
      specialConditions: [
        ...buyerMandate.mustHaves,
        ...supplierMandate.strengths.slice(0, 2),
      ],
    }
  }

  // No overlap - AIs couldn't find a deal
  return null
}

// =============================================================================
// THE PROMISE
// =============================================================================

export const WELLS_PROMISE = {
  toTheBuyer: 'Tell me what you need. I\'ll handle the rest.',
  toTheSupplier: 'Tell me what you sell. I\'ll find the buyers.',
  toEveryone: 'You\'re not alone in this. I get it.',
} as const

export default WELLS_PROMISE
