/**
 * CRM Single Contact API
 *
 * GET /api/crm/contacts/[id] - Get a single contact
 * PUT /api/crm/contacts/[id] - Update a contact
 * DELETE /api/crm/contacts/[id] - Delete a contact
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getContact,
  updateContact,
  deleteContact
} from '@/lib/crm/contacts'
import { getContactMessages } from '@/lib/crm/outreach'

// ============================================================================
// GET - Get a single contact by ID
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contactId = params.id
    const contact = await getContact(userId, contactId)

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    // Get message history if requested
    const { searchParams } = new URL(request.url)
    const includeMessages = searchParams.get('includeMessages') === 'true'

    let messages = undefined
    if (includeMessages) {
      messages = await getContactMessages(userId, contactId, { limit: 20 })
    }

    return NextResponse.json({
      contact,
      messages
    })
  } catch (error) {
    console.error('Error fetching contact:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contact' },
      { status: 500 }
    )
  }
}

// ============================================================================
// PUT - Update a contact
// ============================================================================

interface UpdateContactRequest {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  company?: string
  title?: string
  twitter_handle?: string
  linkedin_url?: string
  tags?: string[]
  status?: 'active' | 'unsubscribed' | 'bounced' | 'invalid'
  custom_fields?: Record<string, any>
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contactId = params.id
    const body = (await request.json()) as UpdateContactRequest

    // Check if contact exists
    const existing = await getContact(userId, contactId)
    if (!existing) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    // Update the contact
    const contact = await updateContact(userId, contactId, body)

    if (!contact) {
      return NextResponse.json(
        { error: 'No changes provided' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      contact
    })
  } catch (error) {
    console.error('Error updating contact:', error)
    return NextResponse.json(
      { error: 'Failed to update contact' },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE - Delete a single contact
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contactId = params.id
    const deleted = await deleteContact(userId, contactId)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      deleted: true
    })
  } catch (error) {
    console.error('Error deleting contact:', error)
    return NextResponse.json(
      { error: 'Failed to delete contact' },
      { status: 500 }
    )
  }
}
