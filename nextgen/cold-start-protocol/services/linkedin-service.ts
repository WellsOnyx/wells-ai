// @ts-nocheck
/**
 * Cold Start Protocol - LinkedIn Automation Service
 *
 * Handles LinkedIn personal account and LinkedIn Recruiter automation.
 * Uses session cookies for API access (your personal account only).
 *
 * SAFETY: This is MASTER ACCESS ONLY - only the owner uses this.
 * Daily limits enforced to stay under LinkedIn's radar.
 */

import type {
  IcpDefinition,
  Prospect,
  CampaignAction,
  ActionResult,
  ChannelCredentials,
} from '../types'

// ============================================================================
// LINKEDIN LIMITS (Conservative to avoid blocks)
// ============================================================================

const LINKEDIN_LIMITS = {
  // Connection requests
  connectionRequestsPerDay: 50,  // LinkedIn allows ~100, we do 50 to be safe
  connectionRequestsPerHour: 10,

  // Messages
  messagesPerDay: 100,
  inmailsPerDay: 30,  // If you have InMail credits

  // Searches
  searchesPerDay: 300,
  profileViewsPerDay: 150,

  // Delays (milliseconds)
  minDelayBetweenActions: 5000,  // 5 seconds minimum
  maxDelayBetweenActions: 15000, // 15 seconds max
  profileViewDelay: 3000,        // Before sending connection
}

// ============================================================================
// LINKEDIN SERVICE
// ============================================================================

export class LinkedInService {
  private credentials: ChannelCredentials['linkedin']
  private recruiterCredentials?: ChannelCredentials['linkedinRecruiter']

  // Usage tracking
  private dailyStats = {
    connectionsSent: 0,
    messagesSent: 0,
    inmailsSent: 0,
    searchesMade: 0,
    profilesViewed: 0,
    lastResetDate: new Date().toDateString(),
  }

  constructor(
    credentials: ChannelCredentials['linkedin'],
    recruiterCredentials?: ChannelCredentials['linkedinRecruiter']
  ) {
    this.credentials = credentials
    this.recruiterCredentials = recruiterCredentials
    this.checkDailyReset()
  }

  // --------------------------------------------------------------------------
  // SEARCH PEOPLE
  // --------------------------------------------------------------------------

  async searchPeople(
    icp: IcpDefinition,
    page: number = 1
  ): Promise<{ prospects: Partial<Prospect>[]; totalCount: number }> {
    this.checkDailyReset()

    if (this.dailyStats.searchesMade >= LINKEDIN_LIMITS.searchesPerDay) {
      throw new Error('Daily LinkedIn search limit reached')
    }

    // Build LinkedIn search URL
    const searchUrl = this.buildSearchUrl(icp, page)

    // In production, this would use Puppeteer or your session to fetch
    // For now, we'll use LinkedIn's unofficial API endpoints
    const searchParams = this.buildSearchParams(icp, page)

    try {
      const response = await this.makeLinkedInRequest(
        '/voyager/api/search/blended',
        'GET',
        searchParams
      )

      this.dailyStats.searchesMade++

      const prospects = this.parseSearchResults(response)

      return {
        prospects,
        totalCount: response.data?.paging?.total || 0,
      }
    } catch (error) {
      console.error('LinkedIn search failed:', error)
      throw error
    }
  }

  // --------------------------------------------------------------------------
  // RECRUITER SEARCH (Enhanced with Recruiter Lite/Full)
  // --------------------------------------------------------------------------

  async recruiterSearch(
    query: string,
    filters: Record<string, unknown> = {},
    page: number = 1
  ): Promise<{ prospects: Partial<Prospect>[]; totalCount: number }> {
    if (!this.recruiterCredentials) {
      throw new Error('LinkedIn Recruiter credentials not configured')
    }

    // Recruiter has different endpoints and more powerful search
    const searchParams = {
      keywords: query,
      start: (page - 1) * 25,
      count: 25,
      ...filters,
    }

    try {
      const response = await this.makeRecruiterRequest(
        '/recruiter/api/v1/search/people',
        'POST',
        searchParams
      )

      return {
        prospects: this.parseRecruiterResults(response),
        totalCount: response.paging?.total || 0,
      }
    } catch (error) {
      console.error('LinkedIn Recruiter search failed:', error)
      throw error
    }
  }

  // --------------------------------------------------------------------------
  // SEND CONNECTION REQUEST
  // --------------------------------------------------------------------------

  async sendConnectionRequest(
    profileId: string,
    profileUrn: string,
    message?: string  // Custom connection message (300 char limit)
  ): Promise<{ success: boolean; error?: string }> {
    this.checkDailyReset()

    if (this.dailyStats.connectionsSent >= LINKEDIN_LIMITS.connectionRequestsPerDay) {
      return {
        success: false,
        error: 'Daily connection request limit reached',
      }
    }

    // View profile first (looks more natural)
    await this.viewProfile(profileId)
    await this.randomDelay(LINKEDIN_LIMITS.profileViewDelay)

    try {
      const body: Record<string, unknown> = {
        trackingId: this.generateTrackingId(),
        invitee: {
          'com.linkedin.voyager.growth.invitation.InviteeProfile': {
            profileId,
          },
        },
      }

      if (message) {
        // Truncate message to 300 chars
        body.message = message.slice(0, 300)
      }

      await this.makeLinkedInRequest(
        '/voyager/api/growth/normInvitations',
        'POST',
        body
      )

      this.dailyStats.connectionsSent++

      await this.randomDelay()

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Check for common LinkedIn blocks
      if (errorMessage.includes('MEMBER_RESTRICT')) {
        return { success: false, error: 'Account temporarily restricted' }
      }
      if (errorMessage.includes('SPAM_DETECTED')) {
        return { success: false, error: 'LinkedIn detected spam-like behavior' }
      }

      return { success: false, error: errorMessage }
    }
  }

  // --------------------------------------------------------------------------
  // SEND MESSAGE (To 1st degree connections)
  // --------------------------------------------------------------------------

  async sendMessage(
    conversationId: string,
    message: string
  ): Promise<{ success: boolean; error?: string }> {
    this.checkDailyReset()

    if (this.dailyStats.messagesSent >= LINKEDIN_LIMITS.messagesPerDay) {
      return {
        success: false,
        error: 'Daily message limit reached',
      }
    }

    try {
      const body = {
        eventCreate: {
          value: {
            'com.linkedin.voyager.messaging.create.MessageCreate': {
              body: message,
              attachments: [],
            },
          },
        },
      }

      await this.makeLinkedInRequest(
        `/voyager/api/messaging/conversations/${conversationId}/events`,
        'POST',
        body
      )

      this.dailyStats.messagesSent++

      await this.randomDelay()

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Message failed',
      }
    }
  }

  // --------------------------------------------------------------------------
  // SEND INMAIL (Requires InMail credits)
  // --------------------------------------------------------------------------

  async sendInMail(
    profileId: string,
    subject: string,
    message: string
  ): Promise<{ success: boolean; error?: string }> {
    this.checkDailyReset()

    if (this.dailyStats.inmailsSent >= LINKEDIN_LIMITS.inmailsPerDay) {
      return {
        success: false,
        error: 'Daily InMail limit reached',
      }
    }

    try {
      const body = {
        mailboxUrn: `urn:li:fs_mailbox:${profileId}`,
        subject,
        body: message,
        trackingId: this.generateTrackingId(),
      }

      await this.makeLinkedInRequest(
        '/voyager/api/messaging/conversations',
        'POST',
        body
      )

      this.dailyStats.inmailsSent++

      await this.randomDelay()

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'InMail failed',
      }
    }
  }

  // --------------------------------------------------------------------------
  // RECRUITER INMAIL (Uses Recruiter InMail credits)
  // --------------------------------------------------------------------------

  async sendRecruiterInMail(
    candidateId: string,
    subject: string,
    message: string,
    template?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.recruiterCredentials) {
      return { success: false, error: 'Recruiter not configured' }
    }

    try {
      const body = {
        candidateId,
        subject,
        body: message,
        messageTemplateId: template,
      }

      await this.makeRecruiterRequest(
        '/recruiter/api/v1/inmails',
        'POST',
        body
      )

      this.dailyStats.inmailsSent++

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Recruiter InMail failed',
      }
    }
  }

  // --------------------------------------------------------------------------
  // VIEW PROFILE
  // --------------------------------------------------------------------------

  async viewProfile(profileId: string): Promise<void> {
    if (this.dailyStats.profilesViewed >= LINKEDIN_LIMITS.profileViewsPerDay) {
      return // Silently skip if limit reached
    }

    try {
      await this.makeLinkedInRequest(
        `/voyager/api/identity/profiles/${profileId}`,
        'GET'
      )
      this.dailyStats.profilesViewed++
    } catch (error) {
      // Profile view failures are non-critical
      console.warn('Profile view failed:', error)
    }
  }

  // --------------------------------------------------------------------------
  // GET PROFILE DETAILS
  // --------------------------------------------------------------------------

  async getProfile(profileId: string): Promise<Partial<Prospect> | null> {
    try {
      const response = await this.makeLinkedInRequest(
        `/voyager/api/identity/profiles/${profileId}`,
        'GET'
      )

      return this.parseProfile(response)
    } catch (error) {
      console.error('Get profile failed:', error)
      return null
    }
  }

  // --------------------------------------------------------------------------
  // CHECK PENDING CONNECTIONS
  // --------------------------------------------------------------------------

  async getPendingConnections(): Promise<Array<{
    profileId: string
    name: string
    sentAt: string
  }>> {
    try {
      const response = await this.makeLinkedInRequest(
        '/voyager/api/relationships/sentInvitationViewsV2',
        'GET',
        { start: 0, count: 100 }
      )

      return (response.data?.elements || []).map((inv: any) => ({
        profileId: inv.invitation?.invitee?.profileId,
        name: `${inv.invitation?.invitee?.firstName} ${inv.invitation?.invitee?.lastName}`,
        sentAt: inv.invitation?.sentTime,
      }))
    } catch (error) {
      console.error('Get pending connections failed:', error)
      return []
    }
  }

  // --------------------------------------------------------------------------
  // CHECK NEW MESSAGES
  // --------------------------------------------------------------------------

  async getNewMessages(): Promise<Array<{
    conversationId: string
    participantName: string
    lastMessage: string
    timestamp: string
  }>> {
    try {
      const response = await this.makeLinkedInRequest(
        '/voyager/api/messaging/conversations',
        'GET',
        { keyVersion: 'LEGACY_INBOX' }
      )

      return (response.data?.elements || [])
        .filter((conv: any) => !conv.read)
        .map((conv: any) => ({
          conversationId: conv.entityUrn?.replace('urn:li:msg_conversation:', ''),
          participantName: conv.participants?.[0]?.name,
          lastMessage: conv.lastMessage?.body,
          timestamp: conv.lastActivityAt,
        }))
    } catch (error) {
      console.error('Get messages failed:', error)
      return []
    }
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS
  // --------------------------------------------------------------------------

  private buildSearchUrl(icp: IcpDefinition, page: number): string {
    const params = new URLSearchParams()

    if (icp.keywords?.length) {
      params.set('keywords', icp.keywords.join(' '))
    }

    if (icp.titles?.length) {
      params.set('title', icp.titles.join(' OR '))
    }

    if (icp.locations?.length) {
      params.set('location', icp.locations.join(' OR '))
    }

    if (icp.industries?.length) {
      params.set('industry', icp.industries.join(' OR '))
    }

    // LinkedIn custom query override
    if (icp.linkedinQuery) {
      params.set('keywords', icp.linkedinQuery)
    }

    params.set('page', String(page))

    return `https://www.linkedin.com/search/results/people/?${params.toString()}`
  }

  private buildSearchParams(icp: IcpDefinition, page: number): Record<string, unknown> {
    const filters: any[] = []

    if (icp.industries?.length) {
      filters.push({
        type: 'INDUSTRY',
        values: icp.industries,
      })
    }

    if (icp.titles?.length) {
      filters.push({
        type: 'CURRENT_TITLE',
        values: icp.titles,
      })
    }

    if (icp.locations?.length) {
      filters.push({
        type: 'REGION',
        values: icp.locations,
      })
    }

    if (icp.companySizeMin || icp.companySizeMax) {
      filters.push({
        type: 'COMPANY_SIZE',
        values: this.getSizeRanges(icp.companySizeMin, icp.companySizeMax),
      })
    }

    return {
      keywords: icp.keywords?.join(' ') || icp.linkedinQuery || '',
      filters,
      origin: 'FACETED_SEARCH',
      start: (page - 1) * 25,
      count: 25,
    }
  }

  private getSizeRanges(min?: number, max?: number): string[] {
    const ranges = [
      { code: 'B', min: 1, max: 10 },
      { code: 'C', min: 11, max: 50 },
      { code: 'D', min: 51, max: 200 },
      { code: 'E', min: 201, max: 500 },
      { code: 'F', min: 501, max: 1000 },
      { code: 'G', min: 1001, max: 5000 },
      { code: 'H', min: 5001, max: 10000 },
      { code: 'I', min: 10001, max: Infinity },
    ]

    return ranges
      .filter(r => (!min || r.max >= min) && (!max || r.min <= max))
      .map(r => r.code)
  }

  private parseSearchResults(response: any): Partial<Prospect>[] {
    const results: Partial<Prospect>[] = []

    const elements = response.data?.elements || []

    for (const element of elements) {
      if (element.type !== 'PROFILE') continue

      const profile = element.profile || element

      results.push({
        firstName: profile.firstName,
        lastName: profile.lastName,
        title: profile.headline || profile.title,
        companyName: profile.company?.name,
        linkedinUrl: `https://www.linkedin.com/in/${profile.publicIdentifier}`,
        city: profile.location?.city,
        country: profile.location?.country,
        customFields: {
          linkedinId: profile.entityUrn?.replace('urn:li:fs_miniProfile:', ''),
          publicIdentifier: profile.publicIdentifier,
          profilePicture: profile.picture?.url,
          connectionDegree: profile.distance?.value,
        },
      })
    }

    return results
  }

  private parseRecruiterResults(response: any): Partial<Prospect>[] {
    return (response.elements || []).map((el: any) => ({
      firstName: el.firstName,
      lastName: el.lastName,
      title: el.currentTitle,
      companyName: el.currentCompany,
      linkedinUrl: el.linkedInUrl,
      email: el.emailAddress,  // Recruiter can see emails!
      phone: el.phoneNumber,
      customFields: {
        recruiterId: el.id,
        openToWork: el.openToWork,
        premium: el.premiumSubscriber,
      },
    }))
  }

  private parseProfile(response: any): Partial<Prospect> {
    const profile = response.data || response

    return {
      firstName: profile.firstName,
      lastName: profile.lastName,
      title: profile.headline,
      companyName: profile.experience?.[0]?.companyName,
      linkedinUrl: `https://www.linkedin.com/in/${profile.publicIdentifier}`,
      city: profile.geoLocation?.city,
      state: profile.geoLocation?.state,
      country: profile.geoLocation?.country,
      customFields: {
        linkedinId: profile.entityUrn,
        summary: profile.summary,
        connectionCount: profile.connectionCount,
        followerCount: profile.followerCount,
      },
    }
  }

  private async makeLinkedInRequest(
    endpoint: string,
    method: 'GET' | 'POST',
    params?: Record<string, unknown>
  ): Promise<any> {
    const baseUrl = 'https://www.linkedin.com'

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.linkedin.normalized+json+2.1',
      'X-RestLi-Protocol-Version': '2.0.0',
      'X-Li-Track': JSON.stringify({
        clientVersion: '1.13.8',
        mpVersion: '1.13.8',
        osName: 'web',
        timezoneOffset: -8,
      }),
    }

    if (this.credentials?.sessionCookie) {
      headers['Cookie'] = `li_at=${this.credentials.sessionCookie}`
    }

    const url = method === 'GET' && params
      ? `${baseUrl}${endpoint}?${new URLSearchParams(params as any)}`
      : `${baseUrl}${endpoint}`

    const response = await fetch(url, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(params) : undefined,
    })

    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.status}`)
    }

    return response.json()
  }

  private async makeRecruiterRequest(
    endpoint: string,
    method: 'GET' | 'POST',
    params?: Record<string, unknown>
  ): Promise<any> {
    const baseUrl = 'https://www.linkedin.com'

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }

    if (this.recruiterCredentials?.sessionCookie) {
      headers['Cookie'] = `li_at=${this.recruiterCredentials.sessionCookie}`
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(params) : undefined,
    })

    if (!response.ok) {
      throw new Error(`LinkedIn Recruiter API error: ${response.status}`)
    }

    return response.json()
  }

  private generateTrackingId(): string {
    return [...Array(16)]
      .map(() => Math.random().toString(36)[2])
      .join('')
  }

  private async randomDelay(minMs?: number): Promise<void> {
    const min = minMs || LINKEDIN_LIMITS.minDelayBetweenActions
    const max = LINKEDIN_LIMITS.maxDelayBetweenActions
    const delay = min + Math.random() * (max - min)
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  private checkDailyReset(): void {
    const today = new Date().toDateString()
    if (this.dailyStats.lastResetDate !== today) {
      this.dailyStats = {
        connectionsSent: 0,
        messagesSent: 0,
        inmailsSent: 0,
        searchesMade: 0,
        profilesViewed: 0,
        lastResetDate: today,
      }
    }
  }

  // --------------------------------------------------------------------------
  // STATS & LIMITS
  // --------------------------------------------------------------------------

  getDailyStats(): typeof this.dailyStats {
    return { ...this.dailyStats }
  }

  getRemainingLimits(): Record<string, number> {
    return {
      connections: LINKEDIN_LIMITS.connectionRequestsPerDay - this.dailyStats.connectionsSent,
      messages: LINKEDIN_LIMITS.messagesPerDay - this.dailyStats.messagesSent,
      inmails: LINKEDIN_LIMITS.inmailsPerDay - this.dailyStats.inmailsSent,
      searches: LINKEDIN_LIMITS.searchesPerDay - this.dailyStats.searchesMade,
      profileViews: LINKEDIN_LIMITS.profileViewsPerDay - this.dailyStats.profilesViewed,
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createLinkedInService(
  credentials: ChannelCredentials['linkedin'],
  recruiterCredentials?: ChannelCredentials['linkedinRecruiter']
): LinkedInService {
  return new LinkedInService(credentials, recruiterCredentials)
}

// ============================================================================
// ACTION EXECUTORS
// ============================================================================

export async function executeLinkedInSearch(
  service: LinkedInService,
  action: CampaignAction
): Promise<ActionResult> {
  const { icp, page = 1 } = action.payload as {
    icp: IcpDefinition
    page?: number
  }

  try {
    const result = await service.searchPeople(icp, page)

    return {
      success: true,
      data: {
        prospects: result.prospects,
        totalCount: result.totalCount,
        remainingLimits: service.getRemainingLimits(),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'LinkedIn search failed',
    }
  }
}

export async function executeLinkedInConnection(
  service: LinkedInService,
  action: CampaignAction
): Promise<ActionResult> {
  const { profileId, profileUrn, message } = action.payload as {
    profileId: string
    profileUrn: string
    message?: string
  }

  const result = await service.sendConnectionRequest(profileId, profileUrn, message)

  return {
    success: result.success,
    error: result.error,
    data: {
      remainingLimits: service.getRemainingLimits(),
    },
  }
}

export async function executeLinkedInMessage(
  service: LinkedInService,
  action: CampaignAction
): Promise<ActionResult> {
  const { conversationId, message } = action.payload as {
    conversationId: string
    message: string
  }

  const result = await service.sendMessage(conversationId, message)

  return {
    success: result.success,
    error: result.error,
  }
}
