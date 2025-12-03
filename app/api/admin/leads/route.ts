/**
 * Admin API: Leads Management
 *
 * GET /api/admin/leads - Fetch all leads with filters
 * PATCH /api/admin/leads - Update lead status/notes
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { Pool } from 'pg'

// Initialize Postgres connection
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})

// Admin check - in production, use Clerk roles
// For now, hardcode admin user IDs or check email domain
const isAdmin = (userId: string | null, userEmail?: string) => {
  if (!userId) return false

  // TODO: Replace with proper admin role check from Clerk
  // For now, allow any authenticated user for development
  // In production, check: user.publicMetadata.role === 'admin'
  return true
}

// ============================================================================
// GET - Fetch all leads
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    // Check admin access
    if (!isAdmin(userId)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Parse query params for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const journey = searchParams.get('journey')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = `
      SELECT
        l.*,
        (SELECT COUNT(*) FROM lead_notes WHERE lead_id = l.id) as notes_count,
        (SELECT COUNT(*) FROM lead_activities WHERE lead_id = l.id) as activities_count
      FROM leads l
      WHERE 1=1
    `
    const params: any[] = []
    let paramIndex = 1

    if (status) {
      query += ` AND status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    if (journey) {
      query += ` AND journey = $${paramIndex}`
      params.push(journey)
      paramIndex++
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    // Execute query
    const client = await pool.connect()
    try {
      const result = await client.query(query, params)

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM leads WHERE 1=1'
      const countParams: any[] = []
      let countParamIndex = 1

      if (status) {
        countQuery += ` AND status = $${countParamIndex}`
        countParams.push(status)
        countParamIndex++
      }

      if (journey) {
        countQuery += ` AND journey = $${countParamIndex}`
        countParams.push(journey)
      }

      const countResult = await client.query(countQuery, countParams)
      const totalCount = parseInt(countResult.rows[0].count)

      return NextResponse.json({
        leads: result.rows,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching leads:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    )
  }
}

// ============================================================================
// PATCH - Update lead
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth()

    // Check admin access
    if (!isAdmin(userId)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { leadId, status, priority, contactedBy, note } = body

    if (!leadId) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Update lead
      const updates: string[] = []
      const params: any[] = [leadId]
      let paramIndex = 2

      if (status) {
        updates.push(`status = $${paramIndex}`)
        params.push(status)
        paramIndex++

        if (status === 'contacted' && !contactedBy) {
          updates.push(`contacted_at = NOW()`)
          updates.push(`contacted_by = $${paramIndex}`)
          params.push(userId)
          paramIndex++
        }

        if (status === 'closed' || status === 'won' || status === 'lost') {
          updates.push(`closed_at = NOW()`)
        }
      }

      if (priority) {
        updates.push(`priority = $${paramIndex}`)
        params.push(priority)
        paramIndex++
      }

      updates.push(`updated_at = NOW()`)

      if (updates.length > 0) {
        const updateQuery = `
          UPDATE leads
          SET ${updates.join(', ')}
          WHERE id = $1
          RETURNING *
        `
        await client.query(updateQuery, params)
      }

      // Add note if provided
      if (note) {
        await client.query(
          `INSERT INTO lead_notes (lead_id, note, created_by)
           VALUES ($1, $2, $3)`,
          [leadId, note, userId]
        )
      }

      // Log activity
      if (status) {
        await client.query(
          `INSERT INTO lead_activities (lead_id, activity_type, activity_data, performed_by)
           VALUES ($1, $2, $3, $4)`,
          [
            leadId,
            'status_changed',
            JSON.stringify({ newStatus: status }),
            userId,
          ]
        )
      }

      await client.query('COMMIT')

      // Fetch updated lead
      const result = await client.query(
        'SELECT * FROM leads WHERE id = $1',
        [leadId]
      )

      return NextResponse.json({
        success: true,
        lead: result.rows[0],
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error updating lead:', error)
    return NextResponse.json(
      { error: 'Failed to update lead' },
      { status: 500 }
    )
  }
}
