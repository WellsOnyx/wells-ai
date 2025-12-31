/**
 * Proactive Supplier Discovery Engine
 *
 * The core engine that:
 * 1. Watches for new buyer requests
 * 2. Automatically searches for matching suppliers
 * 3. Enriches with contact info
 * 4. Sends personalized outreach
 * 5. Tracks conversions and attributes 1% fee
 */

import { v4 as uuidv4 } from 'uuid'
import { ScrapedSupplier, ScrapingJob, SupplierOutreach } from './types'
import { scrapeSuppliers, searchGooglePlaces } from './scraper'
import { enrichSuppliers } from './enrichment'
import { sendBatchOutreach } from './outreach'
import { SourceType, getSourcesForCategory, SearchQuery } from './sources'
import { SOURCING_CATEGORIES, getCategoryById, getSubcategoryById } from '../sourcing/categories'

// ============================================================================
// BUYER REQUEST TRIGGER
// ============================================================================

export interface BuyerRequest {
  id: string
  userId: string
  category: string
  subcategory?: string
  requirements: string
  quantity?: number
  budget?: number
  timeline?: string
  location?: {
    city?: string
    state?: string
    country?: string
    radius?: number
  }
  companyName?: string
  createdAt: Date
}

// ============================================================================
// DISCOVERY PIPELINE
// ============================================================================

export interface DiscoveryResult {
  job: ScrapingJob
  suppliersFound: ScrapedSupplier[]
  suppliersEnriched: ScrapedSupplier[]
  outreachSent: SupplierOutreach[]
}

export async function runSupplierDiscovery(buyerRequest: BuyerRequest): Promise<DiscoveryResult> {
  console.log(`Starting supplier discovery for request ${buyerRequest.id}`)

  // 1. Create scraping job
  const job: ScrapingJob = {
    id: uuidv4(),
    status: 'running',
    triggeredBy: 'buyer_request',
    buyerRequestId: buyerRequest.id,
    query: {
      keywords: buildKeywords(buyerRequest),
      category: buyerRequest.category,
      subcategory: buyerRequest.subcategory,
      location: buyerRequest.location,
    },
    sources: selectSources(buyerRequest.category),
    suppliersFound: 0,
    suppliersNew: 0,
    suppliersContacted: 0,
    startedAt: new Date(),
    createdAt: new Date(),
  }

  try {
    // 2. Build search query
    const searchQuery: SearchQuery = {
      keywords: job.query.keywords,
      location: buyerRequest.location,
    }

    // 3. Scrape suppliers from multiple sources
    console.log(`Scraping suppliers for: ${job.query.keywords.join(', ')}`)
    const suppliersFound = await scrapeSuppliers(searchQuery, job.sources)
    job.suppliersFound = suppliersFound.length
    console.log(`Found ${suppliersFound.length} suppliers`)

    // 4. Enrich with contact info
    console.log('Enriching supplier data...')
    const suppliersEnriched = await enrichSuppliers(suppliersFound)
    const withEmail = suppliersEnriched.filter(s => s.email)
    console.log(`Enriched ${withEmail.length} suppliers with email`)

    // 5. Send outreach to suppliers with email
    console.log('Sending outreach...')
    const outreachSent = await sendBatchOutreach({
      suppliers: suppliersEnriched,
      buyerRequest: {
        id: buyerRequest.id,
        category: buyerRequest.category,
        subcategory: buyerRequest.subcategory,
        requirements: buyerRequest.requirements,
        location: buyerRequest.location
          ? [buyerRequest.location.city, buyerRequest.location.state].filter(Boolean).join(', ')
          : undefined,
        budget: buyerRequest.budget,
        timeline: buyerRequest.timeline,
        companyName: buyerRequest.companyName,
      },
      maxPerDay: 25,  // Start conservative
      delayMs: 5000,
    })

    job.suppliersContacted = outreachSent.length
    job.status = 'completed'
    job.completedAt = new Date()

    console.log(`Discovery complete: ${job.suppliersFound} found, ${job.suppliersContacted} contacted`)

    return {
      job,
      suppliersFound,
      suppliersEnriched,
      outreachSent,
    }
  } catch (error) {
    job.status = 'failed'
    job.error = error instanceof Error ? error.message : 'Unknown error'
    job.completedAt = new Date()

    console.error('Discovery failed:', error)

    return {
      job,
      suppliersFound: [],
      suppliersEnriched: [],
      outreachSent: [],
    }
  }
}

// ============================================================================
// KEYWORD BUILDING
// ============================================================================

function buildKeywords(request: BuyerRequest): string[] {
  const keywords: string[] = []

  // Add category name
  const category = getCategoryById(request.category)
  if (category) {
    keywords.push(category.name)

    // Add subcategory
    if (request.subcategory) {
      const sub = getSubcategoryById(request.category, request.subcategory)
      if (sub) {
        keywords.push(sub.name)
      }
    }
  }

  // Extract keywords from requirements
  const requirementKeywords = extractKeywords(request.requirements)
  keywords.push(...requirementKeywords)

  return [...new Set(keywords)]  // Dedupe
}

function extractKeywords(text: string): string[] {
  // Remove common words, extract meaningful terms
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'i', 'we', 'you', 'he', 'she', 'it', 'they', 'them', 'their',
    'this', 'that', 'these', 'those', 'am', 'been', 'being', 'each', 'few',
    'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
    'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now',
    'looking', 'need', 'want', 'require', 'seeking', 'find', 'get',
  ])

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))

  // Return top keywords by frequency
  const freq = new Map<string, number>()
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1)
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word)
}

// ============================================================================
// SOURCE SELECTION
// ============================================================================

function selectSources(category: string): SourceType[] {
  // Get sources that are good for this category
  const categorySources = getSourcesForCategory(category)

  // Always include Google Maps for local businesses
  const sources: SourceType[] = ['google_maps']

  // Add category-specific sources
  for (const source of categorySources.slice(0, 3)) {
    if (!sources.includes(source.id)) {
      sources.push(source.id)
    }
  }

  return sources
}

// ============================================================================
// SCHEDULED DISCOVERY
// ============================================================================

export interface ScheduledDiscoveryConfig {
  categories: string[]           // Which categories to proactively search
  locations: { city: string; state: string }[]  // Which locations
  frequency: 'daily' | 'weekly'
  maxPerRun: number
}

export async function runScheduledDiscovery(config: ScheduledDiscoveryConfig): Promise<DiscoveryResult[]> {
  const results: DiscoveryResult[] = []

  for (const category of config.categories) {
    for (const location of config.locations) {
      // Create a synthetic "request" for general discovery
      const request: BuyerRequest = {
        id: `scheduled-${uuidv4()}`,
        userId: 'system',
        category,
        requirements: `${category} providers`,
        location: {
          city: location.city,
          state: location.state,
          country: 'USA',
        },
        createdAt: new Date(),
      }

      const result = await runSupplierDiscovery(request)
      results.push(result)

      // Delay between runs
      await new Promise(resolve => setTimeout(resolve, 10000))

      if (results.length >= config.maxPerRun) {
        break
      }
    }
  }

  return results
}

// ============================================================================
// CONTACT IMPORT (Your 150K Contacts)
// ============================================================================

export interface ImportedContact {
  email: string
  name?: string
  company?: string
  title?: string
  industry?: string
  location?: string
  linkedinUrl?: string
  source: 'csv' | 'crm' | 'linkedin'
}

export function matchContactsToRequest(
  contacts: ImportedContact[],
  request: BuyerRequest
): ImportedContact[] {
  const category = SOURCING_CATEGORIES.find(c => c.id === request.category)
  if (!category) return []

  // Match by industry and location
  return contacts.filter(contact => {
    // Industry match
    const industryMatch = contact.industry
      ? category.keywords.some(kw =>
          contact.industry!.toLowerCase().includes(kw.toLowerCase())
        )
      : false

    // Location match
    const locationMatch = request.location
      ? contact.location?.toLowerCase().includes(request.location.city?.toLowerCase() || '') ||
        contact.location?.toLowerCase().includes(request.location.state?.toLowerCase() || '')
      : true

    // Title match (looking for decision makers)
    const titleMatch = contact.title
      ? ['ceo', 'owner', 'president', 'director', 'vp', 'head', 'manager', 'sales']
          .some(title => contact.title!.toLowerCase().includes(title))
      : true

    return industryMatch || locationMatch
  })
}

export function convertContactToSupplier(contact: ImportedContact): ScrapedSupplier {
  return {
    id: uuidv4(),
    source: 'industry_dir',
    scrapedAt: new Date(),
    name: contact.company || contact.name || 'Unknown',
    email: contact.email,
    contactName: contact.name,
    contactTitle: contact.title,
    linkedinUrl: contact.linkedinUrl,
    industry: contact.industry,
    address: contact.location ? { city: contact.location } : undefined,
    confidence: 0.9,  // High confidence for imported contacts
  }
}
