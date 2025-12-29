// @ts-nocheck
/**
 * GET /api/companion/insights
 * POST /api/companion/insights
 *
 * Get pending insights and generate new ones for the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getPendingInsights,
  generateInsights,
  storeInsight,
  generateWelcomeBackMessage,
  InsightGenerationContext,
} from '@/lib/companion/insight-engine'
import { getWellsMemory } from '@/lib/wells-memory'
import { recordTrustEvent } from '@/lib/companion/trust-builder'

/**
 * GET - Fetch pending insights for the current user
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get pending insights
    const insights = await getPendingInsights(userId)

    // Get welcome message
    const memory = await getWellsMemory(userId)
    const welcomeMessage = await generateWelcomeBackMessage(userId, memory)

    // Group insights by urgency
    const grouped = {
      critical: insights.filter((i) => i.urgency === 'critical'),
      high: insights.filter((i) => i.urgency === 'high'),
      medium: insights.filter((i) => i.urgency === 'medium'),
      low: insights.filter((i) => i.urgency === 'low'),
      info: insights.filter((i) => i.urgency === 'info'),
    }

    // Calculate summary stats
    const summary = {
      total: insights.length,
      criticalCount: grouped.critical.length,
      highCount: grouped.high.length,
      totalPotentialValue: insights.reduce((sum, i) => sum + (i.potentialValue || 0), 0),
      categories: [...new Set(insights.map((i) => i.category))],
    }

    return NextResponse.json({
      success: true,
      welcomeMessage,
      summary,
      insights,
      grouped,
    })
  } catch (error) {
    console.error('[API] Error fetching insights:', error)
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    )
  }
}

/**
 * POST - Generate new insights for the current user
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { journey, forceRefresh = false } = body

    // Get user memory
    const memory = await getWellsMemory(userId)

    // Determine journey from memory if not provided
    const userJourney =
      journey ||
      memory?.wellsaiProfile?.primaryJourney ||
      'buyer'

    // Check if we should generate new insights
    if (!forceRefresh) {
      const existingInsights = await getPendingInsights(userId)
      if (existingInsights.length >= 5) {
        return NextResponse.json({
          success: true,
          message: 'Sufficient pending insights exist',
          insights: existingInsights,
          generated: 0,
        })
      }
    }

    // Build context for insight generation
    const context: InsightGenerationContext = {
      userId,
      journey: userJourney,
      memory,
      userMetrics: body.metrics, // Optional metrics from client
    }

    // Generate insights
    const newInsights = await generateInsights(context)

    // Store each insight
    for (const insight of newInsights) {
      await storeInsight(insight)

      // Record trust event
      await recordTrustEvent(userId, 'insight_acted_upon', {
        insightId: insight.id,
        category: insight.category,
      })
    }

    // Get updated list of all pending insights
    const allInsights = await getPendingInsights(userId)

    return NextResponse.json({
      success: true,
      message: `Generated ${newInsights.length} new insights`,
      generated: newInsights.length,
      insights: allInsights,
    })
  } catch (error) {
    console.error('[API] Error generating insights:', error)
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    )
  }
}
