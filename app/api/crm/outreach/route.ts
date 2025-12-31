/**
 * CRM Quick Outreach API
 *
 * POST /api/crm/outreach - Send outreach to selected contacts
 * GET /api/crm/outreach - Get outreach history
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  sendOutreach,
  sendBulkOutreach,
  getContactMessages
} from '@/lib/crm/outreach'
import { getContact } from '@/lib/crm/contacts'
import { query } from '@/lib/db'
import type { OutreachRequest, OutreachMessage } from '@/lib/crm/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // Allow up to 2 minutes for bulk sends

// ============================================================================
// POST - Send outreach to contacts
// ============================================================================

interface QuickOutreachRequest {
  // Single contact
  contactId?: string

  // Multiple contacts
  contactIds?: string[]

  // Message content
  channel: 'email' | 'sms' | 'twitter' | 'linkedin'
  subject?: string
  body: string

  // Optional settings
  scheduledAt?: string
  campaignName?: string
  templateId?: string
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as QuickOutreachRequest

    // Validate required fields
    if (!body.channel) {
      return NextResponse.json(
        { error: 'Channel is required (email, sms, twitter, or linkedin)' },
        { status: 400 }
      )
    }

    if (!body.body) {
      return NextResponse.json(
        { error: 'Message body is required' },
        { status: 400 }
      )
    }

    // Validate channel
    const validChannels = ['email', 'sms', 'twitter', 'linkedin']
    if (!validChannels.includes(body.channel)) {
      return NextResponse.json(
        { error: `Invalid channel. Must be one of: ${validChannels.join(', ')}` },
        { status: 400 }
      )
    }

    // Email requires subject
    if (body.channel === 'email' && !body.subject) {
      return NextResponse.json(
        { error: 'Subject is required for email outreach' },
        { status: 400 }
      )
    }

    // Determine if single or bulk send
    const contactIds = body.contactIds || (body.contactId ? [body.contactId] : [])

    if (contactIds.length === 0) {
      return NextResponse.json(
        { error: 'contactId or contactIds is required' },
        { status: 400 }
      )
    }

    // Limit bulk sends
    if (contactIds.length > 100) {
      return NextResponse.json(
        { error: 'Cannot send to more than 100 contacts at once. Use campaigns for larger sends.' },
        { status: 400 }
      )
    }

    // Single contact send
    if (contactIds.length === 1) {
      const result = await sendOutreach(userId, contactIds[0], body.channel, {
        subject: body.subject,
        body: body.body,
        templateId: body.templateId
      })

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        externalId: result.externalId
      })
    }

    // Bulk send
    const outreachRequest: OutreachRequest = {
      contactIds,
      channel: body.channel,
      subject: body.subject,
      body: body.body,
      scheduledAt: body.scheduledAt,
      campaignName: body.campaignName
    }

    const result = await sendBulkOutreach(userId, outreachRequest)

    return NextResponse.json({
      success: true,
      result: {
        total: result.total,
        queued: result.queued,
        sent: result.sent,
        failed: result.failed,
        errors: result.errors.slice(0, 10)
      }
    })
  } catch (error) {
    console.error('Error sending outreach:', error)
    return NextResponse.json(
      { error: 'Failed to send outreach' },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Get outreach history
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // Get messages for a specific contact
    const contactId = searchParams.get('contactId')
    if (contactId) {
      const messages = await getContactMessages(userId, contactId, {
        limit: parseInt(searchParams.get('limit') || '50', 10),
        offset: parseInt(searchParams.get('offset') || '0', 10)
      })

      const contact = await getContact(userId, contactId)

      return NextResponse.json({
        contact,
        messages
      })
    }

    // Get all recent messages
    const status = searchParams.get('status') || undefined
    const channel = searchParams.get('channel') || undefined
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    let whereClause = 'WHERE m.user_id = $1'
    const params: any[] = [userId]
    let paramIndex = 2

    if (status) {
      whereClause += ` AND m.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    if (channel) {
      whereClause += ` AND m.channel = $${paramIndex}`
      params.push(channel)
      paramIndex++
    }

    // Get total count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM crm_messages m ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0]?.count || '0', 10)

    // Get messages with contact info
    const result = await query<OutreachMessage & {
      contact_first_name: string
      contact_last_name: string
      contact_email: string
    }>(
      `SELECT m.*,
        c.first_name as contact_first_name,
        c.last_name as contact_last_name,
        c.email as contact_email
      FROM crm_messages m
      LEFT JOIN crm_contacts c ON m.contact_id = c.id
      ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    )

    return NextResponse.json({
      messages: result.rows,
      total,
      limit,
      offset,
      hasMore: offset + result.rows.length < total
    })
  } catch (error) {
    console.error('Error fetching outreach history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch outreach history' },
      { status: 500 }
    )
  }
}
