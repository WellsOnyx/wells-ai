/**
 * Invoice Handler
 * Handles conversational invoice generation, queries, and management
 */

import { query } from '../db'
import { ExecutionResult } from '../conversational-engine'

// ============================================
// Generate Invoice
// ============================================

export async function generateInvoice(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const customerId = entities.customer || entities.customerId
    const poId = entities.poId || entities.poNumber
    const items = entities.items || []
    const dueDate = entities.dueDate || entities.date
    const paymentTerms = entities.paymentTerms || 'Net 30'

    // Validate required fields
    if (!customerId && !poId) {
      return {
        success: false,
        error: 'Customer ID or PO number is required. Who should I invoice?',
      }
    }

    // If PO provided, use PO details
    if (poId) {
      const poResult = await query<any>(
        `SELECT po.*, s.name as supplier_name, s.email as supplier_email
         FROM purchase_orders po
         LEFT JOIN suppliers s ON po.supplier_id = s.id
         WHERE po.po_number = $1`,
        [poId]
      )

      if (poResult.rows.length === 0) {
        return {
          success: false,
          error: `Purchase order ${poId} not found`,
        }
      }

      const po = poResult.rows[0]

      // Get PO line items
      const lineItemsResult = await query<any>(
        `SELECT * FROM po_line_items WHERE po_id = $1`,
        [po.id]
      )

      // Generate invoice number
      const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

      // Calculate amounts
      const subtotal = parseFloat(po.total_amount)
      const taxRate = entities.taxRate || 0.08 // Default 8% tax
      const taxAmount = subtotal * taxRate
      const totalAmount = subtotal + taxAmount

      // Create invoice
      const invoiceResult = await query<any>(
        `INSERT INTO invoices (
          invoice_number,
          invoice_type,
          customer_id,
          po_id,
          invoice_date,
          due_date,
          subtotal,
          tax_amount,
          total_amount,
          currency,
          status,
          payment_terms,
          generated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          invoiceNumber,
          'receivable',
          customerId || `customer_${po.buyer_id}`,
          po.id,
          new Date(),
          dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          subtotal,
          taxAmount,
          totalAmount,
          po.currency || 'USD',
          'draft',
          paymentTerms,
          userId,
        ]
      )

      const invoice = invoiceResult.rows[0]

      // Add line items
      for (const lineItem of lineItemsResult.rows) {
        await query(
          `INSERT INTO invoice_line_items (
            invoice_id,
            line_number,
            description,
            quantity,
            unit_price,
            line_total,
            product_sku
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            invoice.id,
            lineItem.line_number,
            lineItem.description,
            lineItem.quantity,
            lineItem.unit_price,
            lineItem.total_price,
            lineItem.product_name,
          ]
        )
      }

      return {
        success: true,
        data: {
          invoiceNumber,
          invoiceId: invoice.id,
          customer: customerId,
          subtotal,
          taxAmount,
          totalAmount,
          dueDate: invoice.due_date,
          status: invoice.status,
          paymentTerms,
          lineItemsCount: lineItemsResult.rows.length,
        },
      }
    }

    // Manual invoice creation (not from PO)
    if (items.length === 0) {
      return {
        success: false,
        error: 'Line items are required. What products/services should I include?',
      }
    }

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    // Calculate amounts
    let subtotal = 0
    const processedItems = []

    for (const item of items) {
      const lineTotal = (item.quantity || 1) * (item.unitPrice || item.price || 0)
      subtotal += lineTotal
      processedItems.push({
        description: item.description || item.name,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || item.price || 0,
        lineTotal,
      })
    }

    const taxRate = entities.taxRate || 0.08
    const taxAmount = subtotal * taxRate
    const totalAmount = subtotal + taxAmount

    // Create invoice
    const invoiceResult = await query<any>(
      `INSERT INTO invoices (
        invoice_number,
        invoice_type,
        customer_id,
        invoice_date,
        due_date,
        subtotal,
        tax_amount,
        total_amount,
        currency,
        status,
        payment_terms,
        generated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        invoiceNumber,
        'receivable',
        customerId,
        new Date(),
        dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal,
        taxAmount,
        totalAmount,
        entities.currency || 'USD',
        'draft',
        paymentTerms,
        userId,
      ]
    )

    const invoice = invoiceResult.rows[0]

    // Add line items
    let lineNumber = 1
    for (const item of processedItems) {
      await query(
        `INSERT INTO invoice_line_items (
          invoice_id,
          line_number,
          description,
          quantity,
          unit_price,
          line_total
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [invoice.id, lineNumber++, item.description, item.quantity, item.unitPrice, item.lineTotal]
      )
    }

    return {
      success: true,
      data: {
        invoiceNumber,
        invoiceId: invoice.id,
        customer: customerId,
        subtotal,
        taxAmount,
        totalAmount,
        dueDate: invoice.due_date,
        status: invoice.status,
        paymentTerms,
        lineItemsCount: processedItems.length,
      },
    }
  } catch (error) {
    console.error('[Invoice Handler] Generate invoice error:', error)
    return {
      success: false,
      error: 'Failed to generate invoice',
    }
  }
}

// ============================================
// Query Invoices
// ============================================

export async function queryInvoices(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    let whereClause = 'WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1

    // Filter by status
    if (entities.status) {
      whereClause += ` AND status = $${paramIndex}`
      params.push(entities.status)
      paramIndex++
    }

    // Filter by customer
    if (entities.customer || entities.customerId) {
      whereClause += ` AND customer_id ILIKE $${paramIndex}`
      params.push(`%${entities.customer || entities.customerId}%`)
      paramIndex++
    }

    // Filter by invoice number
    if (entities.invoiceNumber || entities.invoiceId) {
      whereClause += ` AND invoice_number = $${paramIndex}`
      params.push(entities.invoiceNumber || entities.invoiceId)
      paramIndex++
    }

    // Filter by date range
    if (entities.startDate) {
      whereClause += ` AND invoice_date >= $${paramIndex}`
      params.push(entities.startDate)
      paramIndex++
    }

    if (entities.endDate) {
      whereClause += ` AND invoice_date <= $${paramIndex}`
      params.push(entities.endDate)
      paramIndex++
    }

    // Filter by overdue
    if (entities.overdue) {
      whereClause += ` AND due_date < NOW() AND status != 'paid'`
    }

    const result = await query<any>(
      `SELECT * FROM invoices
       ${whereClause}
       ORDER BY invoice_date DESC
       LIMIT 50`,
      params
    )

    if (result.rows.length === 0) {
      return {
        success: true,
        data: {
          count: 0,
          invoices: [],
          message: 'No invoices found matching your criteria',
        },
      }
    }

    // Calculate totals
    const totalAmount = result.rows.reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0)
    const paidAmount = result.rows
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0)
    const unpaidAmount = totalAmount - paidAmount

    return {
      success: true,
      data: {
        count: result.rows.length,
        totalAmount,
        paidAmount,
        unpaidAmount,
        invoices: result.rows.map(inv => ({
          invoiceNumber: inv.invoice_number,
          customer: inv.customer_id,
          amount: parseFloat(inv.total_amount),
          status: inv.status,
          invoiceDate: inv.invoice_date,
          dueDate: inv.due_date,
          overdue: new Date(inv.due_date) < new Date() && inv.status !== 'paid',
        })),
      },
    }
  } catch (error) {
    console.error('[Invoice Handler] Query invoices error:', error)
    return {
      success: false,
      error: 'Failed to retrieve invoices',
    }
  }
}

// ============================================
// Send Invoice
// ============================================

export async function sendInvoice(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const invoiceNumber = entities.invoiceNumber || entities.invoiceId

    if (!invoiceNumber) {
      return {
        success: false,
        error: 'Invoice number is required. Which invoice should I send?',
      }
    }

    // Get invoice
    const invoiceResult = await query<any>(
      `SELECT * FROM invoices WHERE invoice_number = $1`,
      [invoiceNumber]
    )

    if (invoiceResult.rows.length === 0) {
      return {
        success: false,
        error: `Invoice ${invoiceNumber} not found`,
      }
    }

    const invoice = invoiceResult.rows[0]

    // Update status to sent
    await query(
      `UPDATE invoices SET status = 'sent', updated_at = NOW() WHERE id = $1`,
      [invoice.id]
    )

    // In production, would send email with PDF attachment
    // For now, just update status

    return {
      success: true,
      data: {
        invoiceNumber,
        customer: invoice.customer_id,
        amount: parseFloat(invoice.total_amount),
        status: 'sent',
        message: `Invoice ${invoiceNumber} sent to ${invoice.customer_id}`,
      },
    }
  } catch (error) {
    console.error('[Invoice Handler] Send invoice error:', error)
    return {
      success: false,
      error: 'Failed to send invoice',
    }
  }
}

// ============================================
// Mark Invoice as Paid
// ============================================

export async function markInvoicePaid(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const invoiceNumber = entities.invoiceNumber || entities.invoiceId
    const paymentAmount = entities.amount || entities.paymentAmount

    if (!invoiceNumber) {
      return {
        success: false,
        error: 'Invoice number is required',
      }
    }

    // Get invoice
    const invoiceResult = await query<any>(
      `SELECT * FROM invoices WHERE invoice_number = $1`,
      [invoiceNumber]
    )

    if (invoiceResult.rows.length === 0) {
      return {
        success: false,
        error: `Invoice ${invoiceNumber} not found`,
      }
    }

    const invoice = invoiceResult.rows[0]
    const amountToPay = paymentAmount || parseFloat(invoice.total_amount)

    // Create payment record
    const paymentNumber = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    const paymentResult = await query<any>(
      `INSERT INTO payments (
        payment_number,
        payment_type,
        payment_method,
        amount,
        currency,
        payment_date,
        customer_id,
        status,
        processed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        paymentNumber,
        'received',
        entities.paymentMethod || 'bank_transfer',
        amountToPay,
        invoice.currency,
        new Date(),
        invoice.customer_id,
        'cleared',
        userId,
      ]
    )

    const payment = paymentResult.rows[0]

    // Allocate payment to invoice
    await query(
      `INSERT INTO payment_allocations (payment_id, invoice_id, allocated_amount)
       VALUES ($1, $2, $3)`,
      [payment.id, invoice.id, amountToPay]
    )

    // Update invoice status
    if (amountToPay >= parseFloat(invoice.total_amount)) {
      await query(`UPDATE invoices SET status = 'paid', updated_at = NOW() WHERE id = $1`, [
        invoice.id,
      ])
    } else {
      await query(`UPDATE invoices SET status = 'partial', updated_at = NOW() WHERE id = $1`, [
        invoice.id,
      ])
    }

    return {
      success: true,
      data: {
        invoiceNumber,
        paymentNumber,
        amountPaid: amountToPay,
        invoiceTotal: parseFloat(invoice.total_amount),
        status: amountToPay >= parseFloat(invoice.total_amount) ? 'paid' : 'partial',
      },
    }
  } catch (error) {
    console.error('[Invoice Handler] Mark invoice paid error:', error)
    return {
      success: false,
      error: 'Failed to mark invoice as paid',
    }
  }
}

// ============================================
// Get Invoice Summary
// ============================================

export async function getInvoiceSummary(userId: string): Promise<ExecutionResult> {
  try {
    const result = await query<any>(
      `SELECT
        COUNT(*) as total_invoices,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
        COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
        COUNT(*) FILTER (WHERE status = 'overdue' OR (due_date < NOW() AND status != 'paid')) as overdue_count,
        SUM(total_amount) as total_amount,
        SUM(total_amount) FILTER (WHERE status = 'paid') as paid_amount,
        SUM(total_amount) FILTER (WHERE status != 'paid') as unpaid_amount,
        SUM(total_amount) FILTER (WHERE due_date < NOW() AND status != 'paid') as overdue_amount
       FROM invoices`
    )

    const summary = result.rows[0]

    return {
      success: true,
      data: {
        totalInvoices: parseInt(summary.total_invoices) || 0,
        draft: parseInt(summary.draft_count) || 0,
        sent: parseInt(summary.sent_count) || 0,
        paid: parseInt(summary.paid_count) || 0,
        overdue: parseInt(summary.overdue_count) || 0,
        totalAmount: parseFloat(summary.total_amount) || 0,
        paidAmount: parseFloat(summary.paid_amount) || 0,
        unpaidAmount: parseFloat(summary.unpaid_amount) || 0,
        overdueAmount: parseFloat(summary.overdue_amount) || 0,
      },
    }
  } catch (error) {
    console.error('[Invoice Handler] Get invoice summary error:', error)
    return {
      success: false,
      error: 'Failed to retrieve invoice summary',
    }
  }
}
