/**
 * Wells AI Settlement Layer - Type Definitions
 *
 * Core principle: Every transaction is born split.
 * Fee is captured at settlement, not via invoicing.
 */

export type SettlementStatus =
  | 'created'      // Intent created, not yet authorized
  | 'authorized'   // Payment authorized, awaiting settlement
  | 'settled'      // Funds distributed (net to seller, fee to Wells)
  | 'failed'       // Settlement failed
  | 'refunded'     // Fully refunded (fee reversed)
  | 'partial_refund' // Partially refunded

export type FeePayer = 'seller' | 'buyer' | 'split'

export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD'

// Currency precision for fee rounding
export const CURRENCY_PRECISION: Record<Currency, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  CAD: 2,
  AUD: 2
}

// Default fee in basis points (33bps = 0.33%)
export const DEFAULT_FEE_BPS = 33

/**
 * SettlementIntent - The core data model
 * Every payment flows through this structure
 */
export interface SettlementIntent {
  intent_id: string

  // Parties
  buyer_id: string
  seller_id: string

  // Amounts (all in smallest currency unit, e.g., cents)
  gross_amount: number          // What buyer pays
  fee_bps: number               // Basis points (default 33)
  raw_fee: number               // Unrounded fee for audit
  rounded_fee: number           // Actual fee captured
  net_amount: number            // What seller receives

  // Fee configuration
  fee_payer: FeePayer           // Who absorbs the fee

  // Currency
  currency: Currency

  // Status
  status: SettlementStatus

  // ERP/External references
  erp_reference?: string        // PO / invoice / doc ID
  external_payment_id?: string  // Stripe/Circle/etc payment ID

  // Idempotency
  idempotency_key: string

  // Timestamps
  created_at: Date
  authorized_at?: Date
  settled_at?: Date
  failed_at?: Date
  refunded_at?: Date

  // Metadata
  metadata?: Record<string, any>
}

/**
 * CreateIntentRequest - API input
 */
export interface CreateIntentRequest {
  amount: number                // Gross amount in smallest currency unit
  seller_id: string
  buyer_id: string
  currency?: Currency           // Default USD
  erp_reference?: string
  fee_bps?: number              // Override default 33bps
  fee_payer?: FeePayer          // Default 'seller'
  idempotency_key: string       // Required for retry safety
  metadata?: Record<string, any>
}

/**
 * SettlementResult - What happens after settlement
 */
export interface SettlementResult {
  intent_id: string
  status: SettlementStatus

  // Distribution
  seller_received: number
  wells_fee_captured: number

  // References
  seller_transfer_id?: string
  fee_transfer_id?: string

  settled_at: Date
}

/**
 * RefundRequest - For refunds
 */
export interface RefundRequest {
  intent_id: string
  amount?: number               // Partial refund amount, or full if omitted
  reason?: string
  reverse_fee?: boolean         // Default true - proportionally reverse fee
}

/**
 * LedgerEntry - Immutable audit trail
 */
export interface LedgerEntry {
  entry_id: string
  intent_id: string
  entry_type: 'credit' | 'debit'
  account_type: 'buyer' | 'seller' | 'wells_treasury'
  account_id: string
  amount: number
  currency: Currency
  balance_after?: number
  description: string
  created_at: Date

  // For reversals
  reverses_entry_id?: string
}

/**
 * Webhook event types
 */
export type WebhookEventType =
  | 'intent.created'
  | 'intent.authorized'
  | 'intent.settled'
  | 'intent.failed'
  | 'intent.refunded'

export interface WebhookEvent {
  event_id: string
  event_type: WebhookEventType
  intent_id: string
  payload: SettlementIntent
  created_at: Date
}
