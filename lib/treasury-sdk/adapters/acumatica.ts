// @ts-nocheck
/**
 * Acumatica ERP Adapter for Grain & Vault Treasury SDK
 *
 * Implements integration with Acumatica Cloud ERP using:
 * - REST API with OAuth 2.0 authentication
 * - Contract-Based API (OData v4 compatible)
 * - Multi-company/multi-tenant support
 * - Real-time webhook notifications
 *
 * Acumatica API Documentation:
 * https://help.acumatica.com/api-reference
 *
 * Supports:
 * - Vendor management (CRUD operations)
 * - Bill/Invoice retrieval
 * - Payment creation and sync
 * - Journal entries for GRAIN transactions
 * - GL account and subaccount mapping
 * - Multi-company scenarios
 */

import * as crypto from 'crypto'
import {
  BaseERPAdapter,
  ERPConnectionConfig,
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
// ACUMATICA-SPECIFIC TYPES
// ============================================================================

export interface AcumaticaConfig extends ERPConnectionConfig {
  instanceUrl: string               // Acumatica instance URL (e.g., https://company.acumatica.com)
  clientId: string                  // OAuth 2.0 client ID
  clientSecret: string              // OAuth 2.0 client secret
  username?: string                 // For resource owner password flow
  password?: string                 // For resource owner password flow
  companyName?: string              // Company name (for multi-tenant)
  branch?: string                   // Branch ID for multi-branch
  locale?: string                   // Locale (default: en-US)
  apiVersion?: string               // API version (default: "22.200.001")
  scope?: string[]                  // OAuth scopes
  useOData?: boolean                // Use OData endpoints (default: true)
}

interface AcumaticaVendorRecord {
  id: string
  VendorID: { value: string }
  VendorName: { value: string }
  Status: { value: 'Active' | 'One-Time' | 'Hold' | 'Inactive' }
  VendorClass: { value: string }
  CurrencyID?: { value: string }
  Terms?: { value: string }
  TaxZone?: { value: string }
  PaymentMethod?: { value: string }
  CashAccount?: { value: string }
  MainContact?: {
    Email?: { value: string }
    Phone1?: { value: string }
    Phone1Type?: { value: string }
    DisplayName?: { value: string }
  }
  RemitContact?: {
    Email?: { value: string }
    DisplayName?: { value: string }
    Address?: {
      AddressLine1?: { value: string }
      AddressLine2?: { value: string }
      City?: { value: string }
      State?: { value: string }
      PostalCode?: { value: string }
      Country?: { value: string }
    }
  }
  PaymentBy?: { value: 'Due Date' | 'Discount Date' }
  TaxRegistrationID?: { value: string }
  custom?: Record<string, any>
  LastModifiedDateTime?: { value: string }
}

interface AcumaticaBillRecord {
  id: string
  ReferenceNbr: { value: string }
  Type: { value: 'Bill' | 'Credit Adj.' | 'Debit Adj.' | 'Prepayment' | 'Quick Check' }
  Vendor: { value: string }
  VendorRef?: { value: string }
  Date: { value: string }
  DueDate: { value: string }
  PostPeriod?: { value: string }
  Amount: { value: number }
  Balance: { value: number }
  Status: { value: 'Hold' | 'Balanced' | 'Voided' | 'Open' | 'Closed' | 'Printed' | 'Pending Print' | 'Pending Email' | 'Reserved' | 'Rejected' | 'Pending Approval' | 'Released' | 'Prebooked' }
  CurrencyID?: { value: string }
  Description?: { value: string }
  BranchID?: { value: string }
  Details?: AcumaticaBillDetail[]
  TaxDetails?: AcumaticaTaxDetail[]
  Applications?: AcumaticaApplication[]
  LastModifiedDateTime?: { value: string }
}

interface AcumaticaBillDetail {
  id?: string
  BranchID?: { value: string }
  InventoryID?: { value: string }
  TransactionDescr?: { value: string }
  Qty?: { value: number }
  UOM?: { value: string }
  UnitCost?: { value: number }
  Amount: { value: number }
  Account?: { value: string }
  AccountDescription?: { value: string }
  Subaccount?: { value: string }
  Project?: { value: string }
  ProjectTask?: { value: string }
  CostCode?: { value: string }
  POOrderNbr?: { value: string }
  POOrderType?: { value: string }
}

interface AcumaticaTaxDetail {
  TaxID?: { value: string }
  TaxRate?: { value: number }
  TaxableAmount?: { value: number }
  TaxAmount?: { value: number }
}

interface AcumaticaApplication {
  DocType?: { value: string }
  ReferenceNbr?: { value: string }
  AmountPaid?: { value: number }
  Balance?: { value: number }
  Status?: { value: string }
}

interface AcumaticaCheckRecord {
  id: string
  ReferenceNbr: { value: string }
  Type: { value: 'Check' | 'Void Check' | 'Prepayment' | 'DebitAdj' }
  Vendor: { value: string }
  PaymentDate: { value: string }
  PaymentAmount: { value: number }
  CurrencyID?: { value: string }
  Status: { value: 'Hold' | 'Balanced' | 'Pending Processing' | 'Assigned' | 'Released' | 'Printed' | 'Voided' | 'Pending Approval' | 'Rejected' }
  CashAccount?: { value: string }
  PaymentMethod?: { value: string }
  PaymentRef?: { value: string }
  Description?: { value: string }
  BranchID?: { value: string }
  DocumentsToApply?: AcumaticaPaymentApplication[]
  LastModifiedDateTime?: { value: string }
}

interface AcumaticaPaymentApplication {
  DocType?: { value: string }
  ReferenceNbr: { value: string }
  AmountPaid: { value: number }
  Balance?: { value: number }
}

interface AcumaticaGLBatch {
  id: string
  BatchNbr: { value: string }
  Module: { value: string }
  DateEntered: { value: string }
  FinPeriodID: { value: string }
  PostPeriod?: { value: string }
  Status: { value: 'Hold' | 'Balanced' | 'Unposted' | 'Posted' | 'Voided' | 'Released' | 'Scheduled' }
  Description?: { value: string }
  CuryDebitTotal?: { value: number }
  CuryCreditTotal?: { value: number }
  BranchID?: { value: string }
  Details?: AcumaticaGLDetail[]
  LastModifiedDateTime?: { value: string }
}

interface AcumaticaGLDetail {
  BranchID?: { value: string }
  Account: { value: string }
  Subaccount?: { value: string }
  ReferenceNbr?: { value: string }
  TransactionDescription?: { value: string }
  DebitAmount?: { value: number }
  CreditAmount?: { value: number }
  Project?: { value: string }
  ProjectTask?: { value: string }
}

interface AcumaticaAccount {
  id: string
  AccountCD: { value: string }
  AccountClass: { value: string }
  Description: { value: string }
  Type: { value: 'Asset' | 'Liability' | 'Income' | 'Expense' | 'Equity' }
  Active: { value: boolean }
  CashAccount?: { value: boolean }
  CuryID?: { value: string }
  PostOption?: { value: string }
  LastModifiedDateTime?: { value: string }
}

interface AcumaticaSubaccount {
  id: string
  SubaccountCD: { value: string }
  Description: { value: string }
  Active: { value: boolean }
  Secured?: { value: boolean }
  LastModifiedDateTime?: { value: string }
}

interface AcumaticaBranch {
  id: string
  BranchID: { value: string }
  BranchName: { value: string }
  Active: { value: boolean }
  Company?: { value: string }
  DefaultCurrencyID?: { value: string }
  LastModifiedDateTime?: { value: string }
}

interface AcumaticaOAuthToken {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope?: string
}

interface AcumaticaErrorResponse {
  message?: string
  exceptionMessage?: string
  exceptionType?: string
  stackTrace?: string
  innerException?: AcumaticaErrorResponse
}

// ============================================================================
// ACUMATICA ADAPTER CLASS
// ============================================================================

export class AcumaticaAdapter extends BaseERPAdapter {
  private acumaticaConfig: AcumaticaConfig
  private baseApiUrl: string
  private refreshToken?: string

  constructor(config: AcumaticaConfig) {
    super(config)
    this.acumaticaConfig = config

    // Build base API URL
    const instanceUrl = config.instanceUrl.replace(/\/$/, '')
    const apiVersion = config.apiVersion || '22.200.001'
    this.baseApiUrl = `${instanceUrl}/entity/Default/${apiVersion}`

    // Override default GL mappings for Acumatica
    this.glMappings = {
      'payment': '20000',            // Accounts Payable
      'receipt': '10100',            // Cash - Operating
      'credit_draw': '22000',        // Credit Line Payable
      'credit_repay': '22000',       // Credit Line Payable
      'grain_appreciation': '41000', // Other Income
      'grain_reserve': '11000',      // GRAIN Reserve Asset
    }
  }

  // ============================================================================
  // CONNECTION METHODS
  // ============================================================================

  async connect(): Promise<void> {
    try {
      const tokens = await this.getOAuthToken()

      this.accessToken = tokens.access_token
      this.tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000)
      this.refreshToken = tokens.refresh_token

      // Verify connection by fetching company info
      await this.verifyConnection()

      this.connectionStatus = 'connected'
      console.log(`Connected to Acumatica: ${this.acumaticaConfig.instanceUrl}`)
    } catch (error) {
      this.connectionStatus = 'error'
      throw new Error(`Failed to connect to Acumatica: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async disconnect(): Promise<void> {
    try {
      // Revoke token if needed
      if (this.accessToken) {
        const logoutUrl = `${this.acumaticaConfig.instanceUrl}/entity/auth/logout`
        await fetch(logoutUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }).catch(() => {})  // Ignore logout errors
      }
    } finally {
      this.accessToken = undefined
      this.tokenExpiry = undefined
      this.refreshToken = undefined
      this.connectionStatus = 'disconnected'
      console.log('Disconnected from Acumatica')
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.verifyConnection()
      return true
    } catch (error) {
      console.error('Acumatica connection test failed:', error)
      return false
    }
  }

  private async getOAuthToken(): Promise<AcumaticaOAuthToken> {
    const tokenUrl = `${this.acumaticaConfig.instanceUrl}/identity/connect/token`

    const params = new URLSearchParams()
    params.append('client_id', this.acumaticaConfig.clientId)
    params.append('client_secret', this.acumaticaConfig.clientSecret)

    // Use resource owner password flow if credentials provided
    if (this.acumaticaConfig.username && this.acumaticaConfig.password) {
      params.append('grant_type', 'password')
      params.append('username', this.acumaticaConfig.username)
      params.append('password', this.acumaticaConfig.password)
      if (this.acumaticaConfig.companyName) {
        params.append('company', this.acumaticaConfig.companyName)
      }
      if (this.acumaticaConfig.branch) {
        params.append('branch', this.acumaticaConfig.branch)
      }
      if (this.acumaticaConfig.locale) {
        params.append('locale', this.acumaticaConfig.locale)
      }
    } else if (this.refreshToken) {
      // Use refresh token
      params.append('grant_type', 'refresh_token')
      params.append('refresh_token', this.refreshToken)
    } else {
      // Use client credentials flow
      params.append('grant_type', 'client_credentials')
    }

    const scopes = this.acumaticaConfig.scope || ['api']
    params.append('scope', scopes.join(' '))

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OAuth token error: ${error}`)
    }

    return response.json()
  }

  private async verifyConnection(): Promise<void> {
    // Try to fetch a small amount of data to verify connection
    const response = await this.makeAcumaticaRequest<any[]>(
      'GET',
      '/Vendor?$top=1'
    )
    // If we get here without error, connection is valid
  }

  // ============================================================================
  // VENDOR METHODS
  // ============================================================================

  async getVendors(filters?: { modifiedSince?: Date; limit?: number }): Promise<Vendor[]> {
    try {
      const limit = filters?.limit || 1000
      let endpoint = `/Vendor?$top=${limit}`

      const filterConditions: string[] = []

      if (filters?.modifiedSince) {
        const dateStr = filters.modifiedSince.toISOString()
        filterConditions.push(`LastModifiedDateTime gt ${dateStr}`)
      }

      // Only active vendors
      filterConditions.push("Status eq 'Active' or Status eq 'One-Time'")

      if (filterConditions.length > 0) {
        endpoint += `&$filter=${encodeURIComponent(filterConditions.join(' and '))}`
      }

      // Expand contacts
      endpoint += '&$expand=MainContact,RemitContact'

      const vendors = await this.makeAcumaticaRequest<AcumaticaVendorRecord[]>('GET', endpoint)
      return vendors.map(v => this.mapAcumaticaVendorToVendor(v))
    } catch (error) {
      throw new Error(`Failed to get vendors: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getVendor(vendorId: string): Promise<Vendor | null> {
    try {
      const vendor = await this.makeAcumaticaRequest<AcumaticaVendorRecord>(
        'GET',
        `/Vendor/${encodeURIComponent(vendorId)}?$expand=MainContact,RemitContact`
      )

      if (!vendor) {
        return null
      }

      return this.mapAcumaticaVendorToVendor(vendor)
    } catch (error) {
      if ((error as any).status === 404) {
        return null
      }
      throw new Error(`Failed to get vendor ${vendorId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async createVendor(vendor: Partial<Vendor>): Promise<SyncResult<Vendor>> {
    try {
      const vendorData: Partial<AcumaticaVendorRecord> = {
        VendorID: { value: vendor.externalId || this.generateVendorId(vendor.name || '') },
        VendorName: { value: vendor.name || '' },
        Status: { value: 'Active' },
        CurrencyID: { value: vendor.currency || 'USD' },
        Terms: vendor.paymentTerms ? { value: vendor.paymentTerms } : undefined,
        MainContact: {
          Email: vendor.email ? { value: vendor.email } : undefined,
          Phone1: vendor.phone ? { value: vendor.phone } : undefined,
          DisplayName: { value: vendor.name || '' }
        }
      }

      if (vendor.taxId) {
        vendorData.TaxRegistrationID = { value: vendor.taxId }
      }

      const response = await this.makeAcumaticaRequest<AcumaticaVendorRecord>(
        'PUT',
        '/Vendor',
        vendorData
      )

      return {
        success: true,
        data: this.mapAcumaticaVendorToVendor(response),
        externalId: response.VendorID.value
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create vendor: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  async updateVendor(vendorId: string, updates: Partial<Vendor>): Promise<SyncResult<Vendor>> {
    try {
      const updateData: Partial<AcumaticaVendorRecord> = {
        VendorID: { value: vendorId }
      }

      if (updates.name) updateData.VendorName = { value: updates.name }
      if (updates.email || updates.phone) {
        updateData.MainContact = {
          Email: updates.email ? { value: updates.email } : undefined,
          Phone1: updates.phone ? { value: updates.phone } : undefined
        }
      }
      if (updates.taxId) updateData.TaxRegistrationID = { value: updates.taxId }

      const response = await this.makeAcumaticaRequest<AcumaticaVendorRecord>(
        'PUT',
        '/Vendor',
        updateData
      )

      return {
        success: true,
        data: this.mapAcumaticaVendorToVendor(response),
        externalId: vendorId
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to update vendor: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  // ============================================================================
  // INVOICE / BILL METHODS
  // ============================================================================

  async getInvoices(filters?: {
    status?: Invoice['status'][]
    vendorId?: string
    dueBefore?: Date
    dueAfter?: Date
    modifiedSince?: Date
    limit?: number
  }): Promise<Invoice[]> {
    try {
      const limit = filters?.limit || 1000
      let endpoint = `/Bill?$top=${limit}`

      const filterConditions: string[] = []

      // Status filter
      if (filters?.status && filters.status.length > 0) {
        const statusMap: Record<Invoice['status'], string[]> = {
          'open': ['Open', 'Balanced', 'Pending Approval'],
          'partial': ['Open'], // Acumatica tracks partial via Balance field
          'paid': ['Closed'],
          'cancelled': ['Voided'],
          'disputed': ['Hold', 'Rejected']
        }
        const statuses = filters.status.flatMap(s => statusMap[s])
        const uniqueStatuses = [...new Set(statuses)]
        const statusFilter = uniqueStatuses.map(s => `Status eq '${s}'`).join(' or ')
        filterConditions.push(`(${statusFilter})`)
      }

      if (filters?.vendorId) {
        filterConditions.push(`Vendor eq '${filters.vendorId}'`)
      }

      if (filters?.dueBefore) {
        filterConditions.push(`DueDate le ${filters.dueBefore.toISOString().split('T')[0]}`)
      }

      if (filters?.dueAfter) {
        filterConditions.push(`DueDate ge ${filters.dueAfter.toISOString().split('T')[0]}`)
      }

      if (filters?.modifiedSince) {
        filterConditions.push(`LastModifiedDateTime gt ${filters.modifiedSince.toISOString()}`)
      }

      if (filterConditions.length > 0) {
        endpoint += `&$filter=${encodeURIComponent(filterConditions.join(' and '))}`
      }

      // Expand details
      endpoint += '&$expand=Details'

      const bills = await this.makeAcumaticaRequest<AcumaticaBillRecord[]>('GET', endpoint)
      return bills.map(bill => this.mapAcumaticaBillToInvoice(bill))
    } catch (error) {
      throw new Error(`Failed to get invoices: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    try {
      const bill = await this.makeAcumaticaRequest<AcumaticaBillRecord>(
        'GET',
        `/Bill/Bill/${encodeURIComponent(invoiceId)}?$expand=Details`
      )

      if (!bill) {
        return null
      }

      return this.mapAcumaticaBillToInvoice(bill)
    } catch (error) {
      if ((error as any).status === 404) {
        return null
      }
      throw new Error(`Failed to get invoice ${invoiceId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ============================================================================
  // PAYMENT METHODS
  // ============================================================================

  async createPayment(payment: Partial<Payment>): Promise<SyncResult<Payment>> {
    try {
      const paymentData: Partial<AcumaticaCheckRecord> = {
        Type: { value: 'Check' },
        Vendor: { value: payment.vendorId || '' },
        PaymentDate: { value: new Date(payment.paymentDate || new Date()).toISOString().split('T')[0] },
        PaymentAmount: { value: payment.amount || 0 },
        CurrencyID: { value: payment.currency || 'USD' },
        CashAccount: payment.bankAccount ? { value: payment.bankAccount } : undefined,
        PaymentMethod: { value: this.mapPaymentMethod(payment.paymentMethod) },
        Description: { value: payment.reference || `GRAIN Payment ${payment.grainTransactionId || ''}` },
        BranchID: this.acumaticaConfig.branch ? { value: this.acumaticaConfig.branch } : undefined
      }

      // Add bill application if invoice provided
      if (payment.invoiceId) {
        paymentData.DocumentsToApply = [{
          DocType: { value: 'Bill' },
          ReferenceNbr: { value: payment.invoiceId },
          AmountPaid: { value: payment.amount || 0 }
        }]
      }

      const response = await this.makeAcumaticaRequest<AcumaticaCheckRecord>(
        'PUT',
        '/Check',
        paymentData
      )

      const createdPayment: Payment = {
        id: crypto.randomUUID(),
        externalId: response.ReferenceNbr.value,
        invoiceId: payment.invoiceId || '',
        vendorId: payment.vendorId || '',
        amount: payment.amount || 0,
        currency: payment.currency || 'USD',
        paymentDate: payment.paymentDate || new Date(),
        paymentMethod: payment.paymentMethod || 'grain',
        grainTransactionId: payment.grainTransactionId,
        status: this.mapAcumaticaPaymentStatus(response.Status.value),
        bankAccount: payment.bankAccount,
        reference: payment.reference,
        metadata: {
          acumaticaId: response.id,
          referenceNbr: response.ReferenceNbr.value
        }
      }

      return {
        success: true,
        data: createdPayment,
        externalId: response.ReferenceNbr.value
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create payment: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  async syncPayment(payment: Payment): Promise<SyncResult<Payment>> {
    try {
      if (payment.externalId) {
        const existingPayment = await this.getPayment(payment.externalId)
        if (existingPayment) {
          return {
            success: true,
            data: existingPayment,
            externalId: payment.externalId
          }
        }
      }

      return this.createPayment(payment)
    } catch (error) {
      return {
        success: false,
        error: `Failed to sync payment: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  async getPayment(paymentId: string): Promise<Payment | null> {
    try {
      const check = await this.makeAcumaticaRequest<AcumaticaCheckRecord>(
        'GET',
        `/Check/Check/${encodeURIComponent(paymentId)}?$expand=DocumentsToApply`
      )

      if (!check) {
        return null
      }

      return this.mapAcumaticaCheckToPayment(check)
    } catch (error) {
      if ((error as any).status === 404) {
        return null
      }
      throw new Error(`Failed to get payment ${paymentId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getPayments(filters?: {
    vendorId?: string
    status?: Payment['status'][]
    dateFrom?: Date
    dateTo?: Date
    limit?: number
  }): Promise<Payment[]> {
    try {
      const limit = filters?.limit || 1000
      let endpoint = `/Check?$top=${limit}`

      const filterConditions: string[] = []

      if (filters?.vendorId) {
        filterConditions.push(`Vendor eq '${filters.vendorId}'`)
      }

      if (filters?.dateFrom) {
        filterConditions.push(`PaymentDate ge ${filters.dateFrom.toISOString().split('T')[0]}`)
      }

      if (filters?.dateTo) {
        filterConditions.push(`PaymentDate le ${filters.dateTo.toISOString().split('T')[0]}`)
      }

      if (filterConditions.length > 0) {
        endpoint += `&$filter=${encodeURIComponent(filterConditions.join(' and '))}`
      }

      endpoint += '&$expand=DocumentsToApply'

      const checks = await this.makeAcumaticaRequest<AcumaticaCheckRecord[]>('GET', endpoint)
      return checks.map(check => this.mapAcumaticaCheckToPayment(check))
    } catch (error) {
      throw new Error(`Failed to get payments: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ============================================================================
  // JOURNAL ENTRY METHODS
  // ============================================================================

  async createJournalEntry(entry: Partial<JournalEntry>): Promise<SyncResult<JournalEntry>> {
    try {
      const details = entry.lines?.map(line => ({
        Account: { value: line.accountId },
        Subaccount: line.costCenter ? { value: line.costCenter } : undefined,
        DebitAmount: line.debit > 0 ? { value: line.debit } : undefined,
        CreditAmount: line.credit > 0 ? { value: line.credit } : undefined,
        TransactionDescription: { value: line.memo || '' },
        BranchID: this.acumaticaConfig.branch ? { value: this.acumaticaConfig.branch } : undefined
      }))

      const batchData: Partial<AcumaticaGLBatch> = {
        Module: { value: 'GL' },
        DateEntered: { value: new Date(entry.date || new Date()).toISOString().split('T')[0] },
        FinPeriodID: { value: this.getCurrentFinPeriod() },
        Description: { value: entry.description || 'GRAIN Transaction' },
        BranchID: this.acumaticaConfig.branch ? { value: this.acumaticaConfig.branch } : undefined,
        Details: details
      }

      const response = await this.makeAcumaticaRequest<AcumaticaGLBatch>(
        'PUT',
        '/JournalTransaction',
        batchData
      )

      const createdEntry: JournalEntry = {
        id: crypto.randomUUID(),
        externalId: response.BatchNbr.value,
        date: entry.date || new Date(),
        description: entry.description || '',
        lines: entry.lines || [],
        status: this.mapAcumaticaGLStatus(response.Status.value),
        reference: entry.reference,
        metadata: {
          acumaticaId: response.id,
          batchNbr: response.BatchNbr.value
        }
      }

      return {
        success: true,
        data: createdEntry,
        externalId: response.BatchNbr.value
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create journal entry: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  // ============================================================================
  // GL ACCOUNT & COST CENTER METHODS
  // ============================================================================

  async getGLAccounts(): Promise<GLAccount[]> {
    try {
      const accounts = await this.makeAcumaticaRequest<AcumaticaAccount[]>(
        'GET',
        '/Account?$filter=Active eq true&$top=1000'
      )

      return accounts.map(acct => ({
        id: acct.id,
        code: acct.AccountCD.value,
        name: acct.Description?.value || acct.AccountCD.value,
        type: this.mapAcumaticaAccountType(acct.Type.value),
        currency: acct.CuryID?.value,
        isActive: acct.Active.value,
        parentId: undefined
      }))
    } catch (error) {
      throw new Error(`Failed to get GL accounts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getCostCenters(): Promise<CostCenter[]> {
    try {
      // Acumatica uses Subaccounts for cost center tracking
      const subaccounts = await this.makeAcumaticaRequest<AcumaticaSubaccount[]>(
        'GET',
        '/Subaccount?$filter=Active eq true&$top=1000'
      )

      return subaccounts.map(sub => ({
        id: sub.id,
        code: sub.SubaccountCD.value,
        name: sub.Description?.value || sub.SubaccountCD.value,
        isActive: sub.Active.value,
        parentId: undefined
      }))
    } catch (error) {
      throw new Error(`Failed to get cost centers: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ============================================================================
  // MULTI-COMPANY SUPPORT
  // ============================================================================

  /**
   * Get list of branches (for multi-company scenarios)
   */
  async getBranches(): Promise<Array<{ id: string; branchId: string; name: string; currency: string }>> {
    try {
      const branches = await this.makeAcumaticaRequest<AcumaticaBranch[]>(
        'GET',
        '/Branch?$filter=Active eq true'
      )

      return branches.map(b => ({
        id: b.id,
        branchId: b.BranchID.value,
        name: b.BranchName.value,
        currency: b.DefaultCurrencyID?.value || 'USD'
      }))
    } catch (error) {
      console.warn('Failed to get branches:', error)
      return []
    }
  }

  /**
   * Switch context to a different branch
   */
  setBranch(branchId: string): void {
    this.acumaticaConfig.branch = branchId
  }

  // ============================================================================
  // API REQUEST METHODS
  // ============================================================================

  private async makeAcumaticaRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    // Refresh token if needed
    if (this.tokenExpiry && new Date() >= this.tokenExpiry) {
      await this.connect()
    }

    const url = `${this.baseApiUrl}${path}`

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/json'
    }

    if (body) {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    })

    if (!response.ok) {
      let errorMessage = `Acumatica API Error: ${response.status}`
      try {
        const errorBody: AcumaticaErrorResponse = await response.json()
        errorMessage = errorBody.message || errorBody.exceptionMessage || errorMessage
      } catch {
        // Ignore JSON parse errors
      }
      const error = new Error(errorMessage)
      ;(error as any).status = response.status
      throw error
    }

    // Handle empty response
    const text = await response.text()
    if (!text) {
      return [] as unknown as T
    }

    return JSON.parse(text)
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private generateVendorId(name: string): string {
    const base = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
    const suffix = Date.now().toString().slice(-5)
    return `${base}${suffix}`
  }

  private mapPaymentMethod(method?: string): string {
    const methodMap: Record<string, string> = {
      'grain': 'EFT',
      'wire': 'WIRE',
      'ach': 'ACH',
      'check': 'CHECK'
    }
    return methodMap[method || 'grain'] || 'EFT'
  }

  private getCurrentFinPeriod(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `${month}${year}`
  }

  private mapAcumaticaAccountType(acumaticaType: string): GLAccount['type'] {
    const typeMap: Record<string, GLAccount['type']> = {
      'Asset': 'asset',
      'Liability': 'liability',
      'Income': 'revenue',
      'Expense': 'expense',
      'Equity': 'equity'
    }
    return typeMap[acumaticaType] || 'asset'
  }

  private mapAcumaticaPaymentStatus(status: string): Payment['status'] {
    const statusMap: Record<string, Payment['status']> = {
      'Hold': 'pending',
      'Balanced': 'pending',
      'Pending Processing': 'processing',
      'Assigned': 'processing',
      'Released': 'completed',
      'Printed': 'completed',
      'Voided': 'reversed',
      'Pending Approval': 'pending',
      'Rejected': 'failed'
    }
    return statusMap[status] || 'pending'
  }

  private mapAcumaticaGLStatus(status: string): JournalEntry['status'] {
    const statusMap: Record<string, JournalEntry['status']> = {
      'Hold': 'draft',
      'Balanced': 'draft',
      'Unposted': 'draft',
      'Posted': 'posted',
      'Voided': 'reversed',
      'Released': 'posted',
      'Scheduled': 'draft'
    }
    return statusMap[status] || 'draft'
  }

  private mapAcumaticaVendorToVendor(acumaticaVendor: AcumaticaVendorRecord): Vendor {
    return {
      id: crypto.randomUUID(),
      externalId: acumaticaVendor.VendorID.value,
      name: acumaticaVendor.VendorName?.value || '',
      email: acumaticaVendor.MainContact?.Email?.value,
      phone: acumaticaVendor.MainContact?.Phone1?.value,
      taxId: acumaticaVendor.TaxRegistrationID?.value,
      currency: acumaticaVendor.CurrencyID?.value || 'USD',
      paymentTerms: acumaticaVendor.Terms?.value,
      metadata: {
        acumaticaId: acumaticaVendor.id,
        vendorId: acumaticaVendor.VendorID.value,
        vendorClass: acumaticaVendor.VendorClass?.value,
        status: acumaticaVendor.Status?.value,
        paymentMethod: acumaticaVendor.PaymentMethod?.value
      }
    }
  }

  private mapAcumaticaBillToInvoice(acumaticaBill: AcumaticaBillRecord): Invoice {
    const statusMap: Record<string, Invoice['status']> = {
      'Hold': 'disputed',
      'Balanced': 'open',
      'Open': 'open',
      'Closed': 'paid',
      'Voided': 'cancelled',
      'Pending Approval': 'open',
      'Rejected': 'disputed',
      'Released': 'open'
    }

    // Check if partially paid based on balance
    let status = statusMap[acumaticaBill.Status.value] || 'open'
    if (status === 'open' && acumaticaBill.Balance.value < acumaticaBill.Amount.value && acumaticaBill.Balance.value > 0) {
      status = 'partial'
    }

    const lineItems: InvoiceLineItem[] = (acumaticaBill.Details || []).map((detail, index) => ({
      id: detail.id || `line-${index}`,
      description: detail.TransactionDescr?.value || detail.InventoryID?.value || '',
      quantity: detail.Qty?.value || 1,
      unitPrice: detail.UnitCost?.value || detail.Amount.value,
      amount: detail.Amount.value,
      glAccount: detail.Account?.value,
      costCenter: detail.Subaccount?.value
    }))

    return {
      id: crypto.randomUUID(),
      externalId: acumaticaBill.ReferenceNbr.value,
      vendorId: acumaticaBill.Vendor.value,
      vendorName: acumaticaBill.Vendor.value,  // Vendor name not directly available
      amount: acumaticaBill.Amount.value,
      currency: acumaticaBill.CurrencyID?.value || 'USD',
      dueDate: new Date(acumaticaBill.DueDate.value),
      invoiceDate: new Date(acumaticaBill.Date.value),
      status,
      lineItems,
      description: acumaticaBill.Description?.value,
      costCenter: acumaticaBill.BranchID?.value,
      poNumber: acumaticaBill.VendorRef?.value,
      metadata: {
        acumaticaId: acumaticaBill.id,
        referenceNbr: acumaticaBill.ReferenceNbr.value,
        type: acumaticaBill.Type.value,
        balance: acumaticaBill.Balance.value,
        postPeriod: acumaticaBill.PostPeriod?.value,
        branchId: acumaticaBill.BranchID?.value
      }
    }
  }

  private mapAcumaticaCheckToPayment(acumaticaCheck: AcumaticaCheckRecord): Payment {
    // Get first applied invoice if available
    const firstApplication = acumaticaCheck.DocumentsToApply?.[0]

    return {
      id: crypto.randomUUID(),
      externalId: acumaticaCheck.ReferenceNbr.value,
      invoiceId: firstApplication?.ReferenceNbr?.value || '',
      vendorId: acumaticaCheck.Vendor.value,
      amount: acumaticaCheck.PaymentAmount.value,
      currency: acumaticaCheck.CurrencyID?.value || 'USD',
      paymentDate: new Date(acumaticaCheck.PaymentDate.value),
      paymentMethod: 'grain',
      status: this.mapAcumaticaPaymentStatus(acumaticaCheck.Status.value),
      bankAccount: acumaticaCheck.CashAccount?.value,
      reference: acumaticaCheck.PaymentRef?.value || acumaticaCheck.Description?.value,
      metadata: {
        acumaticaId: acumaticaCheck.id,
        referenceNbr: acumaticaCheck.ReferenceNbr.value,
        type: acumaticaCheck.Type.value,
        paymentMethod: acumaticaCheck.PaymentMethod?.value,
        branchId: acumaticaCheck.BranchID?.value
      }
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new Acumatica adapter instance
 *
 * @example
 * ```typescript
 * import { createAcumaticaAdapter } from '@grainandvault/treasury-sdk/adapters/acumatica'
 *
 * const acumatica = createAcumaticaAdapter({
 *   instanceUrl: 'https://company.acumatica.com',
 *   clientId: 'your-client-id',
 *   clientSecret: 'your-client-secret',
 *   username: 'apiuser',
 *   password: 'apipassword',
 *   companyName: 'MyCompany',  // For multi-tenant
 *   branch: 'MAIN',            // For multi-branch
 *   endpoint: 'https://company.acumatica.com',
 *   credentials: { type: 'oauth2' }
 * })
 *
 * await acumatica.connect()
 * const vendors = await acumatica.getVendors()
 * const branches = await acumatica.getBranches() // Multi-company support
 * ```
 */
export function createAcumaticaAdapter(config: AcumaticaConfig): AcumaticaAdapter {
  return new AcumaticaAdapter(config)
}

export default AcumaticaAdapter
