// @ts-nocheck
/**
 * Infor CloudSuite Vendors API
 *
 * GET /api/erp/infor/vendors - List vendors
 * GET /api/erp/infor/vendors?id=xxx - Get single vendor
 * POST /api/erp/infor/vendors - Create vendor
 * PUT /api/erp/infor/vendors - Update vendor
 */

import { NextRequest, NextResponse } from 'next/server'
import { getInforAdapter } from '../connect/route'

/**
 * GET - List or get vendors
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

    const adapter = getInforAdapter(tenant)

    if (!adapter) {
      return NextResponse.json(
        {
          error: 'Not connected',
          message: 'Please connect to Infor first via POST /api/erp/infor/connect',
        },
        { status: 400 }
      )
    }

    // Get single vendor
    if (vendorId) {
      const vendor = await adapter.getVendor(vendorId)

      if (!vendor) {
        return NextResponse.json(
          { error: 'Vendor not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ vendor })
    }

    // List vendors
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
    console.error('Infor vendors GET error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch vendors',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST - Create vendor
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

    const adapter = getInforAdapter(tenant)

    if (!adapter) {
      return NextResponse.json(
        {
          error: 'Not connected',
          message: 'Please connect to Infor first via POST /api/erp/infor/connect',
        },
        { status: 400 }
      )
    }

    const result = await adapter.createVendor(vendorData)

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to create vendor',
          message: result.error,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      vendor: result.data,
      externalId: result.externalId,
      message: `Vendor ${vendorData.name} created successfully`,
    })
  } catch (error) {
    console.error('Infor vendors POST error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create vendor',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT - Update vendor
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

    const adapter = getInforAdapter(tenant)

    if (!adapter) {
      return NextResponse.json(
        {
          error: 'Not connected',
          message: 'Please connect to Infor first via POST /api/erp/infor/connect',
        },
        { status: 400 }
      )
    }

    const result = await adapter.updateVendor(targetId, updates)

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to update vendor',
          message: result.error,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      vendor: result.data,
      externalId: result.externalId,
      message: 'Vendor updated successfully',
    })
  } catch (error) {
    console.error('Infor vendors PUT error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update vendor',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
