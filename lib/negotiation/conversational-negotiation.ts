/**
 * Conversational Negotiation System
 *
 * AI-powered negotiations entirely through natural language chat.
 * Supports manual intervention, autonomous AI-to-AI, and hybrid modes.
 *
 * Key Features:
 * - Start negotiations through natural language ("Negotiate with Acme for better pricing")
 * - Set parameters via chat ("Don't go below $45 per unit")
 * - Get real-time updates ("How's the negotiation going?")
 * - Review counter-offers conversationally
 * - Approve/reject through chat
 * - Autonomous AI-to-AI negotiations within user-defined limits
 * - Strategy generation and explanation
 *
 * @module lib/negotiation/conversational-negotiation
 */

import Anthropic from '@anthropic-ai/sdk';
import { sql } from '@vercel/postgres';
import {
  NegotiationSession,
  NegotiationTerms,
  NegotiationProtocolMessage,
  SessionStatus,
  createInitialSession,
  createProtocolMessage,
  PROTOCOL_VERSION,
  AgentIdentity,
} from './protocol';
import {
  NegotiationSessionManager,
  getSessionManager,
  NegotiationOutcome,
  RoundResult,
} from './session-manager';
import { BuyerConstraints, createBuyerAgent } from './buyer-agent';
import { SellerConfig, createSellerAgent } from './seller-agent';

// ============================================================================
// CONFIGURATION
// ============================================================================

const LOG_PREFIX = '[Conversational Negotiation]';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// TYPES
// ============================================================================

/**
 * Negotiation mode - how much autonomy Wells has
 */
export type NegotiationMode =
  | 'manual'       // User makes all decisions
  | 'assisted'     // AI suggests, user approves
  | 'autonomous';  // AI negotiates within limits

/**
 * Conversational negotiation session extending base session
 */
export interface ConversationalNegotiationSession {
  /** Base session ID */
  id: string;

  /** User who initiated */
  userId: string;

  /** Organization ID */
  organizationId: string;

  /** Organization name */
  organizationName: string;

  /** Counterparty name (company being negotiated with) */
  counterpartyName: string;

  /** Counterparty ID */
  counterpartyId?: string;

  /** What's being negotiated */
  subject: string;

  /** Negotiation mode */
  mode: NegotiationMode;

  /** Status */
  status: 'active' | 'paused' | 'awaiting_approval' | 'completed' | 'rejected' | 'expired';

  /** User-defined constraints */
  constraints: NegotiationConstraints;

  /** Current offer on the table */
  currentOffer?: NegotiationOffer;

  /** Best offer received so far */
  bestOffer?: NegotiationOffer;

  /** All offers history */
  offerHistory: NegotiationOffer[];

  /** Chat history */
  chatHistory: ChatMessage[];

  /** AI strategy being used */
  strategy?: NegotiationStrategy;

  /** Pending action awaiting user approval */
  pendingAction?: PendingNegotiationAction;

  /** Round count */
  round: number;

  /** Max rounds allowed */
  maxRounds: number;

  /** Created timestamp */
  createdAt: string;

  /** Last activity */
  lastActivityAt: string;

  /** Expiration */
  expiresAt: string;

  /** Completed timestamp */
  completedAt?: string;

  /** Final terms if agreed */
  finalTerms?: NegotiationTerms;

  /** Savings achieved */
  savings?: {
    amount: number;
    percentage: number;
  };

  /** Underlying session ID if using session manager */
  underlyingSessionId?: string;
}

/**
 * User-defined negotiation constraints
 */
export interface NegotiationConstraints {
  /** Maximum price user will pay (or minimum price if selling) */
  priceLimit: number;

  /** Target/ideal price */
  targetPrice: number;

  /** Walk-away price - the absolute limit */
  walkAwayPrice?: number;

  /** Maximum lead time in days */
  maxLeadTime?: number;

  /** Required specifications */
  requiredSpecs?: string[];

  /** Acceptable payment terms */
  acceptablePaymentTerms?: string[];

  /** Quantity */
  quantity?: number;

  /** Maximum rounds before escalating */
  maxRoundsBeforeEscalation?: number;

  /** Time limit in hours */
  timeLimitHours?: number;

  /** Any custom constraints as key-value */
  custom?: Record<string, string | number | boolean>;
}

/**
 * An offer in the negotiation
 */
export interface NegotiationOffer {
  /** Who made this offer */
  from: 'user' | 'counterparty' | 'ai';

  /** Price per unit */
  unitPrice: number;

  /** Total price */
  totalPrice: number;

  /** Quantity */
  quantity: number;

  /** Lead time in days */
  leadTimeDays?: number;

  /** Payment terms */
  paymentTerms?: string;

  /** Additional terms */
  additionalTerms?: Record<string, string | number | boolean>;

  /** Timestamp */
  timestamp: string;

  /** Round number */
  round: number;

  /** Whether this was accepted */
  accepted?: boolean;

  /** Whether this was rejected */
  rejected?: boolean;

  /** Reasoning for this offer (if from AI) */
  reasoning?: string;
}

/**
 * Chat message in negotiation context
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    offerMade?: NegotiationOffer;
    offerReceived?: NegotiationOffer;
    actionTaken?: string;
    strategyUpdate?: boolean;
  };
}

/**
 * AI-generated negotiation strategy
 */
export interface NegotiationStrategy {
  /** Overall approach */
  approach: 'aggressive' | 'balanced' | 'conservative' | 'collaborative';

  /** Opening position as percentage below/above initial */
  openingPositionPercent: number;

  /** Maximum concession per round as percentage */
  maxConcessionPerRound: number;

  /** Key leverage points to use */
  leveragePoints: string[];

  /** Suggested tactics */
  tactics: string[];

  /** Risk assessment */
  riskLevel: 'low' | 'medium' | 'high';

  /** AI explanation of strategy */
  explanation: string;

  /** Recommended next move */
  recommendedNextMove?: string;

  /** Updated dynamically based on progress */
  adaptations?: string[];
}

/**
 * Pending action awaiting user approval
 */
export interface PendingNegotiationAction {
  type: 'counter_offer' | 'accept' | 'reject' | 'escalate';
  details: {
    offer?: NegotiationOffer;
    reason?: string;
    recommendation?: string;
  };
  reasoning: string;
  confidence: number;
  createdAt: string;
}

/**
 * Result from processing a chat message
 */
export interface NegotiationChatResult {
  /** Response message to user */
  response: string;

  /** Updated session state */
  session: ConversationalNegotiationSession;

  /** Suggested follow-up actions */
  suggestedActions?: string[];

  /** Whether negotiation is complete */
  complete: boolean;

  /** Final outcome if complete */
  outcome?: 'agreed' | 'rejected' | 'expired' | 'escalated';

  /** Quick action buttons for UI */
  quickActions?: Array<{
    label: string;
    action: string;
    primary?: boolean;
  }>;
}

/**
 * Intent detected from user message
 */
export type NegotiationIntent =
  | 'start_negotiation'
  | 'set_constraint'
  | 'check_status'
  | 'review_offer'
  | 'make_counter'
  | 'accept_offer'
  | 'reject_offer'
  | 'enable_autonomous'
  | 'pause_negotiation'
  | 'resume_negotiation'
  | 'get_strategy'
  | 'explain_strategy'
  | 'approve_action'
  | 'reject_action'
  | 'unknown';

// ============================================================================
// CONVERSATIONAL NEGOTIATION ENGINE
// ============================================================================

/**
 * ConversationalNegotiationEngine - The brain for chat-based negotiations
 *
 * Handles all natural language interactions for negotiations:
 * - Intent classification
 * - Entity extraction (prices, constraints, counterparties)
 * - Strategy generation and explanation
 * - Autonomous negotiation within limits
 * - Progress updates and status reports
 */
export class ConversationalNegotiationEngine {
  private sessions: Map<string, ConversationalNegotiationSession> = new Map();
  private sessionManager: NegotiationSessionManager;

  constructor() {
    this.sessionManager = getSessionManager();
  }

  // ============================================================================
  // MAIN ENTRY POINT
  // ============================================================================

  /**
   * Process a user's chat message related to negotiation
   */
  async processMessage(
    userId: string,
    organizationId: string,
    organizationName: string,
    message: string,
    sessionId?: string
  ): Promise<NegotiationChatResult> {
    this.log('info', 'Processing negotiation message', { userId, message: message.substring(0, 100) });

    // Get or create session
    let session = sessionId ? await this.getSession(sessionId) : null;

    // Classify intent
    const { intent, entities } = await this.classifyIntent(message, session);
    this.log('info', 'Classified intent', { intent, entities });

    // Route to appropriate handler
    switch (intent) {
      case 'start_negotiation':
        return this.handleStartNegotiation(userId, organizationId, organizationName, entities, message);

      case 'set_constraint':
        return this.handleSetConstraint(session, entities, message);

      case 'check_status':
        return this.handleCheckStatus(session, userId);

      case 'review_offer':
        return this.handleReviewOffer(session);

      case 'make_counter':
        return this.handleMakeCounter(session, entities, message);

      case 'accept_offer':
        return this.handleAcceptOffer(session);

      case 'reject_offer':
        return this.handleRejectOffer(session, entities.reason);

      case 'enable_autonomous':
        return this.handleEnableAutonomous(session, entities);

      case 'pause_negotiation':
        return this.handlePauseNegotiation(session);

      case 'resume_negotiation':
        return this.handleResumeNegotiation(session);

      case 'get_strategy':
        return this.handleGetStrategy(session);

      case 'explain_strategy':
        return this.handleExplainStrategy(session, message);

      case 'approve_action':
        return this.handleApproveAction(session);

      case 'reject_action':
        return this.handleRejectAction(session, entities.reason);

      default:
        return this.handleUnknownIntent(session, message, userId, organizationId, organizationName);
    }
  }

  // ============================================================================
  // INTENT HANDLERS
  // ============================================================================

  /**
   * Start a new negotiation
   */
  private async handleStartNegotiation(
    userId: string,
    organizationId: string,
    organizationName: string,
    entities: ExtractedEntities,
    originalMessage: string
  ): Promise<NegotiationChatResult> {
    // Validate we have enough information
    if (!entities.counterpartyName) {
      return {
        response: "I'd be happy to start a negotiation for you. Who would you like me to negotiate with?",
        session: this.createEmptySession(userId, organizationId, organizationName),
        suggestedActions: ['Specify the company name'],
        complete: false,
        quickActions: [
          { label: 'Search suppliers', action: 'search_suppliers' },
        ],
      };
    }

    // Create the session
    const session = await this.createSession({
      userId,
      organizationId,
      organizationName,
      counterpartyName: entities.counterpartyName,
      counterpartyId: entities.counterpartyId,
      subject: entities.subject || `Pricing negotiation with ${entities.counterpartyName}`,
      mode: entities.autonomous ? 'autonomous' : 'assisted',
      constraints: {
        priceLimit: entities.maxPrice || entities.priceLimit || 0,
        targetPrice: entities.targetPrice || 0,
        walkAwayPrice: entities.walkAwayPrice,
        maxLeadTime: entities.maxLeadTime,
        quantity: entities.quantity,
      },
    });

    // Generate initial strategy
    const strategy = await this.generateStrategy(session);
    session.strategy = strategy;

    // Add to chat history
    this.addChatMessage(session, 'user', originalMessage);

    let response = `I've started a negotiation with **${entities.counterpartyName}**`;

    if (entities.subject) {
      response += ` for ${entities.subject}`;
    }

    response += '.\n\n';

    if (session.constraints.targetPrice) {
      response += `Your target: $${session.constraints.targetPrice.toLocaleString()}`;
      if (session.constraints.priceLimit) {
        response += ` (max: $${session.constraints.priceLimit.toLocaleString()})`;
      }
      response += '\n\n';
    }

    response += `**My Strategy:** ${strategy.explanation}\n\n`;

    if (session.mode === 'autonomous') {
      response += "I'll negotiate autonomously within your limits. I'll keep you updated on progress.";
    } else {
      response += "I'll help you negotiate. What's your opening position, or should I suggest one?";
    }

    this.addChatMessage(session, 'assistant', response);
    await this.saveSession(session);

    return {
      response,
      session,
      suggestedActions: [
        'Set a price limit',
        'Make an opening offer',
        'Let AI negotiate autonomously',
      ],
      complete: false,
      quickActions: [
        { label: 'Suggest opening offer', action: 'suggest_opening', primary: true },
        { label: 'Set constraints', action: 'set_constraints' },
        { label: 'Go autonomous', action: 'enable_autonomous' },
      ],
    };
  }

  /**
   * Set or update a constraint
   */
  private async handleSetConstraint(
    session: ConversationalNegotiationSession | null,
    entities: ExtractedEntities,
    message: string
  ): Promise<NegotiationChatResult> {
    if (!session) {
      return {
        response: "I don't have an active negotiation. Would you like to start one?",
        session: this.createEmptySession('', '', ''),
        complete: false,
        quickActions: [
          { label: 'Start negotiation', action: 'start_negotiation', primary: true },
        ],
      };
    }

    const updates: string[] = [];

    if (entities.priceLimit !== undefined) {
      session.constraints.priceLimit = entities.priceLimit;
      updates.push(`maximum price to $${entities.priceLimit.toLocaleString()}`);
    }

    if (entities.targetPrice !== undefined) {
      session.constraints.targetPrice = entities.targetPrice;
      updates.push(`target price to $${entities.targetPrice.toLocaleString()}`);
    }

    if (entities.walkAwayPrice !== undefined) {
      session.constraints.walkAwayPrice = entities.walkAwayPrice;
      updates.push(`walk-away price to $${entities.walkAwayPrice.toLocaleString()}`);
    }

    if (entities.maxLeadTime !== undefined) {
      session.constraints.maxLeadTime = entities.maxLeadTime;
      updates.push(`maximum lead time to ${entities.maxLeadTime} days`);
    }

    if (entities.quantity !== undefined) {
      session.constraints.quantity = entities.quantity;
      updates.push(`quantity to ${entities.quantity.toLocaleString()} units`);
    }

    if (updates.length === 0) {
      return {
        response: "I understand you want to set a constraint. Could you be more specific? For example:\n- \"Don't go above $50 per unit\"\n- \"My target is $45 per unit\"\n- \"Walk away if above $55\"",
        session,
        complete: false,
      };
    }

    // Regenerate strategy with new constraints
    const newStrategy = await this.generateStrategy(session);
    session.strategy = newStrategy;

    this.addChatMessage(session, 'user', message);

    const response = `Updated ${updates.join(', ')}.\n\n**Strategy adjusted:** ${newStrategy.recommendedNextMove || newStrategy.explanation}`;

    this.addChatMessage(session, 'assistant', response);
    await this.saveSession(session);

    return {
      response,
      session,
      complete: false,
      quickActions: [
        { label: 'Continue negotiating', action: 'continue', primary: true },
        { label: 'View full strategy', action: 'get_strategy' },
      ],
    };
  }

  /**
   * Check negotiation status
   */
  private async handleCheckStatus(
    session: ConversationalNegotiationSession | null,
    userId: string
  ): Promise<NegotiationChatResult> {
    // If no specific session, check for all active negotiations
    if (!session) {
      const activeSessions = await this.getUserActiveSessions(userId);

      if (activeSessions.length === 0) {
        return {
          response: "You don't have any active negotiations right now. Would you like to start one?",
          session: this.createEmptySession(userId, '', ''),
          complete: false,
          quickActions: [
            { label: 'Start negotiation', action: 'start_negotiation', primary: true },
          ],
        };
      }

      const summaries = activeSessions.map(s => {
        const currentPrice = s.currentOffer?.totalPrice || s.bestOffer?.totalPrice;
        const status = s.status === 'awaiting_approval' ? 'needs your approval' : s.status;
        return `- **${s.counterpartyName}** (${s.subject}): ${status}${currentPrice ? ` - current offer: $${currentPrice.toLocaleString()}` : ''}`;
      }).join('\n');

      return {
        response: `You have ${activeSessions.length} active negotiation${activeSessions.length > 1 ? 's' : ''}:\n\n${summaries}\n\nWhich one would you like to check on?`,
        session: activeSessions[0],
        complete: false,
      };
    }

    // Generate status update for specific session
    const statusUpdate = this.generateStatusUpdate(session);

    return {
      response: statusUpdate,
      session,
      complete: session.status === 'completed',
      quickActions: this.getQuickActionsForSession(session),
    };
  }

  /**
   * Review the current offer
   */
  private async handleReviewOffer(
    session: ConversationalNegotiationSession | null
  ): Promise<NegotiationChatResult> {
    if (!session) {
      return {
        response: "I don't have an active negotiation to show you offers from. Would you like to start one?",
        session: this.createEmptySession('', '', ''),
        complete: false,
      };
    }

    if (!session.currentOffer && !session.bestOffer) {
      return {
        response: `No offers have been exchanged yet in your negotiation with ${session.counterpartyName}. Would you like to make an opening offer?`,
        session,
        complete: false,
        quickActions: [
          { label: 'Suggest an offer', action: 'suggest_opening', primary: true },
          { label: 'Set constraints first', action: 'set_constraints' },
        ],
      };
    }

    const offer = session.currentOffer || session.bestOffer;
    const analysis = await this.analyzeOffer(session, offer!);

    let response = `**Current offer from ${offer!.from === 'counterparty' ? session.counterpartyName : 'you'}:**\n\n`;
    response += `- **Unit Price:** $${offer!.unitPrice.toLocaleString()}\n`;
    response += `- **Total:** $${offer!.totalPrice.toLocaleString()} (${offer!.quantity} units)\n`;

    if (offer!.leadTimeDays) {
      response += `- **Lead Time:** ${offer!.leadTimeDays} days\n`;
    }
    if (offer!.paymentTerms) {
      response += `- **Payment Terms:** ${offer!.paymentTerms}\n`;
    }

    response += `\n**My Analysis:** ${analysis.assessment}\n\n`;

    if (analysis.recommendation) {
      response += `**Recommendation:** ${analysis.recommendation}`;
    }

    return {
      response,
      session,
      complete: false,
      quickActions: [
        { label: 'Accept offer', action: 'accept_offer' },
        { label: 'Counter offer', action: 'suggest_counter', primary: true },
        { label: 'Reject offer', action: 'reject_offer' },
      ],
    };
  }

  /**
   * Make a counter offer
   */
  private async handleMakeCounter(
    session: ConversationalNegotiationSession | null,
    entities: ExtractedEntities,
    message: string
  ): Promise<NegotiationChatResult> {
    if (!session) {
      return {
        response: "I don't have an active negotiation. Would you like to start one?",
        session: this.createEmptySession('', '', ''),
        complete: false,
      };
    }

    let counterOffer: NegotiationOffer;

    if (entities.price !== undefined || entities.unitPrice !== undefined) {
      // User specified a price
      const unitPrice = entities.unitPrice || entities.price || 0;
      const quantity = entities.quantity || session.constraints.quantity || 1;

      counterOffer = {
        from: 'user',
        unitPrice,
        totalPrice: unitPrice * quantity,
        quantity,
        leadTimeDays: entities.leadTime || session.currentOffer?.leadTimeDays,
        paymentTerms: entities.paymentTerms || session.currentOffer?.paymentTerms,
        timestamp: new Date().toISOString(),
        round: session.round + 1,
      };
    } else {
      // Generate a suggested counter offer
      const suggestion = await this.generateCounterSuggestion(session);

      if (session.mode === 'autonomous') {
        // In autonomous mode, automatically use the suggestion
        counterOffer = suggestion;
      } else {
        // In assisted mode, ask for approval
        session.pendingAction = {
          type: 'counter_offer',
          details: { offer: suggestion },
          reasoning: suggestion.reasoning || 'Based on negotiation strategy and constraints',
          confidence: 85,
          createdAt: new Date().toISOString(),
        };

        this.addChatMessage(session, 'user', message);

        const response = `Based on our strategy, I recommend countering at **$${suggestion.unitPrice.toLocaleString()}/unit** ($${suggestion.totalPrice.toLocaleString()} total).\n\n**Reasoning:** ${suggestion.reasoning}\n\nShould I send this counter offer?`;

        this.addChatMessage(session, 'assistant', response);
        await this.saveSession(session);

        return {
          response,
          session,
          complete: false,
          quickActions: [
            { label: 'Yes, send it', action: 'approve_action', primary: true },
            { label: 'No, let me adjust', action: 'reject_action' },
            { label: 'Counter at different price', action: 'specify_counter' },
          ],
        };
      }
    }

    // Send the counter offer
    session.round++;
    session.offerHistory.push(counterOffer);
    session.currentOffer = counterOffer;
    session.lastActivityAt = new Date().toISOString();

    this.addChatMessage(session, 'user', message);

    const response = `Counter offer sent: **$${counterOffer.unitPrice.toLocaleString()}/unit** ($${counterOffer.totalPrice.toLocaleString()} total).\n\nI'll let you know when ${session.counterpartyName} responds.`;

    this.addChatMessage(session, 'assistant', response, {
      offerMade: counterOffer,
    });

    await this.saveSession(session);

    // In real implementation, this would notify the counterparty
    // await this.notifyCounterparty(session, counterOffer);

    return {
      response,
      session,
      complete: false,
      quickActions: [
        { label: 'Check for response', action: 'check_status' },
      ],
    };
  }

  /**
   * Accept the current offer
   */
  private async handleAcceptOffer(
    session: ConversationalNegotiationSession | null
  ): Promise<NegotiationChatResult> {
    if (!session) {
      return {
        response: "I don't have an active negotiation to accept an offer in.",
        session: this.createEmptySession('', '', ''),
        complete: false,
      };
    }

    if (!session.currentOffer) {
      return {
        response: "There's no offer to accept yet. Would you like to make an opening offer?",
        session,
        complete: false,
      };
    }

    // Finalize the negotiation
    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    session.currentOffer.accepted = true;
    session.finalTerms = {
      unitPrice: session.currentOffer.unitPrice,
      quantity: session.currentOffer.quantity,
      totalPrice: session.currentOffer.totalPrice,
      currency: 'USD',
      leadTimeDays: session.currentOffer.leadTimeDays || 7,
      paymentTerms: session.currentOffer.paymentTerms || 'Net 30',
      shippingCost: 0,
    };

    // Calculate savings if we have initial reference
    if (session.offerHistory.length > 0) {
      const initialOffer = session.offerHistory[0];
      if (initialOffer.from === 'counterparty' && session.currentOffer.totalPrice < initialOffer.totalPrice) {
        session.savings = {
          amount: initialOffer.totalPrice - session.currentOffer.totalPrice,
          percentage: ((initialOffer.totalPrice - session.currentOffer.totalPrice) / initialOffer.totalPrice) * 100,
        };
      }
    }

    let response = `**Deal accepted!**\n\n`;
    response += `Agreed terms with ${session.counterpartyName}:\n`;
    response += `- **Price:** $${session.currentOffer.unitPrice.toLocaleString()}/unit\n`;
    response += `- **Total:** $${session.currentOffer.totalPrice.toLocaleString()}\n`;
    response += `- **Quantity:** ${session.currentOffer.quantity} units\n`;

    if (session.currentOffer.leadTimeDays) {
      response += `- **Lead Time:** ${session.currentOffer.leadTimeDays} days\n`;
    }

    if (session.savings && session.savings.amount > 0) {
      response += `\n**Savings:** $${session.savings.amount.toLocaleString()} (${session.savings.percentage.toFixed(1)}% off initial offer)`;
    }

    response += '\n\nWould you like me to create a purchase order?';

    this.addChatMessage(session, 'assistant', response, {
      actionTaken: 'accepted',
    });

    await this.saveSession(session);

    return {
      response,
      session,
      complete: true,
      outcome: 'agreed',
      quickActions: [
        { label: 'Create PO', action: 'create_po', primary: true },
        { label: 'View contract', action: 'view_contract' },
      ],
    };
  }

  /**
   * Reject the current offer/negotiation
   */
  private async handleRejectOffer(
    session: ConversationalNegotiationSession | null,
    reason?: string
  ): Promise<NegotiationChatResult> {
    if (!session) {
      return {
        response: "I don't have an active negotiation.",
        session: this.createEmptySession('', '', ''),
        complete: false,
      };
    }

    if (session.currentOffer) {
      session.currentOffer.rejected = true;
    }

    session.status = 'rejected';
    session.completedAt = new Date().toISOString();

    const response = `Negotiation with ${session.counterpartyName} has been ended.${reason ? ` Reason: ${reason}` : ''}\n\nWould you like me to find alternative suppliers?`;

    this.addChatMessage(session, 'assistant', response, {
      actionTaken: 'rejected',
    });

    await this.saveSession(session);

    return {
      response,
      session,
      complete: true,
      outcome: 'rejected',
      quickActions: [
        { label: 'Find alternatives', action: 'search_suppliers', primary: true },
        { label: 'Start new negotiation', action: 'start_negotiation' },
      ],
    };
  }

  /**
   * Enable autonomous negotiation mode
   */
  private async handleEnableAutonomous(
    session: ConversationalNegotiationSession | null,
    entities: ExtractedEntities
  ): Promise<NegotiationChatResult> {
    if (!session) {
      return {
        response: "I need an active negotiation to enable autonomous mode. Would you like to start one?",
        session: this.createEmptySession('', '', ''),
        complete: false,
      };
    }

    // Update constraints if provided
    if (entities.priceLimit) {
      session.constraints.priceLimit = entities.priceLimit;
    }
    if (entities.walkAwayPrice) {
      session.constraints.walkAwayPrice = entities.walkAwayPrice;
    }

    // Validate we have enough constraints for autonomous mode
    if (!session.constraints.priceLimit && !session.constraints.walkAwayPrice) {
      return {
        response: "Before I can negotiate autonomously, I need to know your limits. What's the maximum price you're willing to pay?",
        session,
        complete: false,
        quickActions: [
          { label: 'Set limits', action: 'set_constraints', primary: true },
        ],
      };
    }

    session.mode = 'autonomous';
    session.strategy = await this.generateStrategy(session);

    let response = `**Autonomous mode enabled.**\n\n`;
    response += `I'll negotiate with ${session.counterpartyName} on your behalf.\n\n`;
    response += `**Your limits:**\n`;
    response += `- Maximum: $${session.constraints.priceLimit?.toLocaleString() || 'Not set'}\n`;
    response += `- Target: $${session.constraints.targetPrice?.toLocaleString() || 'Not set'}\n`;
    if (session.constraints.walkAwayPrice) {
      response += `- Walk-away: $${session.constraints.walkAwayPrice.toLocaleString()}\n`;
    }
    response += `\n**My strategy:** ${session.strategy.explanation}\n\n`;
    response += `I'll update you on progress. Say "pause negotiation" if you want to take over.`;

    this.addChatMessage(session, 'assistant', response);
    await this.saveSession(session);

    // Start autonomous negotiation in background
    this.runAutonomousNegotiation(session).catch(err => {
      this.log('error', 'Autonomous negotiation failed', { error: err.message });
    });

    return {
      response,
      session,
      complete: false,
      quickActions: [
        { label: 'Pause negotiation', action: 'pause_negotiation' },
        { label: 'Check status', action: 'check_status' },
      ],
    };
  }

  /**
   * Pause autonomous negotiation
   */
  private async handlePauseNegotiation(
    session: ConversationalNegotiationSession | null
  ): Promise<NegotiationChatResult> {
    if (!session) {
      return {
        response: "I don't have an active negotiation to pause.",
        session: this.createEmptySession('', '', ''),
        complete: false,
      };
    }

    session.status = 'paused';
    session.mode = 'assisted';

    const response = `Negotiation with ${session.counterpartyName} is now paused. I won't take any actions without your approval.\n\n${this.generateStatusUpdate(session)}`;

    this.addChatMessage(session, 'assistant', response);
    await this.saveSession(session);

    return {
      response,
      session,
      complete: false,
      quickActions: [
        { label: 'Resume autonomous', action: 'enable_autonomous' },
        { label: 'Review current offer', action: 'review_offer' },
      ],
    };
  }

  /**
   * Resume a paused negotiation
   */
  private async handleResumeNegotiation(
    session: ConversationalNegotiationSession | null
  ): Promise<NegotiationChatResult> {
    if (!session) {
      return {
        response: "I don't have a paused negotiation to resume.",
        session: this.createEmptySession('', '', ''),
        complete: false,
      };
    }

    session.status = 'active';

    const response = `Negotiation with ${session.counterpartyName} resumed.\n\n${this.generateStatusUpdate(session)}`;

    this.addChatMessage(session, 'assistant', response);
    await this.saveSession(session);

    return {
      response,
      session,
      complete: false,
      quickActions: this.getQuickActionsForSession(session),
    };
  }

  /**
   * Get negotiation strategy
   */
  private async handleGetStrategy(
    session: ConversationalNegotiationSession | null
  ): Promise<NegotiationChatResult> {
    if (!session) {
      return {
        response: "I need an active negotiation to show you a strategy. Would you like to start one?",
        session: this.createEmptySession('', '', ''),
        complete: false,
      };
    }

    if (!session.strategy) {
      session.strategy = await this.generateStrategy(session);
      await this.saveSession(session);
    }

    const strategy = session.strategy;

    let response = `**Negotiation Strategy for ${session.counterpartyName}**\n\n`;
    response += `**Approach:** ${strategy.approach.charAt(0).toUpperCase() + strategy.approach.slice(1)}\n\n`;
    response += `**Tactics:**\n`;
    strategy.tactics.forEach(tactic => {
      response += `- ${tactic}\n`;
    });

    if (strategy.leveragePoints.length > 0) {
      response += `\n**Key Leverage Points:**\n`;
      strategy.leveragePoints.forEach(point => {
        response += `- ${point}\n`;
      });
    }

    response += `\n**Risk Level:** ${strategy.riskLevel.charAt(0).toUpperCase() + strategy.riskLevel.slice(1)}\n`;

    if (strategy.recommendedNextMove) {
      response += `\n**Recommended Next Move:** ${strategy.recommendedNextMove}`;
    }

    return {
      response,
      session,
      complete: false,
      quickActions: [
        { label: 'Follow recommendation', action: 'follow_recommendation', primary: true },
        { label: 'Different approach', action: 'adjust_strategy' },
      ],
    };
  }

  /**
   * Explain strategy in more detail
   */
  private async handleExplainStrategy(
    session: ConversationalNegotiationSession | null,
    question: string
  ): Promise<NegotiationChatResult> {
    if (!session) {
      return {
        response: "I need an active negotiation to explain the strategy.",
        session: this.createEmptySession('', '', ''),
        complete: false,
      };
    }

    const explanation = await this.generateStrategyExplanation(session, question);

    return {
      response: explanation,
      session,
      complete: false,
    };
  }

  /**
   * Approve a pending action
   */
  private async handleApproveAction(
    session: ConversationalNegotiationSession | null
  ): Promise<NegotiationChatResult> {
    if (!session || !session.pendingAction) {
      return {
        response: "There's no pending action to approve.",
        session: session || this.createEmptySession('', '', ''),
        complete: false,
      };
    }

    const action = session.pendingAction;
    session.pendingAction = undefined;

    switch (action.type) {
      case 'counter_offer':
        if (action.details.offer) {
          // Execute the counter offer
          session.round++;
          session.offerHistory.push(action.details.offer);
          session.currentOffer = action.details.offer;
          session.lastActivityAt = new Date().toISOString();

          const response = `Counter offer sent: **$${action.details.offer.unitPrice.toLocaleString()}/unit**.\n\nI'll notify you when ${session.counterpartyName} responds.`;

          this.addChatMessage(session, 'assistant', response, {
            offerMade: action.details.offer,
          });

          await this.saveSession(session);

          return {
            response,
            session,
            complete: false,
          };
        }
        break;

      case 'accept':
        return this.handleAcceptOffer(session);

      case 'reject':
        return this.handleRejectOffer(session, action.details.reason);
    }

    return {
      response: "Action approved.",
      session,
      complete: false,
    };
  }

  /**
   * Reject a pending action
   */
  private async handleRejectAction(
    session: ConversationalNegotiationSession | null,
    reason?: string
  ): Promise<NegotiationChatResult> {
    if (!session || !session.pendingAction) {
      return {
        response: "There's no pending action to reject.",
        session: session || this.createEmptySession('', '', ''),
        complete: false,
      };
    }

    session.pendingAction = undefined;

    const response = `No problem, I won't proceed with that action.${reason ? ` I understand: ${reason}` : ''} What would you like to do instead?`;

    this.addChatMessage(session, 'assistant', response);
    await this.saveSession(session);

    return {
      response,
      session,
      complete: false,
      quickActions: this.getQuickActionsForSession(session),
    };
  }

  /**
   * Handle unknown intent - try to be helpful
   */
  private async handleUnknownIntent(
    session: ConversationalNegotiationSession | null,
    message: string,
    userId: string,
    organizationId: string,
    organizationName: string
  ): Promise<NegotiationChatResult> {
    // Use AI to generate a helpful response
    const helpfulResponse = await this.generateHelpfulResponse(session, message);

    return {
      response: helpfulResponse,
      session: session || this.createEmptySession(userId, organizationId, organizationName),
      complete: false,
      suggestedActions: [
        'Start a negotiation',
        'Check negotiation status',
        'Get strategy advice',
      ],
    };
  }

  // ============================================================================
  // AI FUNCTIONS
  // ============================================================================

  /**
   * Classify the user's intent and extract entities
   */
  private async classifyIntent(
    message: string,
    session: ConversationalNegotiationSession | null
  ): Promise<{ intent: NegotiationIntent; entities: ExtractedEntities }> {
    const systemPrompt = `You are a negotiation intent classifier. Analyze the user's message and classify their intent.

${session ? `CURRENT NEGOTIATION CONTEXT:
- Counterparty: ${session.counterpartyName}
- Status: ${session.status}
- Mode: ${session.mode}
- Current offer: ${session.currentOffer ? `$${session.currentOffer.totalPrice}` : 'None'}
- Pending action: ${session.pendingAction ? session.pendingAction.type : 'None'}
- Round: ${session.round}` : 'No active negotiation.'}

INTENTS:
- start_negotiation: User wants to begin a new negotiation
- set_constraint: User is setting price limits, targets, or other constraints
- check_status: User asking about negotiation progress/status
- review_offer: User wants to see current offer details
- make_counter: User wants to make or suggests a counter offer
- accept_offer: User wants to accept the current offer
- reject_offer: User wants to reject/end negotiation
- enable_autonomous: User wants AI to negotiate automatically
- pause_negotiation: User wants to pause autonomous negotiation
- resume_negotiation: User wants to continue a paused negotiation
- get_strategy: User asking for negotiation strategy
- explain_strategy: User asking why/how about strategy
- approve_action: User approving a pending AI action
- reject_action: User rejecting a pending AI action
- unknown: Cannot determine intent

RESPOND WITH JSON ONLY:
{
  "intent": "intent_name",
  "entities": {
    "counterpartyName": "company name if mentioned",
    "counterpartyId": "id if mentioned",
    "subject": "what's being negotiated",
    "price": number or null,
    "unitPrice": number or null,
    "priceLimit": number or null,
    "targetPrice": number or null,
    "walkAwayPrice": number or null,
    "maxLeadTime": number or null,
    "quantity": number or null,
    "paymentTerms": "terms if mentioned",
    "reason": "reason if rejecting or explaining",
    "autonomous": boolean if user wants autonomous mode,
    "maxPrice": number or null
  },
  "confidence": 0.0-1.0
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] || '{}');

      return {
        intent: parsed.intent || 'unknown',
        entities: parsed.entities || {},
      };
    } catch (error) {
      this.log('error', 'Intent classification failed', { error });
      return { intent: 'unknown', entities: {} };
    }
  }

  /**
   * Generate negotiation strategy
   */
  async generateStrategy(session: ConversationalNegotiationSession): Promise<NegotiationStrategy> {
    const prompt = `Generate a negotiation strategy for:

CONTEXT:
- Negotiating with: ${session.counterpartyName}
- Subject: ${session.subject}
- Target price: $${session.constraints.targetPrice || 'Not set'}
- Maximum price: $${session.constraints.priceLimit || 'Not set'}
- Walk-away price: $${session.constraints.walkAwayPrice || 'Not set'}
- Quantity: ${session.constraints.quantity || 'Not specified'}
- Current round: ${session.round}
- Current offer: ${session.currentOffer ? `$${session.currentOffer.totalPrice}` : 'None yet'}
- Best offer so far: ${session.bestOffer ? `$${session.bestOffer.totalPrice}` : 'None yet'}

Generate a strategy that balances getting the best price while maintaining a good relationship.

RESPOND WITH JSON:
{
  "approach": "aggressive|balanced|conservative|collaborative",
  "openingPositionPercent": number (% below their initial for buyers),
  "maxConcessionPerRound": number (max % to concede per round),
  "leveragePoints": ["list of leverage points"],
  "tactics": ["list of recommended tactics"],
  "riskLevel": "low|medium|high",
  "explanation": "2-3 sentence strategy explanation",
  "recommendedNextMove": "what to do next"
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] || '{}');

      return {
        approach: parsed.approach || 'balanced',
        openingPositionPercent: parsed.openingPositionPercent || 15,
        maxConcessionPerRound: parsed.maxConcessionPerRound || 5,
        leveragePoints: parsed.leveragePoints || [],
        tactics: parsed.tactics || ['Start with reasonable offer', 'Build rapport'],
        riskLevel: parsed.riskLevel || 'medium',
        explanation: parsed.explanation || 'A balanced approach focusing on mutual value.',
        recommendedNextMove: parsed.recommendedNextMove,
      };
    } catch (error) {
      this.log('error', 'Strategy generation failed', { error });
      return {
        approach: 'balanced',
        openingPositionPercent: 15,
        maxConcessionPerRound: 5,
        leveragePoints: [],
        tactics: ['Build rapport first', 'Focus on total value, not just price'],
        riskLevel: 'medium',
        explanation: 'A balanced negotiation approach.',
      };
    }
  }

  /**
   * Generate a counter offer suggestion
   */
  private async generateCounterSuggestion(session: ConversationalNegotiationSession): Promise<NegotiationOffer> {
    const currentOffer = session.currentOffer || session.bestOffer;
    const strategy = session.strategy || await this.generateStrategy(session);

    // Calculate counter based on strategy
    let suggestedPrice: number;

    if (currentOffer && currentOffer.from === 'counterparty') {
      // Counter to their offer
      const gap = currentOffer.totalPrice - session.constraints.targetPrice;
      const concessionRate = Math.min(strategy.maxConcessionPerRound / 100, 0.5);
      suggestedPrice = session.constraints.targetPrice + (gap * (1 - concessionRate));

      // Ensure within limits
      suggestedPrice = Math.min(suggestedPrice, session.constraints.priceLimit || suggestedPrice);
      suggestedPrice = Math.max(suggestedPrice, session.constraints.targetPrice);
    } else {
      // Opening offer
      const basePrice = currentOffer?.totalPrice || session.constraints.targetPrice;
      suggestedPrice = basePrice * (1 - strategy.openingPositionPercent / 100);
    }

    const quantity = session.constraints.quantity || currentOffer?.quantity || 1;

    return {
      from: 'ai',
      unitPrice: suggestedPrice / quantity,
      totalPrice: Math.round(suggestedPrice * 100) / 100,
      quantity,
      leadTimeDays: currentOffer?.leadTimeDays,
      paymentTerms: currentOffer?.paymentTerms,
      timestamp: new Date().toISOString(),
      round: session.round + 1,
      reasoning: `Based on ${strategy.approach} strategy, this counter balances progress toward your target while keeping the deal viable.`,
    };
  }

  /**
   * Analyze an offer
   */
  private async analyzeOffer(
    session: ConversationalNegotiationSession,
    offer: NegotiationOffer
  ): Promise<{ assessment: string; recommendation: string }> {
    const { targetPrice, priceLimit, walkAwayPrice } = session.constraints;

    let assessment: string;
    let recommendation: string;

    if (offer.totalPrice <= targetPrice) {
      assessment = `This offer is at or below your target price. Excellent result!`;
      recommendation = `I recommend accepting this offer.`;
    } else if (offer.totalPrice <= (priceLimit || targetPrice * 1.1)) {
      const overTarget = ((offer.totalPrice - targetPrice) / targetPrice * 100).toFixed(1);
      assessment = `This offer is ${overTarget}% above your target but within your maximum.`;
      recommendation = `You could accept or try one more counter to get closer to your target.`;
    } else if (walkAwayPrice && offer.totalPrice <= walkAwayPrice) {
      const overTarget = ((offer.totalPrice - targetPrice) / targetPrice * 100).toFixed(1);
      assessment = `This offer is ${overTarget}% above target and exceeds your maximum, but is still below walk-away.`;
      recommendation = `I recommend countering firmly or preparing to walk away.`;
    } else {
      assessment = `This offer exceeds your limits. We need a significant counter or to walk away.`;
      recommendation = `Either make a strong counter offer or consider ending the negotiation.`;
    }

    return { assessment, recommendation };
  }

  /**
   * Generate a strategy explanation
   */
  private async generateStrategyExplanation(
    session: ConversationalNegotiationSession,
    question: string
  ): Promise<string> {
    const prompt = `Explain the negotiation strategy in response to the user's question.

CONTEXT:
- Strategy: ${JSON.stringify(session.strategy)}
- Constraints: ${JSON.stringify(session.constraints)}
- Current round: ${session.round}
- Current offer: ${session.currentOffer ? JSON.stringify(session.currentOffer) : 'None'}

USER QUESTION: ${question}

Provide a clear, helpful explanation in 2-4 sentences.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      });

      return response.content[0]?.type === 'text' ? response.content[0].text : 'Let me explain the strategy...';
    } catch {
      return 'The strategy is designed to get you the best possible deal while maintaining a positive relationship with the counterparty.';
    }
  }

  /**
   * Generate a helpful response for unknown intent
   */
  private async generateHelpfulResponse(
    session: ConversationalNegotiationSession | null,
    message: string
  ): Promise<string> {
    const prompt = `The user sent a message about negotiation that I couldn't classify. Generate a helpful response.

USER MESSAGE: "${message}"

${session ? `CONTEXT: Active negotiation with ${session.counterpartyName}, status: ${session.status}` : 'No active negotiation.'}

Respond helpfully, asking for clarification if needed, and suggest what the user might want to do.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      });

      return response.content[0]?.type === 'text' ? response.content[0].text : "I'm not sure what you'd like to do. Would you like to start a negotiation, check status, or get strategy advice?";
    } catch {
      return "I'm not sure what you'd like to do. You can:\n- Start a negotiation with a specific company\n- Check on existing negotiations\n- Get strategy advice\n\nWhat would you like to do?";
    }
  }

  // ============================================================================
  // AUTONOMOUS NEGOTIATION
  // ============================================================================

  /**
   * Run autonomous negotiation in the background
   */
  private async runAutonomousNegotiation(session: ConversationalNegotiationSession): Promise<void> {
    this.log('info', 'Starting autonomous negotiation', { sessionId: session.id });

    // In a real implementation, this would:
    // 1. Connect to the counterparty's system or agent
    // 2. Exchange offers automatically
    // 3. Update the session with progress
    // 4. Notify the user of significant events

    // For now, we'll simulate with a mock flow
    // This would be replaced with actual AI-to-AI negotiation using the session manager

    try {
      // Create underlying negotiation session
      // const underlyingSession = await this.sessionManager.createSession({...});
      // session.underlyingSessionId = underlyingSession.id;

      // Run negotiation rounds
      // for await (const round of this.sessionManager.runRounds(underlyingSession.id)) {
      //   await this.updateSessionFromRound(session, round);
      //   if (round.negotiationComplete) break;
      // }

      this.log('info', 'Autonomous negotiation would run here', { sessionId: session.id });
    } catch (error) {
      this.log('error', 'Autonomous negotiation failed', { error, sessionId: session.id });
      session.status = 'paused';
      session.mode = 'assisted';
      await this.saveSession(session);
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Generate a status update message
   */
  private generateStatusUpdate(session: ConversationalNegotiationSession): string {
    const lines: string[] = [];

    lines.push(`**Negotiation with ${session.counterpartyName}**`);
    lines.push(`Status: ${session.status}${session.mode === 'autonomous' ? ' (autonomous mode)' : ''}`);
    lines.push(`Round: ${session.round}`);

    if (session.currentOffer) {
      lines.push(`\nCurrent offer: **$${session.currentOffer.totalPrice.toLocaleString()}** from ${session.currentOffer.from === 'counterparty' ? session.counterpartyName : 'you'}`);
    }

    if (session.bestOffer && session.bestOffer !== session.currentOffer) {
      lines.push(`Best offer: $${session.bestOffer.totalPrice.toLocaleString()}`);
    }

    lines.push(`\nTarget: $${session.constraints.targetPrice?.toLocaleString() || 'Not set'}`);
    if (session.constraints.priceLimit) {
      lines.push(`Maximum: $${session.constraints.priceLimit.toLocaleString()}`);
    }

    if (session.pendingAction) {
      lines.push(`\n**Action pending your approval:** ${session.pendingAction.type}`);
    }

    return lines.join('\n');
  }

  /**
   * Get appropriate quick actions for session state
   */
  private getQuickActionsForSession(session: ConversationalNegotiationSession): Array<{ label: string; action: string; primary?: boolean }> {
    const actions: Array<{ label: string; action: string; primary?: boolean }> = [];

    if (session.pendingAction) {
      actions.push({ label: 'Approve', action: 'approve_action', primary: true });
      actions.push({ label: 'Reject', action: 'reject_action' });
      return actions;
    }

    switch (session.status) {
      case 'active':
        if (session.currentOffer) {
          actions.push({ label: 'Accept offer', action: 'accept_offer' });
          actions.push({ label: 'Counter offer', action: 'suggest_counter', primary: true });
          actions.push({ label: 'Reject', action: 'reject_offer' });
        } else {
          actions.push({ label: 'Make offer', action: 'suggest_opening', primary: true });
        }
        if (session.mode !== 'autonomous') {
          actions.push({ label: 'Go autonomous', action: 'enable_autonomous' });
        }
        break;

      case 'paused':
        actions.push({ label: 'Resume', action: 'resume_negotiation', primary: true });
        actions.push({ label: 'Review offer', action: 'review_offer' });
        break;

      case 'awaiting_approval':
        actions.push({ label: 'Approve', action: 'approve_action', primary: true });
        actions.push({ label: 'Reject', action: 'reject_action' });
        break;

      case 'completed':
        actions.push({ label: 'Create PO', action: 'create_po', primary: true });
        break;
    }

    return actions;
  }

  /**
   * Add a chat message to session
   */
  private addChatMessage(
    session: ConversationalNegotiationSession,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: ChatMessage['metadata']
  ): void {
    session.chatHistory.push({
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      role,
      content,
      timestamp: new Date().toISOString(),
      metadata,
    });

    // Keep only last 100 messages
    if (session.chatHistory.length > 100) {
      session.chatHistory = session.chatHistory.slice(-100);
    }
  }

  /**
   * Create an empty session placeholder
   */
  private createEmptySession(userId: string, organizationId: string, organizationName: string): ConversationalNegotiationSession {
    return {
      id: '',
      userId,
      organizationId,
      organizationName,
      counterpartyName: '',
      subject: '',
      mode: 'assisted',
      status: 'active',
      constraints: { priceLimit: 0, targetPrice: 0 },
      offerHistory: [],
      chatHistory: [],
      round: 0,
      maxRounds: 10,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * Create a new negotiation session
   */
  async createSession(params: {
    userId: string;
    organizationId: string;
    organizationName: string;
    counterpartyName: string;
    counterpartyId?: string;
    subject: string;
    mode: NegotiationMode;
    constraints: NegotiationConstraints;
  }): Promise<ConversationalNegotiationSession> {
    const session: ConversationalNegotiationSession = {
      id: `cneg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      userId: params.userId,
      organizationId: params.organizationId,
      organizationName: params.organizationName,
      counterpartyName: params.counterpartyName,
      counterpartyId: params.counterpartyId,
      subject: params.subject,
      mode: params.mode,
      status: 'active',
      constraints: params.constraints,
      offerHistory: [],
      chatHistory: [],
      round: 0,
      maxRounds: params.constraints.maxRoundsBeforeEscalation || 10,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (params.constraints.timeLimitHours || 48) * 60 * 60 * 1000).toISOString(),
    };

    this.sessions.set(session.id, session);
    await this.persistSession(session);

    return session;
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<ConversationalNegotiationSession | null> {
    // Check memory cache
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    // Load from database
    try {
      const result = await sql`
        SELECT * FROM conversational_negotiations WHERE id = ${sessionId}
      `;

      if (result.rows.length === 0) return null;

      const session = this.mapSessionRow(result.rows[0]);
      this.sessions.set(sessionId, session);
      return session;
    } catch {
      return null;
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserActiveSessions(userId: string): Promise<ConversationalNegotiationSession[]> {
    try {
      const result = await sql`
        SELECT * FROM conversational_negotiations
        WHERE user_id = ${userId}
        AND status IN ('active', 'paused', 'awaiting_approval')
        ORDER BY last_activity_at DESC
      `;

      return result.rows.map(row => this.mapSessionRow(row));
    } catch {
      // Return sessions from cache
      return Array.from(this.sessions.values()).filter(
        s => s.userId === userId && ['active', 'paused', 'awaiting_approval'].includes(s.status)
      );
    }
  }

  /**
   * Save session to database
   */
  async saveSession(session: ConversationalNegotiationSession): Promise<void> {
    this.sessions.set(session.id, session);
    await this.persistSession(session);
  }

  /**
   * Persist session to database
   */
  private async persistSession(session: ConversationalNegotiationSession): Promise<void> {
    try {
      await sql`
        INSERT INTO conversational_negotiations (
          id, user_id, organization_id, organization_name,
          counterparty_name, counterparty_id, subject, mode, status,
          constraints, current_offer, best_offer, offer_history,
          chat_history, strategy, pending_action, round, max_rounds,
          created_at, last_activity_at, expires_at, completed_at,
          final_terms, savings, underlying_session_id
        ) VALUES (
          ${session.id},
          ${session.userId},
          ${session.organizationId},
          ${session.organizationName},
          ${session.counterpartyName},
          ${session.counterpartyId || null},
          ${session.subject},
          ${session.mode},
          ${session.status},
          ${JSON.stringify(session.constraints)},
          ${session.currentOffer ? JSON.stringify(session.currentOffer) : null},
          ${session.bestOffer ? JSON.stringify(session.bestOffer) : null},
          ${JSON.stringify(session.offerHistory)},
          ${JSON.stringify(session.chatHistory)},
          ${session.strategy ? JSON.stringify(session.strategy) : null},
          ${session.pendingAction ? JSON.stringify(session.pendingAction) : null},
          ${session.round},
          ${session.maxRounds},
          ${session.createdAt},
          ${session.lastActivityAt},
          ${session.expiresAt},
          ${session.completedAt || null},
          ${session.finalTerms ? JSON.stringify(session.finalTerms) : null},
          ${session.savings ? JSON.stringify(session.savings) : null},
          ${session.underlyingSessionId || null}
        )
        ON CONFLICT (id) DO UPDATE SET
          status = ${session.status},
          constraints = ${JSON.stringify(session.constraints)},
          current_offer = ${session.currentOffer ? JSON.stringify(session.currentOffer) : null},
          best_offer = ${session.bestOffer ? JSON.stringify(session.bestOffer) : null},
          offer_history = ${JSON.stringify(session.offerHistory)},
          chat_history = ${JSON.stringify(session.chatHistory)},
          strategy = ${session.strategy ? JSON.stringify(session.strategy) : null},
          pending_action = ${session.pendingAction ? JSON.stringify(session.pendingAction) : null},
          round = ${session.round},
          last_activity_at = ${session.lastActivityAt},
          completed_at = ${session.completedAt || null},
          final_terms = ${session.finalTerms ? JSON.stringify(session.finalTerms) : null},
          savings = ${session.savings ? JSON.stringify(session.savings) : null}
      `;
    } catch (error) {
      this.log('error', 'Failed to persist session', { error, sessionId: session.id });
    }
  }

  /**
   * Map database row to session object
   */
  private mapSessionRow(row: Record<string, unknown>): ConversationalNegotiationSession {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      organizationId: row.organization_id as string,
      organizationName: row.organization_name as string,
      counterpartyName: row.counterparty_name as string,
      counterpartyId: row.counterparty_id as string | undefined,
      subject: row.subject as string,
      mode: row.mode as NegotiationMode,
      status: row.status as ConversationalNegotiationSession['status'],
      constraints: row.constraints as NegotiationConstraints,
      currentOffer: row.current_offer as NegotiationOffer | undefined,
      bestOffer: row.best_offer as NegotiationOffer | undefined,
      offerHistory: (row.offer_history as NegotiationOffer[]) || [],
      chatHistory: (row.chat_history as ChatMessage[]) || [],
      strategy: row.strategy as NegotiationStrategy | undefined,
      pendingAction: row.pending_action as PendingNegotiationAction | undefined,
      round: row.round as number,
      maxRounds: row.max_rounds as number,
      createdAt: row.created_at as string,
      lastActivityAt: row.last_activity_at as string,
      expiresAt: row.expires_at as string,
      completedAt: row.completed_at as string | undefined,
      finalTerms: row.final_terms as NegotiationTerms | undefined,
      savings: row.savings as { amount: number; percentage: number } | undefined,
      underlyingSessionId: row.underlying_session_id as string | undefined,
    };
  }

  // ============================================================================
  // LOGGING
  // ============================================================================

  private log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
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
// EXTRACTED ENTITIES TYPE
// ============================================================================

interface ExtractedEntities {
  counterpartyName?: string;
  counterpartyId?: string;
  subject?: string;
  price?: number;
  unitPrice?: number;
  priceLimit?: number;
  targetPrice?: number;
  walkAwayPrice?: number;
  maxLeadTime?: number;
  quantity?: number;
  paymentTerms?: string;
  reason?: string;
  autonomous?: boolean;
  maxPrice?: number;
  leadTime?: number;
}

// ============================================================================
// SINGLETON
// ============================================================================

let _engine: ConversationalNegotiationEngine | null = null;

export function getConversationalNegotiationEngine(): ConversationalNegotiationEngine {
  if (!_engine) {
    _engine = new ConversationalNegotiationEngine();
  }
  return _engine;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ConversationalNegotiationEngine;
