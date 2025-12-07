// @ts-nocheck
/**
 * Assignment Service
 *
 * Manages assignment of work items (deals, leads, etc.) to team members
 */

import { sql } from '@vercel/postgres'

// ============================================================================
// TYPES
// ============================================================================

export interface Assignment {
  id: string
  entityType: string
  entityId: string
  assignedTo: string
  assignedBy: string
  status: 'active' | 'completed' | 'reassigned'
  createdAt: Date
  completedAt?: Date
}

export type EntityType = 'deal' | 'lead' | 'supplier_rfq' | 'payment' | 'task'

// ============================================================================
// ASSIGNMENT OPERATIONS
// ============================================================================

/**
 * Assign an entity to a user
 */
export async function assignToUser(
  entityType: EntityType,
  entityId: string,
  assigneeId: string,
  assignerId: string
): Promise<Assignment> {
  try {
    // Mark any existing assignments as reassigned
    await sql`
      UPDATE assignments
      SET status = 'reassigned'
      WHERE entity_type = ${entityType}
      AND entity_id = ${entityId}
      AND status = 'active'
    `

    // Create new assignment
    const result = await sql`
      INSERT INTO assignments (
        entity_type,
        entity_id,
        assigned_to,
        assigned_by,
        status
      ) VALUES (
        ${entityType},
        ${entityId},
        ${assigneeId},
        ${assignerId},
        'active'
      )
      RETURNING *
    `

    return mapAssignmentFromDb(result.rows[0])
  } catch (error) {
    console.error('Error creating assignment:', error)
    throw new Error('Failed to create assignment')
  }
}

/**
 * Get assignments for a user
 */
export async function getMyAssignments(
  userId: string,
  options?: {
    status?: 'active' | 'completed' | 'reassigned'
    entityType?: EntityType
    limit?: number
  }
): Promise<Assignment[]> {
  try {
    const conditions: string[] = ['assigned_to = $1']
    const params: any[] = [userId]

    if (options?.status) {
      conditions.push(`status = $${params.length + 1}`)
      params.push(options.status)
    }

    if (options?.entityType) {
      conditions.push(`entity_type = $${params.length + 1}`)
      params.push(options.entityType)
    }

    const limit = options?.limit || 100

    const query = `
      SELECT * FROM assignments
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1}
    `

    const result = await sql.query(query, [...params, limit])

    return result.rows.map(mapAssignmentFromDb)
  } catch (error) {
    console.error('Error fetching assignments:', error)
    throw new Error('Failed to fetch assignments')
  }
}

/**
 * Get assignments for a team
 * Returns all assignments for users in the team
 */
export async function getTeamAssignments(
  teamId: string,
  options?: {
    status?: 'active' | 'completed' | 'reassigned'
    entityType?: EntityType
  }
): Promise<Assignment[]> {
  try {
    const conditions: string[] = []
    const params: any[] = [teamId]

    if (options?.status) {
      conditions.push(`a.status = $${params.length + 1}`)
      params.push(options.status)
    }

    if (options?.entityType) {
      conditions.push(`a.entity_type = $${params.length + 1}`)
      params.push(options.entityType)
    }

    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''

    const query = `
      SELECT a.*
      FROM assignments a
      INNER JOIN team_members tm ON a.assigned_to = tm.user_id
      WHERE tm.team_id = $1
      ${whereClause}
      ORDER BY a.created_at DESC
    `

    const result = await sql.query(query, params)

    return result.rows.map(mapAssignmentFromDb)
  } catch (error) {
    console.error('Error fetching team assignments:', error)
    throw new Error('Failed to fetch team assignments')
  }
}

/**
 * Get assignment for a specific entity
 */
export async function getEntityAssignment(
  entityType: EntityType,
  entityId: string
): Promise<Assignment | null> {
  try {
    const result = await sql`
      SELECT * FROM assignments
      WHERE entity_type = ${entityType}
      AND entity_id = ${entityId}
      AND status = 'active'
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapAssignmentFromDb(result.rows[0])
  } catch (error) {
    console.error('Error fetching entity assignment:', error)
    throw new Error('Failed to fetch entity assignment')
  }
}

/**
 * Reassign an entity to a different user
 */
export async function reassign(
  assignmentId: string,
  newAssigneeId: string,
  reassignedBy: string
): Promise<Assignment> {
  try {
    // Get the current assignment
    const currentResult = await sql`
      SELECT * FROM assignments WHERE id = ${assignmentId}
    `

    if (currentResult.rows.length === 0) {
      throw new Error('Assignment not found')
    }

    const current = mapAssignmentFromDb(currentResult.rows[0])

    // Create new assignment with same entity
    return await assignToUser(
      current.entityType as EntityType,
      current.entityId,
      newAssigneeId,
      reassignedBy
    )
  } catch (error) {
    console.error('Error reassigning:', error)
    throw new Error('Failed to reassign')
  }
}

/**
 * Mark assignment as completed
 */
export async function completeAssignment(assignmentId: string): Promise<Assignment> {
  try {
    const result = await sql`
      UPDATE assignments
      SET status = 'completed', completed_at = NOW()
      WHERE id = ${assignmentId}
      RETURNING *
    `

    if (result.rows.length === 0) {
      throw new Error('Assignment not found')
    }

    return mapAssignmentFromDb(result.rows[0])
  } catch (error) {
    console.error('Error completing assignment:', error)
    throw new Error('Failed to complete assignment')
  }
}

/**
 * Unassign an entity (remove active assignment)
 */
export async function unassign(
  entityType: EntityType,
  entityId: string
): Promise<void> {
  try {
    await sql`
      UPDATE assignments
      SET status = 'reassigned'
      WHERE entity_type = ${entityType}
      AND entity_id = ${entityId}
      AND status = 'active'
    `
  } catch (error) {
    console.error('Error unassigning:', error)
    throw new Error('Failed to unassign')
  }
}

/**
 * Check if a user is assigned to an entity
 */
export async function isAssignedTo(
  userId: string,
  entityType: EntityType,
  entityId: string
): Promise<boolean> {
  try {
    const result = await sql`
      SELECT * FROM assignments
      WHERE entity_type = ${entityType}
      AND entity_id = ${entityId}
      AND assigned_to = ${userId}
      AND status = 'active'
    `

    return result.rows.length > 0
  } catch (error) {
    console.error('Error checking assignment:', error)
    return false
  }
}

/**
 * Get assignment statistics for a user
 */
export async function getAssignmentStats(userId: string): Promise<{
  active: number
  completed: number
  byType: Record<string, number>
}> {
  try {
    // Get active count
    const activeResult = await sql`
      SELECT COUNT(*) as count FROM assignments
      WHERE assigned_to = ${userId}
      AND status = 'active'
    `

    // Get completed count
    const completedResult = await sql`
      SELECT COUNT(*) as count FROM assignments
      WHERE assigned_to = ${userId}
      AND status = 'completed'
    `

    // Get breakdown by entity type
    const byTypeResult = await sql`
      SELECT entity_type, COUNT(*) as count
      FROM assignments
      WHERE assigned_to = ${userId}
      AND status = 'active'
      GROUP BY entity_type
    `

    const byType: Record<string, number> = {}
    for (const row of byTypeResult.rows) {
      byType[row.entity_type] = parseInt(row.count)
    }

    return {
      active: parseInt(activeResult.rows[0].count),
      completed: parseInt(completedResult.rows[0].count),
      byType,
    }
  } catch (error) {
    console.error('Error fetching assignment stats:', error)
    return { active: 0, completed: 0, byType: {} }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function mapAssignmentFromDb(row: any): Assignment {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    assignedTo: row.assigned_to,
    assignedBy: row.assigned_by,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }
}
