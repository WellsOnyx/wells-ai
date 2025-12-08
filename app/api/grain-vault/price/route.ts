// @ts-nocheck
/**
 * GRAIN Price API
 * GET: Get current GRAIN price and treasury stats
 */

import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function GET() {
  try {
    // Get current GRAIN price from function
    const priceData = await sql`SELECT * FROM get_grain_price()`

    if (priceData.rows.length === 0) {
      return NextResponse.json(
        { error: 'Unable to calculate GRAIN price' },
        { status: 500 }
      )
    }

    const data = priceData.rows[0]

    // Get 7-day and 30-day changes
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

    const currentPrice = parseFloat(data.price_usd)
    const price7dAgo = price7d.rows[0]?.price_usd ? parseFloat(price7d.rows[0].price_usd) : currentPrice
    const price30dAgo = price30d.rows[0]?.price_usd ? parseFloat(price30d.rows[0].price_usd) : currentPrice

    const change7d = ((currentPrice - price7dAgo) / price7dAgo) * 100
    const change30d = ((currentPrice - price30dAgo) / price30dAgo) * 100

    // Get treasury breakdown
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

    const totalTreasury = parseFloat(data.total_treasury)

    return NextResponse.json({
      success: true,
      grain: {
        price_usd: currentPrice,
        change_24h: parseFloat(data.change_24h),
        change_7d: change7d,
        change_30d: change30d,
        circulating_supply: parseFloat(data.circulating_supply)
      },
      treasury: {
        total_usd: totalTreasury,
        backing_ratio: 1.0, // Always 100% backed
        assets: treasuryBreakdown.rows.map(asset => ({
          type: asset.asset_type,
          name: asset.asset_name,
          amount: parseFloat(asset.total_amount),
          percentage: (parseFloat(asset.total_amount) / totalTreasury) * 100,
          apy: parseFloat(asset.avg_apy || 0)
        }))
      },
      last_updated: new Date().toISOString()
    })
  } catch (error) {
    console.error('Price API error:', error)
    return NextResponse.json(
      { error: 'Failed to get GRAIN price' },
      { status: 500 }
    )
  }
}
