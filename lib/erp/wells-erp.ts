// @ts-nocheck
/**
 * WellsAI Conversational ERP Module
 *
 * AI-native ERP functionality for users without existing ERP systems.
 * Users manage their entire business through natural conversation with Wells.
 *
 * Features:
 * - Invoicing (create, list, mark paid)
 * - Purchase Orders (create, approve)
 * - Vendors/Contacts (add, list, search)
 * - Inventory (basic tracking)
 * - Reports (AP, AR, cash flow, custom)
 *
 * All transactions include 1% Wells fee.
 * Data exportable to Merge.dev format for ERP migration.
 *
 * @example
 * ```typescript
 * const erp = new WellsERP(userId)
 *
 * // Natural language operations
 * const invoice = await erp.createInvoice("Create an invoice for Acme Corp for $5000 for consulting services")
 * const overdue = await erp.listInvoices("What invoices are overdue?")
 * const vendor = await erp.addVendor("Add a new vendor called TechSupply, contact is john@techsupply.com")
 * const report = await erp.generateReport('cashflow', { period: 'month' })
 * ```
 */

import { sql } from '@vercel/postgres'
import Anthropic from '@anthropic-ai/sdk'
import {
  WellsInvoiceService,
  type WellsInvoice,
  type CreateInvoiceRequest,
} from '@/lib/wells-erp/invoice-service'
import {
  WellsPOService,
  type WellsPurchaseOrder,
  type CreatePORequest,
} from '@/lib/wells-erp/po-service'
import {
  WellsVendorRegistry,
  type WellsVendor,
  type CreateVendorRequest,
} from '@/lib/wells-erp/vendor-registry'
import {
  WellsFinancialService,
} from '@/lib/wells-erp/financial-overview'
import { WELLS_ERP_TOOLS, WELLS_ERP_SYSTEM_PROMPT } from '@/lib/wells-erp/chat-tools'
import { calculateWellsFee, WELLS_FEE_CONFIG } from '@/lib/fees/wells-fee-service'

// ============================================================================
// TYPES
// ============================================================================

export interface Invoice {
  id: string
  invoiceNumber: string
  contactId?: string
  contactName: string
  contactEmail?: string
  items: InvoiceItem[]
  subtotal: number
  taxAmount: number
  wellsFee: number
  total: number
  amountPaid: number
  amountDue: number
  status: 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'cancelled'
  dueDate: Date
  createdAt: Date
  updatedAt: Date
  aiCommand?: string
}

export interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  amount: number
  category?: string
}

export interface PurchaseOrder {
  id: string
  poNumber: string
  vendorId?: string
  vendorName: string
  vendorEmail?: string
  items: POItem[]
  subtotal: number
  taxAmount: number
  shippingAmount: number
  wellsFee: number
  total: number
  status: 'draft' | 'pending_approval' | 'approved' | 'sent' | 'acknowledged' | 'shipped' | 'received' | 'completed' | 'cancelled'
  expectedDeliveryDate?: Date
  createdAt: Date
  updatedAt: Date
  aiCommand?: string
}

export interface POItem {
  id: string
  sku?: string
  description: string
  quantity: number
  unitPrice: number
  amount: number
  deliveredQuantity: number
}

export interface Vendor {
  id: string
  name: string
  displayName?: string
  type: 'supplier' | 'customer' | 'both' | 'prospect'
  status: 'prospect' | 'pending' | 'active' | 'preferred' | 'suspended' | 'inactive'
  email?: string
  phone?: string
  website?: string
  contacts: VendorContact[]
  addresses: VendorAddress[]
  paymentTerms: string
  categories: string[]
  totalOrders: number
  totalSpend: number
  averageOrderValue: number
  performanceScore: number
  createdAt: Date
  updatedAt: Date
}

export interface VendorContact {
  name: string
  email?: string
  phone?: string
  role?: string
  isPrimary: boolean
}

export interface VendorAddress {
  type: 'billing' | 'shipping' | 'main'
  line1: string
  line2?: string
  city: string
  state: string
  postalCode: string
  country: string
}

export interface InventoryItem {
  id: string
  sku: string
  name: string
  description?: string
  category?: string
  quantity: number
  unitCost: number
  totalValue: number
  reorderPoint: number
  location?: string
  lastUpdated: Date
}

export interface Report {
  type: 'ap' | 'ar' | 'cashflow' | 'custom'
  title: string
  period: { start: Date; end: Date }
  generatedAt: Date
  summary: string
  data: Record<string, unknown>
  insights: string[]
}

// Natural language parsing result
export interface ParsedCommand {
  action: string
  entity: 'invoice' | 'po' | 'vendor' | 'inventory' | 'report'
  params: Record<string, unknown>
  confidence: number
  originalText: string
}

// ============================================================================
// NATURAL LANGUAGE PARSER
// ============================================================================

class NaturalLanguageParser {
  /**
   * Parse conversational input to structured ERP actions
   */
  static parse(input: string): ParsedCommand {
    const lower = input.toLowerCase()

    // Invoice commands
    if (this.matchesInvoice(lower)) {
      return this.parseInvoiceCommand(input, lower)
    }

    // PO commands
    if (this.matchesPO(lower)) {
      return this.parsePOCommand(input, lower)
    }

    // Vendor commands
    if (this.matchesVendor(lower)) {
      return this.parseVendorCommand(input, lower)
    }

    // Inventory commands
    if (this.matchesInventory(lower)) {
      return this.parseInventoryCommand(input, lower)
    }

    // Report commands
    if (this.matchesReport(lower)) {
      return this.parseReportCommand(input, lower)
    }

    // Default: unknown
    return {
      action: 'unknown',
      entity: 'invoice',
      params: { query: input },
      confidence: 0,
      originalText: input,
    }
  }

  private static matchesInvoice(lower: string): boolean {
    return lower.includes('invoice') || lower.includes('bill') || lower.includes('billing')
  }

  private static matchesPO(lower: string): boolean {
    return lower.includes('purchase order') || lower.includes(' po ') ||
           lower.includes('order from') || (lower.includes('order') && lower.includes('create'))
  }

  private static matchesVendor(lower: string): boolean {
    return lower.includes('vendor') || lower.includes('supplier') || lower.includes('customer') ||
           lower.includes('contact') || (lower.includes('add') && lower.includes('called'))
  }

  private static matchesInventory(lower: string): boolean {
    return lower.includes('inventory') || lower.includes('stock') || lower.includes('track item')
  }

  private static matchesReport(lower: string): boolean {
    return lower.includes('report') || lower.includes('cash flow') || lower.includes('cashflow') ||
           lower.includes('accounts payable') || lower.includes('accounts receivable') ||
           lower.includes('ap ') || lower.includes('ar ') || lower.includes('summary')
  }

  private static parseInvoiceCommand(input: string, lower: string): ParsedCommand {
    // Extract amount
    const amountMatch = input.match(/\$?([\d,]+(?:\.\d{2})?)/i)
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : undefined

    // Extract company/contact name
    const forMatch = input.match(/(?:for|to)\s+([A-Z][A-Za-z\s&]+?)(?:\s+for|\s+\$|\s*$)/i)
    const contactName = forMatch ? forMatch[1].trim() : undefined

    // Extract description
    const descMatch = input.match(/(?:for\s+(?:\$[\d,]+\s+)?for\s+|for\s+)(.+?)(?:\s+\$|\s*$)/i)
    const description = descMatch ? descMatch[1].trim() : undefined

    // Determine action
    let action = 'create'
    if (lower.includes('overdue') || lower.includes('outstanding') || lower.includes('unpaid')) {
      action = 'list_overdue'
    } else if (lower.includes('show') || lower.includes('list') || lower.includes('what')) {
      action = 'list'
    } else if (lower.includes('mark') && lower.includes('paid')) {
      action = 'mark_paid'
    } else if (lower.includes('send') || lower.includes('email')) {
      action = 'send'
    }

    return {
      action,
      entity: 'invoice',
      params: {
        amount,
        contactName,
        description,
        query: lower.includes('overdue') ? 'overdue' : undefined,
      },
      confidence: contactName || amount ? 0.9 : 0.6,
      originalText: input,
    }
  }

  private static parsePOCommand(input: string, lower: string): ParsedCommand {
    // Extract quantity and price
    const qtyMatch = input.match(/(\d+)\s*(?:units?|pieces?|items?)?/i)
    const priceMatch = input.match(/\$?([\d,]+(?:\.\d{2})?)\s*(?:each|per|\/)/i)
    const quantity = qtyMatch ? parseInt(qtyMatch[1]) : undefined
    const unitPrice = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : undefined

    // Extract supplier
    const fromMatch = input.match(/(?:from|to)\s+([A-Z][A-Za-z\s&]+?)(?:\s+at|\s+for|\s*$)/i)
    const supplierName = fromMatch ? fromMatch[1].trim() : undefined

    // Extract item description
    const itemMatch = input.match(/(?:for|order|buy)\s+(\d+\s+)?([a-z\s]+?)(?:\s+from|\s+at)/i)
    const itemDescription = itemMatch ? itemMatch[2].trim() : undefined

    // Determine action
    let action = 'create'
    if (lower.includes('approve')) {
      action = 'approve'
    } else if (lower.includes('pending') || lower.includes('show') || lower.includes('list')) {
      action = 'list'
    } else if (lower.includes('received') || lower.includes('arrived')) {
      action = 'receive'
    }

    return {
      action,
      entity: 'po',
      params: {
        supplierName,
        quantity,
        unitPrice,
        itemDescription,
      },
      confidence: supplierName ? 0.9 : 0.6,
      originalText: input,
    }
  }

  private static parseVendorCommand(input: string, lower: string): ParsedCommand {
    // Extract vendor name
    const calledMatch = input.match(/called\s+([A-Z][A-Za-z\s&]+?)(?:,|\s+contact|\s+email|\s*$)/i)
    const name = calledMatch ? calledMatch[1].trim() : undefined

    // Extract email
    const emailMatch = input.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
    const email = emailMatch ? emailMatch[1] : undefined

    // Determine type
    let vendorType: 'supplier' | 'customer' | 'both' = 'supplier'
    if (lower.includes('customer')) vendorType = 'customer'
    if (lower.includes('both')) vendorType = 'both'

    // Determine action
    let action = 'add'
    if (lower.includes('show') || lower.includes('list') || lower.includes('search')) {
      action = 'list'
    } else if (lower.includes('find') || lower.includes('who')) {
      action = 'search'
    }

    return {
      action,
      entity: 'vendor',
      params: {
        name,
        email,
        vendorType,
        query: action === 'search' ? input : undefined,
      },
      confidence: name ? 0.9 : 0.5,
      originalText: input,
    }
  }

  private static parseInventoryCommand(input: string, lower: string): ParsedCommand {
    // Extract item name
    const itemMatch = input.match(/(?:track|add|item)\s+([A-Za-z\s]+?)(?:\s+with|\s+quantity|\s*$)/i)
    const itemName = itemMatch ? itemMatch[1].trim() : undefined

    // Extract quantity
    const qtyMatch = input.match(/(\d+)\s*(?:units?|pieces?|items?)?/i)
    const quantity = qtyMatch ? parseInt(qtyMatch[1]) : undefined

    // Extract cost
    const costMatch = input.match(/\$?([\d,]+(?:\.\d{2})?)\s*(?:each|per|cost)/i)
    const unitCost = costMatch ? parseFloat(costMatch[1].replace(/,/g, '')) : undefined

    let action = 'track'
    if (lower.includes('show') || lower.includes('list') || lower.includes('inventory')) {
      action = 'list'
    }

    return {
      action,
      entity: 'inventory',
      params: {
        itemName,
        quantity,
        unitCost,
      },
      confidence: itemName ? 0.8 : 0.5,
      originalText: input,
    }
  }

  private static parseReportCommand(input: string, lower: string): ParsedCommand {
    // Determine report type
    let reportType: 'ap' | 'ar' | 'cashflow' | 'custom' = 'custom'
    if (lower.includes('payable') || lower.includes(' ap ') || lower.includes('owe')) {
      reportType = 'ap'
    } else if (lower.includes('receivable') || lower.includes(' ar ') || lower.includes('owed')) {
      reportType = 'ar'
    } else if (lower.includes('cash flow') || lower.includes('cashflow')) {
      reportType = 'cashflow'
    }

    // Determine period
    let period = 'month'
    if (lower.includes('week')) period = 'week'
    if (lower.includes('quarter')) period = 'quarter'
    if (lower.includes('year')) period = 'year'

    return {
      action: 'generate',
      entity: 'report',
      params: {
        type: reportType,
        period,
      },
      confidence: 0.8,
      originalText: input,
    }
  }
}

// ============================================================================
// WELLS ERP CLASS
// ============================================================================

export class WellsERP {
  private userId: string
  private anthropic: Anthropic

  constructor(userId: string) {
    this.userId = userId
    this.anthropic = new Anthropic()
  }

  // ==========================================================================
  // INVOICING
  // ==========================================================================

  /**
   * Create an invoice from natural language
   * @example "Create an invoice for Acme Corp for $5000 for consulting services"
   */
  async createInvoice(naturalLanguage: string): Promise<Invoice> {
    const parsed = NaturalLanguageParser.parse(naturalLanguage)

    if (parsed.entity !== 'invoice' && parsed.action !== 'create') {
      // Use Claude to better understand the intent
      const interpretation = await this.interpretWithClaude(naturalLanguage, 'create_invoice')
      Object.assign(parsed.params, interpretation)
    }

    const { contactName, amount, description } = parsed.params as {
      contactName?: string
      amount?: number
      description?: string
    }

    if (!contactName) {
      throw new Error('Please specify who to invoice. Example: "Create an invoice for Acme Corp for $5000"')
    }

    const request: CreateInvoiceRequest = {
      vendorName: contactName,
      amount: amount || 0,
      description: description || 'Services rendered',
      aiCommand: naturalLanguage,
    }

    const result = await WellsInvoiceService.createInvoice(this.userId, request)

    return this.mapWellsInvoiceToInvoice(result.invoice)
  }

  /**
   * List invoices with optional natural language query
   * @example "What invoices are overdue?" / "Show me unpaid invoices"
   */
  async listInvoices(query?: string): Promise<Invoice[]> {
    let criteria: Record<string, unknown> = {}

    if (query) {
      const parsed = NaturalLanguageParser.parse(query)
      if (parsed.params.query === 'overdue' || query.toLowerCase().includes('overdue')) {
        criteria = { overdue: true }
      } else if (query.toLowerCase().includes('unpaid') || query.toLowerCase().includes('outstanding')) {
        criteria = { status: ['draft', 'sent', 'viewed', 'partial', 'overdue'] }
      }
    }

    const result = await WellsInvoiceService.listInvoices(this.userId, criteria)
    return result.invoices.map(this.mapWellsInvoiceToInvoice)
  }

  /**
   * Mark an invoice as paid
   * @example "Mark invoice WELLS-2024-000001 as paid"
   */
  async markPaid(invoiceId: string): Promise<void> {
    await WellsInvoiceService.markAsPaid(this.userId, invoiceId)
  }

  // ==========================================================================
  // PURCHASE ORDERS
  // ==========================================================================

  /**
   * Create a purchase order from natural language
   * @example "Create a PO for 1000 bearings from Precision Bearings at $4.50 each"
   */
  async createPO(naturalLanguage: string): Promise<PurchaseOrder> {
    const parsed = NaturalLanguageParser.parse(naturalLanguage)

    const { supplierName, quantity, unitPrice, itemDescription } = parsed.params as {
      supplierName?: string
      quantity?: number
      unitPrice?: number
      itemDescription?: string
    }

    if (!supplierName) {
      throw new Error('Please specify the supplier. Example: "Order 1000 bearings from Precision Bearings at $4.50 each"')
    }

    const request: CreatePORequest = {
      supplierName,
      items: [
        {
          description: itemDescription || 'Items',
          quantity: quantity || 1,
          unitPrice: unitPrice || 0,
        },
      ],
      aiCommand: naturalLanguage,
    }

    const result = await WellsPOService.createPO(this.userId, request)

    return this.mapWellsPOToPurchaseOrder(result.po)
  }

  /**
   * Approve a purchase order
   */
  async approvePO(poId: string): Promise<void> {
    // Verify PO exists and is in a state that can be approved
    const result = await sql`
      SELECT * FROM wells_purchase_orders
      WHERE id = ${poId} AND user_id = ${this.userId}
      LIMIT 1
    `

    if (result.rows.length === 0) {
      throw new Error(`Purchase order ${poId} not found`)
    }

    const po = result.rows[0]
    if (!['draft', 'pending_approval'].includes(po.status)) {
      throw new Error(`Purchase order ${poId} cannot be approved - current status is ${po.status}`)
    }

    // Update status to approved
    await sql`
      UPDATE wells_purchase_orders
      SET status = 'approved', updated_at = NOW()
      WHERE id = ${poId} AND user_id = ${this.userId}
    `
  }

  // ==========================================================================
  // VENDORS/CONTACTS
  // ==========================================================================

  /**
   * Add a vendor from natural language
   * @example "Add a new vendor called TechSupply, contact is john@techsupply.com"
   */
  async addVendor(naturalLanguage: string): Promise<Vendor> {
    const parsed = NaturalLanguageParser.parse(naturalLanguage)

    const { name, email, vendorType } = parsed.params as {
      name?: string
      email?: string
      vendorType?: 'supplier' | 'customer' | 'both'
    }

    if (!name) {
      throw new Error('Please specify the vendor name. Example: "Add a new vendor called TechSupply"')
    }

    const request: CreateVendorRequest = {
      name,
      email,
      vendorType: vendorType || 'supplier',
      aiCommand: naturalLanguage,
    }

    const result = await WellsVendorRegistry.addVendor(this.userId, request)

    return this.mapWellsVendorToVendor(result.vendor)
  }

  /**
   * List vendors with optional query
   * @example "Show me all suppliers" / "Find vendors for bearings"
   */
  async listVendors(query?: string): Promise<Vendor[]> {
    const criteria = query ? { query } : {}
    const result = await WellsVendorRegistry.searchVendors(this.userId, criteria)
    return result.vendors.map(this.mapWellsVendorToVendor)
  }

  // ==========================================================================
  // INVENTORY (BASIC)
  // ==========================================================================

  /**
   * Track an inventory item from natural language
   * @example "Track 500 units of Widget A at $10 each"
   */
  async trackItem(naturalLanguage: string): Promise<InventoryItem> {
    const parsed = NaturalLanguageParser.parse(naturalLanguage)

    const { itemName, quantity, unitCost } = parsed.params as {
      itemName?: string
      quantity?: number
      unitCost?: number
    }

    if (!itemName) {
      throw new Error('Please specify the item name. Example: "Track 500 units of Widget A at $10 each"')
    }

    const itemId = `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const sku = `SKU-${Date.now().toString(36).toUpperCase()}`
    const qty = quantity || 0
    const cost = unitCost || 0
    const totalValue = qty * cost

    // Store in database
    await sql`
      INSERT INTO wells_inventory (
        id, user_id, sku, name, quantity, unit_cost, total_value,
        reorder_point, created_at, updated_at
      ) VALUES (
        ${itemId}, ${this.userId}, ${sku}, ${itemName}, ${qty}, ${cost}, ${totalValue},
        ${Math.floor(qty * 0.2)}, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        quantity = EXCLUDED.quantity,
        unit_cost = EXCLUDED.unit_cost,
        total_value = EXCLUDED.total_value,
        updated_at = NOW()
    `

    return {
      id: itemId,
      sku,
      name: itemName,
      quantity: qty,
      unitCost: cost,
      totalValue,
      reorderPoint: Math.floor(qty * 0.2),
      lastUpdated: new Date(),
    }
  }

  /**
   * Get current inventory
   */
  async getInventory(): Promise<InventoryItem[]> {
    const result = await sql`
      SELECT * FROM wells_inventory
      WHERE user_id = ${this.userId}
      ORDER BY name ASC
    `

    return result.rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      description: row.description,
      category: row.category,
      quantity: parseInt(row.quantity),
      unitCost: parseFloat(row.unit_cost),
      totalValue: parseFloat(row.total_value),
      reorderPoint: parseInt(row.reorder_point),
      location: row.location,
      lastUpdated: new Date(row.updated_at),
    }))
  }

  // ==========================================================================
  // REPORTS
  // ==========================================================================

  /**
   * Generate a financial report
   * @example generateReport('cashflow', { period: 'month' })
   */
  async generateReport(
    type: 'ap' | 'ar' | 'cashflow' | 'custom',
    params?: { period?: 'week' | 'month' | 'quarter' | 'year'; customQuery?: string }
  ): Promise<Report> {
    const period = params?.period || 'month'
    const now = new Date()
    let startDate: Date

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    let reportData: Record<string, unknown> = {}
    let summary = ''
    let insights: string[] = []
    let title = ''

    switch (type) {
      case 'ap': {
        const apResult = await WellsFinancialService.getAccountsPayable(this.userId)
        title = 'Accounts Payable Report'
        summary = apResult.message
        reportData = { ap: apResult.ap }
        insights = [
          `Total outstanding: $${apResult.ap.totalDue.toLocaleString()}`,
          `Due this week: $${apResult.ap.dueThisWeek.toLocaleString()}`,
          apResult.ap.overdueCount > 0 ? `${apResult.ap.overdueCount} invoices overdue` : 'No overdue invoices',
        ]
        break
      }

      case 'ar': {
        const invoiceResult = await WellsInvoiceService.getInvoiceSummary(this.userId, startDate, now)
        title = 'Accounts Receivable Report'
        summary = invoiceResult.message
        reportData = { ar: invoiceResult.summary }
        insights = [
          `Total billed: $${invoiceResult.summary.totalAmount.toLocaleString()}`,
          `Collected: $${invoiceResult.summary.paidAmount.toLocaleString()}`,
          `Outstanding: $${invoiceResult.summary.pendingAmount.toLocaleString()}`,
          invoiceResult.summary.overdueAmount > 0 ? `Overdue: $${invoiceResult.summary.overdueAmount.toLocaleString()}` : 'No overdue amounts',
        ]
        break
      }

      case 'cashflow': {
        const cfResult = await WellsFinancialService.forecastCashFlow(this.userId, period as 'week' | 'month' | 'quarter')
        title = 'Cash Flow Report'
        summary = cfResult.message
        reportData = { cashflow: cfResult.forecast }
        insights = [
          `Projected inflows: $${cfResult.forecast.projectedInflows.toLocaleString()}`,
          `Projected outflows: $${cfResult.forecast.projectedOutflows.toLocaleString()}`,
          `Net cash flow: $${cfResult.forecast.netCashFlow.toLocaleString()}`,
        ]
        break
      }

      default: {
        const spendResult = await WellsFinancialService.getSpendSummary(this.userId, period as 'week' | 'month' | 'quarter' | 'year')
        title = 'Financial Summary Report'
        summary = spendResult.message
        reportData = { spend: spendResult.summary }
        insights = [
          `Total spend: $${spendResult.summary.totalSpend.toLocaleString()}`,
          `Top category: ${spendResult.summary.topCategory || 'N/A'}`,
        ]
      }
    }

    return {
      type,
      title,
      period: { start: startDate, end: now },
      generatedAt: now,
      summary,
      data: reportData,
      insights,
    }
  }

  // ==========================================================================
  // CONVERSATIONAL INTERFACE
  // ==========================================================================

  /**
   * Process any natural language ERP command using Claude
   */
  async chat(message: string, conversationId?: string): Promise<{
    response: string
    actions: Array<{ tool: string; result: unknown }>
    conversationId: string
  }> {
    const convId = conversationId || `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Use Claude with ERP tools
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: WELLS_ERP_SYSTEM_PROMPT + `\n\nUser ID: ${this.userId}\nConversation ID: ${convId}`,
      tools: WELLS_ERP_TOOLS,
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
    })

    const actions: Array<{ tool: string; result: unknown }> = []
    let textResponse = ''

    // Process response
    for (const block of response.content) {
      if (block.type === 'text') {
        textResponse += block.text
      } else if (block.type === 'tool_use') {
        const toolResult = await this.executeTool(block.name, block.input as Record<string, unknown>)
        actions.push({ tool: block.name, result: toolResult })
      }
    }

    // If there were tool calls, continue the conversation to get final response
    if (actions.length > 0 && response.stop_reason === 'tool_use') {
      const toolResults = actions.map((a, i) => ({
        type: 'tool_result' as const,
        tool_use_id: (response.content.find((c, idx) => c.type === 'tool_use' && idx === i) as { id: string })?.id || `tool-${i}`,
        content: JSON.stringify(a.result),
      }))

      const continuation = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: WELLS_ERP_SYSTEM_PROMPT + `\n\nUser ID: ${this.userId}\nConversation ID: ${convId}`,
        tools: WELLS_ERP_TOOLS,
        messages: [
          { role: 'user', content: message },
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResults },
        ],
      })

      for (const block of continuation.content) {
        if (block.type === 'text') {
          textResponse = block.text
        }
      }
    }

    return {
      response: textResponse,
      actions,
      conversationId: convId,
    }
  }

  // ==========================================================================
  // EXPORT TO MERGE.DEV FORMAT
  // ==========================================================================

  /**
   * Export all ERP data in Merge.dev compatible format
   * For users upgrading to a real ERP system
   */
  async exportToMergeFormat(): Promise<{
    invoices: unknown[]
    purchaseOrders: unknown[]
    contacts: unknown[]
    inventory: unknown[]
    transactions: unknown[]
  }> {
    // Get all data
    const invoices = await this.listInvoices()
    const vendors = await this.listVendors()
    const inventory = await this.getInventory()

    // Get POs
    const poResult = await WellsPOService.listPOs(this.userId)

    // Get transactions
    const txResult = await sql`
      SELECT * FROM wells_transactions
      WHERE user_id = ${this.userId}
      ORDER BY created_at DESC
    `

    // Convert to Merge.dev format
    return {
      invoices: invoices.map((inv) => ({
        id: inv.id,
        remote_id: inv.invoiceNumber,
        type: 'ACCOUNTS_RECEIVABLE',
        contact: {
          name: inv.contactName,
          email: inv.contactEmail,
        },
        number: inv.invoiceNumber,
        issue_date: inv.createdAt.toISOString(),
        due_date: inv.dueDate.toISOString(),
        total_amount: inv.total * 100, // Merge uses cents
        balance: inv.amountDue * 100,
        currency: 'USD',
        line_items: inv.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice * 100,
          total_amount: item.amount * 100,
        })),
        remote_was_deleted: false,
      })),
      purchaseOrders: poResult.orders.map((po: WellsPurchaseOrder) => ({
        id: po.id,
        remote_id: po.poNumber,
        status: po.status.toUpperCase(),
        issue_date: po.createdAt.toISOString(),
        delivery_date: po.expectedDeliveryDate?.toISOString(),
        vendor: {
          name: po.supplierName,
          email: po.supplierEmail,
        },
        total_amount: po.totalAmount * 100,
        currency: 'USD',
        line_items: po.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice * 100,
          total_amount: item.amount * 100,
        })),
        remote_was_deleted: false,
      })),
      contacts: vendors.map((v) => ({
        id: v.id,
        name: v.name,
        is_supplier: v.type === 'supplier' || v.type === 'both',
        is_customer: v.type === 'customer' || v.type === 'both',
        email_addresses: v.email ? [{ email_address: v.email, email_address_type: 'WORK' }] : [],
        phone_numbers: v.phone ? [{ phone_number: v.phone, phone_number_type: 'WORK' }] : [],
        addresses: v.addresses.map((addr) => ({
          type: addr.type.toUpperCase(),
          street_1: addr.line1,
          street_2: addr.line2,
          city: addr.city,
          state: addr.state,
          postal_code: addr.postalCode,
          country: addr.country,
        })),
        remote_was_deleted: false,
      })),
      inventory: inventory.map((item) => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit_cost: item.unitCost * 100,
        category: item.category,
      })),
      transactions: txResult.rows.map((tx: Record<string, unknown>) => ({
        id: tx.id,
        type: tx.type,
        amount: (tx.amount as number) * 100,
        currency: tx.currency,
        date: tx.created_at,
        reference_id: tx.reference_id,
        metadata: tx.metadata,
      })),
    }
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private async executeTool(toolName: string, input: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case 'create_invoice':
        return this.createInvoice(
          `Create an invoice for ${input.customerName} for $${input.amount}${input.description ? ` for ${input.description}` : ''}`
        )

      case 'list_invoices':
        return this.listInvoices(input.overdue ? 'overdue' : input.unpaid ? 'unpaid' : undefined)

      case 'record_payment':
        await this.markPaid(input.invoiceIdentifier as string)
        return { success: true }

      case 'create_po':
        return this.createPO(
          `Order ${(input.items as Array<{ quantity: number; description: string; unitPrice: number }>)?.[0]?.quantity || 1} ${(input.items as Array<{ description: string }>)?.[0]?.description || 'items'} from ${input.supplierName} at $${(input.items as Array<{ unitPrice: number }>)?.[0]?.unitPrice || 0} each`
        )

      case 'list_pos':
        const poResult = await WellsPOService.listPOs(this.userId, input)
        return poResult.orders

      case 'add_vendor':
        return this.addVendor(
          `Add a new vendor called ${input.name}${input.email ? `, contact is ${input.email}` : ''}`
        )

      case 'search_vendors':
        return this.listVendors(input.query as string)

      case 'get_cash_flow':
        return this.generateReport('cashflow', { period: input.period as 'week' | 'month' | 'quarter' })

      case 'get_accounts_payable':
        return this.generateReport('ap')

      case 'get_accounts_receivable':
        return this.generateReport('ar')

      case 'get_financial_summary':
        return this.generateReport('custom', { period: input.period as 'week' | 'month' | 'quarter' | 'year' })

      default:
        return { error: `Unknown tool: ${toolName}` }
    }
  }

  private async interpretWithClaude(text: string, expectedAction: string): Promise<Record<string, unknown>> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Extract structured data from this ERP command for action "${expectedAction}":
"${text}"

Return JSON with fields like: contactName, amount, description, supplierName, quantity, unitPrice, itemDescription, email, vendorType, period.
Only include fields that are clearly present in the text.`,
        },
      ],
    })

    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') return {}

    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch {
      // Parsing failed, return empty
    }

    return {}
  }

  private mapWellsInvoiceToInvoice(wellsInvoice: WellsInvoice): Invoice {
    return {
      id: wellsInvoice.id,
      invoiceNumber: wellsInvoice.invoiceNumber,
      contactId: wellsInvoice.vendorId,
      contactName: wellsInvoice.vendorName,
      contactEmail: wellsInvoice.vendorEmail,
      items: wellsInvoice.lineItems.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        category: item.category,
      })),
      subtotal: wellsInvoice.subtotal,
      taxAmount: wellsInvoice.taxAmount,
      wellsFee: wellsInvoice.wellsFee,
      total: wellsInvoice.totalAmount,
      amountPaid: wellsInvoice.amountPaid,
      amountDue: wellsInvoice.amountDue,
      status: wellsInvoice.status,
      dueDate: wellsInvoice.dueDate,
      createdAt: wellsInvoice.createdAt,
      updatedAt: wellsInvoice.updatedAt,
      aiCommand: wellsInvoice.aiCommand,
    }
  }

  private mapWellsPOToPurchaseOrder(wellsPO: WellsPurchaseOrder): PurchaseOrder {
    return {
      id: wellsPO.id,
      poNumber: wellsPO.poNumber,
      vendorId: wellsPO.supplierId,
      vendorName: wellsPO.supplierName,
      vendorEmail: wellsPO.supplierEmail,
      items: wellsPO.items.map((item) => ({
        id: item.id,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        deliveredQuantity: item.deliveredQuantity || 0,
      })),
      subtotal: wellsPO.subtotal,
      taxAmount: wellsPO.taxAmount,
      shippingAmount: wellsPO.shippingAmount,
      wellsFee: wellsPO.wellsFee,
      total: wellsPO.totalAmount,
      status: wellsPO.status,
      expectedDeliveryDate: wellsPO.expectedDeliveryDate,
      createdAt: wellsPO.createdAt,
      updatedAt: wellsPO.updatedAt,
      aiCommand: wellsPO.aiCommand,
    }
  }

  private mapWellsVendorToVendor(wellsVendor: WellsVendor): Vendor {
    return {
      id: wellsVendor.id,
      name: wellsVendor.name,
      displayName: wellsVendor.displayName,
      type: wellsVendor.vendorType,
      status: wellsVendor.status,
      email: wellsVendor.email,
      phone: wellsVendor.phone,
      website: wellsVendor.website,
      contacts: wellsVendor.contacts || [],
      addresses: wellsVendor.addresses || [],
      paymentTerms: wellsVendor.paymentTerms?.terms || 'NET30',
      categories: wellsVendor.categories || [],
      totalOrders: wellsVendor.totalOrders,
      totalSpend: wellsVendor.totalSpend,
      averageOrderValue: wellsVendor.averageOrderValue,
      performanceScore: wellsVendor.performanceScore?.overall || 50,
      createdAt: wellsVendor.createdAt,
      updatedAt: wellsVendor.updatedAt,
    }
  }
}

// ============================================================================
// SINGLETON FACTORY
// ============================================================================

const erpInstances = new Map<string, WellsERP>()

/**
 * Get or create a WellsERP instance for a user
 */
export function getWellsERP(userId: string): WellsERP {
  if (!erpInstances.has(userId)) {
    erpInstances.set(userId, new WellsERP(userId))
  }
  return erpInstances.get(userId)!
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  NaturalLanguageParser,
  type ParsedCommand,
}

export default WellsERP
