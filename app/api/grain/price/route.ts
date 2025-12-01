/**
 * GET /api/grain/price
 *
 * Returns current GRAIN token price with historical changes
 * Cached for 1 minute to reduce RPC calls
 */

import { NextRequest, NextResponse } from 'next/server'
import { PriceOracle, GrainToken, fromGRAIN, fromUSDC } from '@/lib/blockchain/contracts'
import {
  getCachedPrice,
  cacheCurrentPrice,
  addPriceToHistory,
  calculatePriceChange,
  type CachedPrice,
} from '@/lib/blockchain/cache'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    // Check cache first
    const cached = await getCachedPrice()
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        },
      })
    }

    // Fetch from blockchain
    const [navRaw, totalAssetsRaw, totalSupplyRaw, tiers] = await Promise.all([
      PriceOracle.getCurrentNAV(),
      PriceOracle.getTotalAssets(),
      GrainToken.totalSupply(),
      PriceOracle.getAssetTiers(),
    ])

    // Convert from wei to readable numbers
    const nav = fromUSDC(navRaw) // NAV is stored with 6 decimals like USDC
    const totalAssets = fromUSDC(totalAssetsRaw)
    const supply = fromGRAIN(totalSupplyRaw)

    // Calculate historical changes
    const changes = await calculatePriceChange(nav)

    // Build response
    const priceData: CachedPrice = {
      nav: parseFloat(nav.toFixed(4)),
      change24h: parseFloat(changes.change24h.toFixed(4)),
      change7d: parseFloat(changes.change7d.toFixed(4)),
      change30d: parseFloat(changes.change30d.toFixed(4)),
      timestamp: new Date().toISOString(),
      supply: Math.floor(supply),
      totalAssets: Math.floor(totalAssets),
      tiers: {
        liquid: Math.floor(fromUSDC(tiers.liquid)),
        float: Math.floor(fromUSDC(tiers.float)),
        physical: Math.floor(fromUSDC(tiers.physical)),
        investments: Math.floor(fromUSDC(tiers.investments)),
        receivables: Math.floor(fromUSDC(tiers.receivables)),
      },
    }

    // Cache for future requests
    await cacheCurrentPrice(priceData)

    // Add to historical data
    await addPriceToHistory({
      timestamp: priceData.timestamp,
      nav: priceData.nav,
      totalAssets: priceData.totalAssets,
      supply: priceData.supply,
    })

    return NextResponse.json(priceData, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    })
  } catch (error) {
    console.error('[API] Error fetching GRAIN price:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch GRAIN price',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/grain/price/history
 * Returns historical price data
 */
export async function getHistory(period: 'hour' | 'day' | 'week' = 'day') {
  const { getPriceHistory } = await import('@/lib/blockchain/cache')

  try {
    const limit = period === 'hour' ? 168 : period === 'day' ? 30 : 52 // 7 days, 30 days, 52 weeks
    const history = await getPriceHistory(period, limit)

    return NextResponse.json({
      period,
      data: history,
      count: history.length,
    })
  } catch (error) {
    console.error('[API] Error fetching price history:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch price history',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
