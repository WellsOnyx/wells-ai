// @ts-nocheck
/**
 * Wells AI Insight Generator - Background Job
 *
 * "Go to the ant, you sluggard; consider its ways and be wise!
 *  It has no commander, no overseer or ruler,
 *  yet it stores its provisions in summer
 *  and gathers its food at harvest." - Proverbs 6:6-8
 *
 * This background job continuously works to analyze user data,
 * generate personalized insights, and queue them for delivery.
 * Like the ant, Wells works diligently even when you're not looking.
 */

import { query } from '@/lib/db'
import { getWellsMemory } from '@/lib/wells-memory'
import {
  generateInsights,
  storeInsight,
  ProactiveInsight,
  InsightGenerationContext,
  UserMetrics,
  UserJourney,
} from './insight-engine'
import { deliverInsight } from './notification-hub'
import { recordTrustEvent } from './trust-builder'

// ============================================================================
// TYPES
// ============================================================================

export interface InsightGeneratorConfig {
  batchSize: number
  intervalMinutes: number
  maxInsightsPerUser: number
  minHoursBetweenSameInsight: number
  urgencyDeliveryDelays: {
    critical: number // minutes
    high: number
    medium: number
    low: number
    info: number
  }
}

export interface GeneratorStats {
  runId: string
  startedAt: Date
  completedAt?: Date
  usersProcessed: number
  insightsGenerated: number
  insightsDelivered: number
  errors: number
  duration?: number // milliseconds
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: InsightGeneratorConfig = {
  batchSize: 50, // Users per batch
  intervalMinutes: 15, // Run every 15 minutes
  maxInsightsPerUser: 5, // Max pending insights per user
  minHoursBetweenSameInsight: 24, // Don't repeat same insight type within 24h
  urgencyDeliveryDelays: {
    critical: 0, // Immediate
    high: 5, // 5 minutes
    medium: 60, // 1 hour
    low: 240, // 4 hours
    info: 480, // 8 hours
  },
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Run the insight generator for all active users
 */
export async function runInsightGenerator(
  config: Partial<InsightGeneratorConfig> = {}
): Promise<GeneratorStats> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config }
  const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startedAt = new Date()

  const stats: GeneratorStats = {
    runId,
    startedAt,
    usersProcessed: 0,
    insightsGenerated: 0,
    insightsDelivered: 0,
    errors: 0,
  }

  try {
    console.log(`[InsightGenerator] Starting run ${runId}`)

    // Get active users in batches
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const users = await getActiveUsers(fullConfig.batchSize, offset)

      if (users.length === 0) {
        hasMore = false
        continue
      }

      // Process each user in parallel (with limits)
      await Promise.all(
        users.map(async (user) => {
          try {
            const generated = await processUser(user, fullConfig)
            stats.usersProcessed += 1
            stats.insightsGenerated += generated.length
            stats.insightsDelivered += generated.filter((i) => i.delivered).length
          } catch (error) {
            console.error(`[InsightGenerator] Error processing user ${user.id}:`, error)
            stats.errors += 1
          }
        })
      )

      offset += fullConfig.batchSize

      // Check if we've processed all users
      if (users.length < fullConfig.batchSize) {
        hasMore = false
      }
    }

    // Learn from past insights
    await learnFromInsightHistory()

    stats.completedAt = new Date()
    stats.duration = stats.completedAt.getTime() - startedAt.getTime()

    // Record stats
    await recordGeneratorStats(stats)

    console.log(
      `[InsightGenerator] Run ${runId} completed. ` +
        `Users: ${stats.usersProcessed}, ` +
        `Insights: ${stats.insightsGenerated}, ` +
        `Delivered: ${stats.insightsDelivered}, ` +
        `Errors: ${stats.errors}, ` +
        `Duration: ${stats.duration}ms`
    )

    return stats
  } catch (error) {
    console.error(`[InsightGenerator] Run ${runId} failed:`, error)
    stats.errors += 1
    stats.completedAt = new Date()
    stats.duration = stats.completedAt.getTime() - startedAt.getTime()
    return stats
  }
}

/**
 * Get active users for processing
 */
async function getActiveUsers(
  limit: number,
  offset: number
): Promise<Array<{ id: string; journey: UserJourney }>> {
  try {
    const result = await query(
      `SELECT
        uc.clerk_user_id as id,
        COALESCE(uc.wellsai_profile->>'primaryJourney', 'buyer') as journey
       FROM unified_user_context uc
       WHERE uc.last_activity > NOW() - INTERVAL '30 days'
       ORDER BY uc.last_activity DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    )

    return result.rows.map((row) => ({
      id: row.id,
      journey: row.journey as UserJourney,
    }))
  } catch (error) {
    console.error('[InsightGenerator] Error getting active users:', error)
    return []
  }
}

/**
 * Process a single user - generate and deliver insights
 */
async function processUser(
  user: { id: string; journey: UserJourney },
  config: InsightGeneratorConfig
): Promise<Array<{ insight: ProactiveInsight; delivered: boolean }>> {
  const results: Array<{ insight: ProactiveInsight; delivered: boolean }> = []

  try {
    // Check current pending insights count
    const pendingCount = await getPendingInsightCount(user.id)
    if (pendingCount >= config.maxInsightsPerUser) {
      return results
    }

    // Get user memory and metrics
    const memory = await getWellsMemory(user.id)
    const metrics = await getUserMetrics(user.id, user.journey)

    // Get recently generated insight types to avoid repetition
    const recentTypes = await getRecentInsightTypes(user.id, config.minHoursBetweenSameInsight)

    // Build context
    const context: InsightGenerationContext = {
      userId: user.id,
      journey: user.journey,
      memory,
      userMetrics: metrics,
    }

    // Generate insights
    const insights = await generateInsights(context)

    // Filter out recently generated types
    const newInsights = insights.filter(
      (insight) => !recentTypes.includes(`${insight.category}_${insight.urgency}`)
    )

    // Limit to remaining capacity
    const slotsAvailable = config.maxInsightsPerUser - pendingCount
    const toProcess = newInsights.slice(0, slotsAvailable)

    // Store and optionally deliver each insight
    for (const insight of toProcess) {
      try {
        // Store the insight
        await storeInsight(insight)

        // Calculate delivery delay based on urgency
        const delayMinutes = config.urgencyDeliveryDelays[insight.urgency]
        const shouldDeliverNow = delayMinutes === 0

        if (shouldDeliverNow) {
          await deliverInsight(insight)
        } else {
          // Schedule for later delivery
          await scheduleInsightDelivery(insight, delayMinutes)
        }

        // Record trust event for insight generation
        await recordTrustEvent(user.id, 'insight_acted_upon', {
          insightId: insight.id,
          category: insight.category,
          urgency: insight.urgency,
        })

        results.push({
          insight,
          delivered: shouldDeliverNow,
        })
      } catch (error) {
        console.error(`[InsightGenerator] Error processing insight for ${user.id}:`, error)
      }
    }
  } catch (error) {
    console.error(`[InsightGenerator] Error in processUser for ${user.id}:`, error)
  }

  return results
}

/**
 * Get count of pending insights for user
 */
async function getPendingInsightCount(userId: string): Promise<number> {
  try {
    const result = await query(
      `SELECT COUNT(*) as count FROM proactive_insights
       WHERE user_id = $1
         AND acted_upon = false
         AND dismissed = false
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [userId]
    )
    return parseInt(result.rows[0]?.count || '0', 10)
  } catch (error) {
    console.error('[InsightGenerator] Error getting pending count:', error)
    return 0
  }
}

/**
 * Get recent insight types to avoid repetition
 */
async function getRecentInsightTypes(
  userId: string,
  hoursBack: number
): Promise<string[]> {
  try {
    const result = await query(
      `SELECT DISTINCT category || '_' || urgency as type_key
       FROM proactive_insights
       WHERE user_id = $1
         AND created_at > NOW() - INTERVAL '${hoursBack} hours'`,
      [userId]
    )
    return result.rows.map((row) => row.type_key)
  } catch (error) {
    console.error('[InsightGenerator] Error getting recent types:', error)
    return []
  }
}

/**
 * Get user metrics for insight generation
 */
async function getUserMetrics(
  userId: string,
  journey: UserJourney
): Promise<UserMetrics> {
  try {
    // This would typically pull from various data sources
    // Here we'll query what's available in the database

    const metrics: UserMetrics = {}

    // Common metrics
    const profileResult = await query(
      `SELECT * FROM user_profiles WHERE user_id = $1`,
      [userId]
    )
    const profile = profileResult.rows[0]

    // Journey-specific metrics
    switch (journey) {
      case 'buyer':
        const buyerResult = await query(
          `SELECT
            COALESCE(SUM(amount), 0) as total_spend,
            COALESCE(AVG(amount), 0) as avg_order,
            COUNT(DISTINCT supplier_id) as supplier_count,
            COUNT(*) FILTER (WHERE status = 'pending') as pending_invoices
           FROM orders
           WHERE buyer_id = $1 AND created_at > NOW() - INTERVAL '1 year'`,
          [userId]
        )
        if (buyerResult.rows[0]) {
          metrics.totalSpend = parseFloat(buyerResult.rows[0].total_spend)
          metrics.averageOrderValue = parseFloat(buyerResult.rows[0].avg_order)
          metrics.supplierCount = parseInt(buyerResult.rows[0].supplier_count, 10)
          metrics.pendingInvoices = parseInt(buyerResult.rows[0].pending_invoices, 10)
        }
        break

      case 'seller':
        const sellerResult = await query(
          `SELECT
            COALESCE(SUM(amount), 0) as total_revenue,
            COUNT(*) FILTER (WHERE status = 'pending') as pending_rfqs,
            AVG(response_time_hours) as avg_response_time
           FROM rfq_responses
           WHERE seller_id = $1 AND created_at > NOW() - INTERVAL '1 year'`,
          [userId]
        )
        if (sellerResult.rows[0]) {
          metrics.totalRevenue = parseFloat(sellerResult.rows[0].total_revenue)
          metrics.pendingRfqs = parseInt(sellerResult.rows[0].pending_rfqs || '0', 10)
          metrics.averageResponseTime = parseFloat(sellerResult.rows[0].avg_response_time || '0')
        }
        break

      case 'founder':
        const founderResult = await query(
          `SELECT
            monthly_burn_rate as burn_rate,
            runway_months as runway,
            customer_churn_rate,
            revenue_growth_rate,
            team_size
           FROM company_metrics
           WHERE user_id = $1
           ORDER BY recorded_at DESC
           LIMIT 1`,
          [userId]
        )
        if (founderResult.rows[0]) {
          metrics.burnRate = parseFloat(founderResult.rows[0].burn_rate || '0')
          metrics.runway = parseFloat(founderResult.rows[0].runway || '12')
          metrics.customerChurnRate = parseFloat(founderResult.rows[0].customer_churn_rate || '0')
          metrics.revenueGrowthRate = parseFloat(founderResult.rows[0].revenue_growth_rate || '0')
          metrics.teamSize = parseInt(founderResult.rows[0].team_size || '1', 10)
        }
        break

      case 'job_seeker':
        const jobResult = await query(
          `SELECT
            COUNT(*) FILTER (WHERE status = 'applied') as applications,
            COUNT(*) FILTER (WHERE status = 'interview') as interviews,
            COUNT(*) as matching_jobs
           FROM job_applications
           WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
          [userId]
        )
        if (jobResult.rows[0]) {
          metrics.applicationsSubmitted = parseInt(jobResult.rows[0].applications || '0', 10)
          metrics.interviewsScheduled = parseInt(jobResult.rows[0].interviews || '0', 10)
          metrics.matchingJobs = parseInt(jobResult.rows[0].matching_jobs || '0', 10)
        }

        // Get market salary data
        if (profile?.role && profile?.location) {
          metrics.marketSalaryData = {
            role: profile.role,
            location: profile.location,
            median: 120000, // Would come from salary data API
            percentile25: 100000,
            percentile75: 150000,
          }
        }
        break
    }

    return metrics
  } catch (error) {
    console.error('[InsightGenerator] Error getting user metrics:', error)
    return {}
  }
}

/**
 * Schedule insight for later delivery
 */
async function scheduleInsightDelivery(
  insight: ProactiveInsight,
  delayMinutes: number
): Promise<void> {
  try {
    const scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000)

    await query(
      `INSERT INTO scheduled_deliveries (insight_id, user_id, scheduled_for, status)
       VALUES ($1, $2, $3, 'pending')`,
      [insight.id, insight.userId, scheduledFor]
    )
  } catch (error) {
    console.error('[InsightGenerator] Error scheduling delivery:', error)
  }
}

// ============================================================================
// LEARNING FROM HISTORY
// ============================================================================

/**
 * Analyze insight history to improve future generation
 */
async function learnFromInsightHistory(): Promise<void> {
  try {
    // Analyze which insight types get acted upon most
    const result = await query(
      `SELECT
        category,
        urgency,
        journey,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE acted_upon = true) as acted_upon,
        COUNT(*) FILTER (WHERE dismissed = true) as dismissed,
        AVG(potential_value) as avg_value
       FROM proactive_insights
       WHERE created_at > NOW() - INTERVAL '30 days'
       GROUP BY category, urgency, journey
       ORDER BY COUNT(*) FILTER (WHERE acted_upon = true)::float / NULLIF(COUNT(*), 0) DESC`
    )

    // Store learning data for future optimization
    for (const row of result.rows) {
      const actionRate = row.total > 0 ? row.acted_upon / row.total : 0

      await query(
        `INSERT INTO insight_learning_data (
          category, urgency, journey, total_generated, action_rate, avg_value, recorded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (category, urgency, journey) DO UPDATE SET
          total_generated = insight_learning_data.total_generated + $4,
          action_rate = ($5 + insight_learning_data.action_rate) / 2,
          avg_value = ($6 + insight_learning_data.avg_value) / 2,
          recorded_at = NOW()`,
        [
          row.category,
          row.urgency,
          row.journey,
          row.total,
          actionRate,
          row.avg_value || 0,
        ]
      )
    }

    console.log('[InsightGenerator] Learning data updated')
  } catch (error) {
    console.error('[InsightGenerator] Error in learning from history:', error)
  }
}

/**
 * Get insight effectiveness scores for optimization
 */
export async function getInsightEffectiveness(): Promise<
  Array<{
    category: string
    urgency: string
    journey: string
    actionRate: number
    avgValue: number
  }>
> {
  try {
    const result = await query(
      `SELECT
        category,
        urgency,
        journey,
        action_rate,
        avg_value
       FROM insight_learning_data
       ORDER BY action_rate DESC`
    )

    return result.rows.map((row) => ({
      category: row.category,
      urgency: row.urgency,
      journey: row.journey,
      actionRate: parseFloat(row.action_rate),
      avgValue: parseFloat(row.avg_value),
    }))
  } catch (error) {
    console.error('[InsightGenerator] Error getting effectiveness:', error)
    return []
  }
}

// ============================================================================
// SCHEDULED DELIVERY PROCESSOR
// ============================================================================

/**
 * Process scheduled deliveries that are due
 */
export async function processScheduledDeliveries(): Promise<number> {
  try {
    const result = await query(
      `SELECT sd.*, pi.*
       FROM scheduled_deliveries sd
       JOIN proactive_insights pi ON sd.insight_id = pi.id
       WHERE sd.status = 'pending'
         AND sd.scheduled_for <= NOW()
       ORDER BY sd.scheduled_for ASC
       LIMIT 100`
    )

    let delivered = 0

    for (const row of result.rows) {
      try {
        const insight: ProactiveInsight = {
          id: row.insight_id,
          userId: row.user_id,
          journey: row.journey,
          category: row.category,
          urgency: row.urgency,
          title: row.title,
          message: row.message,
          potentialValue: row.potential_value,
          potentialValueType: row.potential_value_type,
          actionOptions: row.action_options || [],
          createdAt: new Date(row.created_at),
          actedUpon: row.acted_upon,
          dismissed: row.dismissed,
        }

        await deliverInsight(insight)

        await query(
          `UPDATE scheduled_deliveries
           SET status = 'delivered', delivered_at = NOW()
           WHERE insight_id = $1`,
          [row.insight_id]
        )

        delivered += 1
      } catch (error) {
        console.error(`[InsightGenerator] Failed to deliver scheduled insight ${row.insight_id}:`, error)

        await query(
          `UPDATE scheduled_deliveries
           SET status = 'failed', error = $2
           WHERE insight_id = $1`,
          [row.insight_id, String(error)]
        )
      }
    }

    return delivered
  } catch (error) {
    console.error('[InsightGenerator] Error processing scheduled deliveries:', error)
    return 0
  }
}

// ============================================================================
// STATS RECORDING
// ============================================================================

/**
 * Record generator run statistics
 */
async function recordGeneratorStats(stats: GeneratorStats): Promise<void> {
  try {
    await query(
      `INSERT INTO insight_generator_runs (
        run_id, started_at, completed_at, users_processed,
        insights_generated, insights_delivered, errors, duration_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        stats.runId,
        stats.startedAt,
        stats.completedAt,
        stats.usersProcessed,
        stats.insightsGenerated,
        stats.insightsDelivered,
        stats.errors,
        stats.duration,
      ]
    )
  } catch (error) {
    console.error('[InsightGenerator] Error recording stats:', error)
  }
}

/**
 * Get recent generator run statistics
 */
export async function getGeneratorStats(limit: number = 10): Promise<GeneratorStats[]> {
  try {
    const result = await query(
      `SELECT * FROM insight_generator_runs
       ORDER BY started_at DESC
       LIMIT $1`,
      [limit]
    )

    return result.rows.map((row) => ({
      runId: row.run_id,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      usersProcessed: row.users_processed,
      insightsGenerated: row.insights_generated,
      insightsDelivered: row.insights_delivered,
      errors: row.errors,
      duration: row.duration_ms,
    }))
  } catch (error) {
    console.error('[InsightGenerator] Error getting stats:', error)
    return []
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const InsightGenerator = {
  run: runInsightGenerator,
  processScheduledDeliveries,
  getStats: getGeneratorStats,
  getEffectiveness: getInsightEffectiveness,
}

export default InsightGenerator
