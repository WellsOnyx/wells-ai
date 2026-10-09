// @ts-nocheck
/**
 * GRAIN Price Oracle API
 *
 * GET /api/grain/price - Get current GRAIN price and treasury stats
 *
 * GRAIN price is determined by:
 * Price = (USDC Backing + Asset Value) / Total GRAIN Supply
 *
 * With a $1.00 floor - GRAIN can never be worth less than $1.
 */

import { NextRequest, NextResponse } from 'next/server'
import { grainRail } from '@/lib/payments/grain-rail'
import { neon } from '@neondatabase/serverless'

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

export const runtime = 'nodejs'
export const revalidate = 60 // Cache for 60 seconds

/**
 * GET - Get GRAIN price and treasury metrics
 */
export async function GET(request: NextRequest) {
  try {
    // Get core price data
    const priceData = await grainRail.getPrice()

    // Get additional treasury metrics
    let treasuryBreakdown: any[] = []
    let circulationStats: any = null
    let priceHistory: any[] = []

    if (sql) {
      // Get asset breakdown
      const assets = await sql`
        SELECT
          asset_type,
          symbol,
          SUM(quantity) as quantity,
          SUM(current_value) as value,
          COUNT(*) as positions
        FROM grain_asset_holdings
        WHERE is_active = true
        GROUP BY asset_type, symbol
        ORDER BY value DESC
      `

      treasuryBreakdown = assets.map((a: any) => ({
        type: a.asset_type,
        symbol: a.symbol,
        quantity: parseFloat(a.quantity),
        value: parseFloat(a.value),
        positions: parseInt(a.positions),
        percentOfTreasury: priceData.usdcBacking + priceData.assetValue > 0
          ? (parseFloat(a.value) / (priceData.usdcBacking + priceData.assetValue)) * 100
          : 0,
      }))

      // Get circulation stats
      const [circulation] = await sql`
        SELECT
          COUNT(DISTINCT user_id) as holders,
          SUM(balance) as in_wallets,
          (SELECT COALESCE(SUM(grain_amount - released_amount), 0) FROM grain_escrows WHERE status IN ('locked', 'partial')) as in_escrow,
          (SELECT COALESCE(SUM(current_balance), 0) FROM grain_credit_lines WHERE status = 'active') as credit_outstanding
        FROM user_wallets
        WHERE balance > 0
      `

      circulationStats = {
        holders: parseInt(circulation?.holders || '0'),
        inWallets: parseFloat(circulation?.in_wallets || '0'),
        inEscrow: parseFloat(circulation?.in_escrow || '0'),
        creditOutstanding: parseFloat(circulation?.credit_outstanding || '0'),
      }

      // Get recent price history (from transactions)
      const history = await sql`
        SELECT
          DATE_TRUNC('hour', created_at) as hour,
          AVG(grain_price_at_execution) as avg_price,
          SUM(amount) as volume
        FROM unified_transactions
        WHERE grain_price_at_execution IS NOT NULL
          AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY DATE_TRUNC('hour', created_at)
        ORDER BY hour DESC
        LIMIT 24
      `

      priceHistory = history.map((h: any) => ({
        hour: h.hour,
        price: parseFloat(h.avg_price),
        volume: parseFloat(h.volume),
      }))
    }

    // Calculate 24h change if we have history
    let priceChange24h = 0
    if (priceHistory.length >= 2) {
      const oldestPrice = priceHistory[priceHistory.length - 1].price
      priceChange24h = oldestPrice > 0
        ? ((priceData.price - oldestPrice) / oldestPrice) * 100
        : 0
    }

    return NextResponse.json({
      // Current price
      price: priceData.price,
      priceFormatted: `$${priceData.price.toFixed(4)}`,
      priceChange24h: priceChange24h.toFixed(2),
      floorPrice: 1.0,

      // Backing
      backing: {
        usdc: priceData.usdcBacking,
        assets: priceData.assetValue,
        total: priceData.usdcBacking + priceData.assetValue,
        ratio: priceData.backingRatio,
        isFullyBacked: priceData.backingRatio >= 1.0,
      },

      // Supply
      supply: {
        total: priceData.totalSupply,
        circulation: circulationStats,
      },

      // Treasury breakdown
      treasury: treasuryBreakdown,

      // Price history
      history: priceHistory,

      // Market cap equivalent
      marketCap: priceData.totalSupply * priceData.price,

      // Timestamp
      timestamp: new Date().toISOString(),
      nextUpdate: new Date(Date.now() + 60000).toISOString(), // 1 minute
    })

  } catch (error: any) {
    console.error('[GRAIN Price] Error:', error)

    // Return fallback price
    return NextResponse.json({
      price: 1.0,
      priceFormatted: '$1.0000',
      priceChange24h: '0',
      floorPrice: 1.0,
      backing: { usdc: 0, assets: 0, total: 0, ratio: 1.0, isFullyBacked: true },
      supply: { total: 0, circulation: null },
      treasury: [],
      history: [],
      marketCap: 0,
      timestamp: new Date().toISOString(),
      error: 'Price calculation error, showing floor price',
    })
  }
}
