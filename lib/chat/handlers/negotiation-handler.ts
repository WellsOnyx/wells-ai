/**
 * Negotiation Intent Handler
 *
 * Handles all negotiation-related intents from the chat router.
 * Bridges between the chat system and the conversational negotiation engine.
 *
 * This handler processes user messages like:
 * - "Negotiate with Acme for better pricing"
 * - "Don't go below $45 per unit"
 * - "How's the negotiation going?"
 * - "What did they counter with?"
 * - "Accept their last offer"
 * - "Negotiate automatically within my limits"
 * - "What's a good counter to their offer?"
 *
 * @module lib/chat/handlers/negotiation-handler
 */

import { ConversationContext } from '../conversation-manager';
import { ActionResult } from '../action-executor';
import {
  ConversationalNegotiationEngine,
  getConversationalNegotiationEngine,
  ConversationalNegotiationSession,
  NegotiationChatResult,
  NegotiationMode,
  NegotiationConstraints,
} from '@/lib/negotiation/conversational-negotiation';

// ============================================================================
// TYPES
// ============================================================================

export interface NegotiationHandlerParams {
  /** The user's message */
  message: string;

  /** Optional session ID for existing negotiation */
  sessionId?: string;

  /** Optional counterparty name for new negotiation */
  counterparty?: string;

  /** Optional price limit */
  priceLimit?: number;

  /** Optional target price */
  targetPrice?: number;

  /** Optional quantity */
  quantity?: number;

  /** Optional action type */
  action?: 'start' | 'status' | 'counter' | 'accept' | 'reject' | 'autonomous' | 'pause' | 'strategy';

  /** Whether to run autonomously */
  autonomous?: boolean;
}

export interface NegotiationHandlerResult extends ActionResult {
  /** The negotiation session */
  negotiationSession?: ConversationalNegotiationSession;

  /** Whether negotiation is complete */
  negotiationComplete?: boolean;

  /** Negotiation outcome if complete */
  outcome?: 'agreed' | 'rejected' | 'expired' | 'escalated';

  /** Quick action buttons */
  quickActions?: Array<{
    label: string;
    action: string;
    primary?: boolean;
  }>;
}

// ============================================================================
// NEGOTIATION HANDLER
// ============================================================================

/**
 * Handle all negotiation-related chat intents
 */
export async function handleNegotiation(
  params: NegotiationHandlerParams,
  context: ConversationContext
): Promise<NegotiationHandlerResult> {
  const startTime = Date.now();
  const engine = getConversationalNegotiationEngine();

  try {
    // Get user info from context
    const userId = context.userId;
    const organizationId = extractOrganizationId(context);
    const organizationName = extractOrganizationName(context);

    // Process the message through the conversational negotiation engine
    const result = await engine.processMessage(
      userId,
      organizationId,
      organizationName,
      params.message,
      params.sessionId
    );

    return formatResult(result, startTime);
  } catch (error) {
    console.error('[Negotiation Handler] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      displayMessage: "I had trouble processing that negotiation request. Could you try rephrasing?",
      actionType: 'negotiation.error',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Start a new negotiation
 */
export async function startNegotiation(
  params: {
    counterparty: string;
    subject?: string;
    targetPrice?: number;
    priceLimit?: number;
    quantity?: number;
    autonomous?: boolean;
  },
  context: ConversationContext
): Promise<NegotiationHandlerResult> {
  const startTime = Date.now();
  const engine = getConversationalNegotiationEngine();

  try {
    const message = buildStartNegotiationMessage(params);

    const result = await engine.processMessage(
      context.userId,
      extractOrganizationId(context),
      extractOrganizationName(context),
      message,
      undefined
    );

    return formatResult(result, startTime);
  } catch (error) {
    console.error('[Negotiation Handler] Start error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      displayMessage: "I couldn't start the negotiation. Please try again.",
      actionType: 'negotiation.start',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Check negotiation status
 */
export async function checkNegotiationStatus(
  params: { sessionId?: string },
  context: ConversationContext
): Promise<NegotiationHandlerResult> {
  const startTime = Date.now();
  const engine = getConversationalNegotiationEngine();

  try {
    const result = await engine.processMessage(
      context.userId,
      extractOrganizationId(context),
      extractOrganizationName(context),
      "How's the negotiation going?",
      params.sessionId
    );

    return formatResult(result, startTime);
  } catch (error) {
    console.error('[Negotiation Handler] Status error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      displayMessage: "I couldn't get the negotiation status. Please try again.",
      actionType: 'negotiation.status',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Set negotiation constraints
 */
export async function setNegotiationConstraints(
  params: {
    sessionId: string;
    priceLimit?: number;
    targetPrice?: number;
    walkAwayPrice?: number;
    maxLeadTime?: number;
    quantity?: number;
  },
  context: ConversationContext
): Promise<NegotiationHandlerResult> {
  const startTime = Date.now();
  const engine = getConversationalNegotiationEngine();

  try {
    const message = buildConstraintMessage(params);

    const result = await engine.processMessage(
      context.userId,
      extractOrganizationId(context),
      extractOrganizationName(context),
      message,
      params.sessionId
    );

    return formatResult(result, startTime);
  } catch (error) {
    console.error('[Negotiation Handler] Constraint error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      displayMessage: "I couldn't update the constraints. Please try again.",
      actionType: 'negotiation.constraint',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Make a counter offer
 */
export async function makeCounterOffer(
  params: {
    sessionId: string;
    price?: number;
    unitPrice?: number;
  },
  context: ConversationContext
): Promise<NegotiationHandlerResult> {
  const startTime = Date.now();
  const engine = getConversationalNegotiationEngine();

  try {
    let message: string;
    if (params.price || params.unitPrice) {
      const price = params.price || params.unitPrice;
      message = `Counter at $${price}`;
    } else {
      message = "What should I counter with?";
    }

    const result = await engine.processMessage(
      context.userId,
      extractOrganizationId(context),
      extractOrganizationName(context),
      message,
      params.sessionId
    );

    return formatResult(result, startTime);
  } catch (error) {
    console.error('[Negotiation Handler] Counter error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      displayMessage: "I couldn't process the counter offer. Please try again.",
      actionType: 'negotiation.counter',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Accept the current offer
 */
export async function acceptNegotiationOffer(
  params: { sessionId: string },
  context: ConversationContext
): Promise<NegotiationHandlerResult> {
  const startTime = Date.now();
  const engine = getConversationalNegotiationEngine();

  try {
    const result = await engine.processMessage(
      context.userId,
      extractOrganizationId(context),
      extractOrganizationName(context),
      "Accept their last offer",
      params.sessionId
    );

    return formatResult(result, startTime);
  } catch (error) {
    console.error('[Negotiation Handler] Accept error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      displayMessage: "I couldn't accept the offer. Please try again.",
      actionType: 'negotiation.accept',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Reject the current offer/negotiation
 */
export async function rejectNegotiationOffer(
  params: { sessionId: string; reason?: string },
  context: ConversationContext
): Promise<NegotiationHandlerResult> {
  const startTime = Date.now();
  const engine = getConversationalNegotiationEngine();

  try {
    const message = params.reason
      ? `Reject the negotiation: ${params.reason}`
      : "Walk away from this negotiation";

    const result = await engine.processMessage(
      context.userId,
      extractOrganizationId(context),
      extractOrganizationName(context),
      message,
      params.sessionId
    );

    return formatResult(result, startTime);
  } catch (error) {
    console.error('[Negotiation Handler] Reject error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      displayMessage: "I couldn't process the rejection. Please try again.",
      actionType: 'negotiation.reject',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Enable autonomous negotiation mode
 */
export async function enableAutonomousNegotiation(
  params: {
    sessionId: string;
    priceLimit?: number;
    walkAwayPrice?: number;
  },
  context: ConversationContext
): Promise<NegotiationHandlerResult> {
  const startTime = Date.now();
  const engine = getConversationalNegotiationEngine();

  try {
    let message = "Negotiate automatically within my limits";
    if (params.priceLimit) {
      message += `. Maximum: $${params.priceLimit}`;
    }
    if (params.walkAwayPrice) {
      message += `. Walk away above $${params.walkAwayPrice}`;
    }

    const result = await engine.processMessage(
      context.userId,
      extractOrganizationId(context),
      extractOrganizationName(context),
      message,
      params.sessionId
    );

    return formatResult(result, startTime);
  } catch (error) {
    console.error('[Negotiation Handler] Autonomous error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      displayMessage: "I couldn't enable autonomous mode. Please try again.",
      actionType: 'negotiation.autonomous',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Get negotiation strategy
 */
export async function getNegotiationStrategy(
  params: { sessionId: string; question?: string },
  context: ConversationContext
): Promise<NegotiationHandlerResult> {
  const startTime = Date.now();
  const engine = getConversationalNegotiationEngine();

  try {
    const message = params.question || "What's your negotiation strategy?";

    const result = await engine.processMessage(
      context.userId,
      extractOrganizationId(context),
      extractOrganizationName(context),
      message,
      params.sessionId
    );

    return formatResult(result, startTime);
  } catch (error) {
    console.error('[Negotiation Handler] Strategy error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      displayMessage: "I couldn't generate strategy advice. Please try again.",
      actionType: 'negotiation.strategy',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Review current offer
 */
export async function reviewCurrentOffer(
  params: { sessionId: string },
  context: ConversationContext
): Promise<NegotiationHandlerResult> {
  const startTime = Date.now();
  const engine = getConversationalNegotiationEngine();

  try {
    const result = await engine.processMessage(
      context.userId,
      extractOrganizationId(context),
      extractOrganizationName(context),
      "What did they counter with?",
      params.sessionId
    );

    return formatResult(result, startTime);
  } catch (error) {
    console.error('[Negotiation Handler] Review error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      displayMessage: "I couldn't review the offer. Please try again.",
      actionType: 'negotiation.review',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Approve a pending action
 */
export async function approvePendingAction(
  params: { sessionId: string },
  context: ConversationContext
): Promise<NegotiationHandlerResult> {
  const startTime = Date.now();
  const engine = getConversationalNegotiationEngine();

  try {
    const result = await engine.processMessage(
      context.userId,
      extractOrganizationId(context),
      extractOrganizationName(context),
      "Yes, proceed",
      params.sessionId
    );

    return formatResult(result, startTime);
  } catch (error) {
    console.error('[Negotiation Handler] Approve error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      displayMessage: "I couldn't process the approval. Please try again.",
      actionType: 'negotiation.approve',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Reject a pending action
 */
export async function rejectPendingAction(
  params: { sessionId: string; reason?: string },
  context: ConversationContext
): Promise<NegotiationHandlerResult> {
  const startTime = Date.now();
  const engine = getConversationalNegotiationEngine();

  try {
    const message = params.reason
      ? `No, because ${params.reason}`
      : "No, don't do that";

    const result = await engine.processMessage(
      context.userId,
      extractOrganizationId(context),
      extractOrganizationName(context),
      message,
      params.sessionId
    );

    return formatResult(result, startTime);
  } catch (error) {
    console.error('[Negotiation Handler] Reject action error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      displayMessage: "I couldn't process the rejection. Please try again.",
      actionType: 'negotiation.reject_action',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Pause autonomous negotiation
 */
export async function pauseNegotiation(
  params: { sessionId: string },
  context: ConversationContext
): Promise<NegotiationHandlerResult> {
  const startTime = Date.now();
  const engine = getConversationalNegotiationEngine();

  try {
    const result = await engine.processMessage(
      context.userId,
      extractOrganizationId(context),
      extractOrganizationName(context),
      "Pause the negotiation",
      params.sessionId
    );

    return formatResult(result, startTime);
  } catch (error) {
    console.error('[Negotiation Handler] Pause error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      displayMessage: "I couldn't pause the negotiation. Please try again.",
      actionType: 'negotiation.pause',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Resume a paused negotiation
 */
export async function resumeNegotiation(
  params: { sessionId: string },
  context: ConversationContext
): Promise<NegotiationHandlerResult> {
  const startTime = Date.now();
  const engine = getConversationalNegotiationEngine();

  try {
    const result = await engine.processMessage(
      context.userId,
      extractOrganizationId(context),
      extractOrganizationName(context),
      "Resume the negotiation",
      params.sessionId
    );

    return formatResult(result, startTime);
  } catch (error) {
    console.error('[Negotiation Handler] Resume error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      displayMessage: "I couldn't resume the negotiation. Please try again.",
      actionType: 'negotiation.resume',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract organization ID from context
 */
function extractOrganizationId(context: ConversationContext): string {
  return context.userPreferences?.organizationId as string || context.userId;
}

/**
 * Extract organization name from context
 */
function extractOrganizationName(context: ConversationContext): string {
  return context.userPreferences?.organizationName as string || 'Your Organization';
}

/**
 * Build a message to start a negotiation
 */
function buildStartNegotiationMessage(params: {
  counterparty: string;
  subject?: string;
  targetPrice?: number;
  priceLimit?: number;
  quantity?: number;
  autonomous?: boolean;
}): string {
  let message = `Negotiate with ${params.counterparty}`;

  if (params.subject) {
    message += ` for ${params.subject}`;
  }

  if (params.targetPrice) {
    message += `. Target: $${params.targetPrice}`;
  }

  if (params.priceLimit) {
    message += `. Don't go above $${params.priceLimit}`;
  }

  if (params.quantity) {
    message += `. Quantity: ${params.quantity}`;
  }

  if (params.autonomous) {
    message += `. Negotiate automatically within these limits.`;
  }

  return message;
}

/**
 * Build a message to set constraints
 */
function buildConstraintMessage(params: {
  priceLimit?: number;
  targetPrice?: number;
  walkAwayPrice?: number;
  maxLeadTime?: number;
  quantity?: number;
}): string {
  const parts: string[] = [];

  if (params.priceLimit) {
    parts.push(`Don't go above $${params.priceLimit}`);
  }

  if (params.targetPrice) {
    parts.push(`Target $${params.targetPrice}`);
  }

  if (params.walkAwayPrice) {
    parts.push(`Walk away if above $${params.walkAwayPrice}`);
  }

  if (params.maxLeadTime) {
    parts.push(`Need delivery within ${params.maxLeadTime} days`);
  }

  if (params.quantity) {
    parts.push(`Quantity: ${params.quantity} units`);
  }

  return parts.join('. ');
}

/**
 * Format the negotiation result for the action executor
 */
function formatResult(
  result: NegotiationChatResult,
  startTime: number
): NegotiationHandlerResult {
  return {
    success: true,
    displayMessage: result.response,
    data: {
      session: result.session,
      complete: result.complete,
      outcome: result.outcome,
    },
    displayData: {
      sessionId: result.session.id,
      counterparty: result.session.counterpartyName,
      status: result.session.status,
      mode: result.session.mode,
      round: result.session.round,
      currentOffer: result.session.currentOffer,
    },
    suggestedActions: result.suggestedActions?.map(action => ({
      label: action,
      action: `negotiation.${action.toLowerCase().replace(/\s+/g, '_')}`,
    })),
    nextSteps: result.suggestedActions,
    negotiationSession: result.session,
    negotiationComplete: result.complete,
    outcome: result.outcome,
    quickActions: result.quickActions,
    actionType: 'negotiation.chat',
    executedAt: new Date(),
    durationMs: Date.now() - startTime,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const negotiationHandler = {
  handleNegotiation,
  startNegotiation,
  checkNegotiationStatus,
  setNegotiationConstraints,
  makeCounterOffer,
  acceptNegotiationOffer,
  rejectNegotiationOffer,
  enableAutonomousNegotiation,
  getNegotiationStrategy,
  reviewCurrentOffer,
  approvePendingAction,
  rejectPendingAction,
  pauseNegotiation,
  resumeNegotiation,
};

export default negotiationHandler;
