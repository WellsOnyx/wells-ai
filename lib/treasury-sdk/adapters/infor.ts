// @ts-nocheck
/**
 * Infor CloudSuite Financials (CSF) Adapter
 *
 * Integrates with Infor ION API for:
 * - Vendors/Suppliers
 * - Invoices (Accounts Payable)
 * - Payments
 * - General Ledger
 * - Journal Entries
 *
 * Uses OAuth 2.0 with ION API Gateway
 * Industry-specific: Manufacturing, Distribution, Healthcare, Hospitality
 *
 * ION API Documentation: https://docs.infor.com/ion/latest
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
// INFOR TYPES
// ============================================================================

export interface InforConfig extends ERPConnectionConfig {
  tenant: string                           // Infor tenant ID
  ionGatewayUrl: string                    // ION API Gateway URL
  clientId: string                         // OAuth2 client ID
  clientSecret: string                     // OAuth2 client secret
  tokenEndpoint?: string                   // OAuth2 token endpoint (optional, derived from gateway)
  logicalId?: string                       // Infor logical ID for routing
  dataAreaId?: string                      // Company/data area
  product?: 'csf' | 'lnfin' | 'm3' | 'syteline' // CloudSuite product variant
  apiVersion?: string                      // API version (default: v1)
}

interface InforOAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope?: string
}

interface InforReference {
  _id: string                              // Internal Infor ID
  name?: string                            // Display name
  number?: string                          // Business number/code
}

interface InforVendor {
  _id: string
  VendorNumber: string
  VendorName: string
  VendorGroup?: string
  TaxID?: string
  Currency?: string
  PaymentTerms?: string
  PaymentMethod?: string
  Email?: string
  Phone?: string
  Status?: 'Active' | 'Inactive' | 'OnHold'
  BankAccount?: {
    BankName: string
    AccountNumber: string
    RoutingNumber?: string
    IBAN?: string
    SwiftCode?: string
    Country?: string
  }
  Address?: {
    AddressLine1: string
    AddressLine2?: string
    City: string
    State?: string
    PostalCode: string
    Country: string
  }
  CustomFields?: Record<string, unknown>
  LastModifiedDate?: string
  CreatedDate?: string
}

interface InforInvoice {
  _id: string
  InvoiceNumber: string
  DocumentType?: string
  VendorNumber: string
  VendorName: string
  InvoiceDate: string
  DueDate: string
  PaymentDate?: string
  Currency: string
  InvoiceAmount: number
  OpenAmount?: number
  PaidAmount?: number
  Status: 'Open' | 'PartiallyPaid' | 'Paid' | 'Cancelled' | 'OnHold' | 'Disputed'
  PONumber?: string
  Description?: string
  GLAccount?: string
  CostCenter?: string
  PaymentTerms?: string
  Lines?: InforInvoiceLine[]
  CustomFields?: Record<string, unknown>
  LastModifiedDate?: string
  CreatedDate?: string
}

interface InforInvoiceLine {
  LineNumber: number
  Description: string
  Quantity: number
  UnitPrice: number
  ExtendedAmount: number
  GLAccount?: string
  CostCenter?: string
  TaxCode?: string
  TaxAmount?: number
  ProjectCode?: string
}

interface InforPayment {
  _id?: string
  PaymentNumber?: string
  PaymentDate: string
  VendorNumber: string
  VendorName?: string
  PaymentAmount: number
  Currency: string
  PaymentMethod: 'Check' | 'ACH' | 'Wire' | 'EFT' | 'VirtualCard' | 'Cryptocurrency'
  Status: 'Pending' | 'InProcess' | 'Completed' | 'Failed' | 'Reversed' | 'Cancelled'
  BankAccount?: string
  CheckNumber?: string
  Reference?: string
  Invoices?: Array<{
    InvoiceNumber: string
    AmountApplied: number
  }>
  GLAccount?: string
  CostCenter?: string
  Memo?: string
  CustomFields?: Record<string, unknown>
  LastModifiedDate?: string
  CreatedDate?: string
}

interface InforJournalEntry {
  _id?: string
  JournalNumber?: string
  JournalDate: string
  JournalType: string
  Description: string
  Status: 'Draft' | 'Posted' | 'Reversed'
  Currency?: string
  Lines: InforJournalLine[]
  Reference?: string
  SourceSystem?: string
  PostingPeriod?: string
  CustomFields?: Record<string, unknown>
}

interface InforJournalLine {
  LineNumber: number
  GLAccount: string
  GLAccountDescription?: string
  DebitAmount?: number
  CreditAmount?: number
  CostCenter?: string
  Department?: string
  Project?: string
  Description?: string
}

interface InforGLAccount {
  _id: string
  AccountNumber: string
  AccountDescription: string
  AccountType: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'
  Currency?: string
  Status: 'Active' | 'Inactive'
  ParentAccount?: string
  Level?: number
  PostingAllowed?: boolean
}

interface InforCostCenter {
  _id: string
  CostCenterCode: string
  CostCenterName: string
  Status: 'Active' | 'Inactive'
  ParentCostCenter?: string
  Manager?: string
  Department?: string
}

interface InforAPIResponse<T> {
  data?: T
  items?: T[]
  totalCount?: number
  errorCode?: string
  errorMessage?: string
  warnings?: string[]
}

// ============================================================================
// INFOR ADAPTER IMPLEMENTATION
// ============================================================================

export class InforAdapter extends BaseERPAdapter {
  private inforConfig: InforConfig
  private apiVersion: string
  private logicalId: string

  constructor(config: InforConfig) {
    super(config)
    this.inforConfig = config
    this.apiVersion = config.apiVersion || 'v1'
    this.logicalId = config.logicalId || `lid://${config.tenant}`

    // Infor-specific GL account mappings (CSF standard chart of accounts)
    this.glMappings = {
      'payment': '21000',              // Accounts Payable
      'receipt': '11000',              // Cash and Cash Equivalents
      'credit_draw': '23000',          // Short-term Borrowings
      'credit_repay': '23000',         // Short-term Borrowings
      'grain_appreciation': '49000',   // Other Income
      'grain_reserve': '14000',        // Digital Assets / Cryptocurrency
    }
  }

  // ============================================================================
  // CONNECTION METHODS
  // ============================================================================

  async connect(): Promise<void> {
    try {
      const tokenUrl = this.inforConfig.tokenEndpoint ||
        `${this.inforConfig.ionGatewayUrl}/oauth2/token`

      const credentials = Buffer.from(
        `${this.inforConfig.clientId}:${this.inforConfig.clientSecret}`
      ).toString('base64')

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'openid',
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Infor OAuth Error: ${response.status} - ${error}`)
      }

      const data: InforOAuthResponse = await response.json()

      this.accessToken = data.access_token
      this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000))
      this.connectionStatus = 'connected'
    } catch (error) {
      this.connectionStatus = 'error'
      throw new Error(`Failed to connect to Infor: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
      await this.makeInforRequest<InforAPIResponse<InforVendor>>('GET', '/vendors', { limit: '1' })
      return true
    } catch (error) {
      console.error('Infor connection test failed:', error)
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
      params.lastModifiedDate = `>=${filters.modifiedSince.toISOString()}`
    }

    const response = await this.makeInforRequest<InforAPIResponse<InforVendor>>(
      'GET',
      '/payables/vendors',
      params
    )

    const vendors = response.items || (response.data ? [response.data] : [])
    return vendors.map(v => this.mapInforVendorToVendor(v))
  }

  async getVendor(vendorId: string): Promise<Vendor | null> {
    try {
      const response = await this.makeInforRequest<InforVendor>(
        'GET',
        `/payables/vendors/${vendorId}`
      )
      return this.mapInforVendorToVendor(response)
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }

  async createVendor(vendor: Partial<Vendor>): Promise<SyncResult<Vendor>> {
    try {
      const inforVendor = this.mapVendorToInforVendor(vendor)

      const response = await this.makeInforRequest<InforVendor>(
        'POST',
        '/payables/vendors',
        undefined,
        inforVendor
      )

      return {
        success: true,
        data: this.mapInforVendorToVendor(response),
        externalId: response._id,
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
      const inforVendor = this.mapVendorToInforVendor(updates)

      const response = await this.makeInforRequest<InforVendor>(
        'PATCH',
        `/payables/vendors/${vendorId}`,
        undefined,
        inforVendor
      )

      return {
        success: true,
        data: this.mapInforVendorToVendor(response),
        externalId: response._id,
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
      params.vendorNumber = filters.vendorId
    }

    if (filters?.dueBefore) {
      params.dueDate = `<=${filters.dueBefore.toISOString().split('T')[0]}`
    }

    if (filters?.dueAfter) {
      params.dueDate = `>=${filters.dueAfter.toISOString().split('T')[0]}`
    }

    if (filters?.modifiedSince) {
      params.lastModifiedDate = `>=${filters.modifiedSince.toISOString()}`
    }

    if (filters?.status && filters.status.length > 0) {
      params.status = filters.status.map(s => this.mapInvoiceStatusToInfor(s)).join(',')
    }

    const response = await this.makeInforRequest<InforAPIResponse<InforInvoice>>(
      'GET',
      '/payables/invoices',
      params
    )

    const invoices = response.items || (response.data ? [response.data] : [])
    return invoices.map(inv => this.mapInforInvoiceToInvoice(inv))
  }

  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    try {
      const response = await this.makeInforRequest<InforInvoice>(
        'GET',
        `/payables/invoices/${invoiceId}`
      )
      return this.mapInforInvoiceToInvoice(response)
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
      const inforPayment = this.mapPaymentToInforPayment(payment)

      const response = await this.makeInforRequest<InforPayment>(
        'POST',
        '/payables/payments',
        undefined,
        inforPayment
      )

      return {
        success: true,
        data: this.mapInforPaymentToPayment(response),
        externalId: response._id,
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
      try {
        const inforPayment = this.mapPaymentToInforPayment(payment)

        const response = await this.makeInforRequest<InforPayment>(
          'PATCH',
          `/payables/payments/${payment.externalId}`,
          undefined,
          inforPayment
        )

        return {
          success: true,
          data: this.mapInforPaymentToPayment(response),
          externalId: response._id,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    } else {
      return this.createPayment(payment)
    }
  }

  async getPayment(paymentId: string): Promise<Payment | null> {
    try {
      const response = await this.makeInforRequest<InforPayment>(
        'GET',
        `/payables/payments/${paymentId}`
      )
      return this.mapInforPaymentToPayment(response)
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
      params.vendorNumber = filters.vendorId
    }

    if (filters?.dateFrom) {
      params.paymentDate = `>=${filters.dateFrom.toISOString().split('T')[0]}`
    }

    if (filters?.dateTo) {
      params.paymentDate = `<=${filters.dateTo.toISOString().split('T')[0]}`
    }

    if (filters?.status && filters.status.length > 0) {
      params.status = filters.status.map(s => this.mapPaymentStatusToInfor(s)).join(',')
    }

    const response = await this.makeInforRequest<InforAPIResponse<InforPayment>>(
      'GET',
      '/payables/payments',
      params
    )

    const payments = response.items || (response.data ? [response.data] : [])
    return payments.map(pmt => this.mapInforPaymentToPayment(pmt))
  }

  // ============================================================================
  // JOURNAL ENTRY METHODS
  // ============================================================================

  async createJournalEntry(entry: Partial<JournalEntry>): Promise<SyncResult<JournalEntry>> {
    try {
      const inforJE = this.mapJournalEntryToInfor(entry)

      const response = await this.makeInforRequest<InforJournalEntry>(
        'POST',
        '/generalledger/journalentries',
        undefined,
        inforJE
      )

      return {
        success: true,
        data: this.mapInforJournalEntryToJournalEntry(response),
        externalId: response._id,
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
    const response = await this.makeInforRequest<InforAPIResponse<InforGLAccount>>(
      'GET',
      '/generalledger/accounts',
      { limit: '1000', status: 'Active' }
    )

    const accounts = response.items || (response.data ? [response.data] : [])
    return accounts.map(acc => this.mapInforGLAccountToGLAccount(acc))
  }

  async getCostCenters(): Promise<CostCenter[]> {
    const response = await this.makeInforRequest<InforAPIResponse<InforCostCenter>>(
      'GET',
      '/generalledger/costcenters',
      { limit: '1000', status: 'Active' }
    )

    const costCenters = response.items || (response.data ? [response.data] : [])
    return costCenters.map(cc => this.mapInforCostCenterToCostCenter(cc))
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private buildApiUrl(path: string): string {
    const product = this.inforConfig.product || 'csf'
    const dataArea = this.inforConfig.dataAreaId || 'default'
    const version = this.apiVersion

    // ION API structure: /[tenant]/[product]/[version]/[dataArea]/[resource]
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    return `${this.inforConfig.ionGatewayUrl}/${this.inforConfig.tenant}/${product}/${version}/${dataArea}/${cleanPath}`
  }

  private async makeInforRequest<T>(
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
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
        'X-Infor-LogicalId': this.logicalId,
        'X-Infor-TenantId': this.inforConfig.tenant,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Infor API Error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  // ============================================================================
  // MAPPING METHODS
  // ============================================================================

  private mapInforVendorToVendor(vendor: InforVendor): Vendor {
    return {
      id: vendor._id,
      externalId: vendor._id,
      name: vendor.VendorName,
      email: vendor.Email,
      phone: vendor.Phone,
      taxId: vendor.TaxID,
      currency: vendor.Currency || 'USD',
      paymentTerms: vendor.PaymentTerms,
      bankAccount: vendor.BankAccount ? {
        bankName: vendor.BankAccount.BankName,
        accountNumber: vendor.BankAccount.AccountNumber,
        routingNumber: vendor.BankAccount.RoutingNumber || '',
        swiftCode: vendor.BankAccount.SwiftCode,
        iban: vendor.BankAccount.IBAN,
      } : undefined,
      grainWalletAddress: vendor.CustomFields?.['grainWalletAddress'] as string,
      metadata: {
        vendorNumber: vendor.VendorNumber,
        vendorGroup: vendor.VendorGroup || '',
        status: vendor.Status || 'Active',
        paymentMethod: vendor.PaymentMethod || '',
        createdDate: vendor.CreatedDate || '',
        lastModifiedDate: vendor.LastModifiedDate || '',
      },
    }
  }

  private mapVendorToInforVendor(vendor: Partial<Vendor>): Partial<InforVendor> {
    const inforVendor: Partial<InforVendor> = {}

    if (vendor.name) inforVendor.VendorName = vendor.name
    if (vendor.email) inforVendor.Email = vendor.email
    if (vendor.phone) inforVendor.Phone = vendor.phone
    if (vendor.taxId) inforVendor.TaxID = vendor.taxId
    if (vendor.currency) inforVendor.Currency = vendor.currency
    if (vendor.paymentTerms) inforVendor.PaymentTerms = vendor.paymentTerms

    if (vendor.bankAccount) {
      inforVendor.BankAccount = {
        BankName: vendor.bankAccount.bankName,
        AccountNumber: vendor.bankAccount.accountNumber,
        RoutingNumber: vendor.bankAccount.routingNumber,
        SwiftCode: vendor.bankAccount.swiftCode,
        IBAN: vendor.bankAccount.iban,
      }
    }

    if (vendor.grainWalletAddress) {
      inforVendor.CustomFields = {
        grainWalletAddress: vendor.grainWalletAddress,
      }
    }

    return inforVendor
  }

  private mapInforInvoiceToInvoice(invoice: InforInvoice): Invoice {
    return {
      id: invoice._id,
      externalId: invoice._id,
      vendorId: invoice.VendorNumber,
      vendorName: invoice.VendorName,
      amount: invoice.InvoiceAmount,
      currency: invoice.Currency,
      dueDate: new Date(invoice.DueDate),
      invoiceDate: new Date(invoice.InvoiceDate),
      status: this.mapInforStatusToInvoiceStatus(invoice.Status),
      lineItems: invoice.Lines?.map((line, idx) => ({
        id: `${invoice._id}-${idx}`,
        description: line.Description,
        quantity: line.Quantity,
        unitPrice: line.UnitPrice,
        amount: line.ExtendedAmount,
        glAccount: line.GLAccount,
        costCenter: line.CostCenter,
        taxCode: line.TaxCode,
      })) || [],
      costCenter: invoice.CostCenter,
      glAccount: invoice.GLAccount,
      poNumber: invoice.PONumber,
      description: invoice.Description,
      metadata: {
        invoiceNumber: invoice.InvoiceNumber,
        documentType: invoice.DocumentType || '',
        openAmount: (invoice.OpenAmount || 0).toString(),
        paidAmount: (invoice.PaidAmount || 0).toString(),
        paymentTerms: invoice.PaymentTerms || '',
        createdDate: invoice.CreatedDate || '',
        lastModifiedDate: invoice.LastModifiedDate || '',
      },
    }
  }

  private mapPaymentToInforPayment(payment: Partial<Payment>): Partial<InforPayment> {
    const inforPayment: Partial<InforPayment> = {}

    if (payment.vendorId) inforPayment.VendorNumber = payment.vendorId
    if (payment.paymentDate) inforPayment.PaymentDate = payment.paymentDate.toISOString().split('T')[0]
    if (payment.amount !== undefined) inforPayment.PaymentAmount = payment.amount
    if (payment.currency) inforPayment.Currency = payment.currency
    if (payment.paymentMethod) inforPayment.PaymentMethod = this.mapPaymentMethodToInfor(payment.paymentMethod)
    if (payment.reference) inforPayment.Reference = payment.reference
    if (payment.bankAccount) inforPayment.BankAccount = payment.bankAccount
    if (payment.glAccount) inforPayment.GLAccount = payment.glAccount
    if (payment.costCenter) inforPayment.CostCenter = payment.costCenter

    if (payment.invoiceId) {
      inforPayment.Invoices = [{
        InvoiceNumber: payment.invoiceId,
        AmountApplied: payment.amount || 0,
      }]
    }

    if (payment.grainTransactionId) {
      inforPayment.CustomFields = {
        grainTransactionId: payment.grainTransactionId,
      }
    }

    return inforPayment
  }

  private mapInforPaymentToPayment(payment: InforPayment): Payment {
    return {
      id: payment._id || '',
      externalId: payment._id,
      invoiceId: payment.Invoices?.[0]?.InvoiceNumber || '',
      vendorId: payment.VendorNumber,
      amount: payment.PaymentAmount,
      currency: payment.Currency,
      paymentDate: new Date(payment.PaymentDate),
      paymentMethod: this.mapInforPaymentMethodToMethod(payment.PaymentMethod),
      status: this.mapInforStatusToPaymentStatus(payment.Status),
      bankAccount: payment.BankAccount,
      reference: payment.Reference,
      glAccount: payment.GLAccount,
      costCenter: payment.CostCenter,
      grainTransactionId: payment.CustomFields?.['grainTransactionId'] as string,
      metadata: {
        paymentNumber: payment.PaymentNumber || '',
        checkNumber: payment.CheckNumber || '',
        memo: payment.Memo || '',
        createdDate: payment.CreatedDate || '',
        lastModifiedDate: payment.LastModifiedDate || '',
      },
    }
  }

  private mapJournalEntryToInfor(entry: Partial<JournalEntry>): InforJournalEntry {
    return {
      JournalDate: entry.date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      JournalType: 'GRAIN',
      Description: entry.description || 'GRAIN Treasury Transaction',
      Status: 'Draft',
      Reference: entry.reference,
      SourceSystem: 'GRAIN_TREASURY_SDK',
      Lines: (entry.lines || []).map((line, idx) => ({
        LineNumber: idx + 1,
        GLAccount: line.accountId,
        GLAccountDescription: line.accountName,
        DebitAmount: line.debit > 0 ? line.debit : undefined,
        CreditAmount: line.credit > 0 ? line.credit : undefined,
        CostCenter: line.costCenter,
        Department: line.department,
        Description: line.memo,
      })),
    }
  }

  private mapInforJournalEntryToJournalEntry(je: InforJournalEntry): JournalEntry {
    return {
      id: je._id || '',
      externalId: je._id,
      date: new Date(je.JournalDate),
      description: je.Description,
      lines: je.Lines.map(line => ({
        accountId: line.GLAccount,
        accountName: line.GLAccountDescription,
        debit: line.DebitAmount || 0,
        credit: line.CreditAmount || 0,
        costCenter: line.CostCenter,
        department: line.Department,
        memo: line.Description,
      })),
      status: je.Status === 'Posted' ? 'posted' : je.Status === 'Reversed' ? 'reversed' : 'draft',
      reference: je.Reference,
      metadata: {
        journalNumber: je.JournalNumber || '',
        journalType: je.JournalType,
        postingPeriod: je.PostingPeriod || '',
        sourceSystem: je.SourceSystem || '',
      },
    }
  }

  private mapInforGLAccountToGLAccount(account: InforGLAccount): GLAccount {
    return {
      id: account._id,
      code: account.AccountNumber,
      name: account.AccountDescription,
      type: this.mapInforAccountType(account.AccountType),
      currency: account.Currency,
      isActive: account.Status === 'Active',
      parentId: account.ParentAccount,
    }
  }

  private mapInforCostCenterToCostCenter(cc: InforCostCenter): CostCenter {
    return {
      id: cc._id,
      code: cc.CostCenterCode,
      name: cc.CostCenterName,
      isActive: cc.Status === 'Active',
      parentId: cc.ParentCostCenter,
    }
  }

  // ============================================================================
  // STATUS MAPPING HELPERS
  // ============================================================================

  private mapInforStatusToInvoiceStatus(status: string): Invoice['status'] {
    const statusMap: Record<string, Invoice['status']> = {
      'Open': 'open',
      'PartiallyPaid': 'partial',
      'Paid': 'paid',
      'Cancelled': 'cancelled',
      'OnHold': 'open',
      'Disputed': 'disputed',
    }
    return statusMap[status] || 'open'
  }

  private mapInvoiceStatusToInfor(status: Invoice['status']): string {
    const statusMap: Record<Invoice['status'], string> = {
      'open': 'Open',
      'partial': 'PartiallyPaid',
      'paid': 'Paid',
      'cancelled': 'Cancelled',
      'disputed': 'Disputed',
    }
    return statusMap[status] || 'Open'
  }

  private mapInforStatusToPaymentStatus(status: string): Payment['status'] {
    const statusMap: Record<string, Payment['status']> = {
      'Pending': 'pending',
      'InProcess': 'processing',
      'Completed': 'completed',
      'Failed': 'failed',
      'Reversed': 'reversed',
      'Cancelled': 'failed',
    }
    return statusMap[status] || 'pending'
  }

  private mapPaymentStatusToInfor(status: Payment['status']): string {
    const statusMap: Record<Payment['status'], string> = {
      'pending': 'Pending',
      'processing': 'InProcess',
      'completed': 'Completed',
      'failed': 'Failed',
      'reversed': 'Reversed',
    }
    return statusMap[status] || 'Pending'
  }

  private mapPaymentMethodToInfor(method: Payment['paymentMethod']): InforPayment['PaymentMethod'] {
    const methodMap: Record<Payment['paymentMethod'], InforPayment['PaymentMethod']> = {
      'grain': 'Cryptocurrency',
      'wire': 'Wire',
      'ach': 'ACH',
      'check': 'Check',
    }
    return methodMap[method] || 'ACH'
  }

  private mapInforPaymentMethodToMethod(method: string): Payment['paymentMethod'] {
    const methodMap: Record<string, Payment['paymentMethod']> = {
      'Cryptocurrency': 'grain',
      'Wire': 'wire',
      'ACH': 'ach',
      'EFT': 'ach',
      'Check': 'check',
      'VirtualCard': 'ach',
    }
    return methodMap[method] || 'wire'
  }

  private mapInforAccountType(type: string): GLAccount['type'] {
    const typeMap: Record<string, GLAccount['type']> = {
      'Asset': 'asset',
      'Liability': 'liability',
      'Equity': 'equity',
      'Revenue': 'revenue',
      'Expense': 'expense',
    }
    return typeMap[type] || 'asset'
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createInforAdapter(config: InforConfig): InforAdapter {
  return new InforAdapter(config)
}

export default InforAdapter
