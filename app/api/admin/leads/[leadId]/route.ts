/**
 * Admin API: Individual Lead Details
 *
 * GET /api/admin/leads/[leadId] - Fetch lead with full conversation history, notes, and activities
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})

const isAdmin = (userId: string | null) => {
  if (!userId) return false
  // TODO: Replace with proper admin role check
  return true
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { userId } = await auth()

    if (!isAdmin(userId)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const { leadId } = await params

    const client = await pool.connect()
    try {
      // Fetch lead details
      const leadResult = await client.query(
        'SELECT * FROM leads WHERE id = $1',
        [leadId]
      )

      if (leadResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Lead not found' },
          { status: 404 }
        )
      }

      const lead = leadResult.rows[0]

      // Fetch notes
      const notesResult = await client.query(
        `SELECT * FROM lead_notes
         WHERE lead_id = $1
         ORDER BY created_at DESC`,
        [leadId]
      )

      // Fetch activities
      const activitiesResult = await client.query(
        `SELECT * FROM lead_activities
         WHERE lead_id = $1
         ORDER BY created_at DESC`,
        [leadId]
      )

      return NextResponse.json({
        lead,
        notes: notesResult.rows,
        activities: activitiesResult.rows,
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching lead details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lead details' },
      { status: 500 }
    )
  }
}
