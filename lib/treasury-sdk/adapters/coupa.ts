// @ts-nocheck
/**
 * Coupa ERP Adapter for Grain & Vault Treasury SDK
 *
 * Supports Coupa Procurement and Coupa Treasury integrations
 * for Supplier Management, Invoice Processing, and Payment Automation
 *
 * API Documentation: https://compass.coupa.com/en-us/products/core-platform/integration/rest-api
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
  GLAccount,
  CostCenter,
  SyncResult,
} from './base'

// ============================================================================
// COUPA-SPECIFIC TYPES
// ============================================================================

export interface CoupaConfig extends ERPConnectionConfig {
  instanceUrl: string          // e.g., 'acme.coupahost.com'
  apiKey?: string              // API Key authentication
  clientId?: string            // OAuth2 Client ID
  clientSecret?: string        // OAuth2 Client Secret
  scope?: string[]             // OAuth2 scopes
  useOAuth?: boolean           // Use OAuth2 instead of API Key
  apiVersion?: string          // Default: 'v1'
}

interface CoupaSupplier {
  id: number
  name: string
  display_name: string
  number?: string
  status: 'active' | 'inactive'
  'tax-id'?: string
  'primary-contact'?: {
    email?: string
    phone_work?: string
  }
  'primary-address'?: {
    street1?: string
    street2?: string
    city?: string
    state?: string
    'postal-code'?: string
    country?: { code: string }
  }
  'payment-term'?: {
    code: string
    name: string
  }
  'preferred-currency'?: {
    code: string
  }
  'supplier-information-addresses'?: CoupaSupplierAddress[]
  'custom-fields'?: Record<string, unknown>
  'created-at': string
  'updated-at': string
}

interface CoupaSupplierAddress {
  'address-type': string
  'name-given'?: string
  'name-family'?: string
  email?: string
  'phone-number'?: string
  street1?: string
  city?: string
  'postal-code'?: string
  country?: { code: string }
}

interface CoupaInvoice {
  id: number
  'invoice-number': string
  status: 'pending_approval' | 'approved' | 'paid' | 'voided' | 'disputed'
  'invoice-date': string
  'due-date': string
  'payment-date'?: string
  supplier: {
    id: number
    name: string
    number?: string
  }
  currency: {
    code: string
  }
  'total-amount': string
  'remaining-amount'?: string
  'invoice-lines': CoupaInvoiceLine[]
  'purchase-order'?: {
    id: number
    'po-number': string
  }
  account?: {
    id: number
    code: string
    name: string
  }
  department?: {
    id: number
    code: string
    name: string
  }
  'custom-fields'?: Record<string, unknown>
  'created-at': string
  'updated-at': string
}

interface CoupaInvoiceLine {
  id: number
  description: string
  quantity: string
  price: string
  total: string
  account?: {
    id: number
    code: string
    name: string
  }
  department?: {
    id: number
    code: string
  }
  'tax-code'?: {
    code: string
  }
  'line-num': number
}

interface CoupaPayment {
  id: number
  'payment-number'?: string
  'payment-date': string
  amount: string
  currency: {
    code: string
  }
  'payment-method': string
  status: 'pending' | 'processed' | 'completed' | 'failed' | 'cancelled'
  supplier: {
    id: number
    name: string
  }
  invoice?: {
    id: number
    'invoice-number': string
  }
  'payment-batch'?: {
    id: number
    name: string
  }
  'bank-account'?: {
    'account-number': string
    'routing-number': string
    'bank-name': string
  }
  'reference-number'?: string
  'custom-fields'?: Record<string, unknown>
  'created-at': string
  'updated-at': string
}

interface CoupaExpenseReport {
  id: number
  'report-number': string
  status: string
  'report-date': string
  'expense-lines': CoupaExpenseLine[]
  'total-amount': string
  currency: {
    code: string
  }
  description?: string
  'custom-fields'?: Record<string, unknown>
}

interface CoupaExpenseLine {
  id: number
  description: string
  amount: string
  'expense-date': string
  account: {
    id: number
    code: string
  }
  department?: {
    id: number
    code: string
  }
}

interface CoupaAccount {
  id: number
  code: string
  name: string
  'account-type': {
    name: string
  }
  'segment-1'?: string
  'segment-2'?: string
  active: boolean
  currency?: {
    code: string
  }
  'parent-id'?: number
  'created-at': string
  'updated-at': string
}

interface CoupaDepartment {
  id: number
  name: string
  code: string
  active: boolean
  'parent-id'?: number
  'created-at': string
  'updated-at': string
}

interface CoupaAPIResponse<T> {
  data?: T
  errors?: Array<{ detail: string }>
  meta?: {
    total: number
  }
}

// ============================================================================
// COUPA ADAPTER IMPLEMENTATION
// ============================================================================

export class CoupaAdapter extends BaseERPAdapter {
  private coupaConfig: CoupaConfig
  private apiVersion: string

  constructor(config: CoupaConfig) {
    super(config)
    this.coupaConfig = config
    this.apiVersion = config.apiVersion || 'v1'

    // Coupa-specific GL account mappings
    this.glMappings = {
      'payment': '2000',              // Accounts Payable
      'receipt': '1000',              // Cash/Bank
      'credit_draw': '2100',          // Credit Line Payable
      'credit_repay': '2100',         // Credit Line Payable
      'grain_appreciation': '4000',   // Other Income
      'grain_reserve': '1200',        // GRAIN Reserve Asset
    }
  }

  // ==========================================================================
  // CONNECTION METHODS
  // ==========================================================================

  async connect(): Promise<void> {
    try {
      if (this.coupaConfig.useOAuth) {
        await this.connectOAuth()
      } else {
        await this.connectAPIKey()
      }

      this.connectionStatus = 'connected'
    } catch (error) {
      this.connectionStatus = 'error'
      throw new Error(`Coupa connection failed: ${error}`)
    }
  }

  private async connectOAuth(): Promise<void> {
    if (!this.coupaConfig.clientId || !this.coupaConfig.clientSecret) {
      throw new Error('OAuth2 requires clientId and clientSecret')
    }

    const tokenUrl = `https://${this.coupaConfig.instanceUrl}/oauth2/token`
    const scope = this.coupaConfig.scope?.join(' ') || 'core.read core.write'

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.coupaConfig.clientId,
        client_secret: this.coupaConfig.clientSecret,
        scope,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OAuth2 authentication failed: ${error}`)
    }

    const data = await response.json()
    this.accessToken = data.access_token
    this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000))
  }

  private async connectAPIKey(): Promise<void> {
    if (!this.coupaConfig.apiKey) {
      throw new Error('API Key authentication requires apiKey')
    }

    // API Key is used directly in requests
    this.accessToken = this.coupaConfig.apiKey
    this.tokenExpiry = undefined // API keys don't expire
  }

  async disconnect(): Promise<void> {
    this.accessToken = undefined
    this.tokenExpiry = undefined
    this.connectionStatus = 'disconnected'
  }

  async testConnection(): Promise<boolean> {
    try {
      // Test connection by fetching user info
      const url = this.buildCoupaUrl('/api/users/me')
      const response = await this.makeCoupaRequest<{ id: number }>('GET', url)
      return !!response.id
    } catch (error) {
      console.error('Coupa connection test failed:', error)
      return false
    }
  }

  // ==========================================================================
  // VENDOR METHODS (Coupa: Suppliers)
  // ==========================================================================

  async getVendors(filters?: { modifiedSince?: Date; limit?: number }): Promise<Vendor[]> {
    const params: Record<string, string> = {
      'status': 'active',
    }

    if (filters?.modifiedSince) {
      params['updated-at[gt]'] = filters.modifiedSince.toISOString()
    }

    if (filters?.limit) {
      params['limit'] = filters.limit.toString()
    }

    const url = this.buildCoupaUrl('/api/suppliers', params)
    const response = await this.makeCoupaRequest<CoupaSupplier[]>('GET', url)

    return response.map(supplier => this.mapCoupaSupplierToVendor(supplier))
  }

  async getVendor(vendorId: string): Promise<Vendor | null> {
    try {
      const url = this.buildCoupaUrl(`/api/suppliers/${vendorId}`)
      const supplier = await this.makeCoupaRequest<CoupaSupplier>('GET', url)
      return this.mapCoupaSupplierToVendor(supplier)
    } catch (error) {
      console.error(`Failed to fetch Coupa supplier ${vendorId}:`, error)
      return null
    }
  }

  async createVendor(vendor: Partial<Vendor>): Promise<SyncResult<Vendor>> {
    try {
      const coupaSupplier = this.mapVendorToCoupaSupplier(vendor)
      const url = this.buildCoupaUrl('/api/suppliers')

      const response = await this.makeCoupaRequest<CoupaSupplier>(
        'POST',
        url,
        coupaSupplier
      )

      return {
        success: true,
        data: this.mapCoupaSupplierToVendor(response),
        externalId: response.id.toString(),
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create Coupa supplier: ${error}`,
      }
    }
  }

  async updateVendor(vendorId: string, updates: Partial<Vendor>): Promise<SyncResult<Vendor>> {
    try {
      const coupaUpdates = this.mapVendorToCoupaSupplier(updates)
      const url = this.buildCoupaUrl(`/api/suppliers/${vendorId}`)

      const response = await this.makeCoupaRequest<CoupaSupplier>(
        'PUT',
        url,
        coupaUpdates
      )

      return {
        success: true,
        data: this.mapCoupaSupplierToVendor(response),
        externalId: response.id.toString(),
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to update Coupa supplier: ${error}`,
      }
    }
  }

  // ==========================================================================
  // INVOICE METHODS
  // ==========================================================================

  async getInvoices(filters?: {
    status?: Invoice['status'][]
    vendorId?: string
    dueBefore?: Date
    dueAfter?: Date
    modifiedSince?: Date
    limit?: number
  }): Promise<Invoice[]> {
    const params: Record<string, string> = {}

    if (filters?.status) {
      const coupaStatuses = filters.status.map(s => this.mapStatusToCoupaInvoiceStatus(s))
      params['status'] = coupaStatuses.join(',')
    }

    if (filters?.vendorId) {
      params['supplier-id'] = filters.vendorId
    }

    if (filters?.dueBefore) {
      params['due-date[lt]'] = filters.dueBefore.toISOString().split('T')[0]
    }

    if (filters?.dueAfter) {
      params['due-date[gt]'] = filters.dueAfter.toISOString().split('T')[0]
    }

    if (filters?.modifiedSince) {
      params['updated-at[gt]'] = filters.modifiedSince.toISOString()
    }

    if (filters?.limit) {
      params['limit'] = filters.limit.toString()
    }

    const url = this.buildCoupaUrl('/api/invoices', params)
    const response = await this.makeCoupaRequest<CoupaInvoice[]>('GET', url)

    return response.map(invoice => this.mapCoupaInvoiceToInvoice(invoice))
  }

  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    try {
      const url = this.buildCoupaUrl(`/api/invoices/${invoiceId}`)
      const invoice = await this.makeCoupaRequest<CoupaInvoice>('GET', url)
      return this.mapCoupaInvoiceToInvoice(invoice)
    } catch (error) {
      console.error(`Failed to fetch Coupa invoice ${invoiceId}:`, error)
      return null
    }
  }

  // ==========================================================================
  // PAYMENT METHODS
  // ==========================================================================

  async createPayment(payment: Partial<Payment>): Promise<SyncResult<Payment>> {
    try {
      const coupaPayment = this.mapPaymentToCoupaPayment(payment)
      const url = this.buildCoupaUrl('/api/payments')

      const response = await this.makeCoupaRequest<CoupaPayment>(
        'POST',
        url,
        coupaPayment
      )

      return {
        success: true,
        data: this.mapCoupaPaymentToPayment(response),
        externalId: response.id.toString(),
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create Coupa payment: ${error}`,
      }
    }
  }

  async syncPayment(payment: Payment): Promise<SyncResult<Payment>> {
    try {
      if (payment.externalId) {
        // Update existing payment
        const coupaPayment = this.mapPaymentToCoupaPayment(payment)
        const url = this.buildCoupaUrl(`/api/payments/${payment.externalId}`)

        const response = await this.makeCoupaRequest<CoupaPayment>(
          'PUT',
          url,
          coupaPayment
        )

        return {
          success: true,
          data: this.mapCoupaPaymentToPayment(response),
          externalId: response.id.toString(),
        }
      } else {
        // Create new payment
        return this.createPayment(payment)
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to sync Coupa payment: ${error}`,
      }
    }
  }

  async getPayment(paymentId: string): Promise<Payment | null> {
    try {
      const url = this.buildCoupaUrl(`/api/payments/${paymentId}`)
      const payment = await this.makeCoupaRequest<CoupaPayment>('GET', url)
      return this.mapCoupaPaymentToPayment(payment)
    } catch (error) {
      console.error(`Failed to fetch Coupa payment ${paymentId}:`, error)
      return null
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

    if (filters?.vendorId) {
      params['supplier-id'] = filters.vendorId
    }

    if (filters?.status) {
      const coupaStatuses = filters.status.map(s => this.mapStatusToCoupaPaymentStatus(s))
      params['status'] = coupaStatuses.join(',')
    }

    if (filters?.dateFrom) {
      params['payment-date[gt]'] = filters.dateFrom.toISOString().split('T')[0]
    }

    if (filters?.dateTo) {
      params['payment-date[lt]'] = filters.dateTo.toISOString().split('T')[0]
    }

    if (filters?.limit) {
      params['limit'] = filters.limit.toString()
    }

    const url = this.buildCoupaUrl('/api/payments', params)
    const response = await this.makeCoupaRequest<CoupaPayment[]>('GET', url)

    return response.map(payment => this.mapCoupaPaymentToPayment(payment))
  }

  // ==========================================================================
  // JOURNAL ENTRY METHODS (Coupa: Expense Reports)
  // ==========================================================================

  async createJournalEntry(entry: Partial<JournalEntry>): Promise<SyncResult<JournalEntry>> {
    try {
      // Coupa doesn't have native journal entries
      // We create expense reports for GRAIN transactions
      const expenseReport = this.mapJournalEntryToCoupaExpenseReport(entry)
      const url = this.buildCoupaUrl('/api/expense_reports')

      const response = await this.makeCoupaRequest<CoupaExpenseReport>(
        'POST',
        url,
        expenseReport
      )

      return {
        success: true,
        data: this.mapCoupaExpenseReportToJournalEntry(response),
        externalId: response.id.toString(),
        warnings: ['Coupa does not support native journal entries. Created as Expense Report.'],
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create Coupa expense report: ${error}`,
      }
    }
  }

  // ==========================================================================
  // GL ACCOUNT & COST CENTER METHODS
  // ==========================================================================

  async getGLAccounts(): Promise<GLAccount[]> {
    try {
      const url = this.buildCoupaUrl('/api/accounts', { active: 'true' })
      const response = await this.makeCoupaRequest<CoupaAccount[]>('GET', url)

      return response.map(account => this.mapCoupaAccountToGLAccount(account))
    } catch (error) {
      console.error('Failed to fetch Coupa accounts:', error)
      return []
    }
  }

  async getCostCenters(): Promise<CostCenter[]> {
    try {
      const url = this.buildCoupaUrl('/api/departments', { active: 'true' })
      const response = await this.makeCoupaRequest<CoupaDepartment[]>('GET', url)

      return response.map(dept => this.mapCoupaDepartmentToCostCenter(dept))
    } catch (error) {
      console.error('Failed to fetch Coupa departments:', error)
      return []
    }
  }

  // ==========================================================================
  // MAPPING HELPERS
  // ==========================================================================

  private mapCoupaSupplierToVendor(supplier: CoupaSupplier): Vendor {
    const primaryContact = supplier['primary-contact']
    const remitToAddress = supplier['supplier-information-addresses']?.find(
      addr => addr['address-type'] === 'remit_to'
    )

    return {
      id: supplier.id.toString(),
      externalId: supplier.id.toString(),
      name: supplier.display_name || supplier.name,
      email: primaryContact?.email || remitToAddress?.email,
      phone: primaryContact?.phone_work || remitToAddress?.[('phone-number')],
      taxId: supplier['tax-id'],
      currency: supplier['preferred-currency']?.code || 'USD',
      paymentTerms: supplier['payment-term']?.name,
      bankAccount: remitToAddress ? {
        bankName: 'Unknown',
        accountNumber: '****',
        routingNumber: '****',
      } : undefined,
      grainWalletAddress: supplier['custom-fields']?.['grain_wallet_address'] as string,
      metadata: {
        coupaNumber: supplier.number || '',
        coupaStatus: supplier.status,
        createdAt: supplier['created-at'],
        updatedAt: supplier['updated-at'],
      },
    }
  }

  private mapVendorToCoupaSupplier(vendor: Partial<Vendor>): Partial<CoupaSupplier> {
    return {
      name: vendor.name,
      'display-name': vendor.name,
      status: 'active',
      'tax-id': vendor.taxId,
      'primary-contact': vendor.email || vendor.phone ? {
        email: vendor.email,
        phone_work: vendor.phone,
      } : undefined,
      'preferred-currency': vendor.currency ? {
        code: vendor.currency,
      } : undefined,
      'custom-fields': vendor.grainWalletAddress ? {
        grain_wallet_address: vendor.grainWalletAddress,
      } : undefined,
    }
  }

  private mapCoupaInvoiceToInvoice(invoice: CoupaInvoice): Invoice {
    return {
      id: invoice.id.toString(),
      externalId: invoice.id.toString(),
      vendorId: invoice.supplier.id.toString(),
      vendorName: invoice.supplier.name,
      amount: parseFloat(invoice['total-amount']),
      currency: invoice.currency.code,
      dueDate: new Date(invoice['due-date']),
      invoiceDate: new Date(invoice['invoice-date']),
      status: this.mapCoupaInvoiceStatusToStatus(invoice.status),
      lineItems: invoice['invoice-lines'].map(line => this.mapCoupaInvoiceLineToLineItem(line)),
      costCenter: invoice.department?.code,
      glAccount: invoice.account?.code,
      poNumber: invoice['purchase-order']?.['po-number'],
      description: invoice['invoice-number'],
      metadata: {
        coupaInvoiceNumber: invoice['invoice-number'],
        coupaStatus: invoice.status,
        remainingAmount: invoice['remaining-amount'] || '0',
        createdAt: invoice['created-at'],
        updatedAt: invoice['updated-at'],
      },
    }
  }

  private mapCoupaInvoiceLineToLineItem(line: CoupaInvoiceLine): InvoiceLineItem {
    return {
      id: line.id.toString(),
      description: line.description,
      quantity: parseFloat(line.quantity),
      unitPrice: parseFloat(line.price),
      amount: parseFloat(line.total),
      glAccount: line.account?.code,
      costCenter: line.department?.code,
      taxCode: line['tax-code']?.code,
    }
  }

  private mapCoupaPaymentToPayment(payment: CoupaPayment): Payment {
    return {
      id: payment.id.toString(),
      externalId: payment.id.toString(),
      invoiceId: payment.invoice?.id.toString() || '',
      vendorId: payment.supplier.id.toString(),
      amount: parseFloat(payment.amount),
      currency: payment.currency.code,
      paymentDate: new Date(payment['payment-date']),
      paymentMethod: this.mapCoupaPaymentMethodToMethod(payment['payment-method']),
      status: this.mapCoupaPaymentStatusToStatus(payment.status),
      bankAccount: payment['bank-account']?.['account-number'],
      reference: payment['reference-number'],
      grainTransactionId: payment['custom-fields']?.['grain_transaction_id'] as string,
      metadata: {
        coupaPaymentNumber: payment['payment-number'] || '',
        coupaStatus: payment.status,
        paymentBatch: payment['payment-batch']?.name,
        createdAt: payment['created-at'],
        updatedAt: payment['updated-at'],
      },
    }
  }

  private mapPaymentToCoupaPayment(payment: Partial<Payment>): Partial<CoupaPayment> {
    return {
      'payment-date': payment.paymentDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      amount: payment.amount?.toString(),
      currency: {
        code: payment.currency || 'USD',
      },
      'payment-method': this.mapMethodToCoupaPaymentMethod(payment.paymentMethod || 'ach'),
      status: this.mapStatusToCoupaPaymentStatus(payment.status || 'pending'),
      'reference-number': payment.reference,
      'custom-fields': payment.grainTransactionId ? {
        grain_transaction_id: payment.grainTransactionId,
      } : undefined,
    }
  }

  private mapJournalEntryToCoupaExpenseReport(entry: Partial<JournalEntry>): Partial<CoupaExpenseReport> {
    return {
      'report-date': entry.date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      description: entry.description,
      'expense-lines': entry.lines?.map(line => ({
        description: line.memo || '',
        amount: (line.debit || line.credit).toString(),
        'expense-date': entry.date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        account: {
          code: line.accountId,
        },
        department: line.costCenter ? {
          code: line.costCenter,
        } : undefined,
      })) as CoupaExpenseLine[],
    }
  }

  private mapCoupaExpenseReportToJournalEntry(report: CoupaExpenseReport): JournalEntry {
    return {
      id: report.id.toString(),
      externalId: report.id.toString(),
      date: new Date(report['report-date']),
      description: report.description || report['report-number'],
      lines: report['expense-lines'].map(line => ({
        accountId: line.account.code,
        accountName: '',
        debit: parseFloat(line.amount),
        credit: 0,
        costCenter: line.department?.code,
        memo: line.description,
      })),
      status: 'posted',
      reference: report['report-number'],
    }
  }

  private mapCoupaAccountToGLAccount(account: CoupaAccount): GLAccount {
    return {
      id: account.id.toString(),
      code: account.code,
      name: account.name,
      type: this.mapCoupaAccountTypeToType(account['account-type'].name),
      currency: account.currency?.code,
      isActive: account.active,
      parentId: account['parent-id']?.toString(),
    }
  }

  private mapCoupaDepartmentToCostCenter(dept: CoupaDepartment): CostCenter {
    return {
      id: dept.id.toString(),
      code: dept.code,
      name: dept.name,
      isActive: dept.active,
      parentId: dept['parent-id']?.toString(),
    }
  }

  // ==========================================================================
  // STATUS MAPPING HELPERS
  // ==========================================================================

  private mapCoupaInvoiceStatusToStatus(status: string): Invoice['status'] {
    const statusMap: Record<string, Invoice['status']> = {
      'pending_approval': 'open',
      'approved': 'open',
      'paid': 'paid',
      'voided': 'cancelled',
      'disputed': 'disputed',
    }
    return statusMap[status] || 'open'
  }

  private mapStatusToCoupaInvoiceStatus(status: Invoice['status']): string {
    const statusMap: Record<Invoice['status'], string> = {
      'open': 'approved',
      'partial': 'approved',
      'paid': 'paid',
      'cancelled': 'voided',
      'disputed': 'disputed',
    }
    return statusMap[status] || 'approved'
  }

  private mapCoupaPaymentStatusToStatus(status: string): Payment['status'] {
    const statusMap: Record<string, Payment['status']> = {
      'pending': 'pending',
      'processed': 'processing',
      'completed': 'completed',
      'failed': 'failed',
      'cancelled': 'failed',
    }
    return statusMap[status] || 'pending'
  }

  private mapStatusToCoupaPaymentStatus(status: Payment['status']): string {
    const statusMap: Record<Payment['status'], string> = {
      'pending': 'pending',
      'processing': 'processed',
      'completed': 'completed',
      'failed': 'failed',
      'reversed': 'cancelled',
    }
    return statusMap[status] || 'pending'
  }

  private mapCoupaPaymentMethodToMethod(method: string): Payment['paymentMethod'] {
    const methodMap: Record<string, Payment['paymentMethod']> = {
      'ach': 'ach',
      'wire': 'wire',
      'check': 'check',
      'virtual_card': 'ach',
      'grain': 'grain',
    }
    return methodMap[method.toLowerCase()] || 'ach'
  }

  private mapMethodToCoupaPaymentMethod(method: Payment['paymentMethod']): string {
    const methodMap: Record<Payment['paymentMethod'], string> = {
      'ach': 'ach',
      'wire': 'wire',
      'check': 'check',
      'grain': 'grain',
    }
    return methodMap[method] || 'ach'
  }

  private mapCoupaAccountTypeToType(accountType: string): GLAccount['type'] {
    const type = accountType.toLowerCase()
    if (type.includes('asset')) return 'asset'
    if (type.includes('liability')) return 'liability'
    if (type.includes('equity')) return 'equity'
    if (type.includes('revenue') || type.includes('income')) return 'revenue'
    if (type.includes('expense') || type.includes('cost')) return 'expense'
    return 'expense'
  }

  // ==========================================================================
  // HTTP HELPERS
  // ==========================================================================

  private buildCoupaUrl(path: string, params?: Record<string, string>): string {
    const baseUrl = `https://${this.coupaConfig.instanceUrl}`
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    let url = `${baseUrl}${cleanPath}`

    if (params && Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString()
      url += `?${queryString}`
    }

    return url
  }

  private async makeCoupaRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    body?: unknown
  ): Promise<T> {
    await this.refreshTokenIfNeeded()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }

    // Add authentication
    if (this.coupaConfig.useOAuth) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    } else {
      headers['X-COUPA-API-KEY'] = this.accessToken || ''
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Coupa API Error: ${response.status} - ${error}`)
    }

    const data = await response.json()

    // Handle Coupa API response wrapper
    if (data.data !== undefined) {
      return data.data as T
    }

    return data as T
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createCoupaAdapter(config: CoupaConfig): CoupaAdapter {
  return new CoupaAdapter(config)
}

export default CoupaAdapter
