import { NextResponse } from 'next/server'

/**
 * GTM Lead API - Log a new lead
 *
 * POST /api/gtm/lead
 *
 * Creates a new lead in the GTM pipeline
 */

export interface Lead {
  id: string
  company: string
  contact: string
  title: string
  email: string
  linkedIn?: string
  phone?: string
  status: 'cold' | 'contacted' | 'replied' | 'demo_scheduled' | 'demo_complete' | 'proposal' | 'won' | 'lost'
  source: 'linkedin' | 'apollo' | 'referral' | 'inbound' | 'other'
  industry?: string
  companySize?: string
  estimatedValue?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

// In-memory store for demo (replace with database in production)
const leads: Map<string, Lead> = new Map()

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate required fields
    const requiredFields = ['company', 'contact', 'email']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Create lead
    const lead: Lead = {
      id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      company: body.company,
      contact: body.contact,
      title: body.title || '',
      email: body.email,
      linkedIn: body.linkedIn || '',
      phone: body.phone || '',
      status: body.status || 'cold',
      source: body.source || 'other',
      industry: body.industry || '',
      companySize: body.companySize || '',
      estimatedValue: body.estimatedValue || 0,
      notes: body.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Store lead
    leads.set(lead.id, lead)

    return NextResponse.json({
      success: true,
      lead,
      message: 'Lead created successfully',
    })
  } catch (error) {
    console.error('Error creating lead:', error)
    return NextResponse.json(
      { error: 'Failed to create lead' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const source = searchParams.get('source')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let filteredLeads = Array.from(leads.values())

    // Apply filters
    if (status) {
      filteredLeads = filteredLeads.filter(l => l.status === status)
    }
    if (source) {
      filteredLeads = filteredLeads.filter(l => l.source === source)
    }

    // Sort by createdAt descending
    filteredLeads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Apply pagination
    const paginatedLeads = filteredLeads.slice(offset, offset + limit)

    return NextResponse.json({
      leads: paginatedLeads,
      total: filteredLeads.length,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Error fetching leads:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      )
    }

    const existingLead = leads.get(body.id)
    if (!existingLead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      )
    }

    // Update lead
    const updatedLead: Lead = {
      ...existingLead,
      ...body,
      updatedAt: new Date().toISOString(),
    }

    leads.set(body.id, updatedLead)

    return NextResponse.json({
      success: true,
      lead: updatedLead,
      message: 'Lead updated successfully',
    })
  } catch (error) {
    console.error('Error updating lead:', error)
    return NextResponse.json(
      { error: 'Failed to update lead' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      )
    }

    if (!leads.has(id)) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      )
    }

    leads.delete(id)

    return NextResponse.json({
      success: true,
      message: 'Lead deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting lead:', error)
    return NextResponse.json(
      { error: 'Failed to delete lead' },
      { status: 500 }
    )
  }
}
