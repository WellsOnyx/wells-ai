/**
 * Web Scraping Sources for Supplier Discovery
 *
 * All sources are public, no authentication required, no ToS violations.
 * We're simply aggregating publicly available business information.
 */

// ============================================================================
// SOURCE DEFINITIONS
// ============================================================================

export type SourceType =
  | 'google_maps'      // Local businesses via Places API
  | 'yelp'             // Business listings
  | 'yellowpages'      // Directory listings
  | 'thomasnet'        // Industrial suppliers
  | 'clutch'           // B2B service providers
  | 'g2'               // Software vendors
  | 'linkedin_public'  // Public company pages
  | 'crunchbase'       // Startup/company data
  | 'bbb'              // Better Business Bureau
  | 'industry_dir'     // Industry-specific directories

export interface ScrapingSource {
  id: SourceType
  name: string
  baseUrl: string
  categories: string[]  // Which procurement categories this source is good for
  rateLimit: number     // Requests per minute
  reliability: number   // 0-1 score for data quality
  requiresProxy: boolean
}

export const SCRAPING_SOURCES: ScrapingSource[] = [
  {
    id: 'google_maps',
    name: 'Google Maps / Places',
    baseUrl: 'https://maps.googleapis.com/maps/api/place',
    categories: ['facilities', 'logistics', 'professional_services', 'raw_materials'],
    rateLimit: 60,
    reliability: 0.95,
    requiresProxy: false,
  },
  {
    id: 'yelp',
    name: 'Yelp Business',
    baseUrl: 'https://www.yelp.com',
    categories: ['facilities', 'professional_services'],
    rateLimit: 20,
    reliability: 0.85,
    requiresProxy: true,
  },
  {
    id: 'yellowpages',
    name: 'Yellow Pages',
    baseUrl: 'https://www.yellowpages.com',
    categories: ['facilities', 'logistics', 'professional_services', 'raw_materials'],
    rateLimit: 30,
    reliability: 0.75,
    requiresProxy: true,
  },
  {
    id: 'thomasnet',
    name: 'ThomasNet',
    baseUrl: 'https://www.thomasnet.com',
    categories: ['raw_materials', 'equipment', 'manufacturing'],
    rateLimit: 20,
    reliability: 0.90,
    requiresProxy: true,
  },
  {
    id: 'clutch',
    name: 'Clutch.co',
    baseUrl: 'https://clutch.co',
    categories: ['technology', 'professional_services', 'marketing'],
    rateLimit: 15,
    reliability: 0.90,
    requiresProxy: true,
  },
  {
    id: 'g2',
    name: 'G2 Crowd',
    baseUrl: 'https://www.g2.com',
    categories: ['technology', 'saas'],
    rateLimit: 15,
    reliability: 0.85,
    requiresProxy: true,
  },
  {
    id: 'linkedin_public',
    name: 'LinkedIn Public Pages',
    baseUrl: 'https://www.linkedin.com/company',
    categories: ['all'],
    rateLimit: 10,
    reliability: 0.80,
    requiresProxy: true,
  },
  {
    id: 'crunchbase',
    name: 'Crunchbase',
    baseUrl: 'https://www.crunchbase.com',
    categories: ['technology', 'startups'],
    rateLimit: 20,
    reliability: 0.85,
    requiresProxy: false,
  },
  {
    id: 'bbb',
    name: 'Better Business Bureau',
    baseUrl: 'https://www.bbb.org',
    categories: ['all'],
    rateLimit: 20,
    reliability: 0.80,
    requiresProxy: true,
  },
]

// ============================================================================
// CATEGORY TO SOURCE MAPPING
// ============================================================================

export function getSourcesForCategory(category: string): ScrapingSource[] {
  return SCRAPING_SOURCES.filter(
    source => source.categories.includes('all') || source.categories.includes(category)
  ).sort((a, b) => b.reliability - a.reliability)
}

// ============================================================================
// SEARCH QUERY BUILDERS
// ============================================================================

export interface SearchQuery {
  keywords: string[]
  location?: {
    city?: string
    state?: string
    country?: string
    radius?: number  // miles
  }
  filters?: {
    minEmployees?: number
    maxEmployees?: number
    minRevenue?: number
    maxRevenue?: number
    yearFounded?: number
    hasWebsite?: boolean
    hasEmail?: boolean
    hasPhone?: boolean
  }
}

export function buildSearchUrl(source: SourceType, query: SearchQuery): string {
  const keywords = query.keywords.join(' ')
  const location = query.location
    ? [query.location.city, query.location.state, query.location.country].filter(Boolean).join(', ')
    : ''

  switch (source) {
    case 'google_maps':
      // Uses Places API - needs API key
      return `textsearch?query=${encodeURIComponent(keywords + ' ' + location)}`

    case 'yelp':
      return `/search?find_desc=${encodeURIComponent(keywords)}&find_loc=${encodeURIComponent(location)}`

    case 'yellowpages':
      const loc = location.replace(/, /g, '-').replace(/ /g, '-').toLowerCase()
      return `/${encodeURIComponent(keywords.replace(/ /g, '-'))}/${loc}`

    case 'thomasnet':
      return `/search?what=${encodeURIComponent(keywords)}&where=${encodeURIComponent(location)}`

    case 'clutch':
      return `/search?search_term=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}`

    case 'g2':
      return `/search?query=${encodeURIComponent(keywords)}`

    case 'linkedin_public':
      return `/search/results/companies/?keywords=${encodeURIComponent(keywords)}`

    case 'crunchbase':
      return `/discover/organization.companies?query=${encodeURIComponent(keywords)}`

    case 'bbb':
      return `/search?find_locs=${encodeURIComponent(location)}&find_text=${encodeURIComponent(keywords)}`

    default:
      return ''
  }
}
