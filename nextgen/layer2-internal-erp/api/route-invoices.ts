// @ts-nocheck
/**
 * Layer 2: G&V Internal ERP - Invoices API
 * POST /api/gv/erp/invoices
 * GET /api/gv/erp/invoices
 */

import { NextRequest, NextResponse } from 'next/server'
import type {
  GvInvoice,
  GvInvoiceLineItem,
  CreateInvoiceRequest,
  PaginatedResponse,
} from '../types'

// In-memory store
const invoicesStore: Map<string, GvInvoice> = new Map()
let invoiceCounter = 5000

// Initialize sample data
initializeSampleInvoices()

export async function POST(request: NextRequest) {
  try {
    const body: CreateInvoiceRequest = await request.json()

    if (!body.vendorId || !body.vendorInvoiceNumber || !body.lineItems?.length) {
      return NextResponse.json(
        { error: 'vendorId, vendorInvoiceNumber, and lineItems are required' },
        { status: 400 }
      )
    }

    invoiceCounter++
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCounter).padStart(5, '0')}`

    const lineItems: GvInvoiceLineItem[] = body.lineItems.map((item, index) => ({
      lineNumber: index + 1,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.quantity * item.unitPrice,
      accountCode: item.accountCode,
    }))

    const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0)
    const invoiceDate = body.invoiceDate || new Date().toISOString().split('T')[0]

    // Calculate due date (default Net30)
    const dueDate = body.dueDate || (() => {
      const date = new Date(invoiceDate)
      date.setDate(date.getDate() + 30)
      return date.toISOString().split('T')[0]
    })()

    const invoice: GvInvoice = {
      id: crypto.randomUUID(),
      invoiceNumber,
      vendorId: body.vendorId,
      vendorInvoiceNumber: body.vendorInvoiceNumber,
      status: 'received',
      purchaseOrderId: body.purchaseOrderId,
      invoiceDate,
      receivedDate: new Date().toISOString().split('T')[0],
      dueDate,
      lineItems,
      subtotal,
      taxAmount: 0,
      shippingAmount: 0,
      discountAmount: 0,
      totalAmount: subtotal,
      amountPaid: 0,
      amountDue: subtotal,
      currency: 'USD',
      paymentTerms: 'Net30',
      poMatched: !!body.purchaseOrderId,
      receiptMatched: false,
      isDisputed: false,
      notes: body.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    invoicesStore.set(invoice.id, invoice)

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error('POST invoice error:', error)
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const vendorId = searchParams.get('vendorId')
    const status = searchParams.get('status')
    const overdue = searchParams.get('overdue')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    if (id) {
      const invoice = invoicesStore.get(id)
      if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
      return NextResponse.json(invoice)
    }

    let invoices = Array.from(invoicesStore.values())

    if (vendorId) invoices = invoices.filter(i => i.vendorId === vendorId)
    if (status) invoices = invoices.filter(i => i.status === status)
    if (overdue === 'true') {
      const today = new Date().toISOString().split('T')[0]
      invoices = invoices.filter(i =>
        i.dueDate < today && !['paid', 'cancelled', 'written_off'].includes(i.status)
      )
    }

    invoices.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())

    const total = invoices.length
    const totalPages = Math.ceil(total / limit)
    const startIndex = (page - 1) * limit
    const paginatedInvoices = invoices.slice(startIndex, startIndex + limit)

    const response: PaginatedResponse<GvInvoice> = {
      data: paginatedInvoices,
      pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('GET invoices error:', error)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, action, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 })
    }

    const existing = invoicesStore.get(id)
    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (action) {
      const statusTransitions: Record<string, string> = {
        review: 'pending_review',
        submit_for_approval: 'pending_approval',
        approve: 'approved',
        dispute: 'disputed',
        schedule: 'scheduled',
        pay_partial: 'partially_paid',
        pay: 'paid',
        cancel: 'cancelled',
        write_off: 'written_off',
      }

      if (statusTransitions[action]) {
        existing.status = statusTransitions[action] as GvInvoice['status']
        if (action === 'approve') {
          existing.approvedBy = updates.approvedBy || 'system'
          existing.approvalDate = new Date().toISOString()
        }
        if (action === 'pay' || action === 'pay_partial') {
          const paymentAmount = updates.paymentAmount || existing.amountDue
          existing.amountPaid += paymentAmount
          existing.amountDue = existing.totalAmount - existing.amountPaid
          if (existing.amountDue <= 0) {
            existing.status = 'paid'
            existing.paidDate = new Date().toISOString()
          }
        }
        if (action === 'dispute') {
          existing.isDisputed = true
          existing.disputeReason = updates.disputeReason
        }
      }
    }

    const updated: GvInvoice = {
      ...existing,
      ...updates,
      id: existing.id,
      invoiceNumber: existing.invoiceNumber,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    }

    invoicesStore.set(id, updated)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT invoice error:', error)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}

function initializeSampleInvoices() {
  const samples: Partial<GvInvoice>[] = [
    {
      id: 'inv-001',
      invoiceNumber: 'INV-2024-05001',
      vendorId: 'vendor-001',
      vendorInvoiceNumber: 'ACME-INV-12345',
      status: 'approved',
      invoiceDate: '2024-01-22',
      receivedDate: '2024-01-22',
      dueDate: '2024-02-21',
      lineItems: [
        { lineNumber: 1, description: 'Industrial Bearings', quantity: 500, unitPrice: 15.50, lineTotal: 7750.00 },
        { lineNumber: 2, description: 'Lubricant Drums', quantity: 20, unitPrice: 400.00, lineTotal: 8000.00 },
      ],
      subtotal: 15750.00,
      taxAmount: 0,
      shippingAmount: 0,
      discountAmount: 0,
      totalAmount: 15750.00,
      amountPaid: 0,
      amountDue: 15750.00,
      currency: 'USD',
      paymentTerms: 'Net30',
      poMatched: true,
      receiptMatched: true,
      isDisputed: false,
    },
    {
      id: 'inv-002',
      invoiceNumber: 'INV-2024-05002',
      vendorId: 'vendor-002',
      vendorInvoiceNumber: 'TS-2024-0089',
      status: 'overdue',
      invoiceDate: '2023-12-15',
      receivedDate: '2023-12-16',
      dueDate: '2024-01-14',
      lineItems: [
        { lineNumber: 1, description: 'Software License', quantity: 1, unitPrice: 12500.00, lineTotal: 12500.00 },
      ],
      subtotal: 12500.00,
      taxAmount: 0,
      totalAmount: 12500.00,
      amountPaid: 5000.00,
      amountDue: 7500.00,
      currency: 'USD',
      isDisputed: false,
    },
  ]

  samples.forEach(inv => {
    invoicesStore.set(inv.id!, {
      ...inv,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as GvInvoice)
  })
}

export { GET as getInvoices, POST as createInvoice, PUT as updateInvoice }
