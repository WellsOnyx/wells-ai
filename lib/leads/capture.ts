/**
 * Lead Capture Utilities
 *
 * Automatically capture leads when users interact with Wells.
 * Stores conversation history and extracts requirements.
 */

import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})

export interface CaptureLeadParams {
  userId: string
  userEmail: string
  userName: string
  userPhone?: string
  userCompany?: string
  journey: 'founder' | 'buyer' | 'seller' | 'jobs'
  conversationHistory: Array<{ role: string; content: string }>
  source?: string
}

/**
 * Capture or update a lead from a conversation
 */
export async function captureLead(params: CaptureLeadParams): Promise<string> {
  const client = await pool.connect()

  try {
    // Extract requirements from conversation (last user message)
    const userMessages = params.conversationHistory.filter((m) => m.role === 'user')
    const requirements = userMessages.length > 0
      ? userMessages[userMessages.length - 1].content
      : 'No requirements specified'

    // Check if lead already exists for this user
    const existingLead = await client.query(
      'SELECT id FROM leads WHERE user_id = $1 AND journey = $2 ORDER BY created_at DESC LIMIT 1',
      [params.userId, params.journey]
    )

    if (existingLead.rows.length > 0) {
      // Update existing lead
      const leadId = existingLead.rows[0].id

      await client.query(
        `UPDATE leads
         SET
           conversation_history = $1,
           requirements = $2,
           updated_at = NOW()
         WHERE id = $3`,
        [JSON.stringify(params.conversationHistory), requirements, leadId]
      )

      return leadId
    } else {
      // Create new lead
      const result = await client.query(
        `INSERT INTO leads (
          user_id,
          user_email,
          user_name,
          user_phone,
          user_company,
          journey,
          requirements,
          conversation_history,
          source,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id`,
        [
          params.userId,
          params.userEmail,
          params.userName,
          params.userPhone,
          params.userCompany,
          params.journey,
          requirements,
          JSON.stringify(params.conversationHistory),
          params.source || 'chat',
          'new',
        ]
      )

      // Log activity
      await client.query(
        `INSERT INTO lead_activities (lead_id, activity_type, performed_by)
         VALUES ($1, $2, $3)`,
        [result.rows[0].id, 'created', params.userId]
      )

      return result.rows[0].id
    }
  } finally {
    client.release()
  }
}

/**
 * Add a note to a lead
 */
export async function addLeadNote(
  leadId: string,
  note: string,
  noteType: string = 'general',
  createdBy: string
): Promise<void> {
  const client = await pool.connect()

  try {
    await client.query(
      `INSERT INTO lead_notes (lead_id, note, note_type, created_by)
       VALUES ($1, $2, $3, $4)`,
      [leadId, note, noteType, createdBy]
    )

    await client.query(
      `INSERT INTO lead_activities (lead_id, activity_type, performed_by)
       VALUES ($1, $2, $3)`,
      [leadId, 'note_added', createdBy]
    )
  } finally {
    client.release()
  }
}

/**
 * Update lead status
 */
export async function updateLeadStatus(
  leadId: string,
  status: string,
  updatedBy: string
): Promise<void> {
  const client = await pool.connect()

  try {
    await client.query(
      `UPDATE leads
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      [status, leadId]
    )

    await client.query(
      `INSERT INTO lead_activities (
        lead_id,
        activity_type,
        activity_data,
        performed_by
      ) VALUES ($1, $2, $3, $4)`,
      [leadId, 'status_changed', JSON.stringify({ newStatus: status }), updatedBy]
    )
  } finally {
    client.release()
  }
}
