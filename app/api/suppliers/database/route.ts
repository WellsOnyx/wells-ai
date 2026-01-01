/**
 * Supplier Database API
 *
 * CRUD operations for supplier database with industry codes
 * Supports: search, filter, bulk import, invite tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  searchSuppliers,
  addSupplier,
  bulkImportSuppliers,
  getSupplierStats,
  getNAICSSectors,
  searchNAICS,
  searchSIC
} from '@/lib/supplier-database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // Get industry codes
    if (action === 'naics-sectors') {
      const sectors = await getNAICSSectors()
      return NextResponse.json({ sectors })
    }

    if (action === 'search-naics') {
      const query = searchParams.get('q') || ''
      const codes = await searchNAICS(query)
      return NextResponse.json({ codes })
    }

    if (action === 'search-sic') {
      const query = searchParams.get('q') || ''
      const codes = await searchSIC(query)
      return NextResponse.json({ codes })
    }

    // Get statistics
    if (action === 'stats') {
      const stats = await getSupplierStats()
      return NextResponse.json({ stats })
    }

    // Search suppliers (default)
    const filters = {
      query: searchParams.get('q') || undefined,
      naicsCodes: searchParams.get('naics')?.split(',').filter(Boolean) || undefined,
      sicCodes: searchParams.get('sic')?.split(',').filter(Boolean) || undefined,
      states: searchParams.get('states')?.split(',').filter(Boolean) || undefined,
      status: searchParams.get('status') || undefined,
      inviteStatus: searchParams.get('invite_status') || undefined,
      diversities: searchParams.get('diversities')?.split(',').filter(Boolean) || undefined,
      employeeRanges: searchParams.get('employees')?.split(',').filter(Boolean) || undefined,
      revenueRanges: searchParams.get('revenue')?.split(',').filter(Boolean) || undefined,
      limit: parseInt(searchParams.get('limit') || '50', 10),
      offset: parseInt(searchParams.get('offset') || '0', 10)
    }

    const result = await searchSuppliers(filters)

    return NextResponse.json({
      suppliers: result.suppliers,
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
      hasMore: result.total > (filters.offset || 0) + result.suppliers.length
    })
  } catch (error: any) {
    console.error('Supplier database GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch suppliers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    // Bulk import
    if (action === 'bulk_import') {
      const { suppliers, source } = body

      if (!Array.isArray(suppliers) || suppliers.length === 0) {
        return NextResponse.json(
          { error: 'suppliers array is required' },
          { status: 400 }
        )
      }

      const result = await bulkImportSuppliers(suppliers, source || 'api_import')

      return NextResponse.json({
        message: `Imported ${result.imported} suppliers`,
        imported: result.imported,
        failed: result.failed,
        errors: result.errors.slice(0, 10) // First 10 errors
      })
    }

    // Add single supplier
    const {
      companyName,
      contactEmail,
      phone,
      website,
      primaryNaicsCode,
      secondaryNaicsCodes,
      sicCodes,
      headquartersCity,
      headquartersState,
      headquartersCountry,
      serviceRegions,
      employeeCountRange,
      annualRevenueRange,
      foundedYear,
      isSmallBusiness,
      isMinorityOwned,
      isWomanOwned,
      isVeteranOwned,
      products,
      certifications,
      source,
      sourceUrl
    } = body

    if (!companyName) {
      return NextResponse.json(
        { error: 'companyName is required' },
        { status: 400 }
      )
    }

    if (!contactEmail) {
      return NextResponse.json(
        { error: 'contactEmail is required' },
        { status: 400 }
      )
    }

    const supplier = await addSupplier({
      companyName,
      contactEmail,
      phone,
      website,
      primaryNaicsCode,
      secondaryNaicsCodes,
      sicCodes,
      headquartersCity,
      headquartersState,
      headquartersCountry,
      serviceRegions,
      employeeCountRange,
      annualRevenueRange,
      foundedYear,
      isSmallBusiness,
      isMinorityOwned,
      isWomanOwned,
      isVeteranOwned,
      products: products || [],
      certifications,
      source,
      sourceUrl
    })

    if (!supplier) {
      return NextResponse.json(
        { error: 'Failed to add supplier' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Supplier added successfully',
      supplier
    })
  } catch (error: any) {
    console.error('Supplier database POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add supplier' },
      { status: 500 }
    )
  }
}
