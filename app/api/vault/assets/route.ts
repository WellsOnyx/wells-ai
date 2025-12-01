/**
 * GET /api/vault/assets
 *
 * Get current vault asset breakdown by tier
 */

import { NextRequest, NextResponse } from 'next/server'
import { PriceOracle, fromUSDC } from '@/lib/blockchain/contracts'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const [totalAssetsRaw, tiers] = await Promise.all([
      PriceOracle.getTotalAssets(),
      PriceOracle.getAssetTiers(),
    ])

    const totalNAV = fromUSDC(totalAssetsRaw)

    const tierData = {
      liquid: fromUSDC(tiers.liquid),
      float: fromUSDC(tiers.float),
      physical: fromUSDC(tiers.physical),
      investments: fromUSDC(tiers.investments),
      receivables: fromUSDC(tiers.receivables),
    }

    const response = {
      totalNAV: Math.floor(totalNAV),
      tiers: [
        {
          name: 'Liquid',
          value: Math.floor(tierData.liquid),
          percentage: parseFloat(((tierData.liquid / totalNAV) * 100).toFixed(2)),
          description: 'Cash and cash equivalents',
        },
        {
          name: 'Float',
          value: Math.floor(tierData.float),
          percentage: parseFloat(((tierData.float / totalNAV) * 100).toFixed(2)),
          description: 'Payments in transit',
        },
        {
          name: 'Physical',
          value: Math.floor(tierData.physical),
          percentage: parseFloat(((tierData.physical / totalNAV) * 100).toFixed(2)),
          description: 'Physical inventory and commodities',
        },
        {
          name: 'Investments',
          value: Math.floor(tierData.investments),
          percentage: parseFloat(((tierData.investments / totalNAV) * 100).toFixed(2)),
          description: 'Equity and debt investments',
        },
        {
          name: 'Receivables',
          value: Math.floor(tierData.receivables),
          percentage: parseFloat(((tierData.receivables / totalNAV) * 100).toFixed(2)),
          description: 'Accounts receivable',
        },
      ],
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300', // Cache for 5 minutes
      },
    })
  } catch (error) {
    console.error('[API] Error fetching vault assets:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch vault assets',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
