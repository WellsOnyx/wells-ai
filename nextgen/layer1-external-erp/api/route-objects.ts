// @ts-nocheck
/**
 * Layer 1: ERP Objects Query API
 * GET /api/integrations/objects
 *
 * Query normalized ERP objects (POs, Invoices, Vendors, Ledger Entries)
 */

import { NextRequest, NextResponse } from 'next/server'
import type {
  ObjectsQueryParams,
  PaginatedResponse,
  ErpPurchaseOrder,
  ErpInvoice,
  ErpVendor,
  ErpLedgerEntry,
} from '../types'

// ============================================================================
// In-memory store (shared with sync service in production via database)
// ============================================================================

// Mock data for demonstration
const mockObjects: Map<string, Record<string, unknown>> = new Map()

// Initialize with sample data
initializeMockData()

// ============================================================================
// API HANDLERS
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = request.headers.get('x-account-id') || 'demo-account'

    // Parse query parameters
    const params: ObjectsQueryParams = {
      type: searchParams.get('type') as ObjectsQueryParams['type'],
      connectionId: searchParams.get('connectionId') || undefined,
      status: searchParams.get('status') || undefined,
      vendorId: searchParams.get('vendorId') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      minAmount: searchParams.get('minAmount') ? parseFloat(searchParams.get('minAmount')!) : undefined,
      maxAmount: searchParams.get('maxAmount') ? parseFloat(searchParams.get('maxAmount')!) : undefined,
      search: searchParams.get('search') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100),
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
    }

    // Validate object type
    if (!params.type) {
      return NextResponse.json(
        { error: 'type parameter is required (purchase_order, invoice, vendor, ledger_entry)' },
        { status: 400 }
      )
    }

    const validTypes = ['purchase_order', 'invoice', 'vendor', 'ledger_entry']
    if (!validTypes.includes(params.type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Get all objects of the requested type
    let objects = Array.from(mockObjects.values())
      .filter(o => o.objectType === params.type)

    // Apply filters
    if (params.connectionId) {
      objects = objects.filter(o => o.connectionId === params.connectionId)
    }

    if (params.status) {
      objects = objects.filter(o => o.status === params.status)
    }

    if (params.vendorId) {
      objects = objects.filter(o => o.vendorId === params.vendorId)
    }

    if (params.dateFrom) {
      const fromDate = new Date(params.dateFrom)
      objects = objects.filter(o => {
        const objDate = getObjectDate(o)
        return objDate >= fromDate
      })
    }

    if (params.dateTo) {
      const toDate = new Date(params.dateTo)
      objects = objects.filter(o => {
        const objDate = getObjectDate(o)
        return objDate <= toDate
      })
    }

    if (params.minAmount !== undefined) {
      objects = objects.filter(o => {
        const amount = Number(o.totalAmount || o.amount || 0)
        return amount >= params.minAmount!
      })
    }

    if (params.maxAmount !== undefined) {
      objects = objects.filter(o => {
        const amount = Number(o.totalAmount || o.amount || 0)
        return amount <= params.maxAmount!
      })
    }

    if (params.search) {
      const searchLower = params.search.toLowerCase()
      objects = objects.filter(o => {
        const searchableFields = [
          o.poNumber,
          o.invoiceNumber,
          o.name,
          o.vendorName,
          o.description,
          o.reference,
        ]
        return searchableFields.some(field =>
          field && String(field).toLowerCase().includes(searchLower)
        )
      })
    }

    // Sort
    objects.sort((a, b) => {
      const aRecord = a as Record<string, unknown>
      const bRecord = b as Record<string, unknown>
      const aVal = String(aRecord[params.sortBy!] || a.createdAt)
      const bVal = String(bRecord[params.sortBy!] || b.createdAt)

      let comparison = 0
      if (aVal < bVal) comparison = -1
      if (aVal > bVal) comparison = 1

      return params.sortOrder === 'desc' ? -comparison : comparison
    })

    // Pagination
    const total = objects.length
    const totalPages = Math.ceil(total / params.limit!)
    const startIndex = (params.page! - 1) * params.limit!
    const paginatedObjects = objects.slice(startIndex, startIndex + params.limit!)

    // Build response based on type
    const response: PaginatedResponse<ErpPurchaseOrder | ErpInvoice | ErpVendor | ErpLedgerEntry> = {
      data: paginatedObjects as unknown as (ErpPurchaseOrder | ErpInvoice | ErpVendor | ErpLedgerEntry)[],
      pagination: {
        page: params.page!,
        limit: params.limit!,
        total,
        totalPages,
        hasMore: params.page! < totalPages,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('GET objects error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch objects' },
      { status: 500 }
    )
  }
}

// Get single object by ID
export async function getObjectById(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const type = searchParams.get('type')

    if (!id || !type) {
      return NextResponse.json(
        { error: 'id and type parameters are required' },
        { status: 400 }
      )
    }

    const obj = mockObjects.get(`${type}-${id}`)
    if (!obj) {
      return NextResponse.json(
        { error: 'Object not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(obj)
  } catch (error) {
    console.error('GET object by ID error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch object' },
      { status: 500 }
    )
  }
}

// Get aggregated statistics
export async function getObjectStats(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')

    let objects = Array.from(mockObjects.values())

    if (connectionId) {
      objects = objects.filter(o => o.connectionId === connectionId)
    }

    const stats = {
      purchase_orders: {
        total: 0,
        by_status: {} as Record<string, number>,
        total_amount: 0,
      },
      invoices: {
        total: 0,
        by_status: {} as Record<string, number>,
        total_amount: 0,
        total_outstanding: 0,
      },
      vendors: {
        total: 0,
        by_status: {} as Record<string, number>,
      },
      ledger_entries: {
        total: 0,
        total_debits: 0,
        total_credits: 0,
      },
    }

    for (const obj of objects) {
      switch (obj.objectType) {
        case 'purchase_order':
          stats.purchase_orders.total++
          stats.purchase_orders.by_status[obj.status as string] =
            (stats.purchase_orders.by_status[obj.status as string] || 0) + 1
          stats.purchase_orders.total_amount += Number(obj.totalAmount || 0)
          break

        case 'invoice':
          stats.invoices.total++
          stats.invoices.by_status[obj.status as string] =
            (stats.invoices.by_status[obj.status as string] || 0) + 1
          stats.invoices.total_amount += Number(obj.totalAmount || 0)
          stats.invoices.total_outstanding += Number(obj.amountDue || 0)
          break

        case 'vendor':
          stats.vendors.total++
          stats.vendors.by_status[obj.status as string] =
            (stats.vendors.by_status[obj.status as string] || 0) + 1
          break

        case 'ledger_entry':
          stats.ledger_entries.total++
          stats.ledger_entries.total_debits += Number(obj.debit || 0)
          stats.ledger_entries.total_credits += Number(obj.credit || 0)
          break
      }
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('GET stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getObjectDate(obj: Record<string, unknown>): Date {
  const dateField = obj.createdAt || obj.invoiceDate || obj.entryDate || obj.date
  return dateField ? new Date(String(dateField)) : new Date(0)
}

function initializeMockData() {
  // Sample Purchase Orders
  const purchaseOrders: Partial<ErpPurchaseOrder>[] = [
    {
      id: 'po-001',
      sourceSystem: 'quickbooks',
      externalId: 'QBO-PO-001',
      poNumber: 'PO-2024-001',
      vendorId: 'vendor-001',
      vendorName: 'Acme Industrial Supplies',
      status: 'approved',
      totalAmount: 15750.00,
      currency: 'USD',
      lineItems: [
        { lineNumber: 1, description: 'Industrial Bearings', quantity: 500, unitPrice: 15.50, lineTotal: 7750.00 },
        { lineNumber: 2, description: 'Lubricant Drums', quantity: 20, unitPrice: 400.00, lineTotal: 8000.00 },
      ],
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T14:00:00Z',
    },
    {
      id: 'po-002',
      sourceSystem: 'netsuite',
      externalId: 'NS-PO-4521',
      poNumber: 'PO-2024-002',
      vendorId: 'vendor-002',
      vendorName: 'Tech Solutions Inc',
      status: 'pending_approval',
      totalAmount: 45000.00,
      currency: 'USD',
      lineItems: [
        { lineNumber: 1, description: 'Enterprise Software License', quantity: 1, unitPrice: 45000.00, lineTotal: 45000.00 },
      ],
      createdAt: '2024-01-18T09:15:00Z',
      updatedAt: '2024-01-18T09:15:00Z',
    },
    {
      id: 'po-003',
      sourceSystem: 'sap',
      externalId: '4500001234',
      poNumber: 'PO-2024-003',
      vendorId: 'vendor-003',
      vendorName: 'Global Freight Co',
      status: 'sent',
      totalAmount: 8500.00,
      currency: 'USD',
      createdAt: '2024-01-20T11:45:00Z',
      updatedAt: '2024-01-20T11:45:00Z',
    },
  ]

  // Sample Invoices
  const invoices: Partial<ErpInvoice>[] = [
    {
      id: 'inv-001',
      sourceSystem: 'quickbooks',
      externalId: 'QBO-INV-001',
      invoiceNumber: 'INV-2024-0001',
      vendorId: 'vendor-001',
      vendorName: 'Acme Industrial Supplies',
      purchaseOrderNumber: 'PO-2024-001',
      status: 'approved',
      invoiceDate: '2024-01-22',
      dueDate: '2024-02-21',
      totalAmount: 15750.00,
      amountPaid: 0,
      amountDue: 15750.00,
      currency: 'USD',
      createdAt: '2024-01-22T08:00:00Z',
      updatedAt: '2024-01-22T08:00:00Z',
    },
    {
      id: 'inv-002',
      sourceSystem: 'xero',
      externalId: 'XRO-INV-5678',
      invoiceNumber: 'INV-2024-0002',
      vendorId: 'vendor-004',
      vendorName: 'Office Essentials LLC',
      status: 'paid',
      invoiceDate: '2024-01-10',
      dueDate: '2024-02-09',
      totalAmount: 2340.00,
      amountPaid: 2340.00,
      amountDue: 0,
      currency: 'USD',
      paidDate: '2024-01-25T12:30:00Z',
      createdAt: '2024-01-10T14:20:00Z',
      updatedAt: '2024-01-25T12:30:00Z',
    },
    {
      id: 'inv-003',
      sourceSystem: 'netsuite',
      externalId: 'NS-INV-9012',
      invoiceNumber: 'INV-2024-0003',
      vendorId: 'vendor-002',
      vendorName: 'Tech Solutions Inc',
      status: 'overdue',
      invoiceDate: '2023-12-15',
      dueDate: '2024-01-14',
      totalAmount: 12500.00,
      amountPaid: 5000.00,
      amountDue: 7500.00,
      currency: 'USD',
      createdAt: '2023-12-15T09:00:00Z',
      updatedAt: '2024-01-02T10:00:00Z',
    },
  ]

  // Sample Vendors
  const vendors: Partial<ErpVendor>[] = [
    {
      id: 'vendor-001',
      sourceSystem: 'quickbooks',
      externalId: 'QBO-V-001',
      vendorCode: 'ACME',
      name: 'Acme Industrial Supplies',
      status: 'active',
      vendorType: 'supplier',
      defaultPaymentTerms: 'Net30',
      defaultCurrency: 'USD',
      categories: ['Industrial', 'Manufacturing'],
      paymentRating: 95,
      createdAt: '2023-06-01T00:00:00Z',
      updatedAt: '2024-01-20T00:00:00Z',
    },
    {
      id: 'vendor-002',
      sourceSystem: 'netsuite',
      externalId: 'NS-V-002',
      vendorCode: 'TECH',
      name: 'Tech Solutions Inc',
      status: 'active',
      vendorType: 'service_provider',
      defaultPaymentTerms: 'Net45',
      defaultCurrency: 'USD',
      categories: ['Software', 'IT Services'],
      paymentRating: 88,
      createdAt: '2023-03-15T00:00:00Z',
      updatedAt: '2024-01-18T00:00:00Z',
    },
    {
      id: 'vendor-003',
      sourceSystem: 'sap',
      externalId: 'SAP-V-1000',
      vendorCode: 'GFREIGHT',
      name: 'Global Freight Co',
      status: 'active',
      vendorType: 'service_provider',
      defaultPaymentTerms: 'Net15',
      defaultCurrency: 'USD',
      categories: ['Logistics', 'Shipping'],
      paymentRating: 92,
      createdAt: '2022-11-01T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
    },
    {
      id: 'vendor-004',
      sourceSystem: 'xero',
      externalId: 'XRO-V-100',
      vendorCode: 'OFFICE',
      name: 'Office Essentials LLC',
      status: 'active',
      vendorType: 'supplier',
      defaultPaymentTerms: 'Net30',
      defaultCurrency: 'USD',
      categories: ['Office Supplies'],
      paymentRating: 98,
      createdAt: '2023-01-10T00:00:00Z',
      updatedAt: '2024-01-05T00:00:00Z',
    },
  ]

  // Sample Ledger Entries
  const ledgerEntries: Partial<ErpLedgerEntry>[] = [
    {
      id: 'je-001-1',
      sourceSystem: 'quickbooks',
      externalId: 'QBO-JE-001-1',
      journalId: 'JE-001',
      journalNumber: 'JE-2024-001',
      entryDate: '2024-01-22',
      accountCode: '2000',
      accountName: 'Accounts Payable',
      accountType: 'liability',
      debit: 0,
      credit: 15750.00,
      amount: -15750.00,
      currency: 'USD',
      description: 'Invoice INV-2024-0001 from Acme Industrial Supplies',
      reference: 'INV-2024-0001',
      referenceType: 'invoice',
      createdAt: '2024-01-22T08:00:00Z',
      updatedAt: '2024-01-22T08:00:00Z',
    },
    {
      id: 'je-001-2',
      sourceSystem: 'quickbooks',
      externalId: 'QBO-JE-001-2',
      journalId: 'JE-001',
      journalNumber: 'JE-2024-001',
      entryDate: '2024-01-22',
      accountCode: '1400',
      accountName: 'Inventory',
      accountType: 'asset',
      debit: 15750.00,
      credit: 0,
      amount: 15750.00,
      currency: 'USD',
      description: 'Invoice INV-2024-0001 from Acme Industrial Supplies',
      reference: 'INV-2024-0001',
      referenceType: 'invoice',
      createdAt: '2024-01-22T08:00:00Z',
      updatedAt: '2024-01-22T08:00:00Z',
    },
    {
      id: 'je-002-1',
      sourceSystem: 'xero',
      externalId: 'XRO-JE-002-1',
      journalId: 'JE-002',
      journalNumber: 'JE-2024-002',
      entryDate: '2024-01-25',
      accountCode: '2000',
      accountName: 'Accounts Payable',
      accountType: 'liability',
      debit: 2340.00,
      credit: 0,
      amount: 2340.00,
      currency: 'USD',
      description: 'Payment to Office Essentials LLC',
      reference: 'PAY-2024-001',
      referenceType: 'payment',
      createdAt: '2024-01-25T12:30:00Z',
      updatedAt: '2024-01-25T12:30:00Z',
    },
    {
      id: 'je-002-2',
      sourceSystem: 'xero',
      externalId: 'XRO-JE-002-2',
      journalId: 'JE-002',
      journalNumber: 'JE-2024-002',
      entryDate: '2024-01-25',
      accountCode: '1000',
      accountName: 'Cash',
      accountType: 'asset',
      debit: 0,
      credit: 2340.00,
      amount: -2340.00,
      currency: 'USD',
      description: 'Payment to Office Essentials LLC',
      reference: 'PAY-2024-001',
      referenceType: 'payment',
      createdAt: '2024-01-25T12:30:00Z',
      updatedAt: '2024-01-25T12:30:00Z',
    },
  ]

  // Store all objects
  purchaseOrders.forEach(po => {
    mockObjects.set(`purchase_order-${po.id}`, { ...po, objectType: 'purchase_order' })
  })

  invoices.forEach(inv => {
    mockObjects.set(`invoice-${inv.id}`, { ...inv, objectType: 'invoice' })
  })

  vendors.forEach(v => {
    mockObjects.set(`vendor-${v.id}`, { ...v, objectType: 'vendor' })
  })

  ledgerEntries.forEach(le => {
    mockObjects.set(`ledger_entry-${le.id}`, { ...le, objectType: 'ledger_entry' })
  })
}

// Export for Next.js App Router
export { GET as getObjects }
