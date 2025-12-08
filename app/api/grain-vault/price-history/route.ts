// @ts-nocheck
/**
 * GRAIN Price History API
 * GET: Get historical GRAIN prices for charting
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function GET(req: NextRequest) {
  try {
    const period = req.nextUrl.searchParams.get('period') || '30d' // '24h', '7d', '30d', '1y', 'all'

    // Calculate date range
    let startDate: Date
    const now = new Date()

    switch (period) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      case 'all':
        startDate = new Date(0) // Beginning of time
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    // Get price history
    const history = await sql`
      SELECT
        price_usd,
        total_treasury_usd,
        circulating_supply,
        recorded_at
      FROM grain_price_history
      WHERE recorded_at >= ${startDate.toISOString()}
      ORDER BY recorded_at ASC
    `

    // Format for charting
    const chartData = history.rows.map(row => ({
      timestamp: new Date(row.recorded_at).getTime(),
      date: new Date(row.recorded_at).toISOString(),
      price: parseFloat(row.price_usd),
      treasury: parseFloat(row.total_treasury_usd),
      supply: parseFloat(row.circulating_supply)
    }))

    // Calculate stats
    if (chartData.length === 0) {
      return NextResponse.json({
        success: true,
        period,
        data: [],
        stats: {
          starting_price: 0,
          ending_price: 0,
          high: 0,
          low: 0,
          change_amount: 0,
          change_percent: 0
        }
      })
    }

    const prices = chartData.map(d => d.price)
    const startingPrice = prices[0]
    const endingPrice = prices[prices.length - 1]
    const high = Math.max(...prices)
    const low = Math.min(...prices)
    const changeAmount = endingPrice - startingPrice
    const changePercent = (changeAmount / startingPrice) * 100

    return NextResponse.json({
      success: true,
      period,
      data: chartData,
      stats: {
        starting_price: startingPrice,
        ending_price: endingPrice,
        high,
        low,
        change_amount: changeAmount,
        change_percent: changePercent,
        data_points: chartData.length
      }
    })
  } catch (error) {
    console.error('Price history error:', error)
    return NextResponse.json(
      { error: 'Failed to get price history' },
      { status: 500 }
    )
  }
}
