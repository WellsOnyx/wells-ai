// @ts-nocheck
/**
 * Wells AI Conversational Data Extractor
 *
 * Uses Claude to understand natural language and extract structured data.
 * The goal: Users never "fill out a profile" - they just talk to Wells.
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  ProgressiveProfile,
  Journey,
  ExtractionEvent,
  BuyerProfile,
  SellerProfile,
  FounderProfile,
  JobSeekerProfile,
  setNestedValue,
  PROFILE_FIELDS,
} from './profile-schema'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// EXTRACTION RESULT
// ============================================================================

export interface ExtractionResult {
  success: boolean
  extractedData: ExtractedData
  confidence: number
  events: ExtractionEvent[]
  journeyDetected?: Journey
  rawExtraction?: Record<string, unknown>
}

export interface ExtractedData {
  // Core
  journey?: Journey
  name?: string
  phone?: string
  company?: string
  industry?: string
  location?: string

  // Journey-specific
  buyer?: Partial<BuyerProfile>
  seller?: Partial<SellerProfile>
  founder?: Partial<FounderProfile>
  jobs?: Partial<JobSeekerProfile>
}

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Extract structured data from a natural language message
 * Uses Claude to understand context and pull out relevant information
 */
export async function extractFromMessage(
  message: string,
  existingProfile: ProgressiveProfile,
  conversationContext?: string
): Promise<ExtractionResult> {
  // Build the system prompt for extraction
  const systemPrompt = buildExtractionPrompt(existingProfile)

  // Add conversation context if available
  const userPrompt = conversationContext
    ? `RECENT CONVERSATION:\n${conversationContext}\n\nLATEST MESSAGE:\n${message}`
    : message

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textBlock = response.content.find(block => block.type === 'text')
    const responseText = textBlock?.type === 'text' ? textBlock.text : ''

    // Parse the JSON extraction
    const extraction = parseExtractionResponse(responseText)

    // Build extraction events
    const events = buildExtractionEvents(extraction, message, existingProfile)

    // Determine overall confidence
    const confidence = calculateExtractionConfidence(extraction, events)

    return {
      success: events.length > 0 || extraction.journey !== undefined,
      extractedData: extraction,
      confidence,
      events,
      journeyDetected: extraction.journey,
      rawExtraction: extraction as unknown as Record<string, unknown>,
    }
  } catch (error) {
    console.error('[Extractor] Error extracting from message:', error)

    // Try rule-based fallback
    const fallbackResult = extractWithRules(message, existingProfile)
    return fallbackResult
  }
}

// ============================================================================
// PROMPT BUILDING
// ============================================================================

function buildExtractionPrompt(profile: ProgressiveProfile): string {
  const currentJourney = profile.journey || 'unknown'
  const currentData = summarizeProfile(profile)

  return `You are a data extraction assistant for Wells AI. Your job is to extract structured information from natural conversation.

CURRENT USER PROFILE:
Journey: ${currentJourney}
${currentData || 'No data collected yet'}

EXTRACTION RULES:
1. Extract ANY relevant information mentioned, even indirectly
2. Be confident but don't hallucinate - only extract what's clearly stated or strongly implied
3. For ambiguous values, note your uncertainty
4. Normalize values (e.g., "10k" → 10000, "just me" → 1 for team size)
5. Extract journey type from context clues:
   - Mentions of buying, suppliers, procurement → buyer
   - Mentions of selling, customers, catalog → seller
   - Mentions of running a company, startup, founding → founder
   - Mentions of job search, career, hiring me → jobs

EXTRACTION EXAMPLES:

Message: "I run a construction company in Miami"
{
  "journey": "founder",
  "company": "mentioned but name not given",
  "industry": "construction",
  "location": "Miami",
  "founder": {
    "industry": "construction"
  }
}

Message: "Looking for packaging suppliers, need about 10,000 units monthly"
{
  "journey": "buyer",
  "buyer": {
    "typicalNeeds": ["packaging"],
    "purchaseFrequency": "monthly",
    "estimatedVolume": 10000
  }
}

Message: "I'm a senior product manager with 8 years experience"
{
  "journey": "jobs",
  "jobs": {
    "currentTitle": "Senior Product Manager",
    "experience": 8,
    "experienceLevel": "senior"
  }
}

Message: "We manufacture custom metal parts and ship nationwide"
{
  "journey": "seller",
  "seller": {
    "products": ["custom metal parts"],
    "capabilities": ["manufacturing", "custom work"],
    "serviceRegions": ["nationwide", "USA"]
  }
}

Message: "We're a seed-stage startup with 5 people, mainly looking to hire engineers"
{
  "journey": "founder",
  "founder": {
    "stage": "seed",
    "fundingStage": "seed",
    "teamSize": 5,
    "priorities": ["hiring"],
    "hiringPriorities": ["engineers"]
  }
}

Message: "Budget is around $50-100k per order, prefer net 30 terms"
{
  "buyer": {
    "budgetRange": {
      "min": 50000,
      "max": 100000,
      "currency": "USD",
      "period": "per-order"
    },
    "paymentTerms": ["Net 30"]
  }
}

Message: "Looking for remote roles in fintech, targeting 180-220k"
{
  "jobs": {
    "targetIndustries": ["fintech"],
    "preferences": {
      "remote": true,
      "salaryRange": {
        "min": 180000,
        "max": 220000,
        "currency": "USD",
        "period": "annual"
      }
    }
  }
}

Now extract data from the user's message. Return ONLY a JSON object with the extracted data. Include a "_confidence" field (0-1) for overall extraction confidence and "_notes" for any clarifications needed.

If there's nothing to extract, return: {"_nothing": true, "_confidence": 0}`
}

function summarizeProfile(profile: ProgressiveProfile): string {
  const parts: string[] = []

  if (profile.name) parts.push(`Name: ${profile.name}`)
  if (profile.email) parts.push(`Email: ${profile.email}`)

  if (profile.buyer) {
    if (profile.buyer.company) parts.push(`Company: ${profile.buyer.company}`)
    if (profile.buyer.industry) parts.push(`Industry: ${profile.buyer.industry}`)
    if (profile.buyer.typicalNeeds?.length) {
      parts.push(`Buying: ${profile.buyer.typicalNeeds.join(', ')}`)
    }
  }

  if (profile.seller) {
    if (profile.seller.company) parts.push(`Company: ${profile.seller.company}`)
    if (profile.seller.products?.length) {
      parts.push(`Selling: ${profile.seller.products.join(', ')}`)
    }
  }

  if (profile.founder) {
    if (profile.founder.company) parts.push(`Company: ${profile.founder.company}`)
    if (profile.founder.stage) parts.push(`Stage: ${profile.founder.stage}`)
    if (profile.founder.teamSize) parts.push(`Team: ${profile.founder.teamSize}`)
  }

  if (profile.jobs) {
    if (profile.jobs.currentTitle) parts.push(`Title: ${profile.jobs.currentTitle}`)
    if (profile.jobs.experience) parts.push(`Experience: ${profile.jobs.experience} years`)
    if (profile.jobs.skills?.length) {
      parts.push(`Skills: ${profile.jobs.skills.join(', ')}`)
    }
  }

  return parts.join('\n')
}

// ============================================================================
// RESPONSE PARSING
// ============================================================================

function parseExtractionResponse(response: string): ExtractedData {
  // Try to find JSON in the response
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {}
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])

    // Remove meta fields
    delete parsed._confidence
    delete parsed._notes
    delete parsed._nothing

    return normalizeExtractedData(parsed)
  } catch (error) {
    console.error('[Extractor] Failed to parse extraction response:', error)
    return {}
  }
}

function normalizeExtractedData(data: Record<string, unknown>): ExtractedData {
  const normalized: ExtractedData = {}

  // Handle journey
  if (data.journey && isValidJourney(data.journey as string)) {
    normalized.journey = data.journey as Journey
  }

  // Handle core fields
  if (typeof data.name === 'string') normalized.name = data.name
  if (typeof data.company === 'string') {
    // If company is a placeholder, don't use it
    if (!data.company.toLowerCase().includes('not given')) {
      normalized.company = data.company
    }
  }
  if (typeof data.industry === 'string') normalized.industry = data.industry
  if (typeof data.location === 'string') normalized.location = data.location
  if (typeof data.phone === 'string') normalized.phone = data.phone

  // Handle journey-specific data
  if (data.buyer && typeof data.buyer === 'object') {
    normalized.buyer = normalizeObjectData(data.buyer as Record<string, unknown>)
  }
  if (data.seller && typeof data.seller === 'object') {
    normalized.seller = normalizeObjectData(data.seller as Record<string, unknown>)
  }
  if (data.founder && typeof data.founder === 'object') {
    normalized.founder = normalizeObjectData(data.founder as Record<string, unknown>)
  }
  if (data.jobs && typeof data.jobs === 'object') {
    normalized.jobs = normalizeObjectData(data.jobs as Record<string, unknown>)
  }

  return normalized
}

function normalizeObjectData<T>(obj: Record<string, unknown>): T {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue
    if (typeof value === 'string' && value.trim() === '') continue

    // Normalize numeric strings
    if (typeof value === 'string' && /^\$?[\d,]+k?$/i.test(value)) {
      result[key] = parseNumericString(value)
    } else {
      result[key] = value
    }
  }

  return result as T
}

function parseNumericString(value: string): number {
  let cleaned = value.replace(/[$,]/g, '').toLowerCase()
  const hasK = cleaned.endsWith('k')
  if (hasK) {
    cleaned = cleaned.slice(0, -1)
  }
  const num = parseFloat(cleaned)
  return hasK ? num * 1000 : num
}

function isValidJourney(value: string): value is Journey {
  return ['buyer', 'seller', 'founder', 'jobs'].includes(value)
}

// ============================================================================
// EXTRACTION EVENTS
// ============================================================================

function buildExtractionEvents(
  extraction: ExtractedData,
  sourceMessage: string,
  existingProfile: ProgressiveProfile
): ExtractionEvent[] {
  const events: ExtractionEvent[] = []
  const timestamp = new Date()
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  // Helper to create event
  const createEvent = (
    field: string,
    value: unknown,
    confidence: number,
    method: 'explicit' | 'inferred' = 'explicit'
  ): ExtractionEvent => {
    const previousValue = getExistingValue(existingProfile, field)
    return {
      id: `ext_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp,
      messageId,
      field,
      value,
      previousValue,
      confidence,
      extractionMethod: method,
      sourceText: sourceMessage.slice(0, 200),
    }
  }

  // Core fields
  if (extraction.journey) {
    events.push(createEvent('journey', extraction.journey, 0.9))
  }
  if (extraction.name) {
    events.push(createEvent('name', extraction.name, 0.95))
  }
  if (extraction.company) {
    events.push(createEvent('company', extraction.company, 0.9))
  }
  if (extraction.industry) {
    events.push(createEvent('industry', extraction.industry, 0.85))
  }
  if (extraction.location) {
    events.push(createEvent('location', extraction.location, 0.9))
  }

  // Buyer fields
  if (extraction.buyer) {
    const b = extraction.buyer
    if (b.typicalNeeds?.length) {
      events.push(createEvent('buyer.typicalNeeds', b.typicalNeeds, 0.85))
    }
    if (b.budgetRange) {
      events.push(createEvent('buyer.budgetRange', b.budgetRange, 0.8))
    }
    if (b.locations?.length) {
      events.push(createEvent('buyer.locations', b.locations, 0.85))
    }
    if (b.industry) {
      events.push(createEvent('buyer.industry', b.industry, 0.85))
    }
    if (b.categories?.length) {
      events.push(createEvent('buyer.categories', b.categories, 0.8))
    }
  }

  // Seller fields
  if (extraction.seller) {
    const s = extraction.seller
    if (s.products?.length) {
      events.push(createEvent('seller.products', s.products, 0.9))
    }
    if (s.certifications?.length) {
      events.push(createEvent('seller.certifications', s.certifications, 0.85))
    }
    if (s.serviceRegions?.length) {
      events.push(createEvent('seller.serviceRegions', s.serviceRegions, 0.85))
    }
    if (s.capabilities?.length) {
      events.push(createEvent('seller.capabilities', s.capabilities, 0.8))
    }
  }

  // Founder fields
  if (extraction.founder) {
    const f = extraction.founder
    if (f.stage) {
      events.push(createEvent('founder.stage', f.stage, 0.85))
    }
    if (f.teamSize !== undefined) {
      events.push(createEvent('founder.teamSize', f.teamSize, 0.9))
    }
    if (f.priorities?.length) {
      events.push(createEvent('founder.priorities', f.priorities, 0.85))
    }
    if (f.lookingFor?.length) {
      events.push(createEvent('founder.lookingFor', f.lookingFor, 0.85))
    }
    if (f.fundingStage) {
      events.push(createEvent('founder.fundingStage', f.fundingStage, 0.8))
    }
  }

  // Jobs fields
  if (extraction.jobs) {
    const j = extraction.jobs
    if (j.currentTitle) {
      events.push(createEvent('jobs.currentTitle', j.currentTitle, 0.9))
    }
    if (j.experience !== undefined) {
      events.push(createEvent('jobs.experience', j.experience, 0.85))
    }
    if (j.skills?.length) {
      events.push(createEvent('jobs.skills', j.skills, 0.85))
    }
    if (j.targetTitles?.length) {
      events.push(createEvent('jobs.targetTitles', j.targetTitles, 0.85))
    }
    if (j.preferences) {
      if (j.preferences.remote !== undefined) {
        events.push(createEvent('jobs.preferences.remote', j.preferences.remote, 0.9))
      }
      if (j.preferences.salaryRange) {
        events.push(createEvent('jobs.preferences.salaryRange', j.preferences.salaryRange, 0.8))
      }
      if (j.preferences.locations?.length) {
        events.push(createEvent('jobs.preferences.locations', j.preferences.locations, 0.85))
      }
    }
  }

  return events
}

function getExistingValue(
  profile: ProgressiveProfile,
  field: string
): unknown {
  const parts = field.split('.')
  let current: unknown = profile

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

function calculateExtractionConfidence(
  extraction: ExtractedData,
  events: ExtractionEvent[]
): number {
  if (events.length === 0) return 0

  const totalConfidence = events.reduce((sum, e) => sum + e.confidence, 0)
  return totalConfidence / events.length
}

// ============================================================================
// RULE-BASED FALLBACK
// ============================================================================

function extractWithRules(
  message: string,
  existingProfile: ProgressiveProfile
): ExtractionResult {
  const extraction: ExtractedData = {}
  const events: ExtractionEvent[] = []
  const lowerMessage = message.toLowerCase()

  // Journey detection
  if (!existingProfile.journey) {
    if (
      lowerMessage.includes('buy') ||
      lowerMessage.includes('supplier') ||
      lowerMessage.includes('procurement') ||
      lowerMessage.includes('sourcing')
    ) {
      extraction.journey = 'buyer'
    } else if (
      lowerMessage.includes('sell') ||
      lowerMessage.includes('customer') ||
      lowerMessage.includes('catalog')
    ) {
      extraction.journey = 'seller'
    } else if (
      lowerMessage.includes('startup') ||
      lowerMessage.includes('founder') ||
      lowerMessage.includes('my company') ||
      lowerMessage.includes('i run')
    ) {
      extraction.journey = 'founder'
    } else if (
      lowerMessage.includes('job') ||
      lowerMessage.includes('career') ||
      lowerMessage.includes('hire me') ||
      lowerMessage.includes('looking for a role')
    ) {
      extraction.journey = 'jobs'
    }
  }

  // Name extraction
  const nameMatch = message.match(
    /(?:my name is|i'm|i am|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i
  )
  if (nameMatch) {
    extraction.name = nameMatch[1].trim()
  }

  // Years of experience
  const expMatch = message.match(/(\d+)\s*(?:\+\s*)?years?\s*(?:of\s*)?(?:experience)?/i)
  if (expMatch) {
    if (!extraction.jobs) extraction.jobs = {}
    extraction.jobs.experience = parseInt(expMatch[1])
  }

  // Location extraction
  const locationMatch = message.match(
    /(?:based in|located in|from|in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:,\s*[A-Z]{2})?)/i
  )
  if (locationMatch) {
    extraction.location = locationMatch[1].trim()
  }

  // Budget extraction
  const budgetMatch = message.match(
    /(?:budget|spend|spending)\s*(?:is|of|around|about)?\s*\$?([\d,]+)k?(?:\s*-\s*\$?([\d,]+)k?)?/i
  )
  if (budgetMatch) {
    if (!extraction.buyer) extraction.buyer = {}
    const min = parseNumericString(budgetMatch[1])
    const max = budgetMatch[2] ? parseNumericString(budgetMatch[2]) : undefined
    extraction.buyer.budgetRange = {
      min,
      max,
      currency: 'USD',
    }
  }

  // Team size
  const teamMatch = message.match(
    /(?:team of|(\d+)\s*people|(\d+)\s*employees|just me|solo)/i
  )
  if (teamMatch) {
    if (!extraction.founder) extraction.founder = {}
    if (lowerMessage.includes('just me') || lowerMessage.includes('solo')) {
      extraction.founder.teamSize = 1
    } else if (teamMatch[1]) {
      extraction.founder.teamSize = parseInt(teamMatch[1])
    } else if (teamMatch[2]) {
      extraction.founder.teamSize = parseInt(teamMatch[2])
    }
  }

  // Build events from rule-based extraction
  const timestamp = new Date()
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  const addEvent = (field: string, value: unknown) => {
    events.push({
      id: `ext_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp,
      messageId,
      field,
      value,
      confidence: 0.7, // Lower confidence for rule-based
      extractionMethod: 'inferred',
      sourceText: message.slice(0, 200),
    })
  }

  if (extraction.journey) addEvent('journey', extraction.journey)
  if (extraction.name) addEvent('name', extraction.name)
  if (extraction.location) addEvent('location', extraction.location)
  if (extraction.buyer?.budgetRange) addEvent('buyer.budgetRange', extraction.buyer.budgetRange)
  if (extraction.founder?.teamSize) addEvent('founder.teamSize', extraction.founder.teamSize)
  if (extraction.jobs?.experience) addEvent('jobs.experience', extraction.jobs.experience)

  return {
    success: events.length > 0,
    extractedData: extraction,
    confidence: events.length > 0 ? 0.7 : 0,
    events,
    journeyDetected: extraction.journey,
  }
}

// ============================================================================
// MERGE EXTRACTION INTO PROFILE
// ============================================================================

export function mergeExtractionIntoProfile(
  profile: ProgressiveProfile,
  extraction: ExtractedData,
  events: ExtractionEvent[]
): ProgressiveProfile {
  const updated = { ...profile }

  // Core fields
  if (extraction.journey && !updated.journey) {
    updated.journey = extraction.journey
    if (!updated.journeys.includes(extraction.journey)) {
      updated.journeys.push(extraction.journey)
    }
  }
  if (extraction.name) updated.name = extraction.name
  if (extraction.company) {
    // Also set company in relevant journey profile
    if (updated.journey) {
      const journeyKey = updated.journey as keyof Pick<ProgressiveProfile, 'buyer' | 'seller' | 'founder' | 'jobs'>
      if (!updated[journeyKey]) {
        (updated as Record<string, unknown>)[journeyKey] = {}
      }
      if (journeyKey !== 'jobs') {
        (updated[journeyKey] as Record<string, unknown>).company = extraction.company
      }
    }
  }

  // Buyer fields
  if (extraction.buyer) {
    if (!updated.buyer) updated.buyer = {}
    updated.buyer = deepMerge(
      updated.buyer as unknown as Record<string, unknown>,
      extraction.buyer as unknown as Record<string, unknown>
    ) as BuyerProfile
  }

  // Seller fields
  if (extraction.seller) {
    if (!updated.seller) updated.seller = {}
    updated.seller = deepMerge(
      updated.seller as unknown as Record<string, unknown>,
      extraction.seller as unknown as Record<string, unknown>
    ) as SellerProfile
  }

  // Founder fields
  if (extraction.founder) {
    if (!updated.founder) updated.founder = {}
    updated.founder = deepMerge(
      updated.founder as unknown as Record<string, unknown>,
      extraction.founder as unknown as Record<string, unknown>
    ) as FounderProfile
  }

  // Jobs fields
  if (extraction.jobs) {
    if (!updated.jobs) updated.jobs = {}
    updated.jobs = deepMerge(
      updated.jobs as unknown as Record<string, unknown>,
      extraction.jobs as unknown as Record<string, unknown>
    ) as JobSeekerProfile
  }

  // Update extraction tracking
  updated.extractedFrom = [
    ...updated.extractedFrom,
    ...events.map(e => e.messageId),
  ].slice(-50) // Keep last 50

  updated.extractionHistory = [
    ...updated.extractionHistory,
    ...events,
  ].slice(-100) // Keep last 100

  // Update confidence scores
  for (const event of events) {
    updated.confidenceScores.fields[event.field] = event.confidence
  }
  updated.confidenceScores.overall = calculateOverallConfidence(updated)

  updated.lastUpdated = new Date()

  return updated
}

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target }

  for (const key in source) {
    const sourceValue = source[key]
    const targetValue = result[key]

    if (sourceValue === undefined || sourceValue === null) continue

    if (Array.isArray(sourceValue)) {
      // Merge arrays (add new items)
      if (Array.isArray(targetValue)) {
        result[key] = Array.from(new Set([...targetValue, ...sourceValue])) as T[typeof key]
      } else {
        result[key] = sourceValue as T[typeof key]
      }
    } else if (typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      // Recursively merge objects
      if (typeof targetValue === 'object' && !Array.isArray(targetValue)) {
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[typeof key]
      } else {
        result[key] = sourceValue as T[typeof key]
      }
    } else {
      // Overwrite primitives
      result[key] = sourceValue as T[typeof key]
    }
  }

  return result
}

function calculateOverallConfidence(profile: ProgressiveProfile): number {
  const scores = Object.values(profile.confidenceScores.fields)
  if (scores.length === 0) return 0
  return scores.reduce((sum, s) => sum + s, 0) / scores.length
}

// ============================================================================
// EXPORTS
// ============================================================================

export const Extractor = {
  extractFromMessage,
  mergeExtractionIntoProfile,
  extractWithRules,
}

export default Extractor
