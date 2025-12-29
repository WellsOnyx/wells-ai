// @ts-nocheck
/**
 * WellsAI Conversational ERP - Invoices API
 *
 * CRUD operations for invoices with natural language support.
 *
 * GET /api/erp/wells/invoices - List invoices
 * POST /api/erp/wells/invoices - Create invoice
 * PUT /api/erp/wells/invoices - Update invoice
 * DELETE /api/erp/wells/invoices - Cancel invoice
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { WellsInvoiceService, type CreateInvoiceRequest } from '@/lib/wells-erp/invoice-service'
import { getWellsERP } from '@/lib/erp/wells-erp'

// ============================================================================
// GET - List/Search Invoices
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId') || 'default-user'
    const status = searchParams.get('status')
    const vendorId = searchParams.get('vendorId')
    const vendorName = searchParams.get('vendorName')
    const overdue = searchParams.get('overdue') === 'true'
    const unpaid = searchParams.get('unpaid') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const invoiceId = searchParams.get('id')
    const invoiceNumber = searchParams.get('invoiceNumber')

    // Get single invoice by ID or number
    if (invoiceId || invoiceNumber) {
      const result = await sql`
        SELECT * FROM wells_invoices
        WHERE user_id = ${userId}
          AND (id = ${invoiceId || ''} OR invoice_number = ${invoiceNumber || ''})
        LIMIT 1
      `

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Invoice not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        invoice: mapRowToInvoice(result.rows[0]),
      })
    }

    // List invoices with filters
    const criteria = {
      vendorId,
      vendorName,
      status: status as string | undefined,
      overdue,
      limit,
      offset,
    }

    if (unpaid) {
      const result = await WellsInvoiceService.getUnpaidInvoices(userId)
      return NextResponse.json({
        invoices: result.invoices,
        summary: result.summary,
        total: result.invoices.length,
      })
    }

    const result = await WellsInvoiceService.listInvoices(userId, criteria)

    // Get total count for pagination
    const countResult = await sql`
      SELECT COUNT(*) as total FROM wells_invoices
      WHERE user_id = ${userId}
    `

    return NextResponse.json({
      invoices: result.invoices,
      summary: result.summary,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset,
    })
  } catch (error) {
    console.error('Invoices GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST - Create Invoice
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId = 'default-user', naturalLanguage, ...invoiceData } = body

    // Support both natural language and structured input
    if (naturalLanguage) {
      // Use natural language parser
      const erp = getWellsERP(userId)
      const invoice = await erp.createInvoice(naturalLanguage)

      return NextResponse.json({
        success: true,
        invoice,
        message: `Invoice ${invoice.invoiceNumber} created successfully`,
      })
    }

    // Structured input
    const { vendorName, vendorEmail, amount, lineItems, description, dueDate, paymentTerms, poNumber } = invoiceData

    if (!vendorName && !invoiceData.contactName) {
      return NextResponse.json(
        { error: 'vendorName or contactName is required' },
        { status: 400 }
      )
    }

    if (!amount && (!lineItems || lineItems.length === 0)) {
      return NextResponse.json(
        { error: 'amount or lineItems is required' },
        { status: 400 }
      )
    }

    const createRequest: CreateInvoiceRequest = {
      vendorName: vendorName || invoiceData.contactName,
      vendorEmail: vendorEmail || invoiceData.contactEmail,
      amount,
      lineItems,
      description,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      paymentTerms,
      poNumber,
    }

    const result = await WellsInvoiceService.createInvoice(userId, createRequest)

    return NextResponse.json({
      success: true,
      invoice: result.invoice,
      message: result.message,
    })
  } catch (error) {
    console.error('Invoices POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create invoice' },
      { status: 500 }
    )
  }
}

// ============================================================================
// PUT - Update Invoice
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId = 'default-user', invoiceId, action, ...updateData } = body

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'invoiceId is required' },
        { status: 400 }
      )
    }

    // Handle specific actions
    switch (action) {
      case 'mark_paid':
        const paidResult = await WellsInvoiceService.markAsPaid(
          userId,
          invoiceId,
          updateData.amount,
          updateData.paymentDate ? new Date(updateData.paymentDate) : undefined
        )
        return NextResponse.json({
          success: true,
          invoice: paidResult.invoice,
          message: paidResult.message,
        })

      case 'send':
        // Mark as sent
        await sql`
          UPDATE wells_invoices
          SET status = 'sent', updated_at = NOW()
          WHERE id = ${invoiceId} AND user_id = ${userId}
        `
        return NextResponse.json({
          success: true,
          message: 'Invoice marked as sent',
        })

      case 'send_reminder':
        const reminderResult = await WellsInvoiceService.sendReminder(userId, invoiceId)
        return NextResponse.json({
          success: true,
          invoice: reminderResult.invoice,
          message: reminderResult.message,
          emailSent: reminderResult.emailSent,
        })

      default:
        // General update
        const updates: string[] = []
        const values: unknown[] = []
        let paramIndex = 1

        if (updateData.description !== undefined) {
          updates.push(`description = $${paramIndex++}`)
          values.push(updateData.description)
        }
        if (updateData.notes !== undefined) {
          updates.push(`notes = $${paramIndex++}`)
          values.push(updateData.notes)
        }
        if (updateData.dueDate !== undefined) {
          updates.push(`due_date = $${paramIndex++}`)
          values.push(new Date(updateData.dueDate).toISOString())
        }
        if (updateData.status !== undefined) {
          updates.push(`status = $${paramIndex++}`)
          values.push(updateData.status)
        }

        if (updates.length === 0) {
          return NextResponse.json(
            { error: 'No update fields provided' },
            { status: 400 }
          )
        }

        // Build and execute update query
        await sql`
          UPDATE wells_invoices
          SET ${sql.unsafe(updates.join(', '))}, updated_at = NOW()
          WHERE id = ${invoiceId} AND user_id = ${userId}
        `

        // Fetch updated invoice
        const result = await sql`
          SELECT * FROM wells_invoices WHERE id = ${invoiceId}
        `

        return NextResponse.json({
          success: true,
          invoice: mapRowToInvoice(result.rows[0]),
          message: 'Invoice updated successfully',
        })
    }
  } catch (error) {
    console.error('Invoices PUT error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update invoice' },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE - Cancel Invoice
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const invoiceId = searchParams.get('id') || searchParams.get('invoiceId')
    const userId = searchParams.get('userId') || 'default-user'
    const reason = searchParams.get('reason')

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'invoiceId is required' },
        { status: 400 }
      )
    }

    const result = await WellsInvoiceService.cancelInvoice(userId, invoiceId, reason || undefined)

    return NextResponse.json({
      success: true,
      invoice: result.invoice,
      message: result.message,
    })
  } catch (error) {
    console.error('Invoices DELETE error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel invoice' },
      { status: 500 }
    )
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapRowToInvoice(row: Record<string, unknown>) {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    vendorEmail: row.vendor_email,
    subtotal: parseFloat(row.subtotal as string),
    taxAmount: parseFloat(row.tax_amount as string),
    wellsFee: parseFloat(row.wells_fee as string),
    totalAmount: parseFloat(row.total_amount as string),
    amountPaid: parseFloat(row.amount_paid as string),
    amountDue: parseFloat(row.amount_due as string),
    currency: row.currency,
    invoiceDate: new Date(row.invoice_date as string),
    dueDate: new Date(row.due_date as string),
    paidDate: row.paid_date ? new Date(row.paid_date as string) : null,
    status: row.status,
    lineItems: row.line_items || [],
    description: row.description,
    notes: row.notes,
    paymentTerms: row.payment_terms,
    poNumber: row.po_number,
    createdByAi: row.created_by_ai,
    aiConversationId: row.ai_conversation_id,
    aiCommand: row.ai_command,
    remindersSent: parseInt(row.reminders_sent as string) || 0,
    lastReminderAt: row.last_reminder_at ? new Date(row.last_reminder_at as string) : null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}
