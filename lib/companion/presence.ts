// @ts-nocheck
/**
 * Wells AI Persistent Companion Presence
 *
 * "The Lord your God is with you wherever you go." - Joshua 1:9
 *
 * Wells is always there - always scanning,
 * always analyzing, always working for you. Even when you're not
 * actively chatting, Wells is present and aware.
 */

import { query } from '@/lib/db'
import { getWellsMemory } from '@/lib/wells-memory'

// ============================================================================
// TYPES
// ============================================================================

export interface CompanionPresence {
  userId: string
  isOnline: boolean
  lastSeen: Date
  currentActivity: CompanionActivity
  pendingInsights: number
  backgroundWork: BackgroundWorkItem[]
  ambientStatus: AmbientStatus
  heartbeat: Date
  sessionStart?: Date
  totalTimeToday: number // minutes
}

export interface CompanionActivity {
  type: ActivityType
  description: string
  progress?: number // 0-100
  startedAt: Date
  targetEntity?: {
    type: string
    id: string
    name: string
  }
  estimatedCompletion?: Date
}

export type ActivityType =
  | 'idle' // Ready and waiting
  | 'scanning' // Scanning for opportunities
  | 'analyzing' // Analyzing data
  | 'monitoring' // Watching something specific
  | 'negotiating' // Active negotiation
  | 'searching' // Searching for matches
  | 'learning' // Learning user preferences
  | 'protecting' // Watching for risks
  | 'celebrating' // Acknowledging a win

export interface BackgroundWorkItem {
  id: string
  type: BackgroundWorkType
  description: string
  status: 'active' | 'paused' | 'completed'
  progress?: number
  startedAt: Date
  completedAt?: Date
  value?: number
  valueType?: 'savings' | 'revenue' | 'time' | 'risk'
}

export type BackgroundWorkType =
  | 'contract_monitoring'
  | 'price_tracking'
  | 'rfq_watching'
  | 'job_matching'
  | 'supplier_analysis'
  | 'risk_scanning'
  | 'opportunity_hunting'
  | 'relationship_nurturing'

export interface AmbientStatus {
  message: string
  icon: string
  color: string
  pulse: boolean
  updatedAt: Date
}

// ============================================================================
// AMBIENT STATUS MESSAGES
// ============================================================================

const AMBIENT_MESSAGES = {
  idle: [
    "Ready and watching over your operations",
    "Here when you need me",
    "Monitoring your accounts quietly",
    "Standing by, scanning for opportunities",
    "All systems nominal. Ready to assist",
  ],
  scanning: [
    "Scanning marketplace for opportunities...",
    "Looking for cost savings...",
    "Checking market conditions...",
    "Searching for better suppliers...",
    "Hunting for deals that match your needs...",
  ],
  analyzing: [
    "Analyzing your recent transactions...",
    "Crunching the numbers on your suppliers...",
    "Processing spending patterns...",
    "Studying market trends...",
    "Evaluating vendor performance...",
  ],
  monitoring: [
    "Watching {count} active RFQs for updates",
    "Monitoring {count} contracts for renewal dates",
    "Tracking prices on your key categories",
    "Keeping an eye on {name}",
    "Watching your deal with {name}",
  ],
  negotiating: [
    "Actively negotiating with {name}",
    "Working on getting you better terms...",
    "In discussions with {count} suppliers",
    "Fighting for every dollar on your behalf",
    "Pushing for better pricing...",
  ],
  searching: [
    "Searching for {type} matches...",
    "Looking for candidates that fit your needs",
    "Scouring the marketplace for you...",
    "Finding the perfect match...",
  ],
  protecting: [
    "Watching for unusual activity...",
    "Monitoring for risks to your operations",
    "Keeping your interests protected",
    "Scanning for potential issues...",
    "Guarding against fraud and errors",
  ],
  celebrating: [
    "That was a great win!",
    "We did it together!",
    "Another successful deal in the books",
    "Celebrating your success!",
  ],
  learning: [
    "Learning your preferences...",
    "Getting to know your business better",
    "Adapting to your communication style",
    "Building a better understanding of your needs",
  ],
}

const VALUE_MESSAGES = {
  saved: [
    "Saved you ${value} while you were away",
    "Found ${value} in savings opportunities",
    "Protected ${value} from overspending",
  ],
  earned: [
    "Helped you earn ${value} this week",
    "Generated ${value} in new revenue",
    "Found ${value} in opportunities",
  ],
  time: [
    "Saved you {hours} hours this week",
    "Automated {hours} hours of work",
  ],
  risk: [
    "Prevented ${value} in potential losses",
    "Protected you from ${value} in risks",
  ],
}

// ============================================================================
// PRESENCE MANAGEMENT
// ============================================================================

/**
 * Get or create presence for a user
 */
export async function getPresence(userId: string): Promise<CompanionPresence> {
  try {
    // Get current presence from database
    const result = await query(
      `SELECT * FROM companion_presence WHERE user_id = $1`,
      [userId]
    )

    if (result.rows.length > 0) {
      const row = result.rows[0]
      return rowToPresence(row)
    }

    // Create new presence
    return await initializePresence(userId)
  } catch (error) {
    console.error('[CompanionPresence] Error getting presence:', error)
    return getDefaultPresence(userId)
  }
}

/**
 * Initialize presence for a new user
 */
async function initializePresence(userId: string): Promise<CompanionPresence> {
  const now = new Date()
  const presence = getDefaultPresence(userId)

  try {
    await query(
      `INSERT INTO companion_presence (
        user_id, is_online, last_seen, current_activity, pending_insights,
        background_work, ambient_status, heartbeat, session_start, total_time_today
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (user_id) DO UPDATE SET
        heartbeat = $8`,
      [
        userId,
        presence.isOnline,
        now,
        JSON.stringify(presence.currentActivity),
        presence.pendingInsights,
        JSON.stringify(presence.backgroundWork),
        JSON.stringify(presence.ambientStatus),
        now,
        null,
        0,
      ]
    )
  } catch (error) {
    console.error('[CompanionPresence] Error initializing presence:', error)
  }

  return presence
}

/**
 * Update presence heartbeat (called on each interaction)
 */
export async function updateHeartbeat(userId: string): Promise<void> {
  const now = new Date()

  try {
    await query(
      `UPDATE companion_presence
       SET heartbeat = $2,
           is_online = true,
           last_seen = $2
       WHERE user_id = $1`,
      [userId, now]
    )
  } catch (error) {
    console.error('[CompanionPresence] Error updating heartbeat:', error)
  }
}

/**
 * Start a new session
 */
export async function startSession(userId: string): Promise<void> {
  const now = new Date()

  try {
    await query(
      `UPDATE companion_presence
       SET is_online = true,
           session_start = $2,
           heartbeat = $2,
           last_seen = $2
       WHERE user_id = $1`,
      [userId, now]
    )
  } catch (error) {
    console.error('[CompanionPresence] Error starting session:', error)
  }
}

/**
 * End session and calculate time
 */
export async function endSession(userId: string): Promise<void> {
  const now = new Date()

  try {
    await query(
      `UPDATE companion_presence
       SET is_online = false,
           last_seen = $2,
           total_time_today = total_time_today + EXTRACT(EPOCH FROM ($2 - COALESCE(session_start, $2))) / 60,
           session_start = NULL
       WHERE user_id = $1`,
      [userId, now]
    )
  } catch (error) {
    console.error('[CompanionPresence] Error ending session:', error)
  }
}

/**
 * Set current activity
 */
export async function setActivity(
  userId: string,
  activity: Omit<CompanionActivity, 'startedAt'>
): Promise<void> {
  const fullActivity: CompanionActivity = {
    ...activity,
    startedAt: new Date(),
  }

  try {
    await query(
      `UPDATE companion_presence
       SET current_activity = $2,
           heartbeat = NOW()
       WHERE user_id = $1`,
      [userId, JSON.stringify(fullActivity)]
    )

    // Log activity for history
    await logActivityHistory(userId, fullActivity)
  } catch (error) {
    console.error('[CompanionPresence] Error setting activity:', error)
  }
}

/**
 * Add background work item
 */
export async function addBackgroundWork(
  userId: string,
  work: Omit<BackgroundWorkItem, 'id' | 'startedAt' | 'status'>
): Promise<string> {
  const workId = `work_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const fullWork: BackgroundWorkItem = {
    ...work,
    id: workId,
    status: 'active',
    startedAt: new Date(),
  }

  try {
    await query(
      `UPDATE companion_presence
       SET background_work = background_work || $2::jsonb
       WHERE user_id = $1`,
      [userId, JSON.stringify([fullWork])]
    )

    return workId
  } catch (error) {
    console.error('[CompanionPresence] Error adding background work:', error)
    return workId
  }
}

/**
 * Complete background work item
 */
export async function completeBackgroundWork(
  userId: string,
  workId: string,
  result?: { value?: number; valueType?: string }
): Promise<void> {
  try {
    const presence = await getPresence(userId)
    const updatedWork = presence.backgroundWork.map((w) =>
      w.id === workId
        ? {
            ...w,
            status: 'completed' as const,
            completedAt: new Date(),
            value: result?.value || w.value,
            valueType: result?.valueType || w.valueType,
          }
        : w
    )

    await query(
      `UPDATE companion_presence
       SET background_work = $2
       WHERE user_id = $1`,
      [userId, JSON.stringify(updatedWork)]
    )
  } catch (error) {
    console.error('[CompanionPresence] Error completing background work:', error)
  }
}

/**
 * Update ambient status
 */
export async function updateAmbientStatus(
  userId: string,
  status: Partial<AmbientStatus>
): Promise<void> {
  try {
    const presence = await getPresence(userId)
    const updatedStatus: AmbientStatus = {
      ...presence.ambientStatus,
      ...status,
      updatedAt: new Date(),
    }

    await query(
      `UPDATE companion_presence
       SET ambient_status = $2
       WHERE user_id = $1`,
      [userId, JSON.stringify(updatedStatus)]
    )
  } catch (error) {
    console.error('[CompanionPresence] Error updating ambient status:', error)
  }
}

/**
 * Get what Wells has been working on (for "welcome back" messages)
 */
export async function getWorkSummary(userId: string): Promise<{
  completedWork: BackgroundWorkItem[]
  activeWork: BackgroundWorkItem[]
  totalValueDelivered: number
  timeSinceLastSeen: number // hours
  highlights: string[]
}> {
  try {
    const presence = await getPresence(userId)
    const now = new Date()
    const timeSinceLastSeen = (now.getTime() - presence.lastSeen.getTime()) / (1000 * 60 * 60)

    const completedWork = presence.backgroundWork.filter((w) => w.status === 'completed')
    const activeWork = presence.backgroundWork.filter((w) => w.status === 'active')

    const totalValueDelivered = completedWork.reduce((sum, w) => sum + (w.value || 0), 0)

    // Generate highlights
    const highlights: string[] = []

    // Recent completions
    const recentCompletions = completedWork.filter(
      (w) => w.completedAt && now.getTime() - w.completedAt.getTime() < 24 * 60 * 60 * 1000
    )

    if (recentCompletions.length > 0) {
      highlights.push(`Completed ${recentCompletions.length} tasks while you were away`)
    }

    // Value delivered
    if (totalValueDelivered > 0) {
      highlights.push(`Found $${totalValueDelivered.toLocaleString()} in value for you`)
    }

    // Active monitoring
    if (activeWork.length > 0) {
      highlights.push(`Currently working on ${activeWork.length} items`)
    }

    // Pending insights
    if (presence.pendingInsights > 0) {
      highlights.push(`Have ${presence.pendingInsights} insights ready for you`)
    }

    return {
      completedWork,
      activeWork,
      totalValueDelivered,
      timeSinceLastSeen,
      highlights,
    }
  } catch (error) {
    console.error('[CompanionPresence] Error getting work summary:', error)
    return {
      completedWork: [],
      activeWork: [],
      totalValueDelivered: 0,
      timeSinceLastSeen: 0,
      highlights: [],
    }
  }
}

/**
 * Generate contextual ambient message
 */
export async function generateAmbientMessage(userId: string): Promise<AmbientStatus> {
  try {
    const presence = await getPresence(userId)
    const memory = await getWellsMemory(userId)

    // Determine activity type
    const activityType = presence.currentActivity.type || 'idle'
    const messages = AMBIENT_MESSAGES[activityType] || AMBIENT_MESSAGES.idle

    // Get context for message templating
    let message = messages[Math.floor(Math.random() * messages.length)]

    // Replace template variables
    const backgroundWorkCounts = {
      rfqs: presence.backgroundWork.filter((w) => w.type === 'rfq_watching').length,
      contracts: presence.backgroundWork.filter((w) => w.type === 'contract_monitoring').length,
      suppliers: presence.backgroundWork.filter((w) => w.type === 'supplier_analysis').length,
    }

    message = message
      .replace('{count}', String(backgroundWorkCounts.rfqs || backgroundWorkCounts.contracts || '0'))
      .replace('{name}', presence.currentActivity.targetEntity?.name || 'your operations')
      .replace('{type}', memory?.wellsaiProfile?.primaryJourney || 'business')

    // Determine visual style based on activity
    const styleMap: Record<ActivityType, { icon: string; color: string; pulse: boolean }> = {
      idle: { icon: 'shield-check', color: '#6366f1', pulse: false },
      scanning: { icon: 'radar', color: '#3b82f6', pulse: true },
      analyzing: { icon: 'chart-bar', color: '#8b5cf6', pulse: true },
      monitoring: { icon: 'eye', color: '#06b6d4', pulse: true },
      negotiating: { icon: 'handshake', color: '#f59e0b', pulse: true },
      searching: { icon: 'search', color: '#10b981', pulse: true },
      learning: { icon: 'brain', color: '#ec4899', pulse: true },
      protecting: { icon: 'shield', color: '#ef4444', pulse: true },
      celebrating: { icon: 'sparkles', color: '#fbbf24', pulse: false },
    }

    const style = styleMap[activityType] || styleMap.idle

    return {
      message,
      icon: style.icon,
      color: style.color,
      pulse: style.pulse,
      updatedAt: new Date(),
    }
  } catch (error) {
    console.error('[CompanionPresence] Error generating ambient message:', error)
    return {
      message: "I'm here when you need me",
      icon: 'shield-check',
      color: '#6366f1',
      pulse: false,
      updatedAt: new Date(),
    }
  }
}

/**
 * Get real-time presence for dashboard widget
 */
export async function getPresenceForWidget(userId: string): Promise<{
  status: AmbientStatus
  stats: {
    itemsMonitoring: number
    pendingInsights: number
    valueFoundToday: number
    activeNegotiations: number
  }
  recentActivity: string[]
}> {
  try {
    const presence = await getPresence(userId)
    const status = await generateAmbientMessage(userId)

    // Get stats from various sources
    const statsResult = await query(
      `SELECT
        (SELECT COUNT(*) FROM rfqs WHERE buyer_id = $1 AND status IN ('open', 'quoting')) as rfqs,
        (SELECT COUNT(*) FROM proactive_insights WHERE user_id = $1 AND acted_upon = false AND dismissed = false) as insights,
        (SELECT COALESCE(SUM(potential_value), 0) FROM proactive_insights WHERE user_id = $1 AND created_at > CURRENT_DATE) as value_today,
        (SELECT COUNT(*) FROM negotiations WHERE buyer_id = $1 AND status = 'active') as negotiations`,
      [userId]
    )

    const stats = statsResult.rows[0] || {}

    // Get recent activity descriptions
    const activityResult = await query(
      `SELECT description FROM wells_activity_log
       WHERE user_id = $1 AND completed_at > NOW() - INTERVAL '24 hours'
       ORDER BY completed_at DESC
       LIMIT 5`,
      [userId]
    )

    const recentActivity = activityResult.rows.map((r: any) => r.description)

    return {
      status,
      stats: {
        itemsMonitoring: parseInt(stats.rfqs) || 0,
        pendingInsights: parseInt(stats.insights) || 0,
        valueFoundToday: parseFloat(stats.value_today) || 0,
        activeNegotiations: parseInt(stats.negotiations) || 0,
      },
      recentActivity,
    }
  } catch (error) {
    console.error('[CompanionPresence] Error getting presence for widget:', error)
    return {
      status: await generateAmbientMessage(userId),
      stats: {
        itemsMonitoring: 0,
        pendingInsights: 0,
        valueFoundToday: 0,
        activeNegotiations: 0,
      },
      recentActivity: [],
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDefaultPresence(userId: string): CompanionPresence {
  const now = new Date()
  return {
    userId,
    isOnline: false,
    lastSeen: now,
    currentActivity: {
      type: 'idle',
      description: 'Ready and waiting',
      startedAt: now,
    },
    pendingInsights: 0,
    backgroundWork: [],
    ambientStatus: {
      message: "I'm here when you need me",
      icon: 'shield-check',
      color: '#6366f1',
      pulse: false,
      updatedAt: now,
    },
    heartbeat: now,
    totalTimeToday: 0,
  }
}

function rowToPresence(row: any): CompanionPresence {
  return {
    userId: row.user_id,
    isOnline: row.is_online,
    lastSeen: new Date(row.last_seen),
    currentActivity: row.current_activity || {
      type: 'idle',
      description: 'Ready and waiting',
      startedAt: new Date(),
    },
    pendingInsights: row.pending_insights || 0,
    backgroundWork: row.background_work || [],
    ambientStatus: row.ambient_status || {
      message: "I'm here when you need me",
      icon: 'shield-check',
      color: '#6366f1',
      pulse: false,
      updatedAt: new Date(),
    },
    heartbeat: new Date(row.heartbeat),
    sessionStart: row.session_start ? new Date(row.session_start) : undefined,
    totalTimeToday: row.total_time_today || 0,
  }
}

async function logActivityHistory(
  userId: string,
  activity: CompanionActivity
): Promise<void> {
  try {
    await query(
      `INSERT INTO companion_activity_history (
        id, user_id, activity_type, description, target_entity, started_at
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        activity.type,
        activity.description,
        activity.targetEntity ? JSON.stringify(activity.targetEntity) : null,
        activity.startedAt,
      ]
    )
  } catch (error) {
    // Non-critical, don't throw
    console.error('[CompanionPresence] Error logging activity history:', error)
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const CompanionPresenceService = {
  getPresence,
  updateHeartbeat,
  startSession,
  endSession,
  setActivity,
  addBackgroundWork,
  completeBackgroundWork,
  updateAmbientStatus,
  getWorkSummary,
  generateAmbientMessage,
  getPresenceForWidget,
}

export default CompanionPresenceService
