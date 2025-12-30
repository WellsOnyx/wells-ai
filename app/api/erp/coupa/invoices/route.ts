// @ts-nocheck
/**
 * Coupa Invoices API
 *
 * GET /api/erp/coupa/invoices - List invoices
 * GET /api/erp/coupa/invoices?id=xxx - Get single invoice
 * GET /api/erp/coupa/invoices?payable=true - Get payable invoices
 *
 * Coupa is procurement-focused - invoice management is a core strength.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCoupaAdapter } from '../connect/route'
import type { Invoice } from '@/lib/treasury-sdk/adapters/base'

/**
 * GET - List or get invoices
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const instanceUrl = searchParams.get('instanceUrl')
    const invoiceId = searchParams.get('id')
    const vendorId = searchParams.get('vendorId') || searchParams.get('supplierId')
    const status = searchParams.get('status')
    const payable = searchParams.get('payable') === 'true'
    const overdue = searchParams.get('overdue') === 'true'
    const pendingApproval = searchParams.get('pendingApproval') === 'true'
    const limit = parseInt(searchParams.get('limit') || '100')
    const dueBefore = searchParams.get('dueBefore')
    const dueAfter = searchParams.get('dueAfter')
    const modifiedSince = searchParams.get('modifiedSince')

    if (!instanceUrl) {
      return NextResponse.json(
        { error: 'instanceUrl parameter is required' },
        { status: 400 }
      )
    }

    const instanceId = instanceUrl.replace(/\./g, '_')
    const adapter = getCoupaAdapter(instanceId)

    if (!adapter) {
      return NextResponse.json(
        {
          error: 'Not connected',
          message: 'Please connect to Coupa first via POST /api/erp/coupa/connect',
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

      // Calculate procurement-focused summary
      const summary = {
        totalAmount: invoices.reduce((sum, inv) => sum + inv.amount, 0),
        count: invoices.length,
        byVendor: invoices.reduce((acc, inv) => {
          if (!acc[inv.vendorName]) {
            acc[inv.vendorName] = { count: 0, amount: 0, vendorId: inv.vendorId }
          }
          acc[inv.vendorName].count++
          acc[inv.vendorName].amount += inv.amount
          return acc
        }, {} as Record<string, { count: number; amount: number; vendorId: string }>),
        byStatus: {
          open: invoices.filter(i => i.status === 'open').length,
          partial: invoices.filter(i => i.status === 'partial').length,
        },
        avgDaysToPayment: 0, // Would calculate from due dates
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

    if (pendingApproval) {
      filters.status = ['open']
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
      byPO: invoices.filter(i => i.poNumber).length,
      nonPO: invoices.filter(i => !i.poNumber).length,
    }

    return NextResponse.json({
      invoices,
      summary,
      total: invoices.length,
      limit,
    })
  } catch (error) {
    console.error('Coupa invoices GET error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch invoices',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
