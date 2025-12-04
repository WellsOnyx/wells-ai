/**
 * Layer 2: G&V Internal ERP - Payments API
 * POST /api/gv/erp/payments
 * GET /api/gv/erp/payments
 */

import { NextRequest, NextResponse } from 'next/server'
import type {
  GvPaymentInstruction,
  CreatePaymentRequest,
  PaginatedResponse,
} from '../types'

// In-memory store
const paymentsStore: Map<string, GvPaymentInstruction> = new Map()
let paymentCounter = 8000

export async function POST(request: NextRequest) {
  try {
    const body: CreatePaymentRequest = await request.json()

    if (!body.vendorId || !body.invoiceIds?.length || !body.amount || !body.paymentMethod) {
      return NextResponse.json(
        { error: 'vendorId, invoiceIds, amount, and paymentMethod are required' },
        { status: 400 }
      )
    }

    paymentCounter++
    const paymentNumber = `PAY-${new Date().getFullYear()}-${String(paymentCounter).padStart(5, '0')}`

    const payment: GvPaymentInstruction = {
      id: crypto.randomUUID(),
      paymentNumber,
      status: 'draft',
      vendorId: body.vendorId,
      paymentMethod: body.paymentMethod,
      amount: body.amount,
      currency: 'USD',
      requestedDate: new Date().toISOString().split('T')[0],
      scheduledDate: body.scheduledDate,
      invoiceIds: body.invoiceIds,
      invoiceNumbers: [],
      totalInvoiceAmount: body.amount,
      createdBy: 'system',
      memo: body.memo,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    paymentsStore.set(payment.id, payment)

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error('POST payment error:', error)
    return NextResponse.json(
      { error: 'Failed to create payment' },
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
    const paymentMethod = searchParams.get('paymentMethod')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    if (id) {
      const payment = paymentsStore.get(id)
      if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
      return NextResponse.json(payment)
    }

    let payments = Array.from(paymentsStore.values())

    if (vendorId) payments = payments.filter(p => p.vendorId === vendorId)
    if (status) payments = payments.filter(p => p.status === status)
    if (paymentMethod) payments = payments.filter(p => p.paymentMethod === paymentMethod)

    payments.sort((a, b) =>
      new Date(b.requestedDate).getTime() - new Date(a.requestedDate).getTime()
    )

    const total = payments.length
    const totalPages = Math.ceil(total / limit)
    const startIndex = (page - 1) * limit
    const paginatedPayments = payments.slice(startIndex, startIndex + limit)

    const response: PaginatedResponse<GvPaymentInstruction> = {
      data: paginatedPayments,
      pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('GET payments error:', error)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, action, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Payment ID required' }, { status: 400 })
    }

    const existing = paymentsStore.get(id)
    if (!existing) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    if (action) {
      switch (action) {
        case 'submit':
          existing.status = 'pending_authorization'
          break
        case 'authorize':
          existing.status = 'authorized'
          existing.authorizedBy = updates.authorizedBy || 'system'
          existing.authorizedAt = new Date().toISOString()
          existing.authorizationMethod = updates.authorizationMethod || 'manual'
          break
        case 'process':
          existing.status = 'processing'
          break
        case 'complete':
          existing.status = 'completed'
          existing.executedDate = new Date().toISOString()
          existing.settledDate = existing.paymentMethod === 'grain'
            ? new Date().toISOString()
            : undefined
          if (updates.grainTxHash) {
            existing.grainTxHash = updates.grainTxHash
            existing.grainBlockNumber = updates.grainBlockNumber
          }
          break
        case 'fail':
          existing.status = 'failed'
          existing.failureReason = updates.failureReason
          existing.retryCount++
          existing.lastRetryAt = new Date().toISOString()
          break
        case 'reverse':
          existing.status = 'reversed'
          break
        case 'cancel':
          existing.status = 'cancelled'
          break
      }
    }

    const updated: GvPaymentInstruction = {
      ...existing,
      ...updates,
      id: existing.id,
      paymentNumber: existing.paymentNumber,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    }

    paymentsStore.set(id, updated)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT payment error:', error)
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 })
  }
}

export { GET as getPayments, POST as createPayment, PUT as updatePayment }
