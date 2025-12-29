// @ts-nocheck
/**
 * GET /api/companion/trust-score
 * POST /api/companion/trust-score
 *
 * View relationship metrics and trust score, and record trust events.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs'
import {
  getTrustScore,
  recordTrustEvent,
  getRecommendedAutonomy,
  updateAutonomy,
  checkAutonomy,
  getTierDescription,
  getTierColor,
  formatTrustSummary,
  TrustEventType,
} from '@/lib/companion/trust-builder'
import { query } from '@/lib/db'

/**
 * GET - Fetch trust score and relationship metrics
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get trust score
    const trustScore = await getTrustScore(userId)

    // Get recommended autonomy level
    const recommendedAutonomy = getRecommendedAutonomy(trustScore)

    // Get recent trust events
    const eventsResult = await query(
      `SELECT * FROM trust_events
       WHERE user_id = $1
       ORDER BY timestamp DESC
       LIMIT 20`,
      [userId]
    )

    const recentEvents = eventsResult.rows.map((row) => ({
      id: row.id,
      type: row.event_type,
      details: row.details,
      impact: row.impact_score,
      timestamp: new Date(row.timestamp),
    }))

    // Calculate value delivered
    const valueDelivered = {
      moneySaved: trustScore.factors.moneySaved,
      moneyEarned: trustScore.factors.moneyEarned,
      risksAvoided: trustScore.factors.risksAvoided,
      riskValueAvoided: trustScore.factors.riskValueAvoided,
      totalValue:
        trustScore.factors.moneySaved +
        trustScore.factors.moneyEarned +
        trustScore.factors.riskValueAvoided,
    }

    // Get insight statistics
    const insightStats = {
      generated: trustScore.factors.insightsGenerated,
      actedUpon: trustScore.factors.insightsActedUpon,
      dismissed: trustScore.factors.insightsDismissed,
      successRate: trustScore.factors.insightSuccessRate,
    }

    return NextResponse.json({
      success: true,
      trustScore: {
        score: trustScore.score,
        tier: trustScore.tier,
        tierDescription: getTierDescription(trustScore.tier),
        tierColor: getTierColor(trustScore.tier),
        summary: formatTrustSummary(trustScore),
      },
      factors: trustScore.factors,
      milestones: trustScore.milestones,
      autonomy: {
        current: trustScore.autonomyLevel,
        recommended: recommendedAutonomy,
      },
      valueDelivered,
      insightStats,
      recentEvents,
      timestamps: {
        created: trustScore.createdAt,
        lastUpdated: trustScore.lastUpdated,
      },
    })
  } catch (error) {
    console.error('[API] Error fetching trust score:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trust score' },
      { status: 500 }
    )
  }
}

/**
 * POST - Record a trust event or update autonomy
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action } = body

    switch (action) {
      case 'record_event':
        // Record a trust event
        const { eventType, details } = body

        if (!eventType) {
          return NextResponse.json(
            { error: 'Missing eventType' },
            { status: 400 }
          )
        }

        const updatedScore = await recordTrustEvent(
          userId,
          eventType as TrustEventType,
          details || {}
        )

        return NextResponse.json({
          success: true,
          action: 'event_recorded',
          eventType,
          newScore: updatedScore.score,
          newTier: updatedScore.tier,
          newMilestones: updatedScore.milestones.filter(
            (m) =>
              new Date(m.achievedAt).getTime() > Date.now() - 60 * 1000
          ),
        })

      case 'update_autonomy':
        // Update autonomy settings
        const { autonomy } = body

        if (!autonomy) {
          return NextResponse.json(
            { error: 'Missing autonomy settings' },
            { status: 400 }
          )
        }

        const newAutonomy = await updateAutonomy(userId, autonomy)

        return NextResponse.json({
          success: true,
          action: 'autonomy_updated',
          autonomy: newAutonomy,
        })

      case 'check_autonomy':
        // Check if an action is allowed
        const { checkAction, value } = body

        if (!checkAction) {
          return NextResponse.json(
            { error: 'Missing action to check' },
            { status: 400 }
          )
        }

        const checkResult = await checkAutonomy(userId, checkAction, value)

        return NextResponse.json({
          success: true,
          action: 'autonomy_checked',
          checkAction,
          ...checkResult,
        })

      case 'apply_recommended':
        // Apply recommended autonomy settings
        const currentScore = await getTrustScore(userId)
        const recommended = getRecommendedAutonomy(currentScore)
        const appliedAutonomy = await updateAutonomy(userId, recommended)

        return NextResponse.json({
          success: true,
          action: 'recommended_applied',
          autonomy: appliedAutonomy,
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('[API] Error in trust score action:', error)
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    )
  }
}
