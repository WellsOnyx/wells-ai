/**
 * Payment Handler
 * Handles conversational payment recording, tracking, and queries
 */

import { query } from '../db'
import { ExecutionResult } from '../conversational-engine'

// ============================================
// Record Payment
// ============================================

export async function recordPayment(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const amount = entities.amount || entities.paymentAmount
    const paymentMethod = entities.paymentMethod || entities.method || 'bank_transfer'
    const paymentType = entities.type || 'received' // 'received' or 'sent'
    const reference = entities.reference || entities.referenceNumber
    const customerId = entities.customer || entities.customerId
    const supplierId = entities.supplier || entities.supplierId
    const invoiceNumber = entities.invoice || entities.invoiceNumber

    if (!amount) {
      return {
        success: false,
        error: 'Payment amount is required. How much was paid?',
      }
    }

    if (!customerId && !supplierId && !invoiceNumber) {
      return {
        success: false,
        error: 'Customer, supplier, or invoice number is required',
      }
    }

    // Generate payment number
    const paymentNumber = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    // Get supplier ID if supplier name provided
    let actualSupplierId = supplierId
    if (entities.supplier && !supplierId) {
      const supplierResult = await query<any>(
        `SELECT id FROM suppliers WHERE name ILIKE $1 LIMIT 1`,
        [`%${entities.supplier}%`]
      )
      if (supplierResult.rows.length > 0) {
        actualSupplierId = supplierResult.rows[0].id
      }
    }

    // Create payment record
    const paymentResult = await query<any>(
      `INSERT INTO payments (
        payment_number,
        payment_type,
        payment_method,
        amount,
        currency,
        payment_date,
        reference_number,
        customer_id,
        supplier_id,
        status,
        notes,
        processed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        paymentNumber,
        paymentType,
        paymentMethod,
        amount,
        entities.currency || 'USD',
        entities.paymentDate || new Date(),
        reference,
        customerId,
        actualSupplierId,
        entities.status || 'pending',
        entities.notes,
        userId,
      ]
    )

    const payment = paymentResult.rows[0]

    // If invoice number provided, allocate payment to invoice
    if (invoiceNumber) {
      const invoiceResult = await query<any>(
        `SELECT id, total_amount FROM invoices WHERE invoice_number = $1`,
        [invoiceNumber]
      )

      if (invoiceResult.rows.length > 0) {
        const invoice = invoiceResult.rows[0]
        const allocatedAmount = Math.min(amount, parseFloat(invoice.total_amount))

        await query(
          `INSERT INTO payment_allocations (payment_id, invoice_id, allocated_amount)
           VALUES ($1, $2, $3)`,
          [payment.id, invoice.id, allocatedAmount]
        )

        // Update invoice status
        if (allocatedAmount >= parseFloat(invoice.total_amount)) {
          await query(`UPDATE invoices SET status = 'paid', updated_at = NOW() WHERE id = $1`, [
            invoice.id,
          ])
        } else {
          await query(`UPDATE invoices SET status = 'partial', updated_at = NOW() WHERE id = $1`, [
            invoice.id,
          ])
        }
      }
    }

    return {
      success: true,
      data: {
        paymentNumber,
        paymentId: payment.id,
        amount,
        paymentMethod,
        paymentType,
        customer: customerId,
        supplier: entities.supplier,
        invoiceNumber,
        status: payment.status,
      },
    }
  } catch (error) {
    console.error('[Payment Handler] Record payment error:', error)
    return {
      success: false,
      error: 'Failed to record payment',
    }
  }
}

// ============================================
// Query Payments
// ============================================

export async function queryPayments(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    let whereClause = 'WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1

    // Filter by payment type
    if (entities.type || entities.paymentType) {
      whereClause += ` AND payment_type = $${paramIndex}`
      params.push(entities.type || entities.paymentType)
      paramIndex++
    }

    // Filter by payment method
    if (entities.method || entities.paymentMethod) {
      whereClause += ` AND payment_method = $${paramIndex}`
      params.push(entities.method || entities.paymentMethod)
      paramIndex++
    }

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

    // Filter by supplier
    if (entities.supplier) {
      whereClause += ` AND supplier_id IN (SELECT id FROM suppliers WHERE name ILIKE $${paramIndex})`
      params.push(`%${entities.supplier}%`)
      paramIndex++
    }

    // Filter by date range
    if (entities.startDate) {
      whereClause += ` AND payment_date >= $${paramIndex}`
      params.push(entities.startDate)
      paramIndex++
    }

    if (entities.endDate) {
      whereClause += ` AND payment_date <= $${paramIndex}`
      params.push(entities.endDate)
      paramIndex++
    }

    // Filter by payment number
    if (entities.paymentNumber) {
      whereClause += ` AND payment_number = $${paramIndex}`
      params.push(entities.paymentNumber)
      paramIndex++
    }

    const result = await query<any>(
      `SELECT * FROM payments
       ${whereClause}
       ORDER BY payment_date DESC
       LIMIT 50`,
      params
    )

    if (result.rows.length === 0) {
      return {
        success: true,
        data: {
          count: 0,
          payments: [],
          message: 'No payments found matching your criteria',
        },
      }
    }

    // Calculate totals
    const totalAmount = result.rows.reduce((sum, pay) => sum + parseFloat(pay.amount), 0)
    const receivedAmount = result.rows
      .filter(pay => pay.payment_type === 'received')
      .reduce((sum, pay) => sum + parseFloat(pay.amount), 0)
    const sentAmount = result.rows
      .filter(pay => pay.payment_type === 'sent')
      .reduce((sum, pay) => sum + parseFloat(pay.amount), 0)

    return {
      success: true,
      data: {
        count: result.rows.length,
        totalAmount,
        receivedAmount,
        sentAmount,
        netAmount: receivedAmount - sentAmount,
        payments: result.rows.map(pay => ({
          paymentNumber: pay.payment_number,
          type: pay.payment_type,
          method: pay.payment_method,
          amount: parseFloat(pay.amount),
          status: pay.status,
          customer: pay.customer_id,
          date: pay.payment_date,
          reference: pay.reference_number,
        })),
      },
    }
  } catch (error) {
    console.error('[Payment Handler] Query payments error:', error)
    return {
      success: false,
      error: 'Failed to retrieve payments',
    }
  }
}

// ============================================
// Get Payment Summary
// ============================================

export async function getPaymentSummary(userId: string): Promise<ExecutionResult> {
  try {
    const result = await query<any>(
      `SELECT
        COUNT(*) as total_payments,
        COUNT(*) FILTER (WHERE payment_type = 'received') as received_count,
        COUNT(*) FILTER (WHERE payment_type = 'sent') as sent_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'cleared') as cleared_count,
        SUM(amount) FILTER (WHERE payment_type = 'received') as total_received,
        SUM(amount) FILTER (WHERE payment_type = 'sent') as total_sent,
        SUM(amount) FILTER (WHERE status = 'pending') as pending_amount
       FROM payments`
    )

    const summary = result.rows[0]

    return {
      success: true,
      data: {
        totalPayments: parseInt(summary.total_payments) || 0,
        received: {
          count: parseInt(summary.received_count) || 0,
          amount: parseFloat(summary.total_received) || 0,
        },
        sent: {
          count: parseInt(summary.sent_count) || 0,
          amount: parseFloat(summary.total_sent) || 0,
        },
        pending: {
          count: parseInt(summary.pending_count) || 0,
          amount: parseFloat(summary.pending_amount) || 0,
        },
        cleared: parseInt(summary.cleared_count) || 0,
        netCashFlow: (parseFloat(summary.total_received) || 0) - (parseFloat(summary.total_sent) || 0),
      },
    }
  } catch (error) {
    console.error('[Payment Handler] Get payment summary error:', error)
    return {
      success: false,
      error: 'Failed to retrieve payment summary',
    }
  }
}

// ============================================
// Reconcile Payment
// ============================================

export async function reconcilePayment(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const paymentNumber = entities.paymentNumber
    const invoiceNumber = entities.invoiceNumber

    if (!paymentNumber || !invoiceNumber) {
      return {
        success: false,
        error: 'Payment number and invoice number are required',
      }
    }

    // Get payment
    const paymentResult = await query<any>(
      `SELECT * FROM payments WHERE payment_number = $1`,
      [paymentNumber]
    )

    if (paymentResult.rows.length === 0) {
      return {
        success: false,
        error: `Payment ${paymentNumber} not found`,
      }
    }

    const payment = paymentResult.rows[0]

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

    // Check if already allocated
    const existingAllocation = await query<any>(
      `SELECT * FROM payment_allocations WHERE payment_id = $1 AND invoice_id = $2`,
      [payment.id, invoice.id]
    )

    if (existingAllocation.rows.length > 0) {
      return {
        success: false,
        error: `Payment ${paymentNumber} is already allocated to invoice ${invoiceNumber}`,
      }
    }

    // Allocate payment to invoice
    const allocatedAmount = Math.min(
      parseFloat(payment.amount),
      parseFloat(invoice.total_amount)
    )

    await query(
      `INSERT INTO payment_allocations (payment_id, invoice_id, allocated_amount)
       VALUES ($1, $2, $3)`,
      [payment.id, invoice.id, allocatedAmount]
    )

    // Update invoice status
    const totalAllocated = await query<any>(
      `SELECT SUM(allocated_amount) as total FROM payment_allocations WHERE invoice_id = $1`,
      [invoice.id]
    )

    const totalPaid = parseFloat(totalAllocated.rows[0].total) || 0

    if (totalPaid >= parseFloat(invoice.total_amount)) {
      await query(`UPDATE invoices SET status = 'paid', updated_at = NOW() WHERE id = $1`, [
        invoice.id,
      ])
    } else if (totalPaid > 0) {
      await query(`UPDATE invoices SET status = 'partial', updated_at = NOW() WHERE id = $1`, [
        invoice.id,
      ])
    }

    return {
      success: true,
      data: {
        paymentNumber,
        invoiceNumber,
        allocatedAmount,
        invoiceTotal: parseFloat(invoice.total_amount),
        totalPaid,
        status: totalPaid >= parseFloat(invoice.total_amount) ? 'paid' : 'partial',
      },
    }
  } catch (error) {
    console.error('[Payment Handler] Reconcile payment error:', error)
    return {
      success: false,
      error: 'Failed to reconcile payment',
    }
  }
}
