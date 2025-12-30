// @ts-nocheck
/**
 * Sage Intacct ERP Adapter for Grain & Vault Treasury SDK
 *
 * Implements integration with Sage Intacct using:
 * - Web Services API with XML-based requests
 * - Session-based authentication (sender credentials + company credentials)
 * - Multi-entity support (Sage Intacct's core strength)
 * - API v3.0 specification compliance
 *
 * Sage Intacct API Documentation:
 * https://developer.intacct.com/web-services/
 *
 * Supports:
 * - Vendor management (CRUD operations)
 * - Bill/Invoice retrieval (APBILL records)
 * - Payment creation and sync (APPAYMENT records)
 * - Journal entries for GRAIN transactions
 * - GL account and department mapping
 * - Multi-entity operations (locations, departments)
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
// SAGE INTACCT-SPECIFIC TYPES
// ============================================================================

export interface SageIntacctConfig extends ERPConnectionConfig {
  senderId: string                    // Web Services sender ID
  senderPassword: string              // Web Services sender password
  companyId: string                   // Intacct company ID
  userId: string                      // Intacct user ID
  userPassword: string                // Intacct user password
  entityId?: string                   // For multi-entity: specific entity ID
  locationId?: string                 // Default location ID
  departmentId?: string               // Default department ID
  apiVersion?: string                 // API version (default: "3.0")
  useTransaction?: boolean            // Use transaction for batch operations
}

interface IntacctVendorRecord {
  VENDORID: string
  NAME: string
  NAME1?: string                      // First name (if individual)
  NAME2?: string                      // Last name (if individual)
  DISPLAYCONTACT?: {
    PRINTAS?: string
    EMAIL1?: string
    PHONE1?: string
  }
  STATUS: 'active' | 'inactive'
  TAXID?: string
  CURRENCY?: string
  TERMNAME?: string
  PAYMETHOD?: string
  PAYMENTPRIORITY?: string
  BILLINGTYPE?: string
  VENDTYPE?: string
  PARENTID?: string
  WHENCREATED?: string
  WHENMODIFIED?: string
  LOCATIONID?: string
}

interface IntacctBillRecord {
  RECORDNO: string
  RECORDID: string
  VENDORID: string
  VENDORNAME?: string
  DOCNUMBER?: string
  DESCRIPTION?: string
  WHENCREATED: string
  WHENPOSTED?: string
  WHENDUE: string
  CURRENCY?: string
  BASECURR?: string
  TOTALENTERED: number
  TOTALSELECTED: number
  TOTALPAID: number
  TOTALDUE: number
  STATE: 'Draft' | 'Pending' | 'Posted' | 'Partially Paid' | 'Paid' | 'Reversed'
  APBILLITEMS?: {
    APBILLITEM: IntacctBillItem | IntacctBillItem[]
  }
  ENTITY?: string
  LOCATIONID?: string
  DEPARTMENTID?: string
}

interface IntacctBillItem {
  RECORDNO: string
  LINE_NO: number
  ACCOUNTNO?: string
  ACCOUNTLABEL?: string
  AMOUNT: number
  MEMO?: string
  LOCATIONID?: string
  DEPARTMENTID?: string
  CLASSID?: string
  PROJECTID?: string
}

interface IntacctPaymentRecord {
  RECORDNO: string
  RECORDID: string
  VENDORID: string
  VENDORNAME?: string
  PAYMENTDATE: string
  PAYMENTMETHOD: string
  FINANCIALENTITY?: string
  CURRENCY?: string
  BASECURRENCY?: string
  TOTALENTERED: number
  TOTALPAID: number
  STATE: 'Posted' | 'Voided' | 'Reversed'
  DOCNUMBER?: string
  DESCRIPTION?: string
  APPAYMENTDETAILS?: {
    APPAYMENTDETAIL: IntacctPaymentDetail | IntacctPaymentDetail[]
  }
}

interface IntacctPaymentDetail {
  RECORDNO: string
  RECORDKEY: string          // Bill record number
  PAYMENTAMOUNT: number
  INLINEKEY?: string         // Bill line item key
}

interface IntacctJournalEntry {
  RECORDNO: string
  JOURNAL: string
  BATCH_DATE: string
  BATCH_TITLE?: string
  DESCRIPTION?: string
  STATE: 'Draft' | 'Posted' | 'Reversed'
  GLBATCH?: {
    ENTRIES?: {
      GLENTRY: IntacctGLEntry | IntacctGLEntry[]
    }
  }
}

interface IntacctGLEntry {
  RECORDNO?: string
  ACCOUNTNO: string
  TR_TYPE: 'Debit' | 'Credit'
  TRX_AMOUNT: number
  CURRENCY?: string
  DESCRIPTION?: string
  LOCATIONID?: string
  DEPARTMENTID?: string
  CLASSID?: string
}

interface IntacctGLAccount {
  RECORDNO: string
  ACCOUNTNO: string
  TITLE: string
  ACCOUNTTYPE: string
  NORMALBALANCE: 'debit' | 'credit'
  CLOSINGTYPE?: string
  STATUS: 'active' | 'inactive'
  CATEGORY?: string
  PARENTID?: string
}

interface IntacctDepartment {
  RECORDNO: string
  DEPARTMENTID: string
  TITLE: string
  STATUS: 'active' | 'inactive'
  PARENTID?: string
  MANAGERID?: string
}

interface IntacctLocation {
  RECORDNO: string
  LOCATIONID: string
  NAME: string
  STATUS: 'active' | 'inactive'
  PARENTID?: string
  STARTDATE?: string
  ENDDATE?: string
}

interface IntacctAPIResponse {
  response: {
    control: {
      status: 'success' | 'failure'
      senderid: string
      controlid: string
      uniqueid: string
      dtdversion: string
    }
    operation: {
      authentication: {
        status: 'success' | 'failure'
        userid?: string
        companyid?: string
        locationid?: string
        sessiontimestamp?: string
        sessiontimeout?: string
      }
      result: IntacctResult | IntacctResult[]
    } | {
      error?: {
        errorno: string
        description: string
        description2?: string
        correction?: string
      }
    }
  }
}

interface IntacctResult {
  status: 'success' | 'failure'
  function: string
  controlid: string
  key?: string
  data?: {
    '@attributes'?: { listtype?: string; count?: string; totalcount?: string }
    [key: string]: any
  }
  errormessage?: {
    error: {
      errorno: string
      description: string
      description2?: string
      correction?: string
    } | Array<{
      errorno: string
      description: string
      description2?: string
      correction?: string
    }>
  }
}

// ============================================================================
// SAGE INTACCT ADAPTER CLASS
// ============================================================================

export class SageIntacctAdapter extends BaseERPAdapter {
  private intacctConfig: SageIntacctConfig
  private sessionId?: string
  private sessionExpiry?: Date
  private readonly apiEndpoint = 'https://api.intacct.com/ia/xml/xmlgw.phtml'
  private controlId = 0

  constructor(config: SageIntacctConfig) {
    super(config)
    this.intacctConfig = config

    // Override default GL mappings for Sage Intacct
    this.glMappings = {
      'payment': '2000',           // Accounts Payable
      'receipt': '1000',           // Cash - Operating
      'credit_draw': '2100',       // Credit Line Payable
      'credit_repay': '2100',      // Credit Line Payable
      'grain_appreciation': '4900', // Other Income
      'grain_reserve': '1200',     // GRAIN Reserve Asset
    }
  }

  // ============================================================================
  // CONNECTION METHODS
  // ============================================================================

  async connect(): Promise<void> {
    try {
      // Create a session by sending a login request
      const response = await this.sendRequest([
        this.buildFunction('getAPISession', {})
      ])

      const result = this.getResult(response, 'getAPISession')
      if (result.status === 'success' && result.data?.api_session) {
        this.sessionId = result.data.api_session.sessionid
        this.sessionExpiry = new Date(Date.now() + (result.data.api_session.timeout || 900) * 1000)
        this.connectionStatus = 'connected'
        console.log(`Connected to Sage Intacct company: ${this.intacctConfig.companyId}`)
      } else {
        throw new Error('Failed to obtain session')
      }
    } catch (error) {
      this.connectionStatus = 'error'
      throw new Error(`Failed to connect to Sage Intacct: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async disconnect(): Promise<void> {
    this.sessionId = undefined
    this.sessionExpiry = undefined
    this.connectionStatus = 'disconnected'
    console.log('Disconnected from Sage Intacct')
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.sendRequest([
        this.buildFunction('inspect', { object: 'VENDOR' })
      ])
      const result = this.getResult(response, 'inspect')
      return result.status === 'success'
    } catch (error) {
      console.error('Sage Intacct connection test failed:', error)
      return false
    }
  }

  // ============================================================================
  // VENDOR METHODS
  // ============================================================================

  async getVendors(filters?: { modifiedSince?: Date; limit?: number }): Promise<Vendor[]> {
    try {
      const limit = filters?.limit || 1000
      let query = `VENDORID != ''`

      if (filters?.modifiedSince) {
        const dateStr = this.formatIntacctDate(filters.modifiedSince)
        query += ` AND WHENMODIFIED >= '${dateStr}'`
      }

      // Add entity filter if multi-entity is enabled
      if (this.intacctConfig.entityId) {
        query += ` AND ENTITY = '${this.intacctConfig.entityId}'`
      }

      const response = await this.sendRequest([
        this.buildFunction('readByQuery', {
          object: 'VENDOR',
          fields: '*',
          query,
          pagesize: limit
        })
      ])

      const result = this.getResult(response, 'readByQuery')
      if (result.status !== 'success') {
        throw new Error(this.extractError(result))
      }

      const vendors = this.normalizeArray(result.data?.VENDOR)
      return vendors.map(v => this.mapIntacctVendorToVendor(v))
    } catch (error) {
      throw new Error(`Failed to get vendors: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getVendor(vendorId: string): Promise<Vendor | null> {
    try {
      const response = await this.sendRequest([
        this.buildFunction('read', {
          object: 'VENDOR',
          keys: vendorId,
          fields: '*'
        })
      ])

      const result = this.getResult(response, 'read')
      if (result.status !== 'success' || !result.data?.VENDOR) {
        return null
      }

      return this.mapIntacctVendorToVendor(result.data.VENDOR)
    } catch (error) {
      throw new Error(`Failed to get vendor ${vendorId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async createVendor(vendor: Partial<Vendor>): Promise<SyncResult<Vendor>> {
    try {
      const vendorData = {
        VENDORID: vendor.externalId || this.generateVendorId(vendor.name || ''),
        NAME: vendor.name,
        DISPLAYCONTACT: {
          PRINTAS: vendor.name,
          EMAIL1: vendor.email,
          PHONE1: vendor.phone
        },
        STATUS: 'active',
        TAXID: vendor.taxId,
        CURRENCY: vendor.currency || 'USD',
        TERMNAME: vendor.paymentTerms,
        LOCATIONID: this.intacctConfig.locationId
      }

      const response = await this.sendRequest([
        this.buildFunction('create', {
          VENDOR: vendorData
        })
      ])

      const result = this.getResult(response, 'create')
      if (result.status !== 'success') {
        return {
          success: false,
          error: this.extractError(result)
        }
      }

      const createdVendor = await this.getVendor(vendorData.VENDORID)
      return {
        success: true,
        data: createdVendor!,
        externalId: vendorData.VENDORID
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
      const updateData: any = { VENDORID: vendorId }

      if (updates.name) updateData.NAME = updates.name
      if (updates.email || updates.phone) {
        updateData.DISPLAYCONTACT = {
          EMAIL1: updates.email,
          PHONE1: updates.phone
        }
      }
      if (updates.taxId) updateData.TAXID = updates.taxId

      const response = await this.sendRequest([
        this.buildFunction('update', {
          VENDOR: updateData
        })
      ])

      const result = this.getResult(response, 'update')
      if (result.status !== 'success') {
        return {
          success: false,
          error: this.extractError(result)
        }
      }

      const updatedVendor = await this.getVendor(vendorId)
      return {
        success: true,
        data: updatedVendor!,
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
      const conditions: string[] = ["RECORDID != ''"]

      // Status filter
      if (filters?.status && filters.status.length > 0) {
        const statusMap: Record<Invoice['status'], string[]> = {
          'open': ['Posted'],
          'partial': ['Partially Paid'],
          'paid': ['Paid'],
          'cancelled': ['Reversed'],
          'disputed': ['Posted'] // Map disputed to open
        }
        const states = filters.status.flatMap(s => statusMap[s])
        const uniqueStates = [...new Set(states)]
        conditions.push(`STATE IN (${uniqueStates.map(s => `'${s}'`).join(',')})`)
      }

      if (filters?.vendorId) {
        conditions.push(`VENDORID = '${filters.vendorId}'`)
      }

      if (filters?.dueBefore) {
        conditions.push(`WHENDUE <= '${this.formatIntacctDate(filters.dueBefore)}'`)
      }

      if (filters?.dueAfter) {
        conditions.push(`WHENDUE >= '${this.formatIntacctDate(filters.dueAfter)}'`)
      }

      if (filters?.modifiedSince) {
        conditions.push(`WHENMODIFIED >= '${this.formatIntacctDate(filters.modifiedSince)}'`)
      }

      // Add entity filter
      if (this.intacctConfig.entityId) {
        conditions.push(`ENTITY = '${this.intacctConfig.entityId}'`)
      }

      const query = conditions.join(' AND ')

      const response = await this.sendRequest([
        this.buildFunction('readByQuery', {
          object: 'APBILL',
          fields: '*',
          query,
          pagesize: limit
        })
      ])

      const result = this.getResult(response, 'readByQuery')
      if (result.status !== 'success') {
        throw new Error(this.extractError(result))
      }

      const bills = this.normalizeArray(result.data?.APBILL)

      // Fetch line items for each bill
      const invoices = await Promise.all(
        bills.map(async (bill) => {
          const lineItems = await this.getBillLineItems(bill.RECORDNO)
          return this.mapIntacctBillToInvoice(bill, lineItems)
        })
      )

      return invoices
    } catch (error) {
      throw new Error(`Failed to get invoices: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    try {
      const response = await this.sendRequest([
        this.buildFunction('read', {
          object: 'APBILL',
          keys: invoiceId,
          fields: '*'
        })
      ])

      const result = this.getResult(response, 'read')
      if (result.status !== 'success' || !result.data?.APBILL) {
        return null
      }

      const lineItems = await this.getBillLineItems(invoiceId)
      return this.mapIntacctBillToInvoice(result.data.APBILL, lineItems)
    } catch (error) {
      throw new Error(`Failed to get invoice ${invoiceId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async getBillLineItems(billRecordNo: string): Promise<InvoiceLineItem[]> {
    try {
      const response = await this.sendRequest([
        this.buildFunction('readByQuery', {
          object: 'APBILLITEM',
          fields: '*',
          query: `RECORDKEY = '${billRecordNo}'`,
          pagesize: 100
        })
      ])

      const result = this.getResult(response, 'readByQuery')
      if (result.status !== 'success') {
        return []
      }

      const items = this.normalizeArray(result.data?.APBILLITEM)
      return items.map((item, index) => ({
        id: item.RECORDNO || `line-${index}`,
        description: item.MEMO || item.ACCOUNTLABEL || '',
        quantity: 1,
        unitPrice: parseFloat(item.AMOUNT || '0'),
        amount: parseFloat(item.AMOUNT || '0'),
        glAccount: item.ACCOUNTNO,
        costCenter: item.DEPARTMENTID || item.CLASSID
      }))
    } catch (error) {
      console.warn(`Failed to get line items for bill ${billRecordNo}:`, error)
      return []
    }
  }

  // ============================================================================
  // PAYMENT METHODS
  // ============================================================================

  async createPayment(payment: Partial<Payment>): Promise<SyncResult<Payment>> {
    try {
      // First get the bill details to apply payment correctly
      const bill = payment.invoiceId ? await this.getInvoice(payment.invoiceId) : null

      const paymentData: any = {
        FINANCIALENTITY: payment.bankAccount || 'CHK', // Default checking account
        VENDORID: payment.vendorId,
        PAYMENTMETHOD: this.mapPaymentMethod(payment.paymentMethod),
        PAYMENTDATE: {
          YEAR: new Date(payment.paymentDate || new Date()).getFullYear(),
          MONTH: new Date(payment.paymentDate || new Date()).getMonth() + 1,
          DAY: new Date(payment.paymentDate || new Date()).getDate()
        },
        CURRENCY: payment.currency || 'USD',
        DESCRIPTION: payment.reference || `GRAIN Payment ${payment.grainTransactionId || ''}`
      }

      // Add bill application if invoice provided
      if (payment.invoiceId) {
        paymentData.APPAYMENTDETAILS = {
          APPAYMENTDETAIL: {
            RECORDKEY: payment.invoiceId,
            PAYMENTAMOUNT: payment.amount
          }
        }
      }

      const response = await this.sendRequest([
        this.buildFunction('create', {
          APPAYMENT: paymentData
        })
      ])

      const result = this.getResult(response, 'create')
      if (result.status !== 'success') {
        return {
          success: false,
          error: this.extractError(result)
        }
      }

      const paymentId = result.key || result.data?.RECORDNO

      const createdPayment: Payment = {
        id: crypto.randomUUID(),
        externalId: paymentId,
        invoiceId: payment.invoiceId || '',
        vendorId: payment.vendorId || '',
        amount: payment.amount || 0,
        currency: payment.currency || 'USD',
        paymentDate: payment.paymentDate || new Date(),
        paymentMethod: payment.paymentMethod || 'grain',
        grainTransactionId: payment.grainTransactionId,
        status: 'completed',
        bankAccount: payment.bankAccount,
        reference: payment.reference,
        metadata: {
          intacctRecordNo: paymentId
        }
      }

      return {
        success: true,
        data: createdPayment,
        externalId: paymentId
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
      const response = await this.sendRequest([
        this.buildFunction('read', {
          object: 'APPAYMENT',
          keys: paymentId,
          fields: '*'
        })
      ])

      const result = this.getResult(response, 'read')
      if (result.status !== 'success' || !result.data?.APPAYMENT) {
        return null
      }

      return this.mapIntacctPaymentToPayment(result.data.APPAYMENT)
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
      const conditions: string[] = ["RECORDNO != ''"]

      if (filters?.vendorId) {
        conditions.push(`VENDORID = '${filters.vendorId}'`)
      }

      if (filters?.dateFrom) {
        conditions.push(`PAYMENTDATE >= '${this.formatIntacctDate(filters.dateFrom)}'`)
      }

      if (filters?.dateTo) {
        conditions.push(`PAYMENTDATE <= '${this.formatIntacctDate(filters.dateTo)}'`)
      }

      const query = conditions.join(' AND ')

      const response = await this.sendRequest([
        this.buildFunction('readByQuery', {
          object: 'APPAYMENT',
          fields: '*',
          query,
          pagesize: limit
        })
      ])

      const result = this.getResult(response, 'readByQuery')
      if (result.status !== 'success') {
        throw new Error(this.extractError(result))
      }

      const payments = this.normalizeArray(result.data?.APPAYMENT)
      return payments.map(p => this.mapIntacctPaymentToPayment(p))
    } catch (error) {
      throw new Error(`Failed to get payments: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ============================================================================
  // JOURNAL ENTRY METHODS
  // ============================================================================

  async createJournalEntry(entry: Partial<JournalEntry>): Promise<SyncResult<JournalEntry>> {
    try {
      const glEntries = entry.lines?.map(line => ({
        ACCOUNTNO: line.accountId,
        TR_TYPE: line.debit > 0 ? 'Debit' : 'Credit',
        TRX_AMOUNT: Math.abs(line.debit || line.credit || 0),
        CURRENCY: 'USD',
        DESCRIPTION: line.memo,
        LOCATIONID: this.intacctConfig.locationId,
        DEPARTMENTID: line.department || this.intacctConfig.departmentId
      }))

      const journalData = {
        JOURNAL: 'GJ',  // General Journal
        BATCH_DATE: {
          YEAR: new Date(entry.date || new Date()).getFullYear(),
          MONTH: new Date(entry.date || new Date()).getMonth() + 1,
          DAY: new Date(entry.date || new Date()).getDate()
        },
        BATCH_TITLE: entry.description || 'GRAIN Transaction',
        ENTRIES: {
          GLENTRY: glEntries
        }
      }

      const response = await this.sendRequest([
        this.buildFunction('create', {
          GLBATCH: journalData
        })
      ])

      const result = this.getResult(response, 'create')
      if (result.status !== 'success') {
        return {
          success: false,
          error: this.extractError(result)
        }
      }

      const journalId = result.key || result.data?.RECORDNO

      const createdEntry: JournalEntry = {
        id: crypto.randomUUID(),
        externalId: journalId,
        date: entry.date || new Date(),
        description: entry.description || '',
        lines: entry.lines || [],
        status: 'posted',
        reference: entry.reference,
        metadata: {
          intacctRecordNo: journalId
        }
      }

      return {
        success: true,
        data: createdEntry,
        externalId: journalId
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
      const response = await this.sendRequest([
        this.buildFunction('readByQuery', {
          object: 'GLACCOUNT',
          fields: '*',
          query: "STATUS = 'active'",
          pagesize: 1000
        })
      ])

      const result = this.getResult(response, 'readByQuery')
      if (result.status !== 'success') {
        throw new Error(this.extractError(result))
      }

      const accounts = this.normalizeArray(result.data?.GLACCOUNT)
      return accounts.map(acct => ({
        id: acct.RECORDNO,
        code: acct.ACCOUNTNO,
        name: acct.TITLE,
        type: this.mapIntacctAccountType(acct.ACCOUNTTYPE),
        currency: 'USD',
        isActive: acct.STATUS === 'active',
        parentId: acct.PARENTID
      }))
    } catch (error) {
      throw new Error(`Failed to get GL accounts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getCostCenters(): Promise<CostCenter[]> {
    try {
      // Sage Intacct uses Departments as primary cost centers
      const departments = await this.getDepartments()
      const locations = await this.getLocations()

      return [...departments, ...locations]
    } catch (error) {
      throw new Error(`Failed to get cost centers: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async getDepartments(): Promise<CostCenter[]> {
    try {
      const response = await this.sendRequest([
        this.buildFunction('readByQuery', {
          object: 'DEPARTMENT',
          fields: '*',
          query: "STATUS = 'active'",
          pagesize: 500
        })
      ])

      const result = this.getResult(response, 'readByQuery')
      if (result.status !== 'success') {
        return []
      }

      const departments = this.normalizeArray(result.data?.DEPARTMENT)
      return departments.map(dept => ({
        id: dept.RECORDNO,
        code: dept.DEPARTMENTID,
        name: dept.TITLE,
        isActive: dept.STATUS === 'active',
        parentId: dept.PARENTID
      }))
    } catch (error) {
      console.warn('Failed to get departments:', error)
      return []
    }
  }

  private async getLocations(): Promise<CostCenter[]> {
    try {
      const response = await this.sendRequest([
        this.buildFunction('readByQuery', {
          object: 'LOCATION',
          fields: '*',
          query: "STATUS = 'active'",
          pagesize: 500
        })
      ])

      const result = this.getResult(response, 'readByQuery')
      if (result.status !== 'success') {
        return []
      }

      const locations = this.normalizeArray(result.data?.LOCATION)
      return locations.map(loc => ({
        id: loc.RECORDNO,
        code: `LOC-${loc.LOCATIONID}`,
        name: loc.NAME,
        isActive: loc.STATUS === 'active',
        parentId: loc.PARENTID
      }))
    } catch (error) {
      console.warn('Failed to get locations:', error)
      return []
    }
  }

  // ============================================================================
  // MULTI-ENTITY SUPPORT
  // ============================================================================

  /**
   * Get list of entities (subsidiaries) in multi-entity setup
   */
  async getEntities(): Promise<Array<{ id: string; name: string; currency: string }>> {
    try {
      const response = await this.sendRequest([
        this.buildFunction('readByQuery', {
          object: 'LOCATIONENTITY',
          fields: '*',
          query: "STATUS = 'active'",
          pagesize: 100
        })
      ])

      const result = this.getResult(response, 'readByQuery')
      if (result.status !== 'success') {
        return []
      }

      const entities = this.normalizeArray(result.data?.LOCATIONENTITY)
      return entities.map(e => ({
        id: e.LOCATIONID,
        name: e.NAME,
        currency: e.CURRENCY || 'USD'
      }))
    } catch (error) {
      console.warn('Failed to get entities:', error)
      return []
    }
  }

  /**
   * Switch context to a different entity
   */
  setEntity(entityId: string): void {
    this.intacctConfig.entityId = entityId
  }

  // ============================================================================
  // XML REQUEST BUILDING METHODS
  // ============================================================================

  private async sendRequest(functions: string[]): Promise<IntacctAPIResponse> {
    // Refresh session if needed
    if (this.sessionId && this.sessionExpiry && new Date() >= this.sessionExpiry) {
      await this.connect()
    }

    const xml = this.buildRequestXML(functions)

    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml'
      },
      body: xml
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Sage Intacct API Error: ${response.status} - ${error}`)
    }

    const responseXml = await response.text()
    return this.parseXMLResponse(responseXml)
  }

  private buildRequestXML(functions: string[]): string {
    const controlId = `ctrl-${Date.now()}-${++this.controlId}`

    const authentication = this.sessionId
      ? `<sessionid>${this.sessionId}</sessionid>`
      : `
        <login>
          <userid>${this.escapeXml(this.intacctConfig.userId)}</userid>
          <companyid>${this.escapeXml(this.intacctConfig.companyId)}</companyid>
          <password>${this.escapeXml(this.intacctConfig.userPassword)}</password>
          ${this.intacctConfig.entityId ? `<locationid>${this.escapeXml(this.intacctConfig.entityId)}</locationid>` : ''}
        </login>
      `

    const content = functions.join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <control>
    <senderid>${this.escapeXml(this.intacctConfig.senderId)}</senderid>
    <password>${this.escapeXml(this.intacctConfig.senderPassword)}</password>
    <controlid>${controlId}</controlid>
    <uniqueid>false</uniqueid>
    <dtdversion>${this.intacctConfig.apiVersion || '3.0'}</dtdversion>
    <includewhitespace>false</includewhitespace>
  </control>
  <operation ${this.intacctConfig.useTransaction ? 'transaction="true"' : ''}>
    <authentication>
      ${authentication}
    </authentication>
    <content>
      ${content}
    </content>
  </operation>
</request>`
  }

  private buildFunction(functionName: string, params: Record<string, any>): string {
    const controlId = `fn-${functionName}-${Date.now()}`

    let content = ''
    switch (functionName) {
      case 'getAPISession':
        content = '<getAPISession/>'
        break

      case 'inspect':
        content = `<inspect><object>${params.object}</object></inspect>`
        break

      case 'readByQuery':
        content = `
          <readByQuery>
            <object>${params.object}</object>
            <fields>${params.fields || '*'}</fields>
            <query>${this.escapeXml(params.query)}</query>
            <pagesize>${params.pagesize || 1000}</pagesize>
          </readByQuery>
        `
        break

      case 'read':
        content = `
          <read>
            <object>${params.object}</object>
            <keys>${params.keys}</keys>
            <fields>${params.fields || '*'}</fields>
          </read>
        `
        break

      case 'create':
        content = `<create>${this.objectToXml(params)}</create>`
        break

      case 'update':
        content = `<update>${this.objectToXml(params)}</update>`
        break

      case 'delete':
        content = `
          <delete>
            <object>${params.object}</object>
            <keys>${params.keys}</keys>
          </delete>
        `
        break

      default:
        content = `<${functionName}>${this.objectToXml(params)}</${functionName}>`
    }

    return `<function controlid="${controlId}">${content}</function>`
  }

  private objectToXml(obj: any, indent: string = ''): string {
    if (obj === null || obj === undefined) {
      return ''
    }

    if (typeof obj !== 'object') {
      return this.escapeXml(String(obj))
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.objectToXml(item, indent)).join('\n')
    }

    let xml = ''
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue

      if (typeof value === 'object' && !Array.isArray(value)) {
        xml += `${indent}<${key}>\n${this.objectToXml(value, indent + '  ')}${indent}</${key}>\n`
      } else if (Array.isArray(value)) {
        xml += `${indent}<${key}>\n`
        value.forEach(item => {
          if (typeof item === 'object') {
            const itemKey = Object.keys(item)[0]
            if (itemKey) {
              xml += `${indent}  <${itemKey}>${this.objectToXml(item[itemKey], indent + '    ')}</${itemKey}>\n`
            }
          } else {
            xml += `${indent}  ${this.escapeXml(String(item))}\n`
          }
        })
        xml += `${indent}</${key}>\n`
      } else {
        xml += `${indent}<${key}>${this.escapeXml(String(value))}</${key}>\n`
      }
    }
    return xml
  }

  private parseXMLResponse(xml: string): IntacctAPIResponse {
    // Simple XML parser for Intacct responses
    // In production, use a proper XML parser like xml2js or fast-xml-parser
    const response: IntacctAPIResponse = {
      response: {
        control: {
          status: 'success',
          senderid: '',
          controlid: '',
          uniqueid: '',
          dtdversion: ''
        },
        operation: {
          authentication: {
            status: 'success'
          },
          result: []
        }
      }
    }

    // Parse control status
    const controlStatusMatch = xml.match(/<control>[\s\S]*?<status>(\w+)<\/status>/)
    if (controlStatusMatch) {
      response.response.control.status = controlStatusMatch[1] as 'success' | 'failure'
    }

    // Parse authentication status
    const authStatusMatch = xml.match(/<authentication>[\s\S]*?<status>(\w+)<\/status>/)
    if (authStatusMatch) {
      (response.response.operation as any).authentication.status = authStatusMatch[1] as 'success' | 'failure'
    }

    // Parse session ID if present
    const sessionMatch = xml.match(/<sessionid>([^<]+)<\/sessionid>/)
    if (sessionMatch) {
      (response.response.operation as any).result = [{
        status: 'success',
        function: 'getAPISession',
        controlid: 'session',
        data: {
          api_session: {
            sessionid: sessionMatch[1],
            timeout: 900
          }
        }
      }]
      return response
    }

    // Parse function results
    const functionMatches = xml.matchAll(/<result>[\s\S]*?<status>(\w+)<\/status>[\s\S]*?<function>(\w+)<\/function>[\s\S]*?<controlid>([^<]+)<\/controlid>([\s\S]*?)<\/result>/g)

    const results: IntacctResult[] = []
    for (const match of functionMatches) {
      const result: IntacctResult = {
        status: match[1] as 'success' | 'failure',
        function: match[2],
        controlid: match[3]
      }

      // Parse data or error
      if (result.status === 'success') {
        const dataMatch = match[4].match(/<data[^>]*>([\s\S]*)<\/data>/)
        if (dataMatch) {
          result.data = this.parseXmlData(dataMatch[1])
        }

        // Parse key if present
        const keyMatch = match[4].match(/<key>([^<]+)<\/key>/)
        if (keyMatch) {
          result.key = keyMatch[1]
        }
      } else {
        const errorMatch = match[4].match(/<errormessage>[\s\S]*?<description>([^<]+)<\/description>/)
        if (errorMatch) {
          result.errormessage = {
            error: {
              errorno: '',
              description: errorMatch[1]
            }
          }
        }
      }

      results.push(result)
    }

    (response.response.operation as any).result = results.length === 1 ? results[0] : results
    return response
  }

  private parseXmlData(xml: string): Record<string, any> {
    // Simplified XML data parser
    const data: Record<string, any> = {}

    // Match top-level elements
    const elementMatches = xml.matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)

    for (const match of elementMatches) {
      const key = match[1]
      const value = match[2]

      // Check if it contains nested elements
      if (/<\w+>/.test(value)) {
        if (!data[key]) {
          data[key] = this.parseXmlData(value)
        } else if (Array.isArray(data[key])) {
          data[key].push(this.parseXmlData(value))
        } else {
          data[key] = [data[key], this.parseXmlData(value)]
        }
      } else {
        data[key] = value.trim()
      }
    }

    return data
  }

  private getResult(response: IntacctAPIResponse, functionName: string): IntacctResult {
    const operation = response.response.operation

    if ('error' in operation && operation.error) {
      return {
        status: 'failure',
        function: functionName,
        controlid: '',
        errormessage: {
          error: {
            errorno: operation.error.errorno,
            description: operation.error.description
          }
        }
      }
    }

    const results = Array.isArray(operation.result) ? operation.result : [operation.result]
    const result = results.find(r => r.function === functionName) || results[0]

    return result || {
      status: 'failure',
      function: functionName,
      controlid: '',
      errormessage: {
        error: {
          errorno: 'UNKNOWN',
          description: 'No result found'
        }
      }
    }
  }

  private extractError(result: IntacctResult): string {
    if (!result.errormessage) {
      return 'Unknown error'
    }

    const errors = Array.isArray(result.errormessage.error)
      ? result.errormessage.error
      : [result.errormessage.error]

    return errors.map(e => e.description).join('; ')
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  private formatIntacctDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${month}/${day}/${year}`
  }

  private normalizeArray<T>(value: T | T[] | undefined): T[] {
    if (!value) return []
    return Array.isArray(value) ? value : [value]
  }

  private generateVendorId(name: string): string {
    const base = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15)
    const suffix = Date.now().toString().slice(-5)
    return `${base}-${suffix}`
  }

  private mapPaymentMethod(method?: string): string {
    const methodMap: Record<string, string> = {
      'grain': 'EFT',
      'wire': 'EFT',
      'ach': 'ACH',
      'check': 'Printed Check'
    }
    return methodMap[method || 'grain'] || 'EFT'
  }

  private mapIntacctAccountType(intacctType: string): GLAccount['type'] {
    const typeMap: Record<string, GLAccount['type']> = {
      'incomestatement': 'revenue',
      'balancesheet': 'asset',
      'Asset': 'asset',
      'Liability': 'liability',
      'Equity': 'equity',
      'Revenue': 'revenue',
      'Expense': 'expense',
      'Income': 'revenue',
      'COGS': 'expense',
      'Statistical': 'asset'
    }
    return typeMap[intacctType] || 'asset'
  }

  private mapIntacctVendorToVendor(intacctVendor: any): Vendor {
    return {
      id: crypto.randomUUID(),
      externalId: intacctVendor.VENDORID,
      name: intacctVendor.NAME || intacctVendor.DISPLAYCONTACT?.PRINTAS || '',
      email: intacctVendor.DISPLAYCONTACT?.EMAIL1,
      phone: intacctVendor.DISPLAYCONTACT?.PHONE1,
      taxId: intacctVendor.TAXID,
      currency: intacctVendor.CURRENCY || 'USD',
      paymentTerms: intacctVendor.TERMNAME,
      metadata: {
        intacctVendorId: intacctVendor.VENDORID,
        recordNo: intacctVendor.RECORDNO,
        vendorType: intacctVendor.VENDTYPE,
        locationId: intacctVendor.LOCATIONID
      }
    }
  }

  private mapIntacctBillToInvoice(intacctBill: any, lineItems: InvoiceLineItem[]): Invoice {
    const statusMap: Record<string, Invoice['status']> = {
      'Draft': 'open',
      'Pending': 'open',
      'Posted': 'open',
      'Partially Paid': 'partial',
      'Paid': 'paid',
      'Reversed': 'cancelled'
    }

    return {
      id: crypto.randomUUID(),
      externalId: intacctBill.RECORDNO,
      vendorId: intacctBill.VENDORID,
      vendorName: intacctBill.VENDORNAME || '',
      amount: parseFloat(intacctBill.TOTALENTERED || '0'),
      currency: intacctBill.CURRENCY || 'USD',
      dueDate: new Date(intacctBill.WHENDUE),
      invoiceDate: new Date(intacctBill.WHENCREATED),
      status: statusMap[intacctBill.STATE] || 'open',
      lineItems,
      description: intacctBill.DESCRIPTION,
      costCenter: intacctBill.DEPARTMENTID,
      metadata: {
        intacctRecordNo: intacctBill.RECORDNO,
        recordId: intacctBill.RECORDID,
        docNumber: intacctBill.DOCNUMBER,
        totalDue: intacctBill.TOTALDUE,
        totalPaid: intacctBill.TOTALPAID,
        entity: intacctBill.ENTITY,
        locationId: intacctBill.LOCATIONID
      }
    }
  }

  private mapIntacctPaymentToPayment(intacctPayment: any): Payment {
    const statusMap: Record<string, Payment['status']> = {
      'Posted': 'completed',
      'Voided': 'reversed',
      'Reversed': 'reversed'
    }

    return {
      id: crypto.randomUUID(),
      externalId: intacctPayment.RECORDNO,
      invoiceId: '', // Will be populated from payment details
      vendorId: intacctPayment.VENDORID,
      amount: parseFloat(intacctPayment.TOTALPAID || intacctPayment.TOTALENTERED || '0'),
      currency: intacctPayment.CURRENCY || 'USD',
      paymentDate: new Date(intacctPayment.PAYMENTDATE),
      paymentMethod: 'grain',
      status: statusMap[intacctPayment.STATE] || 'completed',
      bankAccount: intacctPayment.FINANCIALENTITY,
      reference: intacctPayment.DOCNUMBER || intacctPayment.DESCRIPTION,
      metadata: {
        intacctRecordNo: intacctPayment.RECORDNO,
        recordId: intacctPayment.RECORDID,
        paymentMethod: intacctPayment.PAYMENTMETHOD
      }
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new Sage Intacct adapter instance
 *
 * @example
 * ```typescript
 * import { createSageIntacctAdapter } from '@grainandvault/treasury-sdk/adapters/sage-intacct'
 *
 * const intacct = createSageIntacctAdapter({
 *   senderId: 'MySenderID',
 *   senderPassword: 'MySenderPassword',
 *   companyId: 'MyCompanyID',
 *   userId: 'apiuser',
 *   userPassword: 'apipassword',
 *   endpoint: 'https://api.intacct.com/ia/xml/xmlgw.phtml',
 *   credentials: { type: 'basic' },
 *   // For multi-entity:
 *   entityId: 'US-WEST',
 *   locationId: 'SFO',
 *   departmentId: 'ENGINEERING'
 * })
 *
 * await intacct.connect()
 * const vendors = await intacct.getVendors()
 * const entities = await intacct.getEntities() // Multi-entity support
 * ```
 */
export function createSageIntacctAdapter(config: SageIntacctConfig): SageIntacctAdapter {
  return new SageIntacctAdapter(config)
}

export default SageIntacctAdapter
