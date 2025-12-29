// @ts-nocheck
/**
 * RFQ Service
 *
 * Core CRUD operations for Request for Quote (RFQ) management.
 * Handles creation, retrieval, updates, and status management of RFQs.
 *
 * @module lib/rfq/rfq-service
 */

import { sql } from '@vercel/postgres'
import { RFQ, RFQStatus } from './types'

// ============================================================================
// TYPES
// ============================================================================

export interface CreateRFQInput {
  userId: string
  category: string
  description: string
  quantity: number
  targetPrice?: number
  urgency?: string
  deliveryLocation?: string
  specifications?: Record<string, string>
  requiredDeliveryDate?: Date
}

export interface UpdateRFQInput {
  category?: string
  description?: string
  quantity?: number
  targetPrice?: number
  urgency?: string
  deliveryLocation?: string
  specifications?: Record<string, string>
  requiredDeliveryDate?: Date
  status?: RFQStatus
}

// ============================================================================
// LOGGING
// ============================================================================

const LOG_PREFIX = '[RFQService]'

function logInfo(message: string, data?: Record<string, unknown>): void {
  console.log(`${LOG_PREFIX} ${message}`, data ? JSON.stringify(data) : '')
}

function logError(message: string, error: unknown, data?: Record<string, unknown>): void {
  console.error(`${LOG_PREFIX} ERROR: ${message}`, {
    error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    ...data,
  })
}

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class RFQServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'RFQServiceError'
  }
}

export class RFQNotFoundError extends RFQServiceError {
  constructor(rfqId: string) {
    super(`RFQ not found: ${rfqId}`, 'RFQ_NOT_FOUND', 404, { rfqId })
  }
}

// ============================================================================
// CREATE RFQ
// ============================================================================

/**
 * Create a new RFQ
 */
export async function createRFQ(input: CreateRFQInput): Promise<RFQ> {
  logInfo('Creating RFQ', { userId: input.userId, category: input.category })

  try {
    const result = await sql`
      INSERT INTO rfqs (
        user_id,
        category,
        description,
        quantity,
        target_price,
        urgency,
        delivery_location,
        specifications,
        required_delivery_date,
        status
      ) VALUES (
        ${input.userId},
        ${input.category},
        ${input.description},
        ${input.quantity},
        ${input.targetPrice || null},
        ${input.urgency || 'standard'},
        ${input.deliveryLocation || null},
        ${input.specifications ? JSON.stringify(input.specifications) : null},
        ${input.requiredDeliveryDate ? input.requiredDeliveryDate.toISOString() : null},
        'open'
      )
      RETURNING *
    `

    if (result.rows.length === 0) {
      throw new RFQServiceError('Failed to create RFQ', 'CREATE_FAILED')
    }

    const rfq = mapRFQRow(result.rows[0])
    logInfo('RFQ created successfully', { rfqId: rfq.id })

    return rfq
  } catch (error) {
    if (error instanceof RFQServiceError) throw error
    logError('Failed to create RFQ', error, { input })
    throw new RFQServiceError(
      'Failed to create RFQ',
      'CREATE_ERROR',
      500,
      { originalError: error instanceof Error ? error.message : String(error) }
    )
  }
}

// ============================================================================
// READ RFQ
// ============================================================================

/**
 * Get RFQ by ID
 */
export async function getRFQById(rfqId: string): Promise<RFQ | null> {
  logInfo('Fetching RFQ by ID', { rfqId })

  try {
    const result = await sql`
      SELECT * FROM rfqs
      WHERE id = ${rfqId}
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapRFQRow(result.rows[0])
  } catch (error) {
    logError('Failed to fetch RFQ', error, { rfqId })
    throw new RFQServiceError(
      'Failed to fetch RFQ',
      'FETCH_ERROR',
      500,
      { rfqId, originalError: error instanceof Error ? error.message : String(error) }
    )
  }
}

/**
 * Get all RFQs for a user
 */
export async function getRFQsByUser(
  userId: string,
  options?: {
    status?: RFQStatus | RFQStatus[]
    limit?: number
    offset?: number
  }
): Promise<RFQ[]> {
  logInfo('Fetching RFQs by user', { userId, options })

  try {
    const limit = options?.limit || 50
    const offset = options?.offset || 0

    let result

    if (options?.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status]
      result = await sql`
        SELECT * FROM rfqs
        WHERE user_id = ${userId}
        AND status = ANY(${statuses})
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `
    } else {
      result = await sql`
        SELECT * FROM rfqs
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `
    }

    logInfo('Found RFQs for user', { userId, count: result.rows.length })
    return result.rows.map(mapRFQRow)
  } catch (error) {
    logError('Failed to fetch RFQs by user', error, { userId, options })
    throw new RFQServiceError(
      'Failed to fetch RFQs',
      'FETCH_ERROR',
      500,
      { userId, originalError: error instanceof Error ? error.message : String(error) }
    )
  }
}

/**
 * Get active RFQs for a user (not completed or cancelled)
 */
export async function getActiveRFQsByUser(userId: string): Promise<RFQ[]> {
  return getRFQsByUser(userId, {
    status: ['open', 'matched', 'quoting', 'negotiating', 'quoted', 'awarded', 'fulfilling'],
  })
}

/**
 * Search RFQs
 */
export async function searchRFQs(
  userId: string,
  query: string
): Promise<RFQ[]> {
  logInfo('Searching RFQs', { userId, query })

  try {
    const searchPattern = `%${query.toLowerCase()}%`

    const result = await sql`
      SELECT * FROM rfqs
      WHERE user_id = ${userId}
      AND (
        LOWER(description) LIKE ${searchPattern}
        OR LOWER(category) LIKE ${searchPattern}
      )
      ORDER BY created_at DESC
      LIMIT 20
    `

    return result.rows.map(mapRFQRow)
  } catch (error) {
    logError('Failed to search RFQs', error, { userId, query })
    throw new RFQServiceError(
      'Failed to search RFQs',
      'SEARCH_ERROR',
      500,
      { userId, query, originalError: error instanceof Error ? error.message : String(error) }
    )
  }
}

// ============================================================================
// UPDATE RFQ
// ============================================================================

/**
 * Update RFQ
 */
export async function updateRFQ(
  rfqId: string,
  input: UpdateRFQInput
): Promise<RFQ> {
  logInfo('Updating RFQ', { rfqId, input })

  try {
    // Build dynamic update query
    const updates: string[] = ['updated_at = NOW()']
    const values: unknown[] = []
    let paramIndex = 1

    if (input.category !== undefined) {
      updates.push(`category = $${paramIndex++}`)
      values.push(input.category)
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(input.description)
    }
    if (input.quantity !== undefined) {
      updates.push(`quantity = $${paramIndex++}`)
      values.push(input.quantity)
    }
    if (input.targetPrice !== undefined) {
      updates.push(`target_price = $${paramIndex++}`)
      values.push(input.targetPrice)
    }
    if (input.urgency !== undefined) {
      updates.push(`urgency = $${paramIndex++}`)
      values.push(input.urgency)
    }
    if (input.deliveryLocation !== undefined) {
      updates.push(`delivery_location = $${paramIndex++}`)
      values.push(input.deliveryLocation)
    }
    if (input.specifications !== undefined) {
      updates.push(`specifications = $${paramIndex++}`)
      values.push(JSON.stringify(input.specifications))
    }
    if (input.requiredDeliveryDate !== undefined) {
      updates.push(`required_delivery_date = $${paramIndex++}`)
      values.push(input.requiredDeliveryDate.toISOString())
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`)
      values.push(input.status)
    }

    values.push(rfqId)

    const query = `
      UPDATE rfqs
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const result = await sql.query(query, values)

    if (result.rows.length === 0) {
      throw new RFQNotFoundError(rfqId)
    }

    const rfq = mapRFQRow(result.rows[0])
    logInfo('RFQ updated successfully', { rfqId })

    return rfq
  } catch (error) {
    if (error instanceof RFQServiceError) throw error
    logError('Failed to update RFQ', error, { rfqId, input })
    throw new RFQServiceError(
      'Failed to update RFQ',
      'UPDATE_ERROR',
      500,
      { rfqId, originalError: error instanceof Error ? error.message : String(error) }
    )
  }
}

/**
 * Update RFQ status
 */
export async function updateRFQStatus(
  rfqId: string,
  status: RFQStatus
): Promise<RFQ> {
  logInfo('Updating RFQ status', { rfqId, status })

  try {
    const result = await sql`
      UPDATE rfqs
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${rfqId}
      RETURNING *
    `

    if (result.rows.length === 0) {
      throw new RFQNotFoundError(rfqId)
    }

    const rfq = mapRFQRow(result.rows[0])
    logInfo('RFQ status updated', { rfqId, status })

    return rfq
  } catch (error) {
    if (error instanceof RFQServiceError) throw error
    logError('Failed to update RFQ status', error, { rfqId, status })
    throw new RFQServiceError(
      'Failed to update RFQ status',
      'STATUS_UPDATE_ERROR',
      500,
      { rfqId, status, originalError: error instanceof Error ? error.message : String(error) }
    )
  }
}

// ============================================================================
// DELETE / CANCEL RFQ
// ============================================================================

/**
 * Cancel an RFQ
 */
export async function cancelRFQ(rfqId: string, reason?: string): Promise<RFQ> {
  logInfo('Cancelling RFQ', { rfqId, reason })

  try {
    // Check if RFQ can be cancelled
    const existing = await getRFQById(rfqId)
    if (!existing) {
      throw new RFQNotFoundError(rfqId)
    }

    // Cannot cancel completed RFQs
    if (['completed', 'cancelled'].includes(existing.status)) {
      throw new RFQServiceError(
        `Cannot cancel RFQ with status '${existing.status}'`,
        'INVALID_STATUS',
        409,
        { rfqId, status: existing.status }
      )
    }

    const notes = reason
      ? `Cancelled: ${reason}`
      : 'Cancelled by user'

    const result = await sql`
      UPDATE rfqs
      SET
        status = 'cancelled',
        notes = COALESCE(notes, '') || '\n' || ${notes},
        updated_at = NOW()
      WHERE id = ${rfqId}
      RETURNING *
    `

    const rfq = mapRFQRow(result.rows[0])
    logInfo('RFQ cancelled', { rfqId, reason })

    return rfq
  } catch (error) {
    if (error instanceof RFQServiceError) throw error
    logError('Failed to cancel RFQ', error, { rfqId, reason })
    throw new RFQServiceError(
      'Failed to cancel RFQ',
      'CANCEL_ERROR',
      500,
      { rfqId, originalError: error instanceof Error ? error.message : String(error) }
    )
  }
}

/**
 * Close an RFQ without selecting a winner
 */
export async function closeRFQ(rfqId: string, reason?: string): Promise<RFQ> {
  logInfo('Closing RFQ', { rfqId, reason })

  try {
    const existing = await getRFQById(rfqId)
    if (!existing) {
      throw new RFQNotFoundError(rfqId)
    }

    const notes = reason
      ? `Closed: ${reason}`
      : 'Closed without award'

    const result = await sql`
      UPDATE rfqs
      SET
        status = 'closed',
        notes = COALESCE(notes, '') || '\n' || ${notes},
        updated_at = NOW()
      WHERE id = ${rfqId}
      RETURNING *
    `

    const rfq = mapRFQRow(result.rows[0])
    logInfo('RFQ closed', { rfqId, reason })

    return rfq
  } catch (error) {
    if (error instanceof RFQServiceError) throw error
    logError('Failed to close RFQ', error, { rfqId, reason })
    throw new RFQServiceError(
      'Failed to close RFQ',
      'CLOSE_ERROR',
      500,
      { rfqId, originalError: error instanceof Error ? error.message : String(error) }
    )
  }
}

// ============================================================================
// STATISTICS & ANALYTICS
// ============================================================================

/**
 * Get RFQ statistics for a user
 */
export async function getRFQStats(userId: string): Promise<{
  total: number
  open: number
  quoting: number
  negotiating: number
  awarded: number
  completed: number
  cancelled: number
}> {
  logInfo('Getting RFQ stats', { userId })

  try {
    const result = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'open' OR status = 'matched') as open,
        COUNT(*) FILTER (WHERE status = 'quoting') as quoting,
        COUNT(*) FILTER (WHERE status = 'negotiating') as negotiating,
        COUNT(*) FILTER (WHERE status = 'awarded' OR status = 'fulfilling') as awarded,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled' OR status = 'closed') as cancelled
      FROM rfqs
      WHERE user_id = ${userId}
    `

    const row = result.rows[0]
    return {
      total: parseInt(row.total, 10),
      open: parseInt(row.open, 10),
      quoting: parseInt(row.quoting, 10),
      negotiating: parseInt(row.negotiating, 10),
      awarded: parseInt(row.awarded, 10),
      completed: parseInt(row.completed, 10),
      cancelled: parseInt(row.cancelled, 10),
    }
  } catch (error) {
    logError('Failed to get RFQ stats', error, { userId })
    throw new RFQServiceError(
      'Failed to get RFQ statistics',
      'STATS_ERROR',
      500,
      { userId, originalError: error instanceof Error ? error.message : String(error) }
    )
  }
}

/**
 * Get recent RFQ activity for a user
 */
export async function getRecentRFQActivity(
  userId: string,
  limit: number = 10
): Promise<Array<{
  rfqId: string
  description: string
  status: RFQStatus
  activityType: string
  timestamp: Date
}>> {
  logInfo('Getting recent RFQ activity', { userId, limit })

  try {
    const result = await sql`
      SELECT
        id as rfq_id,
        description,
        status,
        'status_change' as activity_type,
        updated_at as timestamp
      FROM rfqs
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `

    return result.rows.map(row => ({
      rfqId: row.rfq_id,
      description: row.description,
      status: row.status as RFQStatus,
      activityType: row.activity_type,
      timestamp: new Date(row.timestamp),
    }))
  } catch (error) {
    logError('Failed to get recent activity', error, { userId })
    return []
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map database row to RFQ type
 */
function mapRFQRow(row: Record<string, unknown>): RFQ {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    category: row.category as string,
    description: row.description as string,
    quantity: row.quantity as number,
    targetPrice: row.target_price ? parseFloat(row.target_price as string) : undefined,
    urgency: row.urgency as string,
    deliveryLocation: row.delivery_location as string | undefined,
    specifications: row.specifications as Record<string, string> | undefined,
    requiredDeliveryDate: row.required_delivery_date
      ? new Date(row.required_delivery_date as string)
      : undefined,
    status: row.status as RFQStatus,
    notes: row.notes as string | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  createRFQ,
  getRFQById,
  getRFQsByUser,
  getActiveRFQsByUser,
  searchRFQs,
  updateRFQ,
  updateRFQStatus,
  cancelRFQ,
  closeRFQ,
  getRFQStats,
  getRecentRFQActivity,
}
