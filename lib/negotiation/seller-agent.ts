/**
 * Seller Negotiation Agent
 *
 * AI agent that negotiates on behalf of sellers/suppliers. Uses seller's
 * constraints (minimum margin, pricing rules, capacity) to generate quotes
 * and evaluate buyer offers.
 *
 * The Seller Wells agent's goal: Maximize profit while closing deals within
 * acceptable margin thresholds.
 *
 * @module lib/negotiation/seller-agent
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  NegotiationTerms,
  NegotiationProtocolMessage,
  NegotiationSession,
  TermConstraints,
  AgentIdentity,
  VolumeDiscount,
  createProtocolMessage,
} from './protocol';

// ============================================================================
// TYPES
// ============================================================================

export interface SellerConfig {
  /** Minimum acceptable margin as percentage (e.g., 10 = 10%) */
  minMargin: number;

  /** Target margin as percentage (e.g., 25 = 25%) */
  targetMargin: number;

  /** Volume-based discount tiers */
  volumeDiscounts: VolumeDiscount[];

  /** Maximum number of concessions allowed */
  maxConcessions: number;

  /** Cost basis per unit (internal data, not shared) */
  costPerUnit: number;

  /** Standard lead time in days */
  standardLeadTime: number;

  /** Rush lead time in days (if available) */
  rushLeadTime?: number;

  /** Rush fee percentage */
  rushFeePercent?: number;

  /** Maximum capacity per month */
  monthlyCapacity: number;

  /** Current capacity utilization (0-1) */
  currentUtilization: number;

  /** Currency */
  currency: string;
}

export interface SellerAgentConfig {
  /** Agent identity */
  identity: AgentIdentity;

  /** Seller's configuration and pricing rules */
  sellerConfig: SellerConfig;

  /** How flexible on pricing (0-1, 1 = most flexible) */
  flexibility: number;

  /** Whether to prioritize volume over margin */
  prioritizeVolume: boolean;
}

export interface QuoteGeneration {
  /** Generated quote terms */
  quote: NegotiationTerms;

  /** Margin percentage achieved */
  marginPercent: number;

  /** Confidence in this quote (0-100) */
  confidence: number;

  /** Reasoning for the quote */
  reasoning: string;
}

export interface OfferResponse {
  /** Whether to accept the offer */
  accept: boolean;

  /** Counter-offer if not accepting */
  counterOffer?: NegotiationTerms;

  /** Message to buyer */
  message: string;

  /** Internal reasoning */
  reasoning: string;

  /** Margin achieved by this response */
  marginPercent: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const LOG_PREFIX = '[Seller Agent]';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// SELLER NEGOTIATION AGENT CLASS
// ============================================================================

/**
 * SellerNegotiationAgent - Represents seller's interests in AI-to-AI negotiation
 *
 * Usage:
 * ```typescript
 * const agent = new SellerNegotiationAgent({
 *   identity: sellerAgentIdentity,
 *   sellerConfig: {
 *     minMargin: 10,
 *     targetMargin: 25,
 *     volumeDiscounts: [
 *       { minQuantity: 500, discountPercentage: 5 },
 *       { minQuantity: 1000, discountPercentage: 10 },
 *     ],
 *     maxConcessions: 4,
 *     costPerUnit: 3.50,
 *     standardLeadTime: 14,
 *     monthlyCapacity: 10000,
 *     currentUtilization: 0.6,
 *     currency: 'USD',
 *   },
 *   flexibility: 0.5,
 *   prioritizeVolume: false,
 * });
 *
 * const quote = await agent.generateQuote(rfqDetails);
 * const response = await agent.evaluateOffer(buyerOffer);
 * ```
 */
export class SellerNegotiationAgent {
  private config: SellerAgentConfig;
  private negotiationHistory: NegotiationProtocolMessage[] = [];
  private concessionsMade: number = 0;

  constructor(config: SellerAgentConfig) {
    this.config = config;
    this.log('info', 'Seller agent initialized', {
      minMargin: config.sellerConfig.minMargin,
      targetMargin: config.sellerConfig.targetMargin,
      flexibility: config.flexibility,
    });
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  /**
   * Generate initial quote for an RFQ
   */
  async generateQuote(rfq: {
    quantity: number;
    description: string;
    urgency: 'standard' | 'urgent' | 'critical';
    maxLeadTime?: number;
  }): Promise<QuoteGeneration> {
    this.log('info', 'Generating quote', {
      quantity: rfq.quantity,
      urgency: rfq.urgency,
    });

    const sellerConfig = this.config.sellerConfig;

    // Calculate base price with target margin
    let unitPrice = sellerConfig.costPerUnit * (1 + sellerConfig.targetMargin / 100);

    // Apply volume discount if applicable
    const volumeDiscount = this.getApplicableVolumeDiscount(rfq.quantity);
    if (volumeDiscount) {
      unitPrice = unitPrice * (1 - volumeDiscount.discountPercentage / 100);
      this.log('info', 'Applied volume discount', {
        quantity: rfq.quantity,
        discount: volumeDiscount.discountPercentage,
      });
    }

    // Apply rush fee if urgent
    let leadTime = sellerConfig.standardLeadTime;
    if (rfq.urgency === 'critical' && sellerConfig.rushLeadTime) {
      leadTime = sellerConfig.rushLeadTime;
      if (sellerConfig.rushFeePercent) {
        unitPrice = unitPrice * (1 + sellerConfig.rushFeePercent / 100);
      }
    } else if (rfq.urgency === 'urgent') {
      leadTime = Math.ceil(sellerConfig.standardLeadTime * 0.75);
    }

    // Calculate totals
    const totalPrice = Math.round(unitPrice * rfq.quantity * 100) / 100;
    const shippingCost = this.calculateShipping(rfq.quantity);

    // Calculate actual margin
    const cost = sellerConfig.costPerUnit * rfq.quantity;
    const marginPercent = ((totalPrice - cost) / totalPrice) * 100;

    const quote: NegotiationTerms = {
      unitPrice: Math.round(unitPrice * 100) / 100,
      quantity: rfq.quantity,
      totalPrice: totalPrice + shippingCost,
      currency: sellerConfig.currency,
      leadTimeDays: leadTime,
      paymentTerms: 'Net 30',
      warrantyMonths: 12,
      shippingCost,
      shippingMethod: 'Standard Freight',
    };

    return {
      quote,
      marginPercent,
      confidence: 85,
      reasoning: `Quote generated at ${marginPercent.toFixed(1)}% margin. ${volumeDiscount ? `Volume discount of ${volumeDiscount.discountPercentage}% applied.` : ''} ${rfq.urgency !== 'standard' ? 'Rush pricing applied.' : ''}`,
    };
  }

  /**
   * Evaluate a buyer's offer
   */
  async evaluateOffer(
    offer: NegotiationTerms,
    session: NegotiationSession
  ): Promise<'accept' | 'counter' | 'reject'> {
    this.log('info', 'Evaluating buyer offer', {
      offerPrice: offer.totalPrice,
      round: session.currentRound,
    });

    const sellerConfig = this.config.sellerConfig;
    const cost = sellerConfig.costPerUnit * offer.quantity;
    const offerMargin = ((offer.totalPrice - cost) / offer.totalPrice) * 100;

    this.log('info', 'Margin analysis', {
      offerMargin,
      minMargin: sellerConfig.minMargin,
      targetMargin: sellerConfig.targetMargin,
    });

    // If offer is at or above target margin, accept
    if (offerMargin >= sellerConfig.targetMargin) {
      return 'accept';
    }

    // If offer is above minimum margin, consider accepting based on round
    if (offerMargin >= sellerConfig.minMargin) {
      // More likely to accept in later rounds
      const acceptThreshold = 0.3 + (session.currentRound / session.maxRounds) * 0.4;
      const random = Math.random();

      if (random < acceptThreshold || session.currentRound >= session.maxRounds - 1) {
        return 'accept';
      }
      return 'counter';
    }

    // If we've made too many concessions, reject
    if (this.concessionsMade >= sellerConfig.maxConcessions) {
      // But if margin is close to minimum, consider accepting
      if (offerMargin >= sellerConfig.minMargin * 0.9) {
        return 'accept';
      }
      return 'reject';
    }

    // Counter the offer
    return 'counter';
  }

  /**
   * Generate a counter-offer to buyer's proposal
   */
  async generateCounterOffer(
    buyerOffer: NegotiationTerms,
    session: NegotiationSession
  ): Promise<OfferResponse> {
    this.log('info', 'Generating counter-offer', {
      buyerOffer: buyerOffer.totalPrice,
      round: session.currentRound,
    });

    const sellerConfig = this.config.sellerConfig;

    // Get our last position
    const ourLastOffer = this.getOurLastOffer(session);
    const ourLastPrice = ourLastOffer?.totalPrice || session.initialTerms.totalPrice;

    // Calculate the gap between our last offer and buyer's offer
    const gap = ourLastPrice - buyerOffer.totalPrice;

    // Determine concession based on flexibility and round
    const roundFactor = session.currentRound / session.maxRounds;
    const concessionRate = this.config.flexibility * (0.2 + roundFactor * 0.3);
    const concession = gap * concessionRate;

    // Calculate new price
    let newPrice = ourLastPrice - concession;

    // Ensure we maintain minimum margin
    const cost = sellerConfig.costPerUnit * buyerOffer.quantity;
    const minPrice = cost / (1 - sellerConfig.minMargin / 100);

    if (newPrice < minPrice) {
      newPrice = minPrice;
      this.log('warn', 'Counter limited by minimum margin', {
        requested: ourLastPrice - concession,
        minimum: minPrice,
      });
    }

    // Round to 2 decimal places
    newPrice = Math.round(newPrice * 100) / 100;

    // Track concession
    this.concessionsMade++;

    // Calculate margin of this offer
    const marginPercent = ((newPrice - cost) / newPrice) * 100;

    // Build counter terms
    const counterTerms: NegotiationTerms = {
      unitPrice: newPrice / buyerOffer.quantity,
      quantity: buyerOffer.quantity,
      totalPrice: newPrice,
      currency: sellerConfig.currency,
      leadTimeDays: this.adjustLeadTime(buyerOffer.leadTimeDays),
      paymentTerms: buyerOffer.paymentTerms || 'Net 30',
      warrantyMonths: buyerOffer.warrantyMonths || 12,
      shippingCost: buyerOffer.shippingCost,
      shippingMethod: buyerOffer.shippingMethod,
    };

    // Generate message
    const message = await this.generateNegotiationMessage(
      'counter',
      buyerOffer,
      counterTerms,
      session.currentRound
    );

    return {
      accept: false,
      counterOffer: counterTerms,
      message,
      reasoning: `Countering at $${newPrice.toFixed(2)} (${marginPercent.toFixed(1)}% margin). Moved ${((concession / gap) * 100).toFixed(0)}% toward buyer.`,
      marginPercent,
    };
  }

  /**
   * Generate acceptance response
   */
  async generateAcceptance(
    acceptedTerms: NegotiationTerms,
    session: NegotiationSession
  ): Promise<OfferResponse> {
    const sellerConfig = this.config.sellerConfig;
    const cost = sellerConfig.costPerUnit * acceptedTerms.quantity;
    const marginPercent = ((acceptedTerms.totalPrice - cost) / acceptedTerms.totalPrice) * 100;

    const message = await this.generateNegotiationMessage(
      'accept',
      acceptedTerms,
      acceptedTerms,
      session.currentRound
    );

    return {
      accept: true,
      message,
      reasoning: `Accepted offer at $${acceptedTerms.totalPrice.toFixed(2)} with ${marginPercent.toFixed(1)}% margin.`,
      marginPercent,
    };
  }

  /**
   * Generate rejection response
   */
  async generateRejection(
    rejectedOffer: NegotiationTerms,
    session: NegotiationSession,
    reason: string
  ): Promise<OfferResponse> {
    const sellerConfig = this.config.sellerConfig;
    const cost = sellerConfig.costPerUnit * rejectedOffer.quantity;
    const marginPercent = ((rejectedOffer.totalPrice - cost) / rejectedOffer.totalPrice) * 100;

    return {
      accept: false,
      message: `We're unable to meet this price point. ${reason}`,
      reasoning: `Rejected offer at $${rejectedOffer.totalPrice.toFixed(2)} (${marginPercent.toFixed(1)}% margin, below minimum).`,
      marginPercent,
    };
  }

  /**
   * Create a protocol message for the session
   */
  createProtocolMessage(
    session: NegotiationSession,
    type: 'proposal' | 'counter' | 'accept' | 'reject',
    terms: NegotiationTerms | null,
    message: string,
    reasoning: string
  ): NegotiationProtocolMessage {
    const protocolMessage = createProtocolMessage({
      sessionId: session.id,
      round: session.currentRound,
      sender: this.config.identity,
      type,
      terms,
      constraints: this.buildTermConstraints(),
      message,
      internalReasoning: reasoning,
      confidence: 80,
      inResponseTo: session.messages[session.messages.length - 1]?.messageId,
    });

    this.negotiationHistory.push(protocolMessage);
    return protocolMessage;
  }

  /**
   * Reset concession counter (for new negotiation)
   */
  resetConcessions(): void {
    this.concessionsMade = 0;
  }

  /**
   * Get current concession count
   */
  getConcessionCount(): number {
    return this.concessionsMade;
  }

  // ============================================================================
  // PRIVATE METHODS - PRICING
  // ============================================================================

  /**
   * Get applicable volume discount for quantity
   */
  private getApplicableVolumeDiscount(quantity: number): VolumeDiscount | null {
    const discounts = this.config.sellerConfig.volumeDiscounts
      .filter(d => quantity >= d.minQuantity)
      .sort((a, b) => b.minQuantity - a.minQuantity);

    return discounts[0] || null;
  }

  /**
   * Calculate shipping cost based on quantity
   */
  private calculateShipping(quantity: number): number {
    // Simple shipping calculation
    const baseShipping = 50;
    const perUnitShipping = 0.05;
    return Math.round((baseShipping + quantity * perUnitShipping) * 100) / 100;
  }

  /**
   * Adjust lead time based on request
   */
  private adjustLeadTime(requestedLeadTime?: number): number {
    const sellerConfig = this.config.sellerConfig;

    if (!requestedLeadTime) {
      return sellerConfig.standardLeadTime;
    }

    // Can we meet their lead time?
    if (requestedLeadTime >= sellerConfig.standardLeadTime) {
      return sellerConfig.standardLeadTime;
    }

    // Can we rush it?
    if (sellerConfig.rushLeadTime && requestedLeadTime >= sellerConfig.rushLeadTime) {
      return requestedLeadTime;
    }

    // Return our minimum
    return sellerConfig.rushLeadTime || sellerConfig.standardLeadTime;
  }

  /**
   * Get our last offer from session messages
   */
  private getOurLastOffer(session: NegotiationSession): NegotiationTerms | null {
    for (let i = session.messages.length - 1; i >= 0; i--) {
      const msg = session.messages[i];
      if (
        msg.sender.agentType === 'seller' &&
        msg.terms &&
        (msg.type === 'proposal' || msg.type === 'counter')
      ) {
        return msg.terms;
      }
    }
    return null;
  }

  /**
   * Build term constraints for protocol messages
   */
  private buildTermConstraints(): TermConstraints {
    const sellerConfig = this.config.sellerConfig;
    const minPricePerUnit = sellerConfig.costPerUnit / (1 - sellerConfig.minMargin / 100);

    return {
      unitPriceBound: minPricePerUnit,
      isHardLimit: true,
      leadTimeBound: sellerConfig.rushLeadTime || sellerConfig.standardLeadTime,
      nonNegotiable: [],
      flexible: ['paymentTerms', 'warrantyMonths'],
    };
  }

  // ============================================================================
  // PRIVATE METHODS - AI MESSAGE GENERATION
  // ============================================================================

  /**
   * Generate negotiation message using AI
   */
  private async generateNegotiationMessage(
    type: 'initial_quote' | 'counter' | 'accept' | 'reject',
    currentTerms: NegotiationTerms,
    proposedTerms: NegotiationTerms,
    round: number
  ): Promise<string> {
    const templates: Record<typeof type, string> = {
      initial_quote: `We're pleased to offer ${proposedTerms.quantity} units at $${proposedTerms.totalPrice.toFixed(2)} with ${proposedTerms.leadTimeDays}-day delivery.`,
      counter: `We appreciate your offer. We can do $${proposedTerms.totalPrice.toFixed(2)} for this order.`,
      accept: `We accept your offer of $${proposedTerms.totalPrice.toFixed(2)}. Thank you for your business.`,
      reject: `We're unable to meet this price point. Thank you for the opportunity.`,
    };

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        system: `You are negotiating on behalf of a seller. Be professional, confident, and concise (1-2 sentences). Emphasize value when possible. No markdown.`,
        messages: [{
          role: 'user',
          content: `Generate a ${type.replace('_', ' ')} message.
Their offer: $${currentTerms.totalPrice.toFixed(2)}
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

  // ============================================================================
  // PRIVATE METHODS - LOGGING
  // ============================================================================

  private log(
    level: 'info' | 'warn' | 'error',
    message: string,
    meta?: Record<string, unknown>
  ): void {
    const timestamp = new Date().toISOString();

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
 * Create a seller agent from supplier data
 */
export function createSellerAgent(params: {
  supplierId: string;
  organizationName: string;
  costPerUnit: number;
  minMargin?: number;
  targetMargin?: number;
  volumeDiscounts?: VolumeDiscount[];
  standardLeadTime?: number;
  rushLeadTime?: number;
  monthlyCapacity?: number;
  currentUtilization?: number;
  flexibility?: number;
}): SellerNegotiationAgent {
  const identity: AgentIdentity = {
    agentType: 'seller',
    agentId: `seller_${params.supplierId}`,
    organizationId: params.supplierId,
    organizationName: params.organizationName,
    autonomous: true,
    limits: {
      priceBoundary: params.costPerUnit / (1 - (params.minMargin || 10) / 100),
      maxQuantity: params.monthlyCapacity || 10000,
      leadTimeBoundary: params.standardLeadTime || 14,
      acceptablePaymentTerms: ['Net 30', 'Net 45'],
      certifications: [],
      autoApproveEnabled: true,
      escalationThreshold: 15,
    },
  };

  const sellerConfig: SellerConfig = {
    minMargin: params.minMargin ?? 10,
    targetMargin: params.targetMargin ?? 25,
    volumeDiscounts: params.volumeDiscounts || [],
    maxConcessions: 4,
    costPerUnit: params.costPerUnit,
    standardLeadTime: params.standardLeadTime ?? 14,
    rushLeadTime: params.rushLeadTime,
    rushFeePercent: 15,
    monthlyCapacity: params.monthlyCapacity ?? 10000,
    currentUtilization: params.currentUtilization ?? 0.6,
    currency: 'USD',
  };

  return new SellerNegotiationAgent({
    identity,
    sellerConfig,
    flexibility: params.flexibility ?? 0.5,
    prioritizeVolume: false,
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export default SellerNegotiationAgent;
