/**
 * Wells AI Progressive Profile Schema
 *
 * Profiles that build themselves through conversation.
 * Users never "fill out a profile" - they just talk to Wells.
 */

// ============================================================================
// CORE PROGRESSIVE PROFILE
// ============================================================================

export interface ProgressiveProfile {
  // Identity
  id: string
  userId: string

  // Core (extracted first)
  journey: Journey | null
  journeys: Journey[] // Can have multiple
  name?: string
  email?: string // from auth
  phone?: string

  // Journey-specific (extracted progressively)
  buyer?: BuyerProfile
  seller?: SellerProfile
  founder?: FounderProfile
  jobs?: JobSeekerProfile

  // Meta
  completeness: number // 0-100
  extractedFrom: string[] // conversation/message IDs
  confidenceScores: ConfidenceScores
  lastUpdated: Date
  createdAt: Date

  // Extraction history
  extractionHistory: ExtractionEvent[]
}

export type Journey = 'buyer' | 'seller' | 'founder' | 'jobs'

// ============================================================================
// BUYER PROFILE
// ============================================================================

export interface BuyerProfile {
  company?: string
  companySize?: 'startup' | 'smb' | 'midmarket' | 'enterprise'
  industry?: string
  industries?: string[]

  // What they buy
  typicalNeeds?: string[]
  categories?: string[]
  currentProducts?: string[]

  // Buying behavior
  budgetRange?: BudgetRange
  purchaseFrequency?: 'one-time' | 'monthly' | 'quarterly' | 'annual'
  decisionMaker?: boolean
  approvalProcess?: string

  // Preferences
  locations?: string[]
  preferredRegions?: string[]
  certificationRequirements?: string[]
  paymentTerms?: string[] // Net 30, Net 60, etc.

  // Context
  urgentNeeds?: string[]
  upcomingProjects?: string[]
}

export interface BudgetRange {
  min?: number
  max?: number
  currency: string
  period?: 'per-order' | 'monthly' | 'annual'
}

// ============================================================================
// SELLER PROFILE
// ============================================================================

export interface SellerProfile {
  company?: string
  companySize?: 'solo' | 'small' | 'medium' | 'large'

  // What they sell
  products?: string[]
  services?: string[]
  categories?: string[]
  specializations?: string[]

  // Capabilities
  capabilities?: string[]
  certifications?: string[]
  qualityStandards?: string[]

  // Capacity
  capacity?: CapacityInfo
  leadTime?: string
  minimumOrder?: number

  // Geography
  serviceRegions?: string[]
  manufacturingLocations?: string[]
  shippingCapabilities?: string[]

  // Terms
  acceptedPaymentTerms?: string[]
  typicalDealSize?: BudgetRange
}

export interface CapacityInfo {
  description?: string
  unitsPerMonth?: number
  percentageAvailable?: number
}

// ============================================================================
// FOUNDER PROFILE
// ============================================================================

export interface FounderProfile {
  company?: string
  companyDescription?: string

  // Stage
  stage?: 'idea' | 'mvp' | 'early-revenue' | 'growth' | 'scale'
  fundingStage?: 'bootstrapped' | 'pre-seed' | 'seed' | 'series-a' | 'series-b+'

  // Team
  teamSize?: number
  departments?: string[]
  hiringPriorities?: string[]

  // Focus areas
  priorities?: FounderPriority[]
  challenges?: string[]
  goals?: string[]

  // Business details
  industry?: string
  businessModel?: string
  targetCustomers?: string

  // What they need from Wells
  lookingFor?: ('hiring' | 'sourcing' | 'selling' | 'fundraising' | 'partnerships')[]
}

export type FounderPriority =
  | 'hiring'
  | 'sourcing'
  | 'fundraising'
  | 'customers'
  | 'partnerships'
  | 'operations'

// ============================================================================
// JOB SEEKER PROFILE
// ============================================================================

export interface JobSeekerProfile {
  // Current state
  currentTitle?: string
  currentCompany?: string
  currentIndustry?: string
  employmentStatus?: 'employed' | 'unemployed' | 'freelance' | 'student'

  // Experience
  experience?: number // years
  experienceLevel?: 'entry' | 'mid' | 'senior' | 'executive'

  // Skills
  skills?: string[]
  primarySkills?: string[]
  toolsAndTechnologies?: string[]
  certifications?: string[]

  // What they want
  targetTitle?: string
  targetTitles?: string[]
  targetIndustries?: string[]
  targetCompanySizes?: string[]

  // Preferences
  preferences?: JobPreferences

  // Context
  reasonForLooking?: string
  timeline?: 'immediately' | 'within-month' | 'within-quarter' | 'exploring'
  openTo?: ('full-time' | 'part-time' | 'contract' | 'freelance')[]
}

export interface JobPreferences {
  remote?: boolean | 'hybrid' | 'onsite' | 'flexible'
  location?: string
  locations?: string[]
  willingToRelocate?: boolean

  salaryRange?: SalaryRange
  mustHaves?: string[]
  dealBreakers?: string[]

  culture?: string[]
  companyStage?: string[]
}

export interface SalaryRange {
  min?: number
  max?: number
  currency: string
  period?: 'hourly' | 'annual'
}

// ============================================================================
// EXTRACTION TRACKING
// ============================================================================

export interface ExtractionEvent {
  id: string
  timestamp: Date
  messageId: string
  conversationId?: string

  // What was extracted
  field: string
  value: unknown
  previousValue?: unknown

  // Confidence
  confidence: number // 0-1
  extractionMethod: 'explicit' | 'inferred' | 'confirmed' | 'corrected'

  // Source
  sourceText?: string // The text that led to extraction
}

export interface ConfidenceScores {
  overall: number
  journey: number
  buyer: number
  seller: number
  founder: number
  jobs: number

  // Per-field confidence
  fields: Record<string, number>
}

// ============================================================================
// PROFILE FIELD DEFINITIONS
// ============================================================================

export interface ProfileFieldDef {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'range'
  journey: Journey | 'all'
  priority: 'core' | 'important' | 'nice-to-have'
  extractionPatterns?: string[] // Regex patterns to help extract
  examples?: string[] // Example values
  questionHint?: string // How to ask about this naturally
}

export const PROFILE_FIELDS: ProfileFieldDef[] = [
  // Core fields (all journeys)
  {
    key: 'name',
    label: 'Name',
    type: 'string',
    journey: 'all',
    priority: 'core',
    extractionPatterns: ['my name is (.+)', "i'm (.+)", 'call me (.+)'],
    questionHint: "What should I call you?"
  },
  {
    key: 'company',
    label: 'Company',
    type: 'string',
    journey: 'all',
    priority: 'core',
    extractionPatterns: ['at (.+)', 'work for (.+)', 'run (.+)', 'own (.+)'],
    questionHint: "What company are you with?"
  },

  // Buyer fields
  {
    key: 'buyer.typicalNeeds',
    label: 'Typical needs',
    type: 'array',
    journey: 'buyer',
    priority: 'core',
    extractionPatterns: ['need (.+)', 'looking for (.+)', 'want to buy (.+)'],
    questionHint: "What kinds of products or services do you typically need?"
  },
  {
    key: 'buyer.budgetRange',
    label: 'Budget',
    type: 'range',
    journey: 'buyer',
    priority: 'important',
    extractionPatterns: ['budget.{0,10}(\\$?[\\d,]+)', 'spend.{0,10}(\\$?[\\d,]+)'],
    questionHint: "What kind of budget are you working with? Ballpark is fine."
  },
  {
    key: 'buyer.locations',
    label: 'Locations',
    type: 'array',
    journey: 'buyer',
    priority: 'important',
    extractionPatterns: ['based in (.+)', 'located in (.+)', 'in (.+)'],
    questionHint: "Where are you based? This helps me find local options."
  },

  // Seller fields
  {
    key: 'seller.products',
    label: 'Products',
    type: 'array',
    journey: 'seller',
    priority: 'core',
    extractionPatterns: ['sell (.+)', 'offer (.+)', 'manufacture (.+)'],
    questionHint: "What products or services do you offer?"
  },
  {
    key: 'seller.certifications',
    label: 'Certifications',
    type: 'array',
    journey: 'seller',
    priority: 'important',
    extractionPatterns: ['certified (.+)', 'ISO', 'SOC', 'FDA'],
    questionHint: "Any certifications buyers should know about?"
  },
  {
    key: 'seller.serviceRegions',
    label: 'Service regions',
    type: 'array',
    journey: 'seller',
    priority: 'important',
    extractionPatterns: ['ship to (.+)', 'serve (.+)', 'deliver to (.+)'],
    questionHint: "Where can you ship or deliver to?"
  },

  // Founder fields
  {
    key: 'founder.stage',
    label: 'Company stage',
    type: 'string',
    journey: 'founder',
    priority: 'core',
    extractionPatterns: ['just started', 'mvp', 'early', 'scaling', 'raised'],
    questionHint: "What stage is your company at?"
  },
  {
    key: 'founder.priorities',
    label: 'Priorities',
    type: 'array',
    journey: 'founder',
    priority: 'core',
    extractionPatterns: ['need to hire', 'looking for suppliers', 'finding customers'],
    questionHint: "What's your #1 priority right now?"
  },
  {
    key: 'founder.teamSize',
    label: 'Team size',
    type: 'number',
    journey: 'founder',
    priority: 'important',
    extractionPatterns: ['(\\d+) people', 'team of (\\d+)', 'just me', 'solo'],
    questionHint: "How big is your team?"
  },

  // Job seeker fields
  {
    key: 'jobs.currentTitle',
    label: 'Current title',
    type: 'string',
    journey: 'jobs',
    priority: 'core',
    extractionPatterns: ["i'm a (.+)", 'work as (.+)', 'currently (.+)'],
    questionHint: "What's your current role?"
  },
  {
    key: 'jobs.experience',
    label: 'Years of experience',
    type: 'number',
    journey: 'jobs',
    priority: 'core',
    extractionPatterns: ['(\\d+) years', 'experience.{0,10}(\\d+)'],
    questionHint: "How many years of experience do you have?"
  },
  {
    key: 'jobs.skills',
    label: 'Skills',
    type: 'array',
    journey: 'jobs',
    priority: 'core',
    extractionPatterns: ['skilled in (.+)', 'expertise in (.+)', 'know (.+)'],
    questionHint: "What are your key skills?"
  },
  {
    key: 'jobs.preferences.remote',
    label: 'Remote preference',
    type: 'boolean',
    journey: 'jobs',
    priority: 'important',
    extractionPatterns: ['remote', 'on-site', 'hybrid', 'office'],
    questionHint: "Are you open to remote work, or prefer being in an office?"
  },
  {
    key: 'jobs.preferences.salaryRange',
    label: 'Salary expectations',
    type: 'range',
    journey: 'jobs',
    priority: 'important',
    extractionPatterns: ['looking for (\\$?[\\d,]+k?)', 'salary.{0,10}(\\$?[\\d,]+)'],
    questionHint: "What salary range are you targeting?"
  },
]

// ============================================================================
// COMPLETENESS THRESHOLDS
// ============================================================================

export const COMPLETENESS_THRESHOLDS = {
  minimal: 20,     // Can start helping
  usable: 40,      // Reasonable picture
  good: 60,        // Can help well
  excellent: 80,   // Full picture
  complete: 95,    // Everything known
}

export const JOURNEY_REQUIRED_FIELDS: Record<Journey, string[]> = {
  buyer: ['company', 'buyer.typicalNeeds'],
  seller: ['company', 'seller.products'],
  founder: ['company', 'founder.stage', 'founder.priorities'],
  jobs: ['jobs.currentTitle', 'jobs.skills'],
}

export const JOURNEY_IMPORTANT_FIELDS: Record<Journey, string[]> = {
  buyer: ['buyer.budgetRange', 'buyer.locations', 'buyer.industry'],
  seller: ['seller.certifications', 'seller.serviceRegions', 'seller.capacity'],
  founder: ['founder.teamSize', 'founder.lookingFor', 'founder.challenges'],
  jobs: ['jobs.experience', 'jobs.preferences.remote', 'jobs.preferences.salaryRange'],
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function createEmptyProfile(userId: string): ProgressiveProfile {
  return {
    id: `profile_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    userId,
    journey: null,
    journeys: [],
    completeness: 0,
    extractedFrom: [],
    confidenceScores: {
      overall: 0,
      journey: 0,
      buyer: 0,
      seller: 0,
      founder: 0,
      jobs: 0,
      fields: {},
    },
    lastUpdated: new Date(),
    createdAt: new Date(),
    extractionHistory: [],
  }
}

export function calculateCompleteness(profile: ProgressiveProfile): number {
  if (!profile.journey) return 0

  const journey = profile.journey
  const required = JOURNEY_REQUIRED_FIELDS[journey]
  const important = JOURNEY_IMPORTANT_FIELDS[journey]

  let score = 0
  let maxScore = 0

  // Required fields are worth more
  for (const field of required) {
    maxScore += 20
    if (getNestedValue(profile as unknown as Record<string, unknown>, field)) {
      score += 20
    }
  }

  // Important fields
  for (const field of important) {
    maxScore += 10
    if (getNestedValue(profile as unknown as Record<string, unknown>, field)) {
      score += 10
    }
  }

  // Base points for journey selection
  if (profile.journey) score += 10
  if (profile.name) score += 5
  if (profile.email) score += 5

  maxScore += 20 // For journey, name, email

  return Math.round((score / maxScore) * 100)
}

export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }

  // Check if value is "filled"
  if (current === null || current === undefined) return undefined
  if (Array.isArray(current) && current.length === 0) return undefined
  if (typeof current === 'string' && current.trim() === '') return undefined

  return current
}

export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = path.split('.')
  let current = obj

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }

  current[parts[parts.length - 1]] = value
}

export function getMissingFields(profile: ProgressiveProfile): ProfileFieldDef[] {
  if (!profile.journey) return []

  const journey = profile.journey
  const missing: ProfileFieldDef[] = []

  for (const field of PROFILE_FIELDS) {
    if (field.journey !== journey && field.journey !== 'all') continue
    if (getNestedValue(profile as unknown as Record<string, unknown>, field.key)) continue
    missing.push(field)
  }

  // Sort by priority
  const priorityOrder = { core: 0, important: 1, 'nice-to-have': 2 }
  missing.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return missing
}

export function getFieldsToAskAbout(profile: ProgressiveProfile, limit = 2): ProfileFieldDef[] {
  return getMissingFields(profile).slice(0, limit)
}
