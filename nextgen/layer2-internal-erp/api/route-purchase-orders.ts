// @ts-nocheck
/**
 * Layer 2: G&V Internal ERP - Purchase Orders API
 * POST /api/gv/erp/purchase-orders
 * GET /api/gv/erp/purchase-orders
 */

import { NextRequest, NextResponse } from 'next/server'
import type {
  GvPurchaseOrder,
  GvPOLineItem,
  CreatePORequest,
  PaginatedResponse,
} from '../types'

// In-memory store
const posStore: Map<string, GvPurchaseOrder> = new Map()
let poCounter = 1000

export async function POST(request: NextRequest) {
  try {
    const body: CreatePORequest = await request.json()

    if (!body.vendorId || !body.lineItems?.length) {
      return NextResponse.json(
        { error: 'vendorId and at least one lineItem are required' },
        { status: 400 }
      )
    }

    // Generate PO number
    poCounter++
    const poNumber = `PO-${new Date().getFullYear()}-${String(poCounter).padStart(5, '0')}`

    // Calculate totals
    const lineItems: GvPOLineItem[] = body.lineItems.map((item, index) => {
      const lineTotal = item.quantity * item.unitPrice
      return {
        lineNumber: index + 1,
        description: item.description,
        quantity: item.quantity,
        quantityReceived: 0,
        unitOfMeasure: item.unitOfMeasure || 'EA',
        unitPrice: item.unitPrice,
        lineTotal,
        accountCode: item.accountCode,
      }
    })

    const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0)

    const po: GvPurchaseOrder = {
      id: crypto.randomUUID(),
      poNumber,
      vendorId: body.vendorId,
      status: 'draft',
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: body.expectedDeliveryDate,
      lineItems,
      subtotal,
      taxAmount: 0,
      shippingAmount: 0,
      discountAmount: 0,
      totalAmount: subtotal,
      currency: 'USD',
      paymentTerms: body.paymentTerms || 'Net30',
      costCenter: body.costCenter,
      department: body.department,
      project: body.project,
      internalNotes: body.internalNotes,
      vendorNotes: body.vendorNotes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    posStore.set(po.id, po)

    return NextResponse.json(po, { status: 201 })
  } catch (error) {
    console.error('POST PO error:', error)
    return NextResponse.json(
      { error: 'Failed to create purchase order' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const poNumber = searchParams.get('poNumber')
    const vendorId = searchParams.get('vendorId')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    // Single PO by ID or number
    if (id) {
      const po = posStore.get(id)
      if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 })
      return NextResponse.json(po)
    }

    if (poNumber) {
      const po = Array.from(posStore.values()).find(p => p.poNumber === poNumber)
      if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 })
      return NextResponse.json(po)
    }

    // List with filters
    let pos = Array.from(posStore.values())

    if (vendorId) pos = pos.filter(p => p.vendorId === vendorId)
    if (status) pos = pos.filter(p => p.status === status)

    // Sort by date descending
    pos.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())

    // Pagination
    const total = pos.length
    const totalPages = Math.ceil(total / limit)
    const startIndex = (page - 1) * limit
    const paginatedPos = pos.slice(startIndex, startIndex + limit)

    const response: PaginatedResponse<GvPurchaseOrder> = {
      data: paginatedPos,
      pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('GET POs error:', error)
    return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, action, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'PO ID required' }, { status: 400 })
    }

    const existing = posStore.get(id)
    if (!existing) {
      return NextResponse.json({ error: 'PO not found' }, { status: 404 })
    }

    // Handle status actions
    if (action) {
      const statusTransitions: Record<string, string> = {
        submit: 'pending_approval',
        approve: 'approved',
        send: 'sent_to_vendor',
        acknowledge: 'acknowledged',
        receive_partial: 'partially_fulfilled',
        receive_full: 'fulfilled',
        close: 'closed',
        cancel: 'cancelled',
      }

      if (statusTransitions[action]) {
        existing.status = statusTransitions[action] as GvPurchaseOrder['status']
        if (action === 'approve') {
          existing.approvedBy = updates.approvedBy || 'system'
          existing.approvalDate = new Date().toISOString()
        }
        if (action === 'close') {
          existing.closedAt = new Date().toISOString()
        }
      }
    }

    const updated: GvPurchaseOrder = {
      ...existing,
      ...updates,
      id: existing.id,
      poNumber: existing.poNumber,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    }

    posStore.set(id, updated)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT PO error:', error)
    return NextResponse.json({ error: 'Failed to update PO' }, { status: 500 })
  }
}

export { GET as getPurchaseOrders, POST as createPurchaseOrder, PUT as updatePurchaseOrder }
