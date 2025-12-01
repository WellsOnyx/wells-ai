// lib/csv-analyzer.ts
// Smart CSV column detection and mapping system

export interface ColumnMapping {
  sourceColumn: string
  targetField: string | null
  confidence: 'high' | 'medium' | 'low'
  samples: string[]
}

export interface CSVAnalysisResult {
  detectedFormat: string
  columns: ColumnMapping[]
  rowCount: number
  sampleRows: any[]
  warnings: string[]
}

// Field type patterns - comprehensive variations for each target field
const FIELD_PATTERNS = {
  first_name: {
    exact: ['first name', 'firstname', 'given name', 'givenname', 'fname', 'first', 'forename'],
    partial: ['name first', 'first_name', 'given_name'],
    keywords: ['first', 'given']
  },
  last_name: {
    exact: ['last name', 'lastname', 'surname', 'family name', 'familyname', 'lname', 'last'],
    partial: ['name last', 'last_name', 'family_name'],
    keywords: ['last', 'family', 'surname']
  },
  email: {
    exact: ['email', 'e-mail', 'email address', 'emailaddress', 'mail', 'e-mail address'],
    partial: ['email 1', 'e-mail 1', 'primary email', 'work email', 'email_address'],
    keywords: ['email', 'mail']
  },
  title: {
    exact: ['title', 'job title', 'position', 'role', 'job role', 'jobtitle'],
    partial: ['job_title', 'position_title', 'work title'],
    keywords: ['title', 'position', 'role']
  },
  company_name: {
    exact: ['company', 'company name', 'organization', 'organisation', 'employer', 'companyname'],
    partial: ['company_name', 'org name', 'company name', 'employer name'],
    keywords: ['company', 'organization', 'employer', 'org']
  },
  company_domain: {
    exact: ['domain', 'company domain', 'website', 'company website', 'url', 'company url'],
    partial: ['company_domain', 'web site', 'web address'],
    keywords: ['domain', 'website', 'url']
  },
  company_size: {
    exact: ['company size', 'size', 'employees', 'employee count', 'headcount'],
    partial: ['company_size', 'num employees', 'company employees'],
    keywords: ['size', 'employees', 'headcount']
  },
  company_industry: {
    exact: ['industry', 'sector', 'vertical', 'company industry'],
    partial: ['company_industry', 'industry sector'],
    keywords: ['industry', 'sector', 'vertical']
  },
  linkedin_url: {
    exact: ['linkedin', 'linkedin url', 'linkedin profile', 'li url', 'profile url'],
    partial: ['linkedin_url', 'linkedin link', 'li profile'],
    keywords: ['linkedin', 'li_url']
  },
  city: {
    exact: ['city', 'location city', 'town'],
    partial: ['city_name', 'location_city'],
    keywords: ['city', 'town']
  },
  state: {
    exact: ['state', 'province', 'region', 'state/province'],
    partial: ['state_name', 'state/region'],
    keywords: ['state', 'province', 'region']
  },
  country: {
    exact: ['country', 'nation', 'country name'],
    partial: ['country_name', 'country/region'],
    keywords: ['country', 'nation']
  },
  seniority_level: {
    exact: ['seniority', 'seniority level', 'level', 'rank', 'seniority_level'],
    partial: ['senior level', 'job level'],
    keywords: ['seniority', 'level', 'rank']
  },
  phone: {
    exact: ['phone', 'phone number', 'telephone', 'mobile', 'cell', 'phone 1'],
    partial: ['phone_number', 'tel', 'mobile number'],
    keywords: ['phone', 'mobile', 'tel', 'cell']
  }
}

/**
 * Detect column type from header name
 */
function detectColumnType(header: string): { targetField: string | null; confidence: 'high' | 'medium' | 'low' } {
  const normalizedHeader = header.toLowerCase().trim()

  // Check each field pattern
  for (const [targetField, patterns] of Object.entries(FIELD_PATTERNS)) {
    // Exact match - highest confidence
    if (patterns.exact.includes(normalizedHeader)) {
      return { targetField, confidence: 'high' }
    }

    // Partial match - medium confidence
    for (const partial of patterns.partial) {
      if (normalizedHeader.includes(partial) || partial.includes(normalizedHeader)) {
        return { targetField, confidence: 'medium' }
      }
    }

    // Keyword match - low confidence
    for (const keyword of patterns.keywords) {
      if (normalizedHeader.includes(keyword)) {
        return { targetField, confidence: 'low' }
      }
    }
  }

  // No match
  return { targetField: null, confidence: 'low' }
}

/**
 * Validate data sample to improve confidence score
 */
function validateSample(targetField: string, sample: string): boolean {
  if (!sample || sample.trim() === '') return false

  const trimmed = sample.trim()

  switch (targetField) {
    case 'email':
      // Basic email validation
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)

    case 'linkedin_url':
      // LinkedIn URL validation
      return trimmed.includes('linkedin.com')

    case 'company_domain':
      // Domain validation
      return /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i.test(trimmed)

    case 'phone':
      // Phone number validation (digits and basic formatting)
      return /[\d\-\(\)\+\s]{7,}/.test(trimmed)

    default:
      // For other fields, just check if not empty
      return trimmed.length > 0
  }
}

/**
 * Detect CSV format based on column patterns
 */
function detectFormat(columns: ColumnMapping[]): string {
  const detectedFields = columns
    .filter(c => c.targetField !== null && c.confidence !== 'low')
    .map(c => c.targetField)

  // Clay format detection
  const hasClayFields = detectedFields.includes('company_name') &&
                        detectedFields.includes('company_domain') &&
                        detectedFields.includes('linkedin_url')
  if (hasClayFields) return 'Clay Export'

  // LinkedIn Sales Navigator detection
  const hasLinkedInFields = detectedFields.includes('linkedin_url') &&
                            detectedFields.includes('company_name') &&
                            detectedFields.includes('title')
  if (hasLinkedInFields) return 'LinkedIn Sales Navigator'

  // Google Contacts detection
  const hasGoogleFields = columns.some(c => c.sourceColumn.toLowerCase().includes('group membership')) ||
                          columns.some(c => c.sourceColumn.toLowerCase().includes('e-mail 1'))
  if (hasGoogleFields) return 'Google Contacts'

  // HubSpot detection
  const hasHubSpotFields = columns.some(c => c.sourceColumn.toLowerCase().includes('hubspot'))
  if (hasHubSpotFields) return 'HubSpot Export'

  // Salesforce detection
  const hasSalesforceFields = columns.some(c => c.sourceColumn.toLowerCase().includes('sfdc')) ||
                               columns.some(c => c.sourceColumn.toLowerCase().includes('salesforce'))
  if (hasSalesforceFields) return 'Salesforce Export'

  // Generic CRM detection
  if (detectedFields.includes('company_name') && detectedFields.includes('email')) {
    return 'Generic CRM Export'
  }

  return 'Unknown Format'
}

/**
 * Analyze CSV data and detect column mappings
 */
export function analyzeCSV(headers: string[], rows: any[]): CSVAnalysisResult {
  const warnings: string[] = []
  const columns: ColumnMapping[] = []

  // Analyze each header
  for (const header of headers) {
    const detection = detectColumnType(header)

    // Get sample values for this column (first 5 non-empty)
    const samples = rows
      .map(row => row[header])
      .filter(val => val && String(val).trim() !== '')
      .slice(0, 5)
      .map(val => String(val).trim())

    // Validate samples to adjust confidence
    let confidence = detection.confidence
    if (detection.targetField && samples.length > 0) {
      const validSamples = samples.filter(s => validateSample(detection.targetField!, s))
      const validationRate = validSamples.length / samples.length

      // Upgrade confidence if validation passes
      if (validationRate >= 0.8 && confidence === 'medium') {
        confidence = 'high'
      }
      // Downgrade if validation fails
      if (validationRate < 0.5 && confidence === 'high') {
        confidence = 'medium'
      }
      if (validationRate < 0.3) {
        confidence = 'low'
      }
    }

    columns.push({
      sourceColumn: header,
      targetField: detection.targetField,
      confidence,
      samples
    })
  }

  // Detect format
  const detectedFormat = detectFormat(columns)

  // Generate warnings
  const hasEmail = columns.some(c => c.targetField === 'email' && c.confidence !== 'low')
  const hasLinkedIn = columns.some(c => c.targetField === 'linkedin_url' && c.confidence !== 'low')

  if (!hasEmail && !hasLinkedIn) {
    warnings.push('No email or LinkedIn URL detected - at least one is required for import')
  }

  const hasFirstName = columns.some(c => c.targetField === 'first_name' && c.confidence !== 'low')
  const hasLastName = columns.some(c => c.targetField === 'last_name' && c.confidence !== 'low')

  if (!hasFirstName || !hasLastName) {
    warnings.push('Name fields not clearly detected - contacts may have incomplete names')
  }

  const hasCompanyInfo = columns.some(c =>
    (c.targetField === 'company_name' || c.targetField === 'title') &&
    c.confidence !== 'low'
  )

  if (!hasCompanyInfo) {
    warnings.push('No company information detected - contacts will have limited business context')
  }

  // Get sample rows (first 5)
  const sampleRows = rows.slice(0, 5)

  return {
    detectedFormat,
    columns,
    rowCount: rows.length,
    sampleRows,
    warnings
  }
}

/**
 * Apply user-confirmed mappings to transform CSV data
 */
export function applyMappings(
  row: any,
  mappings: { [sourceColumn: string]: string }
): any {
  const transformed: any = {}

  for (const [sourceColumn, targetField] of Object.entries(mappings)) {
    if (targetField && row[sourceColumn]) {
      transformed[targetField] = String(row[sourceColumn]).trim()
    }
  }

  return transformed
}

/**
 * Handle special cases for name splitting
 */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)

  if (parts.length === 0) {
    return { firstName: '', lastName: '' }
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' }
  }

  // First word is first name, rest is last name
  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')

  return { firstName, lastName }
}
