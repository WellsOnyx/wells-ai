// @ts-nocheck
/**
 * SAP ERP Adapter for Treasury SDK
 *
 * Supports:
 * - SAP S/4HANA (OData API v4)
 * - SAP Business One (Service Layer REST API)
 *
 * Integrates SAP vendor management, invoices, payments, and GL accounts
 * with the Grain & Vault Treasury SDK for blockchain-based payments.
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
// SAP-SPECIFIC TYPES
// ============================================================================

export interface SAPConfig extends ERPConnectionConfig {
  sapSystem: 's4hana' | 'business_one'
  sapClient?: string      // SAP Client number for S/4HANA (e.g., '100')
  companyDB?: string      // Company database for Business One (e.g., 'SBODEMOUS')
  language?: string       // Language code (default: 'EN')
}

interface SAPSessionResponse {
  SessionId: string
  Version: string
  SessionTimeout: number
}

interface SAPOAuthTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope?: string
}

// SAP S/4HANA OData response wrapper
interface SAPODataResponse<T> {
  d?: {
    results?: T[]
    [key: string]: unknown
  }
  value?: T[]
}

// SAP Business One response wrapper
interface SAPB1Response<T> {
  value?: T[]
  odata?: {
    metadata?: string
  }
}

// SAP Business Partner (Vendor)
interface SAPBusinessPartner {
  CardCode: string
  CardName: string
  CardType: string        // 'S' for Supplier
  EmailAddress?: string
  Phone1?: string
  FederalTaxID?: string
  Currency?: string
  GroupCode?: number
  PayTermsGrpCode?: number
  BPAddresses?: Array<{
    AddressName: string
    Street: string
    City: string
    Country: string
    ZipCode: string
  }>
  BPBankAccounts?: Array<{
    BankCode: string
    AccountNo: string
    Branch: string
    BIK?: string
    IBAN?: string
    SwiftNum?: string
  }>
  U_GrainWallet?: string  // Custom field for GRAIN wallet address
}

// SAP Invoice (Document)
interface SAPDocument {
  DocEntry: number
  DocNum: number
  CardCode: string
  CardName: string
  DocDate: string
  DocDueDate: string
  DocTotal: number
  DocCurrency: string
  DocumentStatus: string  // 'O' = Open, 'C' = Closed
  PaidToDate?: number
  DocumentLines?: Array<{
    LineNum: number
    ItemDescription: string
    Quantity: number
    Price: number
    LineTotal: number
    AccountCode?: string
    CostingCode?: string
    TaxCode?: string
  }>
  U_PONumber?: string
  Comments?: string
}

// SAP Payment (Incoming/Outgoing Payment)
interface SAPPayment {
  DocEntry?: number
  DocNum?: number
  DocType: string         // 'S' for Supplier
  CardCode: string
  DocDate: string
  DocCurrency: string
  CashSum?: number
  TransferSum?: number
  CheckSum?: number
  PaymentInvoices?: Array<{
    DocEntry: number
    InvoiceType: string   // '18' for AP Invoice
    SumApplied: number
  }>
  TransferAccount?: string
  TransferReference?: string
  JournalRemarks?: string
  U_GrainTxId?: string    // Custom field for GRAIN transaction ID
}

// SAP Journal Entry
interface SAPJournalEntry {
  ReferenceDate: string
  DueDate?: string
  TaxDate?: string
  Memo: string
  Reference?: string
  JournalEntryLines: Array<{
    AccountCode: string
    Debit?: number
    Credit?: number
    ShortName?: string
    LineMemo?: string
    CostingCode?: string
    ProjectCode?: string
  }>
}

// SAP Chart of Accounts
interface SAPGLAccount {
  Code: string
  Name: string
  AcctCurrency?: string
  ActiveAccount: string   // 'Y' or 'N'
  FatherAccountKey?: string
}

// SAP Cost Centers (Profit Centers)
interface SAPCostCenter {
  CenterCode: string
  CenterName: string
  InWhichDimension: number
  Active: string          // 'Y' or 'N'
}

// ============================================================================
// SAP ADAPTER
// ============================================================================

export class SAPAdapter extends BaseERPAdapter {
  private sapConfig: SAPConfig
  private sessionId?: string
  private sessionExpiry?: Date

  constructor(config: SAPConfig) {
    super(config)
    this.sapConfig = config

    // SAP-specific GL mappings
    this.glMappings = {
      'payment': '160000',           // Accounts Payable (typical SAP account)
      'receipt': '100000',           // Bank/Cash account
      'credit_draw': '170000',       // Credit Line Payable
      'credit_repay': '170000',      // Credit Line Payable
      'grain_appreciation': '840000', // Other Operating Income
      'grain_reserve': '120000',     // GRAIN Reserve Asset
    }
  }

  // ==========================================================================
  // CONNECTION METHODS
  // ==========================================================================

  async connect(): Promise<void> {
    try {
      if (this.sapConfig.sapSystem === 's4hana') {
        await this.connectS4HANA()
      } else {
        await this.connectBusinessOne()
      }
      this.connectionStatus = 'connected'
    } catch (error) {
      this.connectionStatus = 'error'
      throw new Error(`SAP connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async connectS4HANA(): Promise<void> {
    const { credentials } = this.sapConfig

    if (credentials.type === 'oauth2') {
      // OAuth 2.0 for S/4HANA Cloud
      const tokenUrl = credentials.tokenUrl || `${this.sapConfig.endpoint}/oauth/token`

      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credentials.clientId!,
        client_secret: credentials.clientSecret!,
      })

      if (credentials.scopes && credentials.scopes.length > 0) {
        params.append('scope', credentials.scopes.join(' '))
      }

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })

      if (!response.ok) {
        throw new Error(`OAuth failed: ${response.status}`)
      }

      const data: SAPOAuthTokenResponse = await response.json()
      this.accessToken = data.access_token
      this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000))
    } else if (credentials.type === 'basic') {
      // Basic authentication for on-premise S/4HANA
      const basicAuth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')
      this.accessToken = basicAuth
      // Basic auth doesn't expire, but set a far future date
      this.tokenExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    } else {
      throw new Error('S/4HANA requires OAuth2 or Basic authentication')
    }
  }

  private async connectBusinessOne(): Promise<void> {
    const { credentials } = this.sapConfig

    if (credentials.type !== 'basic') {
      throw new Error('SAP Business One requires basic authentication (username/password)')
    }

    // Business One uses session-based authentication
    const loginPayload = {
      CompanyDB: this.sapConfig.companyDB,
      Password: credentials.password,
      UserName: credentials.username,
    }

    const response = await fetch(this.buildUrl('/b1s/v1/Login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginPayload),
    })

    if (!response.ok) {
      throw new Error(`Business One login failed: ${response.status}`)
    }

    const data: SAPSessionResponse = await response.json()
    this.sessionId = data.SessionId

    // Session timeout in minutes, convert to milliseconds
    const timeoutMs = (data.SessionTimeout || 30) * 60 * 1000
    this.sessionExpiry = new Date(Date.now() + timeoutMs)
  }

  async disconnect(): Promise<void> {
    if (this.sapConfig.sapSystem === 'business_one' && this.sessionId) {
      try {
        await fetch(this.buildUrl('/b1s/v1/Logout'), {
          method: 'POST',
          headers: {
            'Cookie': `B1SESSION=${this.sessionId}`,
          },
        })
      } catch (error) {
        // Ignore logout errors
      }
      this.sessionId = undefined
      this.sessionExpiry = undefined
    }

    this.accessToken = undefined
    this.tokenExpiry = undefined
    this.connectionStatus = 'disconnected'
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.refreshTokenIfNeeded()

      if (this.sapConfig.sapSystem === 's4hana') {
        // Test S/4HANA connection by fetching metadata
        await this.makeRequest<unknown>('GET', '/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata')
      } else {
        // Test Business One connection by fetching company info
        await this.makeRequest<unknown>('GET', '/b1s/v1/CompanyService_GetCompanyInfo')
      }

      return true
    } catch (error) {
      return false
    }
  }

  // ==========================================================================
  // VENDOR METHODS
  // ==========================================================================

  async getVendors(filters?: { modifiedSince?: Date; limit?: number }): Promise<Vendor[]> {
    const limit = filters?.limit || 100
    let path: string

    if (this.sapConfig.sapSystem === 's4hana') {
      // S/4HANA OData query
      path = `/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner?$filter=BusinessPartnerType eq 'Supplier'&$top=${limit}`

      if (filters?.modifiedSince) {
        const isoDate = filters.modifiedSince.toISOString()
        path += `&$filter=LastChangeDateTime ge datetime'${isoDate}'`
      }
    } else {
      // Business One Service Layer
      path = `/b1s/v1/BusinessPartners?$filter=CardType eq 'S'&$top=${limit}`

      if (filters?.modifiedSince) {
        const dateStr = filters.modifiedSince.toISOString().split('T')[0]
        path += ` and UpdateDate ge '${dateStr}'`
      }
    }

    const response = await this.makeRequest<SAPODataResponse<SAPBusinessPartner>>(
      'GET',
      path
    )

    const results = response.d?.results || response.value || []
    return results.map(bp => this.mapSAPToVendor(bp))
  }

  async getVendor(vendorId: string): Promise<Vendor | null> {
    try {
      let path: string

      if (this.sapConfig.sapSystem === 's4hana') {
        path = `/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner('${vendorId}')`
      } else {
        path = `/b1s/v1/BusinessPartners('${vendorId}')`
      }

      const response = await this.makeRequest<{ d?: SAPBusinessPartner } | SAPBusinessPartner>(
        'GET',
        path
      )

      const bp = 'd' in response ? response.d : response
      if (!bp) return null

      return this.mapSAPToVendor(bp as SAPBusinessPartner)
    } catch (error) {
      return null
    }
  }

  async createVendor(vendor: Partial<Vendor>): Promise<SyncResult<Vendor>> {
    try {
      const sapVendor = this.mapVendorToSAP(vendor)
      let path: string

      if (this.sapConfig.sapSystem === 's4hana') {
        path = '/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner'
      } else {
        path = '/b1s/v1/BusinessPartners'
      }

      const response = await this.makeRequest<{ d?: SAPBusinessPartner } | SAPBusinessPartner>(
        'POST',
        path,
        sapVendor
      )

      const created = 'd' in response ? response.d : response
      if (!created) {
        return { success: false, error: 'Failed to create vendor' }
      }

      const mappedVendor = this.mapSAPToVendor(created as SAPBusinessPartner)

      return {
        success: true,
        data: mappedVendor,
        externalId: mappedVendor.externalId,
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create vendor: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  async updateVendor(vendorId: string, updates: Partial<Vendor>): Promise<SyncResult<Vendor>> {
    try {
      const sapUpdates = this.mapVendorToSAP(updates)
      let path: string

      if (this.sapConfig.sapSystem === 's4hana') {
        path = `/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner('${vendorId}')`
      } else {
        path = `/b1s/v1/BusinessPartners('${vendorId}')`
      }

      await this.makeRequest<unknown>(
        'PATCH',
        path,
        sapUpdates
      )

      const updated = await this.getVendor(vendorId)
      if (!updated) {
        return { success: false, error: 'Failed to retrieve updated vendor' }
      }

      return {
        success: true,
        data: updated,
        externalId: vendorId,
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to update vendor: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    const limit = filters?.limit || 100
    let path: string
    const filterClauses: string[] = []

    if (this.sapConfig.sapSystem === 's4hana') {
      path = `/sap/opu/odata/sap/API_PURCHASEINVOICE/A_PurchaseInvoice?$top=${limit}`

      if (filters?.vendorId) {
        filterClauses.push(`Supplier eq '${filters.vendorId}'`)
      }

      if (filters?.status) {
        // Map status to SAP document status
        const statusMap: Record<string, string> = {
          'open': 'O',
          'paid': 'C',
        }
        const sapStatuses = filters.status.map(s => statusMap[s]).filter(Boolean)
        if (sapStatuses.length > 0) {
          filterClauses.push(`(${sapStatuses.map(s => `DocumentStatus eq '${s}'`).join(' or ')})`)
        }
      }

      if (filterClauses.length > 0) {
        path += `&$filter=${filterClauses.join(' and ')}`
      }
    } else {
      // Business One - Purchase Invoices
      path = `/b1s/v1/PurchaseInvoices?$top=${limit}`

      if (filters?.vendorId) {
        filterClauses.push(`CardCode eq '${filters.vendorId}'`)
      }

      if (filters?.status) {
        const statusMap: Record<string, string> = {
          'open': 'O',
          'paid': 'C',
        }
        const sapStatuses = filters.status.map(s => statusMap[s]).filter(Boolean)
        if (sapStatuses.length > 0) {
          filterClauses.push(`(${sapStatuses.map(s => `DocumentStatus eq '${s}'`).join(' or ')})`)
        }
      }

      if (filterClauses.length > 0) {
        path += `&$filter=${filterClauses.join(' and ')}`
      }
    }

    const response = await this.makeRequest<SAPODataResponse<SAPDocument>>(
      'GET',
      path
    )

    const results = response.d?.results || response.value || []
    return results.map(doc => this.mapSAPToInvoice(doc))
  }

  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    try {
      let path: string

      if (this.sapConfig.sapSystem === 's4hana') {
        path = `/sap/opu/odata/sap/API_PURCHASEINVOICE/A_PurchaseInvoice('${invoiceId}')`
      } else {
        path = `/b1s/v1/PurchaseInvoices(${invoiceId})`
      }

      const response = await this.makeRequest<{ d?: SAPDocument } | SAPDocument>(
        'GET',
        path
      )

      const doc = 'd' in response ? response.d : response
      if (!doc) return null

      return this.mapSAPToInvoice(doc as SAPDocument)
    } catch (error) {
      return null
    }
  }

  // ==========================================================================
  // PAYMENT METHODS
  // ==========================================================================

  async createPayment(payment: Partial<Payment>): Promise<SyncResult<Payment>> {
    try {
      const sapPayment = this.mapPaymentToSAP(payment)
      let path: string

      if (this.sapConfig.sapSystem === 's4hana') {
        path = '/sap/opu/odata/sap/API_OUTGOING_PAYMENT/A_OutgoingPayment'
      } else {
        path = '/b1s/v1/VendorPayments'
      }

      const response = await this.makeRequest<{ d?: SAPPayment } | SAPPayment>(
        'POST',
        path,
        sapPayment
      )

      const created = 'd' in response ? response.d : response
      if (!created || !created.DocEntry) {
        return { success: false, error: 'Failed to create payment' }
      }

      const mappedPayment = this.mapSAPToPayment(created as SAPPayment)

      return {
        success: true,
        data: mappedPayment,
        externalId: String(created.DocEntry),
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  async syncPayment(payment: Payment): Promise<SyncResult<Payment>> {
    // For SAP, we typically create new payment records rather than update
    if (payment.externalId) {
      // Payment already synced
      return {
        success: true,
        data: payment,
        externalId: payment.externalId,
      }
    }

    return this.createPayment(payment)
  }

  async getPayment(paymentId: string): Promise<Payment | null> {
    try {
      let path: string

      if (this.sapConfig.sapSystem === 's4hana') {
        path = `/sap/opu/odata/sap/API_OUTGOING_PAYMENT/A_OutgoingPayment('${paymentId}')`
      } else {
        path = `/b1s/v1/VendorPayments(${paymentId})`
      }

      const response = await this.makeRequest<{ d?: SAPPayment } | SAPPayment>(
        'GET',
        path
      )

      const pmt = 'd' in response ? response.d : response
      if (!pmt) return null

      return this.mapSAPToPayment(pmt as SAPPayment)
    } catch (error) {
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
    const limit = filters?.limit || 100
    let path: string
    const filterClauses: string[] = []

    if (this.sapConfig.sapSystem === 's4hana') {
      path = `/sap/opu/odata/sap/API_OUTGOING_PAYMENT/A_OutgoingPayment?$top=${limit}`

      if (filters?.vendorId) {
        filterClauses.push(`BusinessPartner eq '${filters.vendorId}'`)
      }

      if (filterClauses.length > 0) {
        path += `&$filter=${filterClauses.join(' and ')}`
      }
    } else {
      path = `/b1s/v1/VendorPayments?$top=${limit}`

      if (filters?.vendorId) {
        filterClauses.push(`CardCode eq '${filters.vendorId}'`)
      }

      if (filterClauses.length > 0) {
        path += `&$filter=${filterClauses.join(' and ')}`
      }
    }

    const response = await this.makeRequest<SAPODataResponse<SAPPayment>>(
      'GET',
      path
    )

    const results = response.d?.results || response.value || []
    return results.map(pmt => this.mapSAPToPayment(pmt))
  }

  // ==========================================================================
  // JOURNAL ENTRY METHODS
  // ==========================================================================

  async createJournalEntry(entry: Partial<JournalEntry>): Promise<SyncResult<JournalEntry>> {
    try {
      const sapEntry = this.mapJournalEntryToSAP(entry)
      let path: string

      if (this.sapConfig.sapSystem === 's4hana') {
        path = '/sap/opu/odata/sap/API_JOURNALENTRY/A_JournalEntry'
      } else {
        path = '/b1s/v1/JournalEntries'
      }

      const response = await this.makeRequest<unknown>(
        'POST',
        path,
        sapEntry
      )

      return {
        success: true,
        data: entry as JournalEntry,
        externalId: 'created',
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create journal entry: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  // ==========================================================================
  // GL ACCOUNT & COST CENTER METHODS
  // ==========================================================================

  async getGLAccounts(): Promise<GLAccount[]> {
    let path: string

    if (this.sapConfig.sapSystem === 's4hana') {
      path = '/sap/opu/odata/sap/API_CHARTOFACCOUNTS/A_ChartOfAccounts?$top=1000'
    } else {
      path = '/b1s/v1/ChartOfAccounts?$top=1000'
    }

    const response = await this.makeRequest<SAPODataResponse<SAPGLAccount>>(
      'GET',
      path
    )

    const results = response.d?.results || response.value || []
    return results.map(account => this.mapSAPToGLAccount(account))
  }

  async getCostCenters(): Promise<CostCenter[]> {
    let path: string

    if (this.sapConfig.sapSystem === 's4hana') {
      path = '/sap/opu/odata/sap/API_PROFITCENTER/A_ProfitCenter?$top=1000'
    } else {
      // Business One uses "Profit Centers" in Distribution Rules
      path = '/b1s/v1/ProfitCenters?$top=1000'
    }

    const response = await this.makeRequest<SAPODataResponse<SAPCostCenter>>(
      'GET',
      path
    )

    const results = response.d?.results || response.value || []
    return results.map(center => this.mapSAPToCostCenter(center))
  }

  // ==========================================================================
  // MAPPING HELPERS
  // ==========================================================================

  private mapSAPToVendor(bp: SAPBusinessPartner): Vendor {
    const primaryAddress = bp.BPAddresses?.[0]
    const primaryBank = bp.BPBankAccounts?.[0]

    return {
      id: bp.CardCode,
      externalId: bp.CardCode,
      name: bp.CardName,
      email: bp.EmailAddress,
      phone: bp.Phone1,
      taxId: bp.FederalTaxID,
      currency: bp.Currency || 'USD',
      paymentTerms: bp.PayTermsGrpCode ? `SAP-${bp.PayTermsGrpCode}` : undefined,
      bankAccount: primaryBank ? {
        bankName: primaryBank.BankCode,
        accountNumber: primaryBank.AccountNo,
        routingNumber: primaryBank.Branch || '',
        swiftCode: primaryBank.SwiftNum,
        iban: primaryBank.IBAN,
      } : undefined,
      grainWalletAddress: bp.U_GrainWallet,
      metadata: {
        sapCardType: bp.CardType,
        sapGroupCode: String(bp.GroupCode || ''),
      },
    }
  }

  private mapVendorToSAP(vendor: Partial<Vendor>): Partial<SAPBusinessPartner> {
    const sap: Partial<SAPBusinessPartner> = {
      CardType: 'S', // Supplier
    }

    if (vendor.externalId) sap.CardCode = vendor.externalId
    if (vendor.name) sap.CardName = vendor.name
    if (vendor.email) sap.EmailAddress = vendor.email
    if (vendor.phone) sap.Phone1 = vendor.phone
    if (vendor.taxId) sap.FederalTaxID = vendor.taxId
    if (vendor.currency) sap.Currency = vendor.currency
    if (vendor.grainWalletAddress) sap.U_GrainWallet = vendor.grainWalletAddress

    if (vendor.bankAccount) {
      sap.BPBankAccounts = [{
        BankCode: vendor.bankAccount.bankName,
        AccountNo: vendor.bankAccount.accountNumber,
        Branch: vendor.bankAccount.routingNumber,
        SwiftNum: vendor.bankAccount.swiftCode,
        IBAN: vendor.bankAccount.iban,
      }]
    }

    return sap
  }

  private mapSAPToInvoice(doc: SAPDocument): Invoice {
    const status = this.mapSAPDocumentStatus(doc.DocumentStatus)

    const lineItems: InvoiceLineItem[] = (doc.DocumentLines || []).map(line => ({
      id: String(line.LineNum),
      description: line.ItemDescription || '',
      quantity: line.Quantity || 0,
      unitPrice: line.Price || 0,
      amount: line.LineTotal || 0,
      glAccount: line.AccountCode,
      costCenter: line.CostingCode,
      taxCode: line.TaxCode,
    }))

    return {
      id: String(doc.DocEntry),
      externalId: String(doc.DocEntry),
      vendorId: doc.CardCode,
      vendorName: doc.CardName,
      amount: doc.DocTotal,
      currency: doc.DocCurrency || 'USD',
      dueDate: new Date(doc.DocDueDate),
      invoiceDate: new Date(doc.DocDate),
      status,
      lineItems,
      poNumber: doc.U_PONumber,
      description: doc.Comments,
      metadata: {
        sapDocNum: String(doc.DocNum),
        sapDocEntry: String(doc.DocEntry),
      },
    }
  }

  private mapSAPDocumentStatus(sapStatus: string): Invoice['status'] {
    switch (sapStatus) {
      case 'O': return 'open'
      case 'C': return 'paid'
      case 'X': return 'cancelled'
      default: return 'open'
    }
  }

  private mapPaymentToSAP(payment: Partial<Payment>): Partial<SAPPayment> {
    const sap: Partial<SAPPayment> = {
      DocType: 'S', // Supplier payment
      DocDate: payment.paymentDate ? payment.paymentDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      DocCurrency: payment.currency || 'USD',
      JournalRemarks: payment.reference || 'GRAIN Payment',
    }

    if (payment.vendorId) sap.CardCode = payment.vendorId
    if (payment.grainTransactionId) sap.U_GrainTxId = payment.grainTransactionId
    if (payment.reference) sap.TransferReference = payment.reference

    // Map payment method to SAP payment type
    if (payment.paymentMethod === 'grain' || payment.paymentMethod === 'wire' || payment.paymentMethod === 'ach') {
      sap.TransferSum = payment.amount
      sap.TransferAccount = payment.bankAccount || payment.glAccount
    } else if (payment.paymentMethod === 'check') {
      sap.CheckSum = payment.amount
    } else {
      sap.CashSum = payment.amount
    }

    // Link to invoice if provided
    if (payment.invoiceId) {
      sap.PaymentInvoices = [{
        DocEntry: Number(payment.invoiceId),
        InvoiceType: '18', // AP Invoice
        SumApplied: payment.amount || 0,
      }]
    }

    return sap
  }

  private mapSAPToPayment(pmt: SAPPayment): Payment {
    const amount = pmt.TransferSum || pmt.CashSum || pmt.CheckSum || 0

    // Determine payment method
    let paymentMethod: Payment['paymentMethod'] = 'wire'
    if (pmt.CheckSum) paymentMethod = 'check'
    else if (pmt.U_GrainTxId) paymentMethod = 'grain'
    else if (pmt.TransferSum) paymentMethod = 'wire'

    return {
      id: String(pmt.DocEntry),
      externalId: String(pmt.DocEntry),
      invoiceId: pmt.PaymentInvoices?.[0]?.DocEntry ? String(pmt.PaymentInvoices[0].DocEntry) : '',
      vendorId: pmt.CardCode,
      amount,
      currency: pmt.DocCurrency || 'USD',
      paymentDate: new Date(pmt.DocDate),
      paymentMethod,
      grainTransactionId: pmt.U_GrainTxId,
      status: 'completed',
      bankAccount: pmt.TransferAccount,
      reference: pmt.TransferReference || pmt.JournalRemarks,
      metadata: {
        sapDocNum: String(pmt.DocNum),
        sapDocEntry: String(pmt.DocEntry),
      },
    }
  }

  private mapJournalEntryToSAP(entry: Partial<JournalEntry>): Partial<SAPJournalEntry> {
    const sap: Partial<SAPJournalEntry> = {
      ReferenceDate: entry.date ? entry.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      TaxDate: entry.date ? entry.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      Memo: entry.description || '',
      Reference: entry.reference,
      JournalEntryLines: (entry.lines || []).map(line => ({
        AccountCode: line.accountId,
        Debit: line.debit,
        Credit: line.credit,
        ShortName: line.accountName,
        LineMemo: line.memo,
        CostingCode: line.costCenter,
        ProjectCode: line.department,
      })),
    }

    return sap
  }

  private mapSAPToGLAccount(account: SAPGLAccount): GLAccount {
    // Determine account type based on SAP account code range (typical convention)
    let type: GLAccount['type'] = 'expense'
    const code = Number(account.Code)

    if (code >= 100000 && code < 200000) type = 'asset'
    else if (code >= 200000 && code < 300000) type = 'liability'
    else if (code >= 300000 && code < 400000) type = 'equity'
    else if (code >= 400000 && code < 500000) type = 'revenue'
    else if (code >= 500000 && code < 900000) type = 'expense'

    return {
      id: account.Code,
      code: account.Code,
      name: account.Name,
      type,
      currency: account.AcctCurrency,
      isActive: account.ActiveAccount === 'Y',
      parentId: account.FatherAccountKey,
    }
  }

  private mapSAPToCostCenter(center: SAPCostCenter): CostCenter {
    return {
      id: center.CenterCode,
      code: center.CenterCode,
      name: center.CenterName,
      isActive: center.Active === 'Y',
    }
  }

  // ==========================================================================
  // OVERRIDDEN REQUEST METHODS
  // ==========================================================================

  protected async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    await this.refreshTokenIfNeeded()

    const url = this.buildUrl(path)
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    }

    if (this.sapConfig.sapSystem === 's4hana') {
      // S/4HANA uses Bearer token or Basic auth
      if (this.sapConfig.credentials.type === 'oauth2') {
        requestHeaders['Authorization'] = `Bearer ${this.accessToken}`
      } else {
        requestHeaders['Authorization'] = `Basic ${this.accessToken}`
      }

      // Add SAP client header if specified
      if (this.sapConfig.sapClient) {
        requestHeaders['sap-client'] = this.sapConfig.sapClient
      }

      // Add CSRF token for write operations
      if (method !== 'GET') {
        requestHeaders['x-csrf-token'] = 'fetch'
      }
    } else {
      // Business One uses session cookie
      if (this.sessionId) {
        requestHeaders['Cookie'] = `B1SESSION=${this.sessionId}`
      }
    }

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`SAP API Error: ${response.status} - ${error}`)
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return {} as T
    }

    return response.json()
  }

  protected async refreshTokenIfNeeded(): Promise<void> {
    if (this.sapConfig.sapSystem === 'business_one') {
      // Check session expiry
      if (this.sessionExpiry && new Date() >= this.sessionExpiry) {
        await this.connect()
      }
    } else {
      // S/4HANA token refresh
      if (this.tokenExpiry && new Date() >= this.tokenExpiry) {
        await this.connect()
      }
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createSAPAdapter(config: SAPConfig): SAPAdapter {
  return new SAPAdapter(config)
}

export default SAPAdapter
