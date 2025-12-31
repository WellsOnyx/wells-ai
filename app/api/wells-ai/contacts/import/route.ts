/**
 * Contact Import API
 *
 * POST /api/wells-ai/contacts/import
 * Import contacts from CSV or CRM for matching against buyer requests
 */

import { NextRequest, NextResponse } from 'next/server'
import { ImportedContact, matchContactsToRequest, convertContactToSupplier, BuyerRequest } from '@/lib/wells-ai/scraping'
import { sendBatchOutreach } from '@/lib/wells-ai/scraping'

// ============================================================================
// CSV PARSING
// ============================================================================

function parseCSV(csvText: string): ImportedContact[] {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''))

  // Map common header variations
  const headerMap: Record<string, keyof ImportedContact> = {
    'email': 'email',
    'email address': 'email',
    'e-mail': 'email',
    'name': 'name',
    'full name': 'name',
    'contact name': 'name',
    'first name': 'name',
    'company': 'company',
    'company name': 'company',
    'organization': 'company',
    'title': 'title',
    'job title': 'title',
    'position': 'title',
    'industry': 'industry',
    'location': 'location',
    'city': 'location',
    'linkedin': 'linkedinUrl',
    'linkedin url': 'linkedinUrl',
    'linkedin profile': 'linkedinUrl',
  }

  const columnIndices: Partial<Record<keyof ImportedContact, number>> = {}
  headers.forEach((header, index) => {
    const mappedField = headerMap[header]
    if (mappedField) {
      columnIndices[mappedField] = index
    }
  })

  // Must have email column
  if (columnIndices.email === undefined) {
    throw new Error('CSV must have an email column')
  }

  const contacts: ImportedContact[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (!values.length) continue

    const email = values[columnIndices.email!]?.trim()
    if (!email || !isValidEmail(email)) continue

    const contact: ImportedContact = {
      email,
      source: 'csv',
    }

    if (columnIndices.name !== undefined) {
      contact.name = values[columnIndices.name]?.trim()
    }
    if (columnIndices.company !== undefined) {
      contact.company = values[columnIndices.company]?.trim()
    }
    if (columnIndices.title !== undefined) {
      contact.title = values[columnIndices.title]?.trim()
    }
    if (columnIndices.industry !== undefined) {
      contact.industry = values[columnIndices.industry]?.trim()
    }
    if (columnIndices.location !== undefined) {
      contact.location = values[columnIndices.location]?.trim()
    }
    if (columnIndices.linkedinUrl !== undefined) {
      contact.linkedinUrl = values[columnIndices.linkedinUrl]?.trim()
    }

    contacts.push(contact)
  }

  return contacts
}

function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim())

  return values
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ============================================================================
// IMPORT ENDPOINT
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''

    let contacts: ImportedContact[] = []

    if (contentType.includes('multipart/form-data')) {
      // File upload
      const formData = await request.formData()
      const file = formData.get('file') as File
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      const csvText = await file.text()
      contacts = parseCSV(csvText)
    } else {
      // JSON body
      const body = await request.json()

      if (body.csv) {
        // CSV text in body
        contacts = parseCSV(body.csv)
      } else if (Array.isArray(body.contacts)) {
        // Direct contact array
        contacts = body.contacts.map((c: Record<string, string>) => ({
          email: c.email,
          name: c.name,
          company: c.company,
          title: c.title,
          industry: c.industry,
          location: c.location,
          linkedinUrl: c.linkedinUrl,
          source: 'csv' as const,
        })).filter((c: ImportedContact) => c.email && isValidEmail(c.email))
      }
    }

    if (contacts.length === 0) {
      return NextResponse.json({ error: 'No valid contacts found' }, { status: 400 })
    }

    // TODO: Store contacts in database

    return NextResponse.json({
      success: true,
      imported: contacts.length,
      contacts: contacts.slice(0, 10),  // Return sample
    })
  } catch (error) {
    console.error('Contact import error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    )
  }
}

// ============================================================================
// MATCH CONTACTS TO REQUEST
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { contacts, buyerRequest, sendOutreach } = body

    if (!Array.isArray(contacts) || !buyerRequest) {
      return NextResponse.json(
        { error: 'contacts array and buyerRequest required' },
        { status: 400 }
      )
    }

    // Convert to ImportedContact format
    const importedContacts: ImportedContact[] = contacts.map((c: Record<string, string>) => ({
      ...c,
      source: 'csv' as const,
    }))

    // Build buyer request
    const request_: BuyerRequest = {
      id: buyerRequest.id,
      userId: buyerRequest.userId || 'manual',
      category: buyerRequest.category,
      subcategory: buyerRequest.subcategory,
      requirements: buyerRequest.requirements,
      budget: buyerRequest.budget,
      timeline: buyerRequest.timeline,
      location: buyerRequest.location,
      companyName: buyerRequest.companyName,
      createdAt: new Date(),
    }

    // Match contacts
    const matches = matchContactsToRequest(importedContacts, request_)

    // Optionally send outreach
    let outreachResults = []
    if (sendOutreach && matches.length > 0) {
      const suppliers = matches.map(convertContactToSupplier)
      outreachResults = await sendBatchOutreach({
        suppliers,
        buyerRequest: {
          id: request_.id,
          category: request_.category,
          requirements: request_.requirements,
          budget: request_.budget,
          timeline: request_.timeline,
          companyName: request_.companyName,
        },
        maxPerDay: 25,
      })
    }

    return NextResponse.json({
      success: true,
      totalContacts: importedContacts.length,
      matchedContacts: matches.length,
      outreachSent: outreachResults.length,
      matches: matches.slice(0, 20),
    })
  } catch (error) {
    console.error('Contact matching error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Matching failed' },
      { status: 500 }
    )
  }
}
