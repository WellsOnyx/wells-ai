// @ts-nocheck
/**
 * Workday Suppliers (Vendors) API
 *
 * GET /api/erp/workday/vendors - List suppliers
 * GET /api/erp/workday/vendors?id=xxx - Get single supplier
 * POST /api/erp/workday/vendors - Create supplier
 * PUT /api/erp/workday/vendors - Update supplier
 *
 * Critical for contractor and payroll vendor management.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWorkdayAdapter } from '../connect/route'

/**
 * GET - List or get suppliers
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tenant = searchParams.get('tenant')
    const vendorId = searchParams.get('id')
    const limit = parseInt(searchParams.get('limit') || '100')
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

    // Get single supplier
    if (vendorId) {
      const vendor = await adapter.getVendor(vendorId)

      if (!vendor) {
        return NextResponse.json(
          { error: 'Supplier not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ vendor })
    }

    // List suppliers
    const filters: { modifiedSince?: Date; limit?: number } = { limit }

    if (modifiedSince) {
      filters.modifiedSince = new Date(modifiedSince)
    }

    const vendors = await adapter.getVendors(filters)

    return NextResponse.json({
      vendors,
      total: vendors.length,
      limit,
    })
  } catch (error) {
    console.error('Workday vendors GET error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch suppliers',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST - Create supplier
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tenant, ...vendorData } = body

    if (!tenant) {
      return NextResponse.json(
        { error: 'tenant is required in request body' },
        { status: 400 }
      )
    }

    if (!vendorData.name) {
      return NextResponse.json(
        { error: 'name is required' },
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

    const result = await adapter.createVendor(vendorData)

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to create supplier',
          message: result.error,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      vendor: result.data,
      externalId: result.externalId,
      message: `Supplier ${vendorData.name} created successfully`,
    })
  } catch (error) {
    console.error('Workday vendors POST error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create supplier',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT - Update supplier
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { tenant, vendorId, id, ...updates } = body

    if (!tenant) {
      return NextResponse.json(
        { error: 'tenant is required in request body' },
        { status: 400 }
      )
    }

    const targetId = vendorId || id
    if (!targetId) {
      return NextResponse.json(
        { error: 'vendorId or id is required' },
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

    const result = await adapter.updateVendor(targetId, updates)

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to update supplier',
          message: result.error,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      vendor: result.data,
      externalId: result.externalId,
      message: 'Supplier updated successfully',
    })
  } catch (error) {
    console.error('Workday vendors PUT error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update supplier',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
