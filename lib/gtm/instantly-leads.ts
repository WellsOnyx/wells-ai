/**
 * Instantly Lead Finder - Replace Apollo
 *
 * Instantly has 200M+ B2B contacts built-in
 * No need for separate prospecting tool
 * Find + Email = one platform
 */

export interface InstantlyLead {
  email: string
  first_name: string
  last_name: string
  company_name: string
  company_domain: string
  title: string
  linkedin_url?: string
  phone?: string
  location?: string
  company_industry?: string
  company_size?: string
}

/**
 * Search Instantly database for leads
 */
export async function searchInstantlyLeads(params: {
  apiKey: string
  titles?: string[]
  industries?: string[]
  companySize?: string[]
  location?: string[]
  limit?: number
}): Promise<InstantlyLead[]> {
  // Instantly Lead Finder API
  const response = await fetch('https://api.instantly.ai/api/v1/lead/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: params.apiKey,
      filters: {
        job_titles: params.titles,
        industries: params.industries,
        company_size: params.companySize,
        locations: params.location,
      },
      limit: params.limit || 25,
    }),
  })

  if (!response.ok) {
    throw new Error(`Instantly API error: ${response.statusText}`)
  }

  const data = await response.json()
  return data.leads || []
}

/**
 * Enrich lead with additional data
 */
export async function enrichLead(
  apiKey: string,
  email: string
): Promise<InstantlyLead> {
  const response = await fetch('https://api.instantly.ai/api/v1/lead/enrich', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      email,
    }),
  })

  const data = await response.json()
  return data.lead
}
