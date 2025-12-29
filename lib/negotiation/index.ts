/**
 * AI-to-AI Negotiation System
 *
 * Autonomous negotiation between Buyer Wells agents and Seller Wells agents.
 *
 * Usage:
 *
 * // Conversational (from chat):
 * const result = await processConversationalRequest(
 *   userId,
 *   orgId,
 *   orgName,
 *   "find me a supplier for 1000 ball bearings"
 * );
 *
 * // The system will:
 * // 1. Parse the request
 * // 2. Find matching seller agents
 * // 3. Create negotiation sessions
 * // 4. Run AI-to-AI negotiations
 * // 5. Return best offers
 *
 * // User approves via chat:
 * // "go with Precision Bearings"
 *
 * // System creates PO and initiates escrow
 *
 * @module lib/negotiation
 */

// Protocol types and builders
export {
  // Version
  PROTOCOL_VERSION,

  // Types
  type AgentType,
  type AgentIdentity,
  type AgentLimits,
  type NegotiationMessageType,
  type NegotiationTerms,
  type TermConstraints,
  type NegotiationProtocolMessage,
  type SessionStatus,
  type NegotiationSession,
  type SessionAnalytics,
  type SellerAgentRegistration,
  type VolumeDiscount,
  type RoutingRequest,
  type RoutingResult,
  type SellerAgentMatch,

  // Builders
  createProtocolMessage,
  createInitialSession,

  // Validators
  validateTerms,
  termsWithinConstraints,
  calculateMidpoint,
} from './protocol';

// AI Router
export {
  // Session management
  createNegotiationSession,
  getSession,
  getSessionsByRFQ,

  // Routing
  findMatchingSellerAgents,

  // Message routing
  routeMessage,

  // Full negotiation
  runFullNegotiation,

  // Conversational interface
  processConversationalRequest,

  // Default export
  default as AIRouter,
} from './ai-router';

// Escalation Service
export {
  // Types
  type EscalationReason,
  type EscalationPriority,
  type EscalationStatus,
  type EscalationResult,
  type Escalation,
  type EscalationDecision,

  // Functions
  checkEscalationTriggers,
  createEscalation,
  getEscalation,
  getPendingEscalations,
  getEscalationBySession,
  resolveEscalation,
  assignEscalation,
  expireOldEscalations,
  generateEscalationNotification,

  // Constants
  EscalationService,
} from './escalation-service';

// ============================================================================
// QUICK START EXAMPLE
// ============================================================================

/**
 * Quick start example for chat integration:
 *
 * ```typescript
 * import { processConversationalRequest, getSession } from '@/lib/negotiation';
 *
 * // In your chat handler:
 * async function handleUserMessage(userId: string, message: string) {
 *   // Detect procurement intent
 *   if (isProcurementRequest(message)) {
 *     const result = await processConversationalRequest(
 *       userId,
 *       'org_123',
 *       'Acme Corp',
 *       message
 *     );
 *
 *     // Return status to chat
 *     return result.statusMessage;
 *     // "I negotiated with 3 suppliers. Best offer: $4.50/unit from Precision Bearings.
 *     //  I saved you 12.5% off the initial quote. Say 'go with Precision Bearings' to proceed."
 *   }
 *
 *   // Detect approval intent
 *   if (isApprovalCommand(message)) {
 *     const supplierName = extractSupplierName(message);
 *     const sessionId = getActiveSessionForSupplier(supplierName);
 *
 *     // Call decide endpoint
 *     const response = await fetch(`/api/negotiate/${sessionId}/decide`, {
 *       method: 'POST',
 *       body: JSON.stringify({
 *         decision: 'select_supplier',
 *         supplierName,
 *       }),
 *     });
 *
 *     const result = await response.json();
 *     return `Done! I created PO #${result.award.id} for $${result.award.amount}.
 *       ${result.award.supplierName} will deliver in ${result.award.leadTimeDays} days.`;
 *   }
 * }
 * ```
 */
