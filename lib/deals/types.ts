/**
 * Frictionless B2B Deal Types
 *
 * "Yes, proceed" = deal done, money escrowed, everyone wins
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export type DealStatus =
  | 'proposed'    // Initial proposal
  | 'accepted'    // Both parties confirmed
  | 'funded'      // Escrow funded
  | 'delivered'   // Goods/services delivered
  | 'completed'   // Funds released, deal done
  | 'disputed'    // Under dispute
  | 'cancelled'   // Cancelled before completion
  | 'refunded'    // Refunded after dispute

export type PaymentTerms = 'immediate' | 'net30' | 'net60' | 'milestone'

export type PaymentMethod = 'escrow' | 'direct' | 'credit_line'

export type DeliveryType = 'confirmation' | 'tracking' | 'milestone' | 'auto'

export type ConfirmationMethod = 'chat' | 'voice' | 'button' | 'api' | 'email' | 'sms'

export type TrustLevel = 'standard' | 'elevated' | 'unlimited'

// ============================================================================
// B2B DEAL
// ============================================================================

export interface B2BDeal {
  id: string

  // Parties
  buyerId: string
  buyerCompany?: string
  buyerEmail?: string
  sellerId: string
  sellerCompany?: string
  sellerEmail?: string

  // Deal Terms
  title: string
  description?: string
  amount: number
  currency: string
  grainAmount?: number
  grainPriceAtDeal?: number

  // Payment Terms
  paymentTerms: PaymentTerms
  paymentMethod: PaymentMethod

  // Escrow
  escrowId?: string
  escrowFunded: boolean
  escrowFundedAt?: Date

  // Delivery
  deliveryType: DeliveryType
  expectedDelivery?: Date
  actualDelivery?: Date

  // Status
  status: DealStatus

  // Confirmations
  buyerConfirmed: boolean
  buyerConfirmedAt?: Date
  buyerConfirmationMethod?: ConfirmationMethod
  buyerConfirmationMessage?: string

  sellerConfirmed: boolean
  sellerConfirmedAt?: Date
  sellerConfirmationMethod?: ConfirmationMethod
  sellerConfirmationMessage?: string

  // Auto-settlement
  autoRelease: boolean
  autoReleaseDays: number

  // Fees
  platformFee?: number
  feePaid: boolean

  // References
  rfqId?: string
  quoteId?: string
  invoiceId?: string
  contractId?: string
  conversationId?: string

  // Metadata
  termsSnapshot?: Record<string, unknown>
  metadata?: Record<string, unknown>

  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// DEAL CONFIRMATION
// ============================================================================

export interface DealConfirmation {
  id: string
  dealId: string

  // Who
  userId: string
  role: 'buyer' | 'seller'

  // How
  method: ConfirmationMethod
  channel?: string

  // What
  message?: string
  intentScore?: number

  // Context
  conversationId?: string
  messageId?: string

  // Binding
  isBinding: boolean
  ipAddress?: string
  userAgent?: string

  createdAt: Date
}

// ============================================================================
// TRUSTED PARTY
// ============================================================================

export interface TrustedParty {
  id: string
  userId: string
  trustedUserId: string

  trustLevel: TrustLevel

  // Limits
  maxDealAmount?: number
  dailyLimit?: number
  monthlyLimit?: number

  // Auto-approve
  autoApprove: boolean
  autoFund: boolean
  autoRelease: boolean

  // Stats
  totalDeals: number
  totalVolume: number
  successfulDeals: number
  disputedDeals: number

  isActive: boolean

  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// INSTANT OFFER
// ============================================================================

export type OfferStatus = 'open' | 'accepted' | 'rejected' | 'expired' | 'withdrawn'

export interface InstantOffer {
  id: string

  fromUserId: string
  fromCompany?: string
  toUserId?: string
  toCompany?: string

  title: string
  description?: string
  amount: number
  currency: string

  paymentTerms: PaymentTerms
  deliveryTerms?: string
  validUntil?: Date

  status: OfferStatus

  acceptedBy?: string
  acceptedAt?: Date
  dealId?: string

  metadata?: Record<string, unknown>

  createdAt: Date
}

// ============================================================================
// DEAL INVOICE
// ============================================================================

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'

export interface DealInvoice {
  id: string
  dealId: string
  invoiceNumber: string

  fromUserId: string
  fromCompany?: string
  fromAddress?: Record<string, unknown>

  toUserId: string
  toCompany?: string
  toAddress?: Record<string, unknown>

  subtotal: number
  taxAmount: number
  taxRate?: number
  total: number
  currency: string

  status: InvoiceStatus

  issueDate: Date
  dueDate?: Date
  paidAt?: Date

  pdfUrl?: string

  createdAt: Date
}

// ============================================================================
// DEAL TEMPLATE
// ============================================================================

export interface DealTemplate {
  id: string
  userId: string
  companyId?: string

  name: string
  description?: string

  defaultPaymentTerms: PaymentTerms
  defaultPaymentMethod: PaymentMethod
  defaultDeliveryType: DeliveryType
  defaultAutoRelease: boolean
  defaultAutoReleaseDays: number

  pricingType: 'fixed' | 'tiered' | 'custom'
  fixedPrice?: number
  priceTiers?: PriceTier[]

  minAmount?: number
  maxAmount?: number
  requiresApprovalAbove?: number

  autoAccept: boolean
  autoAcceptFrom?: string[]

  isActive: boolean

  createdAt: Date
  updatedAt: Date
}

export interface PriceTier {
  minQuantity: number
  maxQuantity?: number
  pricePerUnit: number
}

// ============================================================================
// API TYPES
// ============================================================================

export interface CreateDealInput {
  // Parties
  buyerId: string
  sellerId: string
  buyerCompany?: string
  sellerCompany?: string

  // Terms
  title: string
  description?: string
  amount: number
  currency?: string

  // Options
  paymentTerms?: PaymentTerms
  paymentMethod?: PaymentMethod
  deliveryType?: DeliveryType
  expectedDelivery?: Date

  // Auto-settlement
  autoRelease?: boolean
  autoReleaseDays?: number

  // References
  rfqId?: string
  quoteId?: string
  conversationId?: string
}

export interface ConfirmDealInput {
  dealId: string
  userId: string
  role: 'buyer' | 'seller'

  method: ConfirmationMethod
  channel?: string
  message?: string

  conversationId?: string
  messageId?: string

  ipAddress?: string
  userAgent?: string
}

export interface AcceptOfferInput {
  offerId: string
  userId: string
  company?: string
}

export interface CreateOfferInput {
  toUserId?: string
  toCompany?: string

  title: string
  description?: string
  amount: number
  currency?: string

  paymentTerms?: PaymentTerms
  deliveryTerms?: string
  validForHours?: number
}

export interface AddTrustedPartyInput {
  trustedUserId: string
  trustLevel?: TrustLevel
  maxDealAmount?: number
  dailyLimit?: number
  monthlyLimit?: number
  autoApprove?: boolean
  autoFund?: boolean
  autoRelease?: boolean
}

// ============================================================================
// CONFIRMATION PHRASES
// ============================================================================

// Phrases that indicate agreement/confirmation
export const CONFIRMATION_PHRASES = [
  'yes',
  'yes proceed',
  'proceed',
  'go ahead',
  'approved',
  'approve',
  'accept',
  'accepted',
  'deal',
  'done',
  'agreed',
  'agree',
  'confirm',
  'confirmed',
  'lets do it',
  "let's do it",
  'sounds good',
  'works for me',
  'im in',
  "i'm in",
  'we accept',
  'i accept',
  'make it happen',
  'ship it',
  'send it',
  'locked in',
  'lock it in',
  'good to go',
  'gtg',
  'lgtm',
  'looks good',
  'thumbs up',
  '👍',
  '✅',
  'yes please',
  'absolutely',
  'definitely',
  'for sure',
]

// Phrases that indicate rejection
export const REJECTION_PHRASES = [
  'no',
  'reject',
  'rejected',
  'decline',
  'declined',
  'pass',
  'not interested',
  'cancel',
  'cancelled',
  'nevermind',
  'never mind',
  'forget it',
  '👎',
  '❌',
]

// ============================================================================
// INTENT ANALYSIS
// ============================================================================

export interface IntentAnalysis {
  intent: 'confirm' | 'reject' | 'negotiate' | 'clarify' | 'unknown'
  confidence: number
  extractedTerms?: {
    amount?: number
    timeline?: string
    conditions?: string[]
  }
  suggestedResponse?: string
}
