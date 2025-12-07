/**
 * Fee Summary API
 * GET /api/fees/summary
 *
 * Get summary of fees collected (admin/treasury view).
 * Requires admin authorization.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getFeeSummary } from '@/lib/fees/fee-service'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: Add admin authorization check
    // For now, allow all authenticated users to view summary

    const { searchParams } = new URL(request.url)
    const timeframe = parseInt(searchParams.get('days') || '30')

    const summary = await getFeeSummary(timeframe)

    return NextResponse.json({
      success: true,
      timeframe: `${timeframe} days`,
      summary: {
        totalFees: summary.totalFees,
        feeCount: summary.feeCount,
        averageFee: summary.averageFee,
        byTier: {
          standard: {
            count: summary.byTier.standard.count,
            total: summary.byTier.standard.total,
            average:
              summary.byTier.standard.count > 0
                ? Math.round(
                    (summary.byTier.standard.total / summary.byTier.standard.count) * 100
                  ) / 100
                : 0,
          },
          whiteGlove: {
            count: summary.byTier['white-glove'].count,
            total: summary.byTier['white-glove'].total,
            average:
              summary.byTier['white-glove'].count > 0
                ? Math.round(
                    (summary.byTier['white-glove'].total /
                      summary.byTier['white-glove'].count) *
                      100
                  ) / 100
                : 0,
          },
          complex: {
            count: summary.byTier.complex.count,
            total: summary.byTier.complex.total,
            average:
              summary.byTier.complex.count > 0
                ? Math.round(
                    (summary.byTier.complex.total / summary.byTier.complex.count) * 100
                  ) / 100
                : 0,
          },
        },
      },
    })
  } catch (error) {
    console.error('Error fetching fee summary:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch fee summary',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
