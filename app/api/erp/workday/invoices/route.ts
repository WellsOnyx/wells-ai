// @ts-nocheck
/**
 * Workday Supplier Invoices API
 *
 * GET /api/erp/workday/invoices - List invoices
 * GET /api/erp/workday/invoices?id=xxx - Get single invoice
 * GET /api/erp/workday/invoices?payable=true - Get payable invoices
 *
 * Critical for contractor/payroll spend visibility.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWorkdayAdapter } from '../connect/route'
import type { Invoice } from '@/lib/treasury-sdk/adapters/base'

/**
 * GET - List or get invoices
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tenant = searchParams.get('tenant')
    const invoiceId = searchParams.get('id')
    const vendorId = searchParams.get('vendorId') || searchParams.get('supplierId')
    const status = searchParams.get('status')
    const payable = searchParams.get('payable') === 'true'
    const overdue = searchParams.get('overdue') === 'true'
    const limit = parseInt(searchParams.get('limit') || '100')
    const dueBefore = searchParams.get('dueBefore')
    const dueAfter = searchParams.get('dueAfter')
    const modifiedSince = searchParams.get('modifiedSince')

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

    // Get single invoice
    if (invoiceId) {
      const invoice = await adapter.getInvoice(invoiceId)

      if (!invoice) {
        return NextResponse.json(
          { error: 'Invoice not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ invoice })
    }

    // Get payable invoices only
    if (payable) {
      const invoices = await adapter.getPayableInvoices()

      // Calculate summary for payroll/contractor spend
      const summary = {
        totalAmount: invoices.reduce((sum, inv) => sum + inv.amount, 0),
        count: invoices.length,
        byVendor: invoices.reduce((acc, inv) => {
          if (!acc[inv.vendorName]) {
            acc[inv.vendorName] = { count: 0, amount: 0 }
          }
          acc[inv.vendorName].count++
          acc[inv.vendorName].amount += inv.amount
          return acc
        }, {} as Record<string, { count: number; amount: number }>),
        byStatus: {
          open: invoices.filter(i => i.status === 'open').length,
          partial: invoices.filter(i => i.status === 'partial').length,
        },
      }

      return NextResponse.json({
        invoices,
        summary,
        total: invoices.length,
      })
    }

    // Build filters
    const filters: {
      status?: Invoice['status'][]
      vendorId?: string
      dueBefore?: Date
      dueAfter?: Date
      modifiedSince?: Date
      limit?: number
    } = { limit }

    if (vendorId) {
      filters.vendorId = vendorId
    }

    if (status) {
      filters.status = status.split(',') as Invoice['status'][]
    }

    if (overdue) {
      filters.dueBefore = new Date()
      filters.status = ['open', 'partial']
    }

    if (dueBefore) {
      filters.dueBefore = new Date(dueBefore)
    }

    if (dueAfter) {
      filters.dueAfter = new Date(dueAfter)
    }

    if (modifiedSince) {
      filters.modifiedSince = new Date(modifiedSince)
    }

    const invoices = await adapter.getInvoices(filters)

    // Calculate summary
    const summary = {
      totalAmount: invoices.reduce((sum, inv) => sum + inv.amount, 0),
      count: invoices.length,
      byStatus: invoices.reduce((acc, inv) => {
        acc[inv.status] = (acc[inv.status] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      byCurrency: invoices.reduce((acc, inv) => {
        if (!acc[inv.currency]) {
          acc[inv.currency] = { count: 0, amount: 0 }
        }
        acc[inv.currency].count++
        acc[inv.currency].amount += inv.amount
        return acc
      }, {} as Record<string, { count: number; amount: number }>),
    }

    return NextResponse.json({
      invoices,
      summary,
      total: invoices.length,
      limit,
    })
  } catch (error) {
    console.error('Workday invoices GET error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch invoices',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
