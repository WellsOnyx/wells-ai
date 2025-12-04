/**
 * Layer 3: Conversational ERP Mode
 *
 * WellsAI interface for natural language ERP interactions.
 * Enables users to create POs, approve invoices, check balances,
 * and manage payments through conversation.
 *
 * Key capabilities:
 * - Intent detection (create_po, approve_invoice, pay_vendor, etc.)
 * - Entity extraction (amounts, vendors, dates, line items)
 * - Auto-suggest and field inference
 * - Multi-turn conversation state machine
 * - Authorization flow integration
 * - Quick replies and suggested actions
 */

// Types and interfaces
export * from './types'

// Services - Intent Classification
export {
  classifyIntent,
  extractEntities,
  getMissingFields,
  generateQuickReplies,
  getFieldPrompt,
} from './services/intent-classifier'

// Services - State Machine
export {
  createConversation,
  ConversationStateMachine,
} from './services/state-machine'

// API route handlers
export { POST as createPO, suggestFields, validateLineItem } from './api/route-create-po'
export { POST as updateVendor } from './api/route-update-vendor'
export { GET as getSummary } from './api/route-summary'

// Re-export key types for convenience
export type {
  ErpIntent,
  IntentDefinition,
  ExtractedEntities,
  ConversationState,
  ConversationContext,
  StateTransition,
  ActionResult,
  ConversationalRequest,
  ConversationalResponse,
  SuggestedAction,
} from './types'
