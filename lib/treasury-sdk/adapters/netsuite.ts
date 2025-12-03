// @ts-nocheck
/**
 * NetSuite ERP Adapter for Grain & Vault Treasury SDK
 *
 * Implements integration with NetSuite ERP using:
 * - Token-Based Authentication (TBA) with OAuth 1.0
 * - REST API (RESTlets and Record API)
 * - SuiteQL for advanced queries
 * - NetSuite internal IDs and external IDs
 *
 * Supports:
 * - Vendor management (CRUD operations)
 * - Invoice retrieval (VendorBill records)
 * - Payment creation and sync (VendorPayment records)
 * - Journal entries for GRAIN transactions
 * - GL account and cost center mapping
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
// NETSUITE-SPECIFIC TYPES
// ============================================================================

export interface NetSuiteConfig extends ERPConnectionConfig {
  accountId: string           // NetSuite account ID (e.g., "1234567")
  consumerKey: string         // OAuth 1.0 consumer key
  consumerSecret: string      // OAuth 1.0 consumer secret
  tokenId: string             // OAuth 1.0 token ID
  tokenSecret: string         // OAuth 1.0 token secret
  useSuiteQL?: boolean        // Use SuiteQL for queries (default: true)
  apiVersion?: string         // REST API version (default: "v1")
  restletUrl?: string         // Custom RESTlet URL if needed
}

interface NetSuiteVendorRecord {
  id: string
  entityId: string            // Vendor name/ID
  companyName: string
  email?: string
  phone?: string
  taxNumber?: string
  currency?: { internalId: string; name: string }
  terms?: { internalId: string; name: string }
  customFields?: Record<string, any>
}

interface NetSuiteBillRecord {
  id: string
  tranId: string              // Transaction number
  entity: { internalId: string; name: string }  // Vendor
  tranDate: string
  dueDate: string
  total: number
  amountRemaining: number
  status: string
  currency?: { internalId: string }
  expenseList?: {
    expense: Array<{
      account: { internalId: string }
      amount: number
      memo?: string
      department?: { internalId: string }
      class?: { internalId: string }
    }>
  }
  itemList?: {
    item: Array<{
      item: { internalId: string }
      quantity: number
      rate: number
      amount: number
      description?: string
    }>
  }
}

interface NetSuitePaymentRecord {
  id: string
  tranId: string
  vendor: { internalId: string }
  tranDate: string
  account: { internalId: string }  // Bank account
  total: number
  status: string
  applyList?: {
    apply: Array<{
      doc: { internalId: string }  // Invoice ID
      amount: number
    }>
  }
  memo?: string
}

interface NetSuiteJournalRecord {
  id: string
  tranId: string
  tranDate: string
  memo?: string
  lineList: {
    line: Array<{
      account: { internalId: string }
      debit?: number
      credit?: number
      department?: { internalId: string }
      class?: { internalId: string }
      memo?: string
    }>
  }
}

interface SuiteQLResult {
  items: Array<Record<string, any>>
  hasMore: boolean
  totalResults: number
  offset: number
  count: number
}

// ============================================================================
// NETSUITE ADAPTER CLASS
// ============================================================================

export class NetSuiteAdapter extends BaseERPAdapter {
  private netsuiteConfig: NetSuiteConfig
  private baseRestUrl: string

  constructor(config: NetSuiteConfig) {
    super(config)
    this.netsuiteConfig = config

    // Build base REST URL
    const accountId = config.accountId.toLowerCase().replace('_', '-')
    const apiVersion = config.apiVersion || 'v1'
    this.baseRestUrl = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/${apiVersion}`

    // Override default GL mappings for NetSuite
    this.glMappings = {
      'payment': '2000',           // Accounts Payable (NetSuite default)
      'receipt': '1000',           // Cash - Operating Account
      'credit_draw': '2200',       // Credit Line Payable
      'credit_repay': '2200',      // Credit Line Payable
      'grain_appreciation': '4000', // Other Income
      'grain_reserve': '1100',     // GRAIN Reserve Asset
    }
  }

  // ============================================================================
  // CONNECTION METHODS
  // ============================================================================

  async connect(): Promise<void> {
    try {
      // Test connection with a simple SuiteQL query
      const testQuery = 'SELECT id FROM vendor WHERE ROWNUM <= 1'
      await this.executeSuiteQL(testQuery)

      this.connectionStatus = 'connected'
      console.log(`Connected to NetSuite account: ${this.netsuiteConfig.accountId}`)
    } catch (error) {
      this.connectionStatus = 'error'
      throw new Error(`Failed to connect to NetSuite: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async disconnect(): Promise<void> {
    this.connectionStatus = 'disconnected'
    this.accessToken = undefined
    console.log('Disconnected from NetSuite')
  }

  async testConnection(): Promise<boolean> {
    try {
      // Test with a simple query
      const testQuery = 'SELECT COUNT(*) as count FROM vendor WHERE ROWNUM <= 1'
      await this.executeSuiteQL(testQuery)
      return true
    } catch (error) {
      console.error('NetSuite connection test failed:', error)
      return false
    }
  }

  // ============================================================================
  // VENDOR METHODS
  // ============================================================================

  async getVendors(filters?: { modifiedSince?: Date; limit?: number }): Promise<Vendor[]> {
    try {
      const limit = filters?.limit || 1000
      let query = `
        SELECT
          v.id,
          v.entityId,
          v.companyName,
          v.email,
          v.phone,
          v.taxNumber,
          v.currency,
          v.terms
        FROM vendor v
        WHERE v.isInactive = 'F'
      `

      if (filters?.modifiedSince) {
        const dateStr = this.formatNetSuiteDate(filters.modifiedSince)
        query += ` AND v.lastModifiedDate >= TO_DATE('${dateStr}', 'YYYY-MM-DD')`
      }

      query += ` ORDER BY v.id FETCH FIRST ${limit} ROWS ONLY`

      const result = await this.executeSuiteQL(query)
      return result.items.map(item => this.mapNetSuiteVendorToVendor(item))
    } catch (error) {
      throw new Error(`Failed to get vendors: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getVendor(vendorId: string): Promise<Vendor | null> {
    try {
      const query = `
        SELECT
          v.id,
          v.entityId,
          v.companyName,
          v.email,
          v.phone,
          v.taxNumber,
          v.currency,
          v.terms
        FROM vendor v
        WHERE v.id = ${vendorId}
      `

      const result = await this.executeSuiteQL(query)
      if (result.items.length === 0) {
        return null
      }

      return this.mapNetSuiteVendorToVendor(result.items[0])
    } catch (error) {
      throw new Error(`Failed to get vendor ${vendorId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async createVendor(vendor: Partial<Vendor>): Promise<SyncResult<Vendor>> {
    try {
      const vendorData = {
        entityId: vendor.name,
        companyName: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        taxNumber: vendor.taxId,
        currency: vendor.currency ? { internalId: vendor.currency } : undefined,
        isPerson: false,
        customForm: { internalId: '-10' }, // Standard vendor form
      }

      const response = await this.makeNetSuiteRequest<{ id: string }>(
        'POST',
        '/vendor',
        vendorData
      )

      const createdVendor = await this.getVendor(response.id)

      return {
        success: true,
        data: createdVendor!,
        externalId: response.id,
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
      const updateData: any = {}

      if (updates.name) updateData.companyName = updates.name
      if (updates.email) updateData.email = updates.email
      if (updates.phone) updateData.phone = updates.phone
      if (updates.taxId) updateData.taxNumber = updates.taxId

      await this.makeNetSuiteRequest(
        'PATCH',
        `/vendor/${vendorId}`,
        updateData
      )

      const updatedVendor = await this.getVendor(vendorId)

      return {
        success: true,
        data: updatedVendor!,
        externalId: vendorId,
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to update vendor: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    try {
      const limit = filters?.limit || 1000
      let query = `
        SELECT
          vb.id,
          vb.tranId,
          vb.entity,
          vb.tranDate,
          vb.dueDate,
          vb.total,
          vb.amountRemaining,
          vb.status,
          vb.currency,
          v.companyName as vendorName
        FROM transaction vb
        INNER JOIN vendor v ON vb.entity = v.id
        WHERE vb.type = 'VendBill'
      `

      const conditions: string[] = []

      // Status filter
      if (filters?.status && filters.status.length > 0) {
        const statusMap: Record<Invoice['status'], string> = {
          'open': 'VendBill:A',      // Open
          'partial': 'VendBill:B',   // Partially Paid
          'paid': 'VendBill:D',      // Paid In Full
          'cancelled': 'VendBill:V', // Voided
          'disputed': 'VendBill:A',  // Map disputed to open
        }
        const nsStatuses = filters.status.map(s => `'${statusMap[s]}'`).join(',')
        conditions.push(`vb.status IN (${nsStatuses})`)
      }

      if (filters?.vendorId) {
        conditions.push(`vb.entity = ${filters.vendorId}`)
      }

      if (filters?.dueBefore) {
        const dateStr = this.formatNetSuiteDate(filters.dueBefore)
        conditions.push(`vb.dueDate <= TO_DATE('${dateStr}', 'YYYY-MM-DD')`)
      }

      if (filters?.dueAfter) {
        const dateStr = this.formatNetSuiteDate(filters.dueAfter)
        conditions.push(`vb.dueDate >= TO_DATE('${dateStr}', 'YYYY-MM-DD')`)
      }

      if (filters?.modifiedSince) {
        const dateStr = this.formatNetSuiteDate(filters.modifiedSince)
        conditions.push(`vb.lastModifiedDate >= TO_DATE('${dateStr}', 'YYYY-MM-DD')`)
      }

      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ')
      }

      query += ` ORDER BY vb.dueDate FETCH FIRST ${limit} ROWS ONLY`

      const result = await this.executeSuiteQL(query)

      // Fetch line items for each invoice
      const invoices = await Promise.all(
        result.items.map(async (item) => {
          const lineItems = await this.getInvoiceLineItems(item.id)
          return this.mapNetSuiteBillToInvoice(item, lineItems)
        })
      )

      return invoices
    } catch (error) {
      throw new Error(`Failed to get invoices: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    try {
      const query = `
        SELECT
          vb.id,
          vb.tranId,
          vb.entity,
          vb.tranDate,
          vb.dueDate,
          vb.total,
          vb.amountRemaining,
          vb.status,
          vb.currency,
          v.companyName as vendorName
        FROM transaction vb
        INNER JOIN vendor v ON vb.entity = v.id
        WHERE vb.id = ${invoiceId} AND vb.type = 'VendBill'
      `

      const result = await this.executeSuiteQL(query)
      if (result.items.length === 0) {
        return null
      }

      const lineItems = await this.getInvoiceLineItems(invoiceId)
      return this.mapNetSuiteBillToInvoice(result.items[0], lineItems)
    } catch (error) {
      throw new Error(`Failed to get invoice ${invoiceId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async getInvoiceLineItems(billId: string): Promise<InvoiceLineItem[]> {
    try {
      const query = `
        SELECT
          tl.id,
          tl.memo,
          tl.quantity,
          tl.rate,
          tl.amount,
          tl.account,
          tl.department,
          tl.class
        FROM transactionLine tl
        WHERE tl.transaction = ${billId}
        AND tl.mainline = 'F'
        ORDER BY tl.lineSequence
      `

      const result = await this.executeSuiteQL(query)

      return result.items.map((item, index) => ({
        id: item.id || `line-${index}`,
        description: item.memo || '',
        quantity: parseFloat(item.quantity || '1'),
        unitPrice: parseFloat(item.rate || '0'),
        amount: parseFloat(item.amount || '0'),
        glAccount: item.account,
        costCenter: item.department || item.class,
      }))
    } catch (error) {
      console.warn(`Failed to get line items for bill ${billId}:`, error)
      return []
    }
  }

  // ============================================================================
  // PAYMENT METHODS
  // ============================================================================

  async createPayment(payment: Partial<Payment>): Promise<SyncResult<Payment>> {
    try {
      const paymentData = {
        entity: { internalId: payment.vendorId },
        tranDate: this.formatNetSuiteDate(payment.paymentDate || new Date()),
        account: { internalId: payment.bankAccount || this.glMappings['receipt'] },
        memo: payment.reference || `GRAIN Payment ${payment.grainTransactionId || ''}`,
        applyList: payment.invoiceId ? {
          apply: [{
            doc: { internalId: payment.invoiceId },
            amount: payment.amount,
            apply: true,
          }]
        } : undefined,
      }

      const response = await this.makeNetSuiteRequest<{ id: string }>(
        'POST',
        '/vendorPayment',
        paymentData
      )

      const createdPayment = await this.getPayment(response.id)

      return {
        success: true,
        data: createdPayment!,
        externalId: response.id,
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  async syncPayment(payment: Payment): Promise<SyncResult<Payment>> {
    try {
      if (payment.externalId) {
        // Update existing payment
        const existingPayment = await this.getPayment(payment.externalId)
        if (existingPayment) {
          return {
            success: true,
            data: existingPayment,
            externalId: payment.externalId,
          }
        }
      }

      // Create new payment
      return this.createPayment(payment)
    } catch (error) {
      return {
        success: false,
        error: `Failed to sync payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  async getPayment(paymentId: string): Promise<Payment | null> {
    try {
      const query = `
        SELECT
          vp.id,
          vp.tranId,
          vp.entity,
          vp.tranDate,
          vp.account,
          vp.total,
          vp.status,
          vp.memo
        FROM transaction vp
        WHERE vp.id = ${paymentId} AND vp.type = 'VendPymt'
      `

      const result = await this.executeSuiteQL(query)
      if (result.items.length === 0) {
        return null
      }

      return this.mapNetSuitePaymentToPayment(result.items[0])
    } catch (error) {
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
      let query = `
        SELECT
          vp.id,
          vp.tranId,
          vp.entity,
          vp.tranDate,
          vp.account,
          vp.total,
          vp.status,
          vp.memo
        FROM transaction vp
        WHERE vp.type = 'VendPymt'
      `

      const conditions: string[] = []

      if (filters?.vendorId) {
        conditions.push(`vp.entity = ${filters.vendorId}`)
      }

      if (filters?.dateFrom) {
        const dateStr = this.formatNetSuiteDate(filters.dateFrom)
        conditions.push(`vp.tranDate >= TO_DATE('${dateStr}', 'YYYY-MM-DD')`)
      }

      if (filters?.dateTo) {
        const dateStr = this.formatNetSuiteDate(filters.dateTo)
        conditions.push(`vp.tranDate <= TO_DATE('${dateStr}', 'YYYY-MM-DD')`)
      }

      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ')
      }

      query += ` ORDER BY vp.tranDate DESC FETCH FIRST ${limit} ROWS ONLY`

      const result = await this.executeSuiteQL(query)
      return result.items.map(item => this.mapNetSuitePaymentToPayment(item))
    } catch (error) {
      throw new Error(`Failed to get payments: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ============================================================================
  // JOURNAL ENTRY METHODS
  // ============================================================================

  async createJournalEntry(entry: Partial<JournalEntry>): Promise<SyncResult<JournalEntry>> {
    try {
      const lineList = {
        line: entry.lines?.map(line => ({
          account: { internalId: line.accountId },
          debit: line.debit > 0 ? line.debit : undefined,
          credit: line.credit > 0 ? line.credit : undefined,
          department: line.department ? { internalId: line.department } : undefined,
          class: line.costCenter ? { internalId: line.costCenter } : undefined,
          memo: line.memo,
        }))
      }

      const journalData = {
        tranDate: this.formatNetSuiteDate(entry.date || new Date()),
        memo: entry.description,
        lineList,
      }

      const response = await this.makeNetSuiteRequest<{ id: string }>(
        'POST',
        '/journalEntry',
        journalData
      )

      const createdEntry: JournalEntry = {
        id: crypto.randomUUID(),
        externalId: response.id,
        date: entry.date || new Date(),
        description: entry.description || '',
        lines: entry.lines || [],
        status: 'posted',
        reference: entry.reference,
      }

      return {
        success: true,
        data: createdEntry,
        externalId: response.id,
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create journal entry: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  // ============================================================================
  // GL ACCOUNT & COST CENTER METHODS
  // ============================================================================

  async getGLAccounts(): Promise<GLAccount[]> {
    try {
      const query = `
        SELECT
          a.id,
          a.accountNumber,
          a.accountSearchDisplayName,
          a.acctType,
          a.currency,
          a.isInactive,
          a.parent
        FROM account a
        ORDER BY a.accountNumber
      `

      const result = await this.executeSuiteQL(query)

      return result.items.map(item => ({
        id: item.id,
        code: item.accountNumber || item.id,
        name: item.accountSearchDisplayName || `Account ${item.id}`,
        type: this.mapNetSuiteAccountType(item.acctType),
        currency: item.currency,
        isActive: item.isInactive === 'F',
        parentId: item.parent,
      }))
    } catch (error) {
      throw new Error(`Failed to get GL accounts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getCostCenters(): Promise<CostCenter[]> {
    try {
      // NetSuite uses Departments and Classes for cost centers
      const departments = await this.getDepartments()
      const classes = await this.getClasses()

      return [...departments, ...classes]
    } catch (error) {
      throw new Error(`Failed to get cost centers: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async getDepartments(): Promise<CostCenter[]> {
    try {
      const query = `
        SELECT
          d.id,
          d.name,
          d.isInactive,
          d.parent
        FROM department d
        ORDER BY d.name
      `

      const result = await this.executeSuiteQL(query)

      return result.items.map(item => ({
        id: item.id,
        code: `DEPT-${item.id}`,
        name: item.name,
        isActive: item.isInactive === 'F',
        parentId: item.parent,
      }))
    } catch (error) {
      console.warn('Failed to get departments:', error)
      return []
    }
  }

  private async getClasses(): Promise<CostCenter[]> {
    try {
      const query = `
        SELECT
          c.id,
          c.name,
          c.isInactive,
          c.parent
        FROM classification c
        ORDER BY c.name
      `

      const result = await this.executeSuiteQL(query)

      return result.items.map(item => ({
        id: item.id,
        code: `CLASS-${item.id}`,
        name: item.name,
        isActive: item.isInactive === 'F',
        parentId: item.parent,
      }))
    } catch (error) {
      console.warn('Failed to get classes:', error)
      return []
    }
  }

  // ============================================================================
  // NETSUITE-SPECIFIC HELPER METHODS
  // ============================================================================

  /**
   * Execute a SuiteQL query
   */
  private async executeSuiteQL(query: string, offset: number = 0, limit: number = 1000): Promise<SuiteQLResult> {
    try {
      const url = `https://${this.netsuiteConfig.accountId.toLowerCase().replace('_', '-')}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      })

      const response = await fetch(`${url}?${params}`, {
        method: 'POST',
        headers: this.buildOAuthHeaders('POST', url, query),
        body: JSON.stringify({ q: query }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`SuiteQL Error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()

      return {
        items: data.items || [],
        hasMore: data.hasMore || false,
        totalResults: data.totalResults || 0,
        offset: data.offset || 0,
        count: data.count || 0,
      }
    } catch (error) {
      throw new Error(`SuiteQL execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Make a NetSuite REST API request with OAuth 1.0 authentication
   */
  private async makeNetSuiteRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseRestUrl}${path}`

    const response = await fetch(url, {
      method,
      headers: this.buildOAuthHeaders(method, url, body),
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`NetSuite API Error: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  /**
   * Build OAuth 1.0 headers for NetSuite Token-Based Authentication (TBA)
   */
  private buildOAuthHeaders(
    method: string,
    url: string,
    body?: unknown
  ): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = crypto.randomBytes(16).toString('base64')

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.netsuiteConfig.consumerKey,
      oauth_token: this.netsuiteConfig.tokenId,
      oauth_signature_method: 'HMAC-SHA256',
      oauth_timestamp: timestamp,
      oauth_nonce: nonce,
      oauth_version: '1.0',
    }

    // Generate OAuth signature
    const signature = this.generateOAuthSignature(method, url, oauthParams)
    oauthParams.oauth_signature = signature

    // Build Authorization header
    const authHeader = 'OAuth ' + Object.entries(oauthParams)
      .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
      .join(', ')

    return {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  }

  /**
   * Generate OAuth 1.0 signature for NetSuite TBA
   */
  private generateOAuthSignature(
    method: string,
    url: string,
    oauthParams: Record<string, string>
  ): string {
    // Sort parameters
    const sortedParams = Object.entries(oauthParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&')

    // Build base string
    const baseString = [
      method.toUpperCase(),
      encodeURIComponent(url),
      encodeURIComponent(sortedParams),
    ].join('&')

    // Generate signing key
    const signingKey = `${encodeURIComponent(this.netsuiteConfig.consumerSecret)}&${encodeURIComponent(this.netsuiteConfig.tokenSecret)}`

    // Generate signature
    const signature = crypto
      .createHmac('sha256', signingKey)
      .update(baseString)
      .digest('base64')

    return signature
  }

  /**
   * Format date for NetSuite (YYYY-MM-DD)
   */
  private formatNetSuiteDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * Map NetSuite account type to GL account type
   */
  private mapNetSuiteAccountType(nsType: string): GLAccount['type'] {
    const typeMap: Record<string, GLAccount['type']> = {
      'AcctRec': 'asset',
      'Bank': 'asset',
      'OthCurrAsset': 'asset',
      'FixedAsset': 'asset',
      'OthAsset': 'asset',
      'AcctPay': 'liability',
      'CredCard': 'liability',
      'OthCurrLiab': 'liability',
      'LongTermLiab': 'liability',
      'Equity': 'equity',
      'Income': 'revenue',
      'COGS': 'expense',
      'Expense': 'expense',
      'OthIncome': 'revenue',
      'OthExpense': 'expense',
    }

    return typeMap[nsType] || 'asset'
  }

  /**
   * Map NetSuite vendor record to Vendor interface
   */
  private mapNetSuiteVendorToVendor(nsVendor: any): Vendor {
    return {
      id: crypto.randomUUID(),
      externalId: nsVendor.id,
      name: nsVendor.companyName || nsVendor.entityId,
      email: nsVendor.email,
      phone: nsVendor.phone,
      taxId: nsVendor.taxNumber,
      currency: nsVendor.currency || 'USD',
      paymentTerms: nsVendor.terms,
      metadata: {
        netsuiteId: nsVendor.id,
        entityId: nsVendor.entityId,
      },
    }
  }

  /**
   * Map NetSuite bill record to Invoice interface
   */
  private mapNetSuiteBillToInvoice(nsBill: any, lineItems: InvoiceLineItem[]): Invoice {
    const statusMap: Record<string, Invoice['status']> = {
      'VendBill:A': 'open',
      'VendBill:B': 'partial',
      'VendBill:D': 'paid',
      'VendBill:V': 'cancelled',
    }

    return {
      id: crypto.randomUUID(),
      externalId: nsBill.id,
      vendorId: nsBill.entity,
      vendorName: nsBill.vendorName || '',
      amount: parseFloat(nsBill.total || '0'),
      currency: nsBill.currency || 'USD',
      dueDate: new Date(nsBill.dueDate),
      invoiceDate: new Date(nsBill.tranDate),
      status: statusMap[nsBill.status] || 'open',
      lineItems,
      metadata: {
        netsuiteId: nsBill.id,
        tranId: nsBill.tranId,
        amountRemaining: nsBill.amountRemaining,
      },
    }
  }

  /**
   * Map NetSuite payment record to Payment interface
   */
  private mapNetSuitePaymentToPayment(nsPayment: any): Payment {
    const statusMap: Record<string, Payment['status']> = {
      'VendPymt:A': 'completed',
      'VendPymt:V': 'failed',
    }

    return {
      id: crypto.randomUUID(),
      externalId: nsPayment.id,
      invoiceId: '', // Will be populated from applied invoices
      vendorId: nsPayment.entity,
      amount: parseFloat(nsPayment.total || '0'),
      currency: 'USD',
      paymentDate: new Date(nsPayment.tranDate),
      paymentMethod: 'grain',
      status: statusMap[nsPayment.status] || 'completed',
      bankAccount: nsPayment.account,
      reference: nsPayment.memo,
      metadata: {
        netsuiteId: nsPayment.id,
        tranId: nsPayment.tranId,
      },
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new NetSuite adapter instance
 */
export function createNetSuiteAdapter(config: NetSuiteConfig): NetSuiteAdapter {
  return new NetSuiteAdapter(config)
}

export default NetSuiteAdapter
