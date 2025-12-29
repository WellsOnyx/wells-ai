/**
 * WellsAI Conversational ERP - Invoice Service
 *
 * AI-native invoicing - no forms, no dashboards.
 * Users just talk to Wells:
 *
 * - "Create an invoice for Acme Corp for $5000" -> Wells creates it
 * - "Show me unpaid invoices" -> Wells lists them
 * - "Send a reminder to Acme about their overdue invoice" -> Wells sends
 * - "Mark invoice #123 as paid" -> Wells updates status
 *
 * Integrated with Wells fee system - 1% on all transactions.
 */

import { sql } from '@vercel/postgres'
import { calculateWellsFee, WELLS_FEE_CONFIG } from '@/lib/fees/wells-fee-service'

// ============================================================================
// TYPES
// ============================================================================

export interface InvoiceLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  amount: number
  category?: string
}

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'cancelled' | 'disputed'

export interface WellsInvoice {
  id: string
  invoiceNumber: string
  vendorId: string
  vendorName: string
  vendorEmail?: string

  // Amounts
  subtotal: number
  taxAmount: number
  wellsFee: number
  totalAmount: number
  amountPaid: number
  amountDue: number
  currency: string

  // Dates
  invoiceDate: Date
  dueDate: Date
  paidDate?: Date

  // Status
  status: InvoiceStatus

  // Line items
  lineItems: InvoiceLineItem[]

  // Metadata
  description?: string
  notes?: string
  paymentTerms?: string
  poNumber?: string

  // AI tracking
  createdByAi: boolean
  aiConversationId?: string
  aiCommand?: string

  // Wells integration
  wellsDealId?: string
  wellsTransactionId?: string

  // Reminders
  remindersSent: number
  lastReminderAt?: Date
  nextReminderAt?: Date

  createdAt: Date
  updatedAt: Date
}

export interface CreateInvoiceRequest {
  vendorId?: string
  vendorName: string
  vendorEmail?: string
  amount?: number
  lineItems?: Omit<InvoiceLineItem, 'id'>[]
  description?: string
  dueDate?: Date
  paymentTerms?: string
  poNumber?: string
  aiConversationId?: string
  aiCommand?: string
}

export interface InvoiceSearchCriteria {
  vendorId?: string
  vendorName?: string
  status?: InvoiceStatus | InvoiceStatus[]
  minAmount?: number
  maxAmount?: number
  startDate?: Date
  endDate?: Date
  overdue?: boolean
  limit?: number
  offset?: number
}

export interface InvoiceSummary {
  totalInvoices: number
  totalAmount: number
  paidAmount: number
  overdueAmount: number
  pendingAmount: number
  byStatus: Record<InvoiceStatus, { count: number; amount: number }>
}

// ============================================================================
// INVOICE SERVICE
// ============================================================================

export class WellsInvoiceService {
  /**
   * Create an invoice conversationally
   * "Create an invoice for Acme Corp for $5000"
   */
  static async createInvoice(
    userId: string,
    request: CreateInvoiceRequest
  ): Promise<{ invoice: WellsInvoice; message: string }> {
    const invoiceId = `wells-inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const invoiceNumber = await this.generateInvoiceNumber()

    // Determine vendor ID - use existing or create new
    let vendorId = request.vendorId
    if (!vendorId) {
      // Check if vendor exists by name
      const existingVendor = await sql`
        SELECT id FROM wells_vendors
        WHERE user_id = ${userId} AND LOWER(name) = LOWER(${request.vendorName})
        LIMIT 1
      `
      if (existingVendor.rows.length > 0) {
        vendorId = existingVendor.rows[0].id
      } else {
        // Create vendor on the fly
        vendorId = `wells-vendor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        await sql`
          INSERT INTO wells_vendors (id, user_id, name, email, status, created_by_ai, created_at, updated_at)
          VALUES (${vendorId}, ${userId}, ${request.vendorName}, ${request.vendorEmail || null}, 'active', true, NOW(), NOW())
        `
      }
    }

    // Calculate amounts
    let subtotal = request.amount || 0
    const lineItems: InvoiceLineItem[] = []

    if (request.lineItems && request.lineItems.length > 0) {
      subtotal = 0
      for (const item of request.lineItems) {
        const lineItemId = `li-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
        const amount = item.quantity * item.unitPrice
        subtotal += amount
        lineItems.push({
          id: lineItemId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount,
          category: item.category,
        })
      }
    } else if (request.amount) {
      // Single line item for the total amount
      lineItems.push({
        id: `li-${Date.now()}`,
        description: request.description || 'Services rendered',
        quantity: 1,
        unitPrice: request.amount,
        amount: request.amount,
      })
    }

    // Calculate Wells fee (1%)
    const feeResult = calculateWellsFee(subtotal, 'USD', `invoice-${invoiceId}`)
    const wellsFee = feeResult.feeAmount

    // Tax (simplified - 0% for now, can be enhanced)
    const taxAmount = 0

    const totalAmount = subtotal + taxAmount + wellsFee

    // Default due date: NET30
    const invoiceDate = new Date()
    const dueDate = request.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    // Insert invoice
    await sql`
      INSERT INTO wells_invoices (
        id, invoice_number, user_id, vendor_id, vendor_name, vendor_email,
        subtotal, tax_amount, wells_fee, total_amount, amount_paid, amount_due, currency,
        invoice_date, due_date, status, line_items, description, notes, payment_terms, po_number,
        created_by_ai, ai_conversation_id, ai_command, reminders_sent, created_at, updated_at
      ) VALUES (
        ${invoiceId}, ${invoiceNumber}, ${userId}, ${vendorId}, ${request.vendorName}, ${request.vendorEmail || null},
        ${subtotal}, ${taxAmount}, ${wellsFee}, ${totalAmount}, 0, ${totalAmount}, 'USD',
        ${invoiceDate.toISOString()}, ${dueDate.toISOString()}, 'draft', ${JSON.stringify(lineItems)},
        ${request.description || null}, ${null}, ${request.paymentTerms || 'NET30'}, ${request.poNumber || null},
        true, ${request.aiConversationId || null}, ${request.aiCommand || null}, 0, NOW(), NOW()
      )
    `

    // Record transaction for unified ledger
    await this.recordTransaction(userId, invoiceId, 'invoice_created', totalAmount, {
      invoiceNumber,
      vendorName: request.vendorName,
      wellsFee,
    })

    const invoice: WellsInvoice = {
      id: invoiceId,
      invoiceNumber,
      vendorId: vendorId!,
      vendorName: request.vendorName,
      vendorEmail: request.vendorEmail,
      subtotal,
      taxAmount,
      wellsFee,
      totalAmount,
      amountPaid: 0,
      amountDue: totalAmount,
      currency: 'USD',
      invoiceDate,
      dueDate,
      status: 'draft',
      lineItems,
      description: request.description,
      paymentTerms: request.paymentTerms || 'NET30',
      poNumber: request.poNumber,
      createdByAi: true,
      aiConversationId: request.aiConversationId,
      aiCommand: request.aiCommand,
      remindersSent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    return {
      invoice,
      message: `Invoice ${invoiceNumber} created for ${request.vendorName}. Total: $${totalAmount.toLocaleString()} (includes $${wellsFee.toFixed(2)} Wells AI fee). Due ${dueDate.toLocaleDateString()}.`,
    }
  }

  /**
   * List invoices with natural language filters
   * "Show me unpaid invoices" / "What invoices are overdue?"
   */
  static async listInvoices(
    userId: string,
    criteria: InvoiceSearchCriteria = {}
  ): Promise<{ invoices: WellsInvoice[]; summary: string }> {
    let query = sql`
      SELECT * FROM wells_invoices
      WHERE user_id = ${userId}
    `

    const conditions: string[] = []
    const params: unknown[] = []

    if (criteria.vendorId) {
      conditions.push(`vendor_id = $${params.length + 1}`)
      params.push(criteria.vendorId)
    }

    if (criteria.vendorName) {
      conditions.push(`LOWER(vendor_name) LIKE LOWER($${params.length + 1})`)
      params.push(`%${criteria.vendorName}%`)
    }

    if (criteria.status) {
      if (Array.isArray(criteria.status)) {
        conditions.push(`status = ANY($${params.length + 1})`)
        params.push(criteria.status)
      } else {
        conditions.push(`status = $${params.length + 1}`)
        params.push(criteria.status)
      }
    }

    if (criteria.overdue) {
      conditions.push(`due_date < NOW() AND status NOT IN ('paid', 'cancelled')`)
    }

    // Build query based on criteria
    const result = criteria.overdue
      ? await sql`
          SELECT * FROM wells_invoices
          WHERE user_id = ${userId}
            AND due_date < NOW()
            AND status NOT IN ('paid', 'cancelled')
          ORDER BY due_date ASC
          LIMIT ${criteria.limit || 50}
          OFFSET ${criteria.offset || 0}
        `
      : criteria.status
        ? await sql`
            SELECT * FROM wells_invoices
            WHERE user_id = ${userId}
              AND status = ${criteria.status as string}
            ORDER BY created_at DESC
            LIMIT ${criteria.limit || 50}
            OFFSET ${criteria.offset || 0}
          `
        : await sql`
            SELECT * FROM wells_invoices
            WHERE user_id = ${userId}
            ORDER BY created_at DESC
            LIMIT ${criteria.limit || 50}
            OFFSET ${criteria.offset || 0}
          `

    const invoices: WellsInvoice[] = result.rows.map(this.mapRowToInvoice)

    // Generate natural language summary
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0)
    const overdueCount = invoices.filter((inv) => inv.status === 'overdue' || (new Date(inv.dueDate) < new Date() && inv.status !== 'paid')).length

    let summary = `Found ${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}`
    if (invoices.length > 0) {
      summary += ` totaling $${totalAmount.toLocaleString()}.`
      if (overdueCount > 0) {
        summary += ` ${overdueCount} ${overdueCount === 1 ? 'is' : 'are'} overdue.`
      }
    } else {
      summary += '.'
    }

    return { invoices, summary }
  }

  /**
   * Get unpaid invoices
   * "Show me unpaid invoices"
   */
  static async getUnpaidInvoices(userId: string): Promise<{ invoices: WellsInvoice[]; summary: string }> {
    const result = await sql`
      SELECT * FROM wells_invoices
      WHERE user_id = ${userId}
        AND status NOT IN ('paid', 'cancelled')
        AND amount_due > 0
      ORDER BY due_date ASC
    `

    const invoices: WellsInvoice[] = result.rows.map(this.mapRowToInvoice)
    const totalDue = invoices.reduce((sum, inv) => sum + inv.amountDue, 0)
    const overdueInvoices = invoices.filter((inv) => new Date(inv.dueDate) < new Date())
    const overdueTtotal = overdueInvoices.reduce((sum, inv) => sum + inv.amountDue, 0)

    let summary = `You have ${invoices.length} unpaid invoice${invoices.length !== 1 ? 's' : ''} totaling $${totalDue.toLocaleString()}.`
    if (overdueInvoices.length > 0) {
      summary += ` ${overdueInvoices.length} ${overdueInvoices.length === 1 ? 'is' : 'are'} overdue ($${overdueTtotal.toLocaleString()}).`
    }

    return { invoices, summary }
  }

  /**
   * Mark invoice as paid
   * "Mark invoice #123 as paid"
   */
  static async markAsPaid(
    userId: string,
    invoiceIdentifier: string,
    paymentAmount?: number,
    paymentDate?: Date
  ): Promise<{ invoice: WellsInvoice; message: string }> {
    // Find invoice by number or ID
    const result = await sql`
      SELECT * FROM wells_invoices
      WHERE user_id = ${userId}
        AND (invoice_number = ${invoiceIdentifier} OR id = ${invoiceIdentifier})
      LIMIT 1
    `

    if (result.rows.length === 0) {
      throw new Error(`Invoice ${invoiceIdentifier} not found`)
    }

    const invoice = this.mapRowToInvoice(result.rows[0])
    const amountToPay = paymentAmount || invoice.amountDue
    const newAmountPaid = invoice.amountPaid + amountToPay
    const newAmountDue = invoice.totalAmount - newAmountPaid
    const newStatus: InvoiceStatus = newAmountDue <= 0 ? 'paid' : 'partial'
    const paidDateToUse = paymentDate || new Date()

    await sql`
      UPDATE wells_invoices
      SET
        status = ${newStatus},
        amount_paid = ${newAmountPaid},
        amount_due = ${Math.max(0, newAmountDue)},
        paid_date = ${newStatus === 'paid' ? paidDateToUse.toISOString() : null},
        updated_at = NOW()
      WHERE id = ${invoice.id}
    `

    // Record in unified ledger
    await this.recordTransaction(userId, invoice.id, 'payment_received', amountToPay, {
      invoiceNumber: invoice.invoiceNumber,
      vendorName: invoice.vendorName,
      paymentType: 'full',
    })

    // Capture Wells fee on payment
    await this.captureWellsFee(userId, invoice)

    const updatedInvoice: WellsInvoice = {
      ...invoice,
      status: newStatus,
      amountPaid: newAmountPaid,
      amountDue: Math.max(0, newAmountDue),
      paidDate: newStatus === 'paid' ? paidDateToUse : undefined,
      updatedAt: new Date(),
    }

    const message =
      newStatus === 'paid'
        ? `Invoice ${invoice.invoiceNumber} marked as paid. Total received: $${newAmountPaid.toLocaleString()}.`
        : `Partial payment of $${amountToPay.toLocaleString()} recorded on invoice ${invoice.invoiceNumber}. Remaining balance: $${newAmountDue.toLocaleString()}.`

    return { invoice: updatedInvoice, message }
  }

  /**
   * Send reminder for overdue invoice
   * "Send a reminder to Acme about their overdue invoice"
   */
  static async sendReminder(
    userId: string,
    invoiceIdentifier: string
  ): Promise<{ invoice: WellsInvoice; message: string; emailSent: boolean }> {
    const result = await sql`
      SELECT * FROM wells_invoices
      WHERE user_id = ${userId}
        AND (invoice_number = ${invoiceIdentifier} OR id = ${invoiceIdentifier} OR LOWER(vendor_name) LIKE LOWER(${`%${invoiceIdentifier}%`}))
      ORDER BY due_date ASC
      LIMIT 1
    `

    if (result.rows.length === 0) {
      throw new Error(`Invoice for "${invoiceIdentifier}" not found`)
    }

    const invoice = this.mapRowToInvoice(result.rows[0])

    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      throw new Error(`Invoice ${invoice.invoiceNumber} is already ${invoice.status}`)
    }

    // Update reminder tracking
    const now = new Date()
    await sql`
      UPDATE wells_invoices
      SET
        reminders_sent = reminders_sent + 1,
        last_reminder_at = ${now.toISOString()},
        next_reminder_at = ${new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()},
        updated_at = NOW()
      WHERE id = ${invoice.id}
    `

    // TODO: Integrate with email service (Resend) to actually send the reminder
    const emailSent = false // Will be true when email integration is added

    const daysOverdue = Math.floor((now.getTime() - new Date(invoice.dueDate).getTime()) / (24 * 60 * 60 * 1000))
    const isOverdue = daysOverdue > 0

    const message = isOverdue
      ? `Reminder queued for ${invoice.vendorName} regarding invoice ${invoice.invoiceNumber}. This invoice is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue ($${invoice.amountDue.toLocaleString()}).`
      : `Reminder queued for ${invoice.vendorName} regarding invoice ${invoice.invoiceNumber}. Due: ${new Date(invoice.dueDate).toLocaleDateString()} ($${invoice.amountDue.toLocaleString()}).`

    return {
      invoice: {
        ...invoice,
        remindersSent: invoice.remindersSent + 1,
        lastReminderAt: now,
      },
      message,
      emailSent,
    }
  }

  /**
   * Get invoice summary/analytics
   * "What's my invoicing status this month?"
   */
  static async getInvoiceSummary(userId: string, startDate?: Date, endDate?: Date): Promise<{ summary: InvoiceSummary; message: string }> {
    const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const end = endDate || new Date()

    const result = await sql`
      SELECT
        COUNT(*) as total_count,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as paid_amount,
        COALESCE(SUM(CASE WHEN status = 'overdue' OR (due_date < NOW() AND status NOT IN ('paid', 'cancelled')) THEN amount_due ELSE 0 END), 0) as overdue_amount,
        COALESCE(SUM(CASE WHEN status NOT IN ('paid', 'cancelled') THEN amount_due ELSE 0 END), 0) as pending_amount
      FROM wells_invoices
      WHERE user_id = ${userId}
        AND created_at >= ${start.toISOString()}
        AND created_at <= ${end.toISOString()}
    `

    const statusResult = await sql`
      SELECT
        status,
        COUNT(*) as count,
        COALESCE(SUM(total_amount), 0) as amount
      FROM wells_invoices
      WHERE user_id = ${userId}
        AND created_at >= ${start.toISOString()}
        AND created_at <= ${end.toISOString()}
      GROUP BY status
    `

    const row = result.rows[0]
    const byStatus: Record<InvoiceStatus, { count: number; amount: number }> = {
      draft: { count: 0, amount: 0 },
      sent: { count: 0, amount: 0 },
      viewed: { count: 0, amount: 0 },
      partial: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 },
      overdue: { count: 0, amount: 0 },
      cancelled: { count: 0, amount: 0 },
      disputed: { count: 0, amount: 0 },
    }

    for (const statusRow of statusResult.rows) {
      byStatus[statusRow.status as InvoiceStatus] = {
        count: parseInt(statusRow.count),
        amount: parseFloat(statusRow.amount),
      }
    }

    const summary: InvoiceSummary = {
      totalInvoices: parseInt(row.total_count),
      totalAmount: parseFloat(row.total_amount),
      paidAmount: parseFloat(row.paid_amount),
      overdueAmount: parseFloat(row.overdue_amount),
      pendingAmount: parseFloat(row.pending_amount),
      byStatus,
    }

    const collectionRate = summary.totalAmount > 0 ? ((summary.paidAmount / summary.totalAmount) * 100).toFixed(1) : '0'

    const message = `Invoice Summary:
- Total: ${summary.totalInvoices} invoices worth $${summary.totalAmount.toLocaleString()}
- Collected: $${summary.paidAmount.toLocaleString()} (${collectionRate}%)
- Pending: $${summary.pendingAmount.toLocaleString()}
- Overdue: $${summary.overdueAmount.toLocaleString()}`

    return { summary, message }
  }

  /**
   * Cancel an invoice
   * "Cancel invoice #123"
   */
  static async cancelInvoice(userId: string, invoiceIdentifier: string, reason?: string): Promise<{ invoice: WellsInvoice; message: string }> {
    const result = await sql`
      SELECT * FROM wells_invoices
      WHERE user_id = ${userId}
        AND (invoice_number = ${invoiceIdentifier} OR id = ${invoiceIdentifier})
      LIMIT 1
    `

    if (result.rows.length === 0) {
      throw new Error(`Invoice ${invoiceIdentifier} not found`)
    }

    const invoice = this.mapRowToInvoice(result.rows[0])

    if (invoice.status === 'paid') {
      throw new Error(`Cannot cancel paid invoice ${invoice.invoiceNumber}. Consider issuing a credit note instead.`)
    }

    await sql`
      UPDATE wells_invoices
      SET
        status = 'cancelled',
        notes = COALESCE(notes, '') || ${reason ? `\nCancellation reason: ${reason}` : ''},
        updated_at = NOW()
      WHERE id = ${invoice.id}
    `

    return {
      invoice: { ...invoice, status: 'cancelled', updatedAt: new Date() },
      message: `Invoice ${invoice.invoiceNumber} has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private static async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear()
    const result = await sql`
      SELECT COUNT(*) as count FROM wells_invoices
      WHERE EXTRACT(YEAR FROM created_at) = ${year}
    `
    const sequence = parseInt(result.rows[0].count) + 1
    return `WELLS-${year}-${sequence.toString().padStart(6, '0')}`
  }

  private static mapRowToInvoice(row: Record<string, unknown>): WellsInvoice {
    return {
      id: row.id as string,
      invoiceNumber: row.invoice_number as string,
      vendorId: row.vendor_id as string,
      vendorName: row.vendor_name as string,
      vendorEmail: row.vendor_email as string | undefined,
      subtotal: parseFloat(row.subtotal as string),
      taxAmount: parseFloat(row.tax_amount as string),
      wellsFee: parseFloat(row.wells_fee as string),
      totalAmount: parseFloat(row.total_amount as string),
      amountPaid: parseFloat(row.amount_paid as string),
      amountDue: parseFloat(row.amount_due as string),
      currency: row.currency as string,
      invoiceDate: new Date(row.invoice_date as string),
      dueDate: new Date(row.due_date as string),
      paidDate: row.paid_date ? new Date(row.paid_date as string) : undefined,
      status: row.status as InvoiceStatus,
      lineItems: (row.line_items as InvoiceLineItem[]) || [],
      description: row.description as string | undefined,
      notes: row.notes as string | undefined,
      paymentTerms: row.payment_terms as string | undefined,
      poNumber: row.po_number as string | undefined,
      createdByAi: row.created_by_ai as boolean,
      aiConversationId: row.ai_conversation_id as string | undefined,
      aiCommand: row.ai_command as string | undefined,
      wellsDealId: row.wells_deal_id as string | undefined,
      wellsTransactionId: row.wells_transaction_id as string | undefined,
      remindersSent: parseInt(row.reminders_sent as string) || 0,
      lastReminderAt: row.last_reminder_at ? new Date(row.last_reminder_at as string) : undefined,
      nextReminderAt: row.next_reminder_at ? new Date(row.next_reminder_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    }
  }

  private static async recordTransaction(
    userId: string,
    referenceId: string,
    type: string,
    amount: number,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const transactionId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    await sql`
      INSERT INTO wells_transactions (
        id, user_id, reference_id, type, amount, currency, metadata, created_at
      ) VALUES (
        ${transactionId}, ${userId}, ${referenceId}, ${type}, ${amount}, 'USD', ${JSON.stringify(metadata)}, NOW()
      )
    `
  }

  private static async captureWellsFee(userId: string, invoice: WellsInvoice): Promise<void> {
    // Record Wells fee capture in the ledger
    if (invoice.wellsFee > 0) {
      const feeTransactionId = `wells-fee-${invoice.id}`
      await sql`
        INSERT INTO wells_transactions (
          id, user_id, reference_id, type, amount, currency, metadata, created_at
        ) VALUES (
          ${feeTransactionId}, ${userId}, ${invoice.id}, 'wells_fee_captured', ${invoice.wellsFee}, 'USD',
          ${JSON.stringify({
            invoiceNumber: invoice.invoiceNumber,
            invoiceTotal: invoice.totalAmount,
            feePercent: WELLS_FEE_CONFIG.ratePercent,
          })},
          NOW()
        )
        ON CONFLICT (id) DO NOTHING
      `
    }
  }
}

// ============================================================================
// CONVERSATIONAL PARSER
// ============================================================================

/**
 * Parse natural language invoice commands
 * This is used by the chat interface to understand user intent
 */
export function parseInvoiceCommand(message: string): {
  action: 'create' | 'list' | 'mark_paid' | 'send_reminder' | 'cancel' | 'summary' | 'unknown'
  params: Record<string, unknown>
} {
  const lower = message.toLowerCase()

  // Create invoice
  if (lower.includes('create') && lower.includes('invoice')) {
    const amountMatch = message.match(/\$?([\d,]+(?:\.\d{2})?)/i)
    const vendorMatch = message.match(/(?:for|to)\s+([A-Z][A-Za-z\s]+?)(?:\s+for|\s*$)/i)
    return {
      action: 'create',
      params: {
        amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : undefined,
        vendorName: vendorMatch ? vendorMatch[1].trim() : undefined,
      },
    }
  }

  // Mark as paid
  if ((lower.includes('mark') && lower.includes('paid')) || lower.includes('received payment')) {
    const invoiceMatch = message.match(/#?(\d+|WELLS-\d{4}-\d+)/i)
    return {
      action: 'mark_paid',
      params: {
        invoiceIdentifier: invoiceMatch ? invoiceMatch[1] : undefined,
      },
    }
  }

  // Send reminder
  if (lower.includes('remind') || lower.includes('follow up')) {
    const vendorMatch = message.match(/(?:to|about)\s+([A-Z][A-Za-z\s]+)/i)
    const invoiceMatch = message.match(/#?(\d+|WELLS-\d{4}-\d+)/i)
    return {
      action: 'send_reminder',
      params: {
        vendorName: vendorMatch ? vendorMatch[1].trim() : undefined,
        invoiceIdentifier: invoiceMatch ? invoiceMatch[1] : undefined,
      },
    }
  }

  // List/show invoices
  if (lower.includes('show') || lower.includes('list') || lower.includes('what')) {
    const isOverdue = lower.includes('overdue')
    const isUnpaid = lower.includes('unpaid') || lower.includes('outstanding') || lower.includes('pending')
    return {
      action: 'list',
      params: {
        overdue: isOverdue,
        unpaid: isUnpaid,
      },
    }
  }

  // Cancel
  if (lower.includes('cancel')) {
    const invoiceMatch = message.match(/#?(\d+|WELLS-\d{4}-\d+)/i)
    return {
      action: 'cancel',
      params: {
        invoiceIdentifier: invoiceMatch ? invoiceMatch[1] : undefined,
      },
    }
  }

  // Summary
  if (lower.includes('summary') || lower.includes('status') || lower.includes('analytics')) {
    return {
      action: 'summary',
      params: {},
    }
  }

  return { action: 'unknown', params: {} }
}
