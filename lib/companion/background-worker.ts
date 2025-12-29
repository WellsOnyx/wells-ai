// @ts-nocheck
/**
 * Wells AI Background Worker
 *
 * "The plans of the diligent lead surely to abundance,
 *  but everyone who is hasty comes only to poverty." - Proverbs 21:5
 *
 * This worker runs in the background to:
 * 1. Generate proactive insights for users hourly
 * 2. Track market prices and vendor changes
 * 3. Monitor RFQs and job applications
 * 4. Keep Wells feeling "alive" and working for users
 */

import { query } from '@/lib/db'
import { InsightEngineService } from './insight-engine-service'
import { getWellsMemory } from '@/lib/wells-memory'

// ============================================================================
// TYPES
// ============================================================================

export interface WorkerStatus {
  isRunning: boolean
  lastRunAt: Date | null
  nextRunAt: Date | null
  usersProcessed: number
  insightsGenerated: number
  errorsCount: number
  currentActivity: string[]
}

export interface UserProcessingResult {
  userId: string
  insightsGenerated: number
  activitiesTracked: number
  errors: string[]
}

export interface ActivityLogEntry {
  id: string
  userId: string
  actionType: 'monitoring' | 'analyzing' | 'tracking' | 'searching' | 'negotiating' | 'matching'
  description: string
  relatedEntityType?: string
  relatedEntityId?: string
  metadata?: Record<string, any>
  startedAt: Date
  completedAt?: Date
  status: 'in_progress' | 'completed' | 'failed'
}

// ============================================================================
// WORKER STATE
// ============================================================================

let workerStatus: WorkerStatus = {
  isRunning: false,
  lastRunAt: null,
  nextRunAt: null,
  usersProcessed: 0,
  insightsGenerated: 0,
  errorsCount: 0,
  currentActivity: [],
}

// ============================================================================
// ACTIVITY TRACKING
// ============================================================================

/**
 * Log a Wells activity to the database
 */
export async function logActivity(
  userId: string,
  actionType: ActivityLogEntry['actionType'],
  description: string,
  options?: {
    relatedEntityType?: string
    relatedEntityId?: string
    metadata?: Record<string, any>
  }
): Promise<string> {
  const activityId = `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    await query(
      `INSERT INTO wells_activity_log (
        id, user_id, action_type, description,
        related_entity_type, related_entity_id, metadata,
        started_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 'in_progress')`,
      [
        activityId,
        userId,
        actionType,
        description,
        options?.relatedEntityType || null,
        options?.relatedEntityId || null,
        JSON.stringify(options?.metadata || {}),
      ]
    )

    return activityId
  } catch (error) {
    console.error('[BackgroundWorker] Error logging activity:', error)
    return activityId
  }
}

/**
 * Complete an activity log entry
 */
export async function completeActivity(
  activityId: string,
  status: 'completed' | 'failed' = 'completed'
): Promise<void> {
  try {
    await query(
      `UPDATE wells_activity_log
       SET status = $2, completed_at = NOW()
       WHERE id = $1`,
      [activityId, status]
    )
  } catch (error) {
    console.error('[BackgroundWorker] Error completing activity:', error)
  }
}

/**
 * Get current Wells activity for a user
 */
export async function getWellsActivity(userId: string): Promise<ActivityLogEntry[]> {
  try {
    const result = await query(
      `SELECT * FROM wells_activity_log
       WHERE user_id = $1
         AND (status = 'in_progress' OR completed_at > NOW() - INTERVAL '24 hours')
       ORDER BY started_at DESC
       LIMIT 50`,
      [userId]
    )

    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      actionType: row.action_type,
      description: row.description,
      relatedEntityType: row.related_entity_type,
      relatedEntityId: row.related_entity_id,
      metadata: row.metadata,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      status: row.status,
    }))
  } catch (error) {
    console.error('[BackgroundWorker] Error getting Wells activity:', error)
    return []
  }
}

/**
 * Get "Wells is working" summary for a user
 */
export async function getWellsWorkingSummary(userId: string): Promise<{
  isWorking: boolean
  currentTasks: string[]
  recentCompletions: string[]
  stats: {
    rfqsMonitoring: number
    jobsTracking: number
    vendorsAnalyzing: number
    dealsNegotiating: number
  }
}> {
  try {
    // Get in-progress activities
    const inProgressResult = await query(
      `SELECT description, action_type FROM wells_activity_log
       WHERE user_id = $1 AND status = 'in_progress'
       ORDER BY started_at DESC
       LIMIT 5`,
      [userId]
    )

    // Get recent completions
    const completedResult = await query(
      `SELECT description FROM wells_activity_log
       WHERE user_id = $1
         AND status = 'completed'
         AND completed_at > NOW() - INTERVAL '1 hour'
       ORDER BY completed_at DESC
       LIMIT 5`,
      [userId]
    )

    // Get monitoring stats
    const statsResult = await query(
      `SELECT
        (SELECT COUNT(*) FROM rfqs WHERE buyer_id = $1 AND status IN ('open', 'quoting', 'negotiating')) as rfqs_monitoring,
        (SELECT COUNT(*) FROM marketplace_applications WHERE worker_id IN (SELECT id FROM marketplace_workers WHERE user_id = $1) AND status IN ('pending', 'shortlisted', 'interviewing')) as jobs_tracking,
        (SELECT COUNT(DISTINCT supplier_id) FROM orders WHERE buyer_id = $1 AND created_at > NOW() - INTERVAL '90 days') as vendors_analyzing,
        (SELECT COUNT(*) FROM negotiations WHERE buyer_id = $1 AND status = 'active') as deals_negotiating`,
      [userId]
    )

    const stats = statsResult.rows[0] || {
      rfqs_monitoring: 0,
      jobs_tracking: 0,
      vendors_analyzing: 0,
      deals_negotiating: 0,
    }

    const currentTasks = inProgressResult.rows.map((r: any) => r.description)
    const recentCompletions = completedResult.rows.map((r: any) => r.description)

    // Generate friendly summaries
    const friendlyTasks: string[] = []

    if (parseInt(stats.rfqs_monitoring) > 0) {
      friendlyTasks.push(`Monitoring ${stats.rfqs_monitoring} active RFQ${parseInt(stats.rfqs_monitoring) > 1 ? 's' : ''} for better prices`)
    }
    if (parseInt(stats.jobs_tracking) > 0) {
      friendlyTasks.push(`Tracking ${stats.jobs_tracking} job application${parseInt(stats.jobs_tracking) > 1 ? 's' : ''} for you`)
    }
    if (parseInt(stats.deals_negotiating) > 0) {
      friendlyTasks.push(`Negotiating ${stats.deals_negotiating} active deal${parseInt(stats.deals_negotiating) > 1 ? 's' : ''}`)
    }
    if (parseInt(stats.vendors_analyzing) > 0) {
      friendlyTasks.push(`Analyzing spending patterns across ${stats.vendors_analyzing} vendor${parseInt(stats.vendors_analyzing) > 1 ? 's' : ''}`)
    }

    return {
      isWorking: currentTasks.length > 0 || friendlyTasks.length > 0,
      currentTasks: [...currentTasks, ...friendlyTasks].slice(0, 5),
      recentCompletions,
      stats: {
        rfqsMonitoring: parseInt(stats.rfqs_monitoring) || 0,
        jobsTracking: parseInt(stats.jobs_tracking) || 0,
        vendorsAnalyzing: parseInt(stats.vendors_analyzing) || 0,
        dealsNegotiating: parseInt(stats.deals_negotiating) || 0,
      },
    }
  } catch (error) {
    console.error('[BackgroundWorker] Error getting Wells working summary:', error)
    return {
      isWorking: false,
      currentTasks: [],
      recentCompletions: [],
      stats: {
        rfqsMonitoring: 0,
        jobsTracking: 0,
        vendorsAnalyzing: 0,
        dealsNegotiating: 0,
      },
    }
  }
}

// ============================================================================
// USER PROCESSING
// ============================================================================

/**
 * Process a single user - generate insights and track activity
 */
async function processUser(userId: string): Promise<UserProcessingResult> {
  const result: UserProcessingResult = {
    userId,
    insightsGenerated: 0,
    activitiesTracked: 0,
    errors: [],
  }

  try {
    // Create insight engine instance for this user
    const engine = new InsightEngineService(userId)

    // Get user memory for context
    const memory = await getWellsMemory(userId)
    const journey = memory?.wellsaiProfile?.primaryJourney || 'buyer'

    // Log that we're processing this user
    const activityId = await logActivity(
      userId,
      'analyzing',
      `Analyzing ${journey} activity and generating insights`
    )

    // Generate all insight types based on journey
    const insights = await engine.generateInsights()

    // Store insights in database
    for (const insight of insights) {
      try {
        await query(
          `INSERT INTO wells_insights (
            id, user_id, type, priority, title, summary, details,
            actionable, suggested_action, potential_value, expires_at, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
          ON CONFLICT (id) DO NOTHING`,
          [
            insight.id,
            insight.userId,
            insight.type,
            insight.priority,
            insight.title,
            insight.summary,
            insight.details,
            insight.actionable,
            insight.suggestedAction || null,
            insight.potentialValue || null,
            insight.expiresAt || null,
          ]
        )
        result.insightsGenerated++
      } catch (error) {
        result.errors.push(`Failed to store insight ${insight.id}: ${error}`)
      }
    }

    // Track job applications if user is a job seeker
    if (journey === 'job_seeker') {
      const jobActivityId = await logActivity(
        userId,
        'tracking',
        'Checking status of your job applications'
      )

      try {
        const updates = await engine.trackApplicationStatus()
        result.activitiesTracked += updates.length
        await completeActivity(jobActivityId, 'completed')
      } catch (error) {
        result.errors.push(`Job tracking error: ${error}`)
        await completeActivity(jobActivityId, 'failed')
      }
    }

    // Track RFQs if user is a buyer
    if (journey === 'buyer') {
      const rfqActivityId = await logActivity(
        userId,
        'monitoring',
        'Monitoring your RFQs for price changes and new quotes'
      )

      try {
        const marketInsights = await engine.trackMarketPrices()
        result.activitiesTracked += marketInsights.length
        await completeActivity(rfqActivityId, 'completed')
      } catch (error) {
        result.errors.push(`RFQ monitoring error: ${error}`)
        await completeActivity(rfqActivityId, 'failed')
      }
    }

    await completeActivity(activityId, 'completed')

  } catch (error) {
    result.errors.push(`User processing error: ${error}`)
  }

  return result
}

/**
 * Get users that need processing
 */
async function getUsersToProcess(): Promise<string[]> {
  try {
    // Get users who have logged in recently and haven't been processed in the last hour
    const result = await query(
      `SELECT DISTINCT u.user_id
       FROM user_sessions u
       LEFT JOIN (
         SELECT user_id, MAX(started_at) as last_processed
         FROM wells_activity_log
         WHERE action_type = 'analyzing'
         GROUP BY user_id
       ) a ON u.user_id = a.user_id
       WHERE u.last_activity > NOW() - INTERVAL '7 days'
         AND (a.last_processed IS NULL OR a.last_processed < NOW() - INTERVAL '1 hour')
       ORDER BY u.last_activity DESC
       LIMIT 100`
    )

    return result.rows.map((r: any) => r.user_id)
  } catch (error) {
    console.error('[BackgroundWorker] Error getting users to process:', error)
    return []
  }
}

// ============================================================================
// MAIN WORKER FUNCTIONS
// ============================================================================

/**
 * Run the background worker for all users
 */
export async function runBackgroundWorker(): Promise<{
  success: boolean
  usersProcessed: number
  insightsGenerated: number
  errors: string[]
}> {
  if (workerStatus.isRunning) {
    return {
      success: false,
      usersProcessed: 0,
      insightsGenerated: 0,
      errors: ['Worker is already running'],
    }
  }

  workerStatus.isRunning = true
  workerStatus.currentActivity = ['Starting background processing']

  const runId = `run_${Date.now()}`
  const startTime = Date.now()
  const errors: string[] = []
  let totalInsights = 0
  let usersProcessed = 0

  try {
    // Record run start
    await query(
      `INSERT INTO insight_generator_runs (run_id, started_at)
       VALUES ($1, NOW())
       ON CONFLICT (run_id) DO NOTHING`,
      [runId]
    )

    // Get users to process
    const userIds = await getUsersToProcess()
    workerStatus.currentActivity = [`Processing ${userIds.length} users`]

    // Process each user
    for (const userId of userIds) {
      try {
        const result = await processUser(userId)
        totalInsights += result.insightsGenerated
        usersProcessed++

        if (result.errors.length > 0) {
          errors.push(...result.errors)
        }
      } catch (error) {
        errors.push(`Failed to process user ${userId}: ${error}`)
      }
    }

    // Record run completion
    const duration = Date.now() - startTime
    await query(
      `UPDATE insight_generator_runs
       SET completed_at = NOW(),
           users_processed = $2,
           insights_generated = $3,
           errors = $4,
           duration_ms = $5
       WHERE run_id = $1`,
      [runId, usersProcessed, totalInsights, errors.length, duration]
    )

    // Update worker status
    workerStatus.lastRunAt = new Date()
    workerStatus.nextRunAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
    workerStatus.usersProcessed = usersProcessed
    workerStatus.insightsGenerated = totalInsights
    workerStatus.errorsCount = errors.length
    workerStatus.currentActivity = []

    console.log(`[BackgroundWorker] Completed: ${usersProcessed} users, ${totalInsights} insights, ${errors.length} errors`)

    return {
      success: true,
      usersProcessed,
      insightsGenerated: totalInsights,
      errors,
    }
  } catch (error) {
    console.error('[BackgroundWorker] Fatal error:', error)
    errors.push(`Fatal error: ${error}`)

    return {
      success: false,
      usersProcessed,
      insightsGenerated: totalInsights,
      errors,
    }
  } finally {
    workerStatus.isRunning = false
  }
}

/**
 * Run worker for a specific user (on-demand)
 */
export async function runForUser(userId: string): Promise<UserProcessingResult> {
  return processUser(userId)
}

/**
 * Get current worker status
 */
export function getWorkerStatus(): WorkerStatus {
  return { ...workerStatus }
}

/**
 * Schedule the worker to run hourly
 * This is called once at startup and sets up the interval
 */
let workerInterval: NodeJS.Timeout | null = null

export function startWorkerSchedule(): void {
  if (workerInterval) {
    console.log('[BackgroundWorker] Worker already scheduled')
    return
  }

  console.log('[BackgroundWorker] Starting hourly schedule')

  // Run immediately on startup
  runBackgroundWorker()

  // Then run every hour
  workerInterval = setInterval(() => {
    runBackgroundWorker()
  }, 60 * 60 * 1000) // 1 hour
}

export function stopWorkerSchedule(): void {
  if (workerInterval) {
    clearInterval(workerInterval)
    workerInterval = null
    console.log('[BackgroundWorker] Worker schedule stopped')
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const BackgroundWorker = {
  run: runBackgroundWorker,
  runForUser,
  getStatus: getWorkerStatus,
  startSchedule: startWorkerSchedule,
  stopSchedule: stopWorkerSchedule,
  logActivity,
  completeActivity,
  getActivity: getWellsActivity,
  getWorkingSummary: getWellsWorkingSummary,
}

export default BackgroundWorker
