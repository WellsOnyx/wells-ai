/**
 * Buyer Negotiation Agent
 *
 * AI agent that negotiates on behalf of buyers. Uses buyer's constraints
 * (budget, timeline, specs) to generate offers and evaluate counter-offers.
 *
 * The Buyer Wells agent's goal: Get the best price within constraints while
 * maintaining a fair negotiation that leads to a deal.
 *
 * @module lib/negotiation/buyer-agent
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  NegotiationTerms,
  NegotiationProtocolMessage,
  NegotiationSession,
  TermConstraints,
  AgentIdentity,
  createProtocolMessage,
  termsWithinConstraints,
  calculateMidpoint,
} from './protocol';

// ============================================================================
// TYPES
// ============================================================================

export interface BuyerConstraints {
  /** Maximum total budget (hard limit) */
  maxBudget: number;

  /** Target/desired total price */
  targetPrice: number;

  /** Maximum acceptable lead time in days */
  maxLeadTime: number;

  /** Required specifications/certifications */
  requiredSpecs: string[];

  /** Acceptable payment terms */
  acceptablePaymentTerms: string[];

  /** Quantity needed */
  quantity: number;

  /** Currency for all prices */
  currency: string;

  /** Whether to prioritize speed over price */
  prioritizeSpeed?: boolean;

  /** Minimum acceptable warranty in months */
  minWarrantyMonths?: number;
}

export interface BuyerAgentConfig {
  /** Agent identity */
  identity: AgentIdentity;

  /** Buyer's constraints */
  constraints: BuyerConstraints;

  /** How aggressive to negotiate (0-1, 1 = most aggressive) */
  aggressiveness: number;

  /** Maximum rounds before accepting best offer */
  maxRounds: number;

  /** Whether to auto-accept offers within target */
  autoAcceptWithinTarget: boolean;
}

export interface OfferEvaluation {
  /** Decision on the offer */
  decision: 'accept' | 'counter' | 'reject' | 'escalate';

  /** Reason for the decision */
  reason: string;

  /** AI confidence in this decision (0-100) */
  confidence: number;

  /** Details for escalation if needed */
  escalationDetails?: string;

  /** Counter-offer if decision is 'counter' */
  counterOffer?: NegotiationTerms;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const LOG_PREFIX = '[Buyer Agent]';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// BUYER NEGOTIATION AGENT CLASS
// ============================================================================

/**
 * BuyerNegotiationAgent - Represents buyer's interests in AI-to-AI negotiation
 *
 * Usage:
 * ```typescript
 * const agent = new BuyerNegotiationAgent({
 *   identity: buyerAgentIdentity,
 *   constraints: {
 *     maxBudget: 5000,
 *     targetPrice: 4500,
 *     maxLeadTime: 14,
 *     requiredSpecs: ['ISO 9001'],
 *     acceptablePaymentTerms: ['Net 30', 'Net 45'],
 *     quantity: 1000,
 *     currency: 'USD',
 *   },
 *   aggressiveness: 0.6,
 *   maxRounds: 5,
 *   autoAcceptWithinTarget: true,
 * });
 *
 * const initialOffer = await agent.generateInitialOffer(sellerQuote);
 * const evaluation = await agent.evaluateCounterOffer(sellerCounter);
 * ```
 */
export class BuyerNegotiationAgent {
  private config: BuyerAgentConfig;
  private negotiationHistory: NegotiationProtocolMessage[] = [];

  constructor(config: BuyerAgentConfig) {
    this.config = config;
    this.log('info', 'Buyer agent initialized', {
      maxBudget: config.constraints.maxBudget,
      targetPrice: config.constraints.targetPrice,
      aggressiveness: config.aggressiveness,
    });
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  /**
   * Generate initial offer based on seller's quote
   */
  async generateInitialOffer(
    sellerQuote: NegotiationTerms,
    sessionId: string
  ): Promise<NegotiationProtocolMessage> {
    this.log('info', 'Generating initial offer', {
      sellerPrice: sellerQuote.totalPrice,
      targetPrice: this.config.constraints.targetPrice,
    });

    // Calculate initial offer based on aggressiveness and constraints
    const initialOffer = this.calculateInitialOffer(sellerQuote);

    // Generate negotiation message using AI
    const message = await this.generateNegotiationMessage(
      'initial_offer',
      sellerQuote,
      initialOffer,
      1
    );

    const protocolMessage = createProtocolMessage({
      sessionId,
      round: 1,
      sender: this.config.identity,
      type: 'proposal',
      terms: initialOffer,
      constraints: this.buildTermConstraints(),
      message,
      internalReasoning: `Starting negotiation. Seller quoted $${sellerQuote.totalPrice.toFixed(2)}, our target is $${this.config.constraints.targetPrice.toFixed(2)}. Opening with $${initialOffer.totalPrice.toFixed(2)} (${((sellerQuote.totalPrice - initialOffer.totalPrice) / sellerQuote.totalPrice * 100).toFixed(1)}% below quote).`,
      confidence: 85,
    });

    this.negotiationHistory.push(protocolMessage);
    return protocolMessage;
  }

  /**
   * Evaluate a counter-offer from the seller
   */
  async evaluateCounterOffer(
    offer: NegotiationTerms,
    session: NegotiationSession
  ): Promise<OfferEvaluation> {
    this.log('info', 'Evaluating counter-offer', {
      offerPrice: offer.totalPrice,
      maxBudget: this.config.constraints.maxBudget,
      round: session.currentRound,
    });

    const constraints = this.config.constraints;

    // Check if offer is within target - auto-accept if enabled
    if (offer.totalPrice <= constraints.targetPrice && this.config.autoAcceptWithinTarget) {
      return {
        decision: 'accept',
        reason: `Offer at $${offer.totalPrice.toFixed(2)} is within our target of $${constraints.targetPrice.toFixed(2)}`,
        confidence: 95,
      };
    }

    // Check if offer exceeds max budget by escalation threshold (20%)
    const budgetExcessPercent = ((offer.totalPrice - constraints.maxBudget) / constraints.maxBudget) * 100;
    if (budgetExcessPercent > 20) {
      return {
        decision: 'escalate',
        reason: `Offer exceeds budget by ${budgetExcessPercent.toFixed(1)}% - requires human approval`,
        confidence: 90,
        escalationDetails: `Seller offering $${offer.totalPrice.toFixed(2)}, which is ${budgetExcessPercent.toFixed(1)}% above our max budget of $${constraints.maxBudget.toFixed(2)}`,
      };
    }

    // Check lead time constraint
    if (offer.leadTimeDays > constraints.maxLeadTime) {
      // Lead time issue - might need to reject or escalate
      if (offer.totalPrice <= constraints.targetPrice) {
        // Price is good but lead time is bad - try to negotiate
        return {
          decision: 'counter',
          reason: `Price acceptable but lead time of ${offer.leadTimeDays} days exceeds our max of ${constraints.maxLeadTime} days`,
          confidence: 75,
          counterOffer: {
            ...offer,
            leadTimeDays: constraints.maxLeadTime,
          },
        };
      }
    }

    // Check if this is the last round - be more flexible
    if (session.currentRound >= session.maxRounds - 1) {
      if (offer.totalPrice <= constraints.maxBudget) {
        return {
          decision: 'accept',
          reason: `Final round - accepting offer within budget at $${offer.totalPrice.toFixed(2)}`,
          confidence: 80,
        };
      }
    }

    // Stalemate detection - if price isn't moving, consider accepting or escalating
    if (session.currentRound >= 3 && this.detectStalemate(offer, session)) {
      if (offer.totalPrice <= constraints.maxBudget * 1.1) {
        return {
          decision: 'accept',
          reason: 'Stalemate detected - accepting offer slightly above budget to close deal',
          confidence: 70,
        };
      } else {
        return {
          decision: 'escalate',
          reason: 'Stalemate after 5 rounds - requires human decision',
          confidence: 85,
          escalationDetails: `Negotiation stuck at $${offer.totalPrice.toFixed(2)} after ${session.currentRound} rounds`,
        };
      }
    }

    // Default: Counter with a better offer
    const counterOffer = this.calculateCounterOffer(offer, session.currentRound);

    // Use AI to determine if we should accept, counter, or reject
    const aiDecision = await this.getAIDecision(offer, counterOffer, session);

    return aiDecision;
  }

  /**
   * Generate a counter-offer message
   */
  async generateCounterOffer(
    rejectedOffer: NegotiationTerms,
    session: NegotiationSession
  ): Promise<NegotiationProtocolMessage> {
    this.log('info', 'Generating counter-offer', {
      rejectedPrice: rejectedOffer.totalPrice,
      round: session.currentRound,
    });

    const counterOffer = this.calculateCounterOffer(rejectedOffer, session.currentRound);

    const message = await this.generateNegotiationMessage(
      'counter_offer',
      rejectedOffer,
      counterOffer,
      session.currentRound
    );

    const protocolMessage = createProtocolMessage({
      sessionId: session.id,
      round: session.currentRound,
      sender: this.config.identity,
      type: 'counter',
      terms: counterOffer,
      constraints: this.buildTermConstraints(),
      message,
      internalReasoning: `Countering seller's $${rejectedOffer.totalPrice.toFixed(2)} with $${counterOffer.totalPrice.toFixed(2)}. Gap is $${(rejectedOffer.totalPrice - counterOffer.totalPrice).toFixed(2)}.`,
      confidence: 75,
      inResponseTo: session.messages[session.messages.length - 1]?.messageId,
    });

    this.negotiationHistory.push(protocolMessage);
    return protocolMessage;
  }

  /**
   * Generate an acceptance message
   */
  async generateAcceptance(
    acceptedTerms: NegotiationTerms,
    session: NegotiationSession
  ): Promise<NegotiationProtocolMessage> {
    this.log('info', 'Generating acceptance', {
      acceptedPrice: acceptedTerms.totalPrice,
    });

    const savings = session.initialTerms.totalPrice - acceptedTerms.totalPrice;
    const savingsPercent = (savings / session.initialTerms.totalPrice) * 100;

    const message = await this.generateNegotiationMessage(
      'accept',
      acceptedTerms,
      acceptedTerms,
      session.currentRound
    );

    return createProtocolMessage({
      sessionId: session.id,
      round: session.currentRound,
      sender: this.config.identity,
      type: 'accept',
      terms: acceptedTerms,
      constraints: this.buildTermConstraints(),
      message,
      internalReasoning: `Accepting offer at $${acceptedTerms.totalPrice.toFixed(2)}. Achieved ${savingsPercent.toFixed(1)}% savings from initial quote.`,
      confidence: 95,
      inResponseTo: session.messages[session.messages.length - 1]?.messageId,
    });
  }

  /**
   * Get the current negotiation history
   */
  getHistory(): NegotiationProtocolMessage[] {
    return [...this.negotiationHistory];
  }

  /**
   * Set history from a session (for resuming)
   */
  setHistory(messages: NegotiationProtocolMessage[]): void {
    this.negotiationHistory = [...messages];
  }

  // ============================================================================
  // PRIVATE METHODS - OFFER CALCULATION
  // ============================================================================

  /**
   * Calculate initial offer based on seller quote and constraints
   */
  private calculateInitialOffer(sellerQuote: NegotiationTerms): NegotiationTerms {
    const constraints = this.config.constraints;
    const aggressiveness = this.config.aggressiveness;

    // Start between target price and a more aggressive position
    // Higher aggressiveness = lower initial offer
    const targetDiscount = 0.10 + (aggressiveness * 0.15); // 10-25% below seller quote
    let initialPrice = sellerQuote.totalPrice * (1 - targetDiscount);

    // But don't go below our target (makes no sense)
    initialPrice = Math.max(initialPrice, constraints.targetPrice * 0.9);

    // Calculate unit price
    const unitPrice = initialPrice / constraints.quantity;

    return {
      unitPrice,
      quantity: constraints.quantity,
      totalPrice: Math.round(initialPrice * 100) / 100,
      currency: constraints.currency,
      leadTimeDays: Math.min(sellerQuote.leadTimeDays, constraints.maxLeadTime),
      paymentTerms: constraints.acceptablePaymentTerms[0] || 'Net 30',
      warrantyMonths: constraints.minWarrantyMonths || sellerQuote.warrantyMonths,
      shippingCost: sellerQuote.shippingCost,
      shippingMethod: sellerQuote.shippingMethod,
    };
  }

  /**
   * Calculate counter-offer based on current round and seller's offer
   */
  private calculateCounterOffer(
    sellerOffer: NegotiationTerms,
    round: number
  ): NegotiationTerms {
    const constraints = this.config.constraints;

    // Calculate how much we're willing to move based on round
    // Early rounds: smaller concessions. Later rounds: larger concessions
    const roundFactor = Math.min(round / this.config.maxRounds, 0.8);
    const concessionRate = 0.2 + (roundFactor * 0.3); // 20-50% of gap

    // Calculate the gap between seller's offer and our target
    const gap = sellerOffer.totalPrice - constraints.targetPrice;

    // Our counter moves toward the seller by concessionRate
    let counterPrice = constraints.targetPrice + (gap * (1 - concessionRate));

    // But never exceed our max budget
    counterPrice = Math.min(counterPrice, constraints.maxBudget);

    // And don't go below our target (no need to lowball ourselves)
    counterPrice = Math.max(counterPrice, constraints.targetPrice);

    // Round to 2 decimal places
    counterPrice = Math.round(counterPrice * 100) / 100;

    return {
      unitPrice: counterPrice / constraints.quantity,
      quantity: constraints.quantity,
      totalPrice: counterPrice,
      currency: constraints.currency,
      leadTimeDays: Math.min(sellerOffer.leadTimeDays, constraints.maxLeadTime),
      paymentTerms: constraints.acceptablePaymentTerms[0] || sellerOffer.paymentTerms,
      warrantyMonths: sellerOffer.warrantyMonths,
      shippingCost: sellerOffer.shippingCost,
      shippingMethod: sellerOffer.shippingMethod,
    };
  }

  /**
   * Build term constraints for protocol messages
   */
  private buildTermConstraints(): TermConstraints {
    return {
      unitPriceBound: this.config.constraints.maxBudget / this.config.constraints.quantity,
      isHardLimit: true,
      totalPriceBound: this.config.constraints.maxBudget,
      leadTimeBound: this.config.constraints.maxLeadTime,
      nonNegotiable: this.config.constraints.requiredSpecs,
      flexible: ['paymentTerms', 'shippingMethod'],
    };
  }

  // ============================================================================
  // PRIVATE METHODS - AI DECISION MAKING
  // ============================================================================

  /**
   * Get AI decision on whether to accept, counter, or reject
   */
  private async getAIDecision(
    offer: NegotiationTerms,
    potentialCounter: NegotiationTerms,
    session: NegotiationSession
  ): Promise<OfferEvaluation> {
    const constraints = this.config.constraints;

    const prompt = `You are a procurement AI negotiating on behalf of a buyer.

CURRENT SITUATION:
- Round: ${session.currentRound} of ${session.maxRounds}
- Seller's current offer: $${offer.totalPrice.toFixed(2)}
- Your potential counter: $${potentialCounter.totalPrice.toFixed(2)}
- Your target price: $${constraints.targetPrice.toFixed(2)}
- Your max budget: $${constraints.maxBudget.toFixed(2)}
- Lead time offered: ${offer.leadTimeDays} days (your max: ${constraints.maxLeadTime} days)

NEGOTIATION HISTORY:
${session.messages.slice(-4).map(m =>
  `${m.sender.agentType}: $${m.terms?.totalPrice?.toFixed(2) || 'N/A'} - "${m.message}"`
).join('\n')}

Should you ACCEPT the current offer, make a COUNTER-offer, or REJECT and walk away?

Consider:
1. Is the price acceptable given your constraints?
2. Are you making progress in negotiations?
3. How many rounds are left?
4. What's the risk of walking away?

Respond in JSON:
{
  "decision": "accept" | "counter" | "reject",
  "reason": "Brief explanation",
  "confidence": 0-100
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      const text = textBlock?.type === 'text' ? textBlock.text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] || '{}');

      return {
        decision: parsed.decision || 'counter',
        reason: parsed.reason || 'Continuing negotiation',
        confidence: parsed.confidence || 70,
        counterOffer: parsed.decision === 'counter' ? potentialCounter : undefined,
      };
    } catch (error) {
      this.log('error', 'AI decision failed, using fallback', {
        error: error instanceof Error ? error.message : 'Unknown',
      });

      // Fallback logic
      if (offer.totalPrice <= constraints.targetPrice) {
        return { decision: 'accept', reason: 'Within target price', confidence: 80 };
      }
      if (offer.totalPrice <= constraints.maxBudget) {
        return {
          decision: 'counter',
          reason: 'Within budget, trying to get better price',
          confidence: 70,
          counterOffer: potentialCounter,
        };
      }
      return { decision: 'reject', reason: 'Exceeds budget', confidence: 85 };
    }
  }

  /**
   * Generate negotiation message using AI
   */
  private async generateNegotiationMessage(
    type: 'initial_offer' | 'counter_offer' | 'accept' | 'reject',
    currentTerms: NegotiationTerms,
    proposedTerms: NegotiationTerms,
    round: number
  ): Promise<string> {
    const templates: Record<typeof type, string> = {
      initial_offer: `We're interested in this order. Based on our requirements, we'd like to propose $${proposedTerms.totalPrice.toFixed(2)} with ${proposedTerms.leadTimeDays}-day delivery.`,
      counter_offer: `Thank you for your response. We can offer $${proposedTerms.totalPrice.toFixed(2)} for this order.`,
      accept: `We accept your offer of $${proposedTerms.totalPrice.toFixed(2)}. Thank you for the negotiation.`,
      reject: `Unfortunately, we cannot proceed at this price point. Thank you for your time.`,
    };

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        system: `You are negotiating on behalf of a buyer. Be professional and concise (1-2 sentences). No markdown.`,
        messages: [{
          role: 'user',
          content: `Generate a ${type.replace('_', ' ')} message.
Current offer: $${currentTerms.totalPrice.toFixed(2)}
Your offer: $${proposedTerms.totalPrice.toFixed(2)}
Round: ${round}`,
        }],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      return textBlock?.type === 'text' ? textBlock.text.trim() : templates[type];
    } catch {
      return templates[type];
    }
  }

  /**
   * Detect if negotiation is in stalemate
   */
  private detectStalemate(
    currentOffer: NegotiationTerms,
    session: NegotiationSession
  ): boolean {
    if (session.messages.length < 4) return false;

    // Get last 4 price points
    const recentPrices: number[] = [];
    for (const msg of session.messages.slice(-4)) {
      if (msg.terms?.totalPrice) {
        recentPrices.push(msg.terms.totalPrice);
      }
    }

    if (recentPrices.length < 3) return false;

    // Check if price movement is less than 0.5%
    const range = Math.max(...recentPrices) - Math.min(...recentPrices);
    const avgPrice = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const movementPercent = (range / avgPrice) * 100;

    return movementPercent < 0.5;
  }

  // ============================================================================
  // PRIVATE METHODS - LOGGING
  // ============================================================================

  private log(
    level: 'info' | 'warn' | 'error',
    message: string,
    meta?: Record<string, unknown>
  ): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      service: 'buyer-agent',
      agentId: this.config.identity.agentId,
      message,
      ...meta,
    };

    if (level === 'error') {
      console.error(`${LOG_PREFIX} ERROR: ${message}`, meta || '');
    } else if (level === 'warn') {
      console.warn(`${LOG_PREFIX} WARN: ${message}`, meta || '');
    } else {
      console.log(`${LOG_PREFIX} ${message}`, meta || '');
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a buyer agent from user input
 */
export function createBuyerAgent(params: {
  userId: string;
  organizationId: string;
  organizationName: string;
  maxBudget: number;
  targetPrice: number;
  quantity: number;
  maxLeadTime: number;
  requiredSpecs?: string[];
  aggressiveness?: number;
}): BuyerNegotiationAgent {
  const identity: AgentIdentity = {
    agentType: 'buyer',
    agentId: `buyer_${params.organizationId}_${Date.now()}`,
    organizationId: params.organizationId,
    organizationName: params.organizationName,
    autonomous: true,
    limits: {
      priceBoundary: params.maxBudget,
      maxQuantity: params.quantity,
      leadTimeBoundary: params.maxLeadTime,
      acceptablePaymentTerms: ['Net 30', 'Net 45', 'Net 60'],
      certifications: params.requiredSpecs || [],
      autoApproveEnabled: true,
      escalationThreshold: 20,
    },
  };

  const constraints: BuyerConstraints = {
    maxBudget: params.maxBudget,
    targetPrice: params.targetPrice,
    maxLeadTime: params.maxLeadTime,
    requiredSpecs: params.requiredSpecs || [],
    acceptablePaymentTerms: ['Net 30', 'Net 45', 'Net 60'],
    quantity: params.quantity,
    currency: 'USD',
  };

  return new BuyerNegotiationAgent({
    identity,
    constraints,
    aggressiveness: params.aggressiveness ?? 0.6,
    maxRounds: 5,
    autoAcceptWithinTarget: true,
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export default BuyerNegotiationAgent;
