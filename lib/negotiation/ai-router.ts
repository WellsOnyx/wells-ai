/**
 * AI-to-AI Negotiation Router
 *
 * Routes buyer Wells agents to seller Wells agents for autonomous negotiation.
 * Handles session management, message routing, and audit logging.
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
// EXPORTS
// ============================================================================

const AIRouter = {
  findMatchingSellerAgents,
  createNegotiationSession,
  getSession,
  getSessionsByRFQ,
  routeMessage,
  runFullNegotiation,
  processConversationalRequest,
};

export default AIRouter;
