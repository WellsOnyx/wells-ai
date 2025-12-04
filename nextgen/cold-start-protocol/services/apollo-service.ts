// @ts-nocheck
/**
 * Cold Start Protocol - Apollo Prospecting Service
 *
 * Uses Apollo.io API to find and enrich prospects based on ICP
 * Free tier: 10,000 credits/month, 250 emails/day export
 */

import type {
  IcpDefinition,
  Prospect,
  CampaignAction,
  ActionResult,
} from '../types'

// Apollo API endpoints
const APOLLO_BASE_URL = 'https://api.apollo.io/v1'

// ============================================================================
// APOLLO CLIENT
// ============================================================================

export class ApolloService {
  private apiKey: string
  private dailyCredits: number
  private usedCredits: number

  constructor(apiKey: string) {
    this.apiKey = apiKey
    this.dailyCredits = 10000
    this.usedCredits = 0
  }

  // --------------------------------------------------------------------------
  // SEARCH PEOPLE
  // --------------------------------------------------------------------------

  async searchPeople(
    icp: IcpDefinition,
    page: number = 1,
    perPage: number = 25
  ): Promise<{ prospects: Partial<Prospect>[]; totalCount: number; pagination: any }> {
    const body: Record<string, unknown> = {
      page,
      per_page: perPage,
    }

    // Build query from ICP
    if (icp.titles?.length) {
      body.person_titles = icp.titles
    }

    if (icp.seniorities?.length) {
      body.person_seniorities = icp.seniorities.map(s => this.mapSeniority(s))
    }

    if (icp.industries?.length) {
      body.organization_industry_tag_ids = await this.getIndustryIds(icp.industries)
    }

    if (icp.companySizeMin || icp.companySizeMax) {
      body.organization_num_employees_ranges = [
        this.buildEmployeeRange(icp.companySizeMin, icp.companySizeMax)
      ]
    }

    if (icp.locations?.length) {
      body.person_locations = icp.locations
    }

    if (icp.keywords?.length) {
      body.q_keywords = icp.keywords.join(' OR ')
    }

    if (icp.technologies?.length) {
      body.organization_technologies = icp.technologies
    }

    if (icp.hiringSignals) {
      body.currently_hiring = true
    }

    if (icp.apolloQuery) {
      // Raw query override
      body.q = icp.apolloQuery
    }

    // Exclusions
    if (icp.excludeCompanies?.length) {
      body.organization_not_names = icp.excludeCompanies
    }

    if (icp.excludeDomains?.length) {
      body.organization_not_domains = icp.excludeDomains
    }

    const response = await this.makeRequest('/mixed_people/search', body)

    if (!response.people) {
      return { prospects: [], totalCount: 0, pagination: {} }
    }

    const prospects = response.people.map((p: any) => this.mapToProspect(p))

    this.usedCredits += response.people.length

    return {
      prospects,
      totalCount: response.pagination?.total_entries || 0,
      pagination: response.pagination,
    }
  }

  // --------------------------------------------------------------------------
  // SEARCH ORGANIZATIONS
  // --------------------------------------------------------------------------

  async searchOrganizations(
    icp: IcpDefinition,
    page: number = 1,
    perPage: number = 25
  ): Promise<{ organizations: any[]; totalCount: number }> {
    const body: Record<string, unknown> = {
      page,
      per_page: perPage,
    }

    if (icp.industries?.length) {
      body.organization_industry_tag_ids = await this.getIndustryIds(icp.industries)
    }

    if (icp.companySizeMin || icp.companySizeMax) {
      body.organization_num_employees_ranges = [
        this.buildEmployeeRange(icp.companySizeMin, icp.companySizeMax)
      ]
    }

    if (icp.revenueMin || icp.revenueMax) {
      body.organization_revenue_ranges = [
        this.buildRevenueRange(icp.revenueMin, icp.revenueMax)
      ]
    }

    if (icp.locations?.length) {
      body.organization_locations = icp.locations
    }

    if (icp.keywords?.length) {
      body.q_organization_keyword_tags = icp.keywords
    }

    if (icp.technologies?.length) {
      body.organization_technologies = icp.technologies
    }

    if (icp.fundingSignals) {
      body.organization_latest_funding_stage_cd = [
        'seed', 'series_a', 'series_b', 'series_c', 'series_d'
      ]
    }

    const response = await this.makeRequest('/mixed_companies/search', body)

    return {
      organizations: response.organizations || [],
      totalCount: response.pagination?.total_entries || 0,
    }
  }

  // --------------------------------------------------------------------------
  // ENRICH PERSON
  // --------------------------------------------------------------------------

  async enrichPerson(
    email?: string,
    linkedinUrl?: string,
    firstName?: string,
    lastName?: string,
    domain?: string
  ): Promise<Partial<Prospect> | null> {
    const body: Record<string, unknown> = {}

    if (email) {
      body.email = email
    } else if (linkedinUrl) {
      body.linkedin_url = linkedinUrl
    } else if (firstName && lastName && domain) {
      body.first_name = firstName
      body.last_name = lastName
      body.organization_domain = domain
    } else {
      return null
    }

    try {
      const response = await this.makeRequest('/people/match', body)

      if (!response.person) {
        return null
      }

      this.usedCredits += 1

      return this.mapToProspect(response.person)
    } catch (error) {
      console.error('Apollo enrichment failed:', error)
      return null
    }
  }

  // --------------------------------------------------------------------------
  // GET EMAIL
  // --------------------------------------------------------------------------

  async getEmail(
    firstName: string,
    lastName: string,
    domain: string
  ): Promise<{ email: string | null; confidence: number }> {
    const body = {
      first_name: firstName,
      last_name: lastName,
      organization_domain: domain,
      reveal_personal_emails: false,
    }

    try {
      const response = await this.makeRequest('/people/match', body)

      if (response.person?.email) {
        return {
          email: response.person.email,
          confidence: response.person.email_status === 'verified' ? 95 : 70,
        }
      }

      return { email: null, confidence: 0 }
    } catch (error) {
      return { email: null, confidence: 0 }
    }
  }

  // --------------------------------------------------------------------------
  // BULK ENRICH
  // --------------------------------------------------------------------------

  async bulkEnrich(prospects: Partial<Prospect>[]): Promise<Partial<Prospect>[]> {
    const enriched: Partial<Prospect>[] = []

    // Apollo free tier allows 250 enrichments per day
    const batch = prospects.slice(0, 250 - this.usedCredits)

    for (const prospect of batch) {
      const result = await this.enrichPerson(
        prospect.email,
        prospect.linkedinUrl,
        prospect.firstName,
        prospect.lastName,
        prospect.companyDomain
      )

      if (result) {
        enriched.push({
          ...prospect,
          ...result,
          enrichedAt: new Date().toISOString(),
          enrichmentSource: 'apollo',
        })
      } else {
        enriched.push(prospect)
      }

      // Rate limiting - be nice to Apollo
      await this.sleep(200)
    }

    return enriched
  }

  // --------------------------------------------------------------------------
  // SEQUENCE MANAGEMENT (Apollo Sequences for email automation)
  // --------------------------------------------------------------------------

  async createSequence(
    name: string,
    steps: Array<{
      type: 'auto_email' | 'manual_email' | 'linkedin_connection' | 'linkedin_message' | 'call'
      wait_days: number
      template?: string
    }>
  ): Promise<{ sequenceId: string } | null> {
    const body = {
      name,
      sequence_steps: steps.map((step, index) => ({
        sequence_step_number: index + 1,
        type: step.type,
        wait_days: step.wait_days,
        email_template: step.template ? { body_template: step.template } : undefined,
      })),
    }

    try {
      const response = await this.makeRequest('/sequences', body, 'POST')
      return { sequenceId: response.sequence?.id }
    } catch (error) {
      console.error('Failed to create Apollo sequence:', error)
      return null
    }
  }

  async addToSequence(
    sequenceId: string,
    prospectEmails: string[]
  ): Promise<{ added: number; failed: number }> {
    let added = 0
    let failed = 0

    for (const email of prospectEmails) {
      try {
        await this.makeRequest('/sequence_contacts', {
          sequence_id: sequenceId,
          contact_email: email,
        }, 'POST')
        added++
      } catch (error) {
        failed++
      }

      await this.sleep(100)
    }

    return { added, failed }
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS
  // --------------------------------------------------------------------------

  private mapToProspect(apolloPerson: any): Partial<Prospect> {
    return {
      firstName: apolloPerson.first_name,
      lastName: apolloPerson.last_name,
      email: apolloPerson.email,
      phone: apolloPerson.phone_numbers?.[0]?.raw_number,
      linkedinUrl: apolloPerson.linkedin_url,

      companyName: apolloPerson.organization?.name,
      companyDomain: apolloPerson.organization?.website_url?.replace(/^https?:\/\//, ''),
      companyLinkedin: apolloPerson.organization?.linkedin_url,
      industry: apolloPerson.organization?.industry,
      companySize: apolloPerson.organization?.estimated_num_employees,

      title: apolloPerson.title,
      seniority: apolloPerson.seniority,
      department: apolloPerson.departments?.[0],

      city: apolloPerson.city,
      state: apolloPerson.state,
      country: apolloPerson.country,

      customFields: {
        apolloId: apolloPerson.id,
        emailStatus: apolloPerson.email_status,
        headline: apolloPerson.headline,
        photoUrl: apolloPerson.photo_url,
      },
    }
  }

  private mapSeniority(seniority: string): string {
    const map: Record<string, string> = {
      c_suite: 'c_suite',
      vp: 'vp',
      director: 'director',
      manager: 'manager',
      individual: 'individual_contributor',
    }
    return map[seniority] || seniority
  }

  private buildEmployeeRange(min?: number, max?: number): string {
    if (min && max) {
      return `${min},${max}`
    } else if (min) {
      return `${min},`
    } else if (max) {
      return `,${max}`
    }
    return '1,'
  }

  private buildRevenueRange(min?: number, max?: number): string {
    // Apollo uses specific ranges
    const ranges = [
      { min: 0, max: 1000000, code: '0,1M' },
      { min: 1000000, max: 10000000, code: '1M,10M' },
      { min: 10000000, max: 50000000, code: '10M,50M' },
      { min: 50000000, max: 100000000, code: '50M,100M' },
      { min: 100000000, max: 500000000, code: '100M,500M' },
      { min: 500000000, max: 1000000000, code: '500M,1B' },
      { min: 1000000000, max: Infinity, code: '1B+' },
    ]

    const matching = ranges.filter(r =>
      (!min || r.max >= min) && (!max || r.min <= max)
    )

    return matching.map(r => r.code).join(',')
  }

  private async getIndustryIds(industries: string[]): Promise<string[]> {
    // Apollo industry mapping (simplified - would need full mapping)
    const industryMap: Record<string, string> = {
      'legal': '5567d0ad7369645172380400',
      'law': '5567d0ad7369645172380400',
      'law firm': '5567d0ad7369645172380400',
      'legal services': '5567d0ad7369645172380400',
      'technology': '5567d0ad7369645172380600',
      'software': '5567d0ad7369645172380601',
      'finance': '5567d0ad7369645172380200',
      'financial services': '5567d0ad7369645172380200',
      'healthcare': '5567d0ad7369645172380300',
      'manufacturing': '5567d0ad7369645172380100',
      'retail': '5567d0ad7369645172380700',
      'construction': '5567d0ad7369645172380800',
      'real estate': '5567d0ad7369645172380900',
      'education': '5567d0ad7369645172381000',
      'government': '5567d0ad7369645172381100',
    }

    return industries
      .map(i => industryMap[i.toLowerCase()])
      .filter(Boolean) as string[]
  }

  private async makeRequest(
    endpoint: string,
    body: Record<string, unknown>,
    method: 'GET' | 'POST' = 'POST'
  ): Promise<any> {
    const url = `${APOLLO_BASE_URL}${endpoint}`

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': this.apiKey,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Apollo API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // --------------------------------------------------------------------------
  // STATS
  // --------------------------------------------------------------------------

  getCreditsRemaining(): number {
    return this.dailyCredits - this.usedCredits
  }

  resetDailyCredits(): void {
    this.usedCredits = 0
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createApolloService(apiKey: string): ApolloService {
  return new ApolloService(apiKey)
}

// ============================================================================
// ACTION EXECUTORS
// ============================================================================

export async function executeApolloSearch(
  service: ApolloService,
  action: CampaignAction
): Promise<ActionResult> {
  const { icp, page = 1, perPage = 25 } = action.payload as {
    icp: IcpDefinition
    page?: number
    perPage?: number
  }

  try {
    const result = await service.searchPeople(icp, page, perPage)

    return {
      success: true,
      data: {
        prospects: result.prospects,
        totalCount: result.totalCount,
        pagination: result.pagination,
        creditsRemaining: service.getCreditsRemaining(),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Apollo search failed',
    }
  }
}

export async function executeApolloEnrich(
  service: ApolloService,
  action: CampaignAction
): Promise<ActionResult> {
  const { prospects } = action.payload as { prospects: Partial<Prospect>[] }

  try {
    const enriched = await service.bulkEnrich(prospects)

    return {
      success: true,
      data: {
        enriched,
        enrichedCount: enriched.filter(p => p.enrichedAt).length,
        creditsRemaining: service.getCreditsRemaining(),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Apollo enrichment failed',
    }
  }
}
