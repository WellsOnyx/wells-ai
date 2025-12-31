/**
 * Types for Web Scraping Supplier Discovery
 */

import { SourceType } from './sources'

// ============================================================================
// SCRAPED SUPPLIER DATA
// ============================================================================

export interface ScrapedSupplier {
  // Identity
  id: string                    // Generated UUID
  externalId?: string           // ID from source (e.g., Google Place ID)
  source: SourceType            // Where we found them
  scrapedAt: Date

  // Basic Info
  name: string
  description?: string
  website?: string
  logoUrl?: string

  // Contact
  email?: string
  phone?: string
  contactName?: string
  contactTitle?: string

  // Location
  address?: {
    street?: string
    city?: string
    state?: string
    zip?: string
    country?: string
  }
  coordinates?: {
    lat: number
    lng: number
  }

  // Business Details
  industry?: string
  categories?: string[]
  services?: string[]
  products?: string[]

  // Size/Scale
  employeeCount?: number
  employeeRange?: string        // "10-50", "50-200", etc.
  revenue?: number
  revenueRange?: string
  yearFounded?: number

  // Reputation
  rating?: number               // 0-5
  reviewCount?: number
  bbbRating?: string           // "A+", "A", etc.
  verified?: boolean

  // Social
  linkedinUrl?: string
  twitterUrl?: string
  facebookUrl?: string

  // Metadata
  confidence: number            // 0-1 how confident we are in this data
  rawData?: Record<string, unknown>  // Original scraped data for debugging
}

// ============================================================================
// SCRAPING JOB
// ============================================================================

export interface ScrapingJob {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'

  // What triggered this
  triggeredBy: 'buyer_request' | 'manual' | 'scheduled'
  buyerRequestId?: string

  // Search parameters
  query: {
    keywords: string[]
    category: string
    subcategory?: string
    location?: {
      city?: string
      state?: string
      country?: string
      radius?: number
    }
  }

  // Sources to search
  sources: SourceType[]

  // Results
  suppliersFound: number
  suppliersNew: number           // Not already in our system
  suppliersContacted: number     // We sent outreach

  // Timing
  startedAt?: Date
  completedAt?: Date
  error?: string

  createdAt: Date
}

// ============================================================================
// ENRICHMENT DATA
// ============================================================================

export interface EnrichmentResult {
  supplierId: string
  source: 'clearbit' | 'apollo' | 'hunter' | 'manual'
  enrichedAt: Date

  // What we added
  fieldsEnriched: string[]

  // Email discovery
  emails?: {
    email: string
    type: 'generic' | 'personal'
    confidence: number
    name?: string
    title?: string
  }[]

  // Company data
  companyData?: {
    description?: string
    industry?: string
    employeeCount?: number
    revenue?: number
    techStack?: string[]
    socialProfiles?: Record<string, string>
  }
}

// ============================================================================
// OUTREACH TRACKING
// ============================================================================

export interface SupplierOutreach {
  id: string
  scrapedSupplierId: string
  scrapingJobId: string
  buyerRequestId?: string

  // Contact
  contactMethod: 'email' | 'linkedin' | 'phone' | 'form'
  contactEmail?: string
  contactPhone?: string
  linkedinUrl?: string

  // Message
  subject?: string
  message: string

  // Status
  status: 'pending' | 'sent' | 'opened' | 'clicked' | 'replied' | 'converted' | 'bounced' | 'unsubscribed'

  // Tracking
  sentAt?: Date
  openedAt?: Date
  clickedAt?: Date
  repliedAt?: Date
  convertedAt?: Date

  // Response
  response?: string

  createdAt: Date
}

// ============================================================================
// CONVERSION TRACKING
// ============================================================================

export interface SupplierConversion {
  id: string
  scrapedSupplierId: string
  outreachId: string
  buyerRequestId?: string

  // What happened
  event: 'profile_created' | 'quote_submitted' | 'deal_closed'

  // Attribution
  revenue?: number              // If deal closed
  fee?: number                  // 1% Wells fee

  createdAt: Date
}
