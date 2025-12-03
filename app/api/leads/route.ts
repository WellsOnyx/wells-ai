/**
 * Leads API
 *
 * Manages GTM lead capture and retrieval
 *
 * POST - Create a new lead
 * GET - List all leads (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createLead, getLeads, type CreateLeadInput } from '@/lib/leads-db'
import { notifyNewLead } from '@/lib/notifications'

// ============================================================================
// POST - Create a new lead
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.journey || !body.requirements) {
      return NextResponse.json(
        { error: 'Missing required fields: journey, requirements' },
        { status: 400 }
      )
    }

    // Get user details from Clerk
    const client = await clerkClient()
    const user = await client.users.getUser(userId)

    const userEmail = body.userEmail || user.primaryEmailAddress?.emailAddress
    const userName = body.userName || [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown'
    const userPhone = body.userPhone || user.primaryPhoneNumber?.phoneNumber
    const userCompany = body.userCompany || (user.publicMetadata?.company as string)

    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 })
    }

    // Create lead input
    const leadInput: CreateLeadInput = {
      userId,
      userEmail,
      userName,
      userPhone,
      userCompany,
      journey: body.journey,
      requirements: body.requirements,
      conversationHistory: body.conversationHistory || [],
      priority: body.priority || 'medium',
      source: body.source || 'chat',
      intent: body.intent,
      budget: body.budget,
      timeline: body.timeline,
    }

    // Create the lead
    const lead = await createLead(leadInput)

    // Send notifications asynchronously (don't wait)
    notifyNewLead(lead).catch((error) => {
      console.error('Error sending lead notification:', error)
    })

    return NextResponse.json({
      success: true,
      lead: {
        id: lead.id,
        journey: lead.journey,
        status: lead.status,
        createdAt: lead.createdAt,
      },
      message: 'Lead captured successfully. Our team will reach out within 24 hours.',
    })
  } catch (error) {
    console.error('Error creating lead:', error)
    return NextResponse.json(
      { error: 'Failed to create lead' },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - List leads (admin only)
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin (you can customize this check)
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const isAdmin = user.publicMetadata?.role === 'admin' || user.publicMetadata?.isAdmin === true

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined
    const journey = searchParams.get('journey') || undefined
    const priority = searchParams.get('priority') || undefined
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // If not admin, only show their own leads
    const filters = {
      status,
      journey,
      priority,
      userId: isAdmin ? undefined : userId,
      limit,
      offset,
    }

    const { leads, total } = await getLeads(filters)

    return NextResponse.json({
      leads: leads.map((lead) => ({
        id: lead.id,
        userId: lead.userId,
        userEmail: lead.userEmail,
        userName: lead.userName,
        userPhone: lead.userPhone,
        userCompany: lead.userCompany,
        journey: lead.journey,
        requirements: lead.requirements,
        status: lead.status,
        priority: lead.priority,
        intent: lead.intent,
        budget: lead.budget,
        timeline: lead.timeline,
        contactedAt: lead.contactedAt,
        contactedBy: lead.contactedBy,
        createdAt: lead.createdAt,
        // Don't include full conversation history in list view
        conversationPreview:
          lead.conversationHistory && lead.conversationHistory.length > 0
            ? lead.conversationHistory[lead.conversationHistory.length - 1]
            : null,
      })),
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Error fetching leads:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    )
  }
}
