/**
 * RFQ Transaction Flow - Type Definitions
 * Complete type system for AI-to-AI negotiation and procurement
 */

// ============================================================================
// CONSTRAINTS - Buyer negotiation limits
// ============================================================================

export interface RFQConstraints {
  id: string;
  rfqId: string;

  // Budget constraints
  maxTotalBudget?: number;
  maxUnitPrice?: number;
  targetTotalPrice?: number;
  targetUnitPrice?: number;

  // Timeline constraints
  requiredDeliveryDate?: Date;
  maxLeadTimeDays?: number;
  preferredLeadTimeDays?: number;

  // Payment terms
  acceptablePaymentTerms: string[];
  preferredPaymentTerms?: string;

  // Quality requirements
  minimumWarrantyMonths?: number;
  requiredCertifications: string[];

  // Negotiation preferences
  autoNegotiate: boolean;
  negotiationAggression: 'conservative' | 'balanced' | 'aggressive';
  allowCounterOffers: boolean;
  maxNegotiationRounds: number;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConstraintsInput {
  rfqId: string;
  maxTotalBudget?: number;
  maxUnitPrice?: number;
  targetTotalPrice?: number;
  targetUnitPrice?: number;
  requiredDeliveryDate?: string;
  maxLeadTimeDays?: number;
  preferredLeadTimeDays?: number;
  acceptablePaymentTerms?: string[];
  preferredPaymentTerms?: string;
  minimumWarrantyMonths?: number;
  requiredCertifications?: string[];
  autoNegotiate?: boolean;
  negotiationAggression?: 'conservative' | 'balanced' | 'aggressive';
  allowCounterOffers?: boolean;
  maxNegotiationRounds?: number;
}

// ============================================================================
// QUOTES - Supplier quotes
// ============================================================================

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sku?: string;
}

export interface RFQQuote {
  id: string;
  rfqId: string;
  supplierId: string;

  // Pricing
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  currency: string;

  // Terms
  leadTimeDays: number;
  paymentTerms?: string;
  warrantyMonths?: number;
  shippingCost: number;
  shippingMethod?: string;

  // Quote details
  validUntil?: Date;
  notes?: string;
  lineItems: LineItem[];

  // AI generation
  aiGenerated: boolean;
  aiConfidenceScore?: number;
  sourceCatalogId?: string;

  // Negotiation tracking
  isInitialQuote: boolean;
  parentQuoteId?: string;
  negotiationRound: number;

  // Status
  status: QuoteStatus;
  supplierConfirmed: boolean;
  supplierConfirmedAt?: Date;

  createdAt: Date;
  updatedAt: Date;

  // Joined data
  supplier?: {
    id: string;
    companyName: string;
    contactEmail: string;
  };
}

export type QuoteStatus = 'pending' | 'active' | 'negotiating' | 'accepted' | 'rejected' | 'expired' | 'withdrawn';

export interface CreateQuoteInput {
  rfqId: string;
  supplierId: string;
  unitPrice: number;
  quantity: number;
  leadTimeDays: number;
  paymentTerms?: string;
  warrantyMonths?: number;
  shippingCost?: number;
  shippingMethod?: string;
  validUntil?: string;
  notes?: string;
  lineItems?: LineItem[];
  aiGenerated?: boolean;
  aiConfidenceScore?: number;
  sourceCatalogId?: string;
  parentQuoteId?: string;
}

export interface QuoteComparison {
  rfqId: string;
  quotes: RFQQuote[];
  constraints?: RFQConstraints;
  recommendation?: {
    quoteId: string;
    reason: string;
    score: number;
  };
  analysis: {
    lowestPrice: { quoteId: string; totalPrice: number };
    fastestDelivery: { quoteId: string; leadTimeDays: number };
    bestValue: { quoteId: string; score: number; reason: string };
  };
}

// ============================================================================
// NEGOTIATIONS - AI-to-AI negotiation sessions
// ============================================================================

export interface NegotiationMessage {
  id: string;
  role: 'buyer_ai' | 'supplier_ai' | 'system';
  content: string;
  proposedTerms?: Partial<QuoteTerms>;
  timestamp: Date;
  round: number;
}

export interface QuoteTerms {
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  leadTimeDays: number;
  paymentTerms: string;
  warrantyMonths?: number;
  shippingCost: number;
}

export interface RFQNegotiation {
  id: string;
  rfqId: string;
  quoteId: string;
  supplierId: string;

  // Positions
  buyerConstraints: RFQConstraints;
  initialSupplierPosition: QuoteTerms;
  currentSupplierPosition?: QuoteTerms;

  // State
  status: NegotiationStatus;
  currentRound: number;
  maxRounds: number;

  // History
  messages: NegotiationMessage[];

  // Outcome
  outcome?: NegotiationOutcome;
  finalTerms?: QuoteTerms;
  finalQuoteId?: string;

  // Timing
  startedAt: Date;
  lastActivityAt: Date;
  completedAt?: Date;

  // Analytics
  totalPriceReduction?: number;
  reductionPercentage?: number;
  roundsUsed?: number;
}

export type NegotiationStatus = 'active' | 'paused' | 'completed' | 'failed' | 'timeout' | 'buyer_accepted' | 'supplier_withdrawn';
export type NegotiationOutcome = 'agreement' | 'no_agreement' | 'buyer_accepted' | 'supplier_withdrew' | 'timeout' | 'manual_override';

export interface StartNegotiationInput {
  rfqId: string;
  quoteId: string;
  maxRounds?: number;
}

export interface NegotiationResult {
  negotiation: RFQNegotiation;
  finalQuote?: RFQQuote;
  success: boolean;
  summary: string;
}

// ============================================================================
// AWARDS - Winning quote awards
// ============================================================================

export interface RFQAward {
  id: string;
  rfqId: string;
  quoteId: string;
  supplierId: string;
  negotiationId?: string;

  // Award details
  awardAmount: number;
  awardQuantity: number;
  awardUnitPrice: number;
  awardTerms: QuoteTerms;

  // Deal linkage
  dealId?: string;
  escrowId?: string;

  // ERP integration
  erpConnectionId?: string;
  erpPoId?: string;
  erpPoNumber?: string;
  erpPoCreatedAt?: Date;
  erpVendorId?: string;
  erpSyncStatus: ERPSyncStatus;
  erpSyncError?: string;

  // Status
  status: AwardStatus;

  // Timestamps
  awardedAt: Date;
  supplierAcknowledgedAt?: Date;
  paymentInitiatedAt?: Date;
  paymentCompletedAt?: Date;
}

export type AwardStatus = 'pending' | 'acknowledged' | 'payment_pending' | 'paid' | 'fulfilled' | 'completed' | 'cancelled' | 'disputed';
export type ERPSyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'not_connected';

export interface CreateAwardInput {
  rfqId: string;
  quoteId: string;
  supplierId: string;
  negotiationId?: string;
}

export interface AwardResult {
  award: RFQAward;
  deal?: {
    id: string;
    status: string;
  };
  escrow?: {
    id: string;
    walletAddress: string;
  };
  erpSync?: {
    success: boolean;
    poNumber?: string;
    error?: string;
  };
}

// ============================================================================
// FULFILLMENT - Delivery tracking
// ============================================================================

export interface RFQFulfillment {
  id: string;
  awardId: string;
  rfqId: string;

  // Shipping
  status: FulfillmentStatus;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;

  // Dates
  estimatedShipDate?: Date;
  actualShipDate?: Date;
  estimatedDeliveryDate?: Date;
  actualDeliveryDate?: Date;

  // Delivery confirmation
  deliveryConfirmed: boolean;
  deliveryConfirmedBy?: string;
  deliveryConfirmedAt?: Date;
  deliveryProofUrl?: string;
  deliveryNotes?: string;

  // Quality
  inspectionRequired: boolean;
  inspectionStatus?: 'pending' | 'passed' | 'failed' | 'waived';
  inspectionNotes?: string;

  // ERP receipt
  erpReceiptId?: string;
  erpReceiptCreatedAt?: Date;

  // Issues
  hasIssues: boolean;
  issueDescription?: string;
  issueResolution?: string;

  createdAt: Date;
  updatedAt: Date;
}

export type FulfillmentStatus = 'pending' | 'processing' | 'shipped' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'delayed' | 'cancelled' | 'returned';

export interface UpdateFulfillmentInput {
  status?: FulfillmentStatus;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedShipDate?: string;
  actualShipDate?: string;
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
}

export interface ConfirmDeliveryInput {
  awardId: string;
  confirmedBy: string;
  proofUrl?: string;
  notes?: string;
}

// ============================================================================
// SUPPLIER CATALOG - AI pricing rules
// ============================================================================

export interface VolumeDiscount {
  minQuantity: number;
  maxQuantity?: number;
  discountPercentage: number;
}

export interface SupplierCatalogItem {
  id: string;
  supplierId: string;

  // Product
  productCategory: string;
  productName: string;
  productSku?: string;
  productDescription?: string;

  // Pricing
  baseUnitPrice: number;
  currency: string;
  minimumOrderQty: number;
  volumeDiscounts: VolumeDiscount[];

  // Lead times
  standardLeadTimeDays: number;
  rushLeadTimeDays?: number;
  rushFeePercentage?: number;

  // Terms
  defaultPaymentTerms?: string;
  warrantyMonths?: number;

  // AI config
  aiPricingEnabled: boolean;
  aiMinMarginPercentage: number;
  aiNegotiationFloorPercentage: number;
  aiAutoQuoteEnabled: boolean;

  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// RFQ DOCUMENTS
// ============================================================================

export type DocumentType = 'rfq' | 'rfp' | 'quote_comparison' | 'award_letter' | 'po' | 'invoice' | 'receipt';

export interface RFQDocument {
  id: string;
  rfqId: string;
  documentType: DocumentType;
  version: number;
  title: string;
  content: Record<string, unknown>;
  fileUrl?: string;
  fileFormat?: string;
  fileSizeBytes?: number;
  status: 'draft' | 'final' | 'sent' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// RFQ STATUS FLOW
// ============================================================================

export type RFQStatus =
  | 'open'           // Just created
  | 'matched'        // Suppliers matched
  | 'quoting'        // Waiting for quotes
  | 'negotiating'    // AI negotiation in progress
  | 'quoted'         // Quotes received
  | 'awarded'        // Winner selected
  | 'payment_pending'// Awaiting payment
  | 'paid'           // Payment received
  | 'fulfilling'     // Order being fulfilled
  | 'delivered'      // Goods delivered
  | 'completed'      // Transaction complete
  | 'closed'         // Manually closed
  | 'cancelled';     // Cancelled

export interface RFQWithFlow {
  id: string;
  category: string;
  description: string;
  quantity: number;
  targetPrice?: number;
  urgency: 'standard' | 'urgent' | 'critical';
  deliveryLocation: string;
  requiredCertifications: string[];
  additionalRequirements?: string;
  requestorEmail?: string;
  requestorName?: string;
  status: RFQStatus;
  createdAt: Date;
  updatedAt: Date;

  // Related data
  constraints?: RFQConstraints;
  quotes?: RFQQuote[];
  negotiations?: RFQNegotiation[];
  award?: RFQAward;
  fulfillment?: RFQFulfillment;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface RFQFlowResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface QuotesResponse {
  quotes: RFQQuote[];
  comparison?: QuoteComparison;
  constraints?: RFQConstraints;
}

export interface NegotiationStatusResponse {
  negotiation: RFQNegotiation;
  currentOffer?: QuoteTerms;
  buyerPosition?: QuoteTerms;
  progress: {
    round: number;
    maxRounds: number;
    priceReduction: number;
    reductionPercentage: number;
  };
}

export interface CompleteRFQResponse {
  rfq: RFQWithFlow;
  award: RFQAward;
  fulfillment: RFQFulfillment;
  erpSync: {
    poCreated: boolean;
    poNumber?: string;
    invoiceCreated: boolean;
    invoiceNumber?: string;
    receiptCreated: boolean;
    receiptNumber?: string;
  };
  payment: {
    escrowReleased: boolean;
    sellerPaid: boolean;
    feeCollected: number;
  };
}
