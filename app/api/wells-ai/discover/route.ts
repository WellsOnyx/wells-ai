/**
 * Supplier Discovery API
 *
 * POST /api/wells-ai/discover
 * Triggers proactive supplier discovery for a buyer request
 *
 * POST /api/wells-ai/discover/search
 * Manual search for suppliers (for testing/admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { runSupplierDiscovery, BuyerRequest } from '@/lib/wells-ai/scraping'
import { scrapeSuppliers, SearchQuery } from '@/lib/wells-ai/scraping'
import { enrichSuppliers } from '@/lib/wells-ai/scraping'

// ============================================================================
// TRIGGER DISCOVERY FOR BUYER REQUEST
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    if (action === 'search') {
      // Manual search
      return handleManualSearch(data)
    }

    // Default: trigger discovery for buyer request
    return handleDiscovery(data)
  } catch (error) {
    console.error('Discovery API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Discovery failed' },
      { status: 500 }
    )
  }
}

async function handleDiscovery(data: {
  requestId: string
  userId: string
  category: string
  subcategory?: string
  requirements: string
  quantity?: number
  budget?: number
  timeline?: string
  location?: {
    city?: string
    state?: string
    country?: string
    radius?: number
  }
  companyName?: string
}) {
  const buyerRequest: BuyerRequest = {
    id: data.requestId,
    userId: data.userId,
    category: data.category,
    subcategory: data.subcategory,
    requirements: data.requirements,
    quantity: data.quantity,
    budget: data.budget,
    timeline: data.timeline,
    location: data.location,
    companyName: data.companyName,
    createdAt: new Date(),
  }

  // Run discovery in background (don't wait for completion)
  runSupplierDiscovery(buyerRequest)
    .then(result => {
      console.log(`Discovery complete for ${buyerRequest.id}: ${result.job.suppliersFound} found, ${result.job.suppliersContacted} contacted`)
    })
    .catch(error => {
      console.error(`Discovery failed for ${buyerRequest.id}:`, error)
    })

  return NextResponse.json({
    success: true,
    message: 'Discovery started',
    requestId: buyerRequest.id,
  })
}

async function handleManualSearch(data: {
  keywords: string[]
  category?: string
  location?: {
    city?: string
    state?: string
    country?: string
  }
  sources?: string[]
  enrich?: boolean
}) {
  const query: SearchQuery = {
    keywords: data.keywords,
    location: data.location,
  }

  // Scrape suppliers
  const suppliers = await scrapeSuppliers(query, data.sources as never[] || ['google_maps'])

  // Optionally enrich
  let enrichedSuppliers = suppliers
  if (data.enrich) {
    enrichedSuppliers = await enrichSuppliers(suppliers)
  }

  return NextResponse.json({
    success: true,
    count: enrichedSuppliers.length,
    suppliers: enrichedSuppliers.slice(0, 50),  // Limit response size
  })
}

// ============================================================================
// GET DISCOVERY STATUS
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const requestId = searchParams.get('requestId')

  if (!requestId) {
    return NextResponse.json(
      { error: 'requestId required' },
      { status: 400 }
    )
  }

  // TODO: Look up job status from database
  // For now, return a placeholder
  return NextResponse.json({
    requestId,
    status: 'running',
    message: 'Discovery in progress',
  })
}
