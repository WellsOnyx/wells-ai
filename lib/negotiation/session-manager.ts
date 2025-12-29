/**
 * Negotiation Session Manager
 *
 * Orchestrates AI-to-AI negotiations between Buyer Wells and Seller Wells agents.
 * Manages session lifecycle, runs negotiation rounds, and handles escalations.
 *
 * The Session Manager coordinates:
 * - Creating negotiation sessions
 * - Running negotiation rounds (buyer -> seller -> buyer...)
 * - Detecting stalemates, timeouts, and escalation triggers
 * - Generating live updates for chat interface
 *
 * @module lib/negotiation/session-manager
 */

import { sql } from '@vercel/postgres';
import {
  NegotiationSession,
  NegotiationProtocolMessage,
  NegotiationTerms,
  AgentIdentity,
  SessionStatus,
  createInitialSession,
  createProtocolMessage,
  PROTOCOL_VERSION,
} from './protocol';
import {
  BuyerNegotiationAgent,
  BuyerConstraints,
  createBuyerAgent,
} from './buyer-agent';
import {
  SellerNegotiationAgent,
  SellerConfig,
  createSellerAgent,
} from './seller-agent';
import {
  checkEscalationTriggers,
  createEscalation,
  EscalationResult,
} from './escalation-service';

// ============================================================================
// TYPES
// ============================================================================

export interface SessionCreateParams {
  /** RFQ ID this negotiation is for */
  rfqId: string;

  /** Supplier ID being negotiated with */
  supplierId: string;

  /** Buyer organization details */
  buyer: {
    organizationId: string;
    organizationName: string;
    userId: string;
  };

  /** Buyer constraints */
  buyerConstraints: BuyerConstraints;

  /** Seller configuration */
  sellerConfig: SellerConfig;

  /** Initial quote from seller */
  initialQuote: NegotiationTerms;

  /** Subject of negotiation */
  subject: string;

  /** Maximum negotiation rounds */
  maxRounds?: number;
}

export interface RoundResult {
  /** Updated session state */
  session: NegotiationSession;

  /** Buyer's message this round */
  buyerMessage?: NegotiationProtocolMessage;

  /** Seller's message this round */
  sellerMessage?: NegotiationProtocolMessage;

  /** Whether the round completed */
  roundComplete: boolean;

  /** Whether agreement was reached */
  agreementReached: boolean;

  /** Whether negotiation is over (any reason) */
  negotiationComplete: boolean;

  /** Escalation if one was triggered */
  escalation?: EscalationResult;

  /** Human-readable summary of this round */
  roundSummary: string;
}

export interface NegotiationOutcome {
  /** Final session state */
  session: NegotiationSession;

  /** Whether negotiation succeeded */
  success: boolean;

  /** Final agreed terms (if success) */
  finalTerms?: NegotiationTerms;

  /** Summary of the negotiation */
  summary: string;

  /** Detailed round-by-round history */
  rounds: RoundResult[];

  /** Time taken in milliseconds */
  durationMs: number;

  /** Savings achieved (if any) */
  savings?: {
    amount: number;
    percentage: number;
  };
}

export interface ChatUpdate {
  /** Type of update */
  type: 'negotiation_start' | 'negotiation_round' | 'negotiation_complete' | 'escalation';

  /** Session ID */
  sessionId: string;

  /** Current round */
  round: number;

  /** Buyer's offer this round */
  buyerOffer?: {
    price: number;
    message: string;
  };

  /** Seller's response this round */
  sellerResponse?: {
    price: number;
    message: string;
    accepted: boolean;
  };

  /** Current status */
  status: SessionStatus;

  /** Summary text */
  summary: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const LOG_PREFIX = '[Session Manager]';

/** Default max rounds */
const DEFAULT_MAX_ROUNDS = 5;

/** Session timeout in minutes */
const SESSION_TIMEOUT_MINUTES = 30;

/** Stalemate detection threshold */
const STALEMATE_ROUNDS = 3;
const MIN_PRICE_MOVEMENT_PERCENT = 0.5;

// ============================================================================
// SESSION MANAGER CLASS
// ============================================================================

/**
 * NegotiationSessionManager - Orchestrates AI-to-AI negotiations
 *
 * Usage:
 * ```typescript
 * const manager = new NegotiationSessionManager();
 *
 * // Create a session
 * const session = await manager.createSession({
 *   rfqId: 'rfq_123',
 *   supplierId: 'sup_456',
 *   buyer: { organizationId: 'org_789', organizationName: 'Acme Corp', userId: 'user_1' },
 *   buyerConstraints: { maxBudget: 5000, targetPrice: 4500, ... },
 *   sellerConfig: { minMargin: 10, targetMargin: 25, ... },
 *   initialQuote: { totalPrice: 5500, ... },
 *   subject: '1000 ball bearings',
 * });
 *
 * // Run to completion
 * const outcome = await manager.runToCompletion(session.id);
 *
 * // Or run round by round for streaming
 * for await (const round of manager.runRounds(session.id)) {
 *   await sendChatUpdate(userId, round);
 * }
 * ```
 */
export class NegotiationSessionManager {
  private sessions: Map<string, NegotiationSession> = new Map();
  private buyerAgents: Map<string, BuyerNegotiationAgent> = new Map();
  private sellerAgents: Map<string, SellerNegotiationAgent> = new Map();

  // ============================================================================
  // SESSION LIFECYCLE
  // ============================================================================

  /**
   * Create a new negotiation session
   */
  async createSession(params: SessionCreateParams): Promise<NegotiationSession> {
    this.log('info', 'Creating negotiation session', {
      rfqId: params.rfqId,
      supplierId: params.supplierId,
      initialPrice: params.initialQuote.totalPrice,
    });

    // Create agent identities
    const buyerIdentity: AgentIdentity = {
      agentType: 'buyer',
      agentId: `buyer_${params.buyer.organizationId}`,
      organizationId: params.buyer.organizationId,
      organizationName: params.buyer.organizationName,
      autonomous: true,
      limits: {
        priceBoundary: params.buyerConstraints.maxBudget,
        maxQuantity: params.buyerConstraints.quantity,
        leadTimeBoundary: params.buyerConstraints.maxLeadTime,
        acceptablePaymentTerms: params.buyerConstraints.acceptablePaymentTerms,
        certifications: params.buyerConstraints.requiredSpecs,
        autoApproveEnabled: true,
        escalationThreshold: 20,
      },
    };

    const sellerIdentity: AgentIdentity = {
      agentType: 'seller',
      agentId: `seller_${params.supplierId}`,
      organizationId: params.supplierId,
      organizationName: `Supplier ${params.supplierId}`, // Will be updated with real name
      autonomous: true,
      limits: {
        priceBoundary: params.sellerConfig.costPerUnit * params.buyerConstraints.quantity *
          (1 + params.sellerConfig.minMargin / 100),
        maxQuantity: params.sellerConfig.monthlyCapacity,
        leadTimeBoundary: params.sellerConfig.standardLeadTime,
        acceptablePaymentTerms: ['Net 30', 'Net 45'],
        certifications: [],
        autoApproveEnabled: true,
        escalationThreshold: 15,
      },
    };

    // Create session
    const session = createInitialSession({
      rfqId: params.rfqId,
      quoteId: `quote_${Date.now()}`,
      buyerAgent: buyerIdentity,
      sellerAgent: sellerIdentity,
      subject: params.subject,
      initialTerms: params.initialQuote,
      maxRounds: params.maxRounds || DEFAULT_MAX_ROUNDS,
      expirationMinutes: SESSION_TIMEOUT_MINUTES,
    });

    // Create buyer agent
    const buyerAgent = createBuyerAgent({
      userId: params.buyer.userId,
      organizationId: params.buyer.organizationId,
      organizationName: params.buyer.organizationName,
      maxBudget: params.buyerConstraints.maxBudget,
      targetPrice: params.buyerConstraints.targetPrice,
      quantity: params.buyerConstraints.quantity,
      maxLeadTime: params.buyerConstraints.maxLeadTime,
      requiredSpecs: params.buyerConstraints.requiredSpecs,
      aggressiveness: 0.6,
    });

    // Create seller agent
    const sellerAgent = createSellerAgent({
      supplierId: params.supplierId,
      organizationName: sellerIdentity.organizationName,
      costPerUnit: params.sellerConfig.costPerUnit,
      minMargin: params.sellerConfig.minMargin,
      targetMargin: params.sellerConfig.targetMargin,
      volumeDiscounts: params.sellerConfig.volumeDiscounts,
      standardLeadTime: params.sellerConfig.standardLeadTime,
      rushLeadTime: params.sellerConfig.rushLeadTime,
      monthlyCapacity: params.sellerConfig.monthlyCapacity,
      currentUtilization: params.sellerConfig.currentUtilization,
      flexibility: 0.5,
    });

    // Store in memory
    this.sessions.set(session.id, session);
    this.buyerAgents.set(session.id, buyerAgent);
    this.sellerAgents.set(session.id, sellerAgent);

    // Persist to database
    await this.persistSession(session);

    this.log('info', 'Session created', { sessionId: session.id });

    return session;
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<NegotiationSession | null> {
    // Check memory first
    let session = this.sessions.get(sessionId);
    if (session) return session;

    // Load from database
    const result = await sql`
      SELECT * FROM negotiation_sessions WHERE id = ${sessionId}
    `;

    if (result.rows.length === 0) return null;

    session = this.mapSessionRow(result.rows[0]);
    this.sessions.set(sessionId, session);

    return session;
  }

  // ============================================================================
  // NEGOTIATION EXECUTION
  // ============================================================================

  /**
   * Run a single negotiation round
   */
  async runNegotiationRound(sessionId: string): Promise<RoundResult> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.log('info', 'Running negotiation round', {
      sessionId,
      round: session.currentRound + 1,
    });

    // Check session status
    if (session.status !== 'active' && session.status !== 'initializing') {
      return {
        session,
        roundComplete: false,
        agreementReached: session.status === 'agreed',
        negotiationComplete: true,
        roundSummary: `Negotiation already ${session.status}`,
      };
    }

    // Initialize if needed
    if (session.status === 'initializing') {
      session.status = 'active';
      session.currentRound = 1;
    } else {
      session.currentRound++;
    }

    const buyerAgent = this.buyerAgents.get(sessionId);
    const sellerAgent = this.sellerAgents.get(sessionId);

    if (!buyerAgent || !sellerAgent) {
      throw new Error('Agents not found for session');
    }

    // Step 1: Buyer generates offer/counter
    const lastSellerMessage = this.getLastSellerMessage(session);
    let buyerMessage: NegotiationProtocolMessage;

    if (session.currentRound === 1) {
      // First round - buyer makes initial offer
      buyerMessage = await buyerAgent.generateInitialOffer(
        session.initialTerms,
        session.id
      );
    } else {
      // Subsequent rounds - buyer responds to seller's counter
      const evaluation = await buyerAgent.evaluateCounterOffer(
        lastSellerMessage!.terms!,
        session
      );

      if (evaluation.decision === 'accept') {
        // Buyer accepts seller's offer
        buyerMessage = await buyerAgent.generateAcceptance(
          lastSellerMessage!.terms!,
          session
        );
        session.messages.push(buyerMessage);
        session.status = 'agreed';
        session.finalTerms = lastSellerMessage!.terms!;
        session.completedAt = new Date().toISOString();
        await this.updateSession(session);

        return {
          session,
          buyerMessage,
          roundComplete: true,
          agreementReached: true,
          negotiationComplete: true,
          roundSummary: `Agreement reached at $${session.finalTerms.totalPrice.toFixed(2)}`,
        };
      }

      if (evaluation.decision === 'escalate') {
        // Escalate to human
        const escalationResult: EscalationResult = {
          shouldEscalate: true,
          reason: 'budget_exceeded',
          reasons: ['budget_exceeded'],
          priority: 'high',
          details: evaluation.escalationDetails || evaluation.reason,
        };

        session.status = 'awaiting_human';
        await this.updateSession(session);
        await this.handleEscalation(session, escalationResult);

        return {
          session,
          roundComplete: true,
          agreementReached: false,
          negotiationComplete: false,
          escalation: escalationResult,
          roundSummary: `Escalated to human: ${evaluation.reason}`,
        };
      }

      if (evaluation.decision === 'reject') {
        // Buyer walks away
        session.status = 'rejected';
        session.completedAt = new Date().toISOString();
        await this.updateSession(session);

        return {
          session,
          roundComplete: true,
          agreementReached: false,
          negotiationComplete: true,
          roundSummary: `Buyer rejected: ${evaluation.reason}`,
        };
      }

      // Counter-offer
      buyerMessage = await buyerAgent.generateCounterOffer(
        lastSellerMessage!.terms!,
        session
      );
    }

    session.messages.push(buyerMessage);
    session.currentTerms = buyerMessage.terms!;

    // Step 2: Seller evaluates and responds
    const sellerDecision = await sellerAgent.evaluateOffer(buyerMessage.terms!, session);
    let sellerMessage: NegotiationProtocolMessage;

    if (sellerDecision === 'accept') {
      // Seller accepts buyer's offer
      const acceptResponse = await sellerAgent.generateAcceptance(
        buyerMessage.terms!,
        session
      );
      sellerMessage = sellerAgent.createProtocolMessage(
        session,
        'accept',
        buyerMessage.terms!,
        acceptResponse.message,
        acceptResponse.reasoning
      );
      session.messages.push(sellerMessage);
      session.status = 'agreed';
      session.finalTerms = buyerMessage.terms!;
      session.completedAt = new Date().toISOString();
      await this.updateSession(session);

      return {
        session,
        buyerMessage,
        sellerMessage,
        roundComplete: true,
        agreementReached: true,
        negotiationComplete: true,
        roundSummary: `Agreement reached at $${session.finalTerms.totalPrice.toFixed(2)}`,
      };
    }

    if (sellerDecision === 'reject') {
      // Seller rejects
      const rejectResponse = await sellerAgent.generateRejection(
        buyerMessage.terms!,
        session,
        'Price below acceptable margin'
      );
      sellerMessage = sellerAgent.createProtocolMessage(
        session,
        'reject',
        null,
        rejectResponse.message,
        rejectResponse.reasoning
      );
      session.messages.push(sellerMessage);
      session.status = 'rejected';
      session.completedAt = new Date().toISOString();
      await this.updateSession(session);

      return {
        session,
        buyerMessage,
        sellerMessage,
        roundComplete: true,
        agreementReached: false,
        negotiationComplete: true,
        roundSummary: 'Seller rejected - terms unacceptable',
      };
    }

    // Seller counter-offers
    const counterResponse = await sellerAgent.generateCounterOffer(buyerMessage.terms!, session);
    sellerMessage = sellerAgent.createProtocolMessage(
      session,
      'counter',
      counterResponse.counterOffer!,
      counterResponse.message,
      counterResponse.reasoning
    );
    session.messages.push(sellerMessage);
    session.currentTerms = counterResponse.counterOffer!;

    // Check for stalemate
    if (this.detectStalemate(session)) {
      if (session.currentRound >= session.maxRounds) {
        session.status = 'stalemate';
        session.completedAt = new Date().toISOString();
        await this.updateSession(session);

        return {
          session,
          buyerMessage,
          sellerMessage,
          roundComplete: true,
          agreementReached: false,
          negotiationComplete: true,
          roundSummary: `Stalemate after ${session.currentRound} rounds`,
        };
      }
    }

    // Check max rounds
    if (session.currentRound >= session.maxRounds) {
      // Force a decision on the last offer
      const lastOffer = session.currentTerms!;
      const finalEval = await buyerAgent.evaluateCounterOffer(lastOffer, session);

      if (finalEval.decision === 'accept' || finalEval.decision === 'counter') {
        // Accept the last offer
        session.status = 'agreed';
        session.finalTerms = lastOffer;
        session.completedAt = new Date().toISOString();
        await this.updateSession(session);

        return {
          session,
          buyerMessage,
          sellerMessage,
          roundComplete: true,
          agreementReached: true,
          negotiationComplete: true,
          roundSummary: `Agreement reached at max rounds: $${lastOffer.totalPrice.toFixed(2)}`,
        };
      } else {
        session.status = 'rejected';
        session.completedAt = new Date().toISOString();
        await this.updateSession(session);

        return {
          session,
          buyerMessage,
          sellerMessage,
          roundComplete: true,
          agreementReached: false,
          negotiationComplete: true,
          roundSummary: 'Max rounds reached without agreement',
        };
      }
    }

    // Update session
    session.lastActivityAt = new Date().toISOString();
    session.analytics.roundsUsed = session.currentRound;
    await this.updateSession(session);

    const buyerPrice = buyerMessage.terms?.totalPrice || 0;
    const sellerPrice = sellerMessage.terms?.totalPrice || 0;

    return {
      session,
      buyerMessage,
      sellerMessage,
      roundComplete: true,
      agreementReached: false,
      negotiationComplete: false,
      roundSummary: `Round ${session.currentRound}: Buyer offered $${buyerPrice.toFixed(2)}, Seller countered at $${sellerPrice.toFixed(2)}`,
    };
  }

  /**
   * Run negotiation to completion
   */
  async runToCompletion(sessionId: string): Promise<NegotiationOutcome> {
    const startTime = Date.now();
    const rounds: RoundResult[] = [];

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    let result: RoundResult;
    do {
      result = await this.runNegotiationRound(sessionId);
      rounds.push(result);
    } while (!result.negotiationComplete);

    const finalSession = result.session;
    const durationMs = Date.now() - startTime;

    // Calculate savings
    let savings: NegotiationOutcome['savings'];
    if (finalSession.finalTerms && result.agreementReached) {
      const initialPrice = finalSession.initialTerms.totalPrice;
      const finalPrice = finalSession.finalTerms.totalPrice;
      savings = {
        amount: initialPrice - finalPrice,
        percentage: ((initialPrice - finalPrice) / initialPrice) * 100,
      };
    }

    // Update analytics
    if (result.agreementReached) {
      finalSession.analytics.agreementReached = true;
      finalSession.analytics.priceReduction = savings?.amount;
      finalSession.analytics.reductionPercentage = savings?.percentage;
      finalSession.analytics.timeToAgreementMs = durationMs;
    }
    await this.updateSession(finalSession);

    return {
      session: finalSession,
      success: result.agreementReached,
      finalTerms: finalSession.finalTerms,
      summary: this.generateOutcomeSummary(finalSession, result.agreementReached, savings),
      rounds,
      durationMs,
      savings,
    };
  }

  /**
   * Generator for streaming rounds (for real-time chat updates)
   */
  async *runRounds(sessionId: string): AsyncGenerator<RoundResult> {
    let negotiationComplete = false;

    while (!negotiationComplete) {
      const result = await this.runNegotiationRound(sessionId);
      yield result;
      negotiationComplete = result.negotiationComplete;
    }
  }

  /**
   * Escalate session to human review
   */
  async escalateToHuman(sessionId: string, reason: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = 'awaiting_human';
    session.analytics.escalationCount++;

    await this.updateSession(session);

    // Create escalation record
    await createEscalation({
      sessionId,
      rfqId: session.rfqId,
      organizationId: session.buyerAgent.organizationId,
      escalationResult: {
        shouldEscalate: true,
        reason: 'manual_request',
        reasons: ['manual_request'],
        priority: 'medium',
        details: reason,
      },
      termsUnderReview: session.currentTerms,
    });

    this.log('info', 'Session escalated to human', { sessionId, reason });
  }

  // ============================================================================
  // CHAT INTEGRATION
  // ============================================================================

  /**
   * Generate a chat update for the current state
   */
  generateChatUpdate(result: RoundResult): ChatUpdate {
    const session = result.session;

    if (result.negotiationComplete && result.agreementReached) {
      return {
        type: 'negotiation_complete',
        sessionId: session.id,
        round: session.currentRound,
        status: session.status,
        summary: `Agreement reached at $${session.finalTerms?.totalPrice.toFixed(2)}`,
      };
    }

    if (result.escalation) {
      return {
        type: 'escalation',
        sessionId: session.id,
        round: session.currentRound,
        status: session.status,
        summary: `Escalated: ${result.escalation.details}`,
      };
    }

    return {
      type: session.currentRound === 1 ? 'negotiation_start' : 'negotiation_round',
      sessionId: session.id,
      round: session.currentRound,
      buyerOffer: result.buyerMessage?.terms ? {
        price: result.buyerMessage.terms.totalPrice,
        message: result.buyerMessage.message,
      } : undefined,
      sellerResponse: result.sellerMessage?.terms ? {
        price: result.sellerMessage.terms.totalPrice,
        message: result.sellerMessage.message,
        accepted: result.sellerMessage.type === 'accept',
      } : undefined,
      status: session.status,
      summary: result.roundSummary,
    };
  }

  /**
   * Format negotiation for chat display
   */
  formatForChat(outcome: NegotiationOutcome): string {
    const lines: string[] = [];

    if (outcome.success) {
      lines.push(`Agreement reached with ${outcome.session.sellerAgent.organizationName}!`);
      lines.push('');

      for (const round of outcome.rounds) {
        if (round.buyerMessage) {
          lines.push(`- My offer: $${round.buyerMessage.terms?.totalPrice.toFixed(2)}`);
        }
        if (round.sellerMessage) {
          const action = round.sellerMessage.type === 'accept' ? 'Accepted' : 'Counter';
          lines.push(`- Their ${action.toLowerCase()}: $${round.sellerMessage.terms?.totalPrice.toFixed(2) || 'N/A'}`);
        }
      }

      lines.push('');
      lines.push(`**Final Terms:**`);
      lines.push(`- Price: $${outcome.finalTerms?.totalPrice.toFixed(2)}`);
      lines.push(`- Lead Time: ${outcome.finalTerms?.leadTimeDays} days`);

      if (outcome.savings && outcome.savings.amount > 0) {
        lines.push(`- Savings: $${outcome.savings.amount.toFixed(2)} (${outcome.savings.percentage.toFixed(1)}%)`);
      }

      lines.push('');
      lines.push('Want me to proceed with this deal?');
    } else {
      lines.push(`Could not reach agreement with ${outcome.session.sellerAgent.organizationName}.`);
      lines.push(`Reason: ${outcome.rounds[outcome.rounds.length - 1]?.roundSummary || 'No agreement'}`);
    }

    return lines.join('\n');
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private getLastSellerMessage(session: NegotiationSession): NegotiationProtocolMessage | null {
    for (let i = session.messages.length - 1; i >= 0; i--) {
      if (session.messages[i].sender.agentType === 'seller') {
        return session.messages[i];
      }
    }
    return null;
  }

  private detectStalemate(session: NegotiationSession): boolean {
    if (session.messages.length < STALEMATE_ROUNDS * 2) return false;

    const recentPrices: number[] = [];
    for (const msg of session.messages.slice(-STALEMATE_ROUNDS * 2)) {
      if (msg.terms?.totalPrice) {
        recentPrices.push(msg.terms.totalPrice);
      }
    }

    if (recentPrices.length < STALEMATE_ROUNDS) return false;

    const range = Math.max(...recentPrices) - Math.min(...recentPrices);
    const avgPrice = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const movementPercent = (range / avgPrice) * 100;

    return movementPercent < MIN_PRICE_MOVEMENT_PERCENT;
  }

  private generateOutcomeSummary(
    session: NegotiationSession,
    success: boolean,
    savings?: NegotiationOutcome['savings']
  ): string {
    if (success && session.finalTerms) {
      if (savings && savings.amount > 0) {
        return `Agreement reached! Achieved ${savings.percentage.toFixed(1)}% savings ($${savings.amount.toFixed(2)}) in ${session.currentRound} round(s). Final price: $${session.finalTerms.totalPrice.toFixed(2)}`;
      }
      return `Agreement reached at $${session.finalTerms.totalPrice.toFixed(2)} after ${session.currentRound} round(s).`;
    }

    switch (session.status) {
      case 'rejected':
        return `Negotiation ended without agreement. ${session.currentRound} rounds completed.`;
      case 'stalemate':
        return `Negotiation stalemate after ${session.currentRound} rounds.`;
      case 'expired':
        return 'Negotiation expired before reaching agreement.';
      case 'awaiting_human':
        return `Negotiation paused for human review at round ${session.currentRound}.`;
      default:
        return `Negotiation in progress. Round ${session.currentRound}/${session.maxRounds}`;
    }
  }

  private async handleEscalation(session: NegotiationSession, escalation: EscalationResult): Promise<void> {
    await createEscalation({
      sessionId: session.id,
      rfqId: session.rfqId,
      organizationId: session.buyerAgent.organizationId,
      escalationResult: escalation,
      termsUnderReview: session.currentTerms,
    });
  }

  // ============================================================================
  // DATABASE OPERATIONS
  // ============================================================================

  private async persistSession(session: NegotiationSession): Promise<void> {
    await sql`
      INSERT INTO negotiation_sessions (
        id,
        protocol_version,
        rfq_id,
        quote_id,
        buyer_agent,
        seller_agent,
        subject,
        status,
        current_round,
        max_rounds,
        initial_terms,
        current_terms,
        final_terms,
        messages,
        analytics,
        created_at,
        last_activity_at,
        expires_at,
        completed_at
      ) VALUES (
        ${session.id},
        ${session.protocolVersion},
        ${session.rfqId},
        ${session.quoteId},
        ${JSON.stringify(session.buyerAgent)},
        ${JSON.stringify(session.sellerAgent)},
        ${session.subject},
        ${session.status},
        ${session.currentRound},
        ${session.maxRounds},
        ${JSON.stringify(session.initialTerms)},
        ${session.currentTerms ? JSON.stringify(session.currentTerms) : null},
        ${session.finalTerms ? JSON.stringify(session.finalTerms) : null},
        ${JSON.stringify(session.messages)},
        ${JSON.stringify(session.analytics)},
        ${session.createdAt},
        ${session.lastActivityAt},
        ${session.expiresAt},
        ${session.completedAt || null}
      )
    `;
  }

  private async updateSession(session: NegotiationSession): Promise<void> {
    session.lastActivityAt = new Date().toISOString();
    this.sessions.set(session.id, session);

    await sql`
      UPDATE negotiation_sessions
      SET
        status = ${session.status},
        current_round = ${session.currentRound},
        current_terms = ${session.currentTerms ? JSON.stringify(session.currentTerms) : null},
        final_terms = ${session.finalTerms ? JSON.stringify(session.finalTerms) : null},
        messages = ${JSON.stringify(session.messages)},
        analytics = ${JSON.stringify(session.analytics)},
        last_activity_at = ${session.lastActivityAt},
        completed_at = ${session.completedAt || null}
      WHERE id = ${session.id}
    `;
  }

  private mapSessionRow(row: Record<string, unknown>): NegotiationSession {
    return {
      id: row.id as string,
      protocolVersion: row.protocol_version as string,
      rfqId: row.rfq_id as string,
      quoteId: row.quote_id as string,
      buyerAgent: row.buyer_agent as AgentIdentity,
      sellerAgent: row.seller_agent as AgentIdentity,
      subject: row.subject as string,
      status: row.status as SessionStatus,
      currentRound: row.current_round as number,
      maxRounds: row.max_rounds as number,
      initialTerms: row.initial_terms as NegotiationTerms,
      currentTerms: row.current_terms as NegotiationTerms | undefined,
      finalTerms: row.final_terms as NegotiationTerms | undefined,
      messages: (row.messages as NegotiationProtocolMessage[]) || [],
      createdAt: row.created_at as string,
      lastActivityAt: row.last_activity_at as string,
      expiresAt: row.expires_at as string,
      completedAt: row.completed_at as string | undefined,
      analytics: row.analytics as NegotiationSession['analytics'],
    };
  }

  // ============================================================================
  // LOGGING
  // ============================================================================

  private log(
    level: 'info' | 'warn' | 'error',
    message: string,
    meta?: Record<string, unknown>
  ): void {
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
// SINGLETON INSTANCE
// ============================================================================

let _sessionManager: NegotiationSessionManager | null = null;

/**
 * Get the singleton session manager instance
 */
export function getSessionManager(): NegotiationSessionManager {
  if (!_sessionManager) {
    _sessionManager = new NegotiationSessionManager();
  }
  return _sessionManager;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default NegotiationSessionManager;
