/**
 * Core Web Scraping Engine
 *
 * Handles fetching, parsing, and extracting supplier data from public sources.
 * Uses cheerio for HTML parsing, respects rate limits, handles retries.
 */

import * as cheerio from 'cheerio'
import { v4 as uuidv4 } from 'uuid'
import { ScrapedSupplier, ScrapingJob } from './types'
import { SourceType, SCRAPING_SOURCES, buildSearchUrl, SearchQuery } from './sources'

// ============================================================================
// CONFIGURATION
// ============================================================================

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
]

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

// Rate limiting
const rateLimiters = new Map<SourceType, { lastRequest: number; requestCount: number }>()

async function waitForRateLimit(source: SourceType): Promise<void> {
  const sourceConfig = SCRAPING_SOURCES.find(s => s.id === source)
  if (!sourceConfig) return

  const limiter = rateLimiters.get(source) || { lastRequest: 0, requestCount: 0 }
  const now = Date.now()
  const minInterval = (60 * 1000) / sourceConfig.rateLimit  // ms between requests

  if (now - limiter.lastRequest < minInterval) {
    await new Promise(resolve => setTimeout(resolve, minInterval - (now - limiter.lastRequest)))
  }

  rateLimiters.set(source, { lastRequest: Date.now(), requestCount: limiter.requestCount + 1 })
}

// ============================================================================
// FETCH WITH RETRY
// ============================================================================

interface FetchOptions {
  maxRetries?: number
  timeout?: number
  headers?: Record<string, string>
}

async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<string | null> {
  const { maxRetries = 3, timeout = 30000, headers = {} } = options

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          ...headers,
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.warn(`Fetch failed: ${response.status} ${response.statusText}`)
        if (response.status === 429) {
          // Rate limited - wait longer
          await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 10000))
          continue
        }
        if (response.status >= 500) {
          // Server error - retry
          await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 2000))
          continue
        }
        return null
      }

      return await response.text()
    } catch (error) {
      console.warn(`Fetch attempt ${attempt + 1} failed:`, error)
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 2000))
      }
    }
  }

  return null
}

// ============================================================================
// SOURCE-SPECIFIC PARSERS
// ============================================================================

interface Parser {
  parse(html: string, query: SearchQuery): ScrapedSupplier[]
}

// Yellow Pages Parser
const yellowPagesParser: Parser = {
  parse(html: string, query: SearchQuery): ScrapedSupplier[] {
    const $ = cheerio.load(html)
    const suppliers: ScrapedSupplier[] = []

    $('.result').each((_, element) => {
      try {
        const $el = $(element)

        const name = $el.find('.business-name').text().trim()
        if (!name) return

        const phone = $el.find('.phones').first().text().trim()
        const address = $el.find('.street-address').text().trim()
        const city = $el.find('.locality').text().trim()
        const website = $el.find('a.track-visit-website').attr('href')
        const categories = $el.find('.categories a').map((_, a) => $(a).text().trim()).get()

        const ratingText = $el.find('.ratings').attr('class') || ''
        const ratingMatch = ratingText.match(/rating-(\d+)/)
        const rating = ratingMatch ? parseInt(ratingMatch[1]) / 10 : undefined

        suppliers.push({
          id: uuidv4(),
          source: 'yellowpages',
          scrapedAt: new Date(),
          name,
          phone: phone || undefined,
          website: website || undefined,
          address: {
            street: address || undefined,
            city: city || undefined,
            state: query.location?.state,
            country: query.location?.country || 'USA',
          },
          categories,
          rating,
          confidence: 0.7,
        })
      } catch (error) {
        console.warn('Error parsing Yellow Pages result:', error)
      }
    })

    return suppliers
  }
}

// Clutch.co Parser
const clutchParser: Parser = {
  parse(html: string, query: SearchQuery): ScrapedSupplier[] {
    const $ = cheerio.load(html)
    const suppliers: ScrapedSupplier[] = []

    $('.provider-row, .directory-list .company-row').each((_, element) => {
      try {
        const $el = $(element)

        const name = $el.find('.company-name, .provider-name').text().trim()
        if (!name) return

        const website = $el.find('a.website-link').attr('href')
        const description = $el.find('.tagline, .company-description').text().trim()
        const location = $el.find('.locality, .location').text().trim()

        const ratingText = $el.find('.rating').text().trim()
        const rating = ratingText ? parseFloat(ratingText) : undefined

        const reviewCountText = $el.find('.reviews-count').text().trim()
        const reviewCount = reviewCountText ? parseInt(reviewCountText.replace(/\D/g, '')) : undefined

        const employeeText = $el.find('.company-size, .employees').text().trim()

        suppliers.push({
          id: uuidv4(),
          source: 'clutch',
          scrapedAt: new Date(),
          name,
          description: description || undefined,
          website: website || undefined,
          address: {
            city: location.split(',')[0]?.trim(),
            state: location.split(',')[1]?.trim(),
          },
          rating,
          reviewCount,
          employeeRange: employeeText || undefined,
          confidence: 0.85,
        })
      } catch (error) {
        console.warn('Error parsing Clutch result:', error)
      }
    })

    return suppliers
  }
}

// ThomasNet Parser
const thomasnetParser: Parser = {
  parse(html: string, query: SearchQuery): ScrapedSupplier[] {
    const $ = cheerio.load(html)
    const suppliers: ScrapedSupplier[] = []

    $('.company-card, .supplier-row').each((_, element) => {
      try {
        const $el = $(element)

        const name = $el.find('.company-name, h3').text().trim()
        if (!name) return

        const website = $el.find('a.website').attr('href')
        const description = $el.find('.description, .company-description').text().trim()
        const location = $el.find('.location, .address').text().trim()
        const phone = $el.find('.phone').text().trim()

        const products = $el.find('.products li, .capabilities li').map((_, li) => $(li).text().trim()).get()

        suppliers.push({
          id: uuidv4(),
          source: 'thomasnet',
          scrapedAt: new Date(),
          name,
          description: description || undefined,
          website: website || undefined,
          phone: phone || undefined,
          address: {
            city: location.split(',')[0]?.trim(),
            state: location.split(',')[1]?.trim(),
          },
          products,
          confidence: 0.9,
        })
      } catch (error) {
        console.warn('Error parsing ThomasNet result:', error)
      }
    })

    return suppliers
  }
}

// BBB Parser
const bbbParser: Parser = {
  parse(html: string, query: SearchQuery): ScrapedSupplier[] {
    const $ = cheerio.load(html)
    const suppliers: ScrapedSupplier[] = []

    $('.result-item, .search-result').each((_, element) => {
      try {
        const $el = $(element)

        const name = $el.find('.business-name, h4').text().trim()
        if (!name) return

        const website = $el.find('a.website-link').attr('href')
        const phone = $el.find('.phone-number').text().trim()
        const address = $el.find('.address').text().trim()
        const bbbRating = $el.find('.bbb-rating, .rating-letter').text().trim()

        suppliers.push({
          id: uuidv4(),
          source: 'bbb',
          scrapedAt: new Date(),
          name,
          website: website || undefined,
          phone: phone || undefined,
          address: {
            street: address,
          },
          bbbRating: bbbRating || undefined,
          verified: !!bbbRating,
          confidence: 0.8,
        })
      } catch (error) {
        console.warn('Error parsing BBB result:', error)
      }
    })

    return suppliers
  }
}

// Generic parser for unknown sources
const genericParser: Parser = {
  parse(html: string, query: SearchQuery): ScrapedSupplier[] {
    const $ = cheerio.load(html)
    const suppliers: ScrapedSupplier[] = []

    // Try common patterns
    $('[itemtype*="Organization"], [itemtype*="LocalBusiness"], .business, .company, .listing').each((_, element) => {
      try {
        const $el = $(element)

        const name = $el.find('[itemprop="name"], .name, h2, h3').first().text().trim()
        if (!name || name.length < 2) return

        const website = $el.find('[itemprop="url"], a.website').attr('href')
        const phone = $el.find('[itemprop="telephone"], .phone, .tel').text().trim()
        const email = $el.find('[itemprop="email"], a[href^="mailto:"]').text().trim()

        suppliers.push({
          id: uuidv4(),
          source: 'industry_dir',
          scrapedAt: new Date(),
          name,
          website: website || undefined,
          phone: phone || undefined,
          email: email || undefined,
          confidence: 0.5,
        })
      } catch (error) {
        // Silently skip
      }
    })

    return suppliers
  }
}

const PARSERS: Partial<Record<SourceType, Parser>> = {
  yellowpages: yellowPagesParser,
  clutch: clutchParser,
  thomasnet: thomasnetParser,
  bbb: bbbParser,
}

// ============================================================================
// GOOGLE PLACES API (Primary Source)
// ============================================================================

export async function searchGooglePlaces(query: SearchQuery): Promise<ScrapedSupplier[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    console.warn('GOOGLE_PLACES_API_KEY not configured')
    return []
  }

  await waitForRateLimit('google_maps')

  const keywords = query.keywords.join(' ')
  const location = query.location
    ? [query.location.city, query.location.state, query.location.country].filter(Boolean).join(', ')
    : ''

  const searchText = `${keywords} ${location}`.trim()
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchText)}&key=${apiKey}`

  try {
    const response = await fetch(url)
    const data = await response.json() as {
      status: string
      results: Array<{
        place_id: string
        name: string
        formatted_address: string
        geometry?: { location: { lat: number; lng: number } }
        rating?: number
        user_ratings_total?: number
        types?: string[]
        business_status?: string
      }>
    }

    if (data.status !== 'OK') {
      console.warn('Google Places API error:', data.status)
      return []
    }

    const suppliers: ScrapedSupplier[] = data.results.map(place => {
      const addressParts = place.formatted_address?.split(',').map(p => p.trim()) || []

      return {
        id: uuidv4(),
        externalId: place.place_id,
        source: 'google_maps' as SourceType,
        scrapedAt: new Date(),
        name: place.name,
        address: {
          street: addressParts[0],
          city: addressParts[1],
          state: addressParts[2]?.split(' ')[0],
          zip: addressParts[2]?.split(' ')[1],
          country: addressParts[3] || 'USA',
        },
        coordinates: place.geometry?.location,
        rating: place.rating,
        reviewCount: place.user_ratings_total,
        categories: place.types,
        confidence: 0.95,
      }
    })

    // Get details for top results (has website, phone)
    const detailedSuppliers = await Promise.all(
      suppliers.slice(0, 10).map(supplier => enrichWithPlaceDetails(supplier, apiKey))
    )

    return [...detailedSuppliers, ...suppliers.slice(10)]
  } catch (error) {
    console.error('Google Places search error:', error)
    return []
  }
}

async function enrichWithPlaceDetails(supplier: ScrapedSupplier, apiKey: string): Promise<ScrapedSupplier> {
  if (!supplier.externalId) return supplier

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${supplier.externalId}&fields=website,formatted_phone_number,opening_hours&key=${apiKey}`
    const response = await fetch(url)
    const data = await response.json() as {
      status: string
      result?: {
        website?: string
        formatted_phone_number?: string
      }
    }

    if (data.status === 'OK' && data.result) {
      return {
        ...supplier,
        website: data.result.website,
        phone: data.result.formatted_phone_number,
      }
    }
  } catch (error) {
    console.warn('Error enriching place details:', error)
  }

  return supplier
}

// ============================================================================
// MAIN SCRAPING FUNCTION
// ============================================================================

export async function scrapeSuppliers(
  query: SearchQuery,
  sources: SourceType[] = ['google_maps', 'yellowpages', 'clutch']
): Promise<ScrapedSupplier[]> {
  const allSuppliers: ScrapedSupplier[] = []
  const seenNames = new Set<string>()

  for (const source of sources) {
    try {
      let suppliers: ScrapedSupplier[] = []

      if (source === 'google_maps') {
        suppliers = await searchGooglePlaces(query)
      } else {
        const sourceConfig = SCRAPING_SOURCES.find(s => s.id === source)
        if (!sourceConfig) continue

        await waitForRateLimit(source)

        const searchPath = buildSearchUrl(source, query)
        const url = `${sourceConfig.baseUrl}${searchPath}`

        const html = await fetchWithRetry(url)
        if (!html) continue

        const parser = PARSERS[source] || genericParser
        suppliers = parser.parse(html, query)
      }

      // Deduplicate by name
      for (const supplier of suppliers) {
        const normalizedName = supplier.name.toLowerCase().replace(/[^a-z0-9]/g, '')
        if (!seenNames.has(normalizedName)) {
          seenNames.add(normalizedName)
          allSuppliers.push(supplier)
        }
      }

      console.log(`Scraped ${suppliers.length} suppliers from ${source}`)
    } catch (error) {
      console.error(`Error scraping ${source}:`, error)
    }
  }

  return allSuppliers
}

// ============================================================================
// SCRAPING JOB EXECUTION
// ============================================================================

export async function executeScrapingJob(job: ScrapingJob): Promise<ScrapingJob> {
  const startedAt = new Date()

  try {
    const query: SearchQuery = {
      keywords: job.query.keywords,
      location: job.query.location,
    }

    const suppliers = await scrapeSuppliers(query, job.sources)

    return {
      ...job,
      status: 'completed',
      suppliersFound: suppliers.length,
      suppliersNew: suppliers.length, // TODO: Check against existing DB
      startedAt,
      completedAt: new Date(),
    }
  } catch (error) {
    return {
      ...job,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      startedAt,
      completedAt: new Date(),
    }
  }
}
