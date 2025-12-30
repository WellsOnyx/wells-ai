// @ts-nocheck
/**
 * Coupa Suppliers (Vendors) API
 *
 * GET /api/erp/coupa/vendors - List suppliers
 * GET /api/erp/coupa/vendors?id=xxx - Get single supplier
 * POST /api/erp/coupa/vendors - Create supplier
 * PUT /api/erp/coupa/vendors - Update supplier
 *
 * Coupa is procurement-focused - supplier management is a core strength.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCoupaAdapter } from '../connect/route'

/**
 * GET - List or get suppliers
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const instanceUrl = searchParams.get('instanceUrl')
    const vendorId = searchParams.get('id') || searchParams.get('supplierId')
    const limit = parseInt(searchParams.get('limit') || '100')
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
    console.error('Coupa vendors GET error:', error)
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
    const { instanceUrl, ...vendorData } = body

    if (!instanceUrl) {
      return NextResponse.json(
        { error: 'instanceUrl is required in request body' },
        { status: 400 }
      )
    }

    if (!vendorData.name) {
      return NextResponse.json(
        { error: 'name is required' },
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
      message: `Supplier ${vendorData.name} created successfully in Coupa`,
    })
  } catch (error) {
    console.error('Coupa vendors POST error:', error)
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
    const { instanceUrl, vendorId, supplierId, id, ...updates } = body

    if (!instanceUrl) {
      return NextResponse.json(
        { error: 'instanceUrl is required in request body' },
        { status: 400 }
      )
    }

    const targetId = vendorId || supplierId || id
    if (!targetId) {
      return NextResponse.json(
        { error: 'vendorId, supplierId, or id is required' },
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
      message: 'Supplier updated successfully in Coupa',
    })
  } catch (error) {
    console.error('Coupa vendors PUT error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update supplier',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
