// @ts-nocheck
/**
 * Microsoft Dynamics 365 Adapter for Grain & Vault Treasury SDK
 *
 * Supports both:
 * - Dynamics 365 Finance & Operations (F&O) - OData API
 * - Dynamics 365 Business Central - REST API
 *
 * Uses Azure AD OAuth2 for authentication
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
// DYNAMICS 365 TYPES & INTERFACES
// ============================================================================

export interface Dynamics365Config extends ERPConnectionConfig {
  dynamicsSystem: 'finance_operations' | 'business_central'
  tenantId: string
  clientId: string
  clientSecret: string
  companyId?: string           // Required for Business Central, optional for F&O
  dynamicsEnvironment?: string  // Environment name (production, sandbox, etc.) - separate from base environment
  apiVersion?: string          // Default: v2.0 for Business Central, v1.0 for F&O
}

interface DynamicsAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
  ext_expires_in: number
  refresh_token?: string
}

// Dynamics 365 Finance & Operations OData entities
interface DynamicsVendor {
  VendorAccountNumber: string
  VendorOrganizationName: string
  PrimaryContactEmail?: string
  PrimaryContactPhone?: string
  VendorGroupId?: string
  CurrencyCode: string
  PaymentTermsId?: string
  TaxRegistrationNumber?: string
  IsOnHold: boolean
  DefaultPaymentMethodName?: string
  // Bank account fields
  PrimaryBankAccountId?: string
  BankAccountNumber?: string
  BankRoutingNumber?: string
  BankSWIFTCode?: string
  BankIBAN?: string
}

interface DynamicsInvoice {
  InvoiceId: string
  VendorInvoiceNumber: string
  VendorAccountNumber: string
  VendorName: string
  InvoiceAmount: number
  CurrencyCode: string
  InvoiceDate: string
  DueDate: string
  InvoiceStatus: string
  PurchaseOrderNumber?: string
  Description?: string
  // Line items loaded separately
}

interface DynamicsInvoiceLine {
  LineNumber: number
  ProductDescription: string
  Quantity: number
  UnitPrice: number
  LineAmount: number
  LedgerDimensionDisplayValue?: string  // GL Account
  DefaultDimension?: string             // Cost Center
  TaxItemGroup?: string
}

interface DynamicsPayment {
  PaymentId: string
  VendorAccountNumber: string
  PaymentAmount: number
  CurrencyCode: string
  PaymentDate: string
  PaymentMethod: string
  PaymentStatus: string
  PaymentReference?: string
  BankAccountId?: string
  TransactionId?: string
}

interface DynamicsJournalEntry {
  JournalBatchNumber: string
  JournalName: string
  Description: string
  PostingDate: string
  JournalType: string
  // Lines loaded separately
}

interface DynamicsJournalLine {
  LineNumber: number
  AccountDisplayValue: string
  AccountName?: string
  DebitAmount: number
  CreditAmount: number
  Text?: string
  Dimension?: string
}

interface DynamicsGLAccount {
  MainAccountId: string
  Name: string
  MainAccountCategory: string
  CurrencyCode?: string
  IsBlocked: boolean
  ParentMainAccountId?: string
}

interface DynamicsDimension {
  DimensionValue: string
  DimensionValueName: string
  DimensionName: string
  IsBlocked: boolean
  ParentDimensionValue?: string
}

// Business Central API entities
interface BCVendor {
  id: string
  number: string
  displayName: string
  email?: string
  phoneNumber?: string
  taxRegistrationNumber?: string
  currencyCode: string
  paymentTermsId?: string
  blocked?: string
  lastModifiedDateTime: string
}

interface BCInvoice {
  id: string
  number: string
  vendorId: string
  vendorNumber: string
  vendorName: string
  invoiceDate: string
  dueDate: string
  amount: number
  currencyCode: string
  status: string
  purchaseOrderNumber?: string
}

interface BCPayment {
  id: string
  vendorNumber: string
  postingDate: string
  amount: number
  currencyCode: string
  description?: string
  externalDocumentNumber?: string
}

// ============================================================================
// DYNAMICS 365 ADAPTER
// ============================================================================

export class Dynamics365Adapter extends BaseERPAdapter {
  private dynamicsConfig: Dynamics365Config
  private baseApiUrl: string

  constructor(config: Dynamics365Config) {
    super(config)
    this.dynamicsConfig = config

    // Build base API URL based on system type
    if (config.dynamicsSystem === 'finance_operations') {
      // F&O OData endpoint
      this.baseApiUrl = config.endpoint.replace(/\/$/, '') + '/data'
    } else {
      // Business Central API endpoint
      const apiVersion = config.apiVersion || 'v2.0'
      this.baseApiUrl = config.endpoint.replace(/\/$/, '') + `/api/${apiVersion}`
      if (config.companyId) {
        this.baseApiUrl += `/companies(${config.companyId})`
      }
    }

    // Dynamics-specific GL mappings
    this.glMappings = {
      'payment': '200100',           // Accounts Payable - Trade
      'receipt': '110100',           // Cash and Cash Equivalents
      'credit_draw': '220100',       // Short-term Credit
      'credit_repay': '220100',      // Short-term Credit
      'grain_appreciation': '810100', // Other Operating Income
      'grain_reserve': '130100',     // Digital Asset Reserve
    }
  }

  // ============================================================================
  // CONNECTION METHODS
  // ============================================================================

  async connect(): Promise<void> {
    try {
      // Azure AD OAuth2 authentication
      const tokenUrl = `https://login.microsoftonline.com/${this.dynamicsConfig.tenantId}/oauth2/v2.0/token`

      const scope = this.dynamicsConfig.dynamicsSystem === 'finance_operations'
        ? `${this.config.endpoint}/.default`
        : `https://api.businesscentral.dynamics.com/.default`

      const params = new URLSearchParams({
        client_id: this.dynamicsConfig.clientId,
        client_secret: this.dynamicsConfig.clientSecret,
        scope: scope,
        grant_type: 'client_credentials',
      })

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Azure AD authentication failed: ${response.status} - ${error}`)
      }

      const authData: DynamicsAuthResponse = await response.json()
      this.accessToken = authData.access_token

      // Set token expiry (subtract 5 minutes for buffer)
      const expiresIn = authData.expires_in - 300
      this.tokenExpiry = new Date(Date.now() + expiresIn * 1000)

      this.connectionStatus = 'connected'
    } catch (error) {
      this.connectionStatus = 'error'
      throw new Error(`Failed to connect to Dynamics 365: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async disconnect(): Promise<void> {
    this.accessToken = undefined
    this.tokenExpiry = undefined
    this.connectionStatus = 'disconnected'
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.refreshTokenIfNeeded()

      // Test connection with a simple query
      if (this.dynamicsConfig.dynamicsSystem === 'finance_operations') {
        await this.makeRequest<{ value: DynamicsVendor[] }>('GET', '/Vendors?$top=1')
      } else {
        await this.makeRequest<{ value: BCVendor[] }>('GET', '/vendors?$top=1')
      }

      return true
    } catch (error) {
      console.error('Dynamics 365 connection test failed:', error)
      return false
    }
  }

  // ============================================================================
  // VENDOR METHODS
  // ============================================================================

  async getVendors(filters?: { modifiedSince?: Date; limit?: number }): Promise<Vendor[]> {
    await this.refreshTokenIfNeeded()

    if (this.dynamicsConfig.dynamicsSystem === 'finance_operations') {
      return this.getVendorsFinanceOps(filters)
    } else {
      return this.getVendorsBusinessCentral(filters)
    }
  }

  private async getVendorsFinanceOps(filters?: { modifiedSince?: Date; limit?: number }): Promise<Vendor[]> {
    let query = '/Vendors?$select=VendorAccountNumber,VendorOrganizationName,PrimaryContactEmail,PrimaryContactPhone,CurrencyCode,PaymentTermsId,TaxRegistrationNumber,IsOnHold,BankAccountNumber,BankRoutingNumber,BankSWIFTCode,BankIBAN'

    if (filters?.modifiedSince) {
      query += `&$filter=ModifiedDateTime ge ${filters.modifiedSince.toISOString()}`
    }

    if (filters?.limit) {
      query += `&$top=${filters.limit}`
    }

    const response = await this.makeRequest<{ value: DynamicsVendor[] }>('GET', query)
    return response.value.map(v => this.mapDynamicsVendorToVendor(v))
  }

  private async getVendorsBusinessCentral(filters?: { modifiedSince?: Date; limit?: number }): Promise<Vendor[]> {
    let query = '/vendors?$select=id,number,displayName,email,phoneNumber,currencyCode,paymentTermsId,taxRegistrationNumber,blocked,lastModifiedDateTime'

    const filterConditions: string[] = []
    if (filters?.modifiedSince) {
      filterConditions.push(`lastModifiedDateTime ge ${filters.modifiedSince.toISOString()}`)
    }

    if (filterConditions.length > 0) {
      query += `&$filter=${filterConditions.join(' and ')}`
    }

    if (filters?.limit) {
      query += `&$top=${filters.limit}`
    }

    const response = await this.makeRequest<{ value: BCVendor[] }>('GET', query)
    return response.value.map(v => this.mapBCVendorToVendor(v))
  }

  async getVendor(vendorId: string): Promise<Vendor | null> {
    try {
      await this.refreshTokenIfNeeded()

      if (this.dynamicsConfig.dynamicsSystem === 'finance_operations') {
        const response = await this.makeRequest<DynamicsVendor>(
          'GET',
          `/Vendors(VendorAccountNumber='${vendorId}')`
        )
        return this.mapDynamicsVendorToVendor(response)
      } else {
        const response = await this.makeRequest<BCVendor>('GET', `/vendors(${vendorId})`)
        return this.mapBCVendorToVendor(response)
      }
    } catch (error) {
      console.error(`Failed to get vendor ${vendorId}:`, error)
      return null
    }
  }

  async createVendor(vendor: Partial<Vendor>): Promise<SyncResult<Vendor>> {
    try {
      await this.refreshTokenIfNeeded()

      if (this.dynamicsConfig.dynamicsSystem === 'finance_operations') {
        const dynamicsVendor: Partial<DynamicsVendor> = {
          VendorAccountNumber: vendor.externalId || vendor.id || '',
          VendorOrganizationName: vendor.name || '',
          PrimaryContactEmail: vendor.email,
          PrimaryContactPhone: vendor.phone,
          CurrencyCode: vendor.currency || 'USD',
          PaymentTermsId: vendor.paymentTerms,
          TaxRegistrationNumber: vendor.taxId,
          IsOnHold: false,
          BankAccountNumber: vendor.bankAccount?.accountNumber,
          BankRoutingNumber: vendor.bankAccount?.routingNumber,
          BankSWIFTCode: vendor.bankAccount?.swiftCode,
          BankIBAN: vendor.bankAccount?.iban,
        }

        const response = await this.makeRequest<DynamicsVendor>('POST', '/Vendors', dynamicsVendor)
        const createdVendor = this.mapDynamicsVendorToVendor(response)

        return {
          success: true,
          data: createdVendor,
          externalId: response.VendorAccountNumber,
        }
      } else {
        const bcVendor: Partial<BCVendor> = {
          number: vendor.externalId || vendor.id || '',
          displayName: vendor.name || '',
          email: vendor.email,
          phoneNumber: vendor.phone,
          currencyCode: vendor.currency || 'USD',
          paymentTermsId: vendor.paymentTerms,
          taxRegistrationNumber: vendor.taxId,
        }

        const response = await this.makeRequest<BCVendor>('POST', '/vendors', bcVendor)
        const createdVendor = this.mapBCVendorToVendor(response)

        return {
          success: true,
          data: createdVendor,
          externalId: response.id,
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create vendor: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  async updateVendor(vendorId: string, updates: Partial<Vendor>): Promise<SyncResult<Vendor>> {
    try {
      await this.refreshTokenIfNeeded()

      if (this.dynamicsConfig.dynamicsSystem === 'finance_operations') {
        const dynamicsUpdates: Partial<DynamicsVendor> = {}

        if (updates.name) dynamicsUpdates.VendorOrganizationName = updates.name
        if (updates.email) dynamicsUpdates.PrimaryContactEmail = updates.email
        if (updates.phone) dynamicsUpdates.PrimaryContactPhone = updates.phone
        if (updates.currency) dynamicsUpdates.CurrencyCode = updates.currency
        if (updates.paymentTerms) dynamicsUpdates.PaymentTermsId = updates.paymentTerms
        if (updates.taxId) dynamicsUpdates.TaxRegistrationNumber = updates.taxId
        if (updates.bankAccount) {
          dynamicsUpdates.BankAccountNumber = updates.bankAccount.accountNumber
          dynamicsUpdates.BankRoutingNumber = updates.bankAccount.routingNumber
          dynamicsUpdates.BankSWIFTCode = updates.bankAccount.swiftCode
          dynamicsUpdates.BankIBAN = updates.bankAccount.iban
        }

        const response = await this.makeRequest<DynamicsVendor>(
          'PATCH',
          `/Vendors(VendorAccountNumber='${vendorId}')`,
          dynamicsUpdates
        )
        const updatedVendor = this.mapDynamicsVendorToVendor(response)

        return {
          success: true,
          data: updatedVendor,
          externalId: response.VendorAccountNumber,
        }
      } else {
        const bcUpdates: Partial<BCVendor> = {}

        if (updates.name) bcUpdates.displayName = updates.name
        if (updates.email) bcUpdates.email = updates.email
        if (updates.phone) bcUpdates.phoneNumber = updates.phone
        if (updates.currency) bcUpdates.currencyCode = updates.currency
        if (updates.paymentTerms) bcUpdates.paymentTermsId = updates.paymentTerms
        if (updates.taxId) bcUpdates.taxRegistrationNumber = updates.taxId

        const response = await this.makeRequest<BCVendor>(
          'PATCH',
          `/vendors(${vendorId})`,
          bcUpdates
        )
        const updatedVendor = this.mapBCVendorToVendor(response)

        return {
          success: true,
          data: updatedVendor,
          externalId: response.id,
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to update vendor: ${error instanceof Error ? error.message : String(error)}`,
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
    await this.refreshTokenIfNeeded()

    if (this.dynamicsConfig.dynamicsSystem === 'finance_operations') {
      return this.getInvoicesFinanceOps(filters)
    } else {
      return this.getInvoicesBusinessCentral(filters)
    }
  }

  private async getInvoicesFinanceOps(filters?: {
    status?: Invoice['status'][]
    vendorId?: string
    dueBefore?: Date
    dueAfter?: Date
    modifiedSince?: Date
    limit?: number
  }): Promise<Invoice[]> {
    let query = '/VendorInvoices?$select=InvoiceId,VendorInvoiceNumber,VendorAccountNumber,VendorName,InvoiceAmount,CurrencyCode,InvoiceDate,DueDate,InvoiceStatus,PurchaseOrderNumber,Description'

    const filterConditions: string[] = []

    if (filters?.vendorId) {
      filterConditions.push(`VendorAccountNumber eq '${filters.vendorId}'`)
    }

    if (filters?.status && filters.status.length > 0) {
      const statusFilters = filters.status.map(s => this.mapStatusToDynamics(s))
      filterConditions.push(`(${statusFilters.map(s => `InvoiceStatus eq '${s}'`).join(' or ')})`)
    }

    if (filters?.dueBefore) {
      filterConditions.push(`DueDate le ${filters.dueBefore.toISOString()}`)
    }

    if (filters?.dueAfter) {
      filterConditions.push(`DueDate ge ${filters.dueAfter.toISOString()}`)
    }

    if (filters?.modifiedSince) {
      filterConditions.push(`ModifiedDateTime ge ${filters.modifiedSince.toISOString()}`)
    }

    if (filterConditions.length > 0) {
      query += `&$filter=${filterConditions.join(' and ')}`
    }

    if (filters?.limit) {
      query += `&$top=${filters.limit}`
    }

    const response = await this.makeRequest<{ value: DynamicsInvoice[] }>('GET', query)

    // Fetch line items for each invoice
    const invoices = await Promise.all(
      response.value.map(async inv => {
        const lineItems = await this.getInvoiceLineItemsFinanceOps(inv.InvoiceId)
        return this.mapDynamicsInvoiceToInvoice(inv, lineItems)
      })
    )

    return invoices
  }

  private async getInvoiceLineItemsFinanceOps(invoiceId: string): Promise<DynamicsInvoiceLine[]> {
    const query = `/VendorInvoiceLines?$filter=InvoiceId eq '${invoiceId}'`
    const response = await this.makeRequest<{ value: DynamicsInvoiceLine[] }>('GET', query)
    return response.value
  }

  private async getInvoicesBusinessCentral(filters?: {
    status?: Invoice['status'][]
    vendorId?: string
    dueBefore?: Date
    dueAfter?: Date
    modifiedSince?: Date
    limit?: number
  }): Promise<Invoice[]> {
    let query = '/purchaseInvoices?$select=id,number,vendorId,vendorNumber,vendorName,invoiceDate,dueDate,amount,currencyCode,status,purchaseOrderNumber'

    const filterConditions: string[] = []

    if (filters?.vendorId) {
      filterConditions.push(`vendorNumber eq '${filters.vendorId}'`)
    }

    if (filters?.status && filters.status.length > 0) {
      const statusFilters = filters.status.map(s => this.mapStatusToDynamics(s))
      filterConditions.push(`(${statusFilters.map(s => `status eq '${s}'`).join(' or ')})`)
    }

    if (filters?.dueBefore) {
      filterConditions.push(`dueDate le ${filters.dueBefore.toISOString()}`)
    }

    if (filters?.dueAfter) {
      filterConditions.push(`dueDate ge ${filters.dueAfter.toISOString()}`)
    }

    if (filterConditions.length > 0) {
      query += `&$filter=${filterConditions.join(' and ')}`
    }

    if (filters?.limit) {
      query += `&$top=${filters.limit}`
    }

    const response = await this.makeRequest<{ value: BCInvoice[] }>('GET', query)
    return response.value.map(inv => this.mapBCInvoiceToInvoice(inv))
  }

  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    try {
      await this.refreshTokenIfNeeded()

      if (this.dynamicsConfig.dynamicsSystem === 'finance_operations') {
        const response = await this.makeRequest<DynamicsInvoice>(
          'GET',
          `/VendorInvoices(InvoiceId='${invoiceId}')`
        )
        const lineItems = await this.getInvoiceLineItemsFinanceOps(invoiceId)
        return this.mapDynamicsInvoiceToInvoice(response, lineItems)
      } else {
        const response = await this.makeRequest<BCInvoice>('GET', `/purchaseInvoices(${invoiceId})`)
        return this.mapBCInvoiceToInvoice(response)
      }
    } catch (error) {
      console.error(`Failed to get invoice ${invoiceId}:`, error)
      return null
    }
  }

  // ============================================================================
  // PAYMENT METHODS
  // ============================================================================

  async createPayment(payment: Partial<Payment>): Promise<SyncResult<Payment>> {
    try {
      await this.refreshTokenIfNeeded()

      if (this.dynamicsConfig.dynamicsSystem === 'finance_operations') {
        const dynamicsPayment: Partial<DynamicsPayment> = {
          VendorAccountNumber: payment.vendorId || '',
          PaymentAmount: payment.amount || 0,
          CurrencyCode: payment.currency || 'USD',
          PaymentDate: payment.paymentDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
          PaymentMethod: this.mapPaymentMethodToDynamics(payment.paymentMethod || 'wire'),
          PaymentReference: payment.reference || payment.grainTransactionId,
          BankAccountId: payment.bankAccount,
          TransactionId: payment.grainTransactionId,
        }

        const response = await this.makeRequest<DynamicsPayment>('POST', '/VendorPayments', dynamicsPayment)
        const createdPayment = this.mapDynamicsPaymentToPayment(response)

        return {
          success: true,
          data: createdPayment,
          externalId: response.PaymentId,
        }
      } else {
        const bcPayment: Partial<BCPayment> = {
          vendorNumber: payment.vendorId || '',
          postingDate: payment.paymentDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
          amount: payment.amount || 0,
          currencyCode: payment.currency || 'USD',
          description: payment.reference || `GRAIN Payment: ${payment.grainTransactionId || ''}`,
          externalDocumentNumber: payment.grainTransactionId,
        }

        const response = await this.makeRequest<BCPayment>('POST', '/vendorPayments', bcPayment)
        const createdPayment = this.mapBCPaymentToPayment(response)

        return {
          success: true,
          data: createdPayment,
          externalId: response.id,
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create payment: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  async syncPayment(payment: Payment): Promise<SyncResult<Payment>> {
    // If payment already has externalId, update it; otherwise create
    if (payment.externalId) {
      return this.updatePayment(payment.externalId, payment)
    }
    return this.createPayment(payment)
  }

  private async updatePayment(paymentId: string, payment: Payment): Promise<SyncResult<Payment>> {
    try {
      await this.refreshTokenIfNeeded()

      if (this.dynamicsConfig.dynamicsSystem === 'finance_operations') {
        const updates = {
          PaymentStatus: this.mapPaymentStatusToDynamics(payment.status),
          TransactionId: payment.grainTransactionId,
        }

        const response = await this.makeRequest<DynamicsPayment>(
          'PATCH',
          `/VendorPayments(PaymentId='${paymentId}')`,
          updates
        )
        const updatedPayment = this.mapDynamicsPaymentToPayment(response)

        return {
          success: true,
          data: updatedPayment,
          externalId: response.PaymentId,
        }
      } else {
        // Business Central payments are typically immutable once posted
        // Return the existing payment
        const existingPayment = await this.getPayment(paymentId)
        if (!existingPayment) {
          throw new Error('Payment not found')
        }

        return {
          success: true,
          data: existingPayment,
          externalId: paymentId,
          warnings: ['Business Central payments cannot be updated after posting'],
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to update payment: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  async getPayment(paymentId: string): Promise<Payment | null> {
    try {
      await this.refreshTokenIfNeeded()

      if (this.dynamicsConfig.dynamicsSystem === 'finance_operations') {
        const response = await this.makeRequest<DynamicsPayment>(
          'GET',
          `/VendorPayments(PaymentId='${paymentId}')`
        )
        return this.mapDynamicsPaymentToPayment(response)
      } else {
        const response = await this.makeRequest<BCPayment>('GET', `/vendorPayments(${paymentId})`)
        return this.mapBCPaymentToPayment(response)
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
    await this.refreshTokenIfNeeded()

    if (this.dynamicsConfig.dynamicsSystem === 'finance_operations') {
      return this.getPaymentsFinanceOps(filters)
    } else {
      return this.getPaymentsBusinessCentral(filters)
    }
  }

  private async getPaymentsFinanceOps(filters?: {
    vendorId?: string
    status?: Payment['status'][]
    dateFrom?: Date
    dateTo?: Date
    limit?: number
  }): Promise<Payment[]> {
    let query = '/VendorPayments?$select=PaymentId,VendorAccountNumber,PaymentAmount,CurrencyCode,PaymentDate,PaymentMethod,PaymentStatus,PaymentReference,BankAccountId,TransactionId'

    const filterConditions: string[] = []

    if (filters?.vendorId) {
      filterConditions.push(`VendorAccountNumber eq '${filters.vendorId}'`)
    }

    if (filters?.status && filters.status.length > 0) {
      const statusFilters = filters.status.map(s => this.mapPaymentStatusToDynamics(s))
      filterConditions.push(`(${statusFilters.map(s => `PaymentStatus eq '${s}'`).join(' or ')})`)
    }

    if (filters?.dateFrom) {
      filterConditions.push(`PaymentDate ge ${filters.dateFrom.toISOString()}`)
    }

    if (filters?.dateTo) {
      filterConditions.push(`PaymentDate le ${filters.dateTo.toISOString()}`)
    }

    if (filterConditions.length > 0) {
      query += `&$filter=${filterConditions.join(' and ')}`
    }

    if (filters?.limit) {
      query += `&$top=${filters.limit}`
    }

    const response = await this.makeRequest<{ value: DynamicsPayment[] }>('GET', query)
    return response.value.map(p => this.mapDynamicsPaymentToPayment(p))
  }

  private async getPaymentsBusinessCentral(filters?: {
    vendorId?: string
    status?: Payment['status'][]
    dateFrom?: Date
    dateTo?: Date
    limit?: number
  }): Promise<Payment[]> {
    let query = '/vendorPayments?$select=id,vendorNumber,postingDate,amount,currencyCode,description,externalDocumentNumber'

    const filterConditions: string[] = []

    if (filters?.vendorId) {
      filterConditions.push(`vendorNumber eq '${filters.vendorId}'`)
    }

    if (filters?.dateFrom) {
      filterConditions.push(`postingDate ge ${filters.dateFrom.toISOString()}`)
    }

    if (filters?.dateTo) {
      filterConditions.push(`postingDate le ${filters.dateTo.toISOString()}`)
    }

    if (filterConditions.length > 0) {
      query += `&$filter=${filterConditions.join(' and ')}`
    }

    if (filters?.limit) {
      query += `&$top=${filters.limit}`
    }

    const response = await this.makeRequest<{ value: BCPayment[] }>('GET', query)
    return response.value.map(p => this.mapBCPaymentToPayment(p))
  }

  // ============================================================================
  // JOURNAL ENTRY METHODS
  // ============================================================================

  async createJournalEntry(entry: Partial<JournalEntry>): Promise<SyncResult<JournalEntry>> {
    try {
      await this.refreshTokenIfNeeded()

      if (this.dynamicsConfig.dynamicsSystem === 'finance_operations') {
        // Create journal batch first
        const batchNumber = `GRAIN_${Date.now()}`
        const journalEntry: Partial<DynamicsJournalEntry> = {
          JournalBatchNumber: batchNumber,
          JournalName: 'General',
          Description: entry.description || '',
          PostingDate: entry.date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
          JournalType: 'General',
        }

        const journalResponse = await this.makeRequest<DynamicsJournalEntry>(
          'POST',
          '/GeneralJournalEntries',
          journalEntry
        )

        // Create journal lines
        if (entry.lines && entry.lines.length > 0) {
          await Promise.all(
            entry.lines.map(async (line, index) => {
              const journalLine: Partial<DynamicsJournalLine> = {
                LineNumber: index + 1,
                AccountDisplayValue: line.accountId,
                AccountName: line.accountName,
                DebitAmount: line.debit,
                CreditAmount: line.credit,
                Text: line.memo,
                Dimension: line.costCenter,
              }

              await this.makeRequest<DynamicsJournalLine>(
                'POST',
                `/GeneralJournalEntries(JournalBatchNumber='${batchNumber}')/Lines`,
                journalLine
              )
            })
          )
        }

        const createdEntry: JournalEntry = {
          id: batchNumber,
          externalId: journalResponse.JournalBatchNumber,
          date: new Date(journalResponse.PostingDate),
          description: journalResponse.Description,
          lines: entry.lines || [],
          status: 'draft',
          reference: entry.reference,
          metadata: entry.metadata,
        }

        return {
          success: true,
          data: createdEntry,
          externalId: journalResponse.JournalBatchNumber,
        }
      } else {
        // Business Central journal entries
        const bcJournalEntry = {
          postingDate: entry.date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
          documentNumber: entry.reference || `GRAIN_${Date.now()}`,
          description: entry.description,
        }

        const response = await this.makeRequest<any>('POST', '/generalJournalLines', bcJournalEntry)

        const createdEntry: JournalEntry = {
          id: response.id,
          externalId: response.id,
          date: new Date(response.postingDate),
          description: response.description,
          lines: entry.lines || [],
          status: 'draft',
          reference: response.documentNumber,
          metadata: entry.metadata,
        }

        return {
          success: true,
          data: createdEntry,
          externalId: response.id,
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create journal entry: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  // ============================================================================
  // GL ACCOUNT & COST CENTER METHODS
  // ============================================================================

  async getGLAccounts(): Promise<GLAccount[]> {
    await this.refreshTokenIfNeeded()

    if (this.dynamicsConfig.dynamicsSystem === 'finance_operations') {
      const query = '/MainAccounts?$select=MainAccountId,Name,MainAccountCategory,CurrencyCode,IsBlocked,ParentMainAccountId'
      const response = await this.makeRequest<{ value: DynamicsGLAccount[] }>('GET', query)

      return response.value.map(account => ({
        id: account.MainAccountId,
        code: account.MainAccountId,
        name: account.Name,
        type: this.mapAccountCategoryToType(account.MainAccountCategory),
        currency: account.CurrencyCode,
        isActive: !account.IsBlocked,
        parentId: account.ParentMainAccountId,
      }))
    } else {
      const query = '/accounts?$select=id,number,displayName,category,blocked'
      const response = await this.makeRequest<{ value: any[] }>('GET', query)

      return response.value.map(account => ({
        id: account.id,
        code: account.number,
        name: account.displayName,
        type: this.mapAccountCategoryToType(account.category),
        isActive: account.blocked !== 'All',
      }))
    }
  }

  async getCostCenters(): Promise<CostCenter[]> {
    await this.refreshTokenIfNeeded()

    if (this.dynamicsConfig.dynamicsSystem === 'finance_operations') {
      // In F&O, cost centers are typically part of Financial Dimensions
      const query = '/FinancialDimensions?$filter=DimensionName eq \'CostCenter\'&$select=DimensionValue,DimensionValueName,IsBlocked,ParentDimensionValue'
      const response = await this.makeRequest<{ value: DynamicsDimension[] }>('GET', query)

      return response.value.map(dimension => ({
        id: dimension.DimensionValue,
        code: dimension.DimensionValue,
        name: dimension.DimensionValueName,
        isActive: !dimension.IsBlocked,
        parentId: dimension.ParentDimensionValue,
      }))
    } else {
      // Business Central dimensions
      const query = '/dimensions?$filter=code eq \'DEPARTMENT\' or code eq \'COSTCENTER\'&$expand=dimensionValues'
      const response = await this.makeRequest<{ value: any[] }>('GET', query)

      const costCenters: CostCenter[] = []
      response.value.forEach(dimension => {
        if (dimension.dimensionValues) {
          dimension.dimensionValues.forEach((dimValue: any) => {
            costCenters.push({
              id: dimValue.id,
              code: dimValue.code,
              name: dimValue.displayName,
              isActive: !dimValue.blocked,
            })
          })
        }
      })

      return costCenters
    }
  }

  // ============================================================================
  // MAPPING HELPER METHODS
  // ============================================================================

  private mapDynamicsVendorToVendor(dv: DynamicsVendor): Vendor {
    return {
      id: dv.VendorAccountNumber,
      externalId: dv.VendorAccountNumber,
      name: dv.VendorOrganizationName,
      email: dv.PrimaryContactEmail,
      phone: dv.PrimaryContactPhone,
      taxId: dv.TaxRegistrationNumber,
      currency: dv.CurrencyCode,
      paymentTerms: dv.PaymentTermsId,
      bankAccount: dv.BankAccountNumber ? {
        bankName: '',
        accountNumber: dv.BankAccountNumber,
        routingNumber: dv.BankRoutingNumber || '',
        swiftCode: dv.BankSWIFTCode,
        iban: dv.BankIBAN,
      } : undefined,
    }
  }

  private mapBCVendorToVendor(bcv: BCVendor): Vendor {
    return {
      id: bcv.id,
      externalId: bcv.number,
      name: bcv.displayName,
      email: bcv.email,
      phone: bcv.phoneNumber,
      taxId: bcv.taxRegistrationNumber,
      currency: bcv.currencyCode,
      paymentTerms: bcv.paymentTermsId,
    }
  }

  private mapDynamicsInvoiceToInvoice(di: DynamicsInvoice, lines: DynamicsInvoiceLine[]): Invoice {
    return {
      id: di.InvoiceId,
      externalId: di.InvoiceId,
      vendorId: di.VendorAccountNumber,
      vendorName: di.VendorName,
      amount: di.InvoiceAmount,
      currency: di.CurrencyCode,
      dueDate: new Date(di.DueDate),
      invoiceDate: new Date(di.InvoiceDate),
      status: this.mapDynamicsStatusToStatus(di.InvoiceStatus),
      lineItems: lines.map(line => ({
        id: `${di.InvoiceId}-${line.LineNumber}`,
        description: line.ProductDescription,
        quantity: line.Quantity,
        unitPrice: line.UnitPrice,
        amount: line.LineAmount,
        glAccount: line.LedgerDimensionDisplayValue,
        costCenter: line.DefaultDimension,
        taxCode: line.TaxItemGroup,
      })),
      poNumber: di.PurchaseOrderNumber,
      description: di.Description,
    }
  }

  private mapBCInvoiceToInvoice(bci: BCInvoice): Invoice {
    return {
      id: bci.id,
      externalId: bci.number,
      vendorId: bci.vendorNumber,
      vendorName: bci.vendorName,
      amount: bci.amount,
      currency: bci.currencyCode,
      dueDate: new Date(bci.dueDate),
      invoiceDate: new Date(bci.invoiceDate),
      status: this.mapDynamicsStatusToStatus(bci.status),
      lineItems: [],  // Line items would need separate API call
      poNumber: bci.purchaseOrderNumber,
    }
  }

  private mapDynamicsPaymentToPayment(dp: DynamicsPayment): Payment {
    return {
      id: dp.PaymentId,
      externalId: dp.PaymentId,
      invoiceId: '',  // Would need to be looked up from payment application
      vendorId: dp.VendorAccountNumber,
      amount: dp.PaymentAmount,
      currency: dp.CurrencyCode,
      paymentDate: new Date(dp.PaymentDate),
      paymentMethod: this.mapDynamicsPaymentMethodToMethod(dp.PaymentMethod),
      grainTransactionId: dp.TransactionId,
      status: this.mapDynamicsPaymentStatusToStatus(dp.PaymentStatus),
      bankAccount: dp.BankAccountId,
      reference: dp.PaymentReference,
    }
  }

  private mapBCPaymentToPayment(bcp: BCPayment): Payment {
    return {
      id: bcp.id,
      externalId: bcp.id,
      invoiceId: '',  // Would need to be looked up
      vendorId: bcp.vendorNumber,
      amount: bcp.amount,
      currency: bcp.currencyCode,
      paymentDate: new Date(bcp.postingDate),
      paymentMethod: 'wire',  // BC doesn't explicitly store this
      grainTransactionId: bcp.externalDocumentNumber,
      status: 'completed',  // Posted payments are completed
      reference: bcp.description,
    }
  }

  private mapStatusToDynamics(status: Invoice['status']): string {
    const statusMap: Record<Invoice['status'], string> = {
      'open': 'Open',
      'partial': 'PartiallyPaid',
      'paid': 'Paid',
      'cancelled': 'Cancelled',
      'disputed': 'OnHold',
    }
    return statusMap[status] || 'Open'
  }

  private mapDynamicsStatusToStatus(dynamicsStatus: string): Invoice['status'] {
    const statusMap: Record<string, Invoice['status']> = {
      'Open': 'open',
      'PartiallyPaid': 'partial',
      'Paid': 'paid',
      'Cancelled': 'cancelled',
      'OnHold': 'disputed',
    }
    return statusMap[dynamicsStatus] || 'open'
  }

  private mapPaymentMethodToDynamics(method: Payment['paymentMethod']): string {
    const methodMap: Record<Payment['paymentMethod'], string> = {
      'grain': 'Electronic',
      'wire': 'Wire',
      'ach': 'ACH',
      'check': 'Check',
    }
    return methodMap[method] || 'Electronic'
  }

  private mapDynamicsPaymentMethodToMethod(dynamicsMethod: string): Payment['paymentMethod'] {
    const methodMap: Record<string, Payment['paymentMethod']> = {
      'Electronic': 'grain',
      'Wire': 'wire',
      'ACH': 'ach',
      'Check': 'check',
    }
    return methodMap[dynamicsMethod] || 'wire'
  }

  private mapPaymentStatusToDynamics(status: Payment['status']): string {
    const statusMap: Record<Payment['status'], string> = {
      'pending': 'Pending',
      'processing': 'Processing',
      'completed': 'Posted',
      'failed': 'Failed',
      'reversed': 'Reversed',
    }
    return statusMap[status] || 'Pending'
  }

  private mapDynamicsPaymentStatusToStatus(dynamicsStatus: string): Payment['status'] {
    const statusMap: Record<string, Payment['status']> = {
      'Pending': 'pending',
      'Processing': 'processing',
      'Posted': 'completed',
      'Failed': 'failed',
      'Reversed': 'reversed',
    }
    return statusMap[dynamicsStatus] || 'pending'
  }

  private mapAccountCategoryToType(category: string): GLAccount['type'] {
    const categoryMap: Record<string, GLAccount['type']> = {
      'Asset': 'asset',
      'Liability': 'liability',
      'Equity': 'equity',
      'Revenue': 'revenue',
      'Expense': 'expense',
      'Income': 'revenue',
      'Cost': 'expense',
    }
    return categoryMap[category] || 'asset'
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createDynamics365Adapter(config: Dynamics365Config): Dynamics365Adapter {
  return new Dynamics365Adapter(config)
}

export default Dynamics365Adapter
