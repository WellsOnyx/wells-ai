// @ts-nocheck
/**
 * Contact Ingestion System
 *
 * Handles CSV uploads through conversation, not forms.
 * - Parse CSVs with flexible column mapping
 * - Deduplicate contacts intelligently
 * - Enrich contacts (infer company from email domain)
 * - Store efficiently for 150K+ contacts
 * - Handle via chat, not UI
 */

import { query, withTransaction } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

export interface ContactUpload {
  id: string
  userId: string
  filename: string
  fileSizeBytes: number
  totalRows: number
  validContacts: number
  duplicateContacts: number
  invalidContacts: number
  enrichedContacts: number
  columnMapping: Record<string, string>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  errorMessage?: string
  createdAt: Date
}

export interface Contact {
  id: string
  userId: string
  email?: string
  phone?: string
  linkedinUrl?: string
  twitterHandle?: string
  firstName?: string
  lastName?: string
  title?: string
  department?: string
  seniority?: string
  companyName?: string
  companyDomain?: string
  companySize?: string
  industry?: string
  city?: string
  state?: string
  country?: string
  icpScore: number
  segment?: string
  tags: string[]
  status: 'new' | 'qualified' | 'contacted' | 'responded' | 'meeting_booked' | 'converted' | 'unsubscribed' | 'bounced'
}

export interface ParsedCSVResult {
  headers: string[]
  rows: Record<string, string>[]
  totalRows: number
  sampleRows: Record<string, string>[]
  suggestedMapping: Record<string, string>
  detectedFormat: string
}

export interface IngestionResult {
  uploadId: string
  totalProcessed: number
  validContacts: number
  duplicates: number
  invalid: number
  enriched: number
  sampleContacts: Contact[]
  warnings: string[]
}

// ============================================================================
// COLUMN MAPPING - Smart Detection
// ============================================================================

// Common column name variations we support
const COLUMN_ALIASES: Record<string, string[]> = {
  email: ['email', 'e-mail', 'email address', 'email_address', 'emailaddress', 'work email', 'primary email', 'contact email'],
  first_name: ['first name', 'first_name', 'firstname', 'first', 'given name', 'fname'],
  last_name: ['last name', 'last_name', 'lastname', 'last', 'surname', 'family name', 'lname'],
  full_name: ['full name', 'full_name', 'fullname', 'name', 'contact name', 'person name'],
  phone: ['phone', 'phone number', 'phone_number', 'telephone', 'mobile', 'cell', 'direct phone', 'work phone'],
  title: ['title', 'job title', 'job_title', 'jobtitle', 'position', 'role', 'designation'],
  company: ['company', 'company name', 'company_name', 'companyname', 'organization', 'org', 'employer', 'business'],
  industry: ['industry', 'sector', 'vertical', 'market'],
  linkedin: ['linkedin', 'linkedin url', 'linkedin_url', 'linkedinurl', 'linkedin profile', 'li url'],
  twitter: ['twitter', 'twitter handle', 'twitter_handle', 'x handle', 'x', '@twitter'],
  city: ['city', 'location city', 'contact city'],
  state: ['state', 'province', 'region', 'location state'],
  country: ['country', 'nation', 'location country'],
  company_size: ['company size', 'company_size', 'companysize', 'employees', 'employee count', 'headcount', 'size'],
  department: ['department', 'dept', 'division', 'team'],
  seniority: ['seniority', 'level', 'management level', 'seniority level'],
  website: ['website', 'url', 'company website', 'company url', 'domain'],
}

/**
 * Auto-detect column mapping from CSV headers
 */
export function detectColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim())

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (let i = 0; i < normalizedHeaders.length; i++) {
      const header = normalizedHeaders[i]
      if (aliases.includes(header)) {
        mapping[field] = headers[i] // Use original case
        break
      }
    }
  }

  return mapping
}

/**
 * Parse CSV content - handles various formats
 */
export function parseCSV(content: string): ParsedCSVResult {
  const lines = content.split(/\r?\n/).filter(line => line.trim())

  if (lines.length === 0) {
    throw new Error('CSV file is empty')
  }

  // Detect delimiter
  const firstLine = lines[0]
  const delimiter = firstLine.includes('\t') ? '\t' :
                    firstLine.includes(';') ? ';' : ','

  // Parse headers
  const headers = parseCSVLine(firstLine, delimiter)

  // Parse rows
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter)
    if (values.length === 0 || values.every(v => !v.trim())) continue

    const row: Record<string, string> = {}
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim() || ''
    })
    rows.push(row)
  }

  // Auto-detect column mapping
  const suggestedMapping = detectColumnMapping(headers)

  // Detect format based on headers
  const detectedFormat = detectCSVFormat(headers)

  return {
    headers,
    rows,
    totalRows: rows.length,
    sampleRows: rows.slice(0, 5),
    suggestedMapping,
    detectedFormat,
  }
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  result.push(current)
  return result
}

/**
 * Detect the format/source of the CSV
 */
function detectCSVFormat(headers: string[]): string {
  const headerStr = headers.join('|').toLowerCase()

  if (headerStr.includes('apollo')) return 'Apollo'
  if (headerStr.includes('zoominfo')) return 'ZoomInfo'
  if (headerStr.includes('linkedin') && headerStr.includes('sales navigator')) return 'LinkedIn Sales Navigator'
  if (headerStr.includes('hubspot')) return 'HubSpot'
  if (headerStr.includes('salesforce')) return 'Salesforce'
  if (headerStr.includes('clearbit')) return 'Clearbit'

  return 'Generic CSV'
}

// ============================================================================
// CONTACT PROCESSING
// ============================================================================

/**
 * Validate an email address
 */
function isValidEmail(email: string): boolean {
  if (!email) return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim().toLowerCase())
}

/**
 * Extract domain from email
 */
function extractDomain(email: string): string | null {
  if (!email) return null
  const match = email.match(/@([^@]+)$/)
  return match ? match[1].toLowerCase() : null
}

/**
 * Infer seniority from job title
 */
function inferSeniority(title: string): string {
  if (!title) return 'individual'
  const lowerTitle = title.toLowerCase()

  if (/\b(ceo|cto|cfo|coo|cmo|cio|chief|founder|co-founder|owner|president)\b/.test(lowerTitle)) {
    return 'c_level'
  }
  if (/\b(vp|vice president|evp|svp)\b/.test(lowerTitle)) {
    return 'vp'
  }
  if (/\b(director|head of)\b/.test(lowerTitle)) {
    return 'director'
  }
  if (/\b(manager|lead|supervisor)\b/.test(lowerTitle)) {
    return 'manager'
  }

  return 'individual'
}

/**
 * Parse full name into first/last
 */
function parseName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: '', lastName: '' }

  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' }
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

/**
 * Transform a CSV row into a Contact object
 */
export function transformRowToContact(
  row: Record<string, string>,
  mapping: Record<string, string>,
  userId: string
): Contact | null {
  const getValue = (field: string): string => {
    const column = mapping[field]
    return column ? (row[column] || '').trim() : ''
  }

  // Get email - required for deduplication
  const email = getValue('email')

  // If no email, try to construct from other fields
  // Skip if truly no email
  if (!email && !getValue('linkedin') && !getValue('phone')) {
    return null
  }

  // Parse name
  let firstName = getValue('first_name')
  let lastName = getValue('last_name')

  if (!firstName && !lastName) {
    const fullName = getValue('full_name')
    if (fullName) {
      const parsed = parseName(fullName)
      firstName = parsed.firstName
      lastName = parsed.lastName
    }
  }

  // Get company and domain
  const companyName = getValue('company')
  let companyDomain = getValue('website')

  // Try to extract domain from email if not provided
  if (!companyDomain && email) {
    const domain = extractDomain(email)
    // Skip common email providers
    const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'me.com', 'mail.com', 'protonmail.com']
    if (domain && !freeProviders.includes(domain)) {
      companyDomain = domain
    }
  }

  // Infer seniority from title
  const title = getValue('title')
  const seniority = getValue('seniority') || inferSeniority(title)

  return {
    id: uuidv4(),
    userId,
    email: email ? email.toLowerCase().trim() : undefined,
    phone: getValue('phone') || undefined,
    linkedinUrl: getValue('linkedin') || undefined,
    twitterHandle: getValue('twitter')?.replace('@', '') || undefined,
    firstName,
    lastName,
    title,
    department: getValue('department') || undefined,
    seniority,
    companyName,
    companyDomain,
    companySize: getValue('company_size') || undefined,
    industry: getValue('industry') || undefined,
    city: getValue('city') || undefined,
    state: getValue('state') || undefined,
    country: getValue('country') || 'United States',
    icpScore: 0, // Will be calculated later
    tags: [],
    status: 'new',
  }
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Create a new contact upload record
 */
export async function createUpload(
  userId: string,
  filename: string,
  fileSizeBytes: number,
  totalRows: number,
  columnMapping: Record<string, string>
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO contact_uploads (user_id, filename, file_size_bytes, total_rows, column_mapping, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING id`,
    [userId, filename, fileSizeBytes, totalRows, JSON.stringify(columnMapping)]
  )
  return result.rows[0].id
}

/**
 * Update upload status
 */
export async function updateUploadStatus(
  uploadId: string,
  status: string,
  stats?: {
    validContacts?: number
    duplicateContacts?: number
    invalidContacts?: number
    enrichedContacts?: number
    errorMessage?: string
  }
): Promise<void> {
  const updates: string[] = ['status = $2', 'updated_at = NOW()']
  const values: unknown[] = [uploadId, status]
  let paramIndex = 3

  if (status === 'processing') {
    updates.push('processing_started_at = NOW()')
  }
  if (status === 'completed' || status === 'failed') {
    updates.push('processing_completed_at = NOW()')
  }

  if (stats?.validContacts !== undefined) {
    updates.push(`valid_contacts = $${paramIndex++}`)
    values.push(stats.validContacts)
  }
  if (stats?.duplicateContacts !== undefined) {
    updates.push(`duplicate_contacts = $${paramIndex++}`)
    values.push(stats.duplicateContacts)
  }
  if (stats?.invalidContacts !== undefined) {
    updates.push(`invalid_contacts = $${paramIndex++}`)
    values.push(stats.invalidContacts)
  }
  if (stats?.enrichedContacts !== undefined) {
    updates.push(`enriched_contacts = $${paramIndex++}`)
    values.push(stats.enrichedContacts)
  }
  if (stats?.errorMessage) {
    updates.push(`error_message = $${paramIndex++}`)
    values.push(stats.errorMessage)
  }

  await query(
    `UPDATE contact_uploads SET ${updates.join(', ')} WHERE id = $1`,
    values
  )
}

/**
 * Insert contacts in batch with deduplication
 */
export async function insertContactsBatch(
  contacts: Contact[],
  uploadId: string
): Promise<{ inserted: number; duplicates: number }> {
  if (contacts.length === 0) {
    return { inserted: 0, duplicates: 0 }
  }

  let inserted = 0
  let duplicates = 0

  // Process in batches of 500 for performance
  const batchSize = 500
  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize)

    await withTransaction(async (client) => {
      for (const contact of batch) {
        try {
          await client.query(
            `INSERT INTO outreach_contacts (
              id, user_id, upload_id, email, phone, linkedin_url, twitter_handle,
              first_name, last_name, title, department, seniority,
              company_name, company_domain, company_size, industry,
              city, state, country, icp_score, tags, status, source_row_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
            ON CONFLICT (user_id, email_hash) DO NOTHING`,
            [
              contact.id,
              contact.userId,
              uploadId,
              contact.email,
              contact.phone,
              contact.linkedinUrl,
              contact.twitterHandle,
              contact.firstName,
              contact.lastName,
              contact.title,
              contact.department,
              contact.seniority,
              contact.companyName,
              contact.companyDomain,
              contact.companySize,
              contact.industry,
              contact.city,
              contact.state,
              contact.country,
              contact.icpScore,
              contact.tags,
              contact.status,
              JSON.stringify({}), // source_row_data
            ]
          )
          inserted++
        } catch (error: unknown) {
          // Duplicate
          if ((error as { code?: string })?.code === '23505') {
            duplicates++
          } else {
            throw error
          }
        }
      }
    })
  }

  return { inserted, duplicates }
}

/**
 * Get contacts for a user with optional filtering
 */
export async function getContacts(
  userId: string,
  options: {
    status?: string
    segment?: string
    icpScoreMin?: number
    limit?: number
    offset?: number
    search?: string
  } = {}
): Promise<{ contacts: Contact[]; total: number }> {
  const conditions: string[] = ['user_id = $1']
  const values: unknown[] = [userId]
  let paramIndex = 2

  if (options.status) {
    conditions.push(`status = $${paramIndex++}`)
    values.push(options.status)
  }
  if (options.segment) {
    conditions.push(`segment = $${paramIndex++}`)
    values.push(options.segment)
  }
  if (options.icpScoreMin !== undefined) {
    conditions.push(`icp_score >= $${paramIndex++}`)
    values.push(options.icpScoreMin)
  }
  if (options.search) {
    conditions.push(`(email ILIKE $${paramIndex} OR full_name ILIKE $${paramIndex} OR company_name ILIKE $${paramIndex})`)
    values.push(`%${options.search}%`)
    paramIndex++
  }

  const whereClause = conditions.join(' AND ')

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM outreach_contacts WHERE ${whereClause}`,
    values
  )
  const total = parseInt(countResult.rows[0].count, 10)

  // Get contacts
  const limit = options.limit || 50
  const offset = options.offset || 0

  const result = await query<Record<string, unknown>>(
    `SELECT * FROM outreach_contacts
     WHERE ${whereClause}
     ORDER BY icp_score DESC, created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, limit, offset]
  )

  return {
    contacts: result.rows.map(mapRowToContact),
    total,
  }
}

/**
 * Map database row to Contact type
 */
function mapRowToContact(row: Record<string, unknown>): Contact {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    email: row.email as string | undefined,
    phone: row.phone as string | undefined,
    linkedinUrl: row.linkedin_url as string | undefined,
    twitterHandle: row.twitter_handle as string | undefined,
    firstName: row.first_name as string | undefined,
    lastName: row.last_name as string | undefined,
    title: row.title as string | undefined,
    department: row.department as string | undefined,
    seniority: row.seniority as string | undefined,
    companyName: row.company_name as string | undefined,
    companyDomain: row.company_domain as string | undefined,
    companySize: row.company_size as string | undefined,
    industry: row.industry as string | undefined,
    city: row.city as string | undefined,
    state: row.state as string | undefined,
    country: row.country as string | undefined,
    icpScore: row.icp_score as number,
    segment: row.segment as string | undefined,
    tags: (row.tags as string[]) || [],
    status: row.status as Contact['status'],
  }
}

// ============================================================================
// MAIN INGESTION FUNCTION
// ============================================================================

/**
 * Process a CSV upload through conversation
 * Returns a summary for Wells to describe
 */
export async function processCSVUpload(
  userId: string,
  filename: string,
  csvContent: string,
  customMapping?: Record<string, string>
): Promise<IngestionResult> {
  // Parse CSV
  const parsed = parseCSV(csvContent)

  // Use custom mapping or detected mapping
  const mapping = customMapping || parsed.suggestedMapping

  // Create upload record
  const uploadId = await createUpload(
    userId,
    filename,
    csvContent.length,
    parsed.totalRows,
    mapping
  )

  // Update status to processing
  await updateUploadStatus(uploadId, 'processing')

  try {
    // Transform rows to contacts
    const contacts: Contact[] = []
    const warnings: string[] = []
    let invalidCount = 0

    for (const row of parsed.rows) {
      const contact = transformRowToContact(row, mapping, userId)
      if (contact) {
        contacts.push(contact)
      } else {
        invalidCount++
      }
    }

    // Warn if many invalid
    if (invalidCount > parsed.totalRows * 0.1) {
      warnings.push(`${invalidCount} rows skipped (no email or contact info)`)
    }

    // Insert contacts with deduplication
    const { inserted, duplicates } = await insertContactsBatch(contacts, uploadId)

    // Update upload stats
    await updateUploadStatus(uploadId, 'completed', {
      validContacts: inserted,
      duplicateContacts: duplicates,
      invalidContacts: invalidCount,
    })

    // Get sample of inserted contacts
    const { contacts: sampleContacts } = await getContacts(userId, { limit: 5 })

    return {
      uploadId,
      totalProcessed: parsed.totalRows,
      validContacts: inserted,
      duplicates,
      invalid: invalidCount,
      enriched: 0, // Will be enriched async
      sampleContacts,
      warnings,
    }
  } catch (error) {
    await updateUploadStatus(uploadId, 'failed', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

// ============================================================================
// SEGMENTATION - Via Conversation
// ============================================================================

export interface SegmentCriteria {
  titles?: string[]
  seniorities?: string[]
  industries?: string[]
  companySizes?: string[]
  locations?: string[]
  icpScoreMin?: number
  tags?: string[]
  customQuery?: string
}

/**
 * Parse natural language segment description into criteria
 * Uses Claude to understand user's intent
 */
export async function parseSegmentDescription(description: string): Promise<SegmentCriteria> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: `You parse natural language descriptions of contact segments into structured criteria.

RESPOND WITH JSON ONLY:
{
  "titles": ["array of job titles to match"],
  "seniorities": ["c_level", "vp", "director", "manager", "individual"],
  "industries": ["array of industries"],
  "companySizes": ["startup", "small", "medium", "enterprise"],
  "locations": ["cities/states/countries"],
  "icpScoreMin": 0-100 or null,
  "tags": ["any tags mentioned"]
}

Only include fields that were explicitly or implicitly mentioned. Use null for unspecified fields.`,
    messages: [
      { role: 'user', content: `Parse this segment description: "${description}"` },
    ],
  })

  const text = response.content.find(b => b.type === 'text')?.text || '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  return JSON.parse(jsonMatch?.[0] || '{}')
}

/**
 * Create a segment of contacts based on criteria
 */
export async function segmentContacts(
  userId: string,
  segmentName: string,
  criteria: SegmentCriteria
): Promise<{ count: number; sample: Contact[] }> {
  const conditions: string[] = ['user_id = $1', "status NOT IN ('unsubscribed', 'bounced')"]
  const values: unknown[] = [userId]
  let paramIndex = 2

  if (criteria.titles && criteria.titles.length > 0) {
    const titlePatterns = criteria.titles.map(t => `%${t}%`).join('|')
    conditions.push(`title ~* $${paramIndex++}`)
    values.push(titlePatterns)
  }

  if (criteria.seniorities && criteria.seniorities.length > 0) {
    conditions.push(`seniority = ANY($${paramIndex++})`)
    values.push(criteria.seniorities)
  }

  if (criteria.industries && criteria.industries.length > 0) {
    const industryPatterns = criteria.industries.map(i => `%${i}%`).join('|')
    conditions.push(`industry ~* $${paramIndex++}`)
    values.push(industryPatterns)
  }

  if (criteria.companySizes && criteria.companySizes.length > 0) {
    conditions.push(`company_size = ANY($${paramIndex++})`)
    values.push(criteria.companySizes)
  }

  if (criteria.locations && criteria.locations.length > 0) {
    const locationPatterns = criteria.locations.map(l => `%${l}%`).join('|')
    conditions.push(`(city ~* $${paramIndex} OR state ~* $${paramIndex} OR country ~* $${paramIndex})`)
    values.push(locationPatterns)
    paramIndex++
  }

  if (criteria.icpScoreMin !== undefined && criteria.icpScoreMin !== null) {
    conditions.push(`icp_score >= $${paramIndex++}`)
    values.push(criteria.icpScoreMin)
  }

  if (criteria.tags && criteria.tags.length > 0) {
    conditions.push(`tags && $${paramIndex++}`)
    values.push(criteria.tags)
  }

  const whereClause = conditions.join(' AND ')

  // Update segment name for matching contacts
  const updateResult = await query<{ count: string }>(
    `UPDATE outreach_contacts
     SET segment = $${paramIndex}, updated_at = NOW()
     WHERE ${whereClause}
     RETURNING id`,
    [...values, segmentName]
  )

  const count = updateResult.rows.length

  // Get sample
  const sampleResult = await query<Record<string, unknown>>(
    `SELECT * FROM outreach_contacts
     WHERE segment = $1 AND user_id = $2
     ORDER BY icp_score DESC
     LIMIT 5`,
    [segmentName, userId]
  )

  return {
    count,
    sample: sampleResult.rows.map(mapRowToContact),
  }
}

/**
 * Get segment statistics
 */
export async function getSegmentStats(userId: string): Promise<Array<{
  segment: string
  count: number
  avgIcpScore: number
}>> {
  const result = await query<{ segment: string; count: string; avg_icp: string }>(
    `SELECT
       COALESCE(segment, 'Unsegmented') as segment,
       COUNT(*) as count,
       ROUND(AVG(icp_score)::numeric, 1) as avg_icp
     FROM outreach_contacts
     WHERE user_id = $1 AND status NOT IN ('unsubscribed', 'bounced')
     GROUP BY segment
     ORDER BY count DESC`,
    [userId]
  )

  return result.rows.map(r => ({
    segment: r.segment,
    count: parseInt(r.count, 10),
    avgIcpScore: parseFloat(r.avg_icp),
  }))
}

// ============================================================================
// ENRICHMENT - Background Process
// ============================================================================

/**
 * Enrich contacts with inferred data
 * Called async after upload
 */
export async function enrichContacts(userId: string, uploadId?: string): Promise<number> {
  // Get unenriched contacts
  const conditions = ['user_id = $1', 'enriched = false', 'email IS NOT NULL']
  const values: unknown[] = [userId]

  if (uploadId) {
    conditions.push('upload_id = $2')
    values.push(uploadId)
  }

  const contacts = await query<{ id: string; email: string; company_domain: string }>(
    `SELECT id, email, company_domain
     FROM outreach_contacts
     WHERE ${conditions.join(' AND ')}
     LIMIT 1000`,
    values
  )

  let enrichedCount = 0

  for (const contact of contacts.rows) {
    // Infer domain from email if not set
    if (!contact.company_domain && contact.email) {
      const domain = extractDomain(contact.email)
      const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com']

      if (domain && !freeProviders.includes(domain)) {
        await query(
          `UPDATE outreach_contacts
           SET company_domain = $1, enriched = true, enriched_at = NOW(), enrichment_source = 'inferred'
           WHERE id = $2`,
          [domain, contact.id]
        )
        enrichedCount++
      }
    }
  }

  return enrichedCount
}

// ============================================================================
// CONVERSATION HELPERS - For the Handler
// ============================================================================

/**
 * Generate a human-readable summary of upload results
 * For Wells to communicate
 */
export function generateUploadSummary(result: IngestionResult): string {
  const parts: string[] = []

  parts.push(`Processed ${result.totalProcessed.toLocaleString()} contacts.`)

  if (result.validContacts > 0) {
    parts.push(`Added ${result.validContacts.toLocaleString()} new contacts.`)
  }

  if (result.duplicates > 0) {
    parts.push(`Skipped ${result.duplicates.toLocaleString()} duplicates.`)
  }

  if (result.invalid > 0) {
    parts.push(`${result.invalid.toLocaleString()} rows were missing email/contact info.`)
  }

  if (result.warnings.length > 0) {
    parts.push(`Note: ${result.warnings.join('. ')}`)
  }

  return parts.join(' ')
}

/**
 * Generate sample contact preview for Wells to describe
 */
export function describeContacts(contacts: Contact[]): string {
  if (contacts.length === 0) return 'No contacts to show.'

  const descriptions = contacts.slice(0, 3).map(c => {
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unknown'
    const company = c.companyName || 'Unknown company'
    const title = c.title || 'Unknown role'
    return `${name} - ${title} at ${company}`
  })

  return descriptions.join('\n')
}

export default {
  parseCSV,
  detectColumnMapping,
  processCSVUpload,
  getContacts,
  parseSegmentDescription,
  segmentContacts,
  getSegmentStats,
  enrichContacts,
  generateUploadSummary,
  describeContacts,
}
