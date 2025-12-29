// @ts-nocheck
/**
 * GET /api/companion/activity
 *
 * Get Wells activity stream - shows what Wells is currently doing/monitoring
 * for the authenticated user. This makes Wells feel alive and working in the background.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getWellsActivity,
  getWellsWorkingSummary,
  logActivity,
  completeActivity,
} from '@/lib/companion/background-worker'
import { query } from '@/lib/db'

/**
 * GET - Fetch Wells activity stream for the current user
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(req.url)
    const summaryOnly = searchParams.get('summary') === 'true'
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    // Get the "Wells is working" summary
    const summary = await getWellsWorkingSummary(userId)

    if (summaryOnly) {
      return NextResponse.json({
        success: true,
        wellsIsWorking: summary.isWorking,
        currentTasks: summary.currentTasks,
        stats: summary.stats,
      })
    }

    // Get full activity stream
    const activities = await getWellsActivity(userId)

    // Get additional context: pending insights, active negotiations, etc.
    const contextResult = await query(
      `SELECT
        (SELECT COUNT(*) FROM wells_insights WHERE user_id = $1 AND acted_on = false AND dismissed = false) as pending_insights,
        (SELECT COUNT(*) FROM rfqs WHERE buyer_id = $1 AND status IN ('open', 'quoting', 'negotiating')) as active_rfqs,
        (SELECT COUNT(*) FROM negotiations WHERE buyer_id = $1 AND status = 'active') as active_negotiations,
        (SELECT SUM(potential_value) FROM wells_insights WHERE user_id = $1 AND acted_on = false AND dismissed = false) as total_potential_value`,
      [userId]
    )

    const context = contextResult.rows[0] || {
      pending_insights: 0,
      active_rfqs: 0,
      active_negotiations: 0,
      total_potential_value: 0,
    }

    // Format activities for response
    const formattedActivities = activities.slice(0, limit).map((activity) => ({
      id: activity.id,
      type: activity.actionType,
      description: activity.description,
      relatedEntity: activity.relatedEntityType
        ? {
            type: activity.relatedEntityType,
            id: activity.relatedEntityId,
          }
        : null,
      startedAt: activity.startedAt,
      completedAt: activity.completedAt,
      status: activity.status,
      duration: activity.completedAt
        ? Math.round((new Date(activity.completedAt).getTime() - new Date(activity.startedAt).getTime()) / 1000)
        : null,
    }))

    // Generate human-readable status message
    const statusMessage = generateStatusMessage(summary, context)

    return NextResponse.json({
      success: true,
      statusMessage,
      wellsIsWorking: summary.isWorking,
      currentTasks: summary.currentTasks,
      recentCompletions: summary.recentCompletions,
      stats: {
        ...summary.stats,
        pendingInsights: parseInt(context.pending_insights) || 0,
        activeNegotiations: parseInt(context.active_negotiations) || 0,
        totalPotentialValue: parseFloat(context.total_potential_value) || 0,
      },
      activities: formattedActivities,
    })
  } catch (error) {
    console.error('[API] Error fetching activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activity' },
      { status: 500 }
    )
  }
}

/**
 * POST - Manually trigger Wells activity for the user
 * This can be used to trigger insight generation on-demand
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action } = body

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action type' },
        { status: 400 }
      )
    }

    let result: any = null

    switch (action) {
      case 'refresh_insights':
        // Trigger insight generation
        const activityId = await logActivity(
          userId,
          'analyzing',
          'Generating fresh insights based on your latest activity'
        )

        try {
          // Import and use the insight engine service
          const { InsightEngineService } = await import('@/lib/companion/insight-engine-service')
          const engine = new InsightEngineService(userId)
          const insights = await engine.generateInsights()

          await completeActivity(activityId, 'completed')

          result = {
            insightsGenerated: insights.length,
            message: `Generated ${insights.length} new insights`,
          }
        } catch (error) {
          await completeActivity(activityId, 'failed')
          throw error
        }
        break

      case 'check_rfqs':
        // Check RFQs for updates
        const rfqActivityId = await logActivity(
          userId,
          'monitoring',
          'Checking your RFQs for new quotes and price changes'
        )

        try {
          // Simulate RFQ check (in production, this would query actual data)
          await completeActivity(rfqActivityId, 'completed')

          result = {
            checked: true,
            message: 'RFQ monitoring complete',
          }
        } catch (error) {
          await completeActivity(rfqActivityId, 'failed')
          throw error
        }
        break

      case 'scan_market':
        // Scan market for opportunities
        const scanActivityId = await logActivity(
          userId,
          'searching',
          'Scanning the market for new opportunities and price changes'
        )

        try {
          // Import and use the insight engine service
          const { InsightEngineService } = await import('@/lib/companion/insight-engine-service')
          const engine = new InsightEngineService(userId)
          const marketInsights = await engine.trackMarketPrices()

          await completeActivity(scanActivityId, 'completed')

          result = {
            opportunitiesFound: marketInsights.length,
            message: `Found ${marketInsights.length} market opportunities`,
          }
        } catch (error) {
          await completeActivity(scanActivityId, 'failed')
          throw error
        }
        break

      case 'check_applications':
        // Check job application statuses
        const appActivityId = await logActivity(
          userId,
          'tracking',
          'Checking status of your job applications'
        )

        try {
          const { InsightEngineService } = await import('@/lib/companion/insight-engine-service')
          const engine = new InsightEngineService(userId)
          const updates = await engine.trackApplicationStatus()

          await completeActivity(appActivityId, 'completed')

          result = {
            updatesFound: updates.length,
            message: `Found ${updates.length} application updates`,
          }
        } catch (error) {
          await completeActivity(appActivityId, 'failed')
          throw error
        }
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action type' },
          { status: 400 }
        )
    }

    // Get updated summary
    const summary = await getWellsWorkingSummary(userId)

    return NextResponse.json({
      success: true,
      action,
      result,
      wellsIsWorking: summary.isWorking,
      currentTasks: summary.currentTasks,
    })
  } catch (error) {
    console.error('[API] Error triggering activity:', error)
    return NextResponse.json(
      { error: 'Failed to trigger activity' },
      { status: 500 }
    )
  }
}

/**
 * Generate a human-readable status message
 */
function generateStatusMessage(
  summary: Awaited<ReturnType<typeof getWellsWorkingSummary>>,
  context: Record<string, any>
): string {
  const parts: string[] = []

  // Active work
  if (summary.isWorking) {
    if (summary.stats.rfqsMonitoring > 0) {
      parts.push(`monitoring ${summary.stats.rfqsMonitoring} RFQ${summary.stats.rfqsMonitoring > 1 ? 's' : ''} for better prices`)
    }
    if (summary.stats.jobsTracking > 0) {
      parts.push(`tracking ${summary.stats.jobsTracking} job application${summary.stats.jobsTracking > 1 ? 's' : ''}`)
    }
    if (summary.stats.dealsNegotiating > 0) {
      parts.push(`negotiating ${summary.stats.dealsNegotiating} deal${summary.stats.dealsNegotiating > 1 ? 's' : ''}`)
    }
  }

  // Recent completions
  if (summary.recentCompletions.length > 0) {
    parts.push(`just completed ${summary.recentCompletions.length} task${summary.recentCompletions.length > 1 ? 's' : ''}`)
  }

  // Pending insights
  const pendingInsights = parseInt(context.pending_insights) || 0
  const totalValue = parseFloat(context.total_potential_value) || 0

  if (pendingInsights > 0) {
    if (totalValue > 0) {
      parts.push(`found $${totalValue.toLocaleString()} in potential opportunities`)
    } else {
      parts.push(`found ${pendingInsights} insight${pendingInsights > 1 ? 's' : ''} for you`)
    }
  }

  if (parts.length === 0) {
    return "I'm here and ready to help. Everything looks good right now."
  }

  // Capitalize first letter and join
  const message = parts.join(', ')
  return `I'm ${message.charAt(0).toLowerCase()}${message.slice(1)}.`
}
