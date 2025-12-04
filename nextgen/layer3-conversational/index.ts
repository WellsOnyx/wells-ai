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

// API route handlers
export { POST as createPO } from './api/route-create-po'
export { POST as updateVendor } from './api/route-update-vendor'
export { GET as getSummary } from './api/route-summary'
