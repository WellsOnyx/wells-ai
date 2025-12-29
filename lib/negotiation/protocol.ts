/**
 * AI-to-AI Negotiation Protocol
 *
 * Standard message format for autonomous negotiation between
 * Buyer Wells agents and Seller Wells agents.
 *
 * Protocol Version: 1.0
 *
 * @module lib/negotiation/protocol
 */

// ============================================================================
// PROTOCOL VERSION
// ============================================================================

export const PROTOCOL_VERSION = '1.0';

// ============================================================================
// AGENT TYPES
// ============================================================================

export type AgentType = 'buyer' | 'seller';

export interface AgentIdentity {
  /** Type of agent: buyer or seller */
  agentType: AgentType;

  /** Unique identifier for this agent instance */
  agentId: string;

  /** Organization this agent represents */
  organizationId: string;

  /** Organization name for display */
  organizationName: string;

  /** Whether this is a human-controlled agent or fully autonomous */
  autonomous: boolean;

  /** Agent's authorized limits */
  limits: AgentLimits;
}

export interface AgentLimits {
  /** For buyers: maximum budget. For sellers: minimum acceptable price */
  priceBoundary: number;

  /** Maximum quantity this agent can transact */
  maxQuantity?: number;

  /** Maximum lead time in days (buyers) or minimum (sellers) */
  leadTimeBoundary?: number;

  /** Acceptable payment terms */
  acceptablePaymentTerms: string[];

  /** Required certifications (buyers) or available certifications (sellers) */
  certifications: string[];

  /** Whether agent can auto-approve within limits */
  autoApproveEnabled: boolean;

  /** Threshold above which escalation is required (for sellers, percentage below floor) */
  escalationThreshold: number;
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export type NegotiationMessageType =
  | 'proposal'        // Initial or counter proposal
  | 'counter'         // Counter-offer to a proposal
  | 'accept'          // Accept the current terms
  | 'reject'          // Reject and end negotiation
  | 'info_request'    // Request additional information
  | 'info_response'   // Response to information request
  | 'escalate'        // Escalate to human review
  | 'hold'            // Pause for human review
  | 'resume';         // Resume after human review

// ============================================================================
// NEGOTIATION TERMS
// ============================================================================

export interface NegotiationTerms {
  /** Price per unit */
  unitPrice: number;

  /** Total quantity */
  quantity: number;

  /** Total price (unitPrice * quantity + shipping) */
  totalPrice: number;

  /** Currency code (ISO 4217) */
  currency: string;

  /** Lead time in days */
  leadTimeDays: number;

  /** Payment terms (e.g., "Net 30", "50% upfront") */
  paymentTerms: string;

  /** Warranty period in months */
  warrantyMonths?: number;

  /** Shipping cost */
  shippingCost: number;

  /** Shipping method */
  shippingMethod?: string;

  /** Additional terms as key-value pairs */
  additionalTerms?: Record<string, string | number | boolean>;
}

export interface TermConstraints {
  /** Minimum acceptable unit price (seller) or maximum (buyer) */
  unitPriceBound: number;

  /** Whether this is a hard limit or soft (negotiable) */
  isHardLimit: boolean;

  /** Minimum acceptable total (seller) or maximum (buyer) */
  totalPriceBound?: number;

  /** Lead time requirement */
  leadTimeBound?: number;

  /** Non-negotiable terms */
  nonNegotiable: string[];

  /** Terms that can be traded off */
  flexible: string[];
}

// ============================================================================
// PROTOCOL MESSAGE
// ============================================================================

export interface NegotiationProtocolMessage {
  /** Protocol version for compatibility */
  version: string;

  /** Unique message ID */
  messageId: string;

  /** Session this message belongs to */
  sessionId: string;

  /** Current negotiation round (1-indexed) */
  round: number;

  /** Timestamp of message creation */
  timestamp: string;

  /** Sender information */
  sender: AgentIdentity;

  /** Message type */
  type: NegotiationMessageType;

  /** Current proposed terms (null for info_request/escalate) */
  terms: NegotiationTerms | null;

  /** Sender's constraints (what they can accept) */
  constraints: TermConstraints;

  /** Human-readable message/reasoning */
  message: string;

  /** Internal reasoning (for audit, not shared with counterparty) */
  internalReasoning?: string;

  /** Whether this message requires human escalation */
  requiresEscalation: boolean;

  /** Reason for escalation if required */
  escalationReason?: string;

  /** AI confidence in this proposal (0-100) */
  confidence: number;

  /** Reference to the message this is responding to */
  inResponseTo?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// SESSION TYPES
// ============================================================================

export type SessionStatus =
  | 'initializing'    // Session being set up
  | 'active'          // Active negotiation
  | 'awaiting_human'  // Paused for human review
  | 'agreed'          // Agreement reached
  | 'rejected'        // No agreement, one party rejected
  | 'stalemate'       // No progress after max rounds
  | 'expired'         // Session timed out
  | 'cancelled';      // Manually cancelled

export interface NegotiationSession {
  /** Unique session ID */
  id: string;

  /** Protocol version */
  protocolVersion: string;

  /** Reference to the RFQ being negotiated */
  rfqId: string;

  /** Reference to the initial quote */
  quoteId: string;

  /** Buyer agent identity */
  buyerAgent: AgentIdentity;

  /** Seller agent identity */
  sellerAgent: AgentIdentity;

  /** Subject of negotiation (product description) */
  subject: string;

  /** Current session status */
  status: SessionStatus;

  /** Current round number */
  currentRound: number;

  /** Maximum allowed rounds */
  maxRounds: number;

  /** Initial terms from seller */
  initialTerms: NegotiationTerms;

  /** Current best terms (last proposal) */
  currentTerms?: NegotiationTerms;

  /** Final agreed terms (if agreed) */
  finalTerms?: NegotiationTerms;

  /** All messages in this session */
  messages: NegotiationProtocolMessage[];

  /** Session creation time */
  createdAt: string;

  /** Last activity time */
  lastActivityAt: string;

  /** Expiration time */
  expiresAt: string;

  /** Completed time */
  completedAt?: string;

  /** Analytics data */
  analytics: SessionAnalytics;
}

export interface SessionAnalytics {
  /** Total price reduction from initial to final */
  priceReduction?: number;

  /** Percentage reduction */
  reductionPercentage?: number;

  /** Number of rounds used */
  roundsUsed: number;

  /** Average response time in ms */
  avgResponseTimeMs?: number;

  /** Number of escalations */
  escalationCount: number;

  /** Whether agreement was reached */
  agreementReached: boolean;

  /** Time to agreement in ms */
  timeToAgreementMs?: number;
}

// ============================================================================
// ROUTING TYPES
// ============================================================================

export interface SellerAgentRegistration {
  /** Unique seller agent ID */
  agentId: string;

  /** Supplier ID in our system */
  supplierId: string;

  /** Organization name */
  organizationName: string;

  /** Product categories this agent can negotiate */
  categories: string[];

  /** Certifications this agent can offer */
  certifications: string[];

  /** Whether agent is currently active */
  active: boolean;

  /** Agent's pricing rules */
  pricingRules: {
    baseMargin: number;
    minMargin: number;
    volumeDiscounts: VolumeDiscount[];
    rushFeePercentage?: number;
  };

  /** Agent's capacity constraints */
  capacityConstraints: {
    maxMonthlyVolume: number;
    currentUtilization: number;
    leadTimeDays: number;
    rushLeadTimeDays?: number;
  };

  /** Registration timestamp */
  registeredAt: string;

  /** Last activity timestamp */
  lastActiveAt: string;
}

export interface VolumeDiscount {
  minQuantity: number;
  maxQuantity?: number;
  discountPercentage: number;
}

export interface RoutingRequest {
  /** RFQ details */
  rfqId: string;
  category: string;
  description: string;
  quantity: number;
  targetPrice?: number;
  urgency: 'standard' | 'urgent' | 'critical';
  requiredCertifications: string[];
  deliveryLocation: string;

  /** Buyer agent making the request */
  buyerAgent: AgentIdentity;

  /** Matching preferences */
  preferences: {
    maxSellers: number;
    prioritizePrice: boolean;
    prioritizeSpeed: boolean;
    preferredSuppliers?: string[];
    excludedSuppliers?: string[];
  };
}

export interface RoutingResult {
  /** Matched seller agents */
  matchedAgents: SellerAgentMatch[];

  /** Total agents considered */
  totalConsidered: number;

  /** Routing timestamp */
  routedAt: string;
}

export interface SellerAgentMatch {
  /** The seller agent */
  agent: SellerAgentRegistration;

  /** Match score (0-100) */
  matchScore: number;

  /** Estimated initial price */
  estimatedPrice: number;

  /** Estimated lead time */
  estimatedLeadTime: number;

  /** Match reasons */
  matchReasons: string[];

  /** Potential concerns */
  concerns: string[];
}

// ============================================================================
// PROTOCOL MESSAGE BUILDERS
// ============================================================================

export function createProtocolMessage(params: {
  sessionId: string;
  round: number;
  sender: AgentIdentity;
  type: NegotiationMessageType;
  terms: NegotiationTerms | null;
  constraints: TermConstraints;
  message: string;
  internalReasoning?: string;
  requiresEscalation?: boolean;
  escalationReason?: string;
  confidence?: number;
  inResponseTo?: string;
  metadata?: Record<string, unknown>;
}): NegotiationProtocolMessage {
  return {
    version: PROTOCOL_VERSION,
    messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    sessionId: params.sessionId,
    round: params.round,
    timestamp: new Date().toISOString(),
    sender: params.sender,
    type: params.type,
    terms: params.terms,
    constraints: params.constraints,
    message: params.message,
    internalReasoning: params.internalReasoning,
    requiresEscalation: params.requiresEscalation || false,
    escalationReason: params.escalationReason,
    confidence: params.confidence ?? 80,
    inResponseTo: params.inResponseTo,
    metadata: params.metadata,
  };
}

export function createInitialSession(params: {
  rfqId: string;
  quoteId: string;
  buyerAgent: AgentIdentity;
  sellerAgent: AgentIdentity;
  subject: string;
  initialTerms: NegotiationTerms;
  maxRounds?: number;
  expirationMinutes?: number;
}): NegotiationSession {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (params.expirationMinutes || 30) * 60 * 1000);

  return {
    id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    protocolVersion: PROTOCOL_VERSION,
    rfqId: params.rfqId,
    quoteId: params.quoteId,
    buyerAgent: params.buyerAgent,
    sellerAgent: params.sellerAgent,
    subject: params.subject,
    status: 'initializing',
    currentRound: 0,
    maxRounds: params.maxRounds || 5,
    initialTerms: params.initialTerms,
    messages: [],
    createdAt: now.toISOString(),
    lastActivityAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    analytics: {
      roundsUsed: 0,
      escalationCount: 0,
      agreementReached: false,
    },
  };
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validateTerms(terms: NegotiationTerms): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (terms.unitPrice <= 0) errors.push('Unit price must be positive');
  if (terms.quantity <= 0) errors.push('Quantity must be positive');
  if (terms.totalPrice <= 0) errors.push('Total price must be positive');
  if (terms.leadTimeDays < 0) errors.push('Lead time cannot be negative');
  if (terms.shippingCost < 0) errors.push('Shipping cost cannot be negative');

  // Validate total price calculation
  const expectedTotal = terms.unitPrice * terms.quantity + terms.shippingCost;
  if (Math.abs(terms.totalPrice - expectedTotal) > 0.01) {
    errors.push('Total price does not match unit price * quantity + shipping');
  }

  return { valid: errors.length === 0, errors };
}

export function termsWithinConstraints(
  terms: NegotiationTerms,
  constraints: TermConstraints,
  agentType: AgentType
): { acceptable: boolean; violations: string[] } {
  const violations: string[] = [];

  if (agentType === 'buyer') {
    // Buyer constraints: terms should be AT OR BELOW bounds
    if (terms.unitPrice > constraints.unitPriceBound) {
      violations.push(`Unit price ${terms.unitPrice} exceeds max ${constraints.unitPriceBound}`);
    }
    if (constraints.totalPriceBound && terms.totalPrice > constraints.totalPriceBound) {
      violations.push(`Total price ${terms.totalPrice} exceeds max ${constraints.totalPriceBound}`);
    }
    if (constraints.leadTimeBound && terms.leadTimeDays > constraints.leadTimeBound) {
      violations.push(`Lead time ${terms.leadTimeDays} exceeds max ${constraints.leadTimeBound}`);
    }
  } else {
    // Seller constraints: terms should be AT OR ABOVE bounds
    if (terms.unitPrice < constraints.unitPriceBound) {
      violations.push(`Unit price ${terms.unitPrice} below min ${constraints.unitPriceBound}`);
    }
    if (constraints.totalPriceBound && terms.totalPrice < constraints.totalPriceBound) {
      violations.push(`Total price ${terms.totalPrice} below min ${constraints.totalPriceBound}`);
    }
    if (constraints.leadTimeBound && terms.leadTimeDays < constraints.leadTimeBound) {
      violations.push(`Lead time ${terms.leadTimeDays} below min ${constraints.leadTimeBound}`);
    }
  }

  return { acceptable: violations.length === 0, violations };
}

export function calculateMidpoint(
  buyerTerms: NegotiationTerms,
  sellerTerms: NegotiationTerms
): NegotiationTerms {
  return {
    unitPrice: (buyerTerms.unitPrice + sellerTerms.unitPrice) / 2,
    quantity: buyerTerms.quantity, // Quantity usually stays fixed
    totalPrice: ((buyerTerms.unitPrice + sellerTerms.unitPrice) / 2) * buyerTerms.quantity +
      (buyerTerms.shippingCost + sellerTerms.shippingCost) / 2,
    currency: buyerTerms.currency,
    leadTimeDays: Math.ceil((buyerTerms.leadTimeDays + sellerTerms.leadTimeDays) / 2),
    paymentTerms: buyerTerms.paymentTerms, // Default to buyer's preferred terms
    warrantyMonths: Math.max(buyerTerms.warrantyMonths || 0, sellerTerms.warrantyMonths || 0),
    shippingCost: (buyerTerms.shippingCost + sellerTerms.shippingCost) / 2,
    shippingMethod: sellerTerms.shippingMethod,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  PROTOCOL_VERSION,
  createProtocolMessage,
  createInitialSession,
  validateTerms,
  termsWithinConstraints,
  calculateMidpoint,
};
