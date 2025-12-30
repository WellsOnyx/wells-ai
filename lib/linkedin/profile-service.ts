// @ts-nocheck
/**
 * LinkedIn Profile Service
 *
 * Fetches and caches LinkedIn profile data.
 * Since LinkedIn doesn't have a public API for this,
 * we work with what's available:
 * - Parse profile URLs to extract info
 * - Cache enriched data in database
 * - Integrate with enrichment services when available
 * - Manual profile data entry through chat
 */

import { query } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

export interface LinkedInProfile {
  id: string
  linkedinUrl: string
  linkedinId?: string // vanity URL or ID

  // Basic info
  firstName?: string
  lastName?: string
  fullName?: string
  headline?: string
  location?: string

  // Professional
  currentTitle?: string
  currentCompany?: string
  industry?: string

  // Rich data (when available)
  about?: string
  experience?: ExperienceEntry[]
  education?: EducationEntry[]
  skills?: string[]

  // Activity signals
  recentPosts?: PostInfo[]
  activitySignals?: string[]

  // Metadata
  source: 'manual' | 'enrichment' | 'parsed' | 'sales_navigator'
  enrichmentService?: string
  lastEnrichedAt?: Date
  createdAt: Date
  updatedAt: Date

  // Tracking
  userId: string // Who added this profile
  connectionStatus?: 'unknown' | 'pending' | 'connected' | 'following'
  notes?: string
}

export interface ExperienceEntry {
  title: string
  company: string
  companyLinkedInUrl?: string
  startDate?: string
  endDate?: string
  isCurrent?: boolean
  description?: string
  location?: string
}

export interface EducationEntry {
  school: string
  degree?: string
  field?: string
  startYear?: number
  endYear?: number
}

export interface PostInfo {
  content: string
  postedAt?: Date
  engagement?: {
    likes?: number
    comments?: number
    shares?: number
  }
  topics?: string[]
}

export interface ProfileEnrichmentResult {
  success: boolean
  profile?: Partial<LinkedInProfile>
  source: string
  confidence: number
  error?: string
}

// ============================================================================
// URL PARSING
// ============================================================================

/**
 * Parse a LinkedIn URL to extract profile information
 */
export function parseLinkedInUrl(url: string): {
  isValid: boolean
  type: 'profile' | 'company' | 'post' | 'unknown'
  linkedinId?: string
  cleanUrl?: string
} {
  try {
    // Clean up the URL
    let cleanUrl = url.trim()
    if (!cleanUrl.startsWith('http')) {
      cleanUrl = 'https://' + cleanUrl
    }

    const urlObj = new URL(cleanUrl)

    // Check if it's actually LinkedIn
    if (!urlObj.hostname.includes('linkedin.com')) {
      return { isValid: false, type: 'unknown' }
    }

    const pathname = urlObj.pathname

    // Profile URLs: /in/username or /in/username/
    const profileMatch = pathname.match(/^\/in\/([^\/]+)\/?$/)
    if (profileMatch) {
      return {
        isValid: true,
        type: 'profile',
        linkedinId: profileMatch[1],
        cleanUrl: `https://www.linkedin.com/in/${profileMatch[1]}/`
      }
    }

    // Company URLs: /company/companyname
    const companyMatch = pathname.match(/^\/company\/([^\/]+)\/?/)
    if (companyMatch) {
      return {
        isValid: true,
        type: 'company',
        linkedinId: companyMatch[1],
        cleanUrl: `https://www.linkedin.com/company/${companyMatch[1]}/`
      }
    }

    // Post URLs: /feed/update/ or /posts/
    if (pathname.includes('/feed/update/') || pathname.includes('/posts/')) {
      return {
        isValid: true,
        type: 'post',
        cleanUrl: cleanUrl
      }
    }

    return { isValid: false, type: 'unknown' }
  } catch {
    return { isValid: false, type: 'unknown' }
  }
}

/**
 * Extract a name guess from a LinkedIn vanity URL
 */
export function guessNameFromLinkedInId(linkedinId: string): {
  firstName?: string
  lastName?: string
  fullName?: string
} {
  // Common patterns: john-doe, johndoe, john-doe-123456
  const cleaned = linkedinId
    .replace(/-\d+$/, '') // Remove trailing numbers
    .replace(/\d/g, '') // Remove all numbers

  // Split by common delimiters
  const parts = cleaned.split(/[-_]/).filter(p => p.length > 0)

  if (parts.length >= 2) {
    return {
      firstName: capitalizeFirst(parts[0]),
      lastName: capitalizeFirst(parts[parts.length - 1]),
      fullName: parts.map(capitalizeFirst).join(' ')
    }
  } else if (parts.length === 1 && parts[0].length > 3) {
    return { fullName: capitalizeFirst(parts[0]) }
  }

  return {}
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Save or update a LinkedIn profile in the database
 */
export async function saveProfile(
  profile: Partial<LinkedInProfile> & { linkedinUrl: string; userId: string }
): Promise<LinkedInProfile> {
  const now = new Date()
  const id = profile.id || uuidv4()

  // Parse the URL to get clean URL and ID
  const parsed = parseLinkedInUrl(profile.linkedinUrl)
  const linkedinId = profile.linkedinId || parsed.linkedinId
  const cleanUrl = parsed.cleanUrl || profile.linkedinUrl

  // Try to guess name from URL if not provided
  const nameGuess = linkedinId ? guessNameFromLinkedInId(linkedinId) : {}

  const result = await query<LinkedInProfile>(`
    INSERT INTO linkedin_profiles (
      id, linkedin_url, linkedin_id,
      first_name, last_name, full_name, headline, location,
      current_title, current_company, industry,
      about, experience, education, skills,
      recent_posts, activity_signals,
      source, enrichment_service, last_enriched_at,
      user_id, connection_status, notes,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3,
      $4, $5, $6, $7, $8,
      $9, $10, $11,
      $12, $13, $14, $15,
      $16, $17,
      $18, $19, $20,
      $21, $22, $23,
      $24, $25
    )
    ON CONFLICT (linkedin_url) DO UPDATE SET
      linkedin_id = COALESCE(EXCLUDED.linkedin_id, linkedin_profiles.linkedin_id),
      first_name = COALESCE(EXCLUDED.first_name, linkedin_profiles.first_name),
      last_name = COALESCE(EXCLUDED.last_name, linkedin_profiles.last_name),
      full_name = COALESCE(EXCLUDED.full_name, linkedin_profiles.full_name),
      headline = COALESCE(EXCLUDED.headline, linkedin_profiles.headline),
      location = COALESCE(EXCLUDED.location, linkedin_profiles.location),
      current_title = COALESCE(EXCLUDED.current_title, linkedin_profiles.current_title),
      current_company = COALESCE(EXCLUDED.current_company, linkedin_profiles.current_company),
      industry = COALESCE(EXCLUDED.industry, linkedin_profiles.industry),
      about = COALESCE(EXCLUDED.about, linkedin_profiles.about),
      experience = COALESCE(EXCLUDED.experience, linkedin_profiles.experience),
      education = COALESCE(EXCLUDED.education, linkedin_profiles.education),
      skills = COALESCE(EXCLUDED.skills, linkedin_profiles.skills),
      recent_posts = COALESCE(EXCLUDED.recent_posts, linkedin_profiles.recent_posts),
      activity_signals = COALESCE(EXCLUDED.activity_signals, linkedin_profiles.activity_signals),
      source = EXCLUDED.source,
      last_enriched_at = EXCLUDED.last_enriched_at,
      connection_status = COALESCE(EXCLUDED.connection_status, linkedin_profiles.connection_status),
      notes = COALESCE(EXCLUDED.notes, linkedin_profiles.notes),
      updated_at = $25
    RETURNING *
  `, [
    id,
    cleanUrl,
    linkedinId,
    profile.firstName || nameGuess.firstName,
    profile.lastName || nameGuess.lastName,
    profile.fullName || nameGuess.fullName,
    profile.headline,
    profile.location,
    profile.currentTitle,
    profile.currentCompany,
    profile.industry,
    profile.about,
    JSON.stringify(profile.experience || []),
    JSON.stringify(profile.education || []),
    JSON.stringify(profile.skills || []),
    JSON.stringify(profile.recentPosts || []),
    JSON.stringify(profile.activitySignals || []),
    profile.source || 'parsed',
    profile.enrichmentService,
    profile.lastEnrichedAt,
    profile.userId,
    profile.connectionStatus || 'unknown',
    profile.notes,
    now,
    now
  ])

  return result.rows[0]
}

/**
 * Get a profile by LinkedIn URL
 */
export async function getProfileByUrl(
  linkedinUrl: string
): Promise<LinkedInProfile | null> {
  const parsed = parseLinkedInUrl(linkedinUrl)
  const cleanUrl = parsed.cleanUrl || linkedinUrl

  const result = await query<LinkedInProfile>(
    'SELECT * FROM linkedin_profiles WHERE linkedin_url = $1',
    [cleanUrl]
  )

  if (result.rows.length === 0) return null

  const row = result.rows[0]
  return {
    ...row,
    experience: typeof row.experience === 'string' ? JSON.parse(row.experience) : row.experience,
    education: typeof row.education === 'string' ? JSON.parse(row.education) : row.education,
    skills: typeof row.skills === 'string' ? JSON.parse(row.skills) : row.skills,
    recentPosts: typeof row.recent_posts === 'string' ? JSON.parse(row.recent_posts) : row.recent_posts,
    activitySignals: typeof row.activity_signals === 'string' ? JSON.parse(row.activity_signals) : row.activity_signals,
  }
}

/**
 * Get a profile by ID
 */
export async function getProfileById(id: string): Promise<LinkedInProfile | null> {
  const result = await query<LinkedInProfile>(
    'SELECT * FROM linkedin_profiles WHERE id = $1',
    [id]
  )

  return result.rows[0] || null
}

/**
 * Search profiles by name or company
 */
export async function searchProfiles(
  userId: string,
  searchTerm: string,
  limit: number = 20
): Promise<LinkedInProfile[]> {
  const result = await query<LinkedInProfile>(`
    SELECT * FROM linkedin_profiles
    WHERE user_id = $1
      AND (
        full_name ILIKE $2
        OR first_name ILIKE $2
        OR last_name ILIKE $2
        OR current_company ILIKE $2
        OR current_title ILIKE $2
      )
    ORDER BY updated_at DESC
    LIMIT $3
  `, [userId, `%${searchTerm}%`, limit])

  return result.rows
}

/**
 * Get all profiles for a user
 */
export async function getUserProfiles(
  userId: string,
  options: {
    limit?: number
    offset?: number
    connectionStatus?: LinkedInProfile['connectionStatus']
  } = {}
): Promise<{ profiles: LinkedInProfile[]; total: number }> {
  const { limit = 50, offset = 0, connectionStatus } = options

  let whereClause = 'WHERE user_id = $1'
  const params: any[] = [userId]

  if (connectionStatus) {
    params.push(connectionStatus)
    whereClause += ` AND connection_status = $${params.length}`
  }

  const countResult = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM linkedin_profiles ${whereClause}`,
    params
  )

  params.push(limit, offset)
  const result = await query<LinkedInProfile>(
    `SELECT * FROM linkedin_profiles ${whereClause}
     ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  return {
    profiles: result.rows,
    total: parseInt(countResult.rows[0].count as any)
  }
}

/**
 * Update connection status
 */
export async function updateConnectionStatus(
  profileId: string,
  status: LinkedInProfile['connectionStatus']
): Promise<void> {
  await query(
    'UPDATE linkedin_profiles SET connection_status = $1, updated_at = NOW() WHERE id = $2',
    [status, profileId]
  )
}

// ============================================================================
// ENRICHMENT
// ============================================================================

/**
 * Attempt to enrich a profile with additional data
 * This is a framework for integrating with enrichment services
 */
export async function enrichProfile(
  linkedinUrl: string,
  userId: string,
  options: {
    useCache?: boolean
    services?: string[] // Which enrichment services to try
  } = {}
): Promise<ProfileEnrichmentResult> {
  const { useCache = true, services = ['proxycurl', 'clearbit', 'apollo'] } = options

  // Check cache first
  if (useCache) {
    const cached = await getProfileByUrl(linkedinUrl)
    if (cached && cached.lastEnrichedAt) {
      const cacheAge = Date.now() - new Date(cached.lastEnrichedAt).getTime()
      const ONE_WEEK = 7 * 24 * 60 * 60 * 1000

      if (cacheAge < ONE_WEEK && cached.source === 'enrichment') {
        return {
          success: true,
          profile: cached,
          source: 'cache',
          confidence: 0.9
        }
      }
    }
  }

  // Try each enrichment service
  for (const service of services) {
    try {
      let result: ProfileEnrichmentResult | null = null

      switch (service) {
        case 'proxycurl':
          result = await enrichWithProxycurl(linkedinUrl)
          break
        case 'clearbit':
          result = await enrichWithClearbit(linkedinUrl)
          break
        case 'apollo':
          result = await enrichWithApollo(linkedinUrl)
          break
      }

      if (result?.success && result.profile) {
        // Save enriched data
        await saveProfile({
          ...result.profile,
          linkedinUrl,
          userId,
          source: 'enrichment',
          enrichmentService: service,
          lastEnrichedAt: new Date()
        })

        return result
      }
    } catch (error) {
      console.error(`Enrichment with ${service} failed:`, error)
    }
  }

  // Fallback: parse what we can from the URL
  const parsed = parseLinkedInUrl(linkedinUrl)
  if (parsed.isValid && parsed.linkedinId) {
    const nameGuess = guessNameFromLinkedInId(parsed.linkedinId)

    const profile = await saveProfile({
      linkedinUrl,
      userId,
      linkedinId: parsed.linkedinId,
      ...nameGuess,
      source: 'parsed'
    })

    return {
      success: true,
      profile,
      source: 'url_parsing',
      confidence: 0.3
    }
  }

  return {
    success: false,
    source: 'none',
    confidence: 0,
    error: 'Could not enrich profile from any source'
  }
}

/**
 * Enrich with Proxycurl (if API key available)
 */
async function enrichWithProxycurl(linkedinUrl: string): Promise<ProfileEnrichmentResult> {
  const apiKey = process.env.PROXYCURL_API_KEY
  if (!apiKey) {
    return { success: false, source: 'proxycurl', confidence: 0, error: 'No API key' }
  }

  try {
    const response = await fetch(
      `https://nubela.co/proxycurl/api/v2/linkedin?url=${encodeURIComponent(linkedinUrl)}`,
      {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      }
    )

    if (!response.ok) {
      return { success: false, source: 'proxycurl', confidence: 0, error: `HTTP ${response.status}` }
    }

    const data = await response.json()

    return {
      success: true,
      profile: {
        firstName: data.first_name,
        lastName: data.last_name,
        fullName: data.full_name,
        headline: data.headline,
        location: data.city ? `${data.city}, ${data.country_full_name}` : data.country_full_name,
        currentTitle: data.occupation,
        currentCompany: data.experiences?.[0]?.company,
        industry: data.industry,
        about: data.summary,
        experience: data.experiences?.map((exp: any) => ({
          title: exp.title,
          company: exp.company,
          companyLinkedInUrl: exp.company_linkedin_profile_url,
          startDate: exp.starts_at ? `${exp.starts_at.year}-${exp.starts_at.month}` : undefined,
          endDate: exp.ends_at ? `${exp.ends_at.year}-${exp.ends_at.month}` : undefined,
          isCurrent: !exp.ends_at,
          description: exp.description,
          location: exp.location
        })) || [],
        education: data.education?.map((edu: any) => ({
          school: edu.school,
          degree: edu.degree_name,
          field: edu.field_of_study,
          startYear: edu.starts_at?.year,
          endYear: edu.ends_at?.year
        })) || [],
        skills: data.skills || [],
        recentPosts: data.activities?.map((act: any) => ({
          content: act.title || act.activity_status,
          postedAt: act.published_at ? new Date(act.published_at) : undefined
        })) || []
      },
      source: 'proxycurl',
      confidence: 0.95
    }
  } catch (error) {
    return {
      success: false,
      source: 'proxycurl',
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Enrich with Clearbit (placeholder)
 */
async function enrichWithClearbit(linkedinUrl: string): Promise<ProfileEnrichmentResult> {
  const apiKey = process.env.CLEARBIT_API_KEY
  if (!apiKey) {
    return { success: false, source: 'clearbit', confidence: 0, error: 'No API key' }
  }

  // Clearbit requires email, not LinkedIn URL
  // This would need to be enhanced to work with their Person API
  return { success: false, source: 'clearbit', confidence: 0, error: 'Not implemented' }
}

/**
 * Enrich with Apollo (placeholder)
 */
async function enrichWithApollo(linkedinUrl: string): Promise<ProfileEnrichmentResult> {
  const apiKey = process.env.APOLLO_API_KEY
  if (!apiKey) {
    return { success: false, source: 'apollo', confidence: 0, error: 'No API key' }
  }

  try {
    const response = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({
        api_key: apiKey,
        linkedin_url: linkedinUrl
      })
    })

    if (!response.ok) {
      return { success: false, source: 'apollo', confidence: 0, error: `HTTP ${response.status}` }
    }

    const data = await response.json()
    const person = data.person

    if (!person) {
      return { success: false, source: 'apollo', confidence: 0, error: 'No match found' }
    }

    return {
      success: true,
      profile: {
        firstName: person.first_name,
        lastName: person.last_name,
        fullName: person.name,
        headline: person.headline,
        currentTitle: person.title,
        currentCompany: person.organization?.name,
        industry: person.organization?.industry,
        location: person.city ? `${person.city}, ${person.country}` : person.country
      },
      source: 'apollo',
      confidence: 0.85
    }
  } catch (error) {
    return {
      success: false,
      source: 'apollo',
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// ============================================================================
// MANUAL ENTRY HELPERS
// ============================================================================

/**
 * Parse profile info from user's natural language description
 */
export async function parseProfileFromDescription(
  description: string,
  linkedinUrl?: string
): Promise<Partial<LinkedInProfile>> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: `You extract LinkedIn profile information from natural language descriptions.
Return ONLY valid JSON with these fields (all optional):
{
  "firstName": "string",
  "lastName": "string",
  "fullName": "string",
  "currentTitle": "string",
  "currentCompany": "string",
  "industry": "string",
  "location": "string",
  "notes": "any additional context"
}`,
    messages: [
      {
        role: 'user',
        content: `Extract profile info from: "${description}"${linkedinUrl ? `\nLinkedIn URL: ${linkedinUrl}` : ''}`
      }
    ]
  })

  const text = response.content.find(b => b.type === 'text')?.text || '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)

  try {
    return JSON.parse(jsonMatch?.[0] || '{}')
  } catch {
    return {}
  }
}

/**
 * Generate a profile summary for chat display
 */
export function formatProfileForChat(profile: LinkedInProfile): string {
  const parts: string[] = []

  const name = profile.fullName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Unknown'
  parts.push(`**${name}**`)

  if (profile.currentTitle && profile.currentCompany) {
    parts.push(`${profile.currentTitle} at ${profile.currentCompany}`)
  } else if (profile.currentTitle) {
    parts.push(profile.currentTitle)
  } else if (profile.headline) {
    parts.push(profile.headline)
  }

  if (profile.location) {
    parts.push(`Location: ${profile.location}`)
  }

  if (profile.connectionStatus && profile.connectionStatus !== 'unknown') {
    parts.push(`Connection: ${profile.connectionStatus}`)
  }

  if (profile.activitySignals?.length) {
    parts.push(`Signals: ${profile.activitySignals.slice(0, 3).join(', ')}`)
  }

  parts.push(`[View on LinkedIn](${profile.linkedinUrl})`)

  return parts.join('\n')
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  parseLinkedInUrl,
  guessNameFromLinkedInId,
  saveProfile,
  getProfileByUrl,
  getProfileById,
  searchProfiles,
  getUserProfiles,
  updateConnectionStatus,
  enrichProfile,
  parseProfileFromDescription,
  formatProfileForChat
}
