// @ts-nocheck
/**
 * LinkedIn Sales Navigator Integration
 *
 * For users who have Sales Navigator API access.
 * Most users won't have this - it requires enterprise subscription
 * and API partnership with LinkedIn.
 *
 * Features:
 * - Lead search by criteria
 * - InMail sending (actual API, not manual)
 * - Lead list management
 * - Advanced filtering
 * - CRM sync
 *
 * This is OPTIONAL - the rest of LinkedIn integration
 * works without it.
 */

import { query } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { LinkedInProfile, saveProfile } from './profile-service'

// ============================================================================
// TYPES
// ============================================================================

export interface SalesNavigatorConfig {
  clientId: string
  clientSecret: string
  accessToken?: string
  refreshToken?: string
  tokenExpiresAt?: Date
  apiVersion?: string
}

export interface SalesNavigatorLead {
  id: string
  urn: string // LinkedIn URN format

  // Basic info
  firstName: string
  lastName: string
  fullName: string
  headline: string
  profileUrl: string
  profilePicture?: string

  // Professional
  title: string
  company: string
  companyId?: string
  companyLinkedInUrl?: string
  industry?: string
  location?: string

  // Sales Navigator specific
  connectionDegree: 1 | 2 | 3
  sharedConnections: number
  savedToList?: boolean
  lastActivityAt?: Date

  // InMail
  openToInMail: boolean
  inMailCreditsRequired: number
}

export interface LeadSearchCriteria {
  // Title/Role
  titles?: string[]
  titleExclusions?: string[]
  seniorityLevels?: ('cxo' | 'vp' | 'director' | 'manager' | 'individual')[]

  // Company
  companyNames?: string[]
  companyIds?: string[]
  companySizes?: ('1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1001-5000' | '5001+')[]
  industries?: string[]

  // Location
  locations?: string[]
  geoRadius?: number // miles

  // Connections
  connectionDegrees?: (1 | 2 | 3)[]
  hasSharedConnections?: boolean

  // Activity
  recentlyActive?: boolean // Active in last 30 days
  changedJobsRecently?: boolean
  postedRecently?: boolean

  // Lead lists
  excludeLists?: string[]
  includeOnlyLists?: string[]

  // Pagination
  offset?: number
  limit?: number
}

export interface LeadList {
  id: string
  name: string
  description?: string
  leadCount: number
  createdAt: Date
  updatedAt: Date
}

export interface InMailMessage {
  recipientUrn: string
  subject: string
  body: string
  trackingId?: string
}

export interface InMailResult {
  success: boolean
  messageId?: string
  creditsUsed?: number
  error?: string
}

export interface SalesNavigatorStats {
  inmailCreditsRemaining: number
  inmailCreditsCap: number
  leadSearchesRemaining: number
  savedLeadsCount: number
  leadsViewedThisMonth: number
}

// ============================================================================
// CLIENT
// ============================================================================

/**
 * Sales Navigator API Client
 */
export class SalesNavigatorClient {
  private config: SalesNavigatorConfig
  private baseUrl = 'https://api.linkedin.com/v2'

  constructor(config: SalesNavigatorConfig) {
    this.config = config
  }

  /**
   * Check if Sales Navigator is configured and available
   */
  static isAvailable(): boolean {
    return !!(
      process.env.LINKEDIN_SALES_NAV_CLIENT_ID &&
      process.env.LINKEDIN_SALES_NAV_CLIENT_SECRET
    )
  }

  /**
   * Create client from environment variables
   */
  static fromEnv(): SalesNavigatorClient | null {
    if (!SalesNavigatorClient.isAvailable()) {
      return null
    }

    return new SalesNavigatorClient({
      clientId: process.env.LINKEDIN_SALES_NAV_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_SALES_NAV_CLIENT_SECRET!,
      accessToken: process.env.LINKEDIN_SALES_NAV_ACCESS_TOKEN,
      refreshToken: process.env.LINKEDIN_SALES_NAV_REFRESH_TOKEN
    })
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return !!(this.config.accessToken && this.config.tokenExpiresAt && new Date() < this.config.tokenExpiresAt)
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<boolean> {
    if (!this.config.refreshToken) {
      return false
    }

    try {
      const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.config.refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret
        })
      })

      if (!response.ok) {
        console.error('Failed to refresh Sales Navigator token')
        return false
      }

      const data = await response.json()
      this.config.accessToken = data.access_token
      this.config.refreshToken = data.refresh_token
      this.config.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000)

      return true
    } catch (error) {
      console.error('Error refreshing Sales Navigator token:', error)
      return false
    }
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.isAuthenticated()) {
      const refreshed = await this.refreshAccessToken()
      if (!refreshed) {
        throw new Error('Not authenticated with Sales Navigator')
      }
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202312', // API version
        ...options.headers
      }
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Sales Navigator API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  // ==========================================================================
  // LEAD SEARCH
  // ==========================================================================

  /**
   * Search for leads by criteria
   */
  async searchLeads(criteria: LeadSearchCriteria): Promise<{
    leads: SalesNavigatorLead[]
    total: number
    hasMore: boolean
  }> {
    // Build the search query
    // Note: Actual Sales Navigator API structure differs
    // This is a simplified representation
    const searchParams = new URLSearchParams()

    if (criteria.titles?.length) {
      searchParams.set('titles', criteria.titles.join(','))
    }
    if (criteria.companyNames?.length) {
      searchParams.set('companies', criteria.companyNames.join(','))
    }
    if (criteria.industries?.length) {
      searchParams.set('industries', criteria.industries.join(','))
    }
    if (criteria.locations?.length) {
      searchParams.set('locations', criteria.locations.join(','))
    }
    if (criteria.seniorityLevels?.length) {
      searchParams.set('seniority', criteria.seniorityLevels.join(','))
    }

    searchParams.set('start', String(criteria.offset || 0))
    searchParams.set('count', String(Math.min(criteria.limit || 25, 50)))

    try {
      const data = await this.request<any>(
        `/salesNavigatorLeads?${searchParams.toString()}`
      )

      // Transform API response to our format
      const leads: SalesNavigatorLead[] = (data.elements || []).map((el: any) => ({
        id: el.entityUrn || el.id,
        urn: el.entityUrn,
        firstName: el.firstName,
        lastName: el.lastName,
        fullName: `${el.firstName} ${el.lastName}`,
        headline: el.headline,
        profileUrl: el.linkedInUrl || `https://www.linkedin.com/in/${el.publicIdentifier}`,
        profilePicture: el.profilePicture?.url,
        title: el.currentPosition?.title,
        company: el.currentPosition?.company?.name,
        companyId: el.currentPosition?.company?.entityUrn,
        industry: el.industry,
        location: el.location,
        connectionDegree: el.connectionDegree || 3,
        sharedConnections: el.sharedConnectionsCount || 0,
        openToInMail: el.openToInMail || false,
        inMailCreditsRequired: el.inMailCreditsRequired || 1
      }))

      return {
        leads,
        total: data.paging?.total || leads.length,
        hasMore: (data.paging?.start || 0) + leads.length < (data.paging?.total || 0)
      }
    } catch (error) {
      console.error('Sales Navigator search error:', error)
      return { leads: [], total: 0, hasMore: false }
    }
  }

  /**
   * Get lead details by URN
   */
  async getLeadDetails(leadUrn: string): Promise<SalesNavigatorLead | null> {
    try {
      const data = await this.request<any>(`/salesNavigatorLeads/${encodeURIComponent(leadUrn)}`)

      return {
        id: data.entityUrn || leadUrn,
        urn: data.entityUrn || leadUrn,
        firstName: data.firstName,
        lastName: data.lastName,
        fullName: `${data.firstName} ${data.lastName}`,
        headline: data.headline,
        profileUrl: data.linkedInUrl,
        title: data.currentPosition?.title,
        company: data.currentPosition?.company?.name,
        connectionDegree: data.connectionDegree,
        sharedConnections: data.sharedConnectionsCount || 0,
        openToInMail: data.openToInMail || false,
        inMailCreditsRequired: data.inMailCreditsRequired || 1
      }
    } catch (error) {
      console.error('Failed to get lead details:', error)
      return null
    }
  }

  // ==========================================================================
  // LEAD LISTS
  // ==========================================================================

  /**
   * Get all lead lists
   */
  async getLeadLists(): Promise<LeadList[]> {
    try {
      const data = await this.request<any>('/salesNavigatorLeadLists')

      return (data.elements || []).map((list: any) => ({
        id: list.entityUrn || list.id,
        name: list.name,
        description: list.description,
        leadCount: list.memberCount || 0,
        createdAt: new Date(list.createdAt),
        updatedAt: new Date(list.lastModifiedAt || list.createdAt)
      }))
    } catch (error) {
      console.error('Failed to get lead lists:', error)
      return []
    }
  }

  /**
   * Get leads from a specific list
   */
  async getLeadsFromList(
    listId: string,
    offset: number = 0,
    limit: number = 25
  ): Promise<SalesNavigatorLead[]> {
    try {
      const data = await this.request<any>(
        `/salesNavigatorLeadLists/${encodeURIComponent(listId)}/members?start=${offset}&count=${limit}`
      )

      return (data.elements || []).map((el: any) => ({
        id: el.lead?.entityUrn,
        urn: el.lead?.entityUrn,
        firstName: el.lead?.firstName,
        lastName: el.lead?.lastName,
        fullName: `${el.lead?.firstName} ${el.lead?.lastName}`,
        headline: el.lead?.headline,
        profileUrl: el.lead?.linkedInUrl,
        title: el.lead?.currentPosition?.title,
        company: el.lead?.currentPosition?.company?.name,
        connectionDegree: el.lead?.connectionDegree,
        sharedConnections: 0,
        savedToList: true,
        openToInMail: el.lead?.openToInMail || false,
        inMailCreditsRequired: 1
      }))
    } catch (error) {
      console.error('Failed to get leads from list:', error)
      return []
    }
  }

  /**
   * Save lead to a list
   */
  async saveLeadToList(leadUrn: string, listId: string): Promise<boolean> {
    try {
      await this.request(`/salesNavigatorLeadLists/${encodeURIComponent(listId)}/members`, {
        method: 'POST',
        body: JSON.stringify({
          leads: [{ leadUrn }]
        })
      })
      return true
    } catch (error) {
      console.error('Failed to save lead to list:', error)
      return false
    }
  }

  // ==========================================================================
  // INMAIL
  // ==========================================================================

  /**
   * Send an InMail
   */
  async sendInMail(message: InMailMessage): Promise<InMailResult> {
    try {
      const data = await this.request<any>('/salesNavigatorInMails', {
        method: 'POST',
        body: JSON.stringify({
          recipientUrn: message.recipientUrn,
          subject: message.subject,
          body: message.body,
          trackingId: message.trackingId || uuidv4()
        })
      })

      return {
        success: true,
        messageId: data.messageId,
        creditsUsed: data.creditsUsed || 1
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get InMail credit balance
   */
  async getInMailCredits(): Promise<{ remaining: number; cap: number }> {
    try {
      const data = await this.request<any>('/salesNavigatorInMailCredits')

      return {
        remaining: data.remaining || 0,
        cap: data.cap || 0
      }
    } catch (error) {
      console.error('Failed to get InMail credits:', error)
      return { remaining: 0, cap: 0 }
    }
  }

  // ==========================================================================
  // STATS
  // ==========================================================================

  /**
   * Get Sales Navigator usage stats
   */
  async getStats(): Promise<SalesNavigatorStats> {
    try {
      const [credits, usage] = await Promise.all([
        this.getInMailCredits(),
        this.request<any>('/salesNavigatorUsage')
      ])

      return {
        inmailCreditsRemaining: credits.remaining,
        inmailCreditsCap: credits.cap,
        leadSearchesRemaining: usage.searchesRemaining || 0,
        savedLeadsCount: usage.savedLeadsCount || 0,
        leadsViewedThisMonth: usage.leadsViewedThisMonth || 0
      }
    } catch (error) {
      console.error('Failed to get Sales Navigator stats:', error)
      return {
        inmailCreditsRemaining: 0,
        inmailCreditsCap: 0,
        leadSearchesRemaining: 0,
        savedLeadsCount: 0,
        leadsViewedThisMonth: 0
      }
    }
  }
}

// ============================================================================
// DATABASE SYNC
// ============================================================================

/**
 * Sync Sales Navigator leads to linkedin_profiles table
 */
export async function syncLeadsToProfiles(
  userId: string,
  leads: SalesNavigatorLead[]
): Promise<number> {
  let synced = 0

  for (const lead of leads) {
    try {
      await saveProfile({
        linkedinUrl: lead.profileUrl,
        linkedinId: lead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        fullName: lead.fullName,
        headline: lead.headline,
        currentTitle: lead.title,
        currentCompany: lead.company,
        industry: lead.industry,
        location: lead.location,
        source: 'sales_navigator',
        userId,
        connectionStatus: lead.connectionDegree === 1 ? 'connected' : 'unknown'
      })
      synced++
    } catch (error) {
      console.error(`Failed to sync lead ${lead.id}:`, error)
    }
  }

  return synced
}

// ============================================================================
// CHAT INTEGRATION
// ============================================================================

/**
 * Format leads for chat display
 */
export function formatLeadsForChat(leads: SalesNavigatorLead[]): string {
  if (!leads.length) {
    return 'No leads found matching your criteria.'
  }

  const lines: string[] = [`**Found ${leads.length} leads:**\n`]

  for (const lead of leads.slice(0, 10)) {
    const connection = lead.connectionDegree === 1 ? '(1st)' :
      lead.connectionDegree === 2 ? '(2nd)' : '(3rd)'

    lines.push(`- **${lead.fullName}** ${connection}`)
    lines.push(`  ${lead.title} at ${lead.company}`)

    if (lead.sharedConnections > 0) {
      lines.push(`  ${lead.sharedConnections} shared connections`)
    }

    if (lead.openToInMail) {
      lines.push(`  Open to InMail`)
    }

    lines.push('')
  }

  if (leads.length > 10) {
    lines.push(`... and ${leads.length - 10} more`)
  }

  return lines.join('\n')
}

/**
 * Parse search criteria from natural language
 */
export async function parseSearchCriteria(
  description: string
): Promise<LeadSearchCriteria> {
  // Simple keyword extraction
  // In production, use Claude to parse this
  const criteria: LeadSearchCriteria = {}

  // Title patterns
  const titleMatch = description.match(/(?:vp|director|head|manager|cto|cfo|ceo|chief|founder)/gi)
  if (titleMatch) {
    criteria.titles = titleMatch.map(t => t.toLowerCase())
  }

  // Seniority
  if (description.toLowerCase().includes('executive') || description.toLowerCase().includes('c-level')) {
    criteria.seniorityLevels = ['cxo', 'vp']
  } else if (description.toLowerCase().includes('director')) {
    criteria.seniorityLevels = ['director', 'vp']
  } else if (description.toLowerCase().includes('manager')) {
    criteria.seniorityLevels = ['manager', 'director']
  }

  // Industry patterns
  const industryPatterns = [
    'manufacturing', 'technology', 'healthcare', 'finance', 'retail',
    'construction', 'logistics', 'aerospace', 'defense', 'automotive'
  ]
  for (const industry of industryPatterns) {
    if (description.toLowerCase().includes(industry)) {
      criteria.industries = criteria.industries || []
      criteria.industries.push(industry)
    }
  }

  // Company size
  if (description.includes('enterprise') || description.includes('large')) {
    criteria.companySizes = ['501-1000', '1001-5000', '5001+']
  } else if (description.includes('mid-market') || description.includes('midsize')) {
    criteria.companySizes = ['51-200', '201-500', '501-1000']
  } else if (description.includes('startup') || description.includes('small')) {
    criteria.companySizes = ['1-10', '11-50', '51-200']
  }

  // Activity signals
  if (description.includes('active') || description.includes('recently')) {
    criteria.recentlyActive = true
  }

  if (description.includes('changed job') || description.includes('new role')) {
    criteria.changedJobsRecently = true
  }

  return criteria
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  SalesNavigatorClient,
  syncLeadsToProfiles,
  formatLeadsForChat,
  parseSearchCriteria
}
