import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

interface CSVRow {
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
  keywords?: string
  bio?: string
  skills?: string
  [key: string]: string | undefined
}

interface ValidationError {
  row: number
  field: string
  message: string
  data: CSVRow
}

interface UploadResult {
  success: boolean
  batchId?: string
  totalRows: number
  validRows: number
  duplicates: number
  errors: number
  errorDetails?: ValidationError[]
  message: string
}

const BATCH_SIZE = 1000
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * Parse CSV content into rows
 */
function parseCSV(content: string): CSVRow[] {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length === 0) return []

  const headers = lines[0].split(',').map(h => h.trim())
  const rows: CSVRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    const row: CSVRow = {}

    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })

    rows.push(row)
  }

  return rows
}

/**
 * Validate a contact row
 */
function validateRow(row: CSVRow, rowNumber: number): ValidationError | null {
  // Required fields
  if (!row.firstName || row.firstName.trim() === '') {
    return {
      row: rowNumber,
      field: 'firstName',
      message: 'First name is required',
      data: row
    }
  }

  if (!row.lastName || row.lastName.trim() === '') {
    return {
      row: rowNumber,
      field: 'lastName',
      message: 'Last name is required',
      data: row
    }
  }

  if (!row.email || row.email.trim() === '') {
    return {
      row: rowNumber,
      field: 'email',
      message: 'Email is required',
      data: row
    }
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(row.email)) {
    return {
      row: rowNumber,
      field: 'email',
      message: 'Invalid email format',
      data: row
    }
  }

  return null
}

/**
 * CSV Upload API
 * POST /api/contacts/upload
 *
 * Accepts CSV files with contact data
 * - Batch processing (1000 records at a time)
 * - Duplicate detection (by email per user)
 * - Field validation (required: firstName, lastName, email)
 * - Progress tracking
 * - Error reporting
 * - User isolation (Clerk userId)
 */
export async function POST(request: NextRequest) {
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

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      )
    }

    // Check file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { success: false, error: 'Only CSV files are supported' },
        { status: 400 }
      )
    }

    // Read file content
    const content = await file.text()

    if (!content || content.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'File is empty' },
        { status: 400 }
      )
    }

    // Parse CSV
    const rows = parseCSV(content)

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No data found in CSV' },
        { status: 400 }
      )
    }

    // Validate rows and collect errors
    const validationErrors: ValidationError[] = []
    const validRows: CSVRow[] = []

    rows.forEach((row, index) => {
      const error = validateRow(row, index + 2) // +2 because index starts at 0 and row 1 is headers
      if (error) {
        validationErrors.push(error)
      } else {
        validRows.push(row)
      }
    })

    // Create upload batch record
    const uploadBatch = await prisma.uploadBatch.create({
      data: {
        userId,
        filename: file.name,
        totalRows: rows.length,
        validRows: validRows.length,
        duplicates: 0, // Will be updated during processing
        errors: validationErrors.length,
        status: 'processing',
        errorLog: validationErrors.length > 0 ? validationErrors : null
      }
    })

    // Process valid rows in batches
    let duplicateCount = 0
    let insertedCount = 0

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE)

      // Check for duplicates in this batch
      const emails = batch.map(row => row.email!).filter(Boolean)
      const existingContacts = await prisma.contact.findMany({
        where: {
          userId,
          email: { in: emails }
        },
        select: { email: true }
      })

      const existingEmails = new Set(existingContacts.map(c => c.email))

      // Insert non-duplicate contacts
      const contactsToInsert = batch
        .filter(row => !existingEmails.has(row.email!))
        .map(row => ({
          userId,
          firstName: row.firstName!,
          lastName: row.lastName!,
          email: row.email!,
          phone: row.phone || null,
          linkedinUrl: row.linkedinUrl || null,
          company: row.company || null,
          title: row.title || null,
          department: row.department || null,
          seniority: row.seniority || null,
          location: row.location || null,
          city: row.city || null,
          state: row.state || null,
          country: row.country || null,
          companySize: row.companySize || null,
          companyRevenue: row.companyRevenue || null,
          industry: row.industry || null,
          companyType: row.companyType || null,
          keywords: row.keywords ? row.keywords.split(';').map(k => k.trim()) : [],
          bio: row.bio || null,
          skills: row.skills ? row.skills.split(';').map(s => s.trim()) : [],
          source: 'uploaded',
          uploadedAt: new Date()
        }))

      if (contactsToInsert.length > 0) {
        await prisma.contact.createMany({
          data: contactsToInsert,
          skipDuplicates: true
        })
        insertedCount += contactsToInsert.length
      }

      duplicateCount += batch.length - contactsToInsert.length
    }

    // Update upload batch with final counts
    await prisma.uploadBatch.update({
      where: { id: uploadBatch.id },
      data: {
        duplicates: duplicateCount,
        status: 'completed',
        completedAt: new Date()
      }
    })

    const result: UploadResult = {
      success: true,
      batchId: uploadBatch.id,
      totalRows: rows.length,
      validRows: insertedCount,
      duplicates: duplicateCount,
      errors: validationErrors.length,
      message: `Successfully uploaded ${insertedCount} contacts. ${duplicateCount} duplicates skipped. ${validationErrors.length} errors.`
    }

    // Include error details if there are any (limit to first 100)
    if (validationErrors.length > 0) {
      result.errorDetails = validationErrors.slice(0, 100)
    }

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('CSV upload error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to upload CSV',
        totalRows: 0,
        validRows: 0,
        duplicates: 0,
        errors: 0
      },
      { status: 500 }
    )
  }
}
