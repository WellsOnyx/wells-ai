/**
 * Fee History API
 * GET /api/fees/history
 *
 * Get fee payment history for the current user.
 * Returns all fees paid (as seller) or facilitated (as buyer).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getFeeHistory } from '@/lib/fees/fee-service'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    // Get fee history for user
    const history = await getFeeHistory(userId, limit)

    // Calculate totals
    const totals = history.reduce(
      (acc, fee) => {
        if (fee.status === 'captured') {
          acc.totalFees += fee.feeAmount
          acc.totalDeals += fee.dealAmount
          acc.count += 1
        }
        return acc
      },
      { totalFees: 0, totalDeals: 0, count: 0 }
    )

    return NextResponse.json({
      success: true,
      history,
      summary: {
        totalFees: Math.round(totals.totalFees * 100) / 100,
        totalDeals: Math.round(totals.totalDeals * 100) / 100,
        dealCount: totals.count,
        averageFee:
          totals.count > 0
            ? Math.round((totals.totalFees / totals.count) * 100) / 100
            : 0,
      },
    })
  } catch (error) {
    console.error('Error fetching fee history:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch fee history',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
