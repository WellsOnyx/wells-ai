/**
 * Layer 3: Conversational ERP Mode
 *
 * Type definitions for the conversational interface that WellsAI uses
 * to interact with the ERP system.
 */

// ============================================================================
// INTENT TYPES
// ============================================================================

export type ErpIntent =
  // Vendor Intents
  | 'create_vendor'
  | 'update_vendor'
  | 'search_vendor'
  | 'get_vendor_details'

  // Purchase Order Intents
  | 'create_po'
  | 'update_po'
  | 'approve_po'
  | 'search_po'
  | 'get_po_status'

  // Invoice Intents
  | 'create_invoice'
  | 'approve_invoice'
  | 'dispute_invoice'
  | 'search_invoices'
  | 'get_invoice_status'
  | 'get_overdue_invoices'

  // Payment Intents
  | 'create_payment'
  | 'authorize_payment'
  | 'schedule_payment'
  | 'cancel_payment'
  | 'get_payment_status'

  // Ledger Intents
  | 'get_balance'
  | 'get_ledger_summary'
  | 'get_trial_balance'
  | 'get_float_balance'
  | 'get_yield_summary'

  // Escrow Intents
  | 'create_escrow'
  | 'release_escrow'
  | 'get_escrow_status'

  // General
  | 'get_summary'
  | 'unknown'

export type IntentConfidence = 'high' | 'medium' | 'low'

// ============================================================================
// ENTITY EXTRACTION
// ============================================================================

export interface ExtractedEntities {
  // Identifiers
  vendorId?: string
  vendorName?: string
  vendorCode?: string
  poNumber?: string
  invoiceNumber?: string
  paymentNumber?: string
  escrowCode?: string

  // Amounts
  amount?: number
  quantity?: number
  unitPrice?: number
  taxAmount?: number
  discountAmount?: number

  // Currency
  currency?: string

  // Dates
  date?: string
  dueDate?: string
  deliveryDate?: string
  scheduledDate?: string

  // Status
  status?: string

  // Categories/Tags
  categories?: string[]
  tags?: string[]

  // Contact Info
  contactName?: string
  contactEmail?: string
  contactPhone?: string

  // Address
  street?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string

  // Payment
  paymentMethod?: 'grain' | 'ach' | 'wire' | 'check' | 'virtual_card'
  paymentTerms?: string

  // Line Items (for PO/Invoice creation)
  lineItems?: Array<{
    description: string
    quantity: number
    unitPrice: number
    accountCode?: string
  }>

  // Tracking
  costCenter?: string
  department?: string
  project?: string

  // Notes
  notes?: string
  memo?: string

  // Filters
  dateFrom?: string
  dateTo?: string
  minAmount?: number
  maxAmount?: number
}

// ============================================================================
// CONVERSATION STATE
// ============================================================================

export type ConversationState =
  | 'idle'
  | 'gathering_info'
  | 'confirming'
  | 'processing'
  | 'awaiting_authorization'
  | 'completed'
  | 'error'

export interface ConversationContext {
  sessionId: string
  accountId: string
  userId?: string

  // Current state
  state: ConversationState
  currentIntent?: ErpIntent
  intentConfidence?: IntentConfidence

  // Extracted data
  entities: ExtractedEntities

  // Missing required fields for current intent
  missingFields: string[]

  // Pending action (awaiting confirmation/authorization)
  pendingAction?: PendingAction

  // Conversation history (last N turns)
  history: ConversationTurn[]

  // Timestamps
  startedAt: string
  lastActivityAt: string
}

export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  intent?: ErpIntent
  entities?: ExtractedEntities
  action?: ActionResult
}

export interface PendingAction {
  type: 'create' | 'update' | 'approve' | 'authorize' | 'delete'
  resource: 'vendor' | 'purchase_order' | 'invoice' | 'payment' | 'escrow'
  data: Record<string, unknown>
  requiresAuthorization: boolean
  expiresAt: string
}

// ============================================================================
// ACTION RESULTS
// ============================================================================

export interface ActionResult {
  success: boolean
  action: ErpIntent
  resource?: string
  resourceId?: string
  message: string
  data?: Record<string, unknown>
  error?: string
  nextSteps?: string[]
}

// ============================================================================
// CONVERSATIONAL ENDPOINTS
// ============================================================================

export interface ConversationalRequest {
  message: string
  sessionId?: string
  accountId: string
  userId?: string
  context?: Partial<ConversationContext>
}

export interface ConversationalResponse {
  message: string
  sessionId: string
  state: ConversationState
  intent?: ErpIntent
  intentConfidence?: IntentConfidence
  entities?: ExtractedEntities
  missingFields?: string[]
  suggestedActions?: SuggestedAction[]
  actionResult?: ActionResult
  pendingAction?: PendingAction
  quickReplies?: string[]
}

export interface SuggestedAction {
  label: string
  intent: ErpIntent
  entities?: Partial<ExtractedEntities>
}

// ============================================================================
// INTENT DEFINITIONS
// ============================================================================

export interface IntentDefinition {
  intent: ErpIntent
  description: string
  requiredFields: string[]
  optionalFields: string[]
  examples: string[]
  confirmationRequired: boolean
  authorizationRequired: boolean
}

export const INTENT_DEFINITIONS: IntentDefinition[] = [
  // Vendor Intents
  {
    intent: 'create_vendor',
    description: 'Create a new vendor/supplier',
    requiredFields: ['vendorName'],
    optionalFields: ['contactEmail', 'contactPhone', 'paymentMethod', 'paymentTerms', 'street', 'city', 'state', 'country'],
    examples: [
      'Add a new vendor called ABC Supplies',
      'Create a supplier named Tech Corp',
      'Register a new vendor',
    ],
    confirmationRequired: true,
    authorizationRequired: false,
  },
  {
    intent: 'search_vendor',
    description: 'Search for vendors',
    requiredFields: [],
    optionalFields: ['vendorName', 'vendorCode', 'status', 'categories'],
    examples: [
      'Find vendors for office supplies',
      'Search for Acme',
      'List all active vendors',
    ],
    confirmationRequired: false,
    authorizationRequired: false,
  },

  // Purchase Order Intents
  {
    intent: 'create_po',
    description: 'Create a new purchase order',
    requiredFields: ['vendorId', 'lineItems'],
    optionalFields: ['deliveryDate', 'costCenter', 'department', 'project', 'notes'],
    examples: [
      'Create a PO for Acme with 100 widgets at $25 each',
      'Order office supplies from Office Depot',
      'I need to create a purchase order',
    ],
    confirmationRequired: true,
    authorizationRequired: false,
  },
  {
    intent: 'approve_po',
    description: 'Approve a purchase order',
    requiredFields: ['poNumber'],
    optionalFields: ['notes'],
    examples: [
      'Approve PO-2024-001',
      'I want to approve the purchase order',
      'Sign off on the PO for Acme',
    ],
    confirmationRequired: true,
    authorizationRequired: true,
  },
  {
    intent: 'get_po_status',
    description: 'Check purchase order status',
    requiredFields: ['poNumber'],
    optionalFields: [],
    examples: [
      'What is the status of PO-2024-001?',
      'Check on my order to Acme',
      'Where is my PO?',
    ],
    confirmationRequired: false,
    authorizationRequired: false,
  },

  // Invoice Intents
  {
    intent: 'get_overdue_invoices',
    description: 'Get list of overdue invoices',
    requiredFields: [],
    optionalFields: ['vendorId', 'minAmount', 'maxAmount'],
    examples: [
      'Show me overdue invoices',
      'What invoices are past due?',
      'List unpaid invoices',
    ],
    confirmationRequired: false,
    authorizationRequired: false,
  },
  {
    intent: 'approve_invoice',
    description: 'Approve an invoice for payment',
    requiredFields: ['invoiceNumber'],
    optionalFields: ['notes'],
    examples: [
      'Approve invoice INV-2024-001',
      'I want to approve the Acme invoice',
      'Mark the invoice as approved',
    ],
    confirmationRequired: true,
    authorizationRequired: true,
  },

  // Payment Intents
  {
    intent: 'create_payment',
    description: 'Create a payment to a vendor',
    requiredFields: ['vendorId', 'amount'],
    optionalFields: ['invoiceNumber', 'paymentMethod', 'scheduledDate', 'memo'],
    examples: [
      'Pay $5000 to Acme via GRAIN',
      'Send payment for invoice INV-2024-001',
      'I want to pay the vendor',
    ],
    confirmationRequired: true,
    authorizationRequired: true,
  },
  {
    intent: 'authorize_payment',
    description: 'Authorize a pending payment',
    requiredFields: ['paymentNumber'],
    optionalFields: [],
    examples: [
      'Authorize payment PAY-2024-001',
      'Approve the payment',
      'Yes, send the payment',
    ],
    confirmationRequired: false,
    authorizationRequired: true,
  },

  // Balance/Ledger Intents
  {
    intent: 'get_balance',
    description: 'Get account balance',
    requiredFields: [],
    optionalFields: [],
    examples: [
      'What is my balance?',
      'How much GRAIN do I have?',
      'Check my account',
    ],
    confirmationRequired: false,
    authorizationRequired: false,
  },
  {
    intent: 'get_float_balance',
    description: 'Get float pool balance',
    requiredFields: [],
    optionalFields: [],
    examples: [
      'What is my float balance?',
      'How much is in the float pool?',
      'Check float',
    ],
    confirmationRequired: false,
    authorizationRequired: false,
  },
  {
    intent: 'get_yield_summary',
    description: 'Get yield/interest earned',
    requiredFields: [],
    optionalFields: ['dateFrom', 'dateTo'],
    examples: [
      'How much yield have I earned?',
      'What is my interest this month?',
      'Show yield summary',
    ],
    confirmationRequired: false,
    authorizationRequired: false,
  },

  // Summary
  {
    intent: 'get_summary',
    description: 'Get overall ERP summary',
    requiredFields: [],
    optionalFields: [],
    examples: [
      'Give me a summary',
      'What is my financial overview?',
      'Dashboard',
    ],
    confirmationRequired: false,
    authorizationRequired: false,
  },
]

// ============================================================================
// STATE MACHINE TYPES
// ============================================================================

export type StateTransition = {
  from: ConversationState
  to: ConversationState
  trigger: string
  guard?: (context: ConversationContext) => boolean
  action?: (context: ConversationContext) => void
}

export const STATE_TRANSITIONS: StateTransition[] = [
  // From idle
  { from: 'idle', to: 'gathering_info', trigger: 'intent_detected' },
  { from: 'idle', to: 'completed', trigger: 'query_completed' },

  // From gathering_info
  { from: 'gathering_info', to: 'gathering_info', trigger: 'partial_info' },
  { from: 'gathering_info', to: 'confirming', trigger: 'all_required_fields' },
  { from: 'gathering_info', to: 'idle', trigger: 'cancel' },

  // From confirming
  { from: 'confirming', to: 'processing', trigger: 'confirmed' },
  { from: 'confirming', to: 'awaiting_authorization', trigger: 'needs_auth' },
  { from: 'confirming', to: 'gathering_info', trigger: 'modify' },
  { from: 'confirming', to: 'idle', trigger: 'cancel' },

  // From awaiting_authorization
  { from: 'awaiting_authorization', to: 'processing', trigger: 'authorized' },
  { from: 'awaiting_authorization', to: 'idle', trigger: 'denied' },
  { from: 'awaiting_authorization', to: 'idle', trigger: 'timeout' },

  // From processing
  { from: 'processing', to: 'completed', trigger: 'success' },
  { from: 'processing', to: 'error', trigger: 'failure' },

  // From completed/error
  { from: 'completed', to: 'idle', trigger: 'reset' },
  { from: 'error', to: 'idle', trigger: 'reset' },
  { from: 'error', to: 'gathering_info', trigger: 'retry' },
]

// ============================================================================
// FIELD PROMPTS
// ============================================================================

export const FIELD_PROMPTS: Record<string, string> = {
  vendorName: 'What is the vendor name?',
  vendorId: 'Which vendor is this for?',
  amount: 'What is the amount?',
  quantity: 'How many items?',
  unitPrice: 'What is the price per unit?',
  lineItems: 'What items would you like to include?',
  paymentMethod: 'How would you like to pay? (GRAIN, ACH, Wire, Check)',
  scheduledDate: 'When should this be processed?',
  invoiceNumber: 'What is the invoice number?',
  poNumber: 'What is the PO number?',
  contactEmail: 'What is the contact email?',
  notes: 'Any additional notes?',
}
