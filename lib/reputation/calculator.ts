/**
 * Trust Score Calculator
 *
 * Core calculation engine for trust and reputation scores.
 * Uses a weighted combination of:
 * - Event history (transactions, communications, etc.)
 * - Verification status
 * - Reviews and endorsements
 * - Time decay for older events
 * - Platform tenure
 */

import {
  TrustProfile,
  TrustEvent,
  TrustTier,
  TierConfig,
  TrustCalculationResult,
  ScoreBreakdown,
  TrustRecommendation,
  JourneyType,
} from './types'

// ============================================================================
// CONFIGURATION
// ============================================================================

const TIER_CONFIGS: TierConfig[] = [
  { id: 'new', name: 'New', minScore: 0, minTransactions: 0, minTenureDays: 0, color: '#6B7280' },
  { id: 'bronze', name: 'Bronze', minScore: 40, minTransactions: 1, minTenureDays: 7, color: '#CD7F32' },
  { id: 'silver', name: 'Silver', minScore: 60, minTransactions: 5, minTenureDays: 30, color: '#C0C0C0' },
  { id: 'gold', name: 'Gold', minScore: 75, minTransactions: 15, minTenureDays: 90, color: '#FFD700' },
  { id: 'platinum', name: 'Platinum', minScore: 88, minTransactions: 50, minTenureDays: 180, color: '#E5E4E2' },
  { id: 'elite', name: 'Elite', minScore: 95, minTransactions: 100, minTenureDays: 365, color: '#9333EA' },
]

const VERIFICATION_BONUSES = {
  email: 3,
  phone: 5,
  identity: 10,
  business: 15,
  bank: 8,
}

const SCORE_WEIGHTS = {
  reliability: 0.30,
  responsiveness: 0.20,
  quality: 0.30,
  integrity: 0.20,
}

const BASE_SCORE = 50 // Starting score for new users
const MIN_SCORE = 0
const MAX_SCORE = 100

// ============================================================================
// MAIN CALCULATOR
// ============================================================================

export function calculateTrustScore(
  profile: TrustProfile,
  events: TrustEvent[],
  reviewAverage?: number,
  endorsementCount?: number
): TrustCalculationResult {
  const breakdown: ScoreBreakdown = {
    baseScore: BASE_SCORE,
    verificationBonus: 0,
    transactionBonus: 0,
    reviewBonus: 0,
    endorsementBonus: 0,
    tenureBonus: 0,
    penaltyDeductions: 0,
    decayAdjustment: 0,
  }

  // Calculate verification bonus
  breakdown.verificationBonus = calculateVerificationBonus(profile)

  // Calculate event-based scores with decay
  const eventScores = calculateEventScores(events)
  breakdown.decayAdjustment = eventScores.totalWithDecay - eventScores.totalRaw

  // Calculate transaction bonus based on volume and success rate
  breakdown.transactionBonus = calculateTransactionBonus(profile)

  // Calculate review bonus
  if (reviewAverage !== undefined && profile.reviewCount > 0) {
    breakdown.reviewBonus = calculateReviewBonus(reviewAverage, profile.reviewCount)
  }

  // Calculate endorsement bonus
  const actualEndorsements = endorsementCount ?? profile.endorsementCount
  breakdown.endorsementBonus = calculateEndorsementBonus(actualEndorsements)

  // Calculate tenure bonus
  breakdown.tenureBonus = calculateTenureBonus(profile.firstActivityAt)

  // Calculate penalties
  breakdown.penaltyDeductions = calculatePenalties(profile)

  // Calculate component scores
  const reliabilityScore = clampScore(
    BASE_SCORE +
    eventScores.reliability +
    breakdown.verificationBonus * 0.2 +
    breakdown.transactionBonus * 0.5 -
    breakdown.penaltyDeductions * 0.3
  )

  const responsivenessScore = clampScore(
    BASE_SCORE +
    eventScores.responsiveness +
    breakdown.tenureBonus * 0.3 -
    breakdown.penaltyDeductions * 0.2
  )

  const qualityScore = clampScore(
    BASE_SCORE +
    eventScores.quality +
    breakdown.reviewBonus +
    breakdown.endorsementBonus * 0.5 -
    breakdown.penaltyDeductions * 0.3
  )

  const integrityScore = clampScore(
    BASE_SCORE +
    eventScores.integrity +
    breakdown.verificationBonus * 0.5 -
    breakdown.penaltyDeductions * 0.5
  )

  // Calculate overall score as weighted average
  const overallScore = clampScore(
    reliabilityScore * SCORE_WEIGHTS.reliability +
    responsivenessScore * SCORE_WEIGHTS.responsiveness +
    qualityScore * SCORE_WEIGHTS.quality +
    integrityScore * SCORE_WEIGHTS.integrity +
    breakdown.verificationBonus * 0.3 +
    breakdown.tenureBonus * 0.2 +
    breakdown.endorsementBonus * 0.3
  )

  // Determine tier
  const tier = calculateTier(overallScore, profile.totalTransactions, profile.firstActivityAt)
  const tierChanged = tier !== profile.tier

  // Generate recommendations
  const recommendations = generateRecommendations(
    profile,
    overallScore,
    breakdown,
    tier
  )

  return {
    userId: profile.userId,
    overallScore: Math.round(overallScore * 100) / 100,
    reliabilityScore: Math.round(reliabilityScore * 100) / 100,
    responsivenessScore: Math.round(responsivenessScore * 100) / 100,
    qualityScore: Math.round(qualityScore * 100) / 100,
    integrityScore: Math.round(integrityScore * 100) / 100,
    tier,
    tierChanged,
    previousTier: tierChanged ? profile.tier : undefined,
    breakdown,
    recommendations,
  }
}

// ============================================================================
// COMPONENT CALCULATIONS
// ============================================================================

function calculateVerificationBonus(profile: TrustProfile): number {
  let bonus = 0

  if (profile.emailVerified) bonus += VERIFICATION_BONUSES.email
  if (profile.phoneVerified) bonus += VERIFICATION_BONUSES.phone
  if (profile.identityVerified) bonus += VERIFICATION_BONUSES.identity
  if (profile.businessVerified) bonus += VERIFICATION_BONUSES.business
  if (profile.bankVerified) bonus += VERIFICATION_BONUSES.bank

  return bonus
}

interface EventScoreResult {
  totalRaw: number
  totalWithDecay: number
  reliability: number
  responsiveness: number
  quality: number
  integrity: number
}

function calculateEventScores(events: TrustEvent[]): EventScoreResult {
  const now = new Date()
  let totalRaw = 0
  let totalWithDecay = 0
  let reliability = 0
  let responsiveness = 0
  let quality = 0
  let integrity = 0

  for (const event of events) {
    // Skip expired events
    if (event.expiresAt && new Date(event.expiresAt) < now) {
      continue
    }

    // Calculate decay factor
    const daysSinceEvent = (now.getTime() - new Date(event.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    const decayFactor = Math.exp(-event.decayRate * daysSinceEvent)

    // Apply decay to impact
    const decayedImpact = event.scoreImpact * decayFactor

    totalRaw += event.scoreImpact
    totalWithDecay += decayedImpact

    // Apply to component scores with decay
    reliability += event.reliabilityImpact * decayFactor
    responsiveness += event.responsivenessImpact * decayFactor
    quality += event.qualityImpact * decayFactor
    integrity += event.integrityImpact * decayFactor
  }

  return {
    totalRaw,
    totalWithDecay,
    reliability,
    responsiveness,
    quality,
    integrity,
  }
}

function calculateTransactionBonus(profile: TrustProfile): number {
  if (profile.totalTransactions === 0) return 0

  // Success rate bonus (max 10 points)
  const successRate = profile.successfulTransactions / profile.totalTransactions
  const successBonus = successRate * 10

  // Volume bonus (logarithmic, max 10 points)
  const volumeBonus = Math.min(10, Math.log10(profile.totalVolume + 1))

  // Transaction count bonus (logarithmic, max 10 points)
  const countBonus = Math.min(10, Math.log10(profile.totalTransactions + 1) * 3)

  // On-time bonus (max 5 points)
  const onTimeBonus = profile.onTimeRate * 5

  return successBonus + volumeBonus + countBonus + onTimeBonus
}

function calculateReviewBonus(avgRating: number, reviewCount: number): number {
  // Rating bonus: (rating - 3) * 5, so 5-star = +10, 1-star = -10
  const ratingBonus = (avgRating - 3) * 5

  // Volume confidence multiplier (more reviews = more confidence)
  const confidenceMultiplier = Math.min(1, Math.log10(reviewCount + 1) / 2)

  return ratingBonus * (0.5 + confidenceMultiplier * 0.5)
}

function calculateEndorsementBonus(endorsementCount: number): number {
  // Logarithmic bonus, max 15 points
  return Math.min(15, Math.log10(endorsementCount + 1) * 8)
}

function calculateTenureBonus(firstActivityAt?: Date): number {
  if (!firstActivityAt) return 0

  const daysSinceFirst = (Date.now() - new Date(firstActivityAt).getTime()) / (1000 * 60 * 60 * 24)

  // Logarithmic bonus, max 10 points
  return Math.min(10, Math.log10(daysSinceFirst + 1) * 3)
}

function calculatePenalties(profile: TrustProfile): number {
  let penalties = 0

  // Warning penalty (decays over time but still counts)
  penalties += profile.warningCount * 5

  // Suspension penalty (more severe)
  penalties += profile.suspensionCount * 15

  // Disputed transaction penalty
  if (profile.totalTransactions > 0) {
    const disputeRate = profile.disputedTransactions / profile.totalTransactions
    penalties += disputeRate * 20
  }

  // Currently suspended = major penalty
  if (profile.isSuspended) {
    penalties += 30
  }

  return penalties
}

// ============================================================================
// TIER CALCULATION
// ============================================================================

function calculateTier(
  score: number,
  transactionCount: number,
  firstActivityAt?: Date
): TrustTier {
  const tenureDays = firstActivityAt
    ? (Date.now() - new Date(firstActivityAt).getTime()) / (1000 * 60 * 60 * 24)
    : 0

  // Find highest tier that matches all criteria
  let matchedTier: TrustTier = 'new'

  for (const tier of TIER_CONFIGS) {
    if (
      score >= tier.minScore &&
      transactionCount >= tier.minTransactions &&
      tenureDays >= tier.minTenureDays
    ) {
      matchedTier = tier.id
    }
  }

  return matchedTier
}

export function getTierConfig(tier: TrustTier): TierConfig {
  return TIER_CONFIGS.find(t => t.id === tier) || TIER_CONFIGS[0]
}

export function getNextTier(currentTier: TrustTier): TierConfig | null {
  const currentIndex = TIER_CONFIGS.findIndex(t => t.id === currentTier)
  if (currentIndex < TIER_CONFIGS.length - 1) {
    return TIER_CONFIGS[currentIndex + 1]
  }
  return null
}

// ============================================================================
// RECOMMENDATIONS
// ============================================================================

function generateRecommendations(
  profile: TrustProfile,
  currentScore: number,
  breakdown: ScoreBreakdown,
  currentTier: TrustTier
): TrustRecommendation[] {
  const recommendations: TrustRecommendation[] = []

  // Verification recommendations
  if (!profile.emailVerified) {
    recommendations.push({
      action: 'Verify your email address',
      description: 'Email verification adds credibility and enables important notifications.',
      potentialImpact: VERIFICATION_BONUSES.email,
      priority: 'high',
      category: 'verification',
    })
  }

  if (!profile.phoneVerified) {
    recommendations.push({
      action: 'Verify your phone number',
      description: 'Phone verification significantly increases trust with other users.',
      potentialImpact: VERIFICATION_BONUSES.phone,
      priority: 'high',
      category: 'verification',
    })
  }

  if (!profile.identityVerified && profile.totalTransactions >= 3) {
    recommendations.push({
      action: 'Complete identity verification',
      description: 'Identity verification unlocks higher transaction limits and premium features.',
      potentialImpact: VERIFICATION_BONUSES.identity,
      priority: 'medium',
      category: 'verification',
    })
  }

  if (!profile.businessVerified && (profile.primaryJourney === 'seller' || profile.primaryJourney === 'founder')) {
    recommendations.push({
      action: 'Verify your business',
      description: 'Business verification shows legitimacy and attracts more opportunities.',
      potentialImpact: VERIFICATION_BONUSES.business,
      priority: 'high',
      category: 'verification',
    })
  }

  // Transaction recommendations
  if (profile.totalTransactions < 5) {
    recommendations.push({
      action: 'Complete more transactions',
      description: 'Building a transaction history is key to unlocking higher trust tiers.',
      potentialImpact: 8,
      priority: 'medium',
      category: 'transaction',
    })
  }

  // Response time recommendations
  if (profile.avgResponseTimeHours && profile.avgResponseTimeHours > 24) {
    recommendations.push({
      action: 'Improve response time',
      description: 'Responding within 24 hours significantly boosts your responsiveness score.',
      potentialImpact: 5,
      priority: 'medium',
      category: 'communication',
    })
  }

  // Review recommendations
  if (profile.reviewCount < 3) {
    recommendations.push({
      action: 'Ask for reviews',
      description: 'Reviews from completed transactions build social proof.',
      potentialImpact: 6,
      priority: 'medium',
      category: 'review',
    })
  }

  // Endorsement recommendations
  if (profile.endorsementCount < 2) {
    recommendations.push({
      action: 'Get endorsements',
      description: 'Endorsements from verified users boost your credibility.',
      potentialImpact: 4,
      priority: 'low',
      category: 'behavior',
    })
  }

  // Tier-specific recommendations
  const nextTier = getNextTier(currentTier)
  if (nextTier) {
    const scoreGap = nextTier.minScore - currentScore
    if (scoreGap > 0 && scoreGap <= 15) {
      recommendations.push({
        action: `Reach ${nextTier.name} tier`,
        description: `You're only ${Math.ceil(scoreGap)} points away from ${nextTier.name} status!`,
        potentialImpact: scoreGap,
        priority: 'high',
        category: 'behavior',
      })
    }
  }

  // Sort by priority and potential impact
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  recommendations.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (priorityDiff !== 0) return priorityDiff
    return b.potentialImpact - a.potentialImpact
  })

  return recommendations.slice(0, 5) // Return top 5
}

// ============================================================================
// HELPERS
// ============================================================================

function clampScore(score: number): number {
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, score))
}

export function getScoreGrade(score: number): string {
  if (score >= 95) return 'A+'
  if (score >= 90) return 'A'
  if (score >= 85) return 'A-'
  if (score >= 80) return 'B+'
  if (score >= 75) return 'B'
  if (score >= 70) return 'B-'
  if (score >= 65) return 'C+'
  if (score >= 60) return 'C'
  if (score >= 55) return 'C-'
  if (score >= 50) return 'D+'
  if (score >= 45) return 'D'
  if (score >= 40) return 'D-'
  return 'F'
}

export function getScoreColor(score: number): string {
  if (score >= 90) return '#10B981' // Emerald
  if (score >= 75) return '#3B82F6' // Blue
  if (score >= 60) return '#F59E0B' // Amber
  if (score >= 40) return '#F97316' // Orange
  return '#EF4444' // Red
}
