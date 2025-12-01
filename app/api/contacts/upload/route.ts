// app/api/contacts/upload/route.ts
// Universal CSV contact import endpoint - accepts any CSV format with user-confirmed column mappings

import { PrismaClient } from '@prisma/client'
import Papa from 'papaparse'
import { NextRequest } from 'next/server'
import { applyMappings, splitFullName } from '@/lib/csv-analyzer'

// Lazy initialization
let prismaClient: PrismaClient | null = null

function getPrisma(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient()
  }
  return prismaClient
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const mappingsJSON = formData.get('mappings') as string | null

    if (!file) {
      return Response.json({
        error: 'No file uploaded',
        status: 400
      }, { status: 400 })
    }

    if (!mappingsJSON) {
      return Response.json({
        error: 'No column mappings provided. Use /api/contacts/analyze first to detect columns.',
        status: 400
      }, { status: 400 })
    }

    // Parse user-confirmed column mappings
    let mappings: { [sourceColumn: string]: string }
    try {
      mappings = JSON.parse(mappingsJSON)
    } catch (e) {
      return Response.json({
        error: 'Invalid mappings JSON',
        status: 400
      }, { status: 400 })
    }

    // Read file as text
    const fileText = await file.text()

    // Parse CSV with Papa Parse
    const parseResult = Papa.parse(fileText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim()
    })

    if (parseResult.errors.length > 0) {
      return Response.json({
        error: 'CSV parsing failed',
        details: parseResult.errors,
        status: 400
      }, { status: 400 })
    }

    const rows = parseResult.data as any[]

    if (rows.length === 0) {
      return Response.json({
        error: 'CSV file is empty',
        status: 400
      }, { status: 400 })
    }

    // Process rows and build contacts array
    const contacts = []
    const skipped = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]

      // Apply user-confirmed mappings to transform row
      const transformed = applyMappings(row, mappings)

      // Extract name fields (handle potential full_name column)
      let first_name = transformed.first_name || ''
      let last_name = transformed.last_name || ''

      // If full_name provided but no first/last, split it
      if (transformed.full_name && (!first_name || !last_name)) {
        const split = splitFullName(transformed.full_name)
        if (!first_name) first_name = split.firstName
        if (!last_name) last_name = split.lastName
      }

      const email = transformed.email || null
      const linkedin_url = transformed.linkedin_url || null

      // Require at least email OR linkedin URL
      if (!email && !linkedin_url) {
        skipped.push({
          row: i + 1,
          reason: 'Missing both email and LinkedIn URL',
          data: row
        })
        continue
      }

      // Require at least first name or last name
      if (!first_name && !last_name) {
        skipped.push({
          row: i + 1,
          reason: 'Missing contact name',
          data: row
        })
        continue
      }

      const contact = {
        first_name: first_name || null,
        last_name: last_name || null,
        email,
        linkedin_url,
        title: transformed.title || null,
        company_name: transformed.company_name || null,
        company_domain: transformed.company_domain || null,
        company_size: transformed.company_size || null,
        company_industry: transformed.company_industry || null,
        city: transformed.city || null,
        state: transformed.state || null,
        country: transformed.country || null,
        seniority_level: transformed.seniority_level || null,
        phone: transformed.phone || null,
        source: 'csv_import',
        status: 'new',
        raw_clay_data: row, // Store original row data
        created_at: new Date(),
        updated_at: new Date()
      }

      contacts.push(contact)
    }

    if (contacts.length === 0) {
      return Response.json({
        error: 'No valid contacts found in CSV',
        skipped,
        status: 400
      }, { status: 400 })
    }

    // Bulk insert into database
    const prisma = getPrisma()

    const result = await prisma.gtm_contacts.createMany({
      data: contacts,
      skipDuplicates: true // Skip if email/linkedin already exists
    })

    return Response.json({
      success: true,
      imported: result.count,
      totalRows: rows.length,
      skipped: skipped.length,
      skippedDetails: skipped.length > 0 ? skipped.slice(0, 10) : [], // Return first 10 skipped
      message: `Successfully imported ${result.count} contacts from ${rows.length} rows`,
      stats: {
        totalRows: rows.length,
        imported: result.count,
        skipped: skipped.length,
        duplicates: rows.length - result.count - skipped.length
      },
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startTime
    })

  } catch (error: any) {
    console.error('Contact upload error:', error)
    return Response.json({
      error: error.message || 'Failed to upload contacts',
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startTime
    }, { status: 500 })
  }
}

// GET endpoint for API documentation
export async function GET() {
  return Response.json({
    endpoint: '/api/contacts/upload',
    method: 'POST',
    description: 'Universal CSV contact import - accepts any CSV format with user-confirmed column mappings',
    workflow: [
      '1. Upload CSV to /api/contacts/analyze for format detection',
      '2. Review suggested column mappings',
      '3. Confirm/adjust mappings in UI',
      '4. Submit file + mappings to /api/contacts/upload'
    ],
    supportedFields: [
      'first_name',
      'last_name',
      'email',
      'linkedin_url',
      'title',
      'company_name',
      'company_domain',
      'company_size',
      'company_industry',
      'city',
      'state',
      'country',
      'seniority_level',
      'phone'
    ],
    requirements: {
      minimum: 'At least one: email OR linkedin_url',
      recommended: 'first_name, last_name, email, company_name, title',
      encoding: 'UTF-8',
      maxSize: '50MB'
    },
    formats: 'Supports any CSV format: Clay, LinkedIn Sales Nav, Google Contacts, HubSpot, Salesforce, etc.',
    example: {
      formData: {
        file: '<CSV file>',
        mappings: JSON.stringify({
          'Given Name': 'first_name',
          'Family Name': 'last_name',
          'E-mail 1 - Value': 'email'
        })
      }
    }
  })
}
