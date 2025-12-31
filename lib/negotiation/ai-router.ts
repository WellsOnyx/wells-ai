/**
 * AI-to-AI Negotiation Router
 *
 * Core system that connects a Buyer's Wells AI agent to a Seller's Wells AI agent
 * for automated negotiation. Manages session lifecycle, message routing, offer
 * evaluation, and deal finalization.
 *
 * Features:
 * - Multi-seller negotiation with parallel sessions
 * - State machine for negotiation lifecycle
 * - AI-powered negotiation strategy generation
 * - Full audit trail for fee collection
 * - ERP write-back on acceptance
 *
 * @module lib/negotiation/ai-router
 */

import { sql } from '@vercel/postgres';
import Anthropic from '@anthropic-ai/sdk';
import {
  NegotiationSession,
  NegotiationProtocolMessage,
  NegotiationTerms,
  TermConstraints,
  AgentIdentity,
  AgentType,
  SellerAgentRegistration,
  RoutingRequest,
  RoutingResult,
  SellerAgentMatch,
  SessionStatus,
  createProtocolMessage,
  createInitialSession,
  validateTerms,
  termsWithinConstraints,
  PROTOCOL_VERSION,
} from './protocol';
import { checkEscalationTriggers, EscalationResult } from './escalation-service';
import { matchSuppliersToRequest, getSupplierById } from '../suppliers/db';
import {
  NegotiationSessionManager,
  getSessionManager,
  SessionCreateParams,
  RoundResult,
  NegotiationOutcome,
  ChatUpdate,
} from './session-manager';
import { BuyerConstraints, createBuyerAgent } from './buyer-agent';
import { SellerConfig, createSellerAgent } from './seller-agent';
import {
  CommunicationGuard,
  getCommunicationGuard,
  isPathAllowed,
  isDirectHumanToHuman,
  type MessageOrigin,
  type MessageDestination,
  type TranslatedMessage,
  type HumanInstruction,
} from './communication-guard';

// ============================================================================
// CONFIGURATION
// ============================================================================

const LOG_PREFIX = '[AI Router]';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

/** Maximum time for a negotiation session (30 minutes) */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/** Maximum rounds before forcing decision */
const DEFAULT_MAX_ROUNDS = 5;

/** Stalemate detection threshold */
const STALEMATE_ROUNDS = 3;
const MIN_PRICE_MOVEMENT_PERCENT = 0.5;

// ============================================================================
// HUMAN COMMUNICATION GUARDRAILS
// ============================================================================

/**
 * CRITICAL: Human-to-Human Communication Prevention
 *
 * This section enforces the core principle of AI-to-AI negotiation:
 * Humans NEVER talk directly to each other.
 *
 * ALLOWED PATHS:
 * - Buyer Human -> Buyer AI (human instructs their AI)
 * - Seller Human -> Seller AI (human instructs their AI)
 * - Buyer AI <-> Seller AI (AIs negotiate)
 * - Buyer AI -> Buyer Human (AI reports back)
 * - Seller AI -> Seller Human (AI reports back)
 *
 * BLOCKED PATHS:
 * - Buyer Human -> Seller Human (BLOCKED - logged as bypass attempt)
 * - Buyer Human -> Seller AI (BLOCKED - must go through Buyer AI)
 * - Seller Human -> Buyer Human (BLOCKED - logged as bypass attempt)
 * - Seller Human -> Buyer AI (BLOCKED - must go through Seller AI)
 */

/**
 * Validate that a human message is properly routed through their AI
 * Rejects any attempt to directly message the other party
 */
export async function validateHumanMessage(
  sessionId: string,
  partyType: 'buyer' | 'seller',
  message: string,
  context?: {
    currentOffer?: NegotiationTerms;
    constraints?: Record<string, unknown>;
  }
): Promise<{
  allowed: boolean;
  blockReason?: string;
  intercepted: true;
  aiInterpretation: string;
  translatedForNegotiation: TranslatedMessage;
  humanFacingResponse: string;
  extractedInstruction: HumanInstruction;
  auditLogId?: string;
}> {
  log('info', 'Validating human message through guardrails', {
    sessionId,
    partyType,
    messageLength: message.length,
  });

  const guard = getCommunicationGuard(sessionId);

  // Determine origin and destination
  const origin: MessageOrigin = partyType === 'buyer' ? 'buyer_human' : 'seller_human';
  const properDestination: MessageDestination = partyType === 'buyer' ? 'buyer_ai' : 'seller_ai';

  // Check for direct communication attempts
  // If message contains phrases indicating direct communication intent, block it
  const directCommunicationPatterns = [
    /tell (them|the (buyer|seller|other party))/i,
    /say to (them|the (buyer|seller|other party))/i,
    /message (them|the (buyer|seller|other party)) directly/i,
    /let me talk to (them|the (buyer|seller))/i,
    /connect me (with|to) (them|the (buyer|seller))/i,
    /give (them|the (buyer|seller)) my (phone|email|contact)/i,
    /i want to speak (with|to) (them|the (buyer|seller)) directly/i,
  ];

  const attemptingDirectCommunication = directCommunicationPatterns.some(pattern =>
    pattern.test(message)
  );

  // Validate the path
  const validation = guard.validateCommunication(origin, properDestination, message);

  if (!validation.allowed) {
    // This shouldn't happen for proper routing, but log it
    log('error', 'Communication path blocked', {
      sessionId,
      origin,
      destination: properDestination,
      reason: validation.blockReason,
    });
  }

  // Process the message through the AI translation layer
  const processedMessage = await guard.processHumanMessage(partyType, message, {
    currentOffer: context?.currentOffer,
    constraints: context?.constraints as Parameters<CommunicationGuard['processHumanMessage']>[2]['constraints'],
  });

  // If they're trying to communicate directly, add extra messaging
  let humanResponse = processedMessage.humanFacingResponse;
  if (attemptingDirectCommunication) {
    humanResponse = `I understand you want to communicate with the other party, but all negotiation goes through me - your AI representative. This protects both parties and ensures professional communication.\n\n${humanResponse}`;

    // Log the bypass attempt
    await logBypassAttemptToDatabase(sessionId, {
      origin,
      attemptedDestination: partyType === 'buyer' ? 'seller_human' : 'buyer_human',
      message: message.substring(0, 500),
      reason: 'Attempted direct communication detected in message content',
    });
  }

  return {
    allowed: true, // We always process, but through AI
    intercepted: true,
    aiInterpretation: processedMessage.aiInterpretation,
    translatedForNegotiation: processedMessage.translatedForNegotiation,
    humanFacingResponse: humanResponse,
    extractedInstruction: processedMessage.extractedInstruction,
  };
}

/**
 * Process a human instruction and execute it through AI-to-AI negotiation
 * This is the ONLY way humans can influence the negotiation
 */
export async function executeHumanInstruction(
  sessionId: string,
  partyType: 'buyer' | 'seller',
  instruction: HumanInstruction,
  translatedMessage: TranslatedMessage
): Promise<{
  success: boolean;
  aiActionTaken: string;
  nextSteps: string[];
  requiresApproval?: boolean;
  approvalReason?: string;
}> {
  log('info', 'Executing human instruction through AI', {
    sessionId,
    partyType,
    intent: instruction.intent,
  });

  const session = await getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  let aiActionTaken: string;
  let nextSteps: string[] = [];
  let requiresApproval = false;
  let approvalReason: string | undefined;

  switch (instruction.intent) {
    case 'push_back_price':
      aiActionTaken = "I'll push back on the price in my next communication with the other party's AI.";
      nextSteps = [
        'Wait for my update on how the other party responded',
        'You can adjust your limits if needed',
        'Say "accept" when you\'re satisfied with the terms',
      ];
      break;

    case 'accept_offer':
      aiActionTaken = "I'll communicate your acceptance to the other party's AI representative.";
      nextSteps = [
        'I\'ll finalize the agreement terms',
        'You\'ll receive confirmation once both parties have agreed',
      ];
      break;

    case 'reject_offer':
      aiActionTaken = "I'll communicate that we're declining this negotiation.";
      nextSteps = [
        'The negotiation will be closed',
        'I can start new negotiations with other suppliers if you\'d like',
      ];
      break;

    case 'set_limit':
      const priceTarget = instruction.targets.find(t => t.type === 'price');
      if (priceTarget?.value) {
        aiActionTaken = `I've noted your limit of $${priceTarget.value}. I won't agree to anything beyond this.`;
      } else {
        aiActionTaken = "I've updated your constraints based on your instruction.";
      }
      nextSteps = [
        'I\'ll negotiate within these new limits',
        'I\'ll escalate if the other party can\'t meet these terms',
      ];
      break;

    case 'escalate':
      requiresApproval = true;
      approvalReason = 'Manual escalation requested by user';
      aiActionTaken = "I'm pausing the negotiation for your review.";
      nextSteps = [
        'Review the current terms',
        'Tell me how you\'d like to proceed',
      ];
      break;

    case 'pause':
      aiActionTaken = "I've paused the negotiation. Nothing will proceed until you say otherwise.";
      nextSteps = [
        'Say "resume" when you\'re ready to continue',
        'You can review the current state of the negotiation',
      ];
      break;

    case 'proceed':
    case 'request_info':
    case 'push_back_terms':
    case 'modify_constraints':
    default:
      aiActionTaken = `I understand your instruction. I'll ${instruction.intent.replace(/_/g, ' ')} on your behalf.`;
      nextSteps = [
        'I\'ll update you on the negotiation progress',
        'You can give me new instructions at any time',
      ];
      break;
  }

  return {
    success: true,
    aiActionTaken,
    nextSteps,
    requiresApproval,
    approvalReason,
  };
}

/**
 * Generate human-facing summary of AI-to-AI communication
 * Humans only see what their AI tells them, not raw messages from other party
 */
export async function generateHumanFacingSummary(
  sessionId: string,
  partyType: 'buyer' | 'seller',
  latestAIMessage: NegotiationProtocolMessage
): Promise<{
  summary: string;
  keyPoints: string[];
  suggestedResponses: string[];
  currentOffer?: NegotiationTerms;
  requiresDecision: boolean;
  decisionOptions?: string[];
}> {
  const guard = getCommunicationGuard(sessionId);
  return guard.translateForHuman(latestAIMessage, partyType);
}

/**
 * Log a bypass attempt to the database for security audit
 */
async function logBypassAttemptToDatabase(
  sessionId: string,
  attempt: {
    origin: MessageOrigin;
    attemptedDestination: MessageDestination;
    message: string;
    reason: string;
    userId?: string;
    ipAddress?: string;
  }
): Promise<void> {
  const attemptId = `bypass_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  try {
    await sql`
      INSERT INTO communication_bypass_attempts (
        id, session_id, timestamp, origin, intended_destination,
        message_content, block_reason, user_id, ip_address
      ) VALUES (
        ${attemptId},
        ${sessionId},
        ${new Date().toISOString()},
        ${attempt.origin},
        ${attempt.attemptedDestination},
        ${attempt.message},
        ${attempt.reason},
        ${attempt.userId || null},
        ${attempt.ipAddress || null}
      )
    `;

    log('warn', 'Bypass attempt logged to database', {
      attemptId,
      sessionId,
      origin: attempt.origin,
      attemptedDestination: attempt.attemptedDestination,
    });
  } catch (error) {
    // Log to console if DB fails
    log('error', 'Failed to log bypass attempt to database', {
      attemptId,
      sessionId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/**
 * Get all bypass attempts for a session (for admin review)
 */
export async function getBypassAttempts(sessionId: string): Promise<Array<{
  id: string;
  timestamp: string;
  origin: string;
  attemptedDestination: string;
  message: string;
  reason: string;
}>> {
  try {
    const result = await sql`
      SELECT id, timestamp, origin, intended_destination, message_content, block_reason
      FROM communication_bypass_attempts
      WHERE session_id = ${sessionId}
      ORDER BY timestamp DESC
    `;

    return result.rows.map(row => ({
      id: row.id as string,
      timestamp: row.timestamp as string,
      origin: row.origin as string,
      attemptedDestination: row.intended_destination as string,
      message: row.message_content as string,
      reason: row.block_reason as string,
    }));
  } catch {
    return [];
  }
}

// ============================================================================
// STATE MACHINE TYPES
// ============================================================================

/**
 * NegotiationSessionState - State machine for negotiation lifecycle
 *
 * States:
 * - initiated: Session created but not started
 * - proposal_sent: Initial proposal sent to seller
 * - counter_received: Received counter-offer from seller
 * - counter_sent: Sent counter-offer back to seller
 * - accepted: Deal accepted by both parties
 * - rejected: Deal rejected by one party
 * - expired: Session timed out
 */
export type NegotiationSessionState =
  | 'initiated'
  | 'proposal_sent'
  | 'counter_received'
  | 'counter_sent'
  | 'accepted'
  | 'rejected'
  | 'expired';

/**
 * Multi-seller negotiation session that tracks parallel negotiations
 */
export interface MultiSellerNegotiationSession {
  id: string;
  rfqId: string;
  buyerWellsId: string;
  buyerOrgId: string;
  buyerOrgName: string;

  /** All seller sessions in parallel */
  sellerSessions: Map<string, SellerNegotiationState>;

  /** Current best offer across all sellers */
  currentBestOffer: OfferSnapshot | null;

  /** History of all offers received */
  offerHistory: OfferSnapshot[];

  /** Overall session state */
  state: 'active' | 'decided' | 'expired' | 'cancelled';

  /** Buyer's negotiation preferences */
  buyerContext: BuyerNegotiationContext;

  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  decidedAt?: string;
  selectedSellerId?: string;
}

/**
 * Individual seller's negotiation state
 */
export interface SellerNegotiationState {
  sellerId: string;
  sellerWellsId: string;
  sellerOrgName: string;

  /** Current state for this seller */
  state: NegotiationSessionState;

  /** Current offer from this seller */
  currentOffer: OfferSnapshot | null;

  /** All counter-offers in history */
  counterHistory: OfferSnapshot[];

  /** All messages exchanged */
  messages: NegotiationMessage[];

  /** Round number */
  round: number;

  /** Last activity timestamp */
  lastActivityAt: string;
}

/**
 * Snapshot of an offer at a point in time
 */
export interface OfferSnapshot {
  sellerId: string;
  sellerName: string;
  items: LineItem[];
  totalAmount: number;
  terms: PaymentTerms;
  leadTimeDays: number;
  validUntil: string;
  timestamp: string;
  round: number;
}

/**
 * Line item in an offer
 */
export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specifications?: Record<string, string>;
}

/**
 * Payment terms structure
 */
export interface PaymentTerms {
  paymentTerms: string;
  currency: string;
  shippingCost: number;
  shippingMethod?: string;
  warrantyMonths?: number;
  additionalTerms?: Record<string, string | number | boolean>;
}

/**
 * Buyer's negotiation context and preferences
 */
export interface BuyerNegotiationContext {
  maxBudget: number;
  targetPrice: number;
  maxLeadTime: number;
  requiredSpecs: string[];
  preferredPaymentTerms: string[];
  negotiationStyle: 'aggressive' | 'balanced' | 'conservative';
  priorityFactors: {
    price: number;
    leadTime: number;
    quality: number;
    reliability: number;
  };
}

/**
 * Negotiation message protocol
 */
export interface NegotiationMessage {
  type: 'rfq' | 'quote' | 'counter' | 'accept' | 'reject' | 'clarification';
  fromAgent: 'buyer_wells' | 'seller_wells';
  payload: {
    items?: LineItem[];
    totalAmount?: number;
    terms?: PaymentTerms;
    reasoning?: string;
    counterOffer?: Partial<OfferSnapshot>;
    clarificationRequest?: string;
    clarificationResponse?: string;
  };
  timestamp: string;
  sessionId: string;
  messageId: string;
}

/**
 * Offer ranking result
 */
export interface OfferRanking {
  sellerId: string;
  sellerName: string;
  offer: OfferSnapshot;
  score: number;
  breakdown: {
    priceScore: number;
    leadTimeScore: number;
    termsScore: number;
    reliabilityScore: number;
  };
  recommendation: 'accept' | 'negotiate' | 'reject';
  reasoning: string;
}

/**
 * Negotiation strategy generated by AI
 */
export interface NegotiationStrategy {
  approach: 'aggressive' | 'balanced' | 'conservative';
  openingDiscount: number;
  maxConcessions: number;
  walkAwayThreshold: number;
  keyLeveragePoints: string[];
  suggestedTactics: string[];
  riskAssessment: string;
}

// ============================================================================
// LOGGING
// ============================================================================

function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, service: 'ai-router', message, ...meta };

  if (level === 'error') {
    console.error(`${LOG_PREFIX} ERROR: ${message}`, meta ? JSON.stringify(meta) : '');
  } else if (level === 'warn') {
    console.warn(`${LOG_PREFIX} WARN: ${message}`, meta ? JSON.stringify(meta) : '');
  } else {
    console.log(`${LOG_PREFIX} ${message}`, meta ? JSON.stringify(meta) : '');
  }
}

// ============================================================================
// AI-TO-AI ROUTER CLASS
// ============================================================================

/**
 * AIToAIRouter - Core class for managing AI-to-AI negotiations
 *
 * Connects Buyer Wells AI agents to Seller Wells AI agents for automated
 * negotiation. Handles multi-seller parallel negotiations, message routing,
 * offer evaluation, and deal finalization.
 *
 * Usage:
 * ```typescript
 * const router = new AIToAIRouter();
 *
 * // Start negotiation with multiple sellers
 * const session = await router.initiateNegotiation(rfqId, buyerContext, sellerIds);
 *
 * // Route messages between buyer and seller agents
 * await router.routeBuyerMessage(sessionId, message);
 * await router.routeSellerResponse(sessionId, sellerId, response);
 *
 * // Evaluate and rank offers
 * const rankings = await router.evaluateOffers(sessionId);
 *
 * // Accept the best offer
 * const award = await router.acceptOffer(sessionId, sellerId);
 * ```
 */
export class AIToAIRouter {
  private activeSessions: Map<string, MultiSellerNegotiationSession> = new Map();
  private sessionManager: NegotiationSessionManager;

  constructor() {
    this.sessionManager = getSessionManager();
  }

  // ==========================================================================
  // INITIATE NEGOTIATION
  // ==========================================================================

  /**
   * Start multi-seller negotiation
   *
   * Creates parallel negotiation sessions with multiple sellers for a single RFQ.
   * Each seller gets their own negotiation state that runs concurrently.
   *
   * @param rfqId - The RFQ being negotiated
   * @param buyerContext - Buyer's preferences and constraints
   * @param sellerIds - Array of seller IDs to negotiate with
   * @returns The multi-seller negotiation session
   */
  async initiateNegotiation(
    rfqId: string,
    buyerContext: BuyerNegotiationContext,
    sellerIds: string[]
  ): Promise<MultiSellerNegotiationSession> {
    log('info', 'Initiating multi-seller negotiation', {
      rfqId,
      sellerCount: sellerIds.length,
      maxBudget: buyerContext.maxBudget,
    });

    // Validate inputs
    if (!sellerIds.length) {
      throw new Error('At least one seller ID is required');
    }

    if (buyerContext.maxBudget <= 0) {
      throw new Error('Max budget must be positive');
    }

    // Generate session ID
    const sessionId = `msn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    // Get RFQ details
    const rfqResult = await sql`SELECT * FROM rfqs WHERE id = ${rfqId}`;
    if (rfqResult.rows.length === 0) {
      throw new Error(`RFQ not found: ${rfqId}`);
    }
    const rfq = rfqResult.rows[0];

    // Get buyer organization info
    const buyerOrgId = rfq.company_id || rfq.requestor_email?.split('@')[1] || 'unknown';
    const buyerOrgName = rfq.company_name || 'Buyer Organization';

    // Create seller sessions
    const sellerSessions = new Map<string, SellerNegotiationState>();

    for (const sellerId of sellerIds) {
      try {
        const supplier = await getSupplierById(sellerId);
        if (!supplier) {
          log('warn', `Supplier not found: ${sellerId}, skipping`);
          continue;
        }

        const sellerState: SellerNegotiationState = {
          sellerId,
          sellerWellsId: `wells_seller_${sellerId}`,
          sellerOrgName: supplier.companyName || `Supplier ${sellerId}`,
          state: 'initiated',
          currentOffer: null,
          counterHistory: [],
          messages: [],
          round: 0,
          lastActivityAt: new Date().toISOString(),
        };

        sellerSessions.set(sellerId, sellerState);
      } catch (error) {
        log('error', `Failed to initialize seller session: ${sellerId}`, {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    if (sellerSessions.size === 0) {
      throw new Error('No valid sellers found for negotiation');
    }

    // Create the multi-seller session
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TIMEOUT_MS);

    const session: MultiSellerNegotiationSession = {
      id: sessionId,
      rfqId,
      buyerWellsId: `wells_buyer_${buyerOrgId}`,
      buyerOrgId,
      buyerOrgName,
      sellerSessions,
      currentBestOffer: null,
      offerHistory: [],
      state: 'active',
      buyerContext,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    // Store in memory and database
    this.activeSessions.set(sessionId, session);
    await this.persistMultiSellerSession(session);

    // Record negotiation initiation for fee tracking
    await this.recordNegotiationEvent(sessionId, 'initiated', {
      rfqId,
      sellerCount: sellerSessions.size,
      buyerContext,
    });

    log('info', 'Multi-seller negotiation initiated', {
      sessionId,
      rfqId,
      sellerCount: sellerSessions.size,
    });

    return session;
  }

  // ==========================================================================
  // MESSAGE ROUTING
  // ==========================================================================

  /**
   * Route buyer Wells message to seller Wells
   *
   * Takes a message from the buyer's Wells AI agent and routes it to
   * the appropriate seller's Wells AI agent.
   *
   * @param sessionId - The multi-seller session ID
   * @param message - The message to route
   * @returns Updated session state
   */
  async routeBuyerMessage(
    sessionId: string,
    message: NegotiationMessage
  ): Promise<{
    session: MultiSellerNegotiationSession;
    responses: Map<string, NegotiationMessage>;
  }> {
    log('info', 'Routing buyer message', {
      sessionId,
      messageType: message.type,
    });

    const session = await this.getMultiSellerSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.state !== 'active') {
      throw new Error(`Session is not active: ${session.state}`);
    }

    // Validate message
    this.validateMessage(message);

    // Determine which sellers to send to (all active or specific)
    const targetSellers = Array.from(session.sellerSessions.values())
      .filter(s => s.state !== 'accepted' && s.state !== 'rejected' && s.state !== 'expired');

    if (targetSellers.length === 0) {
      throw new Error('No active seller sessions to route message to');
    }

    const responses = new Map<string, NegotiationMessage>();

    // Route to each seller and collect responses
    for (const sellerState of targetSellers) {
      try {
        // Add message to seller's history
        sellerState.messages.push({
          ...message,
          timestamp: new Date().toISOString(),
        });

        // Update seller state based on message type
        if (message.type === 'rfq' || message.type === 'counter') {
          sellerState.state = message.type === 'rfq' ? 'proposal_sent' : 'counter_sent';
          sellerState.round++;
        }

        // Generate seller response using AI
        const response = await this.generateSellerResponse(session, sellerState, message);
        responses.set(sellerState.sellerId, response);

        // Process the response
        await this.processSellerResponse(session, sellerState, response);

        sellerState.lastActivityAt = new Date().toISOString();
      } catch (error) {
        log('error', `Failed to route message to seller: ${sellerState.sellerId}`, {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    // Update session
    session.updatedAt = new Date().toISOString();
    this.activeSessions.set(sessionId, session);
    await this.persistMultiSellerSession(session);

    // Record message routing for audit
    await this.recordNegotiationEvent(sessionId, 'buyer_message_routed', {
      messageType: message.type,
      targetSellerCount: targetSellers.length,
      responseCount: responses.size,
    });

    return { session, responses };
  }

  /**
   * Route seller Wells response back to buyer Wells
   *
   * Processes a response from a seller's Wells AI agent and updates
   * the negotiation state accordingly.
   *
   * @param sessionId - The multi-seller session ID
   * @param sellerId - The seller's ID
   * @param response - The seller's response message
   * @returns Updated session state
   */
  async routeSellerResponse(
    sessionId: string,
    sellerId: string,
    response: NegotiationMessage
  ): Promise<{
    session: MultiSellerNegotiationSession;
    buyerAction: 'counter' | 'accept' | 'reject' | 'evaluate' | null;
    nextMessage?: NegotiationMessage;
  }> {
    log('info', 'Routing seller response', {
      sessionId,
      sellerId,
      responseType: response.type,
    });

    const session = await this.getMultiSellerSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const sellerState = session.sellerSessions.get(sellerId);
    if (!sellerState) {
      throw new Error(`Seller not found in session: ${sellerId}`);
    }

    // Validate response
    this.validateMessage(response);

    // Process the response
    await this.processSellerResponse(session, sellerState, response);

    // Determine buyer's next action based on all current offers
    const { action, nextMessage } = await this.determineBuyerAction(session);

    // Update session
    session.updatedAt = new Date().toISOString();
    this.activeSessions.set(sessionId, session);
    await this.persistMultiSellerSession(session);

    // Record for audit
    await this.recordNegotiationEvent(sessionId, 'seller_response_routed', {
      sellerId,
      responseType: response.type,
      buyerAction: action,
    });

    return {
      session,
      buyerAction: action,
      nextMessage,
    };
  }

  // ==========================================================================
  // OFFER EVALUATION
  // ==========================================================================

  /**
   * Compare all seller offers and rank them
   *
   * Evaluates all current offers from sellers based on the buyer's
   * preferences and constraints. Returns ranked offers with scores
   * and recommendations.
   *
   * @param sessionId - The multi-seller session ID
   * @returns Ranked list of offers
   */
  async evaluateOffers(sessionId: string): Promise<OfferRanking[]> {
    log('info', 'Evaluating offers', { sessionId });

    const session = await this.getMultiSellerSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const rankings: OfferRanking[] = [];

    // Collect all current offers
    const offers: OfferSnapshot[] = [];
    for (const [sellerId, sellerState] of session.sellerSessions) {
      if (sellerState.currentOffer) {
        offers.push(sellerState.currentOffer);
      }
    }

    if (offers.length === 0) {
      log('info', 'No offers to evaluate');
      return [];
    }

    // Calculate scores for each offer
    for (const offer of offers) {
      const ranking = await this.scoreOffer(offer, session.buyerContext, offers);
      rankings.push(ranking);
    }

    // Sort by score descending
    rankings.sort((a, b) => b.score - a.score);

    // Update session with current best offer
    if (rankings.length > 0) {
      session.currentBestOffer = rankings[0].offer;
      session.updatedAt = new Date().toISOString();
      this.activeSessions.set(sessionId, session);
    }

    // Record evaluation for audit
    await this.recordNegotiationEvent(sessionId, 'offers_evaluated', {
      offerCount: offers.length,
      bestSellerId: rankings[0]?.sellerId,
      bestScore: rankings[0]?.score,
    });

    log('info', 'Offers evaluated', {
      sessionId,
      offerCount: offers.length,
      bestOffer: rankings[0]?.sellerId,
    });

    return rankings;
  }

  /**
   * Score an individual offer
   */
  private async scoreOffer(
    offer: OfferSnapshot,
    buyerContext: BuyerNegotiationContext,
    allOffers: OfferSnapshot[]
  ): Promise<OfferRanking> {
    // Calculate price score (0-100, higher is better = lower price)
    const lowestPrice = Math.min(...allOffers.map(o => o.totalAmount));
    const highestPrice = Math.max(...allOffers.map(o => o.totalAmount));
    const priceRange = highestPrice - lowestPrice || 1;
    const priceScore = offer.totalAmount <= buyerContext.targetPrice
      ? 100
      : Math.max(0, 100 - ((offer.totalAmount - lowestPrice) / priceRange) * 50);

    // Calculate lead time score (0-100, higher is better = shorter lead time)
    const shortestLead = Math.min(...allOffers.map(o => o.leadTimeDays));
    const longestLead = Math.max(...allOffers.map(o => o.leadTimeDays));
    const leadRange = longestLead - shortestLead || 1;
    const leadTimeScore = offer.leadTimeDays <= buyerContext.maxLeadTime
      ? 100
      : Math.max(0, 100 - ((offer.leadTimeDays - shortestLead) / leadRange) * 50);

    // Calculate terms score based on payment terms match
    const termsScore = buyerContext.preferredPaymentTerms.includes(offer.terms.paymentTerms)
      ? 100
      : 70;

    // Reliability score (would come from supplier history, defaulting to 80)
    const reliabilityScore = 80;

    // Calculate weighted total score
    const weights = buyerContext.priorityFactors;
    const totalWeight = weights.price + weights.leadTime + weights.quality + weights.reliability;
    const score = Math.round(
      (priceScore * weights.price +
        leadTimeScore * weights.leadTime +
        termsScore * weights.quality +
        reliabilityScore * weights.reliability) /
        totalWeight
    );

    // Determine recommendation
    let recommendation: 'accept' | 'negotiate' | 'reject';
    let reasoning: string;

    if (offer.totalAmount <= buyerContext.targetPrice && offer.leadTimeDays <= buyerContext.maxLeadTime) {
      recommendation = 'accept';
      reasoning = 'Offer meets all target criteria.';
    } else if (offer.totalAmount <= buyerContext.maxBudget) {
      recommendation = 'negotiate';
      reasoning = offer.totalAmount > buyerContext.targetPrice
        ? `Price ${((offer.totalAmount / buyerContext.targetPrice - 1) * 100).toFixed(1)}% above target. Room for negotiation.`
        : `Lead time ${offer.leadTimeDays - buyerContext.maxLeadTime} days over target. May need to negotiate.`;
    } else {
      recommendation = 'reject';
      reasoning = `Price $${(offer.totalAmount - buyerContext.maxBudget).toFixed(2)} over maximum budget.`;
    }

    return {
      sellerId: offer.sellerId,
      sellerName: offer.sellerName,
      offer,
      score,
      breakdown: {
        priceScore,
        leadTimeScore,
        termsScore,
        reliabilityScore,
      },
      recommendation,
      reasoning,
    };
  }

  // ==========================================================================
  // ACCEPT OFFER
  // ==========================================================================

  /**
   * Finalize winning offer
   *
   * Accepts an offer from a specific seller, marks the negotiation as decided,
   * records the transaction for fee collection, and triggers ERP write-back.
   *
   * @param sessionId - The multi-seller session ID
   * @param sellerId - The winning seller's ID
   * @returns Award details
   */
  async acceptOffer(
    sessionId: string,
    sellerId: string
  ): Promise<{
    success: boolean;
    awardId: string;
    session: MultiSellerNegotiationSession;
    award: {
      sellerId: string;
      sellerName: string;
      amount: number;
      terms: PaymentTerms;
      leadTimeDays: number;
    };
    erpSyncTriggered: boolean;
  }> {
    log('info', 'Accepting offer', { sessionId, sellerId });

    const session = await this.getMultiSellerSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const sellerState = session.sellerSessions.get(sellerId);
    if (!sellerState) {
      throw new Error(`Seller not found in session: ${sellerId}`);
    }

    if (!sellerState.currentOffer) {
      throw new Error(`No current offer from seller: ${sellerId}`);
    }

    const offer = sellerState.currentOffer;

    // Update seller state to accepted
    sellerState.state = 'accepted';
    sellerState.messages.push({
      type: 'accept',
      fromAgent: 'buyer_wells',
      payload: {
        totalAmount: offer.totalAmount,
        reasoning: 'Offer accepted by buyer.',
      },
      timestamp: new Date().toISOString(),
      sessionId,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    });

    // Reject all other sellers
    for (const [otherId, otherState] of session.sellerSessions) {
      if (otherId !== sellerId && otherState.state !== 'rejected') {
        otherState.state = 'rejected';
        otherState.messages.push({
          type: 'reject',
          fromAgent: 'buyer_wells',
          payload: {
            reasoning: 'Another offer was selected.',
          },
          timestamp: new Date().toISOString(),
          sessionId,
          messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        });
      }
    }

    // Update session state
    session.state = 'decided';
    session.decidedAt = new Date().toISOString();
    session.selectedSellerId = sellerId;
    session.updatedAt = new Date().toISOString();

    // Create award record
    const awardId = `award_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await this.createAwardRecord(session, sellerState, offer, awardId);

    // Persist session
    this.activeSessions.set(sessionId, session);
    await this.persistMultiSellerSession(session);

    // Record for fee collection
    await this.recordNegotiationEvent(sessionId, 'offer_accepted', {
      sellerId,
      awardId,
      amount: offer.totalAmount,
      feeAmount: offer.totalAmount * 0.02, // 2% fee
    });

    // Trigger ERP write-back
    let erpSyncTriggered = false;
    try {
      await this.triggerERPWriteback(session.rfqId, awardId);
      erpSyncTriggered = true;
    } catch (error) {
      log('error', 'ERP write-back failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    log('info', 'Offer accepted', {
      sessionId,
      sellerId,
      awardId,
      amount: offer.totalAmount,
    });

    return {
      success: true,
      awardId,
      session,
      award: {
        sellerId,
        sellerName: sellerState.sellerOrgName,
        amount: offer.totalAmount,
        terms: offer.terms,
        leadTimeDays: offer.leadTimeDays,
      },
      erpSyncTriggered,
    };
  }

  // ==========================================================================
  // NEGOTIATION STRATEGY
  // ==========================================================================

  /**
   * Generate AI negotiation strategy
   *
   * Uses Claude AI to analyze the buyer's preferences and market conditions
   * to generate an optimal negotiation strategy.
   *
   * @param buyerPreferences - Buyer's preferences and constraints
   * @returns AI-generated negotiation strategy
   */
  async generateNegotiationStrategy(
    buyerPreferences: BuyerNegotiationContext
  ): Promise<NegotiationStrategy> {
    log('info', 'Generating negotiation strategy', {
      targetPrice: buyerPreferences.targetPrice,
      maxBudget: buyerPreferences.maxBudget,
      style: buyerPreferences.negotiationStyle,
    });

    const systemPrompt = `You are an expert procurement negotiation strategist. Generate a negotiation strategy based on the buyer's preferences and constraints.

Respond in JSON format only:
{
  "approach": "aggressive" | "balanced" | "conservative",
  "openingDiscount": number (0-30, percentage below target),
  "maxConcessions": number (1-5),
  "walkAwayThreshold": number (percentage above max budget to walk away),
  "keyLeveragePoints": string[],
  "suggestedTactics": string[],
  "riskAssessment": string
}`;

    const userPrompt = `Generate a negotiation strategy for these buyer preferences:

- Target Price: $${buyerPreferences.targetPrice.toFixed(2)}
- Maximum Budget: $${buyerPreferences.maxBudget.toFixed(2)}
- Maximum Lead Time: ${buyerPreferences.maxLeadTime} days
- Required Specifications: ${buyerPreferences.requiredSpecs.join(', ') || 'None'}
- Preferred Payment Terms: ${buyerPreferences.preferredPaymentTerms.join(', ')}
- Negotiation Style: ${buyerPreferences.negotiationStyle}
- Priority Factors: Price (${buyerPreferences.priorityFactors.price}), Lead Time (${buyerPreferences.priorityFactors.leadTime}), Quality (${buyerPreferences.priorityFactors.quality}), Reliability (${buyerPreferences.priorityFactors.reliability})

Consider:
1. The gap between target and max budget
2. How urgent the purchase is based on lead time requirements
3. Which factors are most important to the buyer
4. Appropriate opening position and concession strategy`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const textBlock = response.content.find(block => block.type === 'text');
      const text = textBlock?.type === 'text' ? textBlock.text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const strategy = JSON.parse(jsonMatch?.[0] || '{}') as NegotiationStrategy;

      // Validate and set defaults
      return {
        approach: strategy.approach || buyerPreferences.negotiationStyle,
        openingDiscount: Math.min(30, Math.max(0, strategy.openingDiscount || 15)),
        maxConcessions: Math.min(5, Math.max(1, strategy.maxConcessions || 3)),
        walkAwayThreshold: Math.min(20, Math.max(0, strategy.walkAwayThreshold || 10)),
        keyLeveragePoints: strategy.keyLeveragePoints || ['Volume commitment', 'Long-term partnership'],
        suggestedTactics: strategy.suggestedTactics || ['Start below target', 'Make incremental concessions'],
        riskAssessment: strategy.riskAssessment || 'Standard procurement risk profile.',
      };
    } catch (error) {
      log('error', 'Failed to generate strategy', {
        error: error instanceof Error ? error.message : 'Unknown',
      });

      // Return default strategy based on style
      return this.getDefaultStrategy(buyerPreferences);
    }
  }

  private getDefaultStrategy(preferences: BuyerNegotiationContext): NegotiationStrategy {
    const styleDefaults = {
      aggressive: { openingDiscount: 25, maxConcessions: 2, walkAwayThreshold: 5 },
      balanced: { openingDiscount: 15, maxConcessions: 4, walkAwayThreshold: 10 },
      conservative: { openingDiscount: 10, maxConcessions: 5, walkAwayThreshold: 15 },
    };

    const defaults = styleDefaults[preferences.negotiationStyle];

    return {
      approach: preferences.negotiationStyle,
      openingDiscount: defaults.openingDiscount,
      maxConcessions: defaults.maxConcessions,
      walkAwayThreshold: defaults.walkAwayThreshold,
      keyLeveragePoints: ['Volume commitment', 'Payment terms flexibility'],
      suggestedTactics: ['Start below target', 'Request value-adds before price concessions'],
      riskAssessment: 'Standard risk profile. Proceed with caution.',
    };
  }

  // ==========================================================================
  // SESSION MANAGEMENT
  // ==========================================================================

  /**
   * Get a multi-seller session by ID
   */
  async getMultiSellerSession(sessionId: string): Promise<MultiSellerNegotiationSession | null> {
    // Check memory cache first
    let session = this.activeSessions.get(sessionId);
    if (session) return session;

    // Load from database
    const result = await sql`
      SELECT * FROM multi_seller_negotiation_sessions
      WHERE id = ${sessionId}
    `;

    if (result.rows.length === 0) return null;

    session = this.mapMultiSellerSessionRow(result.rows[0]);
    this.activeSessions.set(sessionId, session);

    return session;
  }

  /**
   * Get session status summary
   */
  async getSessionStatus(sessionId: string): Promise<{
    sessionId: string;
    state: string;
    sellerCount: number;
    activeSellerCount: number;
    currentBestOffer: OfferSnapshot | null;
    roundsCompleted: number;
    expiresAt: string;
  } | null> {
    const session = await this.getMultiSellerSession(sessionId);
    if (!session) return null;

    const activeSellerCount = Array.from(session.sellerSessions.values())
      .filter(s => s.state !== 'accepted' && s.state !== 'rejected' && s.state !== 'expired')
      .length;

    const maxRound = Math.max(...Array.from(session.sellerSessions.values()).map(s => s.round));

    return {
      sessionId: session.id,
      state: session.state,
      sellerCount: session.sellerSessions.size,
      activeSellerCount,
      currentBestOffer: session.currentBestOffer,
      roundsCompleted: maxRound,
      expiresAt: session.expiresAt,
    };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private validateMessage(message: NegotiationMessage): void {
    if (!message.type) {
      throw new Error('Message type is required');
    }
    if (!message.fromAgent) {
      throw new Error('Message sender (fromAgent) is required');
    }
    if (!['rfq', 'quote', 'counter', 'accept', 'reject', 'clarification'].includes(message.type)) {
      throw new Error(`Invalid message type: ${message.type}`);
    }
  }

  private async generateSellerResponse(
    session: MultiSellerNegotiationSession,
    sellerState: SellerNegotiationState,
    buyerMessage: NegotiationMessage
  ): Promise<NegotiationMessage> {
    // Use AI to generate seller response
    const systemPrompt = `You are a supplier's AI negotiation agent for ${sellerState.sellerOrgName}.
You are negotiating with a buyer. Generate an appropriate response.

Respond in JSON:
{
  "type": "quote" | "counter" | "accept" | "reject",
  "totalAmount": number,
  "leadTimeDays": number,
  "paymentTerms": string,
  "reasoning": string
}`;

    const historyText = sellerState.messages
      .slice(-5)
      .map(m => `${m.fromAgent}: ${m.type} - ${m.payload.reasoning || ''}`)
      .join('\n');

    const userPrompt = `Buyer's message: ${buyerMessage.type}
Requested amount: $${buyerMessage.payload.totalAmount || 'TBD'}
History:
${historyText}

Current round: ${sellerState.round}

Generate your response as the seller. Be professional and aim to close the deal while protecting margins.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const textBlock = response.content.find(block => block.type === 'text');
      const text = textBlock?.type === 'text' ? textBlock.text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] || '{}');

      return {
        type: parsed.type || 'counter',
        fromAgent: 'seller_wells',
        payload: {
          totalAmount: parsed.totalAmount,
          terms: {
            paymentTerms: parsed.paymentTerms || 'Net 30',
            currency: 'USD',
            shippingCost: 0,
          },
          reasoning: parsed.reasoning,
        },
        timestamp: new Date().toISOString(),
        sessionId: session.id,
        messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      };
    } catch (error) {
      // Fallback response
      return {
        type: 'counter',
        fromAgent: 'seller_wells',
        payload: {
          totalAmount: (buyerMessage.payload.totalAmount || 0) * 1.1,
          terms: {
            paymentTerms: 'Net 30',
            currency: 'USD',
            shippingCost: 0,
          },
          reasoning: 'Counter-offer based on our standard pricing.',
        },
        timestamp: new Date().toISOString(),
        sessionId: session.id,
        messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      };
    }
  }

  private async processSellerResponse(
    session: MultiSellerNegotiationSession,
    sellerState: SellerNegotiationState,
    response: NegotiationMessage
  ): Promise<void> {
    // Add to messages
    sellerState.messages.push(response);

    // Update state based on response type
    switch (response.type) {
      case 'quote':
      case 'counter':
        sellerState.state = 'counter_received';

        // Create offer snapshot
        const offer: OfferSnapshot = {
          sellerId: sellerState.sellerId,
          sellerName: sellerState.sellerOrgName,
          items: response.payload.items || [],
          totalAmount: response.payload.totalAmount || 0,
          terms: response.payload.terms || {
            paymentTerms: 'Net 30',
            currency: 'USD',
            shippingCost: 0,
          },
          leadTimeDays: 14, // Default
          validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          timestamp: response.timestamp,
          round: sellerState.round,
        };

        sellerState.currentOffer = offer;
        sellerState.counterHistory.push(offer);
        session.offerHistory.push(offer);

        // Update best offer if this is better
        if (!session.currentBestOffer || offer.totalAmount < session.currentBestOffer.totalAmount) {
          session.currentBestOffer = offer;
        }
        break;

      case 'accept':
        sellerState.state = 'accepted';
        break;

      case 'reject':
        sellerState.state = 'rejected';
        break;
    }

    sellerState.lastActivityAt = new Date().toISOString();
  }

  private async determineBuyerAction(
    session: MultiSellerNegotiationSession
  ): Promise<{
    action: 'counter' | 'accept' | 'reject' | 'evaluate' | null;
    nextMessage?: NegotiationMessage;
  }> {
    // Collect all current offers
    const activeOffers = Array.from(session.sellerSessions.values())
      .filter(s => s.currentOffer && s.state !== 'rejected')
      .map(s => s.currentOffer!);

    if (activeOffers.length === 0) {
      return { action: null };
    }

    // Check if any offer meets our target
    const acceptableOffers = activeOffers.filter(
      o => o.totalAmount <= session.buyerContext.targetPrice
    );

    if (acceptableOffers.length > 0) {
      // Find best acceptable offer
      const best = acceptableOffers.reduce((a, b) =>
        a.totalAmount < b.totalAmount ? a : b
      );

      return {
        action: 'accept',
        nextMessage: {
          type: 'accept',
          fromAgent: 'buyer_wells',
          payload: {
            totalAmount: best.totalAmount,
            reasoning: 'Offer meets our requirements.',
          },
          timestamp: new Date().toISOString(),
          sessionId: session.id,
          messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        },
      };
    }

    // Check if best offer is within budget but above target
    const bestOffer = activeOffers.reduce((a, b) =>
      a.totalAmount < b.totalAmount ? a : b
    );

    if (bestOffer.totalAmount <= session.buyerContext.maxBudget) {
      // Counter-offer
      const counterAmount = (bestOffer.totalAmount + session.buyerContext.targetPrice) / 2;

      return {
        action: 'counter',
        nextMessage: {
          type: 'counter',
          fromAgent: 'buyer_wells',
          payload: {
            totalAmount: counterAmount,
            reasoning: `Counter-offer to move toward our target of $${session.buyerContext.targetPrice.toFixed(2)}.`,
          },
          timestamp: new Date().toISOString(),
          sessionId: session.id,
          messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        },
      };
    }

    // All offers above budget - need evaluation
    return { action: 'evaluate' };
  }

  // ==========================================================================
  // DATABASE OPERATIONS
  // ==========================================================================

  private async persistMultiSellerSession(session: MultiSellerNegotiationSession): Promise<void> {
    // Convert Map to object for JSON storage
    const sellerSessionsObj: Record<string, SellerNegotiationState> = {};
    for (const [key, value] of session.sellerSessions) {
      sellerSessionsObj[key] = value;
    }

    await sql`
      INSERT INTO multi_seller_negotiation_sessions (
        id,
        rfq_id,
        buyer_wells_id,
        buyer_org_id,
        buyer_org_name,
        seller_sessions,
        current_best_offer,
        offer_history,
        state,
        buyer_context,
        created_at,
        updated_at,
        expires_at,
        decided_at,
        selected_seller_id
      ) VALUES (
        ${session.id},
        ${session.rfqId},
        ${session.buyerWellsId},
        ${session.buyerOrgId},
        ${session.buyerOrgName},
        ${JSON.stringify(sellerSessionsObj)},
        ${session.currentBestOffer ? JSON.stringify(session.currentBestOffer) : null},
        ${JSON.stringify(session.offerHistory)},
        ${session.state},
        ${JSON.stringify(session.buyerContext)},
        ${session.createdAt},
        ${session.updatedAt},
        ${session.expiresAt},
        ${session.decidedAt || null},
        ${session.selectedSellerId || null}
      )
      ON CONFLICT (id) DO UPDATE SET
        seller_sessions = EXCLUDED.seller_sessions,
        current_best_offer = EXCLUDED.current_best_offer,
        offer_history = EXCLUDED.offer_history,
        state = EXCLUDED.state,
        updated_at = EXCLUDED.updated_at,
        decided_at = EXCLUDED.decided_at,
        selected_seller_id = EXCLUDED.selected_seller_id
    `;
  }

  private mapMultiSellerSessionRow(row: Record<string, unknown>): MultiSellerNegotiationSession {
    const sellerSessionsObj = row.seller_sessions as Record<string, SellerNegotiationState>;
    const sellerSessions = new Map<string, SellerNegotiationState>();
    for (const [key, value] of Object.entries(sellerSessionsObj)) {
      sellerSessions.set(key, value);
    }

    return {
      id: row.id as string,
      rfqId: row.rfq_id as string,
      buyerWellsId: row.buyer_wells_id as string,
      buyerOrgId: row.buyer_org_id as string,
      buyerOrgName: row.buyer_org_name as string,
      sellerSessions,
      currentBestOffer: row.current_best_offer as OfferSnapshot | null,
      offerHistory: (row.offer_history as OfferSnapshot[]) || [],
      state: row.state as 'active' | 'decided' | 'expired' | 'cancelled',
      buyerContext: row.buyer_context as BuyerNegotiationContext,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      expiresAt: row.expires_at as string,
      decidedAt: row.decided_at as string | undefined,
      selectedSellerId: row.selected_seller_id as string | undefined,
    };
  }

  private async createAwardRecord(
    session: MultiSellerNegotiationSession,
    sellerState: SellerNegotiationState,
    offer: OfferSnapshot,
    awardId: string
  ): Promise<void> {
    await sql`
      INSERT INTO rfq_awards (
        id,
        rfq_id,
        supplier_id,
        negotiation_id,
        award_amount,
        award_quantity,
        award_unit_price,
        award_terms,
        status,
        awarded_at
      ) VALUES (
        ${awardId},
        ${session.rfqId},
        ${sellerState.sellerId},
        ${session.id},
        ${offer.totalAmount},
        ${offer.items.reduce((sum, item) => sum + item.quantity, 0) || 1},
        ${offer.items[0]?.unitPrice || offer.totalAmount},
        ${JSON.stringify(offer.terms)},
        'awarded',
        NOW()
      )
    `;
  }

  private async recordNegotiationEvent(
    sessionId: string,
    eventType: string,
    details: Record<string, unknown>
  ): Promise<void> {
    try {
      await sql`
        INSERT INTO negotiation_audit_log (
          session_id,
          event_type,
          details,
          created_at
        ) VALUES (
          ${sessionId},
          ${eventType},
          ${JSON.stringify(details)},
          NOW()
        )
      `;
    } catch (error) {
      // Don't fail main operation if audit logging fails
      log('warn', 'Failed to record audit event', {
        sessionId,
        eventType,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  private async triggerERPWriteback(rfqId: string, awardId: string): Promise<void> {
    // Import and call the ERP sync service
    try {
      const { syncAwardToERP } = await import('../rfq/erp-sync');
      await syncAwardToERP(awardId);
      log('info', 'ERP write-back triggered', { rfqId, awardId });
    } catch (error) {
      log('error', 'ERP write-back failed', {
        rfqId,
        awardId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      throw error;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let _aiToAiRouter: AIToAIRouter | null = null;

/**
 * Get the singleton AIToAIRouter instance
 */
export function getAIToAIRouter(): AIToAIRouter {
  if (!_aiToAiRouter) {
    _aiToAiRouter = new AIToAIRouter();
  }
  return _aiToAiRouter;
}

// ============================================================================
// SELLER AGENT REGISTRY
// ============================================================================

/**
 * Find seller agents that match an RFQ
 */
export async function findMatchingSellerAgents(
  request: RoutingRequest
): Promise<RoutingResult> {
  log('info', 'Finding matching seller agents', {
    rfqId: request.rfqId,
    category: request.category,
    quantity: request.quantity,
  });

  // Get supplier matches using existing matching system
  const matchResult = await matchSuppliersToRequest({
    category: request.category,
    description: request.description,
    quantity: request.quantity,
    targetPrice: request.targetPrice,
    urgency: request.urgency,
    deliveryLocation: request.deliveryLocation,
    requiredCertifications: request.requiredCertifications,
  });

  // Convert supplier matches to seller agent matches
  const matchedAgents: SellerAgentMatch[] = matchResult.matches
    .slice(0, request.preferences.maxSellers)
    .map(match => ({
      agent: supplierToAgentRegistration(match.supplier),
      matchScore: match.matchScore,
      estimatedPrice: estimateInitialPrice(match.supplier, request.quantity),
      estimatedLeadTime: match.estimatedLeadTime || match.supplier.leadTime,
      matchReasons: match.strengths || [],
      concerns: match.concerns || [],
    }));

  // Filter out excluded suppliers
  const filteredAgents = matchedAgents.filter(
    m => !request.preferences.excludedSuppliers?.includes(m.agent.supplierId)
  );

  // Prioritize preferred suppliers
  if (request.preferences.preferredSuppliers?.length) {
    filteredAgents.sort((a, b) => {
      const aPreferred = request.preferences.preferredSuppliers?.includes(a.agent.supplierId) ? 1 : 0;
      const bPreferred = request.preferences.preferredSuppliers?.includes(b.agent.supplierId) ? 1 : 0;
      return bPreferred - aPreferred;
    });
  }

  log('info', 'Found matching seller agents', {
    totalConsidered: matchResult.totalSuppliersConsidered,
    matched: filteredAgents.length,
  });

  return {
    matchedAgents: filteredAgents,
    totalConsidered: matchResult.totalSuppliersConsidered,
    routedAt: new Date().toISOString(),
  };
}

function supplierToAgentRegistration(supplier: any): SellerAgentRegistration {
  return {
    agentId: `seller_${supplier.id}`,
    supplierId: supplier.id,
    organizationName: supplier.companyName,
    categories: supplier.products || [],
    certifications: supplier.certifications || [],
    active: supplier.status === 'active',
    pricingRules: {
      baseMargin: 25, // Default 25% margin
      minMargin: 10,  // Minimum 10% margin
      volumeDiscounts: supplier.pricing?.volumeDiscounts || [],
      rushFeePercentage: 15,
    },
    capacityConstraints: {
      maxMonthlyVolume: supplier.capacity?.monthlyVolume || 10000,
      currentUtilization: 0.6, // Assume 60% utilization
      leadTimeDays: supplier.leadTime || 14,
      rushLeadTimeDays: Math.ceil((supplier.leadTime || 14) / 2),
    },
    registeredAt: supplier.createdAt || new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };
}

function estimateInitialPrice(supplier: any, quantity: number): number {
  const basePrice = supplier.pricing?.basePrice || 10;
  let price = basePrice;

  // Apply volume discounts
  if (supplier.pricing?.volumeDiscounts) {
    for (const discount of supplier.pricing.volumeDiscounts) {
      if (quantity >= discount.minQuantity) {
        price = basePrice * (1 - discount.discountPercentage / 100);
      }
    }
  }

  return price * quantity;
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Create a new negotiation session between buyer and seller agents
 */
export async function createNegotiationSession(params: {
  rfqId: string;
  quoteId: string;
  buyerOrgId: string;
  buyerOrgName: string;
  buyerConstraints: TermConstraints;
  sellerAgent: SellerAgentRegistration;
  initialTerms: NegotiationTerms;
  subject: string;
  maxRounds?: number;
}): Promise<NegotiationSession> {
  log('info', 'Creating negotiation session', {
    rfqId: params.rfqId,
    buyerOrg: params.buyerOrgName,
    sellerOrg: params.sellerAgent.organizationName,
  });

  const buyerAgent: AgentIdentity = {
    agentType: 'buyer',
    agentId: `buyer_${params.buyerOrgId}`,
    organizationId: params.buyerOrgId,
    organizationName: params.buyerOrgName,
    autonomous: true,
    limits: {
      priceBoundary: params.buyerConstraints.unitPriceBound * params.initialTerms.quantity,
      maxQuantity: params.initialTerms.quantity,
      leadTimeBoundary: params.buyerConstraints.leadTimeBound,
      acceptablePaymentTerms: ['Net 30', 'Net 45', 'Net 60'],
      certifications: params.buyerConstraints.nonNegotiable,
      autoApproveEnabled: true,
      escalationThreshold: 20, // Escalate if >20% over budget
    },
  };

  const sellerAgent: AgentIdentity = {
    agentType: 'seller',
    agentId: params.sellerAgent.agentId,
    organizationId: params.sellerAgent.supplierId,
    organizationName: params.sellerAgent.organizationName,
    autonomous: true,
    limits: {
      priceBoundary: params.initialTerms.unitPrice * params.initialTerms.quantity * 0.85, // 15% max discount
      maxQuantity: params.sellerAgent.capacityConstraints.maxMonthlyVolume,
      leadTimeBoundary: params.sellerAgent.capacityConstraints.leadTimeDays,
      acceptablePaymentTerms: ['Net 30', 'Net 45'],
      certifications: params.sellerAgent.certifications,
      autoApproveEnabled: true,
      escalationThreshold: 15, // Escalate if margin below 15%
    },
  };

  const session = createInitialSession({
    rfqId: params.rfqId,
    quoteId: params.quoteId,
    buyerAgent,
    sellerAgent,
    subject: params.subject,
    initialTerms: params.initialTerms,
    maxRounds: params.maxRounds || DEFAULT_MAX_ROUNDS,
    expirationMinutes: 30,
  });

  // Persist session to database
  await persistSession(session);

  log('info', 'Negotiation session created', { sessionId: session.id });

  return session;
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string): Promise<NegotiationSession | null> {
  const result = await sql`
    SELECT * FROM negotiation_sessions
    WHERE id = ${sessionId}
  `;

  if (result.rows.length === 0) return null;
  return mapSessionRow(result.rows[0]);
}

/**
 * Get active sessions for an RFQ
 */
export async function getSessionsByRFQ(rfqId: string): Promise<NegotiationSession[]> {
  const result = await sql`
    SELECT * FROM negotiation_sessions
    WHERE rfq_id = ${rfqId}
    ORDER BY created_at DESC
  `;

  return result.rows.map(mapSessionRow);
}

/**
 * Persist session to database
 */
async function persistSession(session: NegotiationSession): Promise<void> {
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

/**
 * Update session in database
 */
async function updateSession(session: NegotiationSession): Promise<void> {
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

function mapSessionRow(row: Record<string, unknown>): NegotiationSession {
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
// MESSAGE ROUTING
// ============================================================================

/**
 * Route a message between agents and get response
 */
export async function routeMessage(
  session: NegotiationSession,
  message: NegotiationProtocolMessage
): Promise<{
  session: NegotiationSession;
  response: NegotiationProtocolMessage | null;
  escalation: EscalationResult | null;
}> {
  log('info', 'Routing message', {
    sessionId: session.id,
    from: message.sender.agentType,
    type: message.type,
    round: message.round,
  });

  // Validate message
  if (message.terms) {
    const validation = validateTerms(message.terms);
    if (!validation.valid) {
      log('error', 'Invalid terms in message', { errors: validation.errors });
      throw new Error(`Invalid terms: ${validation.errors.join(', ')}`);
    }
  }

  // Add message to session
  session.messages.push(message);
  session.lastActivityAt = new Date().toISOString();

  // Update current terms if this is a proposal/counter
  if (message.terms && (message.type === 'proposal' || message.type === 'counter')) {
    session.currentTerms = message.terms;
  }

  // Record message for audit
  await recordMessage(session.id, message);

  // Check for escalation triggers
  const escalation = await checkEscalationTriggers(session, message);
  if (escalation.shouldEscalate) {
    log('warn', 'Escalation triggered', {
      sessionId: session.id,
      reason: escalation.reason,
    });
    session.status = 'awaiting_human';
    await updateSession(session);
    return { session, response: null, escalation };
  }

  // Handle different message types
  let response: NegotiationProtocolMessage | null = null;

  switch (message.type) {
    case 'accept':
      session.status = 'agreed';
      session.finalTerms = session.currentTerms;
      session.completedAt = new Date().toISOString();
      session.analytics.agreementReached = true;
      session.analytics.priceReduction =
        session.initialTerms.totalPrice - (session.finalTerms?.totalPrice || 0);
      session.analytics.reductionPercentage =
        (session.analytics.priceReduction / session.initialTerms.totalPrice) * 100;
      session.analytics.timeToAgreementMs =
        new Date(session.completedAt).getTime() - new Date(session.createdAt).getTime();
      break;

    case 'reject':
      session.status = 'rejected';
      session.completedAt = new Date().toISOString();
      break;

    case 'proposal':
    case 'counter':
      // Generate response from the other agent
      const respondingAgent =
        message.sender.agentType === 'buyer' ? session.sellerAgent : session.buyerAgent;
      response = await generateAgentResponse(session, message, respondingAgent);

      if (response) {
        session.messages.push(response);
        if (response.terms) {
          session.currentTerms = response.terms;
        }
        await recordMessage(session.id, response);

        // Check if we should advance the round
        if (message.sender.agentType === 'buyer' && response.type !== 'accept') {
          session.currentRound++;
          session.analytics.roundsUsed = session.currentRound;
        }
      }
      break;

    case 'escalate':
    case 'hold':
      session.status = 'awaiting_human';
      break;

    case 'resume':
      session.status = 'active';
      break;
  }

  // Check for stalemate
  if (session.currentRound >= session.maxRounds && session.status === 'active') {
    session.status = 'stalemate';
    session.completedAt = new Date().toISOString();
  }

  // Check for timeout
  if (new Date().toISOString() > session.expiresAt && session.status === 'active') {
    session.status = 'expired';
    session.completedAt = new Date().toISOString();
  }

  await updateSession(session);

  return { session, response, escalation: null };
}

// ============================================================================
// AI RESPONSE GENERATION
// ============================================================================

/**
 * Generate an AI response for an agent
 */
async function generateAgentResponse(
  session: NegotiationSession,
  incomingMessage: NegotiationProtocolMessage,
  respondingAgent: AgentIdentity
): Promise<NegotiationProtocolMessage | null> {
  const isSellerResponse = respondingAgent.agentType === 'seller';
  const otherAgent = isSellerResponse ? session.buyerAgent : session.sellerAgent;

  // Build context for AI
  const negotiationHistory = session.messages
    .map(m => `Round ${m.round} - ${m.sender.agentType}: ${m.message} (${m.type})`)
    .join('\n');

  const systemPrompt = buildAgentSystemPrompt(respondingAgent, otherAgent, session);

  const userPrompt = `
Current Negotiation State:
- Round: ${session.currentRound} / ${session.maxRounds}
- Initial Price: $${session.initialTerms.totalPrice.toFixed(2)}
- Current Offer: $${incomingMessage.terms?.totalPrice.toFixed(2) || 'N/A'}
- Your Price Boundary: $${respondingAgent.limits.priceBoundary.toFixed(2)}

Negotiation History:
${negotiationHistory}

The ${otherAgent.agentType} just said:
"${incomingMessage.message}"

Their proposed terms:
${JSON.stringify(incomingMessage.terms, null, 2)}

Generate your response. You must:
1. Evaluate if these terms are acceptable
2. If not acceptable, generate a counter-offer that moves toward agreement
3. Provide clear reasoning

Respond in JSON:
{
  "decision": "accept" | "counter" | "reject",
  "counterTerms": { ... } // only if decision is "counter"
  "message": "What you say to the other party",
  "reasoning": "Your internal reasoning",
  "confidence": 0-100
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = response.content.find(block => block.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '{}';

    // Parse response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] || '{}');

    // Build response message
    let messageType: NegotiationProtocolMessage['type'];
    let responseTerms: NegotiationTerms | null = null;

    if (parsed.decision === 'accept') {
      messageType = 'accept';
      responseTerms = incomingMessage.terms;
    } else if (parsed.decision === 'reject') {
      messageType = 'reject';
    } else {
      messageType = 'counter';
      responseTerms = parsed.counterTerms || incomingMessage.terms;

      // Ensure counter terms are valid
      if (responseTerms && isSellerResponse) {
        // Seller should not go below their floor
        const floor = respondingAgent.limits.priceBoundary;
        if (responseTerms.totalPrice < floor) {
          responseTerms.totalPrice = floor;
          responseTerms.unitPrice = floor / responseTerms.quantity;
        }
      } else if (responseTerms && !isSellerResponse) {
        // Buyer should not go above their ceiling
        const ceiling = respondingAgent.limits.priceBoundary;
        if (responseTerms.totalPrice > ceiling) {
          responseTerms.totalPrice = ceiling;
          responseTerms.unitPrice = ceiling / responseTerms.quantity;
        }
      }
    }

    return createProtocolMessage({
      sessionId: session.id,
      round: session.currentRound,
      sender: respondingAgent,
      type: messageType,
      terms: responseTerms,
      constraints: {
        unitPriceBound: respondingAgent.limits.priceBoundary / (responseTerms?.quantity || 1),
        isHardLimit: true,
        nonNegotiable: respondingAgent.limits.certifications,
        flexible: ['paymentTerms', 'leadTimeDays'],
      },
      message: parsed.message || 'Thank you for your proposal.',
      internalReasoning: parsed.reasoning,
      confidence: parsed.confidence || 75,
      inResponseTo: incomingMessage.messageId,
    });
  } catch (error) {
    log('error', 'Failed to generate AI response', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Fallback: generate simple counter-offer
    return generateFallbackResponse(session, incomingMessage, respondingAgent);
  }
}

function buildAgentSystemPrompt(
  agent: AgentIdentity,
  otherAgent: AgentIdentity,
  session: NegotiationSession
): string {
  const isSellerAgent = agent.agentType === 'seller';

  return `You are an AI negotiation agent representing ${agent.organizationName}.
You are ${isSellerAgent ? 'selling' : 'buying'} "${session.subject}".

Your Organization: ${agent.organizationName}
Your Role: ${agent.agentType.toUpperCase()} Agent
Counterparty: ${otherAgent.organizationName}

Your Constraints:
- ${isSellerAgent ? 'Minimum acceptable total' : 'Maximum budget'}: $${agent.limits.priceBoundary.toFixed(2)}
- Acceptable payment terms: ${agent.limits.acceptablePaymentTerms.join(', ')}
- Required certifications: ${agent.limits.certifications.join(', ') || 'None'}

Negotiation Guidelines:
1. ${isSellerAgent ?
    'Start high but be willing to negotiate. Never go below your floor price.' :
    'Start low but be willing to pay fair value. Never exceed your budget.'}
2. Be professional and build rapport
3. Make meaningful concessions that move toward agreement
4. Accept if terms are within your acceptable range
5. Reject only if terms are clearly unacceptable with no path forward
6. Current round: ${session.currentRound}/${session.maxRounds}

Remember: You want to close this deal if the terms are reasonable.`;
}

function generateFallbackResponse(
  session: NegotiationSession,
  incomingMessage: NegotiationProtocolMessage,
  respondingAgent: AgentIdentity
): NegotiationProtocolMessage {
  const isSellerAgent = respondingAgent.agentType === 'seller';
  const incomingTerms = incomingMessage.terms!;
  const floor = respondingAgent.limits.priceBoundary;

  // Check if we should accept
  if (isSellerAgent) {
    if (incomingTerms.totalPrice >= floor) {
      return createProtocolMessage({
        sessionId: session.id,
        round: session.currentRound,
        sender: respondingAgent,
        type: 'accept',
        terms: incomingTerms,
        constraints: {
          unitPriceBound: floor / incomingTerms.quantity,
          isHardLimit: true,
          nonNegotiable: [],
          flexible: [],
        },
        message: `We accept your offer of $${incomingTerms.totalPrice.toFixed(2)}. Thank you for your business.`,
        confidence: 90,
        inResponseTo: incomingMessage.messageId,
      });
    }
  } else {
    if (incomingTerms.totalPrice <= floor) {
      return createProtocolMessage({
        sessionId: session.id,
        round: session.currentRound,
        sender: respondingAgent,
        type: 'accept',
        terms: incomingTerms,
        constraints: {
          unitPriceBound: floor / incomingTerms.quantity,
          isHardLimit: true,
          nonNegotiable: [],
          flexible: [],
        },
        message: `We accept your offer of $${incomingTerms.totalPrice.toFixed(2)}. Let's proceed.`,
        confidence: 90,
        inResponseTo: incomingMessage.messageId,
      });
    }
  }

  // Generate counter-offer
  const gap = Math.abs(incomingTerms.totalPrice - floor);
  const concession = gap * 0.3; // Move 30% toward counterparty
  let counterPrice: number;

  if (isSellerAgent) {
    counterPrice = Math.max(floor, incomingTerms.totalPrice + concession * 0.5);
  } else {
    counterPrice = Math.min(floor, incomingTerms.totalPrice - concession * 0.5);
  }

  const counterTerms: NegotiationTerms = {
    ...incomingTerms,
    totalPrice: Math.round(counterPrice * 100) / 100,
    unitPrice: Math.round((counterPrice / incomingTerms.quantity) * 100) / 100,
  };

  return createProtocolMessage({
    sessionId: session.id,
    round: session.currentRound,
    sender: respondingAgent,
    type: 'counter',
    terms: counterTerms,
    constraints: {
      unitPriceBound: floor / incomingTerms.quantity,
      isHardLimit: true,
      nonNegotiable: [],
      flexible: ['paymentTerms'],
    },
    message: `We appreciate your offer. We can do $${counterTerms.totalPrice.toFixed(2)} for this order.`,
    confidence: 70,
    inResponseTo: incomingMessage.messageId,
  });
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

async function recordMessage(
  sessionId: string,
  message: NegotiationProtocolMessage
): Promise<void> {
  await sql`
    INSERT INTO negotiation_messages (
      id,
      session_id,
      message_id,
      round,
      sender_type,
      sender_org_id,
      sender_org_name,
      message_type,
      terms,
      constraints,
      message_text,
      internal_reasoning,
      requires_escalation,
      escalation_reason,
      confidence,
      in_response_to,
      metadata,
      created_at
    ) VALUES (
      gen_random_uuid(),
      ${sessionId},
      ${message.messageId},
      ${message.round},
      ${message.sender.agentType},
      ${message.sender.organizationId},
      ${message.sender.organizationName},
      ${message.type},
      ${message.terms ? JSON.stringify(message.terms) : null},
      ${JSON.stringify(message.constraints)},
      ${message.message},
      ${message.internalReasoning || null},
      ${message.requiresEscalation},
      ${message.escalationReason || null},
      ${message.confidence},
      ${message.inResponseTo || null},
      ${message.metadata ? JSON.stringify(message.metadata) : null},
      ${message.timestamp}
    )
  `;
}

// ============================================================================
// FULL NEGOTIATION RUNNER
// ============================================================================

/**
 * Run a complete negotiation session from start to finish
 */
export async function runFullNegotiation(
  session: NegotiationSession
): Promise<{
  session: NegotiationSession;
  success: boolean;
  summary: string;
}> {
  log('info', 'Starting full negotiation run', { sessionId: session.id });

  session.status = 'active';
  await updateSession(session);

  // Generate initial proposal from buyer
  const buyerInitialMessage = createProtocolMessage({
    sessionId: session.id,
    round: 1,
    sender: session.buyerAgent,
    type: 'proposal',
    terms: generateBuyerInitialOffer(session),
    constraints: {
      unitPriceBound: session.buyerAgent.limits.priceBoundary / session.initialTerms.quantity,
      isHardLimit: false,
      nonNegotiable: session.buyerAgent.limits.certifications,
      flexible: ['paymentTerms', 'shippingMethod'],
    },
    message: `We're interested in ${session.subject}. Based on our requirements, we'd like to propose the following terms.`,
    confidence: 85,
  });

  session.currentRound = 1;

  // Run negotiation loop
  let currentMessage = buyerInitialMessage;
  let lastResult: Awaited<ReturnType<typeof routeMessage>>;

  while (session.status === 'active' && session.currentRound <= session.maxRounds) {
    lastResult = await routeMessage(session, currentMessage);
    session = lastResult.session;

    if (lastResult.escalation?.shouldEscalate) {
      log('info', 'Negotiation paused for escalation', { sessionId: session.id });
      break;
    }

    if (!lastResult.response) {
      break; // Session ended (accept/reject)
    }

    // If seller responded with counter, buyer needs to respond
    if (lastResult.response.type === 'counter') {
      const buyerResponse = await generateAgentResponse(
        session,
        lastResult.response,
        session.buyerAgent
      );

      if (buyerResponse) {
        currentMessage = buyerResponse;
      } else {
        break;
      }
    } else {
      break; // Accept or reject
    }
  }

  // Generate summary
  const summary = generateNegotiationSummary(session);

  log('info', 'Full negotiation complete', {
    sessionId: session.id,
    status: session.status,
    rounds: session.currentRound,
  });

  return {
    session,
    success: session.status === 'agreed',
    summary,
  };
}

function generateBuyerInitialOffer(session: NegotiationSession): NegotiationTerms {
  const initial = session.initialTerms;
  const targetDiscount = 0.15; // Start 15% below initial

  return {
    ...initial,
    unitPrice: initial.unitPrice * (1 - targetDiscount),
    totalPrice: initial.totalPrice * (1 - targetDiscount),
  };
}

function generateNegotiationSummary(session: NegotiationSession): string {
  const initial = session.initialTerms.totalPrice;
  const final = session.finalTerms?.totalPrice || session.currentTerms?.totalPrice || initial;
  const reduction = initial - final;
  const percent = (reduction / initial) * 100;

  switch (session.status) {
    case 'agreed':
      if (reduction > 0) {
        return `Agreement reached! Achieved ${percent.toFixed(1)}% savings ($${reduction.toFixed(2)}) in ${session.currentRound} round(s). Final price: $${final.toFixed(2)}`;
      }
      return `Agreement reached at $${final.toFixed(2)} after ${session.currentRound} round(s).`;

    case 'rejected':
      return `Negotiation ended without agreement. Counterparty rejected the terms.`;

    case 'stalemate':
      return `Negotiation reached stalemate after ${session.maxRounds} rounds. No agreement reached.`;

    case 'expired':
      return `Negotiation expired before reaching agreement.`;

    case 'awaiting_human':
      return `Negotiation paused for human review at round ${session.currentRound}.`;

    default:
      return `Negotiation in progress. Current round: ${session.currentRound}/${session.maxRounds}`;
  }
}

// ============================================================================
// CONVERSATIONAL INTERFACE
// ============================================================================

/**
 * Process a conversational request and initiate negotiation
 * This is called when a user says something like "find me a supplier for 1000 ball bearings"
 */
export async function processConversationalRequest(
  userId: string,
  organizationId: string,
  organizationName: string,
  request: string
): Promise<{
  rfqId: string;
  sessions: NegotiationSession[];
  statusMessage: string;
}> {
  log('info', 'Processing conversational request', { userId, request });

  // Parse the request using AI
  const parsedRequest = await parseNaturalLanguageRequest(request);

  if (!parsedRequest) {
    throw new Error('Could not understand the request. Please specify what you need.');
  }

  // Create RFQ from parsed request
  const rfqResult = await sql`
    INSERT INTO rfqs (
      category,
      description,
      quantity,
      target_price,
      urgency,
      delivery_location,
      required_certifications,
      requestor_email,
      status
    ) VALUES (
      ${parsedRequest.category},
      ${parsedRequest.description},
      ${parsedRequest.quantity},
      ${parsedRequest.targetPrice || null},
      ${parsedRequest.urgency || 'standard'},
      ${parsedRequest.deliveryLocation || 'TBD'},
      ${parsedRequest.certifications || []},
      ${userId},
      'matched'
    )
    RETURNING id
  `;

  const rfqId = rfqResult.rows[0].id;

  // Find matching sellers
  const routingResult = await findMatchingSellerAgents({
    rfqId,
    category: parsedRequest.category,
    description: parsedRequest.description,
    quantity: parsedRequest.quantity,
    targetPrice: parsedRequest.targetPrice,
    urgency: parsedRequest.urgency || 'standard',
    requiredCertifications: parsedRequest.certifications || [],
    deliveryLocation: parsedRequest.deliveryLocation || 'TBD',
    buyerAgent: {
      agentType: 'buyer',
      agentId: `buyer_${organizationId}`,
      organizationId,
      organizationName,
      autonomous: true,
      limits: {
        priceBoundary: parsedRequest.targetPrice || parsedRequest.quantity * 100,
        acceptablePaymentTerms: ['Net 30', 'Net 45'],
        certifications: parsedRequest.certifications || [],
        autoApproveEnabled: true,
        escalationThreshold: 20,
      },
    },
    preferences: {
      maxSellers: 5,
      prioritizePrice: true,
      prioritizeSpeed: false,
    },
  });

  if (routingResult.matchedAgents.length === 0) {
    return {
      rfqId,
      sessions: [],
      statusMessage: `I couldn't find any suppliers for ${parsedRequest.description}. Would you like me to expand the search?`,
    };
  }

  // Create negotiation sessions with top matches
  const sessions: NegotiationSession[] = [];
  const topMatches = routingResult.matchedAgents.slice(0, 3);

  for (const match of topMatches) {
    const initialTerms: NegotiationTerms = {
      unitPrice: match.estimatedPrice / parsedRequest.quantity,
      quantity: parsedRequest.quantity,
      totalPrice: match.estimatedPrice,
      currency: 'USD',
      leadTimeDays: match.estimatedLeadTime,
      paymentTerms: 'Net 30',
      shippingCost: 0,
    };

    const session = await createNegotiationSession({
      rfqId,
      quoteId: `quote_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      buyerOrgId: organizationId,
      buyerOrgName: organizationName,
      buyerConstraints: {
        unitPriceBound: parsedRequest.targetPrice
          ? parsedRequest.targetPrice / parsedRequest.quantity
          : initialTerms.unitPrice * 0.85,
        isHardLimit: false,
        nonNegotiable: parsedRequest.certifications || [],
        flexible: ['paymentTerms', 'leadTimeDays'],
      },
      sellerAgent: match.agent,
      initialTerms,
      subject: parsedRequest.description,
    });

    sessions.push(session);
  }

  const statusMessage = `I'm negotiating with ${sessions.length} supplier${sessions.length > 1 ? 's' : ''} for ${parsedRequest.quantity} ${parsedRequest.description}. I'll update you as I get offers.`;

  return {
    rfqId,
    sessions,
    statusMessage,
  };
}

async function parseNaturalLanguageRequest(request: string): Promise<{
  category: string;
  description: string;
  quantity: number;
  targetPrice?: number;
  urgency?: 'standard' | 'urgent' | 'critical';
  deliveryLocation?: string;
  certifications?: string[];
} | null> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: `You parse procurement requests into structured data. Extract:
- category: product category
- description: what they want
- quantity: how many (number only)
- targetPrice: budget if mentioned (number only, no $ sign)
- urgency: standard, urgent, or critical
- deliveryLocation: where to deliver
- certifications: required certs

Respond in JSON only. If you can't determine quantity, default to 1.`,
      messages: [{ role: 'user', content: request }],
    });

    const textBlock = response.content.find(block => block.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch?.[0] || 'null');
  } catch (error) {
    log('error', 'Failed to parse natural language request', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return null;
  }
}

// ============================================================================
// CHAT STREAMING INTEGRATION
// ============================================================================

/**
 * Chat update types for real-time UI updates
 */
export interface NegotiationChatUpdate {
  type: 'start' | 'round' | 'complete' | 'escalation' | 'error';
  sessionId: string;
  supplierName: string;
  round?: number;
  maxRounds?: number;
  buyerOffer?: {
    price: number;
    message: string;
  };
  sellerResponse?: {
    price: number;
    message: string;
    type: 'counter' | 'accept' | 'reject';
  };
  status: string;
  agreementReached?: boolean;
  finalPrice?: number;
  savings?: {
    amount: number;
    percentage: number;
  };
  summary: string;
}

/**
 * Run negotiation with streaming updates for chat
 * This is the main function for conversational AI-to-AI negotiation
 */
export async function runNegotiationWithStreaming(
  sessionId: string,
  onUpdate: (update: NegotiationChatUpdate) => Promise<void>
): Promise<NegotiationOutcome> {
  const manager = getSessionManager();
  const session = await manager.getSession(sessionId);

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Send initial update
  await onUpdate({
    type: 'start',
    sessionId,
    supplierName: session.sellerAgent.organizationName,
    maxRounds: session.maxRounds,
    status: 'active',
    summary: `Starting negotiation with ${session.sellerAgent.organizationName}...`,
  });

  const rounds: RoundResult[] = [];
  let lastResult: RoundResult | null = null;

  // Run rounds with streaming
  for await (const roundResult of manager.runRounds(sessionId)) {
    rounds.push(roundResult);
    lastResult = roundResult;

    // Build chat update
    const update: NegotiationChatUpdate = {
      type: roundResult.negotiationComplete ? 'complete' : 'round',
      sessionId,
      supplierName: roundResult.session.sellerAgent.organizationName,
      round: roundResult.session.currentRound,
      maxRounds: roundResult.session.maxRounds,
      status: roundResult.session.status,
      agreementReached: roundResult.agreementReached,
      summary: roundResult.roundSummary,
    };

    // Add buyer offer if present
    if (roundResult.buyerMessage?.terms) {
      update.buyerOffer = {
        price: roundResult.buyerMessage.terms.totalPrice,
        message: roundResult.buyerMessage.message,
      };
    }

    // Add seller response if present
    if (roundResult.sellerMessage?.terms) {
      update.sellerResponse = {
        price: roundResult.sellerMessage.terms.totalPrice,
        message: roundResult.sellerMessage.message,
        type: roundResult.sellerMessage.type as 'counter' | 'accept' | 'reject',
      };
    }

    // Add final price and savings if complete
    if (roundResult.agreementReached && roundResult.session.finalTerms) {
      update.finalPrice = roundResult.session.finalTerms.totalPrice;
      const savings = roundResult.session.initialTerms.totalPrice - roundResult.session.finalTerms.totalPrice;
      if (savings > 0) {
        update.savings = {
          amount: savings,
          percentage: (savings / roundResult.session.initialTerms.totalPrice) * 100,
        };
      }
    }

    // Handle escalation
    if (roundResult.escalation) {
      update.type = 'escalation';
      update.summary = `Escalation needed: ${roundResult.escalation.details}`;
    }

    await onUpdate(update);
  }

  // Build final outcome
  const finalSession = lastResult?.session || session;
  const durationMs = new Date().getTime() - new Date(finalSession.createdAt).getTime();

  let savings: NegotiationOutcome['savings'];
  if (lastResult?.agreementReached && finalSession.finalTerms) {
    const initialPrice = finalSession.initialTerms.totalPrice;
    const finalPrice = finalSession.finalTerms.totalPrice;
    savings = {
      amount: initialPrice - finalPrice,
      percentage: ((initialPrice - finalPrice) / initialPrice) * 100,
    };
  }

  return {
    session: finalSession,
    success: lastResult?.agreementReached || false,
    finalTerms: finalSession.finalTerms,
    summary: manager.formatForChat({
      session: finalSession,
      success: lastResult?.agreementReached || false,
      finalTerms: finalSession.finalTerms,
      summary: lastResult?.roundSummary || '',
      rounds,
      durationMs,
      savings,
    }),
    rounds,
    durationMs,
    savings,
  };
}

/**
 * Process conversational request with streaming updates
 * Main entry point for chat-based negotiation
 *
 * Usage:
 * ```typescript
 * const result = await processConversationalNegotiation(
 *   "I need 1000 bearings, budget $5000, delivery in 2 weeks",
 *   userId,
 *   async (update) => {
 *     // Stream update to user's chat
 *     await sendChatMessage(userId, update);
 *   }
 * );
 * ```
 */
export async function processConversationalNegotiation(
  userMessage: string,
  userId: string,
  organizationId: string,
  organizationName: string,
  onUpdate: (update: NegotiationChatUpdate) => Promise<void>
): Promise<{
  rfqId: string;
  negotiations: NegotiationOutcome[];
  bestOffer: {
    sessionId: string;
    supplierName: string;
    price: number;
    savings?: { amount: number; percentage: number };
  } | null;
  chatResponse: string;
}> {
  log('info', 'Processing conversational negotiation', { userId, userMessage });

  // Parse the request
  const parsedRequest = await parseNaturalLanguageRequest(userMessage);
  if (!parsedRequest) {
    throw new Error('I couldn\'t understand your request. Please specify what you need, quantity, and budget.');
  }

  // Create RFQ
  const rfqResult = await sql`
    INSERT INTO rfqs (
      category,
      description,
      quantity,
      target_price,
      urgency,
      delivery_location,
      required_certifications,
      requestor_email,
      status
    ) VALUES (
      ${parsedRequest.category},
      ${parsedRequest.description},
      ${parsedRequest.quantity},
      ${parsedRequest.targetPrice || null},
      ${parsedRequest.urgency || 'standard'},
      ${parsedRequest.deliveryLocation || 'TBD'},
      ${parsedRequest.certifications || []},
      ${userId},
      'negotiating'
    )
    RETURNING id
  `;
  const rfqId = rfqResult.rows[0].id;

  // Find matching suppliers
  const routingResult = await findMatchingSellerAgents({
    rfqId,
    category: parsedRequest.category,
    description: parsedRequest.description,
    quantity: parsedRequest.quantity,
    targetPrice: parsedRequest.targetPrice,
    urgency: parsedRequest.urgency || 'standard',
    requiredCertifications: parsedRequest.certifications || [],
    deliveryLocation: parsedRequest.deliveryLocation || 'TBD',
    buyerAgent: {
      agentType: 'buyer',
      agentId: `buyer_${organizationId}`,
      organizationId,
      organizationName,
      autonomous: true,
      limits: {
        priceBoundary: parsedRequest.targetPrice || parsedRequest.quantity * 100,
        acceptablePaymentTerms: ['Net 30', 'Net 45'],
        certifications: parsedRequest.certifications || [],
        autoApproveEnabled: true,
        escalationThreshold: 20,
      },
    },
    preferences: {
      maxSellers: 5,
      prioritizePrice: true,
      prioritizeSpeed: parsedRequest.urgency === 'critical',
    },
  });

  if (routingResult.matchedAgents.length === 0) {
    return {
      rfqId,
      negotiations: [],
      bestOffer: null,
      chatResponse: `I couldn't find any suppliers for ${parsedRequest.quantity} ${parsedRequest.description}. Would you like me to expand the search criteria?`,
    };
  }

  // Create sessions using the session manager
  const manager = getSessionManager();
  const negotiations: NegotiationOutcome[] = [];
  const topMatches = routingResult.matchedAgents.slice(0, 3);

  for (const match of topMatches) {
    // Build buyer constraints
    const buyerConstraints: BuyerConstraints = {
      maxBudget: parsedRequest.targetPrice || parsedRequest.quantity * 100,
      targetPrice: parsedRequest.targetPrice ? parsedRequest.targetPrice * 0.9 : parsedRequest.quantity * 80,
      maxLeadTime: parsedRequest.urgency === 'critical' ? 7 : parsedRequest.urgency === 'urgent' ? 14 : 30,
      requiredSpecs: parsedRequest.certifications || [],
      acceptablePaymentTerms: ['Net 30', 'Net 45', 'Net 60'],
      quantity: parsedRequest.quantity,
      currency: 'USD',
    };

    // Build seller config from match data
    const sellerConfig: SellerConfig = {
      minMargin: match.agent.pricingRules.minMargin,
      targetMargin: match.agent.pricingRules.baseMargin,
      volumeDiscounts: match.agent.pricingRules.volumeDiscounts,
      maxConcessions: 4,
      costPerUnit: match.estimatedPrice / parsedRequest.quantity * 0.75, // Estimate cost at 75% of price
      standardLeadTime: match.agent.capacityConstraints.leadTimeDays,
      rushLeadTime: match.agent.capacityConstraints.rushLeadTimeDays,
      rushFeePercent: match.agent.pricingRules.rushFeePercentage,
      monthlyCapacity: match.agent.capacityConstraints.maxMonthlyVolume,
      currentUtilization: match.agent.capacityConstraints.currentUtilization,
      currency: 'USD',
    };

    // Initial terms from seller
    const initialTerms: NegotiationTerms = {
      unitPrice: match.estimatedPrice / parsedRequest.quantity,
      quantity: parsedRequest.quantity,
      totalPrice: match.estimatedPrice,
      currency: 'USD',
      leadTimeDays: match.estimatedLeadTime,
      paymentTerms: 'Net 30',
      warrantyMonths: 12,
      shippingCost: 50,
      shippingMethod: 'Standard Freight',
    };

    // Create session
    const session = await manager.createSession({
      rfqId,
      supplierId: match.agent.supplierId,
      buyer: {
        organizationId,
        organizationName,
        userId,
      },
      buyerConstraints,
      sellerConfig,
      initialQuote: initialTerms,
      subject: parsedRequest.description,
      maxRounds: 5,
    });

    // Run negotiation with streaming
    const outcome = await runNegotiationWithStreaming(session.id, onUpdate);
    negotiations.push(outcome);
  }

  // Find best offer
  const successfulNegotiations = negotiations.filter(n => n.success && n.finalTerms);
  let bestOffer: {
    sessionId: string;
    supplierName: string;
    price: number;
    savings?: { amount: number; percentage: number };
  } | null = null;

  if (successfulNegotiations.length > 0) {
    successfulNegotiations.sort((a, b) => (a.finalTerms?.totalPrice || 0) - (b.finalTerms?.totalPrice || 0));
    const best = successfulNegotiations[0];
    bestOffer = {
      sessionId: best.session.id,
      supplierName: best.session.sellerAgent.organizationName,
      price: best.finalTerms!.totalPrice,
      savings: best.savings,
    };
  }

  // Generate chat response
  const chatResponse = generateChatResponse(parsedRequest, negotiations, bestOffer);

  return {
    rfqId,
    negotiations,
    bestOffer,
    chatResponse,
  };
}

/**
 * Generate a conversational response for the user
 */
function generateChatResponse(
  request: { description: string; quantity: number },
  negotiations: NegotiationOutcome[],
  bestOffer: { sessionId: string; supplierName: string; price: number; savings?: { amount: number; percentage: number } } | null
): string {
  const lines: string[] = [];

  if (bestOffer) {
    lines.push(`Got it. I negotiated with ${negotiations.length} suppliers for ${request.quantity} ${request.description}.`);
    lines.push('');

    // Show negotiation highlights
    for (const neg of negotiations) {
      const emoji = neg.success ? 'check' : 'x';
      const status = neg.success ? `$${neg.finalTerms?.totalPrice.toFixed(2)}` : 'No deal';
      lines.push(`- ${neg.session.sellerAgent.organizationName}: ${status}`);
    }

    lines.push('');
    lines.push(`**Best Deal: ${bestOffer.supplierName}**`);
    lines.push(`- Price: $${bestOffer.price.toFixed(2)}`);

    if (bestOffer.savings && bestOffer.savings.amount > 0) {
      lines.push(`- Savings: $${bestOffer.savings.amount.toFixed(2)} (${bestOffer.savings.percentage.toFixed(1)}% off)`);
    }

    lines.push('');
    lines.push('Want me to proceed with this deal?');
  } else {
    lines.push(`I negotiated with ${negotiations.length} suppliers for ${request.quantity} ${request.description}, but couldn't reach agreement.`);
    lines.push('');
    lines.push('Would you like me to:');
    lines.push('- Increase the budget?');
    lines.push('- Extend the delivery timeline?');
    lines.push('- Try different suppliers?');
  }

  return lines.join('\n');
}

// ============================================================================
// EXPORTS
// ============================================================================

const AIRouter = {
  // Legacy functions (single-seller)
  findMatchingSellerAgents,
  createNegotiationSession,
  getSession,
  getSessionsByRFQ,
  routeMessage,
  runFullNegotiation,
  processConversationalRequest,
  // Streaming functions
  runNegotiationWithStreaming,
  processConversationalNegotiation,
  // Session manager access
  getSessionManager,
  // AI-to-AI Router (multi-seller)
  getAIToAIRouter,
  AIToAIRouter,
};

export default AIRouter;
