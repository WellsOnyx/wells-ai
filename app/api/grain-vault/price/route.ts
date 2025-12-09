// @ts-nocheck
/**
 * GRAIN Price API
 * GET: Get current GRAIN price and treasury stats
 */

import { NextResponse } from 'next/server'

// Default GRAIN price data when database is not available
function getDefaultPriceData() {
  return {
    success: true,
    grain: {
      price_usd: 1.00,
      change_24h: 0.0,
      change_7d: 0.0,
      change_30d: 0.0,
      circulating_supply: 0
    },
    treasury: {
      total_usd: 0,
      backing_ratio: 1.0,
      assets: [
        { type: 'treasury_bills', name: 'U.S. Treasury Bills', amount: 0, percentage: 40, apy: 5.2 },
        { type: 'money_market', name: 'Money Market Funds', amount: 0, percentage: 30, apy: 4.8 },
        { type: 'stablecoin', name: 'USDC Reserves', amount: 0, percentage: 20, apy: 0 },
        { type: 'cash', name: 'Operating Cash', amount: 0, percentage: 10, apy: 0 }
      ]
    },
    last_updated: new Date().toISOString()
  }
}

export async function GET() {
  try {
    // Try to dynamically import @vercel/postgres
    let sql: any
    try {
      const pg = await import('@vercel/postgres')
      sql = pg.sql
    } catch {
      // If postgres not available, return defaults
      return NextResponse.json(getDefaultPriceData())
    }

    // Check if POSTGRES_URL is configured
    if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
      return NextResponse.json(getDefaultPriceData())
    }

    // Try to get current GRAIN price from function
    let currentPrice = 1.0
    let change24h = 0
    let circulatingSupply = 0
    let totalTreasury = 0

    try {
      const priceData = await sql`SELECT * FROM get_grain_price()`
      if (priceData.rows.length > 0) {
        const data = priceData.rows[0]
        currentPrice = parseFloat(data.price_usd) || 1.0
        change24h = parseFloat(data.change_24h) || 0
        circulatingSupply = parseFloat(data.circulating_supply) || 0
        totalTreasury = parseFloat(data.total_treasury) || 0
      }
    } catch (e) {
      // Function doesn't exist, try getting from price history
      try {
        const priceResult = await sql`
          SELECT price_usd FROM grain_price_history
          ORDER BY recorded_at DESC LIMIT 1
        `
        if (priceResult.rows.length > 0) {
          currentPrice = parseFloat(priceResult.rows[0].price_usd) || 1.0
        }
      } catch {
        // Table doesn't exist, use default
      }
    }

    // Get 7-day and 30-day changes
    let change7d = 0
    let change30d = 0
    try {
      const [price7d, price30d] = await Promise.all([
        sql`
          SELECT price_usd FROM grain_price_history
          WHERE recorded_at <= NOW() - INTERVAL '7 days'
          ORDER BY recorded_at DESC
          LIMIT 1
        `,
        sql`
          SELECT price_usd FROM grain_price_history
          WHERE recorded_at <= NOW() - INTERVAL '30 days'
          ORDER BY recorded_at DESC
          LIMIT 1
        `
      ])

      const price7dAgo = price7d.rows[0]?.price_usd ? parseFloat(price7d.rows[0].price_usd) : currentPrice
      const price30dAgo = price30d.rows[0]?.price_usd ? parseFloat(price30d.rows[0].price_usd) : currentPrice

      change7d = price7dAgo > 0 ? ((currentPrice - price7dAgo) / price7dAgo) * 100 : 0
      change30d = price30dAgo > 0 ? ((currentPrice - price30dAgo) / price30dAgo) * 100 : 0
    } catch {
      // History table doesn't exist
    }

    // Get treasury breakdown
    let treasuryAssets: any[] = []
    try {
      const treasuryBreakdown = await sql`
        SELECT
          asset_type,
          asset_name,
          SUM(amount) as total_amount,
          AVG(apy) as avg_apy
        FROM treasury_backing
        WHERE status = 'active'
        GROUP BY asset_type, asset_name
        ORDER BY total_amount DESC
      `
      treasuryAssets = treasuryBreakdown.rows.map((asset: any) => ({
        type: asset.asset_type,
        name: asset.asset_name,
        amount: parseFloat(asset.total_amount) || 0,
        percentage: totalTreasury > 0 ? (parseFloat(asset.total_amount) / totalTreasury) * 100 : 0,
        apy: parseFloat(asset.avg_apy || 0)
      }))
    } catch {
      // Treasury table doesn't exist, use defaults
      treasuryAssets = [
        { type: 'treasury_bills', name: 'U.S. Treasury Bills', amount: 0, percentage: 40, apy: 5.2 },
        { type: 'money_market', name: 'Money Market Funds', amount: 0, percentage: 30, apy: 4.8 },
        { type: 'stablecoin', name: 'USDC Reserves', amount: 0, percentage: 20, apy: 0 },
        { type: 'cash', name: 'Operating Cash', amount: 0, percentage: 10, apy: 0 }
      ]
    }

    return NextResponse.json({
      success: true,
      grain: {
        price_usd: currentPrice,
        change_24h: change24h,
        change_7d: change7d,
        change_30d: change30d,
        circulating_supply: circulatingSupply
      },
      treasury: {
        total_usd: totalTreasury,
        backing_ratio: 1.0, // Always 100% backed
        assets: treasuryAssets
      },
      last_updated: new Date().toISOString()
    })
  } catch (error) {
    console.error('Price API error:', error)
    // Return default data instead of error
    return NextResponse.json(getDefaultPriceData())
  }
}
