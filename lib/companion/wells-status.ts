// @ts-nocheck
/**
 * Wells AI Status System
 *
 * "A worker's appetite works for him; his hunger drives him on." - Proverbs 16:26
 *
 * This module provides the "Wells is working" visibility system that shows
 * users what Wells is actively doing for them. It makes Wells feel alive
 * and always working in the background.
 */

import { query } from '@/lib/db'
import { getWellsWorkingSummary } from './background-worker'

// ============================================================================
// TYPES
// ============================================================================

export interface WellsStatus {
  isWorking: boolean
  statusMessage: string
  currentTasks: WellsTask[]
  recentCompletions: WellsCompletion[]
  stats: WellsStats
  lastHeartbeat: Date
}

export interface WellsTask {
  id: string
  type: 'monitoring' | 'analyzing' | 'tracking' | 'searching' | 'negotiating' | 'matching'
  description: string
  startedAt: Date
  progress?: number // 0-100
  relatedEntity?: {
    type: string
    id: string
    name: string
  }
}

export interface WellsCompletion {
  id: string
  description: string
  result?: string
  completedAt: Date
  value?: number
  valueType?: 'savings' | 'revenue' | 'opportunity'
}

export interface WellsStats {
  rfqsMonitoring: number
  jobsTracking: number
  vendorsAnalyzing: number
  dealsNegotiating: number
  pendingInsights: number
  totalPotentialValue: number
  valueDeliveredThisMonth: number
}

// ============================================================================
// STATUS GENERATION
// ============================================================================

/**
 * Get comprehensive Wells status for a user
 */
export async function getWellsStatus(userId: string): Promise<WellsStatus> {
  const summary = await getWellsWorkingSummary(userId)

  // Get detailed tasks
  const tasksResult = await query(
    `SELECT * FROM wells_activity_log
     WHERE user_id = $1 AND status = 'in_progress'
     ORDER BY started_at DESC
     LIMIT 5`,
    [userId]
  )

  const currentTasks: WellsTask[] = tasksResult.rows.map((row: any) => ({
    id: row.id,
    type: row.action_type,
    description: row.description,
    startedAt: new Date(row.started_at),
    relatedEntity: row.related_entity_type
      ? {
          type: row.related_entity_type,
          id: row.related_entity_id,
          name: row.metadata?.name || row.related_entity_id,
        }
      : undefined,
  }))

  // Get recent completions
  const completionsResult = await query(
    `SELECT * FROM wells_activity_log
     WHERE user_id = $1
       AND status = 'completed'
       AND completed_at > NOW() - INTERVAL '24 hours'
     ORDER BY completed_at DESC
     LIMIT 5`,
    [userId]
  )

  const recentCompletions: WellsCompletion[] = completionsResult.rows.map((row: any) => ({
    id: row.id,
    description: row.description,
    result: row.metadata?.result,
    completedAt: new Date(row.completed_at),
    value: row.metadata?.value,
    valueType: row.metadata?.valueType,
  }))

  // Get stats
  const statsResult = await query(
    `SELECT
      (SELECT COUNT(*) FROM rfqs WHERE buyer_id = $1 AND status IN ('open', 'quoting', 'negotiating')) as rfqs_monitoring,
      (SELECT COUNT(*) FROM marketplace_applications WHERE worker_id IN (SELECT id FROM marketplace_workers WHERE user_id = $1) AND status IN ('pending', 'shortlisted', 'interviewing')) as jobs_tracking,
      (SELECT COUNT(DISTINCT supplier_id) FROM orders WHERE buyer_id = $1 AND created_at > NOW() - INTERVAL '90 days') as vendors_analyzing,
      (SELECT COUNT(*) FROM negotiations WHERE buyer_id = $1 AND status = 'active') as deals_negotiating,
      (SELECT COUNT(*) FROM wells_insights WHERE user_id = $1 AND acted_on = false AND dismissed = false) as pending_insights,
      (SELECT COALESCE(SUM(potential_value), 0) FROM wells_insights WHERE user_id = $1 AND acted_on = false AND dismissed = false) as total_potential_value,
      (SELECT COALESCE(SUM(CASE WHEN potential_value_type = 'savings' THEN potential_value ELSE 0 END), 0)
       FROM proactive_insights
       WHERE user_id = $1 AND acted_upon = true AND acted_upon_at > NOW() - INTERVAL '30 days') as value_delivered`,
    [userId]
  )

  const stats = statsResult.rows[0] || {}

  // Generate status message
  const statusMessage = generateStatusMessage(summary, currentTasks, stats)

  return {
    isWorking: summary.isWorking || currentTasks.length > 0,
    statusMessage,
    currentTasks,
    recentCompletions,
    stats: {
      rfqsMonitoring: parseInt(stats.rfqs_monitoring) || 0,
      jobsTracking: parseInt(stats.jobs_tracking) || 0,
      vendorsAnalyzing: parseInt(stats.vendors_analyzing) || 0,
      dealsNegotiating: parseInt(stats.deals_negotiating) || 0,
      pendingInsights: parseInt(stats.pending_insights) || 0,
      totalPotentialValue: parseFloat(stats.total_potential_value) || 0,
      valueDeliveredThisMonth: parseFloat(stats.value_delivered) || 0,
    },
    lastHeartbeat: new Date(),
  }
}

/**
 * Generate a human-readable status message
 */
function generateStatusMessage(
  summary: Awaited<ReturnType<typeof getWellsWorkingSummary>>,
  currentTasks: WellsTask[],
  stats: any
): string {
  const activities: string[] = []

  // Active monitoring
  if (parseInt(stats.rfqs_monitoring) > 0) {
    activities.push(`monitoring ${stats.rfqs_monitoring} active RFQ${parseInt(stats.rfqs_monitoring) > 1 ? 's' : ''} for better prices`)
  }

  if (parseInt(stats.jobs_tracking) > 0) {
    activities.push(`tracking ${stats.jobs_tracking} job application${parseInt(stats.jobs_tracking) > 1 ? 's' : ''} for updates`)
  }

  if (parseInt(stats.deals_negotiating) > 0) {
    activities.push(`actively negotiating ${stats.deals_negotiating} deal${parseInt(stats.deals_negotiating) > 1 ? 's' : ''}`)
  }

  // Current tasks
  if (currentTasks.length > 0) {
    const taskTypes = [...new Set(currentTasks.map(t => t.type))]
    if (taskTypes.includes('analyzing')) {
      activities.push('analyzing your recent activity')
    }
    if (taskTypes.includes('searching')) {
      activities.push('searching for opportunities')
    }
  }

  // Pending insights
  const pendingInsights = parseInt(stats.pending_insights) || 0
  const totalValue = parseFloat(stats.total_potential_value) || 0

  if (pendingInsights > 0 && totalValue > 0) {
    activities.push(`found $${totalValue.toLocaleString()} in potential opportunities`)
  } else if (pendingInsights > 0) {
    activities.push(`found ${pendingInsights} insight${pendingInsights > 1 ? 's' : ''} for you`)
  }

  // Build the message
  if (activities.length === 0) {
    return "I'm here and ready to help. Everything looks good right now."
  }

  if (activities.length === 1) {
    return `I'm ${activities[0]}.`
  }

  const lastActivity = activities.pop()
  return `I'm ${activities.join(', ')}, and ${lastActivity}.`
}

/**
 * Get animated task descriptions for UI
 */
export function getAnimatedTaskDescriptions(): string[] {
  return [
    'Analyzing spending patterns...',
    'Checking market prices...',
    'Monitoring your RFQs...',
    'Looking for savings opportunities...',
    'Tracking vendor performance...',
    'Scanning for price changes...',
    'Reviewing contract terms...',
    'Matching job opportunities...',
    'Checking application statuses...',
    'Identifying cost savings...',
  ]
}

/**
 * Format a task for display
 */
export function formatTaskForDisplay(task: WellsTask): {
  icon: string
  title: string
  subtitle: string
  color: string
} {
  const typeConfig: Record<string, { icon: string; color: string }> = {
    monitoring: { icon: 'eye', color: 'blue' },
    analyzing: { icon: 'chart-bar', color: 'purple' },
    tracking: { icon: 'location-arrow', color: 'green' },
    searching: { icon: 'search', color: 'orange' },
    negotiating: { icon: 'handshake', color: 'indigo' },
    matching: { icon: 'puzzle-piece', color: 'pink' },
  }

  const config = typeConfig[task.type] || { icon: 'cog', color: 'gray' }

  return {
    icon: config.icon,
    title: task.description,
    subtitle: task.relatedEntity
      ? `${task.relatedEntity.type}: ${task.relatedEntity.name}`
      : `Started ${formatTimeAgo(task.startedAt)}`,
    color: config.color,
  }
}

/**
 * Format time ago for display
 */
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

/**
 * Get Wells pulse status (for animated indicator)
 */
export function getWellsPulse(status: WellsStatus): {
  pulseSpeed: 'fast' | 'normal' | 'slow' | 'none'
  glowColor: string
  intensity: number
} {
  if (status.stats.dealsNegotiating > 0) {
    // Actively negotiating - fast pulse
    return { pulseSpeed: 'fast', glowColor: '#10b981', intensity: 100 }
  }

  if (status.currentTasks.length > 0) {
    // Working on tasks - normal pulse
    return { pulseSpeed: 'normal', glowColor: '#3b82f6', intensity: 80 }
  }

  if (status.stats.rfqsMonitoring > 0 || status.stats.jobsTracking > 0) {
    // Background monitoring - slow pulse
    return { pulseSpeed: 'slow', glowColor: '#6366f1', intensity: 50 }
  }

  // Idle but ready
  return { pulseSpeed: 'none', glowColor: '#9ca3af', intensity: 20 }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const WellsStatusService = {
  getStatus: getWellsStatus,
  getAnimatedDescriptions: getAnimatedTaskDescriptions,
  formatTask: formatTaskForDisplay,
  getPulse: getWellsPulse,
}

export default WellsStatusService
