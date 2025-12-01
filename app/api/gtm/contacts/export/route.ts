// app/api/gtm/contacts/export/route.ts
// API endpoint to export GTM contacts to CSV

import { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server'

let prismaClient: PrismaClient | null = null

function getPrisma(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient()
  }
  return prismaClient
}

// Convert contacts to CSV format
function contactsToCSV(contacts: any[]): string {
  if (contacts.length === 0) return ''

  // Define headers
  const headers = [
    'First Name',
    'Last Name',
    'Email',
    'Title',
    'Company Name',
    'Company Domain',
    'Company Industry',
    'Company Size',
    'LinkedIn URL',
    'City',
    'State',
    'Country',
    'Seniority Level',
    'Status',
    'Source',
    'Created At'
  ]

  // Build CSV rows
  const rows = contacts.map(contact => [
    contact.first_name || '',
    contact.last_name || '',
    contact.email || '',
    contact.title || '',
    contact.company_name || '',
    contact.company_domain || '',
    contact.company_industry || '',
    contact.company_size || '',
    contact.linkedin_url || '',
    contact.city || '',
    contact.state || '',
    contact.country || '',
    contact.seniority_level || '',
    contact.status || '',
    contact.source || '',
    new Date(contact.created_at).toISOString()
  ])

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n')

  return csvContent
}

// Escape CSV values (handle commas, quotes, newlines)
function escapeCSV(value: string): string {
  if (!value) return ''

  const stringValue = String(value)

  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

// POST endpoint for exporting selected contacts
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { contactIds } = body

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return Response.json({
        error: 'No contact IDs provided',
        status: 400
      }, { status: 400 })
    }

    const prisma = getPrisma()

    // Fetch contacts by IDs
    const contacts = await prisma.gtm_contacts.findMany({
      where: {
        id: { in: contactIds }
      },
      orderBy: { created_at: 'desc' }
    })

    if (contacts.length === 0) {
      return Response.json({
        error: 'No contacts found',
        status: 404
      }, { status: 404 })
    }

    // Generate CSV
    const csv = contactsToCSV(contacts)

    // Return CSV file
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="contacts-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })

  } catch (error: any) {
    console.error('Contact export error:', error)
    return Response.json({
      error: error.message || 'Failed to export contacts',
      status: 500
    }, { status: 500 })
  }
}

// GET endpoint for exporting all contacts matching filters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    // Search query
    const q = searchParams.get('q') || ''

    // Filters
    const industry = searchParams.get('industry') || ''
    const companySize = searchParams.get('company_size') || ''
    const seniority = searchParams.get('seniority') || ''
    const status = searchParams.get('status') || ''
    const state = searchParams.get('state') || ''

    const prisma = getPrisma()

    // Build where clause (same as search endpoint)
    const where: any = {}
    const AND: any[] = []

    if (q) {
      AND.push({
        OR: [
          { first_name: { contains: q, mode: 'insensitive' } },
          { last_name: { contains: q, mode: 'insensitive' } },
          { company_name: { contains: q, mode: 'insensitive' } },
          { title: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } }
        ]
      })
    }

    if (industry) AND.push({ company_industry: { contains: industry, mode: 'insensitive' } })
    if (companySize) AND.push({ company_size: companySize })
    if (seniority) AND.push({ seniority_level: seniority })
    if (status) AND.push({ status })
    if (state) AND.push({ state })

    if (AND.length > 0) where.AND = AND

    // Fetch all matching contacts (no pagination for export)
    const contacts = await prisma.gtm_contacts.findMany({
      where,
      orderBy: { created_at: 'desc' }
    })

    if (contacts.length === 0) {
      return Response.json({
        error: 'No contacts found matching filters',
        status: 404
      }, { status: 404 })
    }

    // Generate CSV
    const csv = contactsToCSV(contacts)

    // Return CSV file
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="contacts-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })

  } catch (error: any) {
    console.error('Contact export error:', error)
    return Response.json({
      error: error.message || 'Failed to export contacts',
      status: 500
    }, { status: 500 })
  }
}
