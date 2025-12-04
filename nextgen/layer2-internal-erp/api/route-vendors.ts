/**
 * Layer 2: G&V Internal ERP - Vendors API
 * POST /api/gv/erp/vendors
 * GET /api/gv/erp/vendors
 */

import { NextRequest, NextResponse } from 'next/server'
import type {
  GvVendor,
  CreateVendorRequest,
  PaginatedResponse,
} from '../types'

// In-memory store (replace with database)
const vendorsStore: Map<string, GvVendor> = new Map()

// Initialize with sample data
initializeSampleVendors()

export async function POST(request: NextRequest) {
  try {
    const body: CreateVendorRequest = await request.json()

    if (!body.companyName) {
      return NextResponse.json(
        { error: 'companyName is required' },
        { status: 400 }
      )
    }

    // Generate vendor code if not provided
    const vendorCode = body.vendorCode ||
      `V-${body.companyName.substring(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`

    const vendor: GvVendor = {
      id: crypto.randomUUID(),
      vendorCode,
      companyName: body.companyName,
      legalName: body.legalName,
      status: 'pending_verification',
      taxId: body.taxId,
      taxIdType: body.taxIdType,
      taxIdVerified: false,
      w9OnFile: false,
      w8OnFile: false,
      primaryContactName: body.primaryContactName,
      primaryContactEmail: body.primaryContactEmail,
      primaryContactPhone: body.primaryContactPhone,
      billingStreet1: body.billingStreet1,
      billingCity: body.billingCity,
      billingState: body.billingState,
      billingPostalCode: body.billingPostalCode,
      billingCountry: body.billingCountry || 'US',
      paymentPreference: body.paymentPreference || 'ach',
      paymentTerms: body.paymentTerms || 'Net30',
      defaultCurrency: 'USD',
      grainWalletAddress: body.grainWalletAddress,
      grainWalletVerified: false,
      categories: body.categories || [],
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    vendorsStore.set(vendor.id, vendor)

    return NextResponse.json(vendor, { status: 201 })
  } catch (error) {
    console.error('POST vendor error:', error)
    return NextResponse.json(
      { error: 'Failed to create vendor' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const paymentPreference = searchParams.get('paymentPreference')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    // Single vendor by ID
    if (id) {
      const vendor = vendorsStore.get(id)
      if (!vendor) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
      }
      return NextResponse.json(vendor)
    }

    // List vendors with filters
    let vendors = Array.from(vendorsStore.values())

    if (status) {
      vendors = vendors.filter(v => v.status === status)
    }

    if (paymentPreference) {
      vendors = vendors.filter(v => v.paymentPreference === paymentPreference)
    }

    if (search) {
      const searchLower = search.toLowerCase()
      vendors = vendors.filter(v =>
        v.companyName.toLowerCase().includes(searchLower) ||
        v.vendorCode.toLowerCase().includes(searchLower) ||
        v.primaryContactEmail?.toLowerCase().includes(searchLower)
      )
    }

    // Sort by company name
    vendors.sort((a, b) => a.companyName.localeCompare(b.companyName))

    // Pagination
    const total = vendors.length
    const totalPages = Math.ceil(total / limit)
    const startIndex = (page - 1) * limit
    const paginatedVendors = vendors.slice(startIndex, startIndex + limit)

    const response: PaginatedResponse<GvVendor> = {
      data: paginatedVendors,
      pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('GET vendors error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vendors' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Vendor ID required' }, { status: 400 })
    }

    const existing = vendorsStore.get(id)
    if (!existing) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    const updated: GvVendor = {
      ...existing,
      ...updates,
      id: existing.id,
      vendorCode: existing.vendorCode,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    }

    vendorsStore.set(id, updated)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT vendor error:', error)
    return NextResponse.json({ error: 'Failed to update vendor' }, { status: 500 })
  }
}

function initializeSampleVendors() {
  const samples: Partial<GvVendor>[] = [
    {
      id: 'vendor-001',
      vendorCode: 'V-ACME-001',
      companyName: 'Acme Industrial Supplies',
      legalName: 'Acme Industrial Supplies Inc.',
      status: 'active',
      taxId: '12-3456789',
      taxIdType: 'ein',
      taxIdVerified: true,
      w9OnFile: true,
      primaryContactName: 'John Smith',
      primaryContactEmail: 'ap@acme-industrial.com',
      primaryContactPhone: '+1-555-0100',
      billingStreet1: '123 Industrial Way',
      billingCity: 'Chicago',
      billingState: 'IL',
      billingPostalCode: '60601',
      billingCountry: 'US',
      paymentPreference: 'grain',
      paymentTerms: 'Net30',
      defaultCurrency: 'USD',
      grainWalletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      grainWalletVerified: true,
      categories: ['Industrial', 'Manufacturing'],
      tags: ['preferred', 'fast-shipping'],
      creditLimit: 100000,
      creditUsed: 25000,
      paymentRating: 95,
    },
    {
      id: 'vendor-002',
      vendorCode: 'V-TECH-001',
      companyName: 'TechSolutions Inc',
      status: 'active',
      primaryContactEmail: 'billing@techsolutions.io',
      paymentPreference: 'ach',
      paymentTerms: 'Net45',
      defaultCurrency: 'USD',
      categories: ['Software', 'IT Services'],
      paymentRating: 88,
    },
    {
      id: 'vendor-003',
      vendorCode: 'V-GLOBAL-001',
      companyName: 'Global Freight Co',
      status: 'active',
      paymentPreference: 'wire',
      paymentTerms: 'Net15',
      defaultCurrency: 'USD',
      categories: ['Logistics', 'Shipping'],
      paymentRating: 92,
    },
  ]

  samples.forEach(v => {
    vendorsStore.set(v.id!, {
      ...v,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as GvVendor)
  })
}

export { GET as getVendors, POST as createVendor, PUT as updateVendor }
