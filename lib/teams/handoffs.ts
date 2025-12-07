// @ts-nocheck
/**
 * Handoff Service
 *
 * Manages handoffs of conversations and work items between team members
 * Enables smooth transitions and context preservation
 */

import { sql } from '@vercel/postgres'

// ============================================================================
// TYPES
// ============================================================================

export interface Handoff {
  id: string
  orgId: string
  entityType: string
  entityId: string
  fromUser: string
  toUser: string
  reason?: string
  message?: string
  status: 'pending' | 'accepted' | 'declined'
  createdAt: Date
  acceptedAt?: Date
  declinedAt?: Date
}

export type EntityType = 'conversation' | 'deal' | 'lead' | 'task'

// ============================================================================
// HANDOFF OPERATIONS
// ============================================================================

/**
 * Initiate a handoff
 */
export async function initiateHandoff(
  orgId: string,
  entityType: EntityType,
  entityId: string,
  fromUserId: string,
  toUserId: string,
  reason?: string,
  message?: string
): Promise<Handoff> {
  try {
    const result = await sql`
      INSERT INTO handoffs (
        org_id,
        entity_type,
        entity_id,
        from_user,
        to_user,
        reason,
        message,
        status
      ) VALUES (
        ${orgId},
        ${entityType},
        ${entityId},
        ${fromUserId},
        ${toUserId},
        ${reason || null},
        ${message || null},
        'pending'
      )
      RETURNING *
    `

    return mapHandoffFromDb(result.rows[0])
  } catch (error) {
    console.error('Error initiating handoff:', error)
    throw new Error('Failed to initiate handoff')
  }
}

/**
 * Accept a handoff
 */
export async function acceptHandoff(
  handoffId: string,
  userId: string
): Promise<Handoff> {
  try {
    // Verify the handoff is for this user
    const existing = await getHandoff(handoffId)
    if (!existing) {
      throw new Error('Handoff not found')
    }

    if (existing.toUser !== userId) {
      throw new Error('Not authorized to accept this handoff')
    }

    if (existing.status !== 'pending') {
      throw new Error('Handoff already processed')
    }

    const result = await sql`
      UPDATE handoffs
      SET status = 'accepted', accepted_at = NOW()
      WHERE id = ${handoffId}
      RETURNING *
    `

    return mapHandoffFromDb(result.rows[0])
  } catch (error) {
    console.error('Error accepting handoff:', error)
    throw new Error('Failed to accept handoff')
  }
}

/**
 * Decline a handoff
 */
export async function declineHandoff(
  handoffId: string,
  userId: string,
  reason?: string
): Promise<Handoff> {
  try {
    // Verify the handoff is for this user
    const existing = await getHandoff(handoffId)
    if (!existing) {
      throw new Error('Handoff not found')
    }

    if (existing.toUser !== userId) {
      throw new Error('Not authorized to decline this handoff')
    }

    if (existing.status !== 'pending') {
      throw new Error('Handoff already processed')
    }

    const result = await sql`
      UPDATE handoffs
      SET status = 'declined', declined_at = NOW(), reason = ${reason || existing.reason}
      WHERE id = ${handoffId}
      RETURNING *
    `

    return mapHandoffFromDb(result.rows[0])
  } catch (error) {
    console.error('Error declining handoff:', error)
    throw new Error('Failed to decline handoff')
  }
}

/**
 * Get a specific handoff
 */
export async function getHandoff(handoffId: string): Promise<Handoff | null> {
  try {
    const result = await sql`
      SELECT * FROM handoffs WHERE id = ${handoffId}
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapHandoffFromDb(result.rows[0])
  } catch (error) {
    console.error('Error fetching handoff:', error)
    throw new Error('Failed to fetch handoff')
  }
}

/**
 * Get handoff history for an entity
 */
export async function getHandoffHistory(
  entityType: EntityType,
  entityId: string
): Promise<Handoff[]> {
  try {
    const result = await sql`
      SELECT * FROM handoffs
      WHERE entity_type = ${entityType}
      AND entity_id = ${entityId}
      ORDER BY created_at DESC
    `

    return result.rows.map(mapHandoffFromDb)
  } catch (error) {
    console.error('Error fetching handoff history:', error)
    throw new Error('Failed to fetch handoff history')
  }
}

/**
 * Get pending handoffs for a user
 */
export async function getPendingHandoffs(userId: string): Promise<Handoff[]> {
  try {
    const result = await sql`
      SELECT * FROM handoffs
      WHERE to_user = ${userId}
      AND status = 'pending'
      ORDER BY created_at DESC
    `

    return result.rows.map(mapHandoffFromDb)
  } catch (error) {
    console.error('Error fetching pending handoffs:', error)
    throw new Error('Failed to fetch pending handoffs')
  }
}

/**
 * Get handoffs initiated by a user
 */
export async function getInitiatedHandoffs(
  userId: string,
  options?: {
    status?: 'pending' | 'accepted' | 'declined'
    limit?: number
  }
): Promise<Handoff[]> {
  try {
    const conditions: string[] = ['from_user = $1']
    const params: any[] = [userId]

    if (options?.status) {
      conditions.push(`status = $${params.length + 1}`)
      params.push(options.status)
    }

    const limit = options?.limit || 50

    const query = `
      SELECT * FROM handoffs
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1}
    `

    const result = await sql.query(query, [...params, limit])

    return result.rows.map(mapHandoffFromDb)
  } catch (error) {
    console.error('Error fetching initiated handoffs:', error)
    throw new Error('Failed to fetch initiated handoffs')
  }
}

/**
 * Get active handoff for an entity (if any)
 */
export async function getActiveHandoff(
  entityType: EntityType,
  entityId: string
): Promise<Handoff | null> {
  try {
    const result = await sql`
      SELECT * FROM handoffs
      WHERE entity_type = ${entityType}
      AND entity_id = ${entityId}
      AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapHandoffFromDb(result.rows[0])
  } catch (error) {
    console.error('Error fetching active handoff:', error)
    throw new Error('Failed to fetch active handoff')
  }
}

/**
 * Cancel a pending handoff
 */
export async function cancelHandoff(
  handoffId: string,
  userId: string
): Promise<void> {
  try {
    // Verify the user initiated the handoff
    const existing = await getHandoff(handoffId)
    if (!existing) {
      throw new Error('Handoff not found')
    }

    if (existing.fromUser !== userId) {
      throw new Error('Not authorized to cancel this handoff')
    }

    if (existing.status !== 'pending') {
      throw new Error('Cannot cancel processed handoff')
    }

    await sql`
      UPDATE handoffs
      SET status = 'declined', declined_at = NOW()
      WHERE id = ${handoffId}
    `
  } catch (error) {
    console.error('Error canceling handoff:', error)
    throw new Error('Failed to cancel handoff')
  }
}

/**
 * Get handoff statistics for a user
 */
export async function getHandoffStats(userId: string): Promise<{
  pending: number
  accepted: number
  declined: number
  initiated: number
}> {
  try {
    // Pending (received)
    const pendingResult = await sql`
      SELECT COUNT(*) as count
      FROM handoffs
      WHERE to_user = ${userId}
      AND status = 'pending'
    `

    // Accepted (received)
    const acceptedResult = await sql`
      SELECT COUNT(*) as count
      FROM handoffs
      WHERE to_user = ${userId}
      AND status = 'accepted'
    `

    // Declined (received)
    const declinedResult = await sql`
      SELECT COUNT(*) as count
      FROM handoffs
      WHERE to_user = ${userId}
      AND status = 'declined'
    `

    // Initiated (sent)
    const initiatedResult = await sql`
      SELECT COUNT(*) as count
      FROM handoffs
      WHERE from_user = ${userId}
    `

    return {
      pending: parseInt(pendingResult.rows[0].count),
      accepted: parseInt(acceptedResult.rows[0].count),
      declined: parseInt(declinedResult.rows[0].count),
      initiated: parseInt(initiatedResult.rows[0].count),
    }
  } catch (error) {
    console.error('Error fetching handoff stats:', error)
    return { pending: 0, accepted: 0, declined: 0, initiated: 0 }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function mapHandoffFromDb(row: any): Handoff {
  return {
    id: row.id,
    orgId: row.org_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    fromUser: row.from_user,
    toUser: row.to_user,
    reason: row.reason,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    declinedAt: row.declined_at,
  }
}
