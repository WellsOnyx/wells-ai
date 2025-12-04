/**
 * Layer 2: Grain & Vault Internal ERP (Side-car ERP)
 *
 * A lightweight but complete ERP subsystem that can:
 * - Act as system of record
 * - Support conversational UI via WellsAI
 * - Track GRAIN treasury operations
 * - Manage float, yield, and escrow ledgers
 */

// ============================================================================
// ENUMS
// ============================================================================

export type AccountType =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'revenue'
  | 'expense'
  | 'contra_asset'
  | 'contra_liability'
  | 'contra_equity'

export type AccountSubtype =
  | 'cash'
  | 'accounts_receivable'
  | 'inventory'
  | 'prepaid'
  | 'fixed_asset'
  | 'accounts_payable'
  | 'accrued_liability'
  | 'long_term_debt'
  | 'retained_earnings'
  | 'common_stock'
  | 'service_revenue'
  | 'product_revenue'
  | 'cost_of_goods'
  | 'operating_expense'
  | 'grain_treasury'
  | 'float_balance'
  | 'yield_accrual'
  | 'escrow_holding'

export type VendorStatus =
  | 'pending_verification'
  | 'active'
  | 'suspended'
  | 'blocked'
  | 'archived'

export type VendorPaymentPreference =
  | 'grain'     // GRAIN stablecoin (instant, 0 fee)
  | 'ach'       // ACH (1-3 days)
  | 'wire'      // Wire transfer (same day)
  | 'check'     // Physical check
  | 'card'      // Virtual card

export type POStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'sent_to_vendor'
  | 'acknowledged'
  | 'partially_fulfilled'
  | 'fulfilled'
  | 'invoiced'
  | 'closed'
  | 'cancelled'

export type InvoiceStatus =
  | 'received'
  | 'pending_review'
  | 'pending_approval'
  | 'approved'
  | 'disputed'
  | 'scheduled'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'written_off'

export type PaymentStatus =
  | 'draft'
  | 'pending_authorization'
  | 'authorized'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'reversed'
  | 'cancelled'

export type PaymentMethod =
  | 'grain'
  | 'ach'
  | 'wire'
  | 'check'
  | 'virtual_card'

export type ReconciliationStatus =
  | 'pending'
  | 'in_progress'
  | 'matched'
  | 'unmatched'
  | 'exception'
  | 'completed'

export type EscrowType =
  | 'trade_escrow'
  | 'milestone_escrow'
  | 'dispute_hold'
  | 'compliance_hold'
  | 'reserve'

export type LedgerType =
  | 'operating'
  | 'float'
  | 'yield'
  | 'escrow'

// ============================================================================
// CHART OF ACCOUNTS
// ============================================================================

export interface GvChartOfAccount {
  id: string
  accountCode: string           // e.g., "1000", "2000.10"
  accountName: string
  accountType: AccountType
  accountSubtype?: AccountSubtype
  parentAccountId?: string      // For hierarchical structure
  description?: string
  currency: string              // ISO 4217
  isActive: boolean
  isSystemAccount: boolean      // Protected from deletion
  normalBalance: 'debit' | 'credit'

  // For treasury accounts
  isTreasuryAccount?: boolean
  grainLinked?: boolean         // Linked to GRAIN token

  // Tracking
  openingBalance?: number
  currentBalance?: number
  lastActivityAt?: string

  // Audit
  createdAt: string
  updatedAt: string
  createdBy?: string
}

// ============================================================================
// VENDORS
// ============================================================================

export interface GvVendor {
  id: string
  vendorCode: string
  companyName: string
  legalName?: string
  dba?: string
  status: VendorStatus

  // Tax & Legal
  taxId?: string
  taxIdType?: 'ein' | 'ssn' | 'vat' | 'gst' | 'other'
  taxIdVerified?: boolean
  w9OnFile?: boolean
  w8OnFile?: boolean

  // Primary Contact
  primaryContactName?: string
  primaryContactEmail?: string
  primaryContactPhone?: string

  // Billing Address
  billingStreet1?: string
  billingStreet2?: string
  billingCity?: string
  billingState?: string
  billingPostalCode?: string
  billingCountry?: string

  // Payment Configuration
  paymentPreference: VendorPaymentPreference
  paymentTerms: string          // e.g., "Net30", "2/10 Net30"
  defaultCurrency: string

  // GRAIN Wallet (for instant payments)
  grainWalletAddress?: string
  grainWalletVerified?: boolean

  // Bank Account (for ACH/Wire)
  bankName?: string
  bankAccountNumber?: string    // Encrypted
  bankRoutingNumber?: string    // Encrypted
  bankAccountType?: 'checking' | 'savings'
  bankAccountVerified?: boolean

  // Classification
  categories: string[]
  tags: string[]

  // Credit & Risk
  creditLimit?: number
  creditUsed?: number
  riskScore?: number
  paymentRating?: number

  // Integration
  externalErpId?: string
  externalErpSystem?: string

  // Audit
  createdAt: string
  updatedAt: string
  createdBy?: string
  approvedBy?: string
  approvedAt?: string
}

// ============================================================================
// PURCHASE ORDERS
// ============================================================================

export interface GvPurchaseOrder {
  id: string
  poNumber: string
  vendorId: string
  status: POStatus

  // References
  requisitionId?: string
  contractId?: string
  externalErpId?: string

  // Header Info
  orderDate: string
  expectedDeliveryDate?: string
  actualDeliveryDate?: string
  shippingMethod?: string

  // Addresses
  shipToStreet1?: string
  shipToStreet2?: string
  shipToCity?: string
  shipToState?: string
  shipToPostalCode?: string
  shipToCountry?: string

  // Line Items
  lineItems: GvPOLineItem[]

  // Amounts
  subtotal: number
  taxAmount: number
  shippingAmount: number
  discountAmount: number
  totalAmount: number
  currency: string

  // Payment Terms
  paymentTerms: string
  paymentDueDate?: string

  // Tracking
  costCenter?: string
  department?: string
  project?: string
  budgetCode?: string

  // Approval
  requestedBy?: string
  approvedBy?: string
  approvalDate?: string
  approvalNotes?: string

  // Notes & Attachments
  internalNotes?: string
  vendorNotes?: string
  attachmentIds?: string[]

  // Audit
  createdAt: string
  updatedAt: string
  closedAt?: string
}

export interface GvPOLineItem {
  lineNumber: number
  itemCode?: string
  description: string
  quantity: number
  quantityReceived: number
  unitOfMeasure: string
  unitPrice: number
  discount?: number
  taxRate?: number
  lineTotal: number

  // GL Coding
  accountCode?: string
  costCenter?: string
  project?: string

  // Tracking
  expectedDeliveryDate?: string
  actualDeliveryDate?: string
}

// ============================================================================
// INVOICES
// ============================================================================

export interface GvInvoice {
  id: string
  invoiceNumber: string
  vendorId: string
  vendorInvoiceNumber: string   // Vendor's reference
  status: InvoiceStatus

  // References
  purchaseOrderId?: string
  purchaseOrderNumber?: string
  receiptId?: string
  externalErpId?: string

  // Dates
  invoiceDate: string
  receivedDate: string
  dueDate: string
  paidDate?: string

  // Line Items
  lineItems: GvInvoiceLineItem[]

  // Amounts
  subtotal: number
  taxAmount: number
  shippingAmount: number
  discountAmount: number
  totalAmount: number
  amountPaid: number
  amountDue: number
  currency: string

  // Payment Info
  paymentTerms: string
  paymentMethod?: PaymentMethod
  paymentId?: string            // Link to payment instruction

  // Three-Way Match
  poMatched: boolean
  receiptMatched: boolean
  priceVariance?: number
  quantityVariance?: number
  matchExceptions?: string[]

  // Approval
  approvedBy?: string
  approvalDate?: string
  approvalNotes?: string

  // Disputes
  isDisputed: boolean
  disputeReason?: string
  disputeResolution?: string

  // Notes & Attachments
  notes?: string
  attachmentIds?: string[]

  // Audit
  createdAt: string
  updatedAt: string
}

export interface GvInvoiceLineItem {
  lineNumber: number
  poLineNumber?: number
  itemCode?: string
  description: string
  quantity: number
  unitPrice: number
  discount?: number
  taxRate?: number
  taxAmount?: number
  lineTotal: number

  // GL Coding
  accountCode?: string
  costCenter?: string
  project?: string
}

// ============================================================================
// GENERAL LEDGER ENTRIES
// ============================================================================

export interface GvGlEntry {
  id: string
  journalId: string
  journalNumber: string
  entryNumber: number           // Line number within journal
  ledgerType: LedgerType

  // Date
  entryDate: string
  postingDate: string
  period: string                // YYYY-MM
  fiscalYear: number

  // Account
  accountId: string
  accountCode: string
  accountName?: string

  // Amounts
  debit: number
  credit: number
  amount: number                // Signed (+ = debit, - = credit)
  currency: string
  exchangeRate?: number
  baseCurrencyAmount?: number

  // Description
  description: string
  memo?: string

  // Reference
  referenceType?: 'invoice' | 'payment' | 'receipt' | 'adjustment' | 'transfer' | 'yield' | 'escrow'
  referenceId?: string
  referenceNumber?: string

  // Tracking
  costCenter?: string
  department?: string
  project?: string
  location?: string

  // Status
  isPosted: boolean
  isReversed: boolean
  reversedBy?: string
  reversalDate?: string

  // Reconciliation
  isReconciled: boolean
  reconciledDate?: string
  reconciledBy?: string
  bankStatementRef?: string

  // Audit
  createdAt: string
  createdBy: string
  approvedBy?: string
  approvedAt?: string
}

// ============================================================================
// PAYMENT INSTRUCTIONS
// ============================================================================

export interface GvPaymentInstruction {
  id: string
  paymentNumber: string
  status: PaymentStatus

  // Payer/Payee
  vendorId: string
  vendorName?: string

  // Payment Details
  paymentMethod: PaymentMethod
  amount: number
  currency: string

  // For GRAIN payments
  grainWalletFrom?: string
  grainWalletTo?: string
  grainTxHash?: string
  grainBlockNumber?: number

  // For ACH/Wire
  bankAccountFrom?: string
  bankAccountTo?: string
  bankReference?: string

  // For Virtual Card
  cardNumber?: string           // Last 4 only
  cardExpiryDate?: string

  // Scheduling
  requestedDate: string
  scheduledDate?: string
  executedDate?: string
  settledDate?: string

  // Invoice References
  invoiceIds: string[]
  invoiceNumbers: string[]
  totalInvoiceAmount: number

  // Discount
  earlyPaymentDiscount?: number
  discountTaken?: number

  // Approval
  createdBy: string
  authorizedBy?: string
  authorizedAt?: string
  authorizationMethod?: 'manual' | 'rule_based' | 'conversational'

  // Notes
  memo?: string
  vendorMemo?: string
  internalNotes?: string

  // GL
  journalId?: string

  // Error Handling
  failureReason?: string
  retryCount: number
  lastRetryAt?: string

  // Audit
  createdAt: string
  updatedAt: string
}

// ============================================================================
// RECONCILIATIONS
// ============================================================================

export interface GvReconciliation {
  id: string
  reconciliationType: 'bank' | 'credit_card' | 'grain_wallet' | 'intercompany'
  accountId: string
  accountCode: string
  status: ReconciliationStatus

  // Period
  statementDate: string
  periodStart: string
  periodEnd: string

  // Balances
  statementBeginningBalance: number
  statementEndingBalance: number
  bookBeginningBalance: number
  bookEndingBalance: number
  reconciledBalance: number
  unreconciledDifference: number

  // Transactions
  totalDeposits: number
  totalWithdrawals: number
  clearedItems: number
  outstandingItems: number

  // Items
  items: GvReconciliationItem[]

  // Completion
  completedBy?: string
  completedAt?: string
  reviewedBy?: string
  reviewedAt?: string

  // Audit
  createdAt: string
  updatedAt: string
}

export interface GvReconciliationItem {
  id: string
  reconciliationId: string
  glEntryId?: string
  bankStatementRef?: string

  // Transaction Details
  transactionDate: string
  description: string
  amount: number
  type: 'deposit' | 'withdrawal'

  // Status
  isMatched: boolean
  isCleared: boolean
  isException: boolean
  exceptionReason?: string

  // Matching
  matchedAt?: string
  matchedBy?: string
  matchConfidence?: number
}

// ============================================================================
// FLOAT LEDGER (Treasury Float)
// ============================================================================

export interface GvFloatLedger {
  id: string
  accountId: string             // Grain & Vault account
  entryDate: string
  transactionType: 'deposit' | 'withdrawal' | 'payment_in_flight' | 'settlement' | 'interest'

  // Amounts
  amount: number
  runningBalance: number
  currency: string

  // Source/Destination
  sourceType?: 'grain_deposit' | 'fiat_deposit' | 'payment_received' | 'yield_allocation'
  destinationType?: 'payment_sent' | 'withdrawal' | 'escrow_lock'

  // Reference
  referenceType?: string
  referenceId?: string

  // Settlement
  expectedSettlementDate?: string
  actualSettlementDate?: string
  isSettled: boolean

  // Notes
  description: string
  memo?: string

  // Audit
  createdAt: string
  createdBy?: string
}

// ============================================================================
// YIELD LEDGER (GRAIN Appreciation)
// ============================================================================

export interface GvYieldLedger {
  id: string
  accountId: string
  entryDate: string
  yieldType: 'interest' | 'appreciation' | 'rebate' | 'reward' | 'fee_credit'

  // Amounts
  principalAmount: number       // Base amount yield calculated on
  yieldAmount: number           // Yield earned
  yieldRate: number             // APY as decimal (0.05 = 5%)
  runningYieldBalance: number
  currency: string

  // Period
  periodStart: string
  periodEnd: string
  daysInPeriod: number

  // Source
  sourceProgram?: string        // e.g., "GRAIN Staking", "Float Pool"
  sourceAccountCode?: string

  // Status
  isPosted: boolean
  isWithdrawn: boolean
  withdrawnAt?: string
  withdrawalPaymentId?: string

  // GL Reference
  journalId?: string

  // Audit
  createdAt: string
  createdBy?: string
}

// ============================================================================
// ESCROW ACCOUNTS
// ============================================================================

export interface GvEscrowAccount {
  id: string
  escrowCode: string            // Human-readable code
  escrowType: EscrowType
  accountId: string             // Parent G&V account
  status: 'active' | 'released' | 'cancelled' | 'disputed'

  // Parties
  depositorId?: string
  depositorName?: string
  beneficiaryId?: string
  beneficiaryName?: string

  // Amounts
  totalDeposited: number
  totalReleased: number
  totalRefunded: number
  currentBalance: number
  currency: string

  // Terms
  releaseConditions?: string
  expirationDate?: string
  autoReleaseDate?: string

  // Associated Objects
  dealId?: string
  purchaseOrderId?: string
  invoiceId?: string
  contractId?: string

  // Release Info
  releasedAt?: string
  releasedBy?: string
  releaseReason?: string

  // Audit
  createdAt: string
  updatedAt: string
  createdBy?: string
}

export interface GvEscrowTransaction {
  id: string
  escrowAccountId: string
  transactionType: 'deposit' | 'release' | 'refund' | 'fee' | 'interest'
  amount: number
  currency: string
  runningBalance: number

  // Party
  fromParty?: string
  toParty?: string

  // Payment Reference
  paymentInstructionId?: string
  grainTxHash?: string

  // Authorization
  authorizedBy?: string
  authorizedAt?: string
  authorizationNotes?: string

  // Notes
  description: string
  memo?: string

  // GL Reference
  journalId?: string

  // Audit
  createdAt: string
  createdBy?: string
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateVendorRequest {
  vendorCode?: string
  companyName: string
  legalName?: string
  taxId?: string
  taxIdType?: 'ein' | 'ssn' | 'vat' | 'gst' | 'other'
  primaryContactName?: string
  primaryContactEmail?: string
  primaryContactPhone?: string
  billingStreet1?: string
  billingCity?: string
  billingState?: string
  billingPostalCode?: string
  billingCountry?: string
  paymentPreference?: VendorPaymentPreference
  paymentTerms?: string
  grainWalletAddress?: string
  categories?: string[]
}

export interface CreatePORequest {
  vendorId: string
  lineItems: {
    description: string
    quantity: number
    unitOfMeasure?: string
    unitPrice: number
    accountCode?: string
  }[]
  paymentTerms?: string
  costCenter?: string
  department?: string
  project?: string
  internalNotes?: string
  vendorNotes?: string
  expectedDeliveryDate?: string
}

export interface CreateInvoiceRequest {
  vendorId: string
  vendorInvoiceNumber: string
  invoiceDate: string
  dueDate?: string
  purchaseOrderId?: string
  lineItems: {
    description: string
    quantity: number
    unitPrice: number
    accountCode?: string
  }[]
  notes?: string
}

export interface CreatePaymentRequest {
  vendorId: string
  invoiceIds: string[]
  amount: number
  paymentMethod: PaymentMethod
  scheduledDate?: string
  memo?: string
}

export interface LedgerQueryParams {
  accountId?: string
  ledgerType?: LedgerType
  dateFrom?: string
  dateTo?: string
  referenceType?: string
  isReconciled?: boolean
  page?: number
  limit?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}
