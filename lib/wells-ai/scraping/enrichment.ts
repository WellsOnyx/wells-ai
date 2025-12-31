/**
 * Supplier Data Enrichment
 *
 * Takes scraped suppliers and enriches with:
 * - Email addresses (from website scraping)
 * - Contact names/titles
 * - Company size/revenue
 * - Social profiles
 */

import * as cheerio from 'cheerio'
import { ScrapedSupplier, EnrichmentResult } from './types'

// ============================================================================
// EMAIL EXTRACTION
// ============================================================================

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const COMMON_EMAILS = ['info@', 'contact@', 'sales@', 'hello@', 'support@', 'admin@']

export async function extractEmailsFromWebsite(websiteUrl: string): Promise<string[]> {
  if (!websiteUrl) return []

  try {
    // Normalize URL
    let url = websiteUrl
    if (!url.startsWith('http')) {
      url = `https://${url}`
    }

    // Fetch main page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WellsBot/1.0; +https://wellsonyx.com)',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) return []

    const html = await response.text()
    const $ = cheerio.load(html)

    const emails = new Set<string>()

    // Extract from mailto links
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href')
      if (href) {
        const email = href.replace('mailto:', '').split('?')[0].toLowerCase()
        if (isValidEmail(email)) {
          emails.add(email)
        }
      }
    })

    // Extract from page text
    const textEmails = html.match(EMAIL_REGEX) || []
    for (const email of textEmails) {
      if (isValidEmail(email.toLowerCase())) {
        emails.add(email.toLowerCase())
      }
    }

    // Try contact page if no emails found
    if (emails.size === 0) {
      const contactUrl = findContactPageUrl($, url)
      if (contactUrl) {
        const contactEmails = await extractEmailsFromUrl(contactUrl)
        contactEmails.forEach(e => emails.add(e))
      }
    }

    return Array.from(emails)
  } catch (error) {
    console.warn(`Error extracting emails from ${websiteUrl}:`, error)
    return []
  }
}

function findContactPageUrl($: cheerio.CheerioAPI, baseUrl: string): string | null {
  const contactLinks = $('a').filter((_, el) => {
    const href = $(el).attr('href') || ''
    const text = $(el).text().toLowerCase()
    return text.includes('contact') || href.includes('contact')
  })

  const href = contactLinks.first().attr('href')
  if (!href) return null

  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return null
  }
}

async function extractEmailsFromUrl(url: string): Promise<string[]> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WellsBot/1.0; +https://wellsonyx.com)',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) return []

    const html = await response.text()
    const emails = html.match(EMAIL_REGEX) || []
    return emails.filter(isValidEmail).map(e => e.toLowerCase())
  } catch {
    return []
  }
}

function isValidEmail(email: string): boolean {
  // Filter out image files, scripts, etc.
  const invalid = ['.png', '.jpg', '.gif', '.js', '.css', 'example.com', 'domain.com', 'email.com', 'test.com']
  return !invalid.some(i => email.includes(i)) && email.includes('@') && email.includes('.')
}

// ============================================================================
// SOCIAL PROFILE EXTRACTION
// ============================================================================

interface SocialProfiles {
  linkedin?: string
  twitter?: string
  facebook?: string
  instagram?: string
}

export async function extractSocialProfiles(websiteUrl: string): Promise<SocialProfiles> {
  if (!websiteUrl) return {}

  try {
    let url = websiteUrl
    if (!url.startsWith('http')) {
      url = `https://${url}`
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WellsBot/1.0; +https://wellsonyx.com)',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) return {}

    const html = await response.text()
    const $ = cheerio.load(html)

    const profiles: SocialProfiles = {}

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || ''

      if (href.includes('linkedin.com/company')) {
        profiles.linkedin = href
      } else if (href.includes('twitter.com') || href.includes('x.com')) {
        profiles.twitter = href
      } else if (href.includes('facebook.com') && !href.includes('sharer')) {
        profiles.facebook = href
      } else if (href.includes('instagram.com')) {
        profiles.instagram = href
      }
    })

    return profiles
  } catch (error) {
    console.warn(`Error extracting social profiles from ${websiteUrl}:`, error)
    return {}
  }
}

// ============================================================================
// COMPANY SIZE ESTIMATION
// ============================================================================

interface CompanySize {
  employeeRange?: string
  employeeEstimate?: number
  revenueRange?: string
}

export function estimateCompanySize(supplier: ScrapedSupplier): CompanySize {
  const result: CompanySize = {}

  // Use existing data if available
  if (supplier.employeeCount) {
    result.employeeEstimate = supplier.employeeCount
    result.employeeRange = getEmployeeRange(supplier.employeeCount)
  } else if (supplier.employeeRange) {
    result.employeeRange = supplier.employeeRange
    result.employeeEstimate = estimateFromRange(supplier.employeeRange)
  }

  // Estimate from review count (rough heuristic)
  if (!result.employeeEstimate && supplier.reviewCount) {
    if (supplier.reviewCount > 1000) {
      result.employeeRange = '100-500'
      result.employeeEstimate = 200
    } else if (supplier.reviewCount > 100) {
      result.employeeRange = '20-100'
      result.employeeEstimate = 50
    } else if (supplier.reviewCount > 20) {
      result.employeeRange = '5-20'
      result.employeeEstimate = 10
    } else {
      result.employeeRange = '1-10'
      result.employeeEstimate = 5
    }
  }

  return result
}

function getEmployeeRange(count: number): string {
  if (count < 10) return '1-10'
  if (count < 50) return '10-50'
  if (count < 200) return '50-200'
  if (count < 500) return '200-500'
  if (count < 1000) return '500-1000'
  return '1000+'
}

function estimateFromRange(range: string): number {
  const match = range.match(/(\d+)-(\d+)/)
  if (match) {
    return Math.round((parseInt(match[1]) + parseInt(match[2])) / 2)
  }
  if (range.includes('1000+')) return 1500
  return 10
}

// ============================================================================
// FULL ENRICHMENT PIPELINE
// ============================================================================

export async function enrichSupplier(supplier: ScrapedSupplier): Promise<{ supplier: ScrapedSupplier; enrichment: EnrichmentResult }> {
  const fieldsEnriched: string[] = []

  // Extract emails
  let emails: { email: string; type: 'generic' | 'personal'; confidence: number }[] = []
  if (supplier.website) {
    const extractedEmails = await extractEmailsFromWebsite(supplier.website)
    emails = extractedEmails.map(email => ({
      email,
      type: COMMON_EMAILS.some(prefix => email.startsWith(prefix)) ? 'generic' as const : 'personal' as const,
      confidence: 0.8,
    }))

    if (emails.length > 0 && !supplier.email) {
      supplier.email = emails[0].email
      fieldsEnriched.push('email')
    }
  }

  // Extract social profiles
  if (supplier.website) {
    const socials = await extractSocialProfiles(supplier.website)
    if (socials.linkedin && !supplier.linkedinUrl) {
      supplier.linkedinUrl = socials.linkedin
      fieldsEnriched.push('linkedinUrl')
    }
    if (socials.twitter && !supplier.twitterUrl) {
      supplier.twitterUrl = socials.twitter
      fieldsEnriched.push('twitterUrl')
    }
    if (socials.facebook && !supplier.facebookUrl) {
      supplier.facebookUrl = socials.facebook
      fieldsEnriched.push('facebookUrl')
    }
  }

  // Estimate company size
  const sizeEstimate = estimateCompanySize(supplier)
  if (sizeEstimate.employeeRange && !supplier.employeeRange) {
    supplier.employeeRange = sizeEstimate.employeeRange
    fieldsEnriched.push('employeeRange')
  }
  if (sizeEstimate.employeeEstimate && !supplier.employeeCount) {
    supplier.employeeCount = sizeEstimate.employeeEstimate
    fieldsEnriched.push('employeeCount')
  }

  const enrichment: EnrichmentResult = {
    supplierId: supplier.id,
    source: 'manual',  // Website scraping is manual enrichment
    enrichedAt: new Date(),
    fieldsEnriched,
    emails: emails.length > 0 ? emails : undefined,
  }

  return { supplier, enrichment }
}

export async function enrichSuppliers(suppliers: ScrapedSupplier[]): Promise<ScrapedSupplier[]> {
  // Process in batches to avoid overwhelming servers
  const batchSize = 5
  const enrichedSuppliers: ScrapedSupplier[] = []

  for (let i = 0; i < suppliers.length; i += batchSize) {
    const batch = suppliers.slice(i, i + batchSize)
    const results = await Promise.all(batch.map(s => enrichSupplier(s)))
    enrichedSuppliers.push(...results.map(r => r.supplier))

    // Small delay between batches
    if (i + batchSize < suppliers.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  return enrichedSuppliers
}
