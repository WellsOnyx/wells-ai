/**
 * GRAIN Float Allocation API
 * GET /api/grain/float-allocation
 *
 * Returns the current float allocation state, yield projections,
 * and liquidity analysis for the GRAIN reserve model.
 *
 * Query params:
 *   ?volume=1000000000000  — Override annual volume (default: 3.3% of $33T)
 *   ?scale=true            — Return all scale projections (3%, 5%, 7%)
 *   ?summary=true          — Return human-readable text summary
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  calculateFloat,
  calculateTargetAllocation,
  getAllocationState,
  projectYield,
  analyzeLiquidity,
  projectAtScale,
  generateScaleSummary,
  RESERVE_ALLOCATION,
  TARGET_ROI,
  SETTLEMENT_HOURS,
  YIELD_ASSUMPTIONS,
  LIQUIDITY_TIERS,
  BASE_CASE_ANNUAL_VOLUME,
} from '@/lib/grain/float-allocation'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const volumeParam = searchParams.get('volume')
    const scaleParam = searchParams.get('scale')
    const summaryParam = searchParams.get('summary')

    // Scale projections mode
    if (scaleParam === 'true') {
      const projections = projectAtScale()

      if (summaryParam === 'true') {
        return NextResponse.json({
          success: true,
          summary: generateScaleSummary(),
          projections,
        })
      }

      return NextResponse.json({
        success: true,
        projections,
      })
    }

    // Single-volume analysis
    // Default: $1T annual volume (3.3% of $33T) → $5.4B float
    const annualVolume = volumeParam
      ? parseFloat(volumeParam)
      : BASE_CASE_ANNUAL_VOLUME

    const float = calculateFloat(annualVolume)
    const targets = calculateTargetAllocation(float.totalFloat)

    // For now, actual = target (no drift). In production, read from DB.
    const allocation = getAllocationState(float.totalFloat, targets)
    const yieldProjection = projectYield(float.totalFloat)
    const liquidity = analyzeLiquidity(
      float.totalFloat,
      float.dailyVolume,
      targets.cashAndTips
    )

    return NextResponse.json({
      success: true,

      // Model parameters
      model: {
        reserveAllocation: RESERVE_ALLOCATION,
        targetROI: TARGET_ROI,
        settlementHours: SETTLEMENT_HOURS,
        yieldAssumptions: YIELD_ASSUMPTIONS,
        liquidityTiers: LIQUIDITY_TIERS,
      },

      // Float calculation
      float: {
        annualVolume,
        dailyVolume: float.dailyVolume,
        settlementDays: float.settlementDays,
        totalFloat: float.totalFloat,
      },

      // Allocation state
      allocation: {
        foundation: allocation.foundation,
        cashAndTips: allocation.cashAndTips,
        preciousMetals: allocation.preciousMetals,
        treasuries: allocation.treasuries,
        needsRebalance: allocation.needsRebalance,
        maxDrift: allocation.maxDrift,
      },

      // Yield projections
      yield: {
        grossYield: yieldProjection.grossYield,
        fees: yieldProjection.fees,
        netYield: yieldProjection.netYield,
        effectiveROI: yieldProjection.effectiveROI,
        effectiveROIPct: `${(yieldProjection.effectiveROI * 100).toFixed(2)}%`,
        targetROI: TARGET_ROI,
        roiGap: yieldProjection.roiGap,
        roiGapPct: `${(yieldProjection.roiGap * 100).toFixed(2)}%`,
        dailyYield: yieldProjection.dailyYield,
      },

      // Liquidity analysis
      liquidity: {
        instantLiquidity: liquidity.instantLiquidity,
        settlementCoverageHours: liquidity.settlementCoverageHours,
        canMeetSettlements: liquidity.canMeetSettlements,
        liquidatable24hr: liquidity.liquidatable24hr,
        stressCoverageHours: liquidity.stressCoverageHours,
        yieldUtilization: liquidity.yieldUtilization,
        yieldUtilizationPct: `${(liquidity.yieldUtilization * 100).toFixed(2)}%`,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error: any) {
    console.error('[Float Allocation API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to compute float allocation',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
