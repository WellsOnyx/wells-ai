/**
 * Layer 1: Integration Providers API
 * POST /api/integrations/providers
 *
 * Manage external integration providers (Merge, Workato, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import type {
  IntegrationProviderConfig,
  CreateProviderRequest,
  PaginatedResponse,
} from '../types'

// ============================================================================
// In-memory store (replace with database in production)
// ============================================================================

const providersStore: Map<string, IntegrationProviderConfig> = new Map()

// Seed default providers
const defaultProviders: IntegrationProviderConfig[] = [
  {
    id: 'merge-accounting',
    name: 'Merge Accounting',
    provider: 'merge',
    apiBaseUrl: 'https://api.merge.dev/api/accounting/v1',
    authType: 'oauth2',
    supportedErps: ['quickbooks', 'xero', 'netsuite', 'sage', 'dynamics'],
    supportedObjects: ['purchase_order', 'invoice', 'vendor', 'ledger_entry'],
    webhooksEnabled: true,
    rateLimits: { requestsPerMinute: 100, requestsPerDay: 50000 },
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'workato-erp',
    name: 'Workato ERP Connector',
    provider: 'workato',
    apiBaseUrl: 'https://www.workato.com/api',
    authType: 'api_key',
    supportedErps: ['sap', 'oracle', 'netsuite', 'dynamics', 'workday', 'coupa'],
    supportedObjects: ['purchase_order', 'invoice', 'vendor', 'ledger_entry'],
    webhooksEnabled: true,
    rateLimits: { requestsPerMinute: 60, requestsPerDay: 25000 },
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'direct-sap',
    name: 'Direct SAP Integration',
    provider: 'direct',
    apiBaseUrl: '', // Customer-specific
    authType: 'oauth2',
    supportedErps: ['sap'],
    supportedObjects: ['purchase_order', 'invoice', 'vendor', 'ledger_entry'],
    webhooksEnabled: false,
    rateLimits: { requestsPerMinute: 30, requestsPerDay: 10000 },
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

// Initialize default providers
defaultProviders.forEach(p => providersStore.set(p.id, p))

// ============================================================================
// API HANDLERS
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const provider = searchParams.get('provider')
    const erpSystem = searchParams.get('erpSystem')
    const activeOnly = searchParams.get('activeOnly') !== 'false'

    let providers = Array.from(providersStore.values())

    // Filter by provider type
    if (provider) {
      providers = providers.filter(p => p.provider === provider)
    }

    // Filter by ERP system support
    if (erpSystem) {
      providers = providers.filter(p =>
        p.supportedErps.includes(erpSystem as never)
      )
    }

    // Filter active only
    if (activeOnly) {
      providers = providers.filter(p => p.isActive)
    }

    // Pagination
    const total = providers.length
    const totalPages = Math.ceil(total / limit)
    const startIndex = (page - 1) * limit
    const paginatedProviders = providers.slice(startIndex, startIndex + limit)

    const response: PaginatedResponse<IntegrationProviderConfig> = {
      data: paginatedProviders,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('GET providers error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch providers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateProviderRequest = await request.json()

    // Validate required fields
    if (!body.name || !body.provider || !body.apiBaseUrl || !body.authType) {
      return NextResponse.json(
        { error: 'Missing required fields: name, provider, apiBaseUrl, authType' },
        { status: 400 }
      )
    }

    // Validate provider type
    const validProviders = ['merge', 'workato', 'tray', 'celigo', 'boomi', 'direct']
    if (!validProviders.includes(body.provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      )
    }

    // Create new provider
    const newProvider: IntegrationProviderConfig = {
      id: crypto.randomUUID(),
      name: body.name,
      provider: body.provider,
      apiBaseUrl: body.apiBaseUrl,
      authType: body.authType,
      supportedErps: body.supportedErps || [],
      supportedObjects: body.supportedObjects || [],
      webhooksEnabled: body.webhooksEnabled || false,
      rateLimits: body.rateLimits || { requestsPerMinute: 60, requestsPerDay: 10000 },
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    providersStore.set(newProvider.id, newProvider)

    return NextResponse.json(newProvider, { status: 201 })
  } catch (error) {
    console.error('POST provider error:', error)
    return NextResponse.json(
      { error: 'Failed to create provider' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Provider ID is required' },
        { status: 400 }
      )
    }

    const existing = providersStore.get(id)
    if (!existing) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      )
    }

    const updated: IntegrationProviderConfig = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID change
      createdAt: existing.createdAt, // Preserve created date
      updatedAt: new Date().toISOString(),
    }

    providersStore.set(id, updated)

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT provider error:', error)
    return NextResponse.json(
      { error: 'Failed to update provider' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Provider ID is required' },
        { status: 400 }
      )
    }

    const existing = providersStore.get(id)
    if (!existing) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      )
    }

    // Soft delete - set inactive
    const updated = { ...existing, isActive: false, updatedAt: new Date().toISOString() }
    providersStore.set(id, updated)

    return NextResponse.json({ success: true, message: 'Provider deactivated' })
  } catch (error) {
    console.error('DELETE provider error:', error)
    return NextResponse.json(
      { error: 'Failed to delete provider' },
      { status: 500 }
    )
  }
}

// Export for use in Next.js App Router
export { GET as getProviders, POST as createProvider, PUT as updateProvider, DELETE as deleteProvider }
