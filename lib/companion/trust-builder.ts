// @ts-nocheck
/**
 * Wells AI Trust Builder
 *
 * "Trust in the LORD with all your heart and lean not on your own understanding;
 *  in all your ways submit to him, and he will make your paths straight." - Proverbs 3:5-6
 *
 * Trust is the foundation of the Wells AI companion relationship. This module
 * tracks the relationship between Wells and each user, measuring trust through
 * actions and outcomes, not just words.
 */

import { query } from '@/lib/db'

// ============================================================================
// TYPES
// ============================================================================

export type TrustTier = 'new' | 'developing' | 'trusted' | 'partner'

export interface TrustScore {
  userId: string
  score: number // 0-100
  tier: TrustTier
  factors: TrustFactors
  milestones: TrustMilestone[]
  autonomyLevel: AutonomySettings
  lastUpdated: Date
  createdAt: Date
}

export interface TrustFactors {
  // Interaction metrics
  totalInteractions: number
  daysActive: number
  averageSessionLength: number // minutes
  conversationDepth: number // 0-100, how substantive are conversations

  // Deal/Transaction metrics
  successfulDeals: number
  failedDeals: number
  totalDealValue: number
  dealSuccessRate: number // 0-100

  // Value metrics
  moneySaved: number
  moneyEarned: number
  timesSaved: number // hours
  risksAvoided: number
  riskValueAvoided: number

  // Insight metrics
  insightsGenerated: number
  insightsActedUpon: number
  insightsDismissed: number
  insightSuccessRate: number // 0-100

  // Feedback metrics
  positiveRatings: number
  negativeRatings: number
  feedbackScore: number // 0-100

  // Engagement metrics
  referralsMade: number
  featuresExplored: number
  integrationConnections: number
}

export interface TrustMilestone {
  id: string
  name: string
  description: string
  achievedAt: Date
  category: 'interaction' | 'value' | 'trust' | 'engagement'
  reward?: string
}

export interface AutonomySettings {
  // What Wells can do automatically
  autoNegotiate: boolean
  autoNegotiateMaxValue: number
  autoApproveDeals: boolean
  autoApproveThreshold: number
  autoRespondToRfqs: boolean
  autoApplyToJobs: boolean
  proactiveOutreach: boolean
  proactiveOutreachTypes: ('follow_up' | 'opportunity' | 'risk_alert')[]

  // What requires approval
  approvalRequired: ApprovalRequirement[]
}

export interface ApprovalRequirement {
  action: string
  threshold?: number
  reason: string
}

export interface TrustEvent {
  id: string
  userId: string
  eventType: TrustEventType
  details: Record<string, any>
  impactScore: number // -10 to +10
  timestamp: Date
}

export type TrustEventType =
  | 'deal_completed'
  | 'deal_failed'
  | 'insight_acted_upon'
  | 'insight_dismissed'
  | 'insight_successful'
  | 'positive_feedback'
  | 'negative_feedback'
  | 'autonomy_granted'
  | 'autonomy_revoked'
  | 'referral_made'
  | 'integration_connected'
  | 'conversation_deep'
  | 'money_saved'
  | 'money_earned'
  | 'risk_avoided'

// ============================================================================
// TRUST CALCULATION
// ============================================================================

const TRUST_WEIGHTS = {
  successfulDeals: 0.20,
  insightSuccessRate: 0.20,
  dealSuccessRate: 0.15,
  feedbackScore: 0.15,
  valueTrust: 0.15, // Based on money saved/earned
  engagementDepth: 0.10,
  consistency: 0.05,
}

const TIER_THRESHOLDS = {
  new: 0,
  developing: 25,
  trusted: 60,
  partner: 85,
}

const MILESTONES = {
  first_conversation: {
    name: 'First Chat',
    description: 'Had your first conversation with Wells',
    category: 'interaction' as const,
  },
  first_deal: {
    name: 'Deal Maker',
    description: 'Completed your first deal with Wells assistance',
    category: 'value' as const,
  },
  ten_deals: {
    name: 'Power User',
    description: 'Completed 10 successful deals',
    category: 'value' as const,
  },
  first_thousand_saved: {
    name: 'Smart Saver',
    description: 'Saved your first $1,000 with Wells insights',
    category: 'value' as const,
  },
  ten_thousand_saved: {
    name: 'Savings Champion',
    description: 'Saved over $10,000 with Wells',
    category: 'value' as const,
  },
  hundred_thousand_saved: {
    name: 'Savings Legend',
    description: 'Saved over $100,000 with Wells',
    category: 'value' as const,
  },
  first_autonomy: {
    name: 'Trust Given',
    description: 'Granted Wells autonomy for the first time',
    category: 'trust' as const,
  },
  full_autonomy: {
    name: 'Full Partner',
    description: 'Granted Wells full autonomous capabilities',
    category: 'trust' as const,
  },
  first_referral: {
    name: 'Advocate',
    description: 'Made your first referral',
    category: 'engagement' as const,
  },
  integration_pioneer: {
    name: 'Integration Pioneer',
    description: 'Connected 5+ integrations',
    category: 'engagement' as const,
  },
  thirty_day_streak: {
    name: 'Consistent Partner',
    description: 'Active for 30 consecutive days',
    category: 'engagement' as const,
  },
  insight_master: {
    name: 'Insight Master',
    description: 'Acted on 50 insights with positive outcomes',
    category: 'value' as const,
  },
}

/**
 * Calculate trust score from factors
 */
export function calculateTrustScore(factors: TrustFactors): number {
  let score = 0

  // Deal success (0-100)
  const dealScore = factors.successfulDeals > 0
    ? Math.min(100, factors.successfulDeals * 5)
    : 0
  score += dealScore * TRUST_WEIGHTS.successfulDeals

  // Insight success rate (0-100)
  score += factors.insightSuccessRate * TRUST_WEIGHTS.insightSuccessRate

  // Deal success rate (0-100)
  score += factors.dealSuccessRate * TRUST_WEIGHTS.dealSuccessRate

  // Feedback score (0-100)
  score += factors.feedbackScore * TRUST_WEIGHTS.feedbackScore

  // Value trust - logarithmic scale for money saved/earned
  const totalValue = factors.moneySaved + factors.moneyEarned
  const valueScore = totalValue > 0 ? Math.min(100, Math.log10(totalValue) * 20) : 0
  score += valueScore * TRUST_WEIGHTS.valueTrust

  // Engagement depth
  const engagementScore = Math.min(100,
    factors.conversationDepth * 0.3 +
    (factors.integrationConnections * 10) +
    (factors.featuresExplored * 5)
  )
  score += engagementScore * TRUST_WEIGHTS.engagementDepth

  // Consistency (based on days active)
  const consistencyScore = Math.min(100, factors.daysActive * 2)
  score += consistencyScore * TRUST_WEIGHTS.consistency

  return Math.round(Math.min(100, Math.max(0, score)))
}

/**
 * Determine trust tier from score
 */
export function getTrustTier(score: number): TrustTier {
  if (score >= TIER_THRESHOLDS.partner) return 'partner'
  if (score >= TIER_THRESHOLDS.trusted) return 'trusted'
  if (score >= TIER_THRESHOLDS.developing) return 'developing'
  return 'new'
}

// ============================================================================
// TRUST MANAGEMENT
// ============================================================================

/**
 * Get or create trust score for user
 */
export async function getTrustScore(userId: string): Promise<TrustScore> {
  try {
    const result = await query(
      'SELECT * FROM user_trust_scores WHERE user_id = $1',
      [userId]
    )

    if (result.rows.length === 0) {
      return await createInitialTrustScore(userId)
    }

    const row = result.rows[0]
    return {
      userId: row.user_id,
      score: row.score,
      tier: row.tier,
      factors: row.factors,
      milestones: row.milestones || [],
      autonomyLevel: row.autonomy_level,
      lastUpdated: new Date(row.last_updated),
      createdAt: new Date(row.created_at),
    }
  } catch (error) {
    console.error('[TrustBuilder] Error getting trust score:', error)
    return getDefaultTrustScore(userId)
  }
}

/**
 * Create initial trust score for new user
 */
async function createInitialTrustScore(userId: string): Promise<TrustScore> {
  const now = new Date()
  const factors = getDefaultFactors()
  const autonomyLevel = getDefaultAutonomy()

  const trustScore: TrustScore = {
    userId,
    score: 0,
    tier: 'new',
    factors,
    milestones: [],
    autonomyLevel,
    lastUpdated: now,
    createdAt: now,
  }

  try {
    await query(
      `INSERT INTO user_trust_scores (
        user_id, score, tier, factors, milestones, autonomy_level, last_updated, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        0,
        'new',
        JSON.stringify(factors),
        JSON.stringify([]),
        JSON.stringify(autonomyLevel),
        now,
        now,
      ]
    )
  } catch (error) {
    console.error('[TrustBuilder] Error creating initial trust score:', error)
  }

  return trustScore
}

/**
 * Record a trust event and update score
 */
export async function recordTrustEvent(
  userId: string,
  eventType: TrustEventType,
  details: Record<string, any> = {}
): Promise<TrustScore> {
  try {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const impactScore = getEventImpact(eventType, details)

    // Record the event
    await query(
      `INSERT INTO trust_events (id, user_id, event_type, details, impact_score, timestamp)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [eventId, userId, eventType, JSON.stringify(details), impactScore]
    )

    // Update factors based on event
    const currentScore = await getTrustScore(userId)
    const updatedFactors = updateFactorsForEvent(currentScore.factors, eventType, details)

    // Recalculate score
    const newScore = calculateTrustScore(updatedFactors)
    const newTier = getTrustTier(newScore)

    // Check for new milestones
    const newMilestones = checkForNewMilestones(
      currentScore.milestones,
      updatedFactors,
      currentScore.autonomyLevel
    )

    const allMilestones = [...currentScore.milestones, ...newMilestones]

    // Update trust score
    await query(
      `UPDATE user_trust_scores
       SET score = $2,
           tier = $3,
           factors = $4,
           milestones = $5,
           last_updated = NOW()
       WHERE user_id = $1`,
      [
        userId,
        newScore,
        newTier,
        JSON.stringify(updatedFactors),
        JSON.stringify(allMilestones),
      ]
    )

    return {
      ...currentScore,
      score: newScore,
      tier: newTier,
      factors: updatedFactors,
      milestones: allMilestones,
      lastUpdated: new Date(),
    }
  } catch (error) {
    console.error('[TrustBuilder] Error recording trust event:', error)
    return await getTrustScore(userId)
  }
}

/**
 * Get impact score for an event type
 */
function getEventImpact(eventType: TrustEventType, details: Record<string, any>): number {
  const impacts: Record<TrustEventType, number> = {
    deal_completed: 3,
    deal_failed: -2,
    insight_acted_upon: 2,
    insight_dismissed: -0.5,
    insight_successful: 4,
    positive_feedback: 2,
    negative_feedback: -3,
    autonomy_granted: 5,
    autonomy_revoked: -5,
    referral_made: 3,
    integration_connected: 2,
    conversation_deep: 1,
    money_saved: 2,
    money_earned: 2,
    risk_avoided: 3,
  }

  let impact = impacts[eventType] || 0

  // Scale based on value for monetary events
  if (['deal_completed', 'money_saved', 'money_earned', 'risk_avoided'].includes(eventType)) {
    const value = details.value || 0
    if (value > 10000) impact *= 1.5
    if (value > 50000) impact *= 2
    if (value > 100000) impact *= 2.5
  }

  return impact
}

/**
 * Update factors based on event
 */
function updateFactorsForEvent(
  factors: TrustFactors,
  eventType: TrustEventType,
  details: Record<string, any>
): TrustFactors {
  const updated = { ...factors }

  switch (eventType) {
    case 'deal_completed':
      updated.successfulDeals += 1
      updated.totalDealValue += details.value || 0
      updated.dealSuccessRate = calculateRate(
        updated.successfulDeals,
        updated.successfulDeals + updated.failedDeals
      )
      break

    case 'deal_failed':
      updated.failedDeals += 1
      updated.dealSuccessRate = calculateRate(
        updated.successfulDeals,
        updated.successfulDeals + updated.failedDeals
      )
      break

    case 'insight_acted_upon':
      updated.insightsActedUpon += 1
      updated.insightSuccessRate = calculateRate(
        updated.insightsActedUpon,
        updated.insightsActedUpon + updated.insightsDismissed
      )
      break

    case 'insight_dismissed':
      updated.insightsDismissed += 1
      updated.insightSuccessRate = calculateRate(
        updated.insightsActedUpon,
        updated.insightsActedUpon + updated.insightsDismissed
      )
      break

    case 'insight_successful':
      // Boost success rate when acted-upon insights succeed
      updated.insightSuccessRate = Math.min(100, updated.insightSuccessRate + 2)
      break

    case 'positive_feedback':
      updated.positiveRatings += 1
      updated.feedbackScore = calculateRate(
        updated.positiveRatings,
        updated.positiveRatings + updated.negativeRatings
      )
      break

    case 'negative_feedback':
      updated.negativeRatings += 1
      updated.feedbackScore = calculateRate(
        updated.positiveRatings,
        updated.positiveRatings + updated.negativeRatings
      )
      break

    case 'money_saved':
      updated.moneySaved += details.value || 0
      break

    case 'money_earned':
      updated.moneyEarned += details.value || 0
      break

    case 'risk_avoided':
      updated.risksAvoided += 1
      updated.riskValueAvoided += details.value || 0
      break

    case 'referral_made':
      updated.referralsMade += 1
      break

    case 'integration_connected':
      updated.integrationConnections += 1
      break

    case 'conversation_deep':
      updated.conversationDepth = Math.min(100, updated.conversationDepth + 5)
      break
  }

  updated.totalInteractions += 1
  return updated
}

/**
 * Calculate percentage rate
 */
function calculateRate(successes: number, total: number): number {
  if (total === 0) return 0
  return Math.round((successes / total) * 100)
}

/**
 * Check for new milestones achieved
 */
function checkForNewMilestones(
  currentMilestones: TrustMilestone[],
  factors: TrustFactors,
  autonomy: AutonomySettings
): TrustMilestone[] {
  const achievedIds = new Set(currentMilestones.map((m) => m.id))
  const newMilestones: TrustMilestone[] = []
  const now = new Date()

  // Check each potential milestone
  if (!achievedIds.has('first_conversation') && factors.totalInteractions >= 1) {
    newMilestones.push({
      id: 'first_conversation',
      ...MILESTONES.first_conversation,
      achievedAt: now,
    })
  }

  if (!achievedIds.has('first_deal') && factors.successfulDeals >= 1) {
    newMilestones.push({
      id: 'first_deal',
      ...MILESTONES.first_deal,
      achievedAt: now,
    })
  }

  if (!achievedIds.has('ten_deals') && factors.successfulDeals >= 10) {
    newMilestones.push({
      id: 'ten_deals',
      ...MILESTONES.ten_deals,
      achievedAt: now,
    })
  }

  if (!achievedIds.has('first_thousand_saved') && factors.moneySaved >= 1000) {
    newMilestones.push({
      id: 'first_thousand_saved',
      ...MILESTONES.first_thousand_saved,
      achievedAt: now,
    })
  }

  if (!achievedIds.has('ten_thousand_saved') && factors.moneySaved >= 10000) {
    newMilestones.push({
      id: 'ten_thousand_saved',
      ...MILESTONES.ten_thousand_saved,
      achievedAt: now,
    })
  }

  if (!achievedIds.has('hundred_thousand_saved') && factors.moneySaved >= 100000) {
    newMilestones.push({
      id: 'hundred_thousand_saved',
      ...MILESTONES.hundred_thousand_saved,
      achievedAt: now,
    })
  }

  if (!achievedIds.has('first_autonomy') && (autonomy.autoApproveDeals || autonomy.autoNegotiate)) {
    newMilestones.push({
      id: 'first_autonomy',
      ...MILESTONES.first_autonomy,
      achievedAt: now,
    })
  }

  if (!achievedIds.has('full_autonomy') &&
      autonomy.autoApproveDeals &&
      autonomy.autoNegotiate &&
      autonomy.autoRespondToRfqs &&
      autonomy.proactiveOutreach) {
    newMilestones.push({
      id: 'full_autonomy',
      ...MILESTONES.full_autonomy,
      achievedAt: now,
    })
  }

  if (!achievedIds.has('first_referral') && factors.referralsMade >= 1) {
    newMilestones.push({
      id: 'first_referral',
      ...MILESTONES.first_referral,
      achievedAt: now,
    })
  }

  if (!achievedIds.has('integration_pioneer') && factors.integrationConnections >= 5) {
    newMilestones.push({
      id: 'integration_pioneer',
      ...MILESTONES.integration_pioneer,
      achievedAt: now,
    })
  }

  if (!achievedIds.has('thirty_day_streak') && factors.daysActive >= 30) {
    newMilestones.push({
      id: 'thirty_day_streak',
      ...MILESTONES.thirty_day_streak,
      achievedAt: now,
    })
  }

  if (!achievedIds.has('insight_master') && factors.insightsActedUpon >= 50) {
    newMilestones.push({
      id: 'insight_master',
      ...MILESTONES.insight_master,
      achievedAt: now,
    })
  }

  return newMilestones
}

// ============================================================================
// AUTONOMY MANAGEMENT
// ============================================================================

/**
 * Update autonomy settings
 */
export async function updateAutonomy(
  userId: string,
  updates: Partial<AutonomySettings>
): Promise<AutonomySettings> {
  try {
    const currentScore = await getTrustScore(userId)
    const updatedAutonomy = { ...currentScore.autonomyLevel, ...updates }

    await query(
      `UPDATE user_trust_scores
       SET autonomy_level = $2,
           last_updated = NOW()
       WHERE user_id = $1`,
      [userId, JSON.stringify(updatedAutonomy)]
    )

    // Record the event
    if (isGrantingMoreAutonomy(currentScore.autonomyLevel, updatedAutonomy)) {
      await recordTrustEvent(userId, 'autonomy_granted', {
        previous: currentScore.autonomyLevel,
        new: updatedAutonomy,
      })
    } else if (isRevokingAutonomy(currentScore.autonomyLevel, updatedAutonomy)) {
      await recordTrustEvent(userId, 'autonomy_revoked', {
        previous: currentScore.autonomyLevel,
        new: updatedAutonomy,
      })
    }

    return updatedAutonomy
  } catch (error) {
    console.error('[TrustBuilder] Error updating autonomy:', error)
    throw error
  }
}

/**
 * Check if user has permission for an action
 */
export async function checkAutonomy(
  userId: string,
  action: string,
  value?: number
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const trustScore = await getTrustScore(userId)
    const autonomy = trustScore.autonomyLevel

    switch (action) {
      case 'negotiate':
        if (!autonomy.autoNegotiate) {
          return { allowed: false, reason: 'Auto-negotiate not enabled' }
        }
        if (value && value > autonomy.autoNegotiateMaxValue) {
          return { allowed: false, reason: `Value exceeds auto-negotiate limit of $${autonomy.autoNegotiateMaxValue}` }
        }
        return { allowed: true }

      case 'approve_deal':
        if (!autonomy.autoApproveDeals) {
          return { allowed: false, reason: 'Auto-approve not enabled' }
        }
        if (value && value > autonomy.autoApproveThreshold) {
          return { allowed: false, reason: `Value exceeds auto-approve threshold of $${autonomy.autoApproveThreshold}` }
        }
        return { allowed: true }

      case 'respond_rfq':
        if (!autonomy.autoRespondToRfqs) {
          return { allowed: false, reason: 'Auto-respond to RFQs not enabled' }
        }
        return { allowed: true }

      case 'apply_job':
        if (!autonomy.autoApplyToJobs) {
          return { allowed: false, reason: 'Auto-apply to jobs not enabled' }
        }
        return { allowed: true }

      case 'proactive_outreach':
        if (!autonomy.proactiveOutreach) {
          return { allowed: false, reason: 'Proactive outreach not enabled' }
        }
        return { allowed: true }

      default:
        return { allowed: false, reason: 'Unknown action' }
    }
  } catch (error) {
    console.error('[TrustBuilder] Error checking autonomy:', error)
    return { allowed: false, reason: 'Error checking permissions' }
  }
}

/**
 * Get recommended autonomy based on trust score
 */
export function getRecommendedAutonomy(trustScore: TrustScore): AutonomySettings {
  const { score, tier } = trustScore

  if (tier === 'partner') {
    return {
      autoNegotiate: true,
      autoNegotiateMaxValue: 100000,
      autoApproveDeals: true,
      autoApproveThreshold: 50000,
      autoRespondToRfqs: true,
      autoApplyToJobs: true,
      proactiveOutreach: true,
      proactiveOutreachTypes: ['follow_up', 'opportunity', 'risk_alert'],
      approvalRequired: [],
    }
  }

  if (tier === 'trusted') {
    return {
      autoNegotiate: true,
      autoNegotiateMaxValue: 25000,
      autoApproveDeals: true,
      autoApproveThreshold: 10000,
      autoRespondToRfqs: true,
      autoApplyToJobs: false,
      proactiveOutreach: true,
      proactiveOutreachTypes: ['follow_up', 'risk_alert'],
      approvalRequired: [
        { action: 'large_deals', threshold: 10000, reason: 'Deals over $10K require approval' },
      ],
    }
  }

  if (tier === 'developing') {
    return {
      autoNegotiate: false,
      autoNegotiateMaxValue: 0,
      autoApproveDeals: true,
      autoApproveThreshold: 1000,
      autoRespondToRfqs: false,
      autoApplyToJobs: false,
      proactiveOutreach: true,
      proactiveOutreachTypes: ['risk_alert'],
      approvalRequired: [
        { action: 'negotiations', reason: 'All negotiations require approval' },
        { action: 'rfq_responses', reason: 'RFQ responses require approval' },
      ],
    }
  }

  // New tier
  return getDefaultAutonomy()
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDefaultFactors(): TrustFactors {
  return {
    totalInteractions: 0,
    daysActive: 0,
    averageSessionLength: 0,
    conversationDepth: 0,
    successfulDeals: 0,
    failedDeals: 0,
    totalDealValue: 0,
    dealSuccessRate: 0,
    moneySaved: 0,
    moneyEarned: 0,
    timesSaved: 0,
    risksAvoided: 0,
    riskValueAvoided: 0,
    insightsGenerated: 0,
    insightsActedUpon: 0,
    insightsDismissed: 0,
    insightSuccessRate: 0,
    positiveRatings: 0,
    negativeRatings: 0,
    feedbackScore: 0,
    referralsMade: 0,
    featuresExplored: 0,
    integrationConnections: 0,
  }
}

function getDefaultAutonomy(): AutonomySettings {
  return {
    autoNegotiate: false,
    autoNegotiateMaxValue: 0,
    autoApproveDeals: false,
    autoApproveThreshold: 0,
    autoRespondToRfqs: false,
    autoApplyToJobs: false,
    proactiveOutreach: false,
    proactiveOutreachTypes: [],
    approvalRequired: [
      { action: 'all', reason: 'All actions require approval for new users' },
    ],
  }
}

function getDefaultTrustScore(userId: string): TrustScore {
  return {
    userId,
    score: 0,
    tier: 'new',
    factors: getDefaultFactors(),
    milestones: [],
    autonomyLevel: getDefaultAutonomy(),
    lastUpdated: new Date(),
    createdAt: new Date(),
  }
}

function isGrantingMoreAutonomy(
  previous: AutonomySettings,
  current: AutonomySettings
): boolean {
  return (
    (!previous.autoNegotiate && current.autoNegotiate) ||
    (!previous.autoApproveDeals && current.autoApproveDeals) ||
    (!previous.autoRespondToRfqs && current.autoRespondToRfqs) ||
    (!previous.autoApplyToJobs && current.autoApplyToJobs) ||
    (!previous.proactiveOutreach && current.proactiveOutreach) ||
    current.autoApproveThreshold > previous.autoApproveThreshold ||
    current.autoNegotiateMaxValue > previous.autoNegotiateMaxValue
  )
}

function isRevokingAutonomy(
  previous: AutonomySettings,
  current: AutonomySettings
): boolean {
  return (
    (previous.autoNegotiate && !current.autoNegotiate) ||
    (previous.autoApproveDeals && !current.autoApproveDeals) ||
    (previous.autoRespondToRfqs && !current.autoRespondToRfqs) ||
    (previous.autoApplyToJobs && !current.autoApplyToJobs) ||
    (previous.proactiveOutreach && !current.proactiveOutreach) ||
    current.autoApproveThreshold < previous.autoApproveThreshold ||
    current.autoNegotiateMaxValue < previous.autoNegotiateMaxValue
  )
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Get human-readable tier description
 */
export function getTierDescription(tier: TrustTier): string {
  const descriptions: Record<TrustTier, string> = {
    new: 'Just getting started. Wells is learning about you.',
    developing: 'Building trust. Wells is becoming more helpful.',
    trusted: 'Strong partnership. Wells can act more autonomously.',
    partner: 'Full trust. Wells is your autonomous AI partner.',
  }
  return descriptions[tier]
}

/**
 * Get tier color for UI
 */
export function getTierColor(tier: TrustTier): string {
  const colors: Record<TrustTier, string> = {
    new: '#6b7280', // gray
    developing: '#3b82f6', // blue
    trusted: '#8b5cf6', // purple
    partner: '#f59e0b', // amber/gold
  }
  return colors[tier]
}

/**
 * Format trust summary for display
 */
export function formatTrustSummary(trustScore: TrustScore): string {
  const { score, tier, factors, milestones } = trustScore

  const parts: string[] = []

  parts.push(`Trust Score: ${score}/100 (${tier.charAt(0).toUpperCase() + tier.slice(1)})`)

  if (factors.successfulDeals > 0) {
    parts.push(`${factors.successfulDeals} successful deals`)
  }

  if (factors.moneySaved > 0) {
    parts.push(`$${factors.moneySaved.toLocaleString()} saved`)
  }

  if (factors.moneyEarned > 0) {
    parts.push(`$${factors.moneyEarned.toLocaleString()} earned`)
  }

  if (milestones.length > 0) {
    parts.push(`${milestones.length} milestones achieved`)
  }

  return parts.join(' | ')
}

// ============================================================================
// EXPORTS
// ============================================================================

export const TrustBuilder = {
  getTrustScore,
  recordTrustEvent,
  updateAutonomy,
  checkAutonomy,
  getRecommendedAutonomy,
  calculateTrustScore,
  getTrustTier,
  getTierDescription,
  getTierColor,
  formatTrustSummary,
}

export default TrustBuilder
