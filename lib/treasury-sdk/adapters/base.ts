/**
 * Base ERP Adapter Interface
 *
 * All ERP adapters implement this interface to provide consistent
 * integration capabilities across SAP, Oracle, NetSuite, Dynamics 365,
 * Workday, and Coupa.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ERPCredentials {
  type: 'oauth2' | 'apikey' | 'basic' | 'certificate'
  clientId?: string
  clientSecret?: string
  apiKey?: string
  username?: string
  password?: string
  certificatePath?: string
  privateKeyPath?: string
  tokenUrl?: string
  scopes?: string[]
}

export interface ERPConnectionConfig {
  endpoint: string
  credentials: ERPCredentials
  companyId?: string
  environment?: 'sandbox' | 'production'
  timeout?: number
  retryAttempts?: number
}

export interface Vendor {
  id: string
  externalId: string              // ERP vendor ID
  name: string
  email?: string
  phone?: string
  taxId?: string
  currency: string
  paymentTerms?: string           // Net30, Net60, etc.
  bankAccount?: {
    bankName: string
    accountNumber: string
    routingNumber: string
    swiftCode?: string
    iban?: string
  }
  grainWalletAddress?: string     // If onboarded to GRAIN
  metadata?: Record<string, string>
}

export interface Invoice {
  id: string
  externalId: string              // ERP invoice ID
  vendorId: string
  vendorName: string
  amount: number
  currency: string
  dueDate: Date
  invoiceDate: Date
  status: 'open' | 'partial' | 'paid' | 'cancelled' | 'disputed'
  lineItems: InvoiceLineItem[]
  costCenter?: string
  glAccount?: string
  poNumber?: string
  description?: string
  metadata?: Record<string, string>
}

export interface InvoiceLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  amount: number
  glAccount?: string
  costCenter?: string
  taxCode?: string
}

export interface Payment {
  id: string
  externalId?: string             // ERP payment ID once synced
  invoiceId: string
  vendorId: string
  amount: number
  currency: string
  paymentDate: Date
  paymentMethod: 'grain' | 'wire' | 'ach' | 'check'
  grainTransactionId?: string     // GRAIN blockchain tx ID
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'reversed'
  glAccount?: string
  costCenter?: string
  bankAccount?: string
  reference?: string
  metadata?: Record<string, string>
}

export interface JournalEntry {
  id: string
  externalId?: string
  date: Date
  description: string
  lines: JournalLine[]
  status: 'draft' | 'posted' | 'reversed'
  reference?: string
  metadata?: Record<string, string>
}

export interface JournalLine {
  accountId: string
  accountName?: string
  debit: number
  credit: number
  costCenter?: string
  department?: string
  memo?: string
}

export interface GLAccount {
  id: string
  code: string
  name: string
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  currency?: string
  isActive: boolean
  parentId?: string
}

export interface CostCenter {
  id: string
  code: string
  name: string
  isActive: boolean
  parentId?: string
}

export interface SyncResult<T> {
  success: boolean
  data?: T
  error?: string
  externalId?: string
  warnings?: string[]
}

export interface BatchSyncResult<T> {
  total: number
  succeeded: number
  failed: number
  results: SyncResult<T>[]
}

// ============================================================================
// BASE ADAPTER INTERFACE
// ============================================================================

export interface ERPAdapter {
  // Connection
  connect(): Promise<void>
  disconnect(): Promise<void>
  testConnection(): Promise<boolean>
  getConnectionStatus(): 'connected' | 'disconnected' | 'error'

  // Vendors
  getVendors(filters?: { modifiedSince?: Date; limit?: number }): Promise<Vendor[]>
  getVendor(vendorId: string): Promise<Vendor | null>
  createVendor(vendor: Partial<Vendor>): Promise<SyncResult<Vendor>>
  updateVendor(vendorId: string, updates: Partial<Vendor>): Promise<SyncResult<Vendor>>

  // Invoices
  getInvoices(filters?: {
    status?: Invoice['status'][]
    vendorId?: string
    dueBefore?: Date
    dueAfter?: Date
    modifiedSince?: Date
    limit?: number
  }): Promise<Invoice[]>
  getInvoice(invoiceId: string): Promise<Invoice | null>
  getPayableInvoices(): Promise<Invoice[]>

  // Payments
  createPayment(payment: Partial<Payment>): Promise<SyncResult<Payment>>
  syncPayment(payment: Payment): Promise<SyncResult<Payment>>
  getPayment(paymentId: string): Promise<Payment | null>
  getPayments(filters?: {
    vendorId?: string
    status?: Payment['status'][]
    dateFrom?: Date
    dateTo?: Date
    limit?: number
  }): Promise<Payment[]>

  // Journal Entries (for GRAIN transactions)
  createJournalEntry(entry: Partial<JournalEntry>): Promise<SyncResult<JournalEntry>>

  // GL Accounts & Cost Centers
  getGLAccounts(): Promise<GLAccount[]>
  getCostCenters(): Promise<CostCenter[]>

  // Mapping helpers
  mapGrainToGLAccount(transactionType: string): string
  mapCostCenter(grainCostCenter: string): string
}

// ============================================================================
// ABSTRACT BASE CLASS
// ============================================================================

export abstract class BaseERPAdapter implements ERPAdapter {
  protected config: ERPConnectionConfig
  protected accessToken?: string
  protected tokenExpiry?: Date
  protected connectionStatus: 'connected' | 'disconnected' | 'error' = 'disconnected'

  constructor(config: ERPConnectionConfig) {
    this.config = config
  }

  // Default GL account mappings (override in specific adapters)
  protected glMappings: Record<string, string> = {
    'payment': '20000',           // Accounts Payable
    'receipt': '10000',           // Cash
    'credit_draw': '22000',       // Credit Line Payable
    'credit_repay': '22000',      // Credit Line Payable
    'grain_appreciation': '40000', // Other Income
    'grain_reserve': '11000',     // GRAIN Reserve Asset
  }

  protected costCenterMappings: Record<string, string> = {}

  // Connection methods
  abstract connect(): Promise<void>
  abstract disconnect(): Promise<void>
  abstract testConnection(): Promise<boolean>

  getConnectionStatus(): 'connected' | 'disconnected' | 'error' {
    return this.connectionStatus
  }

  // Vendor methods
  abstract getVendors(filters?: { modifiedSince?: Date; limit?: number }): Promise<Vendor[]>
  abstract getVendor(vendorId: string): Promise<Vendor | null>
  abstract createVendor(vendor: Partial<Vendor>): Promise<SyncResult<Vendor>>
  abstract updateVendor(vendorId: string, updates: Partial<Vendor>): Promise<SyncResult<Vendor>>

  // Invoice methods
  abstract getInvoices(filters?: {
    status?: Invoice['status'][]
    vendorId?: string
    dueBefore?: Date
    dueAfter?: Date
    modifiedSince?: Date
    limit?: number
  }): Promise<Invoice[]>
  abstract getInvoice(invoiceId: string): Promise<Invoice | null>

  async getPayableInvoices(): Promise<Invoice[]> {
    return this.getInvoices({ status: ['open', 'partial'] })
  }

  // Payment methods
  abstract createPayment(payment: Partial<Payment>): Promise<SyncResult<Payment>>
  abstract syncPayment(payment: Payment): Promise<SyncResult<Payment>>
  abstract getPayment(paymentId: string): Promise<Payment | null>
  abstract getPayments(filters?: {
    vendorId?: string
    status?: Payment['status'][]
    dateFrom?: Date
    dateTo?: Date
    limit?: number
  }): Promise<Payment[]>

  // Journal Entry methods
  abstract createJournalEntry(entry: Partial<JournalEntry>): Promise<SyncResult<JournalEntry>>

  // GL & Cost Center methods
  abstract getGLAccounts(): Promise<GLAccount[]>
  abstract getCostCenters(): Promise<CostCenter[]>

  // Mapping methods
  mapGrainToGLAccount(transactionType: string): string {
    return this.glMappings[transactionType] || this.glMappings['payment']
  }

  mapCostCenter(grainCostCenter: string): string {
    return this.costCenterMappings[grainCostCenter] || grainCostCenter
  }

  // Helper methods
  protected async refreshTokenIfNeeded(): Promise<void> {
    if (this.tokenExpiry && new Date() >= this.tokenExpiry) {
      await this.connect()
    }
  }

  protected buildUrl(path: string): string {
    const base = this.config.endpoint.replace(/\/$/, '')
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    return `${base}${cleanPath}`
  }

  protected async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    await this.refreshTokenIfNeeded()

    const url = this.buildUrl(path)
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`ERP API Error: ${response.status} - ${error}`)
    }

    return response.json()
  }
}

export default BaseERPAdapter
