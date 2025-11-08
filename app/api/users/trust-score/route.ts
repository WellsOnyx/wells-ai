/**
 * GET /api/users/trust-score?userId=xxx
 *
 * Get trust score and reputation data for a user
 */

import { NextRequest, NextResponse } from 'next/server'
import { calculateTrustScore } from '@/lib/transactions'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      )
    }

    const trustScore = await calculateTrustScore(userId)

    return NextResponse.json({
      success: true,
      trustScore: {
        score: trustScore.score,
        level: getTrustLevel(trustScore.score),
        totalTransactions: trustScore.totalTransactions,
        averageRating: trustScore.averageRating,
        completionRate: trustScore.completionRate,
        averageDealSize: trustScore.averageDealSize,
        badge: getTrustBadge(trustScore.score)
      }
    })
  } catch (error: any) {
    console.error('[TRUST_SCORE] Fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch trust score' },
      { status: 500 }
    )
  }
}

/**
 * Get trust level label
 */
function getTrustLevel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 75) return 'Very Good'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Building Trust'
}

/**
 * Get trust badge
 */
function getTrustBadge(score: number): {
  icon: string
  color: string
  label: string
} {
  if (score >= 90) {
    return {
      icon: '⭐',
      color: 'gold',
      label: 'Top Seller'
    }
  }
  if (score >= 75) {
    return {
      icon: '✓',
      color: 'blue',
      label: 'Verified'
    }
  }
  if (score >= 60) {
    return {
      icon: '◆',
      color: 'green',
      label: 'Trusted'
    }
  }
  return {
    icon: '○',
    color: 'gray',
    label: 'New'
  }
}
