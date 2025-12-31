/**
 * Trust Service
 *
 * High-level service for managing trust profiles, recording events,
 * and calculating reputation scores.
 */

import { sql } from '@/lib/db'
import {
  TrustProfile,
  TrustEvent,
  TrustEventType,
  TrustTier,
  JourneyType,
  RecordEventInput,
  TrustSummary,
  TrustCalculationResult,
  Endorsement,
  Review,
  LeaderboardEntry,
} from './types'
import { calculateTrustScore, getTierConfig, getNextTier } from './calculator'

// ============================================================================
// PROFILE MANAGEMENT
// ============================================================================

export async function getOrCreateTrustProfile(
  userId: string,
  journey: JourneyType
): Promise<TrustProfile> {
  // Try to get existing profile
  const existing = await getTrustProfile(userId)
  if (existing) return existing

  // Create new profile
  const result = await sql`
    INSERT INTO trust_profiles (user_id, primary_journey)
    VALUES (${userId}, ${journey})
    RETURNING *
  `

  return mapProfileFromDb(result[0])
}

export async function getTrustProfile(userId: string): Promise<TrustProfile | null> {
  const result = await sql`
    SELECT * FROM trust_profiles WHERE user_id = ${userId}
  `

  if (result.length === 0) return null
  return mapProfileFromDb(result[0])
}

export async function updateTrustProfile(
  userId: string,
  updates: Partial<TrustProfile>
): Promise<TrustProfile | null> {
  const profile = await getTrustProfile(userId)
  if (!profile) return null

  const result = await sql`
    UPDATE trust_profiles SET
      overall_score = COALESCE(${updates.overallScore}, overall_score),
      reliability_score = COALESCE(${updates.reliabilityScore}, reliability_score),
      responsiveness_score = COALESCE(${updates.responsivenessScore}, responsiveness_score),
      quality_score = COALESCE(${updates.qualityScore}, quality_score),
      integrity_score = COALESCE(${updates.integrityScore}, integrity_score),
      tier = COALESCE(${updates.tier}, tier),
      tier_updated_at = CASE WHEN ${updates.tier}::text IS NOT NULL AND ${updates.tier}::text != tier THEN NOW() ELSE tier_updated_at END,
      email_verified = COALESCE(${updates.emailVerified}, email_verified),
      phone_verified = COALESCE(${updates.phoneVerified}, phone_verified),
      identity_verified = COALESCE(${updates.identityVerified}, identity_verified),
      business_verified = COALESCE(${updates.businessVerified}, business_verified),
      bank_verified = COALESCE(${updates.bankVerified}, bank_verified),
      total_transactions = COALESCE(${updates.totalTransactions}, total_transactions),
      successful_transactions = COALESCE(${updates.successfulTransactions}, successful_transactions),
      disputed_transactions = COALESCE(${updates.disputedTransactions}, disputed_transactions),
      total_volume = COALESCE(${updates.totalVolume}, total_volume),
      avg_response_time_hours = COALESCE(${updates.avgResponseTimeHours}, avg_response_time_hours),
      last_activity_at = NOW(),
      updated_at = NOW()
    WHERE user_id = ${userId}
    RETURNING *
  `

  return mapProfileFromDb(result[0])
}

// ============================================================================
// EVENT RECORDING
// ============================================================================

export async function recordTrustEvent(input: RecordEventInput): Promise<TrustEvent> {
  // Get event type definition
  const eventType = await getEventType(input.eventType)
  if (!eventType) {
    throw new Error(`Unknown event type: ${input.eventType}`)
  }

  // Calculate component impacts
  const reliabilityImpact = eventType.baseScoreImpact * eventType.reliabilityWeight
  const responsivenessImpact = eventType.baseScoreImpact * eventType.responsivenessWeight
  const qualityImpact = eventType.baseScoreImpact * eventType.qualityWeight
  const integrityImpact = eventType.baseScoreImpact * eventType.integrityWeight

  // Calculate expiry date
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + eventType.defaultTtlDays)

  // Insert event
  const result = await sql`
    INSERT INTO trust_events (
      user_id,
      event_type,
      event_category,
      score_impact,
      reliability_impact,
      responsiveness_impact,
      quality_impact,
      integrity_impact,
      related_entity_type,
      related_entity_id,
      counterparty_id,
      description,
      metadata,
      decay_rate,
      expires_at
    ) VALUES (
      ${input.userId},
      ${input.eventType},
      ${eventType.category},
      ${eventType.baseScoreImpact},
      ${reliabilityImpact},
      ${responsivenessImpact},
      ${qualityImpact},
      ${integrityImpact},
      ${input.relatedEntityType || null},
      ${input.relatedEntityId || null},
      ${input.counterpartyId || null},
      ${input.description || null},
      ${JSON.stringify(input.metadata || {})},
      ${eventType.defaultDecayRate},
      ${expiresAt.toISOString()}
    )
    RETURNING *
  `

  const event = mapEventFromDb(result[0])

  // Recalculate trust score
  await recalculateTrustScore(input.userId)

  return event
}

export async function getEventType(eventTypeId: string): Promise<TrustEventType | null> {
  const result = await sql`
    SELECT * FROM trust_event_types WHERE id = ${eventTypeId}
  `

  if (result.length === 0) return null
  return mapEventTypeFromDb(result[0])
}

export async function getUserEvents(
  userId: string,
  limit = 50,
  includeExpired = false
): Promise<TrustEvent[]> {
  const result = includeExpired
    ? await sql`
        SELECT * FROM trust_events
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT * FROM trust_events
        WHERE user_id = ${userId}
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC
        LIMIT ${limit}
      `

  return result.map(mapEventFromDb)
}

// ============================================================================
// SCORE RECALCULATION
// ============================================================================

export async function recalculateTrustScore(userId: string): Promise<TrustCalculationResult | null> {
  // Get profile
  const profile = await getTrustProfile(userId)
  if (!profile) return null

  // Get active events
  const events = await getUserEvents(userId, 500, false)

  // Get review average
  const reviewStats = await sql`
    SELECT
      AVG(overall_rating) as avg_rating,
      COUNT(*) as count
    FROM trust_reviews
    WHERE reviewee_id = ${userId}
      AND is_visible = TRUE
  `
  const reviewAverage = reviewStats[0]?.avg_rating
    ? parseFloat(reviewStats[0].avg_rating)
    : undefined
  const reviewCount = parseInt(reviewStats[0]?.count || '0')

  // Get endorsement count
  const endorsementStats = await sql`
    SELECT COUNT(*) as count
    FROM trust_endorsements
    WHERE endorsee_id = ${userId}
      AND is_active = TRUE
  `
  const endorsementCount = parseInt(endorsementStats[0]?.count || '0')

  // Calculate new scores
  const result = calculateTrustScore(profile, events, reviewAverage, endorsementCount)

  // Update profile with new scores
  await sql`
    UPDATE trust_profiles SET
      overall_score = ${result.overallScore},
      reliability_score = ${result.reliabilityScore},
      responsiveness_score = ${result.responsivenessScore},
      quality_score = ${result.qualityScore},
      integrity_score = ${result.integrityScore},
      tier = ${result.tier},
      tier_updated_at = CASE WHEN ${result.tierChanged} THEN NOW() ELSE tier_updated_at END,
      review_count = ${reviewCount},
      avg_review_rating = ${reviewAverage || null},
      endorsement_count = ${endorsementCount},
      updated_at = NOW()
    WHERE user_id = ${userId}
  `

  // Record score history
  await sql`
    INSERT INTO trust_score_history (
      user_id,
      overall_score,
      reliability_score,
      responsiveness_score,
      quality_score,
      integrity_score,
      tier,
      trigger_reason
    ) VALUES (
      ${userId},
      ${result.overallScore},
      ${result.reliabilityScore},
      ${result.responsivenessScore},
      ${result.qualityScore},
      ${result.integrityScore},
      ${result.tier},
      'recalculation'
    )
  `

  return result
}

// ============================================================================
// REVIEWS
// ============================================================================

export async function createReview(review: Omit<Review, 'id' | 'createdAt' | 'updatedAt'>): Promise<Review> {
  const result = await sql`
    INSERT INTO trust_reviews (
      reviewer_id,
      reviewee_id,
      transaction_type,
      transaction_id,
      overall_rating,
      reliability_rating,
      communication_rating,
      quality_rating,
      title,
      content,
      is_verified
    ) VALUES (
      ${review.reviewerId},
      ${review.revieweeId},
      ${review.transactionType || null},
      ${review.transactionId || null},
      ${review.overallRating},
      ${review.reliabilityRating || null},
      ${review.communicationRating || null},
      ${review.qualityRating || null},
      ${review.title || null},
      ${review.content || null},
      ${review.isVerified || false}
    )
    RETURNING *
  `

  // Record trust event based on rating
  const eventType = `review_${review.overallRating}_star`
  await recordTrustEvent({
    userId: review.revieweeId,
    eventType,
    relatedEntityType: 'review',
    relatedEntityId: result[0].id,
    counterpartyId: review.reviewerId,
    description: `Received ${review.overallRating}-star review`,
  })

  return mapReviewFromDb(result[0])
}

export async function getUserReviews(
  userId: string,
  asReviewee = true,
  limit = 20
): Promise<Review[]> {
  const result = asReviewee
    ? await sql`
        SELECT * FROM trust_reviews
        WHERE reviewee_id = ${userId}
          AND is_visible = TRUE
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT * FROM trust_reviews
        WHERE reviewer_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `

  return result.map(mapReviewFromDb)
}

// ============================================================================
// ENDORSEMENTS
// ============================================================================

export async function createEndorsement(
  endorsement: Omit<Endorsement, 'id' | 'createdAt' | 'weight'>
): Promise<Endorsement> {
  // Get endorser's trust score to weight the endorsement
  const endorserProfile = await getTrustProfile(endorsement.endorserId)
  const weight = endorserProfile
    ? Math.max(0.5, endorserProfile.overallScore / 100)
    : 0.5

  const result = await sql`
    INSERT INTO trust_endorsements (
      endorser_id,
      endorsee_id,
      relationship,
      skills,
      message,
      weight
    ) VALUES (
      ${endorsement.endorserId},
      ${endorsement.endorseeId},
      ${endorsement.relationship},
      ${endorsement.skills || null},
      ${endorsement.message || null},
      ${weight}
    )
    ON CONFLICT (endorser_id, endorsee_id)
    DO UPDATE SET
      relationship = EXCLUDED.relationship,
      skills = EXCLUDED.skills,
      message = EXCLUDED.message,
      weight = EXCLUDED.weight,
      is_active = TRUE
    RETURNING *
  `

  // Record trust event
  await recordTrustEvent({
    userId: endorsement.endorseeId,
    eventType: 'endorsement_received',
    relatedEntityType: 'endorsement',
    relatedEntityId: result[0].id,
    counterpartyId: endorsement.endorserId,
    description: `Received endorsement for ${endorsement.relationship}`,
  })

  // Also give credit to endorser
  await recordTrustEvent({
    userId: endorsement.endorserId,
    eventType: 'endorsement_given',
    relatedEntityType: 'endorsement',
    relatedEntityId: result[0].id,
    counterpartyId: endorsement.endorseeId,
  })

  return mapEndorsementFromDb(result[0])
}

export async function getUserEndorsements(
  userId: string,
  asEndorsee = true,
  limit = 20
): Promise<Endorsement[]> {
  const result = asEndorsee
    ? await sql`
        SELECT * FROM trust_endorsements
        WHERE endorsee_id = ${userId}
          AND is_active = TRUE
        ORDER BY weight DESC, created_at DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT * FROM trust_endorsements
        WHERE endorser_id = ${userId}
          AND is_active = TRUE
        ORDER BY created_at DESC
        LIMIT ${limit}
      `

  return result.map(mapEndorsementFromDb)
}

// ============================================================================
// TRUST SUMMARY & LEADERBOARD
// ============================================================================

export async function getTrustSummary(userId: string): Promise<TrustSummary | null> {
  const result = await sql`
    SELECT * FROM v_trust_summary WHERE user_id = ${userId}
  `

  if (result.length === 0) return null

  const row = result[0]
  return {
    userId: row.user_id,
    primaryJourney: row.primary_journey as JourneyType,
    overallScore: parseFloat(row.overall_score),
    tier: row.tier as TrustTier,
    tierName: row.tier_name,
    tierColor: row.tier_color,
    totalTransactions: parseInt(row.total_transactions),
    successfulTransactions: parseInt(row.successful_transactions),
    successRate: parseFloat(row.success_rate),
    reviewCount: parseInt(row.review_count),
    avgReviewRating: row.avg_review_rating ? parseFloat(row.avg_review_rating) : undefined,
    endorsementCount: parseInt(row.endorsement_count),
    verificationStatus: {
      email: row.email_verified,
      phone: row.phone_verified,
      identity: row.identity_verified,
      business: row.business_verified,
      bank: row.bank_verified,
    },
    isSuspended: row.is_suspended,
    lastActivityAt: row.last_activity_at ? new Date(row.last_activity_at) : undefined,
  }
}

export async function getLeaderboard(
  journey?: JourneyType,
  limit = 50
): Promise<LeaderboardEntry[]> {
  const result = journey
    ? await sql`
        SELECT * FROM v_trust_leaderboard
        WHERE primary_journey = ${journey}
        ORDER BY journey_rank
        LIMIT ${limit}
      `
    : await sql`
        SELECT * FROM v_trust_leaderboard
        ORDER BY overall_rank
        LIMIT ${limit}
      `

  return result.map(row => ({
    userId: row.user_id,
    primaryJourney: row.primary_journey as JourneyType,
    overallScore: parseFloat(row.overall_score),
    tier: row.tier as TrustTier,
    tierName: row.tier_name,
    totalTransactions: parseInt(row.total_transactions),
    endorsementCount: parseInt(row.endorsement_count),
    journeyRank: parseInt(row.journey_rank),
    overallRank: parseInt(row.overall_rank),
  }))
}

// ============================================================================
// VERIFICATION HELPERS
// ============================================================================

export async function markVerified(
  userId: string,
  verificationType: 'email' | 'phone' | 'identity' | 'business' | 'bank'
): Promise<void> {
  const fieldMap = {
    email: 'email_verified',
    phone: 'phone_verified',
    identity: 'identity_verified',
    business: 'business_verified',
    bank: 'bank_verified',
  }

  await sql`
    UPDATE trust_profiles
    SET ${sql(fieldMap[verificationType])} = TRUE,
        updated_at = NOW()
    WHERE user_id = ${userId}
  `

  // Record verification event
  await recordTrustEvent({
    userId,
    eventType: `${verificationType}_verified`,
    description: `${verificationType} verification completed`,
  })
}

// ============================================================================
// TRANSACTION HELPERS
// ============================================================================

export async function recordTransaction(
  userId: string,
  success: boolean,
  volume: number,
  onTime: boolean,
  counterpartyId?: string,
  transactionId?: string
): Promise<void> {
  // Update profile metrics
  await sql`
    UPDATE trust_profiles SET
      total_transactions = total_transactions + 1,
      successful_transactions = successful_transactions + ${success ? 1 : 0},
      total_volume = total_volume + ${volume},
      first_activity_at = COALESCE(first_activity_at, NOW()),
      last_activity_at = NOW(),
      updated_at = NOW()
    WHERE user_id = ${userId}
  `

  // Record transaction event
  await recordTrustEvent({
    userId,
    eventType: success ? 'transaction_completed' : 'transaction_cancelled',
    relatedEntityType: 'transaction',
    relatedEntityId: transactionId,
    counterpartyId,
    description: success ? 'Transaction completed successfully' : 'Transaction was cancelled',
    metadata: { volume, onTime },
  })

  // Record on-time/late event
  if (success) {
    await recordTrustEvent({
      userId,
      eventType: onTime ? 'transaction_on_time' : 'transaction_late',
      relatedEntityType: 'transaction',
      relatedEntityId: transactionId,
      counterpartyId,
    })
  }
}

// ============================================================================
// DB MAPPERS
// ============================================================================

function mapProfileFromDb(row: Record<string, unknown>): TrustProfile {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    primaryJourney: row.primary_journey as JourneyType,
    overallScore: parseFloat(row.overall_score as string),
    reliabilityScore: parseFloat(row.reliability_score as string),
    responsivenessScore: parseFloat(row.responsiveness_score as string),
    qualityScore: parseFloat(row.quality_score as string),
    integrityScore: parseFloat(row.integrity_score as string),
    tier: row.tier as TrustTier,
    tierUpdatedAt: row.tier_updated_at ? new Date(row.tier_updated_at as string) : undefined,
    emailVerified: row.email_verified as boolean,
    phoneVerified: row.phone_verified as boolean,
    identityVerified: row.identity_verified as boolean,
    businessVerified: row.business_verified as boolean,
    bankVerified: row.bank_verified as boolean,
    totalTransactions: parseInt(row.total_transactions as string),
    successfulTransactions: parseInt(row.successful_transactions as string),
    disputedTransactions: parseInt(row.disputed_transactions as string),
    totalVolume: parseFloat(row.total_volume as string),
    avgResponseTimeHours: row.avg_response_time_hours
      ? parseFloat(row.avg_response_time_hours as string)
      : undefined,
    avgCompletionTimeHours: row.avg_completion_time_hours
      ? parseFloat(row.avg_completion_time_hours as string)
      : undefined,
    onTimeRate: parseFloat(row.on_time_rate as string),
    endorsementCount: parseInt(row.endorsement_count as string),
    reviewCount: parseInt(row.review_count as string),
    avgReviewRating: row.avg_review_rating
      ? parseFloat(row.avg_review_rating as string)
      : undefined,
    warningCount: parseInt(row.warning_count as string),
    suspensionCount: parseInt(row.suspension_count as string),
    lastWarningAt: row.last_warning_at ? new Date(row.last_warning_at as string) : undefined,
    isSuspended: row.is_suspended as boolean,
    suspendedUntil: row.suspended_until ? new Date(row.suspended_until as string) : undefined,
    firstActivityAt: row.first_activity_at ? new Date(row.first_activity_at as string) : undefined,
    lastActivityAt: row.last_activity_at ? new Date(row.last_activity_at as string) : undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

function mapEventFromDb(row: Record<string, unknown>): TrustEvent {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    eventType: row.event_type as string,
    eventCategory: row.event_category as TrustEvent['eventCategory'],
    scoreImpact: parseFloat(row.score_impact as string),
    reliabilityImpact: parseFloat(row.reliability_impact as string),
    responsivenessImpact: parseFloat(row.responsiveness_impact as string),
    qualityImpact: parseFloat(row.quality_impact as string),
    integrityImpact: parseFloat(row.integrity_impact as string),
    relatedEntityType: row.related_entity_type as string | undefined,
    relatedEntityId: row.related_entity_id as string | undefined,
    counterpartyId: row.counterparty_id as string | undefined,
    description: row.description as string | undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    decayRate: parseFloat(row.decay_rate as string),
    expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
    createdAt: new Date(row.created_at as string),
  }
}

function mapEventTypeFromDb(row: Record<string, unknown>): TrustEventType {
  return {
    id: row.id as string,
    category: row.category as TrustEventType['category'],
    name: row.name as string,
    description: row.description as string | undefined,
    baseScoreImpact: parseFloat(row.base_score_impact as string),
    reliabilityWeight: parseFloat(row.reliability_weight as string),
    responsivenessWeight: parseFloat(row.responsiveness_weight as string),
    qualityWeight: parseFloat(row.quality_weight as string),
    integrityWeight: parseFloat(row.integrity_weight as string),
    defaultDecayRate: parseFloat(row.default_decay_rate as string),
    defaultTtlDays: parseInt(row.default_ttl_days as string),
    appliesToJourneys: row.applies_to_journeys as JourneyType[],
  }
}

function mapReviewFromDb(row: Record<string, unknown>): Review {
  return {
    id: row.id as string,
    reviewerId: row.reviewer_id as string,
    revieweeId: row.reviewee_id as string,
    transactionType: row.transaction_type as string | undefined,
    transactionId: row.transaction_id as string | undefined,
    overallRating: parseInt(row.overall_rating as string),
    reliabilityRating: row.reliability_rating
      ? parseInt(row.reliability_rating as string)
      : undefined,
    communicationRating: row.communication_rating
      ? parseInt(row.communication_rating as string)
      : undefined,
    qualityRating: row.quality_rating
      ? parseInt(row.quality_rating as string)
      : undefined,
    title: row.title as string | undefined,
    content: row.content as string | undefined,
    response: row.response as string | undefined,
    respondedAt: row.responded_at ? new Date(row.responded_at as string) : undefined,
    isVisible: row.is_visible as boolean,
    isVerified: row.is_verified as boolean,
    flagged: row.flagged as boolean,
    flaggedReason: row.flagged_reason as string | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

function mapEndorsementFromDb(row: Record<string, unknown>): Endorsement {
  return {
    id: row.id as string,
    endorserId: row.endorser_id as string,
    endorseeId: row.endorsee_id as string,
    relationship: row.relationship as Endorsement['relationship'],
    skills: row.skills as string[] | undefined,
    message: row.message as string | undefined,
    weight: parseFloat(row.weight as string),
    isActive: row.is_active as boolean,
    createdAt: new Date(row.created_at as string),
  }
}
