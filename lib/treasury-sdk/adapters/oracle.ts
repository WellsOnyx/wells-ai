// @ts-nocheck
/**
 * Oracle ERP Adapter
 *
 * Supports both Oracle Fusion Cloud and Oracle E-Business Suite
 * for the Grain & Vault Treasury SDK
 */

import {
  BaseERPAdapter,
  ERPConnectionConfig,
  ERPCredentials,
  Vendor,
  Invoice,
  Payment,
  JournalEntry,
  GLAccount,
  CostCenter,
  SyncResult,
  InvoiceLineItem,
  JournalLine,
} from './base'

// ============================================================================
// ORACLE-SPECIFIC TYPES
// ============================================================================

export interface OracleConfig extends ERPConnectionConfig {
  oracleSystem: 'fusion' | 'ebs'
  businessUnit?: string        // Oracle Fusion Business Unit
  ledgerId?: string            // Oracle GL Ledger ID
}

interface OracleFusionSupplier {
  SupplierId: number
  Supplier: string
  SupplierNumber?: string
  TaxpayerId?: string
  EmailAddress?: string
  PhoneNumber?: string
  PaymentCurrency?: string
  PaymentTerms?: string
  CreationDate?: string
  LastUpdateDate?: string
}

interface OracleFusionSupplierSite {
  SupplierSiteId: number
  SupplierId: number
  SupplierSite: string
  PaymentCurrency?: string
  PaymentTerms?: string
  BankAccountName?: string
  BankAccountNumber?: string
  BankRoutingNumber?: string
  SwiftCode?: string
  Iban?: string
}

interface OracleFusionInvoice {
  InvoiceId: number
  InvoiceNum: string
  InvoiceAmount: number
  InvoiceCurrencyCode: string
  InvoiceDate: string
  PaymentDueDate?: string
  Supplier?: string
  SupplierId?: number
  InvoiceStatus?: string
  Description?: string
  PayGroupLookupCode?: string
  PaymentStatusFlag?: string
}

interface OracleFusionInvoiceLine {
  InvoiceLineId: number
  InvoiceId: number
  LineNumber: number
  Description?: string
  Amount: number
  Quantity?: number
  UnitPrice?: number
  TaxClassificationCode?: string
  DistCombinationId?: number
}

interface OracleFusionPayment {
  PaymentId: number
  PaymentNum?: string
  PaymentAmount: number
  PaymentCurrencyCode: string
  PaymentDate: string
  PaymentMethodCode: string
  PaymentStatus?: string
  BankAccountId?: number
  PaymentReference?: string
}

interface OracleFusionJournalEntry {
  JournalEntryId?: number
  JournalName?: string
  LedgerId: number
  AccountingDate: string
  Description?: string
  JournalStatus?: string
  JournalLines?: OracleFusionJournalLine[]
}

interface OracleFusionJournalLine {
  CodeCombinationId: number
  EnteredDebit?: number
  EnteredCredit?: number
  Description?: string
  Segment1?: string  // Company
  Segment2?: string  // Cost Center
  Segment3?: string  // Account
}

interface OracleEBSVendor {
  VENDOR_ID: number
  VENDOR_NAME: string
  SEGMENT1?: string
  NUM_1099?: string
  VENDOR_TYPE_LOOKUP_CODE?: string
  PAYMENT_CURRENCY_CODE?: string
  TERMS_NAME?: string
  EMAIL_ADDRESS?: string
}

interface OracleEBSInvoice {
  INVOICE_ID: number
  INVOICE_NUM: string
  INVOICE_AMOUNT: number
  INVOICE_CURRENCY_CODE: string
  INVOICE_DATE: string
  GL_DATE?: string
  DUE_DATE?: string
  VENDOR_ID?: number
  VENDOR_NAME?: string
  PAYMENT_STATUS_FLAG?: string
  DESCRIPTION?: string
}

interface OracleEBSPayment {
  PAYMENT_ID: number
  PAYMENT_NUM?: string
  PAYMENT_AMOUNT: number
  PAYMENT_CURRENCY_CODE: string
  PAYMENT_DATE: string
  PAYMENT_METHOD_CODE: string
  PAYMENT_STATUS_CODE?: string
  BANK_ACCOUNT_ID?: number
  PAYMENT_REFERENCE?: string
}

interface OracleGLAccount {
  CODE_COMBINATION_ID: number
  SEGMENT1?: string  // Company
  SEGMENT2?: string  // Cost Center
  SEGMENT3?: string  // Account
  SEGMENT4?: string  // Sub Account
  CONCATENATED_SEGMENTS: string
  ACCOUNT_TYPE?: string
  ENABLED_FLAG: string
}

// ============================================================================
// ORACLE ERP ADAPTER
// ============================================================================

export class OracleERPAdapter extends BaseERPAdapter {
  private oracleConfig: OracleConfig

  constructor(config: OracleConfig) {
    super(config)
    this.oracleConfig = config

    // Oracle-specific GL mappings
    this.glMappings = {
      'payment': '01-000-2100-0000',           // Accounts Payable
      'receipt': '01-000-1010-0000',           // Cash
      'credit_draw': '01-000-2200-0000',       // Credit Line Payable
      'credit_repay': '01-000-2200-0000',      // Credit Line Payable
      'grain_appreciation': '01-000-4100-0000', // Other Income
      'grain_reserve': '01-000-1150-0000',     // GRAIN Reserve Asset
    }
  }

  // ==========================================================================
  // CONNECTION METHODS
  // ==========================================================================

  async connect(): Promise<void> {
    try {
      if (this.oracleConfig.oracleSystem === 'fusion') {
        await this.connectFusion()
      } else {
        await this.connectEBS()
      }
      this.connectionStatus = 'connected'
    } catch (error) {
      this.connectionStatus = 'error'
      throw new Error(`Oracle connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async connectFusion(): Promise<void> {
    const creds = this.config.credentials

    if (creds.type === 'oauth2') {
      // OAuth2 for Fusion Cloud
      if (!creds.clientId || !creds.clientSecret || !creds.tokenUrl) {
        throw new Error('OAuth2 credentials require clientId, clientSecret, and tokenUrl')
      }

      const tokenResponse = await fetch(creds.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          scope: creds.scopes?.join(' ') || '',
        }),
      })

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text()
        throw new Error(`OAuth2 token request failed: ${error}`)
      }

      const tokenData = await tokenResponse.json() as { access_token: string; expires_in: number }
      this.accessToken = tokenData.access_token
      this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in * 1000))
    } else if (creds.type === 'basic') {
      // Basic auth fallback
      if (!creds.username || !creds.password) {
        throw new Error('Basic auth requires username and password')
      }
      this.accessToken = Buffer.from(`${creds.username}:${creds.password}`).toString('base64')
    } else {
      throw new Error(`Unsupported credential type for Oracle Fusion: ${creds.type}`)
    }
  }

  private async connectEBS(): Promise<void> {
    const creds = this.config.credentials

    if (creds.type === 'basic') {
      // Basic Auth for EBS
      if (!creds.username || !creds.password) {
        throw new Error('Basic auth requires username and password')
      }
      this.accessToken = Buffer.from(`${creds.username}:${creds.password}`).toString('base64')
    } else {
      throw new Error(`Unsupported credential type for Oracle EBS: ${creds.type}`)
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
      if (this.oracleConfig.oracleSystem === 'fusion') {
        await this.makeOracleRequest<{ hasMore: boolean; items: OracleFusionSupplier[] }>(
          'GET',
          '/fscmRestApi/resources/11.13.18.05/suppliers?limit=1'
        )
      } else {
        // EBS - test connection with a simple query
        await this.makeOracleRequest<{ items: OracleEBSVendor[] }>(
          'GET',
          '/apps/ap/vendors?limit=1'
        )
      }

      return true
    } catch (error) {
      console.error('Oracle connection test failed:', error)
      return false
    }
  }

  // ==========================================================================
  // VENDOR METHODS
  // ==========================================================================

  async getVendors(filters?: { modifiedSince?: Date; limit?: number }): Promise<Vendor[]> {
    if (this.oracleConfig.oracleSystem === 'fusion') {
      return this.getVendorsFusion(filters)
    } else {
      return this.getVendorsEBS(filters)
    }
  }

  private async getVendorsFusion(filters?: { modifiedSince?: Date; limit?: number }): Promise<Vendor[]> {
    const params = new URLSearchParams()
    if (filters?.limit) params.append('limit', filters.limit.toString())
    if (filters?.modifiedSince) {
      params.append('q', `LastUpdateDate>='${filters.modifiedSince.toISOString()}'`)
    }

    const response = await this.makeOracleRequest<{ items: OracleFusionSupplier[] }>(
      'GET',
      `/fscmRestApi/resources/11.13.18.05/suppliers?${params.toString()}`
    )

    return Promise.all(response.items.map(s => this.mapFusionSupplierToVendor(s)))
  }

  private async getVendorsEBS(filters?: { modifiedSince?: Date; limit?: number }): Promise<Vendor[]> {
    const params = new URLSearchParams()
    if (filters?.limit) params.append('limit', filters.limit.toString())

    const response = await this.makeOracleRequest<{ items: OracleEBSVendor[] }>(
      'GET',
      `/apps/ap/vendors?${params.toString()}`
    )

    return response.items.map(v => this.mapEBSVendorToVendor(v))
  }

  async getVendor(vendorId: string): Promise<Vendor | null> {
    try {
      if (this.oracleConfig.oracleSystem === 'fusion') {
        const response = await this.makeOracleRequest<OracleFusionSupplier>(
          'GET',
          `/fscmRestApi/resources/11.13.18.05/suppliers/${vendorId}`
        )
        return this.mapFusionSupplierToVendor(response)
      } else {
        const response = await this.makeOracleRequest<OracleEBSVendor>(
          'GET',
          `/apps/ap/vendors/${vendorId}`
        )
        return this.mapEBSVendorToVendor(response)
      }
    } catch (error) {
      console.error(`Failed to get vendor ${vendorId}:`, error)
      return null
    }
  }

  async createVendor(vendor: Partial<Vendor>): Promise<SyncResult<Vendor>> {
    try {
      if (this.oracleConfig.oracleSystem === 'fusion') {
        return this.createVendorFusion(vendor)
      } else {
        return this.createVendorEBS(vendor)
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  private async createVendorFusion(vendor: Partial<Vendor>): Promise<SyncResult<Vendor>> {
    const payload: Partial<OracleFusionSupplier> = {
      Supplier: vendor.name || '',
      TaxpayerId: vendor.taxId,
      EmailAddress: vendor.email,
      PhoneNumber: vendor.phone,
      PaymentCurrency: vendor.currency,
      PaymentTerms: vendor.paymentTerms,
    }

    const response = await this.makeOracleRequest<OracleFusionSupplier>(
      'POST',
      '/fscmRestApi/resources/11.13.18.05/suppliers',
      payload
    )

    const createdVendor = await this.mapFusionSupplierToVendor(response)

    return {
      success: true,
      data: createdVendor,
      externalId: response.SupplierId.toString(),
    }
  }

  private async createVendorEBS(vendor: Partial<Vendor>): Promise<SyncResult<Vendor>> {
    const payload: Partial<OracleEBSVendor> = {
      VENDOR_NAME: vendor.name || '',
      NUM_1099: vendor.taxId,
      EMAIL_ADDRESS: vendor.email,
      PAYMENT_CURRENCY_CODE: vendor.currency,
      TERMS_NAME: vendor.paymentTerms,
    }

    const response = await this.makeOracleRequest<OracleEBSVendor>(
      'POST',
      '/apps/ap/vendors',
      payload
    )

    const createdVendor = this.mapEBSVendorToVendor(response)

    return {
      success: true,
      data: createdVendor,
      externalId: response.VENDOR_ID.toString(),
    }
  }

  async updateVendor(vendorId: string, updates: Partial<Vendor>): Promise<SyncResult<Vendor>> {
    try {
      if (this.oracleConfig.oracleSystem === 'fusion') {
        return this.updateVendorFusion(vendorId, updates)
      } else {
        return this.updateVendorEBS(vendorId, updates)
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  private async updateVendorFusion(vendorId: string, updates: Partial<Vendor>): Promise<SyncResult<Vendor>> {
    const payload: Partial<OracleFusionSupplier> = {}
    if (updates.name) payload.Supplier = updates.name
    if (updates.taxId) payload.TaxpayerId = updates.taxId
    if (updates.email) payload.EmailAddress = updates.email
    if (updates.phone) payload.PhoneNumber = updates.phone
    if (updates.currency) payload.PaymentCurrency = updates.currency
    if (updates.paymentTerms) payload.PaymentTerms = updates.paymentTerms

    const response = await this.makeOracleRequest<OracleFusionSupplier>(
      'PATCH',
      `/fscmRestApi/resources/11.13.18.05/suppliers/${vendorId}`,
      payload
    )

    const updatedVendor = await this.mapFusionSupplierToVendor(response)

    return {
      success: true,
      data: updatedVendor,
      externalId: response.SupplierId.toString(),
    }
  }

  private async updateVendorEBS(vendorId: string, updates: Partial<Vendor>): Promise<SyncResult<Vendor>> {
    const payload: Partial<OracleEBSVendor> = {}
    if (updates.name) payload.VENDOR_NAME = updates.name
    if (updates.taxId) payload.NUM_1099 = updates.taxId
    if (updates.email) payload.EMAIL_ADDRESS = updates.email
    if (updates.currency) payload.PAYMENT_CURRENCY_CODE = updates.currency
    if (updates.paymentTerms) payload.TERMS_NAME = updates.paymentTerms

    const response = await this.makeOracleRequest<OracleEBSVendor>(
      'PATCH',
      `/apps/ap/vendors/${vendorId}`,
      payload
    )

    const updatedVendor = this.mapEBSVendorToVendor(response)

    return {
      success: true,
      data: updatedVendor,
      externalId: response.VENDOR_ID.toString(),
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
    if (this.oracleConfig.oracleSystem === 'fusion') {
      return this.getInvoicesFusion(filters)
    } else {
      return this.getInvoicesEBS(filters)
    }
  }

  private async getInvoicesFusion(filters?: {
    status?: Invoice['status'][]
    vendorId?: string
    dueBefore?: Date
    dueAfter?: Date
    modifiedSince?: Date
    limit?: number
  }): Promise<Invoice[]> {
    const params = new URLSearchParams()
    if (filters?.limit) params.append('limit', filters.limit.toString())

    const qFilters: string[] = []
    if (filters?.vendorId) qFilters.push(`SupplierId=${filters.vendorId}`)
    if (filters?.dueBefore) qFilters.push(`PaymentDueDate<='${filters.dueBefore.toISOString().split('T')[0]}'`)
    if (filters?.dueAfter) qFilters.push(`PaymentDueDate>='${filters.dueAfter.toISOString().split('T')[0]}'`)
    if (qFilters.length > 0) params.append('q', qFilters.join(';'))

    const response = await this.makeOracleRequest<{ items: OracleFusionInvoice[] }>(
      'GET',
      `/fscmRestApi/resources/11.13.18.05/invoices?${params.toString()}`
    )

    return Promise.all(response.items.map(inv => this.mapFusionInvoiceToInvoice(inv)))
  }

  private async getInvoicesEBS(filters?: {
    status?: Invoice['status'][]
    vendorId?: string
    dueBefore?: Date
    dueAfter?: Date
    modifiedSince?: Date
    limit?: number
  }): Promise<Invoice[]> {
    const params = new URLSearchParams()
    if (filters?.limit) params.append('limit', filters.limit.toString())
    if (filters?.vendorId) params.append('VENDOR_ID', filters.vendorId)

    const response = await this.makeOracleRequest<{ items: OracleEBSInvoice[] }>(
      'GET',
      `/apps/ap/invoices?${params.toString()}`
    )

    return response.items.map(inv => this.mapEBSInvoiceToInvoice(inv))
  }

  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    try {
      if (this.oracleConfig.oracleSystem === 'fusion') {
        const response = await this.makeOracleRequest<OracleFusionInvoice>(
          'GET',
          `/fscmRestApi/resources/11.13.18.05/invoices/${invoiceId}`
        )
        return this.mapFusionInvoiceToInvoice(response)
      } else {
        const response = await this.makeOracleRequest<OracleEBSInvoice>(
          'GET',
          `/apps/ap/invoices/${invoiceId}`
        )
        return this.mapEBSInvoiceToInvoice(response)
      }
    } catch (error) {
      console.error(`Failed to get invoice ${invoiceId}:`, error)
      return null
    }
  }

  // ==========================================================================
  // PAYMENT METHODS
  // ==========================================================================

  async createPayment(payment: Partial<Payment>): Promise<SyncResult<Payment>> {
    try {
      if (this.oracleConfig.oracleSystem === 'fusion') {
        return this.createPaymentFusion(payment)
      } else {
        return this.createPaymentEBS(payment)
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  private async createPaymentFusion(payment: Partial<Payment>): Promise<SyncResult<Payment>> {
    const payload: Partial<OracleFusionPayment> = {
      PaymentAmount: payment.amount || 0,
      PaymentCurrencyCode: payment.currency || 'USD',
      PaymentDate: payment.paymentDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      PaymentMethodCode: this.mapPaymentMethod(payment.paymentMethod || 'grain'),
      PaymentReference: payment.reference || payment.grainTransactionId,
    }

    const response = await this.makeOracleRequest<OracleFusionPayment>(
      'POST',
      '/fscmRestApi/resources/11.13.18.05/payments',
      payload
    )

    const createdPayment = this.mapFusionPaymentToPayment(response, payment)

    return {
      success: true,
      data: createdPayment,
      externalId: response.PaymentId.toString(),
    }
  }

  private async createPaymentEBS(payment: Partial<Payment>): Promise<SyncResult<Payment>> {
    const payload: Partial<OracleEBSPayment> = {
      PAYMENT_AMOUNT: payment.amount || 0,
      PAYMENT_CURRENCY_CODE: payment.currency || 'USD',
      PAYMENT_DATE: payment.paymentDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      PAYMENT_METHOD_CODE: this.mapPaymentMethod(payment.paymentMethod || 'grain'),
      PAYMENT_REFERENCE: payment.reference || payment.grainTransactionId,
    }

    const response = await this.makeOracleRequest<OracleEBSPayment>(
      'POST',
      '/apps/ap/payments',
      payload
    )

    const createdPayment = this.mapEBSPaymentToPayment(response, payment)

    return {
      success: true,
      data: createdPayment,
      externalId: response.PAYMENT_ID.toString(),
    }
  }

  async syncPayment(payment: Payment): Promise<SyncResult<Payment>> {
    if (payment.externalId) {
      // Update existing payment
      try {
        if (this.oracleConfig.oracleSystem === 'fusion') {
          const payload: Partial<OracleFusionPayment> = {
            PaymentStatus: this.mapPaymentStatus(payment.status),
            PaymentReference: payment.reference || payment.grainTransactionId,
          }

          await this.makeOracleRequest<OracleFusionPayment>(
            'PATCH',
            `/fscmRestApi/resources/11.13.18.05/payments/${payment.externalId}`,
            payload
          )
        } else {
          const payload: Partial<OracleEBSPayment> = {
            PAYMENT_STATUS_CODE: this.mapPaymentStatus(payment.status),
            PAYMENT_REFERENCE: payment.reference || payment.grainTransactionId,
          }

          await this.makeOracleRequest<OracleEBSPayment>(
            'PATCH',
            `/apps/ap/payments/${payment.externalId}`,
            payload
          )
        }

        return {
          success: true,
          data: payment,
          externalId: payment.externalId,
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
      if (this.oracleConfig.oracleSystem === 'fusion') {
        const response = await this.makeOracleRequest<OracleFusionPayment>(
          'GET',
          `/fscmRestApi/resources/11.13.18.05/payments/${paymentId}`
        )
        return this.mapFusionPaymentToPayment(response)
      } else {
        const response = await this.makeOracleRequest<OracleEBSPayment>(
          'GET',
          `/apps/ap/payments/${paymentId}`
        )
        return this.mapEBSPaymentToPayment(response)
      }
    } catch (error) {
      console.error(`Failed to get payment ${paymentId}:`, error)
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
    if (this.oracleConfig.oracleSystem === 'fusion') {
      return this.getPaymentsFusion(filters)
    } else {
      return this.getPaymentsEBS(filters)
    }
  }

  private async getPaymentsFusion(filters?: {
    vendorId?: string
    status?: Payment['status'][]
    dateFrom?: Date
    dateTo?: Date
    limit?: number
  }): Promise<Payment[]> {
    const params = new URLSearchParams()
    if (filters?.limit) params.append('limit', filters.limit.toString())

    const qFilters: string[] = []
    if (filters?.dateFrom) qFilters.push(`PaymentDate>='${filters.dateFrom.toISOString().split('T')[0]}'`)
    if (filters?.dateTo) qFilters.push(`PaymentDate<='${filters.dateTo.toISOString().split('T')[0]}'`)
    if (qFilters.length > 0) params.append('q', qFilters.join(';'))

    const response = await this.makeOracleRequest<{ items: OracleFusionPayment[] }>(
      'GET',
      `/fscmRestApi/resources/11.13.18.05/payments?${params.toString()}`
    )

    return response.items.map(pmt => this.mapFusionPaymentToPayment(pmt))
  }

  private async getPaymentsEBS(filters?: {
    vendorId?: string
    status?: Payment['status'][]
    dateFrom?: Date
    dateTo?: Date
    limit?: number
  }): Promise<Payment[]> {
    const params = new URLSearchParams()
    if (filters?.limit) params.append('limit', filters.limit.toString())

    const response = await this.makeOracleRequest<{ items: OracleEBSPayment[] }>(
      'GET',
      `/apps/ap/payments?${params.toString()}`
    )

    return response.items.map(pmt => this.mapEBSPaymentToPayment(pmt))
  }

  // ==========================================================================
  // JOURNAL ENTRY METHODS
  // ==========================================================================

  async createJournalEntry(entry: Partial<JournalEntry>): Promise<SyncResult<JournalEntry>> {
    try {
      if (this.oracleConfig.oracleSystem === 'fusion') {
        return this.createJournalEntryFusion(entry)
      } else {
        return this.createJournalEntryEBS(entry)
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  private async createJournalEntryFusion(entry: Partial<JournalEntry>): Promise<SyncResult<JournalEntry>> {
    if (!this.oracleConfig.ledgerId) {
      throw new Error('Ledger ID required for Oracle Fusion journal entries')
    }

    const payload: OracleFusionJournalEntry = {
      LedgerId: parseInt(this.oracleConfig.ledgerId),
      AccountingDate: entry.date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      Description: entry.description || '',
      JournalLines: entry.lines?.map(line => ({
        CodeCombinationId: parseInt(line.accountId),
        EnteredDebit: line.debit || 0,
        EnteredCredit: line.credit || 0,
        Description: line.memo,
      })) || [],
    }

    const response = await this.makeOracleRequest<OracleFusionJournalEntry>(
      'POST',
      '/fscmRestApi/resources/11.13.18.05/journalEntries',
      payload
    )

    const createdEntry: JournalEntry = {
      id: response.JournalEntryId?.toString() || '',
      externalId: response.JournalEntryId?.toString(),
      date: new Date(payload.AccountingDate),
      description: payload.Description || '',
      lines: entry.lines || [],
      status: 'draft',
      reference: response.JournalName,
    }

    return {
      success: true,
      data: createdEntry,
      externalId: response.JournalEntryId?.toString(),
    }
  }

  private async createJournalEntryEBS(entry: Partial<JournalEntry>): Promise<SyncResult<JournalEntry>> {
    // EBS uses different API structure for journal entries
    const payload = {
      GL_DATE: entry.date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      DESCRIPTION: entry.description || '',
      JOURNAL_LINES: entry.lines?.map(line => ({
        CODE_COMBINATION_ID: parseInt(line.accountId),
        ENTERED_DR: line.debit || 0,
        ENTERED_CR: line.credit || 0,
        DESCRIPTION: line.memo,
      })) || [],
    }

    const response = await this.makeOracleRequest<{ JOURNAL_ENTRY_ID: number }>(
      'POST',
      '/apps/gl/journal_entries',
      payload
    )

    const createdEntry: JournalEntry = {
      id: response.JOURNAL_ENTRY_ID.toString(),
      externalId: response.JOURNAL_ENTRY_ID.toString(),
      date: new Date(payload.GL_DATE),
      description: payload.DESCRIPTION,
      lines: entry.lines || [],
      status: 'draft',
    }

    return {
      success: true,
      data: createdEntry,
      externalId: response.JOURNAL_ENTRY_ID.toString(),
    }
  }

  // ==========================================================================
  // GL ACCOUNT & COST CENTER METHODS
  // ==========================================================================

  async getGLAccounts(): Promise<GLAccount[]> {
    if (this.oracleConfig.oracleSystem === 'fusion') {
      return this.getGLAccountsFusion()
    } else {
      return this.getGLAccountsEBS()
    }
  }

  private async getGLAccountsFusion(): Promise<GLAccount[]> {
    const response = await this.makeOracleRequest<{ items: { CodeCombinationId: number; ConcatenatedSegments: string; EnabledFlag: string }[] }>(
      'GET',
      '/fscmRestApi/resources/11.13.18.05/codeCombinations?limit=1000'
    )

    return response.items.map(acc => ({
      id: acc.CodeCombinationId.toString(),
      code: acc.ConcatenatedSegments,
      name: acc.ConcatenatedSegments,
      type: this.determineAccountType(acc.ConcatenatedSegments),
      isActive: acc.EnabledFlag === 'Y',
    }))
  }

  private async getGLAccountsEBS(): Promise<GLAccount[]> {
    const response = await this.makeOracleRequest<{ items: OracleGLAccount[] }>(
      'GET',
      '/apps/gl/code_combinations?limit=1000'
    )

    return response.items.map(acc => ({
      id: acc.CODE_COMBINATION_ID.toString(),
      code: acc.CONCATENATED_SEGMENTS,
      name: acc.CONCATENATED_SEGMENTS,
      type: this.determineAccountType(acc.CONCATENATED_SEGMENTS),
      isActive: acc.ENABLED_FLAG === 'Y',
    }))
  }

  async getCostCenters(): Promise<CostCenter[]> {
    if (this.oracleConfig.oracleSystem === 'fusion') {
      return this.getCostCentersFusion()
    } else {
      return this.getCostCentersEBS()
    }
  }

  private async getCostCentersFusion(): Promise<CostCenter[]> {
    // Fusion uses DFF (Descriptive Flexfield) for cost centers
    const response = await this.makeOracleRequest<{ items: { ValueId: number; Value: string; Description: string; EnabledFlag: string }[] }>(
      'GET',
      '/fscmRestApi/resources/11.13.18.05/flexValues?flexfieldCode=COST_CENTER&limit=1000'
    )

    return response.items.map(cc => ({
      id: cc.ValueId.toString(),
      code: cc.Value,
      name: cc.Description || cc.Value,
      isActive: cc.EnabledFlag === 'Y',
    }))
  }

  private async getCostCentersEBS(): Promise<CostCenter[]> {
    const response = await this.makeOracleRequest<{ items: { FLEX_VALUE_ID: number; FLEX_VALUE: string; DESCRIPTION: string; ENABLED_FLAG: string }[] }>(
      'GET',
      '/apps/gl/flex_values?FLEX_VALUE_SET_NAME=COST_CENTER&limit=1000'
    )

    return response.items.map(cc => ({
      id: cc.FLEX_VALUE_ID.toString(),
      code: cc.FLEX_VALUE,
      name: cc.DESCRIPTION || cc.FLEX_VALUE,
      isActive: cc.ENABLED_FLAG === 'Y',
    }))
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private async makeOracleRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    await this.refreshTokenIfNeeded()

    const url = this.buildUrl(path)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Add auth header based on credential type
    if (this.config.credentials.type === 'oauth2') {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    } else if (this.config.credentials.type === 'basic') {
      headers['Authorization'] = `Basic ${this.accessToken}`
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Oracle API Error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  private async mapFusionSupplierToVendor(supplier: OracleFusionSupplier): Promise<Vendor> {
    // Fetch supplier sites for bank account info
    let bankAccount
    try {
      const sitesResponse = await this.makeOracleRequest<{ items: OracleFusionSupplierSite[] }>(
        'GET',
        `/fscmRestApi/resources/11.13.18.05/suppliers/${supplier.SupplierId}/child/sites?limit=1`
      )
      const site = sitesResponse.items[0]
      if (site) {
        bankAccount = {
          bankName: site.BankAccountName || '',
          accountNumber: site.BankAccountNumber || '',
          routingNumber: site.BankRoutingNumber || '',
          swiftCode: site.SwiftCode,
          iban: site.Iban,
        }
      }
    } catch (error) {
      // Ignore bank account fetch errors
    }

    return {
      id: supplier.SupplierId.toString(),
      externalId: supplier.SupplierId.toString(),
      name: supplier.Supplier,
      email: supplier.EmailAddress,
      phone: supplier.PhoneNumber,
      taxId: supplier.TaxpayerId,
      currency: supplier.PaymentCurrency || 'USD',
      paymentTerms: supplier.PaymentTerms,
      bankAccount,
    }
  }

  private mapEBSVendorToVendor(vendor: OracleEBSVendor): Vendor {
    return {
      id: vendor.VENDOR_ID.toString(),
      externalId: vendor.VENDOR_ID.toString(),
      name: vendor.VENDOR_NAME,
      email: vendor.EMAIL_ADDRESS,
      taxId: vendor.NUM_1099,
      currency: vendor.PAYMENT_CURRENCY_CODE || 'USD',
      paymentTerms: vendor.TERMS_NAME,
    }
  }

  private async mapFusionInvoiceToInvoice(invoice: OracleFusionInvoice): Promise<Invoice> {
    // Fetch invoice lines
    let lineItems: InvoiceLineItem[] = []
    try {
      const linesResponse = await this.makeOracleRequest<{ items: OracleFusionInvoiceLine[] }>(
        'GET',
        `/fscmRestApi/resources/11.13.18.05/invoices/${invoice.InvoiceId}/child/lines`
      )
      lineItems = linesResponse.items.map(line => ({
        id: line.InvoiceLineId.toString(),
        description: line.Description || '',
        quantity: line.Quantity || 1,
        unitPrice: line.UnitPrice || line.Amount,
        amount: line.Amount,
        glAccount: line.DistCombinationId?.toString(),
        taxCode: line.TaxClassificationCode,
      }))
    } catch (error) {
      // Use single line if fetch fails
      lineItems = [{
        id: '1',
        description: invoice.Description || '',
        quantity: 1,
        unitPrice: invoice.InvoiceAmount,
        amount: invoice.InvoiceAmount,
      }]
    }

    return {
      id: invoice.InvoiceId.toString(),
      externalId: invoice.InvoiceId.toString(),
      vendorId: invoice.SupplierId?.toString() || '',
      vendorName: invoice.Supplier || '',
      amount: invoice.InvoiceAmount,
      currency: invoice.InvoiceCurrencyCode,
      dueDate: invoice.PaymentDueDate ? new Date(invoice.PaymentDueDate) : new Date(),
      invoiceDate: new Date(invoice.InvoiceDate),
      status: this.mapInvoiceStatus(invoice.PaymentStatusFlag),
      lineItems,
      description: invoice.Description,
    }
  }

  private mapEBSInvoiceToInvoice(invoice: OracleEBSInvoice): Invoice {
    return {
      id: invoice.INVOICE_ID.toString(),
      externalId: invoice.INVOICE_ID.toString(),
      vendorId: invoice.VENDOR_ID?.toString() || '',
      vendorName: invoice.VENDOR_NAME || '',
      amount: invoice.INVOICE_AMOUNT,
      currency: invoice.INVOICE_CURRENCY_CODE,
      dueDate: invoice.DUE_DATE ? new Date(invoice.DUE_DATE) : new Date(),
      invoiceDate: new Date(invoice.INVOICE_DATE),
      status: this.mapInvoiceStatus(invoice.PAYMENT_STATUS_FLAG),
      lineItems: [{
        id: '1',
        description: invoice.DESCRIPTION || '',
        quantity: 1,
        unitPrice: invoice.INVOICE_AMOUNT,
        amount: invoice.INVOICE_AMOUNT,
      }],
      description: invoice.DESCRIPTION,
    }
  }

  private mapFusionPaymentToPayment(payment: OracleFusionPayment, original?: Partial<Payment>): Payment {
    return {
      id: payment.PaymentId.toString(),
      externalId: payment.PaymentId.toString(),
      invoiceId: original?.invoiceId || '',
      vendorId: original?.vendorId || '',
      amount: payment.PaymentAmount,
      currency: payment.PaymentCurrencyCode,
      paymentDate: new Date(payment.PaymentDate),
      paymentMethod: this.reverseMapPaymentMethod(payment.PaymentMethodCode),
      grainTransactionId: original?.grainTransactionId,
      status: this.reverseMapPaymentStatus(payment.PaymentStatus),
      reference: payment.PaymentReference,
    }
  }

  private mapEBSPaymentToPayment(payment: OracleEBSPayment, original?: Partial<Payment>): Payment {
    return {
      id: payment.PAYMENT_ID.toString(),
      externalId: payment.PAYMENT_ID.toString(),
      invoiceId: original?.invoiceId || '',
      vendorId: original?.vendorId || '',
      amount: payment.PAYMENT_AMOUNT,
      currency: payment.PAYMENT_CURRENCY_CODE,
      paymentDate: new Date(payment.PAYMENT_DATE),
      paymentMethod: this.reverseMapPaymentMethod(payment.PAYMENT_METHOD_CODE),
      grainTransactionId: original?.grainTransactionId,
      status: this.reverseMapPaymentStatus(payment.PAYMENT_STATUS_CODE),
      reference: payment.PAYMENT_REFERENCE,
    }
  }

  private mapInvoiceStatus(oracleStatus?: string): Invoice['status'] {
    if (!oracleStatus) return 'open'

    const status = oracleStatus.toUpperCase()
    if (status === 'PAID' || status === 'Y') return 'paid'
    if (status === 'PARTIAL') return 'partial'
    if (status === 'CANCELLED') return 'cancelled'
    if (status === 'DISPUTED') return 'disputed'
    return 'open'
  }

  private mapPaymentMethod(method: string): string {
    const methodMap: Record<string, string> = {
      'grain': 'CRYPTO',
      'wire': 'WIRE',
      'ach': 'ACH',
      'check': 'CHECK',
    }
    return methodMap[method] || 'WIRE'
  }

  private reverseMapPaymentMethod(oracleMethod: string): Payment['paymentMethod'] {
    const upperMethod = oracleMethod.toUpperCase()
    if (upperMethod === 'CRYPTO') return 'grain'
    if (upperMethod === 'WIRE') return 'wire'
    if (upperMethod === 'ACH') return 'ach'
    if (upperMethod === 'CHECK') return 'check'
    return 'wire'
  }

  private mapPaymentStatus(status: Payment['status']): string {
    const statusMap: Record<string, string> = {
      'pending': 'PENDING',
      'processing': 'PROCESSING',
      'completed': 'COMPLETED',
      'failed': 'FAILED',
      'reversed': 'REVERSED',
    }
    return statusMap[status] || 'PENDING'
  }

  private reverseMapPaymentStatus(oracleStatus?: string): Payment['status'] {
    if (!oracleStatus) return 'pending'

    const status = oracleStatus.toUpperCase()
    if (status === 'COMPLETED') return 'completed'
    if (status === 'PROCESSING') return 'processing'
    if (status === 'FAILED') return 'failed'
    if (status === 'REVERSED') return 'reversed'
    return 'pending'
  }

  private determineAccountType(accountCode: string): GLAccount['type'] {
    // Parse Oracle account structure (typically Company-CostCenter-Account-SubAccount)
    const segments = accountCode.split('-')
    if (segments.length < 3) return 'expense'

    const accountSegment = segments[2]
    const firstDigit = accountSegment.charAt(0)

    if (firstDigit === '1') return 'asset'
    if (firstDigit === '2') return 'liability'
    if (firstDigit === '3') return 'equity'
    if (firstDigit === '4') return 'revenue'
    if (firstDigit === '5' || firstDigit === '6' || firstDigit === '7') return 'expense'

    return 'expense'
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createOracleAdapter(config: OracleConfig): OracleERPAdapter {
  return new OracleERPAdapter(config)
}

export default OracleERPAdapter
