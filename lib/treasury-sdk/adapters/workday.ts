// @ts-nocheck
/**
 * Workday Financial Management (WFM) Adapter
 *
 * Integrates with Workday REST API for:
 * - Suppliers (Vendors)
 * - Supplier Invoices
 * - Payments
 * - Journal Entries
 * - Ledger Accounts (GL Accounts)
 * - Cost Centers (Worktags)
 *
 * Uses OAuth2 with Workday Integration System Users
 */

import {
  BaseERPAdapter,
  ERPConnectionConfig,
  ERPCredentials,
  Vendor,
  Invoice,
  InvoiceLineItem,
  Payment,
  JournalEntry,
  JournalLine,
  GLAccount,
  CostCenter,
  SyncResult,
} from './base'

// ============================================================================
// WORKDAY TYPES
// ============================================================================

export interface WorkdayConfig extends ERPConnectionConfig {
  tenant: string                      // e.g., 'acme_corp'
  integrationId: string               // Integration System User (ISU) ID
  integrationSecret: string           // Integration System User secret
  refreshToken?: string               // OAuth2 refresh token
  dataCenter?: 'us' | 'eu' | 'ca' | 'ap' // Workday data center
  apiVersion?: string                 // Default: 'v1'
}

interface WorkdayReference {
  id: string                          // Workday ID (WID)
  descriptor?: string                 // Human-readable name
}

interface WorkdaySupplier {
  id: string
  supplierName: string
  supplierReferenceID?: string
  taxID?: string
  primaryEmail?: string
  primaryPhone?: string
  paymentTerms?: WorkdayReference
  currency?: WorkdayReference
  bankAccounts?: Array<{
    bankName: string
    accountNumber: string
    routingNumber?: string
    swiftCode?: string
    iban?: string
  }>
  worktags?: Record<string, string>
}

interface WorkdaySupplierInvoice {
  id: string
  invoiceNumber: string
  supplier: WorkdayReference
  invoiceDate: string
  dueDate: string
  invoiceAmount: number
  currency: WorkdayReference
  status: string
  lineItems?: Array<{
    lineNumber: number
    description: string
    quantity: number
    unitCost: number
    extendedAmount: number
    ledgerAccount?: WorkdayReference
    costCenter?: WorkdayReference
    worktags?: Record<string, WorkdayReference>
  }>
  purchaseOrder?: WorkdayReference
  memo?: string
  worktags?: Record<string, WorkdayReference>
}

interface WorkdayPayment {
  id: string
  paymentNumber?: string
  supplier: WorkdayReference
  paymentDate: string
  paymentAmount: number
  currency: WorkdayReference
  paymentType: WorkdayReference
  status: string
  bankAccount?: WorkdayReference
  invoices?: WorkdayReference[]
  memo?: string
  worktags?: Record<string, WorkdayReference>
}

interface WorkdayJournalEntry {
  id?: string
  journalEntryDate: string
  journalSource: WorkdayReference
  memo: string
  journalLines: Array<{
    ledgerAccount: WorkdayReference
    debit?: number
    credit?: number
    worktags?: Record<string, WorkdayReference>
    memo?: string
  }>
}

interface WorkdayLedgerAccount {
  id: string
  accountNumber: string
  accountName: string
  accountType: string
  currency?: WorkdayReference
  inactive: boolean
  parentLedgerAccount?: WorkdayReference
}

interface WorkdayCostCenter {
  id: string
  costCenterID: string
  costCenterName: string
  inactive: boolean
  parentCostCenter?: WorkdayReference
}

interface WorkdayOAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
}

// ============================================================================
// WORKDAY ADAPTER
// ============================================================================

export class WorkdayAdapter extends BaseERPAdapter {
  private workdayConfig: WorkdayConfig
  private refreshToken?: string

  constructor(config: WorkdayConfig) {
    super(config)
    this.workdayConfig = config
    this.refreshToken = config.refreshToken

    // Override default GL mappings for Workday
    this.glMappings = {
      'payment': '210000',              // Accounts Payable
      'receipt': '110000',              // Cash and Cash Equivalents
      'credit_draw': '250000',          // Lines of Credit
      'credit_repay': '250000',         // Lines of Credit
      'grain_appreciation': '890000',   // Other Income
      'grain_reserve': '130000',        // Cryptocurrency Assets
    }
  }

  // ============================================================================
  // CONNECTION METHODS
  // ============================================================================

  async connect(): Promise<void> {
    try {
      const tokenUrl = this.buildTokenUrl()

      const body = new URLSearchParams({
        grant_type: this.refreshToken ? 'refresh_token' : 'client_credentials',
        client_id: this.workdayConfig.integrationId,
        client_secret: this.workdayConfig.integrationSecret,
      })

      if (this.refreshToken) {
        body.append('refresh_token', this.refreshToken)
      }

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Workday OAuth Error: ${response.status} - ${error}`)
      }

      const data: WorkdayOAuthResponse = await response.json()

      this.accessToken = data.access_token
      this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000))

      if (data.refresh_token) {
        this.refreshToken = data.refresh_token
      }

      this.connectionStatus = 'connected'
    } catch (error) {
      this.connectionStatus = 'error'
      throw new Error(`Failed to connect to Workday: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async disconnect(): Promise<void> {
    this.accessToken = undefined
    this.tokenExpiry = undefined
    this.connectionStatus = 'disconnected'
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.connect()
      // Test with a simple API call
      await this.makeWorkdayRequest<{ data: unknown[] }>('GET', '/suppliers', { limit: 1 })
      return true
    } catch (error) {
      console.error('Workday connection test failed:', error)
      this.connectionStatus = 'error'
      return false
    }
  }

  // ============================================================================
  // VENDOR METHODS
  // ============================================================================

  async getVendors(filters?: { modifiedSince?: Date; limit?: number }): Promise<Vendor[]> {
    const params: Record<string, string> = {}

    if (filters?.limit) {
      params.limit = filters.limit.toString()
    }

    if (filters?.modifiedSince) {
      params.lastModified = filters.modifiedSince.toISOString()
    }

    const response = await this.makeWorkdayRequest<{ data: WorkdaySupplier[] }>(
      'GET',
      '/suppliers',
      params
    )

    return response.data.map(s => this.mapSupplierToVendor(s))
  }

  async getVendor(vendorId: string): Promise<Vendor | null> {
    try {
      const response = await this.makeWorkdayRequest<WorkdaySupplier>(
        'GET',
        `/suppliers/${vendorId}`
      )
      return this.mapSupplierToVendor(response)
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }

  async createVendor(vendor: Partial<Vendor>): Promise<SyncResult<Vendor>> {
    try {
      const workdaySupplier = this.mapVendorToSupplier(vendor)

      const response = await this.makeWorkdayRequest<WorkdaySupplier>(
        'POST',
        '/suppliers',
        undefined,
        workdaySupplier
      )

      return {
        success: true,
        data: this.mapSupplierToVendor(response),
        externalId: response.id,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async updateVendor(vendorId: string, updates: Partial<Vendor>): Promise<SyncResult<Vendor>> {
    try {
      const workdaySupplier = this.mapVendorToSupplier(updates)

      const response = await this.makeWorkdayRequest<WorkdaySupplier>(
        'PATCH',
        `/suppliers/${vendorId}`,
        undefined,
        workdaySupplier
      )

      return {
        success: true,
        data: this.mapSupplierToVendor(response),
        externalId: response.id,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // ============================================================================
  // INVOICE METHODS
  // ============================================================================

  async getInvoices(filters?: {
    status?: Invoice['status'][]
    vendorId?: string
    dueBefore?: Date
    dueAfter?: Date
    modifiedSince?: Date
    limit?: number
  }): Promise<Invoice[]> {
    const params: Record<string, string> = {}

    if (filters?.limit) {
      params.limit = filters.limit.toString()
    }

    if (filters?.vendorId) {
      params.supplier = filters.vendorId
    }

    if (filters?.dueBefore) {
      params.dueDateBefore = filters.dueBefore.toISOString()
    }

    if (filters?.dueAfter) {
      params.dueDateAfter = filters.dueAfter.toISOString()
    }

    if (filters?.modifiedSince) {
      params.lastModified = filters.modifiedSince.toISOString()
    }

    if (filters?.status && filters.status.length > 0) {
      params.status = this.mapInvoiceStatusToWorkday(filters.status)
    }

    const response = await this.makeWorkdayRequest<{ data: WorkdaySupplierInvoice[] }>(
      'GET',
      '/supplier_invoices',
      params
    )

    return response.data.map(inv => this.mapWorkdayInvoiceToInvoice(inv))
  }

  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    try {
      const response = await this.makeWorkdayRequest<WorkdaySupplierInvoice>(
        'GET',
        `/supplier_invoices/${invoiceId}`
      )
      return this.mapWorkdayInvoiceToInvoice(response)
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }

  // ============================================================================
  // PAYMENT METHODS
  // ============================================================================

  async createPayment(payment: Partial<Payment>): Promise<SyncResult<Payment>> {
    try {
      const workdayPayment = this.mapPaymentToWorkdayPayment(payment)

      const response = await this.makeWorkdayRequest<WorkdayPayment>(
        'POST',
        '/payments',
        undefined,
        workdayPayment
      )

      return {
        success: true,
        data: this.mapWorkdayPaymentToPayment(response),
        externalId: response.id,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async syncPayment(payment: Payment): Promise<SyncResult<Payment>> {
    if (payment.externalId) {
      // Update existing payment
      try {
        const workdayPayment = this.mapPaymentToWorkdayPayment(payment)

        const response = await this.makeWorkdayRequest<WorkdayPayment>(
          'PATCH',
          `/payments/${payment.externalId}`,
          undefined,
          workdayPayment
        )

        return {
          success: true,
          data: this.mapWorkdayPaymentToPayment(response),
          externalId: response.id,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    } else {
      // Create new payment
      return this.createPayment(payment)
    }
  }

  async getPayment(paymentId: string): Promise<Payment | null> {
    try {
      const response = await this.makeWorkdayRequest<WorkdayPayment>(
        'GET',
        `/payments/${paymentId}`
      )
      return this.mapWorkdayPaymentToPayment(response)
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }

  async getPayments(filters?: {
    vendorId?: string
    status?: Payment['status'][]
    dateFrom?: Date
    dateTo?: Date
    limit?: number
  }): Promise<Payment[]> {
    const params: Record<string, string> = {}

    if (filters?.limit) {
      params.limit = filters.limit.toString()
    }

    if (filters?.vendorId) {
      params.supplier = filters.vendorId
    }

    if (filters?.dateFrom) {
      params.paymentDateFrom = filters.dateFrom.toISOString()
    }

    if (filters?.dateTo) {
      params.paymentDateTo = filters.dateTo.toISOString()
    }

    if (filters?.status && filters.status.length > 0) {
      params.status = this.mapPaymentStatusToWorkday(filters.status)
    }

    const response = await this.makeWorkdayRequest<{ data: WorkdayPayment[] }>(
      'GET',
      '/payments',
      params
    )

    return response.data.map(pmt => this.mapWorkdayPaymentToPayment(pmt))
  }

  // ============================================================================
  // JOURNAL ENTRY METHODS
  // ============================================================================

  async createJournalEntry(entry: Partial<JournalEntry>): Promise<SyncResult<JournalEntry>> {
    try {
      const workdayJE = this.mapJournalEntryToWorkday(entry)

      const response = await this.makeWorkdayRequest<WorkdayJournalEntry>(
        'POST',
        '/journal_entries',
        undefined,
        workdayJE
      )

      return {
        success: true,
        data: this.mapWorkdayJournalEntryToJournalEntry(response),
        externalId: response.id,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // ============================================================================
  // GL ACCOUNT & COST CENTER METHODS
  // ============================================================================

  async getGLAccounts(): Promise<GLAccount[]> {
    const response = await this.makeWorkdayRequest<{ data: WorkdayLedgerAccount[] }>(
      'GET',
      '/ledger_accounts',
      { limit: '1000' }
    )

    return response.data.map(acc => this.mapLedgerAccountToGLAccount(acc))
  }

  async getCostCenters(): Promise<CostCenter[]> {
    const response = await this.makeWorkdayRequest<{ data: WorkdayCostCenter[] }>(
      'GET',
      '/cost_centers',
      { limit: '1000' }
    )

    return response.data.map(cc => this.mapWorkdayCostCenterToCostCenter(cc))
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private buildTokenUrl(): string {
    const dc = this.workdayConfig.dataCenter || 'us'
    const dcSuffix = dc === 'us' ? '' : `-${dc}`
    return `https://wd2-impl-services1${dcSuffix}.workday.com/ccx/oauth2/${this.workdayConfig.tenant}/token`
  }

  private buildApiUrl(path: string): string {
    const dc = this.workdayConfig.dataCenter || 'us'
    const dcSuffix = dc === 'us' ? '' : `-${dc}`
    const version = this.workdayConfig.apiVersion || 'v1'
    const tenant = this.workdayConfig.tenant

    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    return `https://wd2-impl-services1${dcSuffix}.workday.com/ccx/api/financial_management/${version}/${tenant}/${cleanPath}`
  }

  private async makeWorkdayRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    queryParams?: Record<string, string>,
    body?: unknown
  ): Promise<T> {
    await this.refreshTokenIfNeeded()

    let url = this.buildApiUrl(path)

    if (queryParams) {
      const params = new URLSearchParams(queryParams)
      url += `?${params.toString()}`
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Workday API Error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  // ============================================================================
  // MAPPING METHODS
  // ============================================================================

  private mapSupplierToVendor(supplier: WorkdaySupplier): Vendor {
    return {
      id: supplier.id,
      externalId: supplier.id,
      name: supplier.supplierName,
      email: supplier.primaryEmail,
      phone: supplier.primaryPhone,
      taxId: supplier.taxID,
      currency: supplier.currency?.descriptor || 'USD',
      paymentTerms: supplier.paymentTerms?.descriptor,
      bankAccount: supplier.bankAccounts?.[0] ? {
        bankName: supplier.bankAccounts[0].bankName,
        accountNumber: supplier.bankAccounts[0].accountNumber,
        routingNumber: supplier.bankAccounts[0].routingNumber || '',
        swiftCode: supplier.bankAccounts[0].swiftCode,
        iban: supplier.bankAccounts[0].iban,
      } : undefined,
      metadata: supplier.worktags,
    }
  }

  private mapVendorToSupplier(vendor: Partial<Vendor>): Partial<WorkdaySupplier> {
    const supplier: Partial<WorkdaySupplier> = {}

    if (vendor.name) supplier.supplierName = vendor.name
    if (vendor.email) supplier.primaryEmail = vendor.email
    if (vendor.phone) supplier.primaryPhone = vendor.phone
    if (vendor.taxId) supplier.taxID = vendor.taxId

    if (vendor.currency) {
      supplier.currency = { id: vendor.currency, descriptor: vendor.currency }
    }

    if (vendor.bankAccount) {
      supplier.bankAccounts = [{
        bankName: vendor.bankAccount.bankName,
        accountNumber: vendor.bankAccount.accountNumber,
        routingNumber: vendor.bankAccount.routingNumber,
        swiftCode: vendor.bankAccount.swiftCode,
        iban: vendor.bankAccount.iban,
      }]
    }

    if (vendor.metadata) {
      supplier.worktags = vendor.metadata
    }

    return supplier
  }

  private mapWorkdayInvoiceToInvoice(invoice: WorkdaySupplierInvoice): Invoice {
    return {
      id: invoice.id,
      externalId: invoice.id,
      vendorId: invoice.supplier.id,
      vendorName: invoice.supplier.descriptor || '',
      amount: invoice.invoiceAmount,
      currency: invoice.currency.descriptor || 'USD',
      dueDate: new Date(invoice.dueDate),
      invoiceDate: new Date(invoice.invoiceDate),
      status: this.mapWorkdayStatusToInvoiceStatus(invoice.status),
      lineItems: invoice.lineItems?.map((line, idx) => ({
        id: `${invoice.id}-${idx}`,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitCost,
        amount: line.extendedAmount,
        glAccount: line.ledgerAccount?.id,
        costCenter: line.costCenter?.id,
      })) || [],
      costCenter: invoice.worktags?.['Cost_Center']?.id,
      glAccount: invoice.lineItems?.[0]?.ledgerAccount?.id,
      poNumber: invoice.purchaseOrder?.id,
      description: invoice.memo,
      metadata: invoice.worktags ? this.flattenWorktags(invoice.worktags) : undefined,
    }
  }

  private mapPaymentToWorkdayPayment(payment: Partial<Payment>): Partial<WorkdayPayment> {
    const workdayPayment: Partial<WorkdayPayment> = {}

    if (payment.vendorId) {
      workdayPayment.supplier = { id: payment.vendorId }
    }

    if (payment.paymentDate) {
      workdayPayment.paymentDate = payment.paymentDate.toISOString()
    }

    if (payment.amount !== undefined) {
      workdayPayment.paymentAmount = payment.amount
    }

    if (payment.currency) {
      workdayPayment.currency = { id: payment.currency, descriptor: payment.currency }
    }

    if (payment.paymentMethod) {
      workdayPayment.paymentType = {
        id: this.mapPaymentMethodToWorkday(payment.paymentMethod),
      }
    }

    if (payment.reference) {
      workdayPayment.memo = payment.reference
    }

    if (payment.invoiceId) {
      workdayPayment.invoices = [{ id: payment.invoiceId }]
    }

    return workdayPayment
  }

  private mapWorkdayPaymentToPayment(payment: WorkdayPayment): Payment {
    return {
      id: payment.id,
      externalId: payment.id,
      invoiceId: payment.invoices?.[0]?.id || '',
      vendorId: payment.supplier.id,
      amount: payment.paymentAmount,
      currency: payment.currency.descriptor || 'USD',
      paymentDate: new Date(payment.paymentDate),
      paymentMethod: this.mapWorkdayPaymentTypeToMethod(payment.paymentType.descriptor || 'wire'),
      status: this.mapWorkdayStatusToPaymentStatus(payment.status),
      bankAccount: payment.bankAccount?.id,
      reference: payment.memo,
      metadata: payment.worktags ? this.flattenWorktags(payment.worktags) : undefined,
    }
  }

  private mapJournalEntryToWorkday(entry: Partial<JournalEntry>): WorkdayJournalEntry {
    return {
      journalEntryDate: entry.date?.toISOString() || new Date().toISOString(),
      journalSource: { id: 'GRAIN_TREASURY', descriptor: 'GRAIN Treasury SDK' },
      memo: entry.description || '',
      journalLines: (entry.lines || []).map(line => ({
        ledgerAccount: { id: line.accountId },
        debit: line.debit > 0 ? line.debit : undefined,
        credit: line.credit > 0 ? line.credit : undefined,
        worktags: line.costCenter ? {
          Cost_Center: { id: line.costCenter },
        } : undefined,
        memo: line.memo,
      })),
    }
  }

  private mapWorkdayJournalEntryToJournalEntry(je: WorkdayJournalEntry): JournalEntry {
    return {
      id: je.id || '',
      externalId: je.id,
      date: new Date(je.journalEntryDate),
      description: je.memo,
      lines: je.journalLines.map(line => ({
        accountId: line.ledgerAccount.id,
        accountName: line.ledgerAccount.descriptor,
        debit: line.debit || 0,
        credit: line.credit || 0,
        costCenter: line.worktags?.['Cost_Center']?.id,
        memo: line.memo,
      })),
      status: 'posted',
    }
  }

  private mapLedgerAccountToGLAccount(account: WorkdayLedgerAccount): GLAccount {
    return {
      id: account.id,
      code: account.accountNumber,
      name: account.accountName,
      type: this.mapWorkdayAccountType(account.accountType),
      currency: account.currency?.descriptor,
      isActive: !account.inactive,
      parentId: account.parentLedgerAccount?.id,
    }
  }

  private mapWorkdayCostCenterToCostCenter(cc: WorkdayCostCenter): CostCenter {
    return {
      id: cc.id,
      code: cc.costCenterID,
      name: cc.costCenterName,
      isActive: !cc.inactive,
      parentId: cc.parentCostCenter?.id,
    }
  }

  private mapWorkdayAccountType(type: string): GLAccount['type'] {
    const typeMap: Record<string, GLAccount['type']> = {
      'ASSETS': 'asset',
      'LIABILITIES': 'liability',
      'EQUITY': 'equity',
      'REVENUE': 'revenue',
      'EXPENSE': 'expense',
    }
    return typeMap[type.toUpperCase()] || 'asset'
  }

  private mapWorkdayStatusToInvoiceStatus(status: string): Invoice['status'] {
    const statusMap: Record<string, Invoice['status']> = {
      'OPEN': 'open',
      'PARTIALLY_PAID': 'partial',
      'PAID': 'paid',
      'CANCELLED': 'cancelled',
      'DISPUTED': 'disputed',
    }
    return statusMap[status.toUpperCase()] || 'open'
  }

  private mapInvoiceStatusToWorkday(statuses: Invoice['status'][]): string {
    const statusMap: Record<Invoice['status'], string> = {
      'open': 'OPEN',
      'partial': 'PARTIALLY_PAID',
      'paid': 'PAID',
      'cancelled': 'CANCELLED',
      'disputed': 'DISPUTED',
    }
    return statuses.map(s => statusMap[s]).join(',')
  }

  private mapWorkdayStatusToPaymentStatus(status: string): Payment['status'] {
    const statusMap: Record<string, Payment['status']> = {
      'PENDING': 'pending',
      'IN_PROGRESS': 'processing',
      'COMPLETED': 'completed',
      'FAILED': 'failed',
      'REVERSED': 'reversed',
    }
    return statusMap[status.toUpperCase()] || 'pending'
  }

  private mapPaymentStatusToWorkday(statuses: Payment['status'][]): string {
    const statusMap: Record<Payment['status'], string> = {
      'pending': 'PENDING',
      'processing': 'IN_PROGRESS',
      'completed': 'COMPLETED',
      'failed': 'FAILED',
      'reversed': 'REVERSED',
    }
    return statuses.map(s => statusMap[s]).join(',')
  }

  private mapPaymentMethodToWorkday(method: Payment['paymentMethod']): string {
    const methodMap: Record<Payment['paymentMethod'], string> = {
      'grain': 'CRYPTOCURRENCY',
      'wire': 'WIRE',
      'ach': 'ACH',
      'check': 'CHECK',
    }
    return methodMap[method] || 'WIRE'
  }

  private mapWorkdayPaymentTypeToMethod(type: string): Payment['paymentMethod'] {
    const methodMap: Record<string, Payment['paymentMethod']> = {
      'CRYPTOCURRENCY': 'grain',
      'WIRE': 'wire',
      'ACH': 'ach',
      'CHECK': 'check',
    }
    return methodMap[type.toUpperCase()] || 'wire'
  }

  private flattenWorktags(worktags: Record<string, WorkdayReference>): Record<string, string> {
    const flattened: Record<string, string> = {}
    for (const [key, value] of Object.entries(worktags)) {
      flattened[key] = value.id
    }
    return flattened
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createWorkdayAdapter(config: WorkdayConfig): WorkdayAdapter {
  return new WorkdayAdapter(config)
}

export default WorkdayAdapter
