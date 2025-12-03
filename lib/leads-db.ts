/**
 * Lead Database Operations
 *
 * Handles all database operations for the GTM lead capture system
 */

import { sql } from '@vercel/postgres'

// ============================================================================
// TYPES
// ============================================================================

export interface Lead {
  id: string
  userId: string
  userEmail: string
  userName: string
  userPhone?: string | null
  userCompany?: string | null

  journey: 'founder' | 'buyer' | 'seller' | 'jobs'
  requirements: string
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>

  status: 'new' | 'contacted' | 'in_progress' | 'closed' | 'won' | 'lost'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  source?: string

  // Extracted info
  intent?: string | null
  budget?: number | null
  timeline?: string | null

  // Contact tracking
  contactedAt?: Date | null
  contactedBy?: string | null
  lastContactAt?: Date | null

  // Timestamps
  createdAt: Date
  updatedAt: Date
  closedAt?: Date | null
}

export interface CreateLeadInput {
  userId: string
  userEmail: string
  userName: string
  userPhone?: string
  userCompany?: string

  journey: 'founder' | 'buyer' | 'seller' | 'jobs'
  requirements: string
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>

  priority?: 'low' | 'medium' | 'high' | 'urgent'
  source?: string

  // Optional extracted info
  intent?: string
  budget?: number
  timeline?: string
}

export interface UpdateLeadInput {
  status?: 'new' | 'contacted' | 'in_progress' | 'closed' | 'won' | 'lost'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  contactedAt?: Date
  contactedBy?: string
  requirements?: string
}

export interface LeadNote {
  id: string
  leadId: string
  note: string
  noteType: 'general' | 'call' | 'email' | 'meeting' | 'follow_up'
  createdBy: string
  createdAt: Date
}

export interface LeadActivity {
  id: string
  leadId: string
  activityType: 'created' | 'status_changed' | 'contacted' | 'note_added' | 'email_sent'
  activityData?: Record<string, any>
  performedBy?: string
  createdAt: Date
}

// ============================================================================
// LEAD OPERATIONS
// ============================================================================

/**
 * Create a new lead
 */
export async function createLead(input: CreateLeadInput): Promise<Lead> {
  try {
    const result = await sql`
      INSERT INTO leads (
        user_id,
        user_email,
        user_name,
        user_phone,
        user_company,
        journey,
        requirements,
        conversation_history,
        priority,
        source,
        intent,
        budget,
        timeline,
        status
      ) VALUES (
        ${input.userId},
        ${input.userEmail},
        ${input.userName},
        ${input.userPhone || null},
        ${input.userCompany || null},
        ${input.journey},
        ${input.requirements},
        ${JSON.stringify(input.conversationHistory)},
        ${input.priority || 'medium'},
        ${input.source || 'chat'},
        ${input.intent || null},
        ${input.budget || null},
        ${input.timeline || null},
        'new'
      )
      RETURNING *
    `

    const lead = result.rows[0] as any

    // Create activity log
    await createActivity({
      leadId: lead.id,
      activityType: 'created',
      activityData: { journey: input.journey, source: input.source },
      performedBy: input.userId,
    })

    return mapLeadFromDb(lead)
  } catch (error) {
    console.error('Error creating lead:', error)
    throw new Error('Failed to create lead')
  }
}

/**
 * Get a lead by ID
 */
export async function getLead(leadId: string): Promise<Lead | null> {
  try {
    const result = await sql`
      SELECT * FROM leads WHERE id = ${leadId}
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapLeadFromDb(result.rows[0] as any)
  } catch (error) {
    console.error('Error fetching lead:', error)
    throw new Error('Failed to fetch lead')
  }
}

/**
 * Get all leads (with optional filters)
 */
export async function getLeads(filters?: {
  status?: string
  journey?: string
  priority?: string
  userId?: string
  limit?: number
  offset?: number
}): Promise<{ leads: Lead[]; total: number }> {
  try {
    // Build WHERE clause
    const conditions: string[] = []
    const params: any[] = []

    if (filters?.status) {
      conditions.push(`status = $${params.length + 1}`)
      params.push(filters.status)
    }
    if (filters?.journey) {
      conditions.push(`journey = $${params.length + 1}`)
      params.push(filters.journey)
    }
    if (filters?.priority) {
      conditions.push(`priority = $${params.length + 1}`)
      params.push(filters.priority)
    }
    if (filters?.userId) {
      conditions.push(`user_id = $${params.length + 1}`)
      params.push(filters.userId)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = filters?.limit || 100
    const offset = filters?.offset || 0

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM leads ${whereClause}`
    const countResult = await sql.query(countQuery, params)
    const total = parseInt(countResult.rows[0].count)

    // Get leads
    const leadsQuery = `
      SELECT * FROM leads
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `
    const leadsResult = await sql.query(leadsQuery, [...params, limit, offset])

    const leads = leadsResult.rows.map(mapLeadFromDb)

    return { leads, total }
  } catch (error) {
    console.error('Error fetching leads:', error)
    throw new Error('Failed to fetch leads')
  }
}

/**
 * Update a lead
 */
export async function updateLead(leadId: string, updates: UpdateLeadInput, updatedBy?: string): Promise<Lead> {
  try {
    const setClauses: string[] = []
    const params: any[] = []

    if (updates.status) {
      setClauses.push(`status = $${params.length + 1}`)
      params.push(updates.status)
    }
    if (updates.priority) {
      setClauses.push(`priority = $${params.length + 1}`)
      params.push(updates.priority)
    }
    if (updates.contactedAt) {
      setClauses.push(`contacted_at = $${params.length + 1}`)
      params.push(updates.contactedAt)
      setClauses.push(`last_contact_at = $${params.length + 1}`)
      params.push(updates.contactedAt)
    }
    if (updates.contactedBy) {
      setClauses.push(`contacted_by = $${params.length + 1}`)
      params.push(updates.contactedBy)
    }
    if (updates.requirements) {
      setClauses.push(`requirements = $${params.length + 1}`)
      params.push(updates.requirements)
    }

    setClauses.push(`updated_at = NOW()`)

    if (updates.status === 'closed' || updates.status === 'won' || updates.status === 'lost') {
      setClauses.push(`closed_at = NOW()`)
    }

    const updateQuery = `
      UPDATE leads
      SET ${setClauses.join(', ')}
      WHERE id = $${params.length + 1}
      RETURNING *
    `
    const result = await sql.query(updateQuery, [...params, leadId])

    if (result.rows.length === 0) {
      throw new Error('Lead not found')
    }

    const lead = mapLeadFromDb(result.rows[0])

    // Create activity log for status change
    if (updates.status) {
      await createActivity({
        leadId,
        activityType: 'status_changed',
        activityData: { newStatus: updates.status },
        performedBy: updatedBy,
      })
    }

    if (updates.contactedAt) {
      await createActivity({
        leadId,
        activityType: 'contacted',
        activityData: { contactedBy: updates.contactedBy },
        performedBy: updatedBy,
      })
    }

    return lead
  } catch (error) {
    console.error('Error updating lead:', error)
    throw new Error('Failed to update lead')
  }
}

/**
 * Get leads for a specific user
 */
export async function getLeadsByUser(userId: string): Promise<Lead[]> {
  const { leads } = await getLeads({ userId })
  return leads
}

// ============================================================================
// LEAD NOTES
// ============================================================================

/**
 * Add a note to a lead
 */
export async function addLeadNote(
  leadId: string,
  note: string,
  createdBy: string,
  noteType: LeadNote['noteType'] = 'general'
): Promise<LeadNote> {
  try {
    const result = await sql`
      INSERT INTO lead_notes (lead_id, note, note_type, created_by)
      VALUES (${leadId}, ${note}, ${noteType}, ${createdBy})
      RETURNING *
    `

    // Create activity
    await createActivity({
      leadId,
      activityType: 'note_added',
      activityData: { noteType },
      performedBy: createdBy,
    })

    return mapLeadNoteFromDb(result.rows[0])
  } catch (error) {
    console.error('Error adding lead note:', error)
    throw new Error('Failed to add lead note')
  }
}

/**
 * Get notes for a lead
 */
export async function getLeadNotes(leadId: string): Promise<LeadNote[]> {
  try {
    const result = await sql`
      SELECT * FROM lead_notes
      WHERE lead_id = ${leadId}
      ORDER BY created_at DESC
    `

    return result.rows.map(mapLeadNoteFromDb)
  } catch (error) {
    console.error('Error fetching lead notes:', error)
    throw new Error('Failed to fetch lead notes')
  }
}

// ============================================================================
// LEAD ACTIVITIES
// ============================================================================

/**
 * Create an activity log entry
 */
export async function createActivity(activity: {
  leadId: string
  activityType: LeadActivity['activityType']
  activityData?: Record<string, any>
  performedBy?: string
}): Promise<LeadActivity> {
  try {
    const result = await sql`
      INSERT INTO lead_activities (lead_id, activity_type, activity_data, performed_by)
      VALUES (
        ${activity.leadId},
        ${activity.activityType},
        ${JSON.stringify(activity.activityData || {})},
        ${activity.performedBy || null}
      )
      RETURNING *
    `

    return mapLeadActivityFromDb(result.rows[0])
  } catch (error) {
    console.error('Error creating activity:', error)
    throw new Error('Failed to create activity')
  }
}

/**
 * Get activities for a lead
 */
export async function getLeadActivities(leadId: string): Promise<LeadActivity[]> {
  try {
    const result = await sql`
      SELECT * FROM lead_activities
      WHERE lead_id = ${leadId}
      ORDER BY created_at DESC
    `

    return result.rows.map(mapLeadActivityFromDb)
  } catch (error) {
    console.error('Error fetching lead activities:', error)
    throw new Error('Failed to fetch lead activities')
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function mapLeadFromDb(row: any): Lead {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    userName: row.user_name,
    userPhone: row.user_phone,
    userCompany: row.user_company,
    journey: row.journey,
    requirements: row.requirements,
    conversationHistory: row.conversation_history,
    status: row.status,
    priority: row.priority,
    source: row.source,
    intent: row.intent,
    budget: row.budget ? parseFloat(row.budget) : null,
    timeline: row.timeline,
    contactedAt: row.contacted_at,
    contactedBy: row.contacted_by,
    lastContactAt: row.last_contact_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
  }
}

function mapLeadNoteFromDb(row: any): LeadNote {
  return {
    id: row.id,
    leadId: row.lead_id,
    note: row.note,
    noteType: row.note_type,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

function mapLeadActivityFromDb(row: any): LeadActivity {
  return {
    id: row.id,
    leadId: row.lead_id,
    activityType: row.activity_type,
    activityData: row.activity_data,
    performedBy: row.performed_by,
    createdAt: row.created_at,
  }
}
