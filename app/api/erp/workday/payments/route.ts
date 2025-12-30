// @ts-nocheck
/**
 * Workday Payments API
 *
 * GET /api/erp/workday/payments - List payments
 * GET /api/erp/workday/payments?id=xxx - Get single payment
 * POST /api/erp/workday/payments - Create payment
 * PUT /api/erp/workday/payments - Sync payment
 *
 * Critical for contractor/payroll payment processing.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWorkdayAdapter } from '../connect/route'
import type { Payment } from '@/lib/treasury-sdk/adapters/base'

/**
 * GET - List or get payments
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tenant = searchParams.get('tenant')
    const paymentId = searchParams.get('id')
    const vendorId = searchParams.get('vendorId') || searchParams.get('supplierId')
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const limit = parseInt(searchParams.get('limit') || '100')
    const paymentMethod = searchParams.get('paymentMethod')

    if (!tenant) {
      return NextResponse.json(
        { error: 'tenant parameter is required' },
        { status: 400 }
      )
    }

    const adapter = getWorkdayAdapter(tenant)

    if (!adapter) {
      return NextResponse.json(
        {
          error: 'Not connected',
          message: 'Please connect to Workday first via POST /api/erp/workday/connect',
        },
        { status: 400 }
      )
    }

    // Get single payment
    if (paymentId) {
      const payment = await adapter.getPayment(paymentId)

      if (!payment) {
        return NextResponse.json(
          { error: 'Payment not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ payment })
    }

    // Build filters
    const filters: {
      vendorId?: string
      status?: Payment['status'][]
      dateFrom?: Date
      dateTo?: Date
      limit?: number
    } = { limit }

    if (vendorId) {
      filters.vendorId = vendorId
    }

    if (status) {
      filters.status = status.split(',') as Payment['status'][]
    }

    if (dateFrom) {
      filters.dateFrom = new Date(dateFrom)
    }

    if (dateTo) {
      filters.dateTo = new Date(dateTo)
    }

    let payments = await adapter.getPayments(filters)

    // Filter by payment method if specified
    if (paymentMethod) {
      payments = payments.filter(p => p.paymentMethod === paymentMethod)
    }

    // Calculate summary for contractor/payroll analysis
    const summary = {
      totalAmount: payments.reduce((sum, pmt) => sum + pmt.amount, 0),
      count: payments.length,
      byStatus: payments.reduce((acc, pmt) => {
        acc[pmt.status] = (acc[pmt.status] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      byMethod: payments.reduce((acc, pmt) => {
        if (!acc[pmt.paymentMethod]) {
          acc[pmt.paymentMethod] = { count: 0, amount: 0 }
        }
        acc[pmt.paymentMethod].count++
        acc[pmt.paymentMethod].amount += pmt.amount
        return acc
      }, {} as Record<string, { count: number; amount: number }>),
      byVendor: payments.reduce((acc, pmt) => {
        if (!acc[pmt.vendorId]) {
          acc[pmt.vendorId] = { count: 0, amount: 0 }
        }
        acc[pmt.vendorId].count++
        acc[pmt.vendorId].amount += pmt.amount
        return acc
      }, {} as Record<string, { count: number; amount: number }>),
    }

    return NextResponse.json({
      payments,
      summary,
      total: payments.length,
      limit,
    })
  } catch (error) {
    console.error('Workday payments GET error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch payments',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST - Create payment
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tenant, ...paymentData } = body

    if (!tenant) {
      return NextResponse.json(
        { error: 'tenant is required in request body' },
        { status: 400 }
      )
    }

    if (!paymentData.vendorId && !paymentData.supplierId) {
      return NextResponse.json(
        { error: 'vendorId or supplierId is required' },
        { status: 400 }
      )
    }

    if (!paymentData.amount || paymentData.amount <= 0) {
      return NextResponse.json(
        { error: 'amount must be a positive number' },
        { status: 400 }
      )
    }

    const adapter = getWorkdayAdapter(tenant)

    if (!adapter) {
      return NextResponse.json(
        {
          error: 'Not connected',
          message: 'Please connect to Workday first via POST /api/erp/workday/connect',
        },
        { status: 400 }
      )
    }

    // Normalize vendorId
    if (paymentData.supplierId && !paymentData.vendorId) {
      paymentData.vendorId = paymentData.supplierId
      delete paymentData.supplierId
    }

    // Parse dates
    if (paymentData.paymentDate) {
      paymentData.paymentDate = new Date(paymentData.paymentDate)
    } else {
      paymentData.paymentDate = new Date()
    }

    const result = await adapter.createPayment(paymentData)

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to create payment',
          message: result.error,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      payment: result.data,
      externalId: result.externalId,
      message: `Payment of ${paymentData.amount} ${paymentData.currency || 'USD'} created successfully`,
    })
  } catch (error) {
    console.error('Workday payments POST error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create payment',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT - Sync payment (create or update)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { tenant, ...paymentData } = body

    if (!tenant) {
      return NextResponse.json(
        { error: 'tenant is required in request body' },
        { status: 400 }
      )
    }

    if (!paymentData.id && !paymentData.externalId) {
      return NextResponse.json(
        { error: 'id or externalId is required for sync' },
        { status: 400 }
      )
    }

    const adapter = getWorkdayAdapter(tenant)

    if (!adapter) {
      return NextResponse.json(
        {
          error: 'Not connected',
          message: 'Please connect to Workday first via POST /api/erp/workday/connect',
        },
        { status: 400 }
      )
    }

    // Parse dates
    if (paymentData.paymentDate) {
      paymentData.paymentDate = new Date(paymentData.paymentDate)
    }

    const result = await adapter.syncPayment(paymentData)

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to sync payment',
          message: result.error,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      payment: result.data,
      externalId: result.externalId,
      message: 'Payment synced successfully with Workday',
    })
  } catch (error) {
    console.error('Workday payments PUT error:', error)
    return NextResponse.json(
      {
        error: 'Failed to sync payment',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
