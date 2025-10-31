/**
 * Apollo Search - MVP Version
 *
 * Simple Apollo API integration to find prospects
 * Ship tonight
 */

export interface ApolloProspect {
  id: string
  name: string
  email: string
  title: string
  company: string
  companyDomain: string
  linkedInUrl?: string
  location?: string
}

/**
 * Search Apollo for prospects matching ICP
 */
export async function searchApollo(params: {
  titles: string[]
  industries?: string[]
  companySize?: string
  location?: string
  limit?: number
}): Promise<ApolloProspect[]> {
  const apiKey = process.env.APOLLO_API_KEY

  if (!apiKey) {
    throw new Error('APOLLO_API_KEY not configured')
  }

  // Apollo API: https://developer.apollo.io/
  const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({
      person_titles: params.titles,
      organization_industry_tag_ids: params.industries || [],
      organization_num_employees_ranges: params.companySize ? [params.companySize] : undefined,
      person_locations: params.location ? [params.location] : undefined,
      page: 1,
      per_page: params.limit || 25,
    }),
  })

  if (!response.ok) {
    throw new Error(`Apollo API error: ${response.statusText}`)
  }

  const data = await response.json()

  return data.people.map((person: any) => ({
    id: person.id,
    name: person.name,
    email: person.email,
    title: person.title,
    company: person.organization?.name || '',
    companyDomain: person.organization?.primary_domain || '',
    linkedInUrl: person.linkedin_url,
    location: person.city ? `${person.city}, ${person.state}` : undefined,
  }))
}

/**
 * Enrich prospect with additional data
 */
export async function enrichProspect(email: string): Promise<{
  email: string
  verified: boolean
  phone?: string
  linkedin?: string
}> {
  const apiKey = process.env.APOLLO_API_KEY

  const response = await fetch('https://api.apollo.io/v1/people/match', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey!,
    },
    body: JSON.stringify({
      email,
      reveal_personal_emails: true,
    }),
  })

  const data = await response.json()

  return {
    email: data.person?.email || email,
    verified: !!data.person?.email,
    phone: data.person?.phone_numbers?.[0]?.sanitized_number,
    linkedin: data.person?.linkedin_url,
  }
}
