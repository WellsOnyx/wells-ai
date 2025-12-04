/**
 * Layer 1: External ERP Connector Network
 * TypeScript interfaces for normalized ERP objects
 *
 * These interfaces normalize data from 200+ ERP systems into a common format
 * that Grain & Vault and WellsAI can work with consistently.
 */

// ============================================================================
// ENUMS
// ============================================================================

export type ErpSourceSystem =
  | 'sap'
  | 'netsuite'
  | 'oracle'
  | 'dynamics'
  | 'workday'
  | 'sage'
  | 'quickbooks'
  | 'xero'
  | 'zoho'
  | 'odoo'
  | 'coupa'
  | 'ivalua'
  | 'ariba'
  | 'other'

export type PoStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'sent'
  | 'acknowledged'
  | 'partially_received'
  | 'received'
  | 'invoiced'
  | 'closed'
  | 'cancelled'

export type InvoiceStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'disputed'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'written_off'

export type VendorStatus =
  | 'active'
  | 'inactive'
  | 'pending_approval'
  | 'blocked'
  | 'archived'

export type VendorType =
  | 'supplier'
  | 'contractor'
  | 'consultant'
  | 'service_provider'
  | 'manufacturer'
  | 'distributor'
  | 'other'

export type AccountType =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'revenue'
  | 'expense'

export type PaymentMethod =
  | 'ach'
  | 'wire'
  | 'check'
  | 'grain'
  | 'card'
  | 'other'

export type AddressType =
  | 'billing'
  | 'shipping'
  | 'headquarters'
  | 'branch'
  | 'other'

export type ContactRole =
  | 'sales'
  | 'accounts_receivable'
  | 'accounts_payable'
  | 'technical'
  | 'executive'
  | 'other'

export type ReferenceType =
  | 'invoice'
  | 'purchase_order'
  | 'payment'
  | 'receipt'
  | 'adjustment'
  | 'other'

export type TaxIdType =
  | 'ein'
  | 'ssn'
  | 'vat'
  | 'gst'
  | 'other'

export type BankAccountType =
  | 'checking'
  | 'savings'
  | 'other'

// ============================================================================
// COMMON TYPES
// ============================================================================

export interface Address {
  type: AddressType
  street1: string
  street2?: string
  city: string
  state?: string
  postalCode: string
  country: string // ISO 3166-1 alpha-2
  isPrimary?: boolean
}

export interface Contact {
  name: string
  title?: string
  email?: string
  phone?: string
  mobile?: string
  isPrimary?: boolean
  role?: ContactRole
}

export interface BankAccount {
  bankName: string
  accountName: string
  accountNumber: string
  routingNumber?: string
  swiftCode?: string
  iban?: string
  accountType: BankAccountType
  currency: string // ISO 4217
  isPrimary?: boolean
  isVerified?: boolean
}

export interface Attachment {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  url: string
  uploadedAt: string
}

export interface ErpLineItem {
  lineNumber: number
  productCode?: string
  description: string
  quantity: number
  unitOfMeasure?: string
  unitPrice: number
  discount?: number
  discountPercent?: number
  taxRate?: number
  taxAmount?: number
  lineTotal: number
  accountCode?: string
  costCenter?: string
  project?: string
}

export interface ThreeWayMatch {
  poMatched: boolean
  receiptMatched: boolean
  priceVariance?: number
  quantityVariance?: number
}

export interface Certification {
  type: string
  number?: string
  expirationDate?: string
}

export interface InsuranceInfo {
  generalLiability?: number
  workersComp?: number
  expirationDate?: string
}

// ============================================================================
// CORE ERP OBJECTS
// ============================================================================

export interface ErpPurchaseOrder {
  // Identity
  id: string
  sourceSystem: ErpSourceSystem
  externalId?: string
  poNumber: string

  // Vendor
  vendorId: string
  vendorName?: string

  // Status
  status: PoStatus

  // Line Items
  lineItems: ErpLineItem[]

  // Amounts
  subtotalAmount?: number
  taxAmount?: number
  shippingAmount?: number
  totalAmount: number
  currency: string // ISO 4217
  exchangeRate?: number

  // Dates
  requestedDeliveryDate?: string
  actualDeliveryDate?: string

  // Addresses
  shippingAddress?: Address
  billingAddress?: Address

  // Terms & Tracking
  paymentTerms?: string
  costCenter?: string
  projectCode?: string
  department?: string

  // Approval
  approvedBy?: string
  approvalDate?: string

  // Additional
  notes?: string
  attachments?: Attachment[]
  customFields?: Record<string, unknown>

  // Timestamps
  createdAt: string
  updatedAt: string
  syncedAt?: string

  // Raw data for debugging
  rawData?: Record<string, unknown>
}

export interface ErpInvoice {
  // Identity
  id: string
  sourceSystem: ErpSourceSystem
  externalId?: string
  invoiceNumber: string

  // Vendor
  vendorId: string
  vendorName?: string

  // PO Reference
  purchaseOrderId?: string
  purchaseOrderNumber?: string

  // Status
  status: InvoiceStatus

  // Dates
  invoiceDate: string
  dueDate: string

  // Line Items
  lineItems: ErpLineItem[]

  // Amounts
  subtotalAmount?: number
  taxAmount?: number
  discountAmount?: number
  totalAmount: number
  amountPaid?: number
  amountDue?: number
  currency: string
  exchangeRate?: number

  // Payment
  paymentTerms?: string
  paymentMethod?: PaymentMethod
  bankAccount?: BankAccount

  // Matching
  threeWayMatch?: ThreeWayMatch

  // Approval
  approvedBy?: string
  approvalDate?: string
  paidDate?: string

  // Additional
  notes?: string
  attachments?: Attachment[]
  customFields?: Record<string, unknown>

  // Timestamps
  createdAt: string
  updatedAt: string
  syncedAt?: string
  rawData?: Record<string, unknown>
}

export interface ErpVendor {
  // Identity
  id: string
  sourceSystem: ErpSourceSystem
  externalId?: string
  vendorCode?: string

  // Names
  name: string
  legalName?: string
  dba?: string

  // Status
  status: VendorStatus
  vendorType?: VendorType

  // Tax & Legal
  taxId?: string
  taxIdType?: TaxIdType
  dunsNumber?: string

  // Contacts
  primaryContact?: Contact
  contacts?: Contact[]

  // Addresses
  addresses?: Address[]

  // Payment Defaults
  defaultPaymentTerms?: string
  defaultCurrency?: string
  bankAccounts?: BankAccount[]
  grainWalletAddress?: string

  // Classification
  categories?: string[]
  certifications?: Certification[]
  insuranceInfo?: InsuranceInfo
  w9OnFile?: boolean

  // Credit & Rating
  creditLimit?: number
  paymentRating?: number

  // Additional
  notes?: string
  customFields?: Record<string, unknown>

  // Timestamps
  createdAt: string
  updatedAt: string
  syncedAt?: string
  rawData?: Record<string, unknown>
}

export interface ErpLedgerEntry {
  // Identity
  id: string
  sourceSystem: ErpSourceSystem
  externalId?: string
  journalId?: string
  journalNumber?: string

  // Dates
  entryDate: string
  postingDate?: string
  period?: string
  fiscalYear?: number

  // Account
  accountCode: string
  accountName?: string
  accountType?: AccountType

  // Amounts
  debit?: number
  credit?: number
  amount: number // Signed: positive = debit, negative = credit
  currency: string
  exchangeRate?: number
  baseAmount?: number

  // Description & Reference
  description?: string
  reference?: string
  referenceType?: ReferenceType
  referenceId?: string

  // Dimensions
  costCenter?: string
  department?: string
  project?: string
  location?: string
  dimensions?: Record<string, string>

  // Reconciliation
  isReconciled?: boolean
  reconciledDate?: string

  // Reversal
  isReversing?: boolean
  reversedBy?: string

  // Audit
  createdBy?: string
  approvedBy?: string

  // Additional
  customFields?: Record<string, unknown>

  // Timestamps
  createdAt: string
  updatedAt: string
  syncedAt?: string
  rawData?: Record<string, unknown>
}

// ============================================================================
// INTEGRATION PROVIDER TYPES
// ============================================================================

export type IntegrationProvider =
  | 'merge'
  | 'workato'
  | 'tray'
  | 'celigo'
  | 'boomi'
  | 'direct'

export type IntegrationStatus =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'pending'
  | 'expired'

export type SyncDirection =
  | 'inbound'
  | 'outbound'
  | 'bidirectional'

export type SyncFrequency =
  | 'realtime'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'manual'

export interface IntegrationProviderConfig {
  id: string
  name: string
  provider: IntegrationProvider
  apiBaseUrl: string
  authType: 'oauth2' | 'api_key' | 'basic'
  supportedErps: ErpSourceSystem[]
  supportedObjects: ('purchase_order' | 'invoice' | 'vendor' | 'ledger_entry')[]
  webhooksEnabled: boolean
  rateLimits: {
    requestsPerMinute: number
    requestsPerDay: number
  }
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface IntegrationConnection {
  id: string
  accountId: string // Grain & Vault account
  providerId: string
  erpSystem: ErpSourceSystem
  status: IntegrationStatus

  // Auth
  accessToken?: string
  refreshToken?: string
  tokenExpiresAt?: string
  apiKey?: string

  // Sync Config
  syncDirection: SyncDirection
  syncFrequency: SyncFrequency
  lastSyncAt?: string
  lastSyncStatus?: 'success' | 'partial' | 'failed'
  lastSyncError?: string

  // Mapping
  fieldMappings?: Record<string, string>

  // Metadata
  erpCompanyId?: string
  erpCompanyName?: string

  createdAt: string
  updatedAt: string
}

export interface SyncLog {
  id: string
  connectionId: string
  objectType: 'purchase_order' | 'invoice' | 'vendor' | 'ledger_entry'
  direction: SyncDirection
  status: 'started' | 'in_progress' | 'completed' | 'failed'
  recordsProcessed: number
  recordsCreated: number
  recordsUpdated: number
  recordsFailed: number
  errors?: Array<{
    recordId: string
    error: string
  }>
  startedAt: string
  completedAt?: string
  duration?: number // milliseconds
}

export interface ErpObjectStore {
  id: string
  connectionId: string
  objectType: 'purchase_order' | 'invoice' | 'vendor' | 'ledger_entry'
  externalId: string
  normalizedData: ErpPurchaseOrder | ErpInvoice | ErpVendor | ErpLedgerEntry
  rawData: Record<string, unknown>
  hash: string // For change detection
  createdAt: string
  updatedAt: string
  syncedAt: string
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateProviderRequest {
  name: string
  provider: IntegrationProvider
  apiBaseUrl: string
  authType: 'oauth2' | 'api_key' | 'basic'
  supportedErps: ErpSourceSystem[]
  supportedObjects: ('purchase_order' | 'invoice' | 'vendor' | 'ledger_entry')[]
  webhooksEnabled?: boolean
  rateLimits?: {
    requestsPerMinute: number
    requestsPerDay: number
  }
}

export interface ConnectRequest {
  providerId: string
  erpSystem: ErpSourceSystem
  authCode?: string // For OAuth
  apiKey?: string // For API key auth
  credentials?: { // For basic auth
    username: string
    password: string
  }
  syncDirection?: SyncDirection
  syncFrequency?: SyncFrequency
}

export interface SyncRequest {
  connectionId: string
  objectTypes?: ('purchase_order' | 'invoice' | 'vendor' | 'ledger_entry')[]
  fullSync?: boolean // If true, re-sync all records
  sinceDate?: string // Only sync records modified after this date
}

export interface ObjectsQueryParams {
  type: 'purchase_order' | 'invoice' | 'vendor' | 'ledger_entry'
  connectionId?: string
  status?: string
  vendorId?: string
  dateFrom?: string
  dateTo?: string
  minAmount?: number
  maxAmount?: number
  search?: string
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
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

// ============================================================================
// MAPPING TYPES
// ============================================================================

export interface FieldMapping {
  sourceField: string
  targetField: string
  transform?: 'lowercase' | 'uppercase' | 'date' | 'currency' | 'number' | 'custom'
  customTransform?: string // JavaScript expression for custom transforms
  defaultValue?: unknown
}

export interface ObjectMapping {
  sourceSystem: ErpSourceSystem
  objectType: 'purchase_order' | 'invoice' | 'vendor' | 'ledger_entry'
  fieldMappings: FieldMapping[]
  statusMapping?: Record<string, string>
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

export interface WebhookPayload {
  provider: IntegrationProvider
  eventType: 'create' | 'update' | 'delete'
  objectType: 'purchase_order' | 'invoice' | 'vendor' | 'ledger_entry'
  connectionId: string
  externalId: string
  data: Record<string, unknown>
  timestamp: string
}
