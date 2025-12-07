// @ts-nocheck
/**
 * Activity Service
 *
 * Tracks and logs all team activities for transparency and audit
 */

import { sql } from '@vercel/postgres'

// ============================================================================
// TYPES
// ============================================================================

export interface Activity {
  id: string
  orgId: string
  userId?: string
  actionType: string
  entityType: string
  entityId: string
  metadata: Record<string, any>
  changes?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}

export type ActionType =
  | 'deal.created'
  | 'deal.updated'
  | 'deal.assigned'
  | 'deal.closed'
  | 'lead.created'
  | 'lead.assigned'
  | 'lead.contacted'
  | 'payment.created'
  | 'payment.approved'
  | 'payment.sent'
  | 'member.invited'
  | 'member.joined'
  | 'member.removed'
  | 'team.created'
  | 'comment.added'
  | 'handoff.initiated'
  | 'handoff.accepted'

// ============================================================================
// ACTIVITY OPERATIONS
// ============================================================================

/**
 * Log an activity
 */
export async function logActivity(
  orgId: string,
  userId: string | null,
  actionType: ActionType,
  entityType: string,
  entityId: string,
  metadata?: Record<string, any>,
  options?: {
    changes?: Record<string, any>
    ipAddress?: string
    userAgent?: string
  }
): Promise<Activity> {
  try {
    const result = await sql`
      INSERT INTO activity_log (
        org_id,
        user_id,
        action_type,
        entity_type,
        entity_id,
        metadata,
        changes,
        ip_address,
        user_agent
      ) VALUES (
        ${orgId},
        ${userId},
        ${actionType},
        ${entityType},
        ${entityId},
        ${JSON.stringify(metadata || {})},
        ${options?.changes ? JSON.stringify(options.changes) : null},
        ${options?.ipAddress || null},
        ${options?.userAgent || null}
      )
      RETURNING *
    `

    return mapActivityFromDb(result.rows[0])
  } catch (error) {
    console.error('Error logging activity:', error)
    throw new Error('Failed to log activity')
  }
}

/**
 * Get organization activity feed
 */
export async function getOrganizationActivity(
  orgId: string,
  options?: {
    userId?: string
    actionType?: ActionType
    entityType?: string
    limit?: number
    offset?: number
  }
): Promise<{ activities: Activity[]; total: number }> {
  try {
    const conditions: string[] = ['org_id = $1']
    const params: any[] = [orgId]

    if (options?.userId) {
      conditions.push(`user_id = $${params.length + 1}`)
      params.push(options.userId)
    }

    if (options?.actionType) {
      conditions.push(`action_type = $${params.length + 1}`)
      params.push(options.actionType)
    }

    if (options?.entityType) {
      conditions.push(`entity_type = $${params.length + 1}`)
      params.push(options.entityType)
    }

    const whereClause = conditions.join(' AND ')
    const limit = options?.limit || 50
    const offset = options?.offset || 0

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM activity_log WHERE ${whereClause}`
    const countResult = await sql.query(countQuery, params)
    const total = parseInt(countResult.rows[0].count)

    // Get activities
    const activitiesQuery = `
      SELECT * FROM activity_log
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `

    const result = await sql.query(activitiesQuery, [...params, limit, offset])

    const activities = result.rows.map(mapActivityFromDb)

    return { activities, total }
  } catch (error) {
    console.error('Error fetching organization activity:', error)
    throw new Error('Failed to fetch organization activity')
  }
}

/**
 * Get activity for a specific entity
 */
export async function getEntityActivity(
  entityType: string,
  entityId: string,
  options?: {
    limit?: number
  }
): Promise<Activity[]> {
  try {
    const limit = options?.limit || 50

    const result = await sql`
      SELECT * FROM activity_log
      WHERE entity_type = ${entityType}
      AND entity_id = ${entityId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `

    return result.rows.map(mapActivityFromDb)
  } catch (error) {
    console.error('Error fetching entity activity:', error)
    throw new Error('Failed to fetch entity activity')
  }
}

/**
 * Get activity for a specific user
 */
export async function getUserActivity(
  userId: string,
  orgId: string,
  options?: {
    limit?: number
    offset?: number
  }
): Promise<{ activities: Activity[]; total: number }> {
  try {
    const limit = options?.limit || 50
    const offset = options?.offset || 0

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as count
      FROM activity_log
      WHERE org_id = ${orgId}
      AND user_id = ${userId}
    `
    const total = parseInt(countResult.rows[0].count)

    // Get activities
    const result = await sql`
      SELECT * FROM activity_log
      WHERE org_id = ${orgId}
      AND user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `

    const activities = result.rows.map(mapActivityFromDb)

    return { activities, total }
  } catch (error) {
    console.error('Error fetching user activity:', error)
    throw new Error('Failed to fetch user activity')
  }
}

/**
 * Get recent activity (last 24 hours)
 */
export async function getRecentActivity(
  orgId: string,
  limit: number = 20
): Promise<Activity[]> {
  try {
    const result = await sql`
      SELECT * FROM activity_log
      WHERE org_id = ${orgId}
      AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT ${limit}
    `

    return result.rows.map(mapActivityFromDb)
  } catch (error) {
    console.error('Error fetching recent activity:', error)
    throw new Error('Failed to fetch recent activity')
  }
}

/**
 * Get activity statistics
 */
export async function getActivityStats(
  orgId: string,
  period: 'day' | 'week' | 'month' = 'week'
): Promise<{
  totalActivities: number
  byActionType: Record<string, number>
  byUser: Record<string, number>
  topEntities: Array<{ entityType: string; entityId: string; count: number }>
}> {
  try {
    const interval = period === 'day' ? '24 hours' : period === 'week' ? '7 days' : '30 days'

    // Total activities
    const totalResult = await sql`
      SELECT COUNT(*) as count
      FROM activity_log
      WHERE org_id = ${orgId}
      AND created_at > NOW() - INTERVAL '${sql.unsafe(interval)}'
    `
    const totalActivities = parseInt(totalResult.rows[0].count)

    // By action type
    const byActionTypeResult = await sql`
      SELECT action_type, COUNT(*) as count
      FROM activity_log
      WHERE org_id = ${orgId}
      AND created_at > NOW() - INTERVAL '${sql.unsafe(interval)}'
      GROUP BY action_type
      ORDER BY count DESC
    `
    const byActionType: Record<string, number> = {}
    for (const row of byActionTypeResult.rows) {
      byActionType[row.action_type] = parseInt(row.count)
    }

    // By user
    const byUserResult = await sql`
      SELECT user_id, COUNT(*) as count
      FROM activity_log
      WHERE org_id = ${orgId}
      AND user_id IS NOT NULL
      AND created_at > NOW() - INTERVAL '${sql.unsafe(interval)}'
      GROUP BY user_id
      ORDER BY count DESC
      LIMIT 10
    `
    const byUser: Record<string, number> = {}
    for (const row of byUserResult.rows) {
      byUser[row.user_id] = parseInt(row.count)
    }

    // Top entities
    const topEntitiesResult = await sql`
      SELECT entity_type, entity_id, COUNT(*) as count
      FROM activity_log
      WHERE org_id = ${orgId}
      AND created_at > NOW() - INTERVAL '${sql.unsafe(interval)}'
      GROUP BY entity_type, entity_id
      ORDER BY count DESC
      LIMIT 10
    `
    const topEntities = topEntitiesResult.rows.map(row => ({
      entityType: row.entity_type,
      entityId: row.entity_id,
      count: parseInt(row.count),
    }))

    return {
      totalActivities,
      byActionType,
      byUser,
      topEntities,
    }
  } catch (error) {
    console.error('Error fetching activity stats:', error)
    throw new Error('Failed to fetch activity stats')
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function mapActivityFromDb(row: any): Activity {
  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    actionType: row.action_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata || {},
    changes: row.changes,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }
}
