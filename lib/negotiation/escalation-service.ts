/**
 * Escalation Service
 *
 * Determines when AI-to-AI negotiations should be escalated to humans.
 * Handles notification, tracking, and resolution of escalations.
 *
 * @module lib/negotiation/escalation-service
 */

import { sql } from '@vercel/postgres';
import {
  NegotiationSession,
  NegotiationProtocolMessage,
  NegotiationTerms,
} from './protocol';

// ============================================================================
// CONFIGURATION
// ============================================================================

const LOG_PREFIX = '[Escalation Service]';

/** Escalation thresholds */
const THRESHOLDS = {
  /** Budget exceeded by this percentage triggers escalation */
  BUDGET_EXCEEDED_PERCENT: 20,

  /** Deals above this amount require human approval */
  HIGH_VALUE_THRESHOLD: 100000,

  /** AI confidence below this triggers escalation */
  LOW_CONFIDENCE_THRESHOLD: 60,

  /** Rounds without progress before escalation */
  STALEMATE_ROUNDS: 3,

  /** Minimum price movement to count as progress */
  MIN_PRICE_MOVEMENT_PERCENT: 0.5,
};

// ============================================================================
// TYPES
// ============================================================================

export type EscalationReason =
  | 'budget_exceeded'
  | 'high_value_deal'
  | 'new_counterparty'
  | 'low_confidence'
  | 'stalemate'
  | 'manual_request'
  | 'terms_outside_policy'
  | 'unusual_terms'
  | 'compliance_flag'
  | 'system_error';

export type EscalationPriority = 'low' | 'medium' | 'high' | 'critical';

export type EscalationStatus =
  | 'pending'
  | 'reviewing'
  | 'approved'
  | 'rejected'
  | 'modified'
  | 'expired';

export interface EscalationResult {
  /** Whether escalation is needed */
  shouldEscalate: boolean;

  /** Primary reason for escalation */
  reason?: EscalationReason;

  /** All contributing reasons */
  reasons: EscalationReason[];

  /** Priority level */
  priority: EscalationPriority;

  /** Detailed explanation */
  details: string;

  /** Suggested action for human */
  suggestedAction?: string;

  /** Relevant data for review */
  reviewData?: Record<string, unknown>;
}

export interface Escalation {
  /** Unique escalation ID */
  id: string;

  /** Session this escalation belongs to */
  sessionId: string;

  /** RFQ reference */
  rfqId: string;

  /** Organization that needs to review */
  organizationId: string;

  /** Primary reason */
  reason: EscalationReason;

  /** All reasons */
  reasons: EscalationReason[];

  /** Priority */
  priority: EscalationPriority;

  /** Current status */
  status: EscalationStatus;

  /** Details for reviewer */
  details: string;

  /** Suggested action */
  suggestedAction?: string;

  /** Data for review */
  reviewData: Record<string, unknown>;

  /** Terms being reviewed */
  termsUnderReview?: NegotiationTerms;

  /** Who is assigned to review */
  assignedTo?: string;

  /** Decision made */
  decision?: 'approve' | 'reject' | 'modify';

  /** Modified terms if decision is 'modify' */
  modifiedTerms?: NegotiationTerms;

  /** Reason for decision */
  decisionReason?: string;

  /** Who made the decision */
  decidedBy?: string;

  /** When escalation was created */
  createdAt: string;

  /** When last updated */
  updatedAt: string;

  /** When decision was made */
  decidedAt?: string;

  /** Expiration time for escalation */
  expiresAt: string;
}

export interface EscalationDecision {
  decision: 'approve' | 'reject' | 'modify';
  modifiedTerms?: NegotiationTerms;
  reason: string;
  decidedBy: string;
}

// ============================================================================
// ESCALATION TRIGGER CHECKS
// ============================================================================

/**
 * Check all escalation triggers for a session and message
 */
export async function checkEscalationTriggers(
  session: NegotiationSession,
  message: NegotiationProtocolMessage
): Promise<EscalationResult> {
  const reasons: EscalationReason[] = [];
  let highestPriority: EscalationPriority = 'low';
  const details: string[] = [];
  let reviewData: Record<string, unknown> = {};

  // 1. Check if budget exceeded
  const budgetCheck = checkBudgetExceeded(session, message);
  if (budgetCheck.exceeded) {
    reasons.push('budget_exceeded');
    details.push(budgetCheck.detail);
    reviewData.budgetInfo = budgetCheck;
    if (budgetCheck.percentageOver > 30) highestPriority = 'high';
    else if (budgetCheck.percentageOver > 20) highestPriority = 'medium';
  }

  // 2. Check high value deal
  const valueCheck = checkHighValueDeal(session);
  if (valueCheck.isHighValue) {
    reasons.push('high_value_deal');
    details.push(valueCheck.detail);
    reviewData.dealValue = valueCheck;
    highestPriority = maxPriority(highestPriority, 'high');
  }

  // 3. Check for new counterparty (first transaction)
  const counterpartyCheck = await checkNewCounterparty(session);
  if (counterpartyCheck.isNew) {
    reasons.push('new_counterparty');
    details.push(counterpartyCheck.detail);
    reviewData.counterpartyInfo = counterpartyCheck;
    highestPriority = maxPriority(highestPriority, 'medium');
  }

  // 4. Check AI confidence
  if (message.confidence < THRESHOLDS.LOW_CONFIDENCE_THRESHOLD) {
    reasons.push('low_confidence');
    details.push(`AI confidence is ${message.confidence}%, below threshold of ${THRESHOLDS.LOW_CONFIDENCE_THRESHOLD}%`);
    reviewData.confidence = message.confidence;
    highestPriority = maxPriority(highestPriority, 'medium');
  }

  // 5. Check for stalemate
  const stalemateCheck = checkStalemate(session);
  if (stalemateCheck.isStalemate) {
    reasons.push('stalemate');
    details.push(stalemateCheck.detail);
    reviewData.stalemateInfo = stalemateCheck;
    highestPriority = maxPriority(highestPriority, 'medium');
  }

  // 6. Check manual escalation request
  if (message.requiresEscalation) {
    reasons.push('manual_request');
    details.push(message.escalationReason || 'Manual escalation requested');
    highestPriority = maxPriority(highestPriority, 'high');
  }

  // 7. Check terms against policy
  const policyCheck = checkTermsAgainstPolicy(session, message);
  if (policyCheck.violations.length > 0) {
    reasons.push('terms_outside_policy');
    details.push(...policyCheck.violations);
    reviewData.policyViolations = policyCheck.violations;
    highestPriority = maxPriority(highestPriority, 'high');
  }

  // Build result
  const shouldEscalate = reasons.length > 0;
  const primaryReason = reasons[0];

  let suggestedAction: string | undefined;
  if (shouldEscalate) {
    suggestedAction = generateSuggestedAction(reasons, session, message);
  }

  return {
    shouldEscalate,
    reason: primaryReason,
    reasons,
    priority: highestPriority,
    details: details.join(' | '),
    suggestedAction,
    reviewData,
  };
}

// ============================================================================
// INDIVIDUAL TRIGGER CHECKS
// ============================================================================

function checkBudgetExceeded(
  session: NegotiationSession,
  message: NegotiationProtocolMessage
): { exceeded: boolean; percentageOver: number; detail: string } {
  const buyerBudget = session.buyerAgent.limits.priceBoundary;
  const currentPrice = message.terms?.totalPrice || session.currentTerms?.totalPrice || 0;

  if (currentPrice <= buyerBudget) {
    return { exceeded: false, percentageOver: 0, detail: '' };
  }

  const overAmount = currentPrice - buyerBudget;
  const percentageOver = (overAmount / buyerBudget) * 100;

  if (percentageOver < THRESHOLDS.BUDGET_EXCEEDED_PERCENT) {
    return { exceeded: false, percentageOver, detail: '' };
  }

  return {
    exceeded: true,
    percentageOver,
    detail: `Current price $${currentPrice.toFixed(2)} exceeds budget $${buyerBudget.toFixed(2)} by ${percentageOver.toFixed(1)}%`,
  };
}

function checkHighValueDeal(
  session: NegotiationSession
): { isHighValue: boolean; value: number; detail: string } {
  const value = session.currentTerms?.totalPrice || session.initialTerms.totalPrice;

  if (value < THRESHOLDS.HIGH_VALUE_THRESHOLD) {
    return { isHighValue: false, value, detail: '' };
  }

  return {
    isHighValue: true,
    value,
    detail: `Deal value $${value.toFixed(2)} exceeds high-value threshold of $${THRESHOLDS.HIGH_VALUE_THRESHOLD}`,
  };
}

async function checkNewCounterparty(
  session: NegotiationSession
): Promise<{ isNew: boolean; transactionCount: number; detail: string }> {
  // Check transaction history between buyer and seller
  const result = await sql`
    SELECT COUNT(*) as count
    FROM negotiation_sessions
    WHERE buyer_agent->>'organizationId' = ${session.buyerAgent.organizationId}
      AND seller_agent->>'organizationId' = ${session.sellerAgent.organizationId}
      AND status = 'agreed'
      AND id != ${session.id}
  `;

  const transactionCount = parseInt(result.rows[0].count);

  if (transactionCount > 0) {
    return { isNew: false, transactionCount, detail: '' };
  }

  return {
    isNew: true,
    transactionCount: 0,
    detail: `First transaction with ${session.sellerAgent.organizationName}`,
  };
}

function checkStalemate(
  session: NegotiationSession
): { isStalemate: boolean; roundsWithoutProgress: number; detail: string } {
  if (session.messages.length < THRESHOLDS.STALEMATE_ROUNDS * 2) {
    return { isStalemate: false, roundsWithoutProgress: 0, detail: '' };
  }

  // Get last N rounds of prices
  const prices: number[] = [];
  for (const msg of session.messages) {
    if (msg.terms?.totalPrice) {
      prices.push(msg.terms.totalPrice);
    }
  }

  if (prices.length < THRESHOLDS.STALEMATE_ROUNDS) {
    return { isStalemate: false, roundsWithoutProgress: 0, detail: '' };
  }

  // Check for meaningful movement in recent rounds
  const recentPrices = prices.slice(-THRESHOLDS.STALEMATE_ROUNDS);
  const priceRange = Math.max(...recentPrices) - Math.min(...recentPrices);
  const avgPrice = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
  const movementPercent = (priceRange / avgPrice) * 100;

  if (movementPercent >= THRESHOLDS.MIN_PRICE_MOVEMENT_PERCENT) {
    return { isStalemate: false, roundsWithoutProgress: 0, detail: '' };
  }

  return {
    isStalemate: true,
    roundsWithoutProgress: THRESHOLDS.STALEMATE_ROUNDS,
    detail: `No significant price movement for ${THRESHOLDS.STALEMATE_ROUNDS} rounds (${movementPercent.toFixed(2)}% movement)`,
  };
}

function checkTermsAgainstPolicy(
  session: NegotiationSession,
  message: NegotiationProtocolMessage
): { violations: string[] } {
  const violations: string[] = [];
  const terms = message.terms;

  if (!terms) {
    return { violations };
  }

  // Check payment terms
  const acceptablePaymentTerms = session.buyerAgent.limits.acceptablePaymentTerms;
  if (terms.paymentTerms && !acceptablePaymentTerms.includes(terms.paymentTerms)) {
    violations.push(`Payment terms "${terms.paymentTerms}" not in acceptable list: ${acceptablePaymentTerms.join(', ')}`);
  }

  // Check lead time
  const maxLeadTime = session.buyerAgent.limits.leadTimeBoundary;
  if (maxLeadTime && terms.leadTimeDays > maxLeadTime) {
    violations.push(`Lead time ${terms.leadTimeDays} days exceeds maximum ${maxLeadTime} days`);
  }

  // Check quantity
  const maxQuantity = session.buyerAgent.limits.maxQuantity;
  if (maxQuantity && terms.quantity > maxQuantity) {
    violations.push(`Quantity ${terms.quantity} exceeds maximum ${maxQuantity}`);
  }

  return { violations };
}

function maxPriority(a: EscalationPriority, b: EscalationPriority): EscalationPriority {
  const order: Record<EscalationPriority, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };
  return order[a] >= order[b] ? a : b;
}

function generateSuggestedAction(
  reasons: EscalationReason[],
  session: NegotiationSession,
  message: NegotiationProtocolMessage
): string {
  const actions: string[] = [];

  if (reasons.includes('budget_exceeded')) {
    actions.push('Review and approve budget increase or reject current terms');
  }

  if (reasons.includes('high_value_deal')) {
    actions.push('Review deal details and confirm terms are acceptable');
  }

  if (reasons.includes('new_counterparty')) {
    actions.push('Verify supplier credentials before proceeding');
  }

  if (reasons.includes('stalemate')) {
    actions.push('Consider accepting current terms or providing new negotiation guidance');
  }

  if (reasons.includes('low_confidence')) {
    actions.push('Review AI analysis and provide direction');
  }

  if (actions.length === 0) {
    return 'Review the negotiation and decide how to proceed';
  }

  return actions.join('. ');
}

// ============================================================================
// ESCALATION CRUD OPERATIONS
// ============================================================================

/**
 * Create a new escalation
 */
export async function createEscalation(params: {
  sessionId: string;
  rfqId: string;
  organizationId: string;
  escalationResult: EscalationResult;
  termsUnderReview?: NegotiationTerms;
  expirationMinutes?: number;
}): Promise<Escalation> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (params.expirationMinutes || 60) * 60 * 1000);

  const result = await sql`
    INSERT INTO negotiation_escalations (
      session_id,
      rfq_id,
      organization_id,
      reason,
      reasons,
      priority,
      status,
      details,
      suggested_action,
      review_data,
      terms_under_review,
      created_at,
      updated_at,
      expires_at
    ) VALUES (
      ${params.sessionId},
      ${params.rfqId},
      ${params.organizationId},
      ${params.escalationResult.reason || 'manual_request'},
      ${params.escalationResult.reasons},
      ${params.escalationResult.priority},
      'pending',
      ${params.escalationResult.details},
      ${params.escalationResult.suggestedAction || null},
      ${JSON.stringify(params.escalationResult.reviewData || {})},
      ${params.termsUnderReview ? JSON.stringify(params.termsUnderReview) : null},
      ${now.toISOString()},
      ${now.toISOString()},
      ${expiresAt.toISOString()}
    )
    RETURNING *
  `;

  return mapEscalationRow(result.rows[0]);
}

/**
 * Get escalation by ID
 */
export async function getEscalation(escalationId: string): Promise<Escalation | null> {
  const result = await sql`
    SELECT * FROM negotiation_escalations
    WHERE id = ${escalationId}
  `;

  if (result.rows.length === 0) return null;
  return mapEscalationRow(result.rows[0]);
}

/**
 * Get pending escalations for an organization
 */
export async function getPendingEscalations(
  organizationId: string
): Promise<Escalation[]> {
  const result = await sql`
    SELECT * FROM negotiation_escalations
    WHERE organization_id = ${organizationId}
      AND status IN ('pending', 'reviewing')
      AND expires_at > NOW()
    ORDER BY
      CASE priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
      END,
      created_at ASC
  `;

  return result.rows.map(mapEscalationRow);
}

/**
 * Get escalation by session ID
 */
export async function getEscalationBySession(
  sessionId: string
): Promise<Escalation | null> {
  const result = await sql`
    SELECT * FROM negotiation_escalations
    WHERE session_id = ${sessionId}
      AND status IN ('pending', 'reviewing')
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (result.rows.length === 0) return null;
  return mapEscalationRow(result.rows[0]);
}

/**
 * Resolve an escalation with a decision
 */
export async function resolveEscalation(
  escalationId: string,
  decision: EscalationDecision
): Promise<Escalation> {
  const now = new Date().toISOString();

  let newStatus: EscalationStatus;
  switch (decision.decision) {
    case 'approve':
      newStatus = 'approved';
      break;
    case 'reject':
      newStatus = 'rejected';
      break;
    case 'modify':
      newStatus = 'modified';
      break;
  }

  const result = await sql`
    UPDATE negotiation_escalations
    SET
      status = ${newStatus},
      decision = ${decision.decision},
      modified_terms = ${decision.modifiedTerms ? JSON.stringify(decision.modifiedTerms) : null},
      decision_reason = ${decision.reason},
      decided_by = ${decision.decidedBy},
      decided_at = ${now},
      updated_at = ${now}
    WHERE id = ${escalationId}
    RETURNING *
  `;

  return mapEscalationRow(result.rows[0]);
}

/**
 * Assign escalation to a reviewer
 */
export async function assignEscalation(
  escalationId: string,
  assignedTo: string
): Promise<Escalation> {
  const result = await sql`
    UPDATE negotiation_escalations
    SET
      status = 'reviewing',
      assigned_to = ${assignedTo},
      updated_at = NOW()
    WHERE id = ${escalationId}
    RETURNING *
  `;

  return mapEscalationRow(result.rows[0]);
}

/**
 * Expire old escalations
 */
export async function expireOldEscalations(): Promise<number> {
  const result = await sql`
    UPDATE negotiation_escalations
    SET
      status = 'expired',
      updated_at = NOW()
    WHERE status IN ('pending', 'reviewing')
      AND expires_at < NOW()
    RETURNING id
  `;

  return result.rows.length;
}

function mapEscalationRow(row: Record<string, unknown>): Escalation {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    rfqId: row.rfq_id as string,
    organizationId: row.organization_id as string,
    reason: row.reason as EscalationReason,
    reasons: row.reasons as EscalationReason[],
    priority: row.priority as EscalationPriority,
    status: row.status as EscalationStatus,
    details: row.details as string,
    suggestedAction: row.suggested_action as string | undefined,
    reviewData: row.review_data as Record<string, unknown>,
    termsUnderReview: row.terms_under_review as NegotiationTerms | undefined,
    assignedTo: row.assigned_to as string | undefined,
    decision: row.decision as 'approve' | 'reject' | 'modify' | undefined,
    modifiedTerms: row.modified_terms as NegotiationTerms | undefined,
    decisionReason: row.decision_reason as string | undefined,
    decidedBy: row.decided_by as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    decidedAt: row.decided_at as string | undefined,
    expiresAt: row.expires_at as string,
  };
}

// ============================================================================
// NOTIFICATION HELPERS
// ============================================================================

/**
 * Generate notification content for an escalation
 */
export function generateEscalationNotification(escalation: Escalation): {
  title: string;
  body: string;
  action: string;
} {
  const priorityEmoji: Record<EscalationPriority, string> = {
    low: '',
    medium: '',
    high: '',
    critical: '',
  };

  const title = `${priorityEmoji[escalation.priority]} Negotiation Review Required`;

  let body: string;
  switch (escalation.reason) {
    case 'budget_exceeded':
      body = `A negotiation requires approval because the proposed price exceeds your budget. ${escalation.details}`;
      break;
    case 'high_value_deal':
      body = `A high-value deal requires your review before proceeding. ${escalation.details}`;
      break;
    case 'new_counterparty':
      body = `This is a first-time transaction with a new supplier. Please review before proceeding.`;
      break;
    case 'stalemate':
      body = `The negotiation has reached a stalemate. Your guidance is needed to proceed.`;
      break;
    case 'low_confidence':
      body = `The AI has low confidence in the current negotiation direction. Please review.`;
      break;
    default:
      body = escalation.details;
  }

  const action = escalation.suggestedAction || 'Review and decide';

  return { title, body, action };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const EscalationService = {
  checkEscalationTriggers,
  createEscalation,
  getEscalation,
  getPendingEscalations,
  getEscalationBySession,
  resolveEscalation,
  assignEscalation,
  expireOldEscalations,
  generateEscalationNotification,
  THRESHOLDS,
};

export default EscalationService;
