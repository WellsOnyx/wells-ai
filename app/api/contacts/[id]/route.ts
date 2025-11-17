import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

interface ContactUpdateData {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  linkedinUrl?: string
  company?: string
  title?: string
  department?: string
  seniority?: string
  location?: string
  city?: string
  state?: string
  country?: string
  companySize?: string
  companyRevenue?: string
  industry?: string
  companyType?: string
  keywords?: string[]
  bio?: string
  skills?: string[]
  targetingScore?: number
  targetingZone?: string
}

/**
 * Contact Detail API
 * GET /api/contacts/[id] - Retrieve single contact
 * PATCH /api/contacts/[id] - Update contact
 * DELETE /api/contacts/[id] - Delete contact
 */

/**
 * GET - Retrieve a single contact
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const authResult = await auth()
    const userId = authResult.userId

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Contact ID is required' },
        { status: 400 }
      )
    }

    // Find contact with user isolation
    const contact = await prisma.contact.findFirst({
      where: {
        id,
        userId // User isolation - critical!
      },
      include: {
        campaigns: {
          include: {
            campaign: {
              select: {
                id: true,
                name: true,
                status: true,
                useCase: true
              }
            }
          }
        },
        interactions: {
          orderBy: {
            timestamp: 'desc'
          },
          take: 10,
          select: {
            id: true,
            type: true,
            direction: true,
            subject: true,
            message: true,
            timestamp: true
          }
        }
      }
    })

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      contact
    })

  } catch (error: any) {
    console.error('Get contact error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve contact' },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Update a contact
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const authResult = await auth()
    const userId = authResult.userId

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Contact ID is required' },
        { status: 400 }
      )
    }

    // Parse request body
    const updates: ContactUpdateData = await request.json()

    // Validate email format if provided
    if (updates.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(updates.email)) {
        return NextResponse.json(
          { success: false, error: 'Invalid email format' },
          { status: 400 }
        )
      }

      // Check for duplicate email (excluding current contact)
      const existingContact = await prisma.contact.findFirst({
        where: {
          userId,
          email: updates.email,
          id: { not: id }
        }
      })

      if (existingContact) {
        return NextResponse.json(
          { success: false, error: 'Email already exists for another contact' },
          { status: 400 }
        )
      }
    }

    // Update contact with user isolation
    const contact = await prisma.contact.updateMany({
      where: {
        id,
        userId // User isolation - critical!
      },
      data: {
        ...updates,
        lastEnriched: new Date()
      }
    })

    if (contact.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Contact not found or unauthorized' },
        { status: 404 }
      )
    }

    // Fetch updated contact
    const updatedContact = await prisma.contact.findFirst({
      where: { id, userId }
    })

    return NextResponse.json({
      success: true,
      message: 'Contact updated successfully',
      contact: updatedContact
    })

  } catch (error: any) {
    console.error('Update contact error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update contact' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Delete a contact
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const authResult = await auth()
    const userId = authResult.userId

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Contact ID is required' },
        { status: 400 }
      )
    }

    // Delete contact with user isolation
    // Note: Related CampaignContact and Interaction records will be deleted via cascade
    const contact = await prisma.contact.deleteMany({
      where: {
        id,
        userId // User isolation - critical!
      }
    })

    if (contact.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Contact not found or unauthorized' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Contact deleted successfully'
    })

  } catch (error: any) {
    console.error('Delete contact error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete contact' },
      { status: 500 }
    )
  }
}
