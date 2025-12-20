/**
 * RFQ Transaction Flow - Type Definitions
 * Complete type system for AI-to-AI negotiation and procurement
 *
 * @module lib/rfq/types
 * @description TypeScript interfaces matching the schema-rfq-flow.sql database schema
 */

// ============================================================================
// STATUS & OUTCOME ENUMS (Helper Types)
// ============================================================================

/**
 * Quote status values matching the rfq_quotes.status constraint
 * @see schema-rfq-flow.sql TABLE 2: rfq_quotes
 */
export type QuoteStatus =
  | 'pending'      // Quote submitted, awaiting review
  | 'active'       // Quote is active and valid
  | 'negotiating'  // Currently in negotiation
  | 'accepted'     // Quote accepted by buyer
  | 'rejected'     // Quote rejected by buyer
  | 'expired'      // Quote validity period ended
  | 'withdrawn';   // Supplier withdrew the quote

/**
 * Negotiation session status values matching rfq_negotiations.status constraint
 * @see schema-rfq-flow.sql TABLE 3: rfq_negotiations
 */
export type NegotiationStatus =
  | 'active'              // Negotiation in progress
  | 'paused'              // Negotiation temporarily paused
  | 'completed'           // Negotiation finished with outcome
  | 'failed'              // Negotiation failed (error)
  | 'timeout'             // Negotiation exceeded time limit
  | 'buyer_accepted'      // Buyer accepted current terms
  | 'supplier_withdrawn'; // Supplier withdrew from negotiation

/**
 * Negotiation outcome values matching rfq_negotiations.outcome constraint
 * @see schema-rfq-flow.sql TABLE 3: rfq_negotiations
 */
export type NegotiationOutcome =
  | 'agreement'       // Both parties reached agreement
  | 'no_agreement'    // No agreement reached
  | 'buyer_accepted'  // Buyer accepted without full agreement
  | 'supplier_withdrew' // Supplier withdrew
  | 'timeout'         // Negotiation timed out
  | 'manual_override'; // Human intervened

/**
 * Award status values matching rfq_awards.status constraint
 * @see schema-rfq-flow.sql TABLE 4: rfq_awards
 */
export type AwardStatus =
  | 'pending'          // Award created, awaiting acknowledgment
  | 'acknowledged'     // Supplier acknowledged award
  | 'payment_pending'  // Awaiting buyer payment
  | 'paid'             // Payment received
  | 'fulfilled'        // Order fulfilled by supplier
  | 'completed'        // Transaction fully completed
  | 'cancelled'        // Award cancelled
  | 'disputed';        // Award under dispute

/**
 * ERP synchronization status for award records
 * @see schema-rfq-flow.sql TABLE 4: rfq_awards
 */
export type ERPSyncStatus =
  | 'pending'        // ERP sync not yet attempted
  | 'syncing'        // ERP sync in progress
  | 'synced'         // Successfully synced to ERP
  | 'failed'         // ERP sync failed
  | 'not_connected'; // No ERP connection configured

/**
 * Fulfillment status values matching rfq_fulfillment.status constraint
 * @see schema-rfq-flow.sql TABLE 5: rfq_fulfillment
 */
export type FulfillmentStatus =
  | 'pending'          // Fulfillment not started
  | 'processing'       // Order being processed
  | 'shipped'          // Order shipped
  | 'in_transit'       // Order in transit
  | 'out_for_delivery' // Order out for final delivery
  | 'delivered'        // Order delivered
  | 'delayed'          // Delivery delayed
  | 'cancelled'        // Fulfillment cancelled
  | 'returned';        // Order returned

/**
 * Inspection status for quality checks
 * @see schema-rfq-flow.sql TABLE 5: rfq_fulfillment
 */
export type InspectionStatus =
  | 'pending'  // Inspection not yet performed
  | 'passed'   // Inspection passed
  | 'failed'   // Inspection failed
  | 'waived';  // Inspection waived

/**
 * Document type values matching rfq_documents.document_type constraint
 * @see schema-rfq-flow.sql TABLE 6: rfq_documents
 */
export type DocumentType =
  | 'rfq'              // Request for Quote document
  | 'rfp'              // Request for Proposal document
  | 'quote_comparison' // Quote comparison analysis
  | 'award_letter'     // Award notification letter
  | 'po'               // Purchase Order
  | 'invoice'          // Invoice document
  | 'receipt';         // Receipt/proof of delivery

/**
 * Document status values matching rfq_documents.status constraint
 * @see schema-rfq-flow.sql TABLE 6: rfq_documents
 */
export type DocumentStatus =
  | 'draft'     // Document in draft state
  | 'final'     // Document finalized
  | 'sent'      // Document sent to recipient
  | 'archived'; // Document archived

/**
 * Negotiation aggression level for buyer AI behavior
 * @see schema-rfq-flow.sql TABLE 1: rfq_constraints
 */
export type NegotiationAggression =
  | 'conservative' // Prioritize relationship, accept reasonable offers
  | 'balanced'     // Balance price with relationship
  | 'aggressive';  // Maximize savings, push hard

/**
 * RFQ lifecycle status values
 * @see schema-rfq-flow.sql rfqs_status_check constraint
 */
export type RFQStatus =
  | 'open'            // Just created, awaiting suppliers
  | 'matched'         // Suppliers matched to RFQ
  | 'quoting'         // Waiting for supplier quotes
  | 'negotiating'     // AI negotiation in progress
  | 'quoted'          // Quotes received, ready for review
  | 'awarded'         // Winner selected
  | 'payment_pending' // Awaiting buyer payment
  | 'paid'            // Payment received
  | 'fulfilling'      // Order being fulfilled
  | 'delivered'       // Goods delivered
  | 'completed'       // Transaction complete
  | 'closed'          // Manually closed
  | 'cancelled';      // Cancelled

/**
 * Message role in negotiation conversation
 */
export type NegotiationMessageRole =
  | 'buyer_ai'    // Buyer's AI agent
  | 'supplier_ai' // Supplier's AI agent
  | 'system';     // System message

// ============================================================================
// TABLE 1: rfq_constraints (Buyer negotiation limits)
// ============================================================================

/**
 * Buyer-defined constraints for RFQ negotiations
 * Controls AI negotiation behavior and acceptable terms
 *
 * @see schema-rfq-flow.sql TABLE 1: rfq_constraints
 */
export interface RFQConstraints {
  /** Unique constraint record ID (UUID) */
  id: string;

  /** Reference to the parent RFQ (UUID) */
  rfqId: string;

  // Budget constraints
  /** Maximum total budget the buyer will accept */
  maxTotalBudget?: number;

  /** Maximum per-unit price the buyer will accept */
  maxUnitPrice?: number;

  /** Target total price (ideal outcome) */
  targetTotalPrice?: number;

  /** Target per-unit price (ideal outcome) */
  targetUnitPrice?: number;

  // Timeline constraints
  /** Hard deadline for delivery */
  requiredDeliveryDate?: Date;

  /** Maximum acceptable lead time in days */
  maxLeadTimeDays?: number;

  /** Preferred lead time in days */
  preferredLeadTimeDays?: number;

  // Payment terms
  /** List of payment terms the buyer will accept */
  acceptablePaymentTerms: string[];

  /** Preferred payment terms */
  preferredPaymentTerms?: string;

  // Quality requirements
  /** Minimum warranty period in months */
  minimumWarrantyMonths?: number;

  /** Required supplier certifications */
  requiredCertifications: string[];

  // Negotiation preferences
  /** Whether AI should auto-negotiate on buyer's behalf */
  autoNegotiate: boolean;

  /** How aggressively the buyer AI should negotiate */
  negotiationAggression: NegotiationAggression;

  /** Whether to allow counter-offers from supplier */
  allowCounterOffers: boolean;

  /** Maximum number of negotiation rounds */
  maxNegotiationRounds: number;

  /** Timestamp when constraints were created */
  createdAt: Date;

  /** Timestamp when constraints were last updated */
  updatedAt: Date;
}

/**
 * Input for creating RFQ constraints
 */
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
  negotiationAggression?: NegotiationAggression;
  allowCounterOffers?: boolean;
  maxNegotiationRounds?: number;
}

// ============================================================================
// TABLE 2: rfq_quotes (Supplier quotes)
// ============================================================================

/**
 * Individual line item within a quote
 */
export interface LineItem {
  /** Description of the line item */
  description: string;

  /** Quantity of items */
  quantity: number;

  /** Price per unit */
  unitPrice: number;

  /** Total price for this line item */
  totalPrice: number;

  /** Optional SKU reference */
  sku?: string;
}

/**
 * Supplier quote for an RFQ
 * Contains pricing, terms, and negotiation tracking
 *
 * @see schema-rfq-flow.sql TABLE 2: rfq_quotes
 */
export interface RFQQuote {
  /** Unique quote ID (UUID) */
  id: string;

  /** Reference to the parent RFQ (UUID) */
  rfqId: string;

  /** Reference to the supplier (UUID) */
  supplierId: string;

  // Pricing
  /** Price per unit */
  unitPrice: number;

  /** Quantity quoted */
  quantity: number;

  /** Total price (unitPrice * quantity + shipping) */
  totalPrice: number;

  /** Currency code (ISO 4217) */
  currency: string;

  // Terms
  /** Lead time for delivery in days */
  leadTimeDays: number;

  /** Payment terms (e.g., "Net 30") */
  paymentTerms?: string;

  /** Warranty period in months */
  warrantyMonths?: number;

  /** Shipping cost */
  shippingCost: number;

  /** Shipping method description */
  shippingMethod?: string;

  // Quote details
  /** Quote expiration date */
  validUntil?: Date;

  /** Additional notes from supplier */
  notes?: string;

  /** Itemized line items */
  lineItems: LineItem[];

  // AI generation
  /** Whether this quote was AI-generated */
  aiGenerated: boolean;

  /** AI confidence score (0-100) */
  aiConfidenceScore?: number;

  /** Reference to source catalog item */
  sourceCatalogId?: string;

  // Negotiation tracking
  /** Whether this is the initial quote (not a counter-offer) */
  isInitialQuote: boolean;

  /** Reference to parent quote if this is a counter-offer */
  parentQuoteId?: string;

  /** Current negotiation round number */
  negotiationRound: number;

  // Status
  /** Current quote status */
  status: QuoteStatus;

  /** Whether supplier has confirmed the quote */
  supplierConfirmed: boolean;

  /** When supplier confirmed the quote */
  supplierConfirmedAt?: Date;

  /** Timestamp when quote was created */
  createdAt: Date;

  /** Timestamp when quote was last updated */
  updatedAt: Date;

  // Joined data (populated by queries)
  /** Supplier details (optional, populated by joins) */
  supplier?: {
    id: string;
    companyName: string;
    contactEmail: string;
  };
}

/**
 * Input for creating a new quote
 */
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

/**
 * Quote comparison analysis for decision support
 */
export interface QuoteComparison {
  /** RFQ being compared */
  rfqId: string;

  /** All quotes being compared */
  quotes: RFQQuote[];

  /** Buyer constraints for scoring */
  constraints?: RFQConstraints;

  /** AI recommendation */
  recommendation?: {
    quoteId: string;
    reason: string;
    score: number;
  };

  /** Analysis breakdown */
  analysis: {
    lowestPrice: { quoteId: string; totalPrice: number };
    fastestDelivery: { quoteId: string; leadTimeDays: number };
    bestValue: { quoteId: string; score: number; reason: string };
  };
}

// ============================================================================
// TABLE 3: rfq_negotiations (AI-to-AI negotiation sessions)
// ============================================================================

/**
 * Negotiated terms structure used in positions and offers
 */
export interface QuoteTerms {
  /** Price per unit */
  unitPrice: number;

  /** Quantity */
  quantity: number;

  /** Total price */
  totalPrice: number;

  /** Lead time in days */
  leadTimeDays: number;

  /** Payment terms */
  paymentTerms: string;

  /** Warranty in months */
  warrantyMonths?: number;

  /** Shipping cost */
  shippingCost: number;
}

/**
 * Individual message in a negotiation session
 *
 * @see schema-rfq-flow.sql TABLE 3: rfq_negotiations (messages JSONB[])
 */
export interface NegotiationMessage {
  /** Unique message ID */
  id: string;

  /** Who sent the message */
  role: NegotiationMessageRole;

  /** Message content */
  content: string;

  /** Terms being proposed in this message */
  proposedTerms?: Partial<QuoteTerms>;

  /** When the message was sent */
  timestamp: Date;

  /** Negotiation round this message belongs to */
  round: number;
}

/**
 * AI-to-AI negotiation session between buyer and supplier
 * Tracks the full negotiation history and outcome
 *
 * @see schema-rfq-flow.sql TABLE 3: rfq_negotiations
 */
export interface RFQNegotiation {
  /** Unique negotiation ID (UUID) */
  id: string;

  /** Reference to the parent RFQ (UUID) */
  rfqId: string;

  /** Reference to the quote being negotiated (UUID) */
  quoteId: string;

  /** Reference to the supplier (UUID) */
  supplierId: string;

  // Positions
  /** Buyer's constraints and limits (JSONB) */
  buyerConstraints: RFQConstraints;

  /** Supplier's initial position/offer (JSONB) */
  initialSupplierPosition: QuoteTerms;

  /** Supplier's current position (JSONB) */
  currentSupplierPosition?: QuoteTerms;

  // Negotiation state
  /** Current negotiation status */
  status: NegotiationStatus;

  /** Current round number */
  currentRound: number;

  /** Maximum rounds allowed */
  maxRounds: number;

  // History
  /** All negotiation messages (JSONB[]) */
  messages: NegotiationMessage[];

  // Outcome
  /** Final outcome of negotiation */
  outcome?: NegotiationOutcome;

  /** Final agreed terms (JSONB) */
  finalTerms?: QuoteTerms;

  /** Reference to final quote created from negotiation */
  finalQuoteId?: string;

  // Timing
  /** When negotiation started */
  startedAt: Date;

  /** When last activity occurred */
  lastActivityAt: Date;

  /** When negotiation completed */
  completedAt?: Date;

  // Analytics
  /** Total price reduction achieved */
  totalPriceReduction?: number;

  /** Percentage reduction from initial price */
  reductionPercentage?: number;

  /** Number of rounds actually used */
  roundsUsed?: number;
}

/**
 * Input for starting a new negotiation
 */
export interface StartNegotiationInput {
  rfqId: string;
  quoteId: string;
  maxRounds?: number;
}

/**
 * Result of a completed negotiation
 */
export interface NegotiationResult {
  /** The negotiation record */
  negotiation: RFQNegotiation;

  /** Final quote if agreement reached */
  finalQuote?: RFQQuote;

  /** Whether negotiation was successful */
  success: boolean;

  /** Human-readable summary */
  summary: string;
}

// ============================================================================
// TABLE 4: rfq_awards (Winning quote awards)
// ============================================================================

/**
 * Award record for a winning quote
 * Links RFQ, quote, deal, escrow, and ERP systems
 *
 * @see schema-rfq-flow.sql TABLE 4: rfq_awards
 */
export interface RFQAward {
  /** Unique award ID (UUID) */
  id: string;

  /** Reference to the parent RFQ (UUID) */
  rfqId: string;

  /** Reference to the winning quote (UUID) */
  quoteId: string;

  /** Reference to the winning supplier (UUID) */
  supplierId: string;

  /** Reference to negotiation if applicable (UUID) */
  negotiationId?: string;

  // Award details
  /** Total award amount */
  awardAmount: number;

  /** Quantity being awarded */
  awardQuantity: number;

  /** Per-unit price for the award */
  awardUnitPrice: number;

  /** Full terms of the award (JSONB) */
  awardTerms: QuoteTerms;

  // Deal linkage
  /** Reference to associated deal (UUID) */
  dealId?: string;

  /** Reference to escrow for payment (UUID) */
  escrowId?: string;

  // ERP integration
  /** ERP connection used for sync (UUID) */
  erpConnectionId?: string;

  /** ERP system's internal PO ID */
  erpPoId?: string;

  /** ERP system's PO number (display) */
  erpPoNumber?: string;

  /** When PO was created in ERP */
  erpPoCreatedAt?: Date;

  /** Vendor ID in ERP system */
  erpVendorId?: string;

  /** Current ERP sync status */
  erpSyncStatus: ERPSyncStatus;

  /** Error message if ERP sync failed */
  erpSyncError?: string;

  // Status
  /** Current award status */
  status: AwardStatus;

  // Timestamps
  /** When award was created */
  awardedAt: Date;

  /** When supplier acknowledged the award */
  supplierAcknowledgedAt?: Date;

  /** When payment was initiated */
  paymentInitiatedAt?: Date;

  /** When payment was completed */
  paymentCompletedAt?: Date;
}

/**
 * Input for creating an award
 */
export interface CreateAwardInput {
  rfqId: string;
  quoteId: string;
  supplierId: string;
  negotiationId?: string;
}

/**
 * Result of creating an award with all related records
 */
export interface AwardResult {
  /** The created award */
  award: RFQAward;

  /** Associated deal if created */
  deal?: {
    id: string;
    status: string;
  };

  /** Escrow details if created */
  escrow?: {
    id: string;
    walletAddress: string;
  };

  /** ERP sync result */
  erpSync?: {
    success: boolean;
    poNumber?: string;
    error?: string;
  };
}

// ============================================================================
// TABLE 5: rfq_fulfillment (Delivery tracking)
// ============================================================================

/**
 * Fulfillment/delivery tracking for an award
 * Tracks shipping, delivery confirmation, and quality inspection
 *
 * @see schema-rfq-flow.sql TABLE 5: rfq_fulfillment
 */
export interface RFQFulfillment {
  /** Unique fulfillment ID (UUID) */
  id: string;

  /** Reference to the award (UUID) */
  awardId: string;

  /** Reference to the RFQ (UUID) */
  rfqId: string;

  // Shipping details
  /** Current fulfillment status */
  status: FulfillmentStatus;

  /** Shipping carrier name */
  carrier?: string;

  /** Tracking number from carrier */
  trackingNumber?: string;

  /** URL to track shipment */
  trackingUrl?: string;

  // Dates
  /** Estimated ship date */
  estimatedShipDate?: Date;

  /** Actual ship date */
  actualShipDate?: Date;

  /** Estimated delivery date */
  estimatedDeliveryDate?: Date;

  /** Actual delivery date */
  actualDeliveryDate?: Date;

  // Delivery confirmation
  /** Whether delivery has been confirmed */
  deliveryConfirmed: boolean;

  /** Who confirmed the delivery */
  deliveryConfirmedBy?: string;

  /** When delivery was confirmed */
  deliveryConfirmedAt?: Date;

  /** URL to proof of delivery document */
  deliveryProofUrl?: string;

  /** Notes about the delivery */
  deliveryNotes?: string;

  // Quality check
  /** Whether inspection is required */
  inspectionRequired: boolean;

  /** Current inspection status */
  inspectionStatus?: InspectionStatus;

  /** Notes from inspection */
  inspectionNotes?: string;

  // ERP receipt
  /** Receipt ID in ERP system */
  erpReceiptId?: string;

  /** When receipt was created in ERP */
  erpReceiptCreatedAt?: Date;

  // Issues
  /** Whether there are any issues */
  hasIssues: boolean;

  /** Description of issues if any */
  issueDescription?: string;

  /** How issues were resolved */
  issueResolution?: string;

  /** Timestamp when record was created */
  createdAt: Date;

  /** Timestamp when record was last updated */
  updatedAt: Date;
}

/**
 * Input for updating fulfillment status
 */
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

/**
 * Input for confirming delivery
 */
export interface ConfirmDeliveryInput {
  awardId: string;
  confirmedBy: string;
  proofUrl?: string;
  notes?: string;
}

// ============================================================================
// TABLE 6: rfq_documents (Generated RFP/RFQ documents)
// ============================================================================

/**
 * Generated document for an RFQ (RFP, PO, invoice, etc.)
 *
 * @see schema-rfq-flow.sql TABLE 6: rfq_documents
 */
export interface RFQDocument {
  /** Unique document ID (UUID) */
  id: string;

  /** Reference to the RFQ (UUID) */
  rfqId: string;

  /** Type of document */
  documentType: DocumentType;

  /** Version number for tracking revisions */
  version: number;

  /** Document title */
  title: string;

  /** Document content (JSONB) */
  content: Record<string, unknown>;

  /** URL to stored file */
  fileUrl?: string;

  /** File format (e.g., 'pdf', 'docx') */
  fileFormat?: string;

  /** File size in bytes */
  fileSizeBytes?: number;

  /** Current document status */
  status: DocumentStatus;

  /** Timestamp when document was created */
  createdAt: Date;

  /** Timestamp when document was last updated */
  updatedAt: Date;
}

/**
 * Input for creating a new document
 */
export interface CreateDocumentInput {
  rfqId: string;
  documentType: DocumentType;
  title: string;
  content: Record<string, unknown>;
  fileUrl?: string;
  fileFormat?: string;
  fileSizeBytes?: number;
}

// ============================================================================
// TABLE 7: supplier_catalog (Supplier pricing rules for AI quotes)
// ============================================================================

/**
 * Volume discount tier for quantity-based pricing
 */
export interface VolumeDiscount {
  /** Minimum quantity for this tier */
  minQuantity: number;

  /** Maximum quantity for this tier (optional) */
  maxQuantity?: number;

  /** Discount percentage for this tier */
  discountPercentage: number;
}

/**
 * Supplier catalog item with AI pricing rules
 * Used by supplier AI to generate quotes
 *
 * @see schema-rfq-flow.sql TABLE 7: supplier_catalog
 */
export interface SupplierCatalog {
  /** Unique catalog item ID (UUID) */
  id: string;

  /** Reference to the supplier (UUID) */
  supplierId: string;

  // Product info
  /** Product category */
  productCategory: string;

  /** Product name */
  productName: string;

  /** Product SKU */
  productSku?: string;

  /** Product description */
  productDescription?: string;

  // Pricing
  /** Base price per unit */
  baseUnitPrice: number;

  /** Currency code (ISO 4217) */
  currency: string;

  /** Minimum order quantity */
  minimumOrderQty: number;

  /** Volume discount tiers (JSONB) */
  volumeDiscounts: VolumeDiscount[];

  // Lead times
  /** Standard lead time in days */
  standardLeadTimeDays: number;

  /** Rush lead time in days */
  rushLeadTimeDays?: number;

  /** Additional fee for rush orders (percentage) */
  rushFeePercentage?: number;

  // Terms
  /** Default payment terms for this product */
  defaultPaymentTerms?: string;

  /** Warranty period in months */
  warrantyMonths?: number;

  // AI pricing rules
  /** Whether AI can generate quotes for this item */
  aiPricingEnabled: boolean;

  /** Minimum margin AI must maintain (percentage) */
  aiMinMarginPercentage: number;

  /** Lowest price AI can offer in negotiation (percentage below base) */
  aiNegotiationFloorPercentage: number;

  /** Whether AI can auto-generate quotes without approval */
  aiAutoQuoteEnabled: boolean;

  /** Whether this catalog item is active */
  active: boolean;

  /** Timestamp when item was created */
  createdAt: Date;

  /** Timestamp when item was last updated */
  updatedAt: Date;
}

/**
 * Alias for backward compatibility
 * @deprecated Use SupplierCatalog instead
 */
export type SupplierCatalogItem = SupplierCatalog;

/**
 * Input for creating a catalog item
 */
export interface CreateCatalogInput {
  supplierId: string;
  productCategory: string;
  productName: string;
  productSku?: string;
  productDescription?: string;
  baseUnitPrice: number;
  currency?: string;
  minimumOrderQty?: number;
  volumeDiscounts?: VolumeDiscount[];
  standardLeadTimeDays: number;
  rushLeadTimeDays?: number;
  rushFeePercentage?: number;
  defaultPaymentTerms?: string;
  warrantyMonths?: number;
  aiPricingEnabled?: boolean;
  aiMinMarginPercentage?: number;
  aiNegotiationFloorPercentage?: number;
  aiAutoQuoteEnabled?: boolean;
}

// ============================================================================
// COMPOSITE TYPES - Full RFQ with related data
// ============================================================================

/**
 * Urgency level for an RFQ
 */
export type RFQUrgency = 'standard' | 'urgent' | 'critical';

/**
 * Complete RFQ with all related transaction flow data
 */
export interface RFQWithFlow {
  /** Unique RFQ ID (UUID) */
  id: string;

  /** Product/service category */
  category: string;

  /** Detailed description of requirements */
  description: string;

  /** Quantity needed */
  quantity: number;

  /** Target price (buyer's ideal) */
  targetPrice?: number;

  /** How urgent the request is */
  urgency: RFQUrgency;

  /** Where goods should be delivered */
  deliveryLocation: string;

  /** Required supplier certifications */
  requiredCertifications: string[];

  /** Additional requirements text */
  additionalRequirements?: string;

  /** Requestor's email */
  requestorEmail?: string;

  /** Requestor's name */
  requestorName?: string;

  /** Current RFQ status */
  status: RFQStatus;

  /** When RFQ was created */
  createdAt: Date;

  /** When RFQ was last updated */
  updatedAt: Date;

  // Related data (populated by queries)
  /** Buyer constraints for this RFQ */
  constraints?: RFQConstraints;

  /** All quotes received */
  quotes?: RFQQuote[];

  /** All negotiations for this RFQ */
  negotiations?: RFQNegotiation[];

  /** Award if one exists */
  award?: RFQAward;

  /** Fulfillment tracking if award exists */
  fulfillment?: RFQFulfillment;

  /** Generated documents */
  documents?: RFQDocument[];
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Generic API response wrapper
 */
export interface RFQFlowResponse<T> {
  /** Whether the operation succeeded */
  success: boolean;

  /** Response data if successful */
  data?: T;

  /** Error message if failed */
  error?: string;

  /** Additional message */
  message?: string;
}

/**
 * Response for quotes listing endpoint
 */
export interface QuotesResponse {
  /** List of quotes */
  quotes: RFQQuote[];

  /** Quote comparison analysis */
  comparison?: QuoteComparison;

  /** Buyer constraints */
  constraints?: RFQConstraints;
}

/**
 * Response for negotiation status endpoint
 */
export interface NegotiationStatusResponse {
  /** Current negotiation state */
  negotiation: RFQNegotiation;

  /** Supplier's current offer */
  currentOffer?: QuoteTerms;

  /** Buyer's current position */
  buyerPosition?: QuoteTerms;

  /** Progress summary */
  progress: {
    round: number;
    maxRounds: number;
    priceReduction: number;
    reductionPercentage: number;
  };
}

/**
 * Response for complete RFQ transaction
 */
export interface CompleteRFQResponse {
  /** Full RFQ with all related data */
  rfq: RFQWithFlow;

  /** Award details */
  award: RFQAward;

  /** Fulfillment status */
  fulfillment: RFQFulfillment;

  /** ERP synchronization status */
  erpSync: {
    poCreated: boolean;
    poNumber?: string;
    invoiceCreated: boolean;
    invoiceNumber?: string;
    receiptCreated: boolean;
    receiptNumber?: string;
  };

  /** Payment status */
  payment: {
    escrowReleased: boolean;
    sellerPaid: boolean;
    feeCollected: number;
  };
}

// ============================================================================
// DATABASE ROW TYPES (for direct DB operations)
// ============================================================================

/**
 * Database row type for rfq_constraints table
 * Uses snake_case to match PostgreSQL column names
 */
export interface RFQConstraintsRow {
  id: string;
  rfq_id: string;
  max_total_budget: string | null;
  max_unit_price: string | null;
  target_total_price: string | null;
  target_unit_price: string | null;
  required_delivery_date: string | null;
  max_lead_time_days: number | null;
  preferred_lead_time_days: number | null;
  acceptable_payment_terms: string[];
  preferred_payment_terms: string | null;
  minimum_warranty_months: number | null;
  required_certifications: string[];
  auto_negotiate: boolean;
  negotiation_aggression: string;
  allow_counter_offers: boolean;
  max_negotiation_rounds: number;
  created_at: string;
  updated_at: string;
}

/**
 * Database row type for rfq_quotes table
 * Uses snake_case to match PostgreSQL column names
 */
export interface RFQQuoteRow {
  id: string;
  rfq_id: string;
  supplier_id: string;
  unit_price: string;
  quantity: number;
  total_price: string;
  currency: string;
  lead_time_days: number;
  payment_terms: string | null;
  warranty_months: number | null;
  shipping_cost: string;
  shipping_method: string | null;
  valid_until: string | null;
  notes: string | null;
  line_items: LineItem[];
  ai_generated: boolean;
  ai_confidence_score: string | null;
  source_catalog_id: string | null;
  is_initial_quote: boolean;
  parent_quote_id: string | null;
  negotiation_round: number;
  status: QuoteStatus;
  supplier_confirmed: boolean;
  supplier_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Database row type for rfq_negotiations table
 * Uses snake_case to match PostgreSQL column names
 */
export interface RFQNegotiationRow {
  id: string;
  rfq_id: string;
  quote_id: string;
  supplier_id: string;
  buyer_constraints: RFQConstraints;
  initial_supplier_position: QuoteTerms;
  current_supplier_position: QuoteTerms | null;
  status: NegotiationStatus;
  current_round: number;
  max_rounds: number;
  messages: NegotiationMessage[];
  outcome: NegotiationOutcome | null;
  final_terms: QuoteTerms | null;
  final_quote_id: string | null;
  started_at: string;
  last_activity_at: string;
  completed_at: string | null;
  total_price_reduction: string | null;
  reduction_percentage: string | null;
  rounds_used: number | null;
}

/**
 * Database row type for rfq_awards table
 * Uses snake_case to match PostgreSQL column names
 */
export interface RFQAwardRow {
  id: string;
  rfq_id: string;
  quote_id: string;
  supplier_id: string;
  negotiation_id: string | null;
  award_amount: string;
  award_quantity: number;
  award_unit_price: string;
  award_terms: QuoteTerms;
  deal_id: string | null;
  escrow_id: string | null;
  erp_connection_id: string | null;
  erp_po_id: string | null;
  erp_po_number: string | null;
  erp_po_created_at: string | null;
  erp_vendor_id: string | null;
  erp_sync_status: ERPSyncStatus;
  erp_sync_error: string | null;
  status: AwardStatus;
  awarded_at: string;
  supplier_acknowledged_at: string | null;
  payment_initiated_at: string | null;
  payment_completed_at: string | null;
}

/**
 * Database row type for rfq_fulfillment table
 * Uses snake_case to match PostgreSQL column names
 */
export interface RFQFulfillmentRow {
  id: string;
  award_id: string;
  rfq_id: string;
  status: FulfillmentStatus;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  estimated_ship_date: string | null;
  actual_ship_date: string | null;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
  delivery_confirmed: boolean;
  delivery_confirmed_by: string | null;
  delivery_confirmed_at: string | null;
  delivery_proof_url: string | null;
  delivery_notes: string | null;
  inspection_required: boolean;
  inspection_status: InspectionStatus | null;
  inspection_notes: string | null;
  erp_receipt_id: string | null;
  erp_receipt_created_at: string | null;
  has_issues: boolean;
  issue_description: string | null;
  issue_resolution: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Database row type for rfq_documents table
 * Uses snake_case to match PostgreSQL column names
 */
export interface RFQDocumentRow {
  id: string;
  rfq_id: string;
  document_type: DocumentType;
  version: number;
  title: string;
  content: Record<string, unknown>;
  file_url: string | null;
  file_format: string | null;
  file_size_bytes: number | null;
  status: DocumentStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Database row type for supplier_catalog table
 * Uses snake_case to match PostgreSQL column names
 */
export interface SupplierCatalogRow {
  id: string;
  supplier_id: string;
  product_category: string;
  product_name: string;
  product_sku: string | null;
  product_description: string | null;
  base_unit_price: string;
  currency: string;
  minimum_order_qty: number;
  volume_discounts: VolumeDiscount[];
  standard_lead_time_days: number;
  rush_lead_time_days: number | null;
  rush_fee_percentage: string | null;
  default_payment_terms: string | null;
  warranty_months: number | null;
  ai_pricing_enabled: boolean;
  ai_min_margin_percentage: string;
  ai_negotiation_floor_percentage: string;
  ai_auto_quote_enabled: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}
