/**
 * Product Sourcing Search API
 *
 * Search real-time catalogs from multiple marketplaces
 * Generates affiliate revenue on purchases
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  sourcingSearch,
  SourceRequest,
  trackAffiliateClick,
  type Marketplace,
} from '@/lib/sourcing/sourcing-engine'
import { createEtsyClient } from '@/lib/integrations/etsy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SearchRequestBody {
  query: string
  quantity?: number
  budget?: {
    min?: number
    max?: number
    currency?: string
  }
  requirements?: {
    customizable?: boolean
    minRating?: number
    shipsTo?: string
    leadTimeMax?: number
    eco_friendly?: boolean
    made_in?: string
  }
  preferredMarketplaces?: Marketplace[]
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: SearchRequestBody = await req.json()

    // Validate required fields
    if (!body.query) {
      return NextResponse.json(
        { error: 'Missing required field: query' },
        { status: 400 }
      )
    }

    // Build source request
    const request: SourceRequest = {
      query: body.query,
      quantity: body.quantity || 1,
      budget: body.budget
        ? {
            min: body.budget.min,
            max: body.budget.max,
            currency: body.budget.currency || 'USD',
          }
        : undefined,
      requirements: body.requirements,
      userId,
      preferredMarketplaces: body.preferredMarketplaces,
    }

    // Get Etsy client if configured
    let etsyClient
    try {
      // TODO: Get user's Etsy credentials from database
      // For now, use environment variables if available
      if (process.env.ETSY_USER_ID && process.env.ETSY_ACCESS_TOKEN) {
        etsyClient = createEtsyClient(
          process.env.ETSY_USER_ID,
          process.env.ETSY_ACCESS_TOKEN
        )
      }
    } catch (error) {
      console.warn('[Sourcing API] Etsy client not available:', error)
    }

    // Search across marketplaces
    const results = await sourcingSearch(request, {
      etsyClient,
    })

    // Track affiliate clicks for all results
    results.products.forEach(product => {
      if (product.affiliateUrl) {
        trackAffiliateClick(
          userId,
          product.id,
          product.marketplace,
          product.productUrl,
          product.affiliateUrl
        )
      }
    })

    return NextResponse.json({
      success: true,
      ...results,
      message: `Found ${results.totalResults} products across ${results.marketplacesSearched.length} marketplaces`,
    })
  } catch (error) {
    console.error('[Sourcing API] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to search products',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET - Get sourcing stats for user
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // TODO: Get user's sourcing history and commission stats from database
    // For now, return placeholder

    return NextResponse.json({
      success: true,
      stats: {
        totalSearches: 0,
        totalClicks: 0,
        totalPurchases: 0,
        totalCommission: 0,
        pendingCommission: 0,
        paidCommission: 0,
      },
    })
  } catch (error) {
    console.error('[Sourcing Stats] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to get stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
