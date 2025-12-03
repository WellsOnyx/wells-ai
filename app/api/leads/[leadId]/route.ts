/**
 * Single Lead API
 *
 * GET - Get lead details
 * PATCH - Update lead status/details
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { getLead, updateLead, getLeadNotes, getLeadActivities, addLeadNote } from '@/lib/leads-db'

// ============================================================================
// GET - Get lead details
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { leadId } = await params

    // Get the lead
    const lead = await getLead(leadId)

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Check if user has access (admin or owner)
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const isAdmin = user.publicMetadata?.role === 'admin' || user.publicMetadata?.isAdmin === true

    if (!isAdmin && lead.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get additional data
    const notes = await getLeadNotes(leadId)
    const activities = await getLeadActivities(leadId)

    return NextResponse.json({
      lead,
      notes,
      activities,
    })
  } catch (error) {
    console.error('Error fetching lead:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lead' },
      { status: 500 }
    )
  }
}

// ============================================================================
// PATCH - Update lead
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { leadId } = await params

    // Get the lead
    const lead = await getLead(leadId)

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Check if user has access (admin only for updates)
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const isAdmin = user.publicMetadata?.role === 'admin' || user.publicMetadata?.isAdmin === true

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const body = await request.json()

    // Update the lead
    const updates: any = {}
    if (body.status) updates.status = body.status
    if (body.priority) updates.priority = body.priority
    if (body.requirements) updates.requirements = body.requirements

    // If marking as contacted, set contacted fields
    if (body.status === 'contacted' || body.contacted) {
      updates.contactedAt = new Date()
      updates.contactedBy = userId
    }

    const updatedLead = await updateLead(leadId, updates, userId)

    // If there's a note, add it
    if (body.note) {
      await addLeadNote(leadId, body.note, userId, body.noteType || 'general')
    }

    return NextResponse.json({
      success: true,
      lead: updatedLead,
    })
  } catch (error) {
    console.error('Error updating lead:', error)
    return NextResponse.json(
      { error: 'Failed to update lead' },
      { status: 500 }
    )
  }
}
