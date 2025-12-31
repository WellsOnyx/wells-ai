// @ts-nocheck
/**
 * Wells AI Progressive Profile Database
 *
 * Database utilities for storing and retrieving progressive profiles.
 * Profiles build themselves through conversation.
 */

import { query, withTransaction, sqlQuery as sql } from '@/lib/db'
import {
  ProgressiveProfile,
  Journey,
  ExtractionEvent,
  BuyerProfile,
  SellerProfile,
  FounderProfile,
  JobSeekerProfile,
  ConfidenceScores,
  createEmptyProfile,
  calculateCompleteness,
} from './profile-schema'

// ============================================================================
// PROFILE CRUD
// ============================================================================

/**
 * Get a user's progressive profile
 */
export async function getProfile(userId: string): Promise<ProgressiveProfile | null> {
  try {
    const result = await query<{
      id: string
      user_id: string
      journey: Journey | null
      journeys: Journey[]
      name: string | null
      email: string | null
      phone: string | null
      buyer_profile: BuyerProfile | null
      seller_profile: SellerProfile | null
      founder_profile: FounderProfile | null
      jobs_profile: JobSeekerProfile | null
      completeness: number
      extracted_from: string[]
      confidence_scores: ConfidenceScores
      extraction_history: ExtractionEvent[]
      created_at: string
      updated_at: string
    }>(
      `SELECT * FROM progressive_profiles WHERE user_id = $1`,
      [userId]
    )

    if (result.rows.length === 0) return null

    const row = result.rows[0]
    return rowToProfile(row)
  } catch (error) {
    console.error('[ProfileDB] Error getting profile:', error)
    return null
  }
}

/**
 * Create or update a user's progressive profile
 */
export async function upsertProfile(profile: ProgressiveProfile): Promise<ProgressiveProfile> {
  // Calculate completeness before saving
  profile.completeness = calculateCompleteness(profile)
  profile.lastUpdated = new Date()

  try {
    const result = await query<{ id: string }>(
      `INSERT INTO progressive_profiles (
        id,
        user_id,
        journey,
        journeys,
        name,
        email,
        phone,
        buyer_profile,
        seller_profile,
        founder_profile,
        jobs_profile,
        completeness,
        extracted_from,
        confidence_scores,
        extraction_history,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (user_id) DO UPDATE SET
        journey = EXCLUDED.journey,
        journeys = EXCLUDED.journeys,
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        buyer_profile = EXCLUDED.buyer_profile,
        seller_profile = EXCLUDED.seller_profile,
        founder_profile = EXCLUDED.founder_profile,
        jobs_profile = EXCLUDED.jobs_profile,
        completeness = EXCLUDED.completeness,
        extracted_from = EXCLUDED.extracted_from,
        confidence_scores = EXCLUDED.confidence_scores,
        extraction_history = EXCLUDED.extraction_history,
        updated_at = EXCLUDED.updated_at
      RETURNING id`,
      [
        profile.id,
        profile.userId,
        profile.journey,
        JSON.stringify(profile.journeys),
        profile.name || null,
        profile.email || null,
        profile.phone || null,
        JSON.stringify(profile.buyer || null),
        JSON.stringify(profile.seller || null),
        JSON.stringify(profile.founder || null),
        JSON.stringify(profile.jobs || null),
        profile.completeness,
        JSON.stringify(profile.extractedFrom),
        JSON.stringify(profile.confidenceScores),
        JSON.stringify(profile.extractionHistory.slice(-100)), // Keep last 100
        profile.createdAt.toISOString(),
        profile.lastUpdated.toISOString(),
      ]
    )

    return profile
  } catch (error) {
    console.error('[ProfileDB] Error upserting profile:', error)
    throw error
  }
}

/**
 * Get or create a profile for a user
 */
export async function getOrCreateProfile(
  userId: string,
  initialData?: Partial<ProgressiveProfile>
): Promise<ProgressiveProfile> {
  const existing = await getProfile(userId)
  if (existing) return existing

  const profile = createEmptyProfile(userId)
  if (initialData) {
    Object.assign(profile, initialData)
  }

  await upsertProfile(profile)
  return profile
}

/**
 * Update specific fields of a profile
 */
export async function updateProfileFields(
  userId: string,
  updates: Partial<ProgressiveProfile>
): Promise<ProgressiveProfile> {
  const profile = await getOrCreateProfile(userId)

  // Merge updates
  const updated = { ...profile, ...updates }

  // Deep merge journey profiles
  if (updates.buyer) {
    updated.buyer = { ...profile.buyer, ...updates.buyer }
  }
  if (updates.seller) {
    updated.seller = { ...profile.seller, ...updates.seller }
  }
  if (updates.founder) {
    updated.founder = { ...profile.founder, ...updates.founder }
  }
  if (updates.jobs) {
    updated.jobs = { ...profile.jobs, ...updates.jobs }
  }

  return upsertProfile(updated)
}

// ============================================================================
// EXTRACTION HISTORY
// ============================================================================

/**
 * Add extraction events to a profile
 */
export async function addExtractionEvents(
  userId: string,
  events: ExtractionEvent[]
): Promise<void> {
  const profile = await getOrCreateProfile(userId)

  profile.extractionHistory = [
    ...profile.extractionHistory,
    ...events,
  ].slice(-100) // Keep last 100

  // Update extracted from
  const messageIds = events.map(e => e.messageId)
  profile.extractedFrom = [
    ...profile.extractedFrom,
    ...messageIds,
  ].slice(-50)

  // Update confidence scores
  for (const event of events) {
    profile.confidenceScores.fields[event.field] = event.confidence
  }

  await upsertProfile(profile)
}

/**
 * Get extraction history for a profile
 */
export async function getExtractionHistory(
  userId: string,
  limit = 50
): Promise<ExtractionEvent[]> {
  const profile = await getProfile(userId)
  if (!profile) return []

  return profile.extractionHistory.slice(-limit)
}

// ============================================================================
// PROFILE QUERIES
// ============================================================================

/**
 * Get profiles by journey type
 */
export async function getProfilesByJourney(
  journey: Journey,
  limit = 100
): Promise<ProgressiveProfile[]> {
  try {
    const result = await query<Record<string, unknown>>(
      `SELECT * FROM progressive_profiles
       WHERE journey = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [journey, limit]
    )

    return result.rows.map(rowToProfile)
  } catch (error) {
    console.error('[ProfileDB] Error getting profiles by journey:', error)
    return []
  }
}

/**
 * Get incomplete profiles (for follow-up)
 */
export async function getIncompleteProfiles(
  threshold = 60,
  limit = 50
): Promise<ProgressiveProfile[]> {
  try {
    const result = await query<Record<string, unknown>>(
      `SELECT * FROM progressive_profiles
       WHERE completeness < $1
       AND journey IS NOT NULL
       ORDER BY updated_at DESC
       LIMIT $2`,
      [threshold, limit]
    )

    return result.rows.map(rowToProfile)
  } catch (error) {
    console.error('[ProfileDB] Error getting incomplete profiles:', error)
    return []
  }
}

/**
 * Search profiles by field value
 */
export async function searchProfiles(
  field: string,
  value: string,
  journey?: Journey
): Promise<ProgressiveProfile[]> {
  try {
    let queryText = `SELECT * FROM progressive_profiles WHERE `
    const params: (string | number)[] = []
    let paramIndex = 1

    // Build dynamic query based on field
    if (field.startsWith('buyer.')) {
      const subField = field.replace('buyer.', '')
      queryText += `buyer_profile->>'${subField}' ILIKE $${paramIndex++}`
      params.push(`%${value}%`)
    } else if (field.startsWith('seller.')) {
      const subField = field.replace('seller.', '')
      queryText += `seller_profile->>'${subField}' ILIKE $${paramIndex++}`
      params.push(`%${value}%`)
    } else if (field.startsWith('founder.')) {
      const subField = field.replace('founder.', '')
      queryText += `founder_profile->>'${subField}' ILIKE $${paramIndex++}`
      params.push(`%${value}%`)
    } else if (field.startsWith('jobs.')) {
      const subField = field.replace('jobs.', '')
      queryText += `jobs_profile->>'${subField}' ILIKE $${paramIndex++}`
      params.push(`%${value}%`)
    } else {
      queryText += `${field} ILIKE $${paramIndex++}`
      params.push(`%${value}%`)
    }

    if (journey) {
      queryText += ` AND journey = $${paramIndex++}`
      params.push(journey)
    }

    queryText += ' ORDER BY updated_at DESC LIMIT 50'

    const result = await query<Record<string, unknown>>(queryText, params)
    return result.rows.map(rowToProfile)
  } catch (error) {
    console.error('[ProfileDB] Error searching profiles:', error)
    return []
  }
}

// ============================================================================
// PROFILE STATISTICS
// ============================================================================

/**
 * Get profile completion statistics
 */
export async function getProfileStats(): Promise<{
  total: number
  byJourney: Record<Journey, number>
  averageCompleteness: number
  completeProfiles: number
}> {
  try {
    const totalResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM progressive_profiles`
    )

    const byJourneyResult = await query<{ journey: Journey; count: string }>(
      `SELECT journey, COUNT(*) as count
       FROM progressive_profiles
       WHERE journey IS NOT NULL
       GROUP BY journey`
    )

    const avgResult = await query<{ avg: string }>(
      `SELECT AVG(completeness) as avg
       FROM progressive_profiles
       WHERE journey IS NOT NULL`
    )

    const completeResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM progressive_profiles
       WHERE completeness >= 80`
    )

    const byJourney: Record<Journey, number> = {
      buyer: 0,
      seller: 0,
      founder: 0,
      jobs: 0,
    }

    for (const row of byJourneyResult.rows) {
      if (row.journey) {
        byJourney[row.journey] = parseInt(row.count)
      }
    }

    return {
      total: parseInt(totalResult.rows[0]?.count || '0'),
      byJourney,
      averageCompleteness: parseFloat(avgResult.rows[0]?.avg || '0'),
      completeProfiles: parseInt(completeResult.rows[0]?.count || '0'),
    }
  } catch (error) {
    console.error('[ProfileDB] Error getting profile stats:', error)
    return {
      total: 0,
      byJourney: { buyer: 0, seller: 0, founder: 0, jobs: 0 },
      averageCompleteness: 0,
      completeProfiles: 0,
    }
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function rowToProfile(row: Record<string, unknown>): ProgressiveProfile {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    journey: row.journey as Journey | null,
    journeys: parseJsonArray(row.journeys) as Journey[],
    name: row.name as string | undefined,
    email: row.email as string | undefined,
    phone: row.phone as string | undefined,
    buyer: parseJson(row.buyer_profile) as BuyerProfile | undefined,
    seller: parseJson(row.seller_profile) as SellerProfile | undefined,
    founder: parseJson(row.founder_profile) as FounderProfile | undefined,
    jobs: parseJson(row.jobs_profile) as JobSeekerProfile | undefined,
    completeness: row.completeness as number,
    extractedFrom: parseJsonArray(row.extracted_from) as string[],
    confidenceScores: (parseJson(row.confidence_scores) || {
      overall: 0,
      journey: 0,
      buyer: 0,
      seller: 0,
      founder: 0,
      jobs: 0,
      fields: {},
    }) as ConfidenceScores,
    extractionHistory: parseJsonArray(row.extraction_history) as ExtractionEvent[],
    createdAt: new Date(row.created_at as string),
    lastUpdated: new Date(row.updated_at as string),
  }
}

function parseJson(value: unknown): Record<string, unknown> | undefined {
  if (!value) return undefined
  if (typeof value === 'object') return value as Record<string, unknown>
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return undefined
    }
  }
  return undefined
}

function parseJsonArray(value: unknown): unknown[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ProfileDB = {
  getProfile,
  upsertProfile,
  getOrCreateProfile,
  updateProfileFields,
  addExtractionEvents,
  getExtractionHistory,
  getProfilesByJourney,
  getIncompleteProfiles,
  searchProfiles,
  getProfileStats,
}

export default ProfileDB
