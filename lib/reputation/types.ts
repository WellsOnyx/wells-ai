/**
 * Trust & Reputation System Types
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export type JourneyType = 'buyer' | 'seller' | 'job_seeker' | 'founder'

export type TrustTier = 'new' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'elite'

export type EventCategory = 'transaction' | 'communication' | 'verification' | 'behavior' | 'review'

// ============================================================================
// TRUST PROFILE
// ============================================================================

export interface TrustProfile {
  id: string
  userId: string
  primaryJourney: JourneyType

  // Composite Scores (0-100)
  overallScore: number
  reliabilityScore: number
  responsivenessScore: number
  qualityScore: number
  integrityScore: number

  // Tier
  tier: TrustTier
  tierUpdatedAt?: Date

  // Verification
  emailVerified: boolean
  phoneVerified: boolean
  identityVerified: boolean
  businessVerified: boolean
  bankVerified: boolean

  // Activity Metrics
  totalTransactions: number
  successfulTransactions: number
  disputedTransactions: number
  totalVolume: number

  // Timing
  avgResponseTimeHours?: number
  avgCompletionTimeHours?: number
  onTimeRate: number

  // Social Proof
  endorsementCount: number
  reviewCount: number
  avgReviewRating?: number

  // Risk
  warningCount: number
  suspensionCount: number
  lastWarningAt?: Date
  isSuspended: boolean
  suspendedUntil?: Date

  // Timestamps
  firstActivityAt?: Date
  lastActivityAt?: Date
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// TRUST EVENTS
// ============================================================================

export interface TrustEvent {
  id: string
  userId: string

  eventType: string
  eventCategory: EventCategory

  // Impact scores
  scoreImpact: number
  reliabilityImpact: number
  responsivenessImpact: number
  qualityImpact: number
  integrityImpact: number

  // Context
  relatedEntityType?: string
  relatedEntityId?: string
  counterpartyId?: string

  description?: string
  metadata?: Record<string, unknown>

  // Decay
  decayRate: number
  expiresAt?: Date

  createdAt: Date
}

export interface TrustEventType {
  id: string
  category: EventCategory
  name: string
  description?: string

  baseScoreImpact: number
  reliabilityWeight: number
  responsivenessWeight: number
  qualityWeight: number
  integrityWeight: number

  defaultDecayRate: number
  defaultTtlDays: number

  appliesToJourneys: JourneyType[]
}

// ============================================================================
// ENDORSEMENTS
// ============================================================================

export type EndorsementRelationship =
  | 'worked_together'
  | 'transacted'
  | 'collaborated'
  | 'knows_personally'

export interface Endorsement {
  id: string
  endorserId: string
  endorseeId: string

  relationship: EndorsementRelationship
  skills?: string[]
  message?: string

  weight: number
  isActive: boolean

  createdAt: Date
}

// ============================================================================
// REVIEWS
// ============================================================================

export interface Review {
  id: string
  reviewerId: string
  revieweeId: string

  transactionType?: string
  transactionId?: string

  overallRating: number // 1-5
  reliabilityRating?: number
  communicationRating?: number
  qualityRating?: number

  title?: string
  content?: string

  response?: string
  respondedAt?: Date

  isVisible: boolean
  isVerified: boolean
  flagged: boolean
  flaggedReason?: string

  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// TIER CONFIGURATION
// ============================================================================

export interface TierConfig {
  id: TrustTier
  name: string
  minScore: number
  minTransactions: number
  minTenureDays: number
  color: string
  icon?: string
  badgeUrl?: string
  benefits?: TierBenefits
}

export interface TierBenefits {
  reducedFees?: number // Percentage reduction
  prioritySupport?: boolean
  featuredListing?: boolean
  verifiedBadge?: boolean
  customBranding?: boolean
  apiAccess?: boolean
  dedicatedManager?: boolean
}

// ============================================================================
// CALCULATION RESULTS
// ============================================================================

export interface TrustCalculationResult {
  userId: string

  // Current scores
  overallScore: number
  reliabilityScore: number
  responsivenessScore: number
  qualityScore: number
  integrityScore: number

  // Tier
  tier: TrustTier
  tierChanged: boolean
  previousTier?: TrustTier

  // Breakdown
  breakdown: ScoreBreakdown

  // Recommendations
  recommendations: TrustRecommendation[]
}

export interface ScoreBreakdown {
  baseScore: number
  verificationBonus: number
  transactionBonus: number
  reviewBonus: number
  endorsementBonus: number
  tenureBonus: number
  penaltyDeductions: number
  decayAdjustment: number
}

export interface TrustRecommendation {
  action: string
  description: string
  potentialImpact: number
  priority: 'high' | 'medium' | 'low'
  category: EventCategory
}

// ============================================================================
// API TYPES
// ============================================================================

export interface RecordEventInput {
  userId: string
  eventType: string
  relatedEntityType?: string
  relatedEntityId?: string
  counterpartyId?: string
  description?: string
  metadata?: Record<string, unknown>
}

export interface TrustSummary {
  userId: string
  primaryJourney: JourneyType
  overallScore: number
  tier: TrustTier
  tierName: string
  tierColor: string
  totalTransactions: number
  successfulTransactions: number
  successRate: number
  reviewCount: number
  avgReviewRating?: number
  endorsementCount: number
  verificationStatus: {
    email: boolean
    phone: boolean
    identity: boolean
    business: boolean
    bank: boolean
  }
  isSuspended: boolean
  lastActivityAt?: Date
}

export interface LeaderboardEntry {
  userId: string
  primaryJourney: JourneyType
  overallScore: number
  tier: TrustTier
  tierName: string
  totalTransactions: number
  endorsementCount: number
  journeyRank: number
  overallRank: number
}
