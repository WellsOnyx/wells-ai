// @ts-nocheck
/**
 * Wells AI Relationship Deepening System
 *
 * "As iron sharpens iron, so one person sharpens another." - Proverbs 27:17
 *
 * This module tracks and deepens the relationship between Wells and the user.
 * Like Ghost from Destiny, Wells earns trust over time - more autonomy,
 * more initiative, deeper partnership.
 */

import { query } from '@/lib/db'
import { getWellsMemory } from '@/lib/wells-memory'
import { getDeepMemory, recordLearning } from './memory'

// ============================================================================
// TYPES
// ============================================================================

export interface CompanionRelationship {
  userId: string

  // Core trust metrics
  trustScore: number // 0-100
  trustTier: TrustTier

  // Relationship timeline
  firstInteraction: Date
  daysTogether: number
  totalInteractions: number
  averageSessionLength: number // minutes

  // Value delivered
  totalValueDelivered: number
  valueBreakdown: {
    savings: number
    revenue: number
    timeHours: number
    opportunitiesFound: number
    risksAverted: number
  }

  // Autonomy levels
  autonomy: AutonomyConfig

  // Relationship health
  health: RelationshipHealth
  milestones: RelationshipMilestone[]

  // User engagement
  engagement: EngagementMetrics

  // Last updated
  lastUpdated: Date
}

export type TrustTier =
  | 'new_acquaintance' // Just met, very cautious
  | 'developing' // Getting to know each other
  | 'established' // Solid working relationship
  | 'trusted_partner' // High trust, more autonomy
  | 'guardian' // Maximum trust, Wells acts proactively

export interface AutonomyConfig {
  // What Wells can do without asking
  canAutoNegotiate: boolean
  autoApproveThreshold: number // Dollar amount
  canAutoRespondToRfqs: boolean
  canAutoApplyToJobs: boolean
  canProactivelyReachOut: boolean
  canMakeRecommendations: boolean
  canScheduleMeetings: boolean

  // What requires approval
  requiresApprovalFor: string[]

  // Communication autonomy
  canSendEmails: boolean
  canSendSms: boolean
  canPostOnBehalf: boolean

  // Financial autonomy
  spendingLimit: number
  commitmentLimit: number // Max contract value

  // Override settings
  allowedOverrideActions: string[]
}

export interface RelationshipHealth {
  status: 'thriving' | 'healthy' | 'stable' | 'needs_attention' | 'at_risk'
  factors: {
    recentInteractionQuality: number // 0-100
    insightActedUponRate: number // 0-100
    feedbackSentiment: number // -100 to 100
    responseRate: number // 0-100
    valueDeliveryRate: number // 0-100
  }
  concerns: string[]
  opportunities: string[]
  lastAssessment: Date
}

export interface RelationshipMilestone {
  id: string
  type: MilestoneType
  title: string
  description: string
  achievedAt: Date
  value?: number
  celebrated: boolean
  celebrationMessage?: string
}

export type MilestoneType =
  | 'first_interaction'
  | 'first_deal'
  | 'trust_upgrade'
  | 'value_milestone' // $1K, $10K, $100K saved
  | 'time_milestone' // 1 week, 1 month, 1 year
  | 'interaction_milestone' // 10, 50, 100 interactions
  | 'goal_achieved'
  | 'perfect_week' // 100% insight action rate
  | 'custom'

export interface EngagementMetrics {
  // Activity
  dailyActiveRate: number // % of days active in last 30
  averageResponseTime: number // minutes
  peakActivityHours: number[]
  preferredDays: string[]

  // Interaction quality
  conversationDepth: number // Average messages per session
  questionAskRate: number // How often user asks questions
  feedbackRate: number // How often user gives feedback

  // Feature usage
  mostUsedFeatures: string[]
  underutilizedFeatures: string[]
  featureAdoptionScore: number // 0-100
}

// ============================================================================
// TRUST TIER REQUIREMENTS
// ============================================================================

const TRUST_TIER_REQUIREMENTS: Record<TrustTier, {
  minScore: number
  minDays: number
  minInteractions: number
  minValueDelivered: number
  description: string
}> = {
  new_acquaintance: {
    minScore: 0,
    minDays: 0,
    minInteractions: 0,
    minValueDelivered: 0,
    description: "We're just getting started. I'll ask before taking any actions.",
  },
  developing: {
    minScore: 20,
    minDays: 3,
    minInteractions: 10,
    minValueDelivered: 100,
    description: "We're building trust. I'm learning your preferences.",
  },
  established: {
    minScore: 50,
    minDays: 14,
    minInteractions: 50,
    minValueDelivered: 1000,
    description: 'We have a solid working relationship. I know your style.',
  },
  trusted_partner: {
    minScore: 75,
    minDays: 30,
    minInteractions: 100,
    minValueDelivered: 5000,
    description: "I'm a trusted partner. I can take more initiative on your behalf.",
  },
  guardian: {
    minScore: 90,
    minDays: 90,
    minInteractions: 200,
    minValueDelivered: 25000,
    description: "I'm your guardian. I proactively protect and advance your interests.",
  },
}

const DEFAULT_AUTONOMY: Record<TrustTier, Partial<AutonomyConfig>> = {
  new_acquaintance: {
    canAutoNegotiate: false,
    autoApproveThreshold: 0,
    canAutoRespondToRfqs: false,
    canAutoApplyToJobs: false,
    canProactivelyReachOut: false,
    canMakeRecommendations: true,
    canScheduleMeetings: false,
    canSendEmails: false,
    canSendSms: false,
    canPostOnBehalf: false,
    spendingLimit: 0,
    commitmentLimit: 0,
    requiresApprovalFor: ['all'],
  },
  developing: {
    canAutoNegotiate: false,
    autoApproveThreshold: 0,
    canAutoRespondToRfqs: false,
    canAutoApplyToJobs: false,
    canProactivelyReachOut: false,
    canMakeRecommendations: true,
    canScheduleMeetings: false,
    canSendEmails: false,
    canSendSms: false,
    canPostOnBehalf: false,
    spendingLimit: 0,
    commitmentLimit: 0,
    requiresApprovalFor: ['spending', 'commitments', 'communications'],
  },
  established: {
    canAutoNegotiate: false,
    autoApproveThreshold: 100,
    canAutoRespondToRfqs: true,
    canAutoApplyToJobs: false,
    canProactivelyReachOut: true,
    canMakeRecommendations: true,
    canScheduleMeetings: false,
    canSendEmails: true,
    canSendSms: false,
    canPostOnBehalf: false,
    spendingLimit: 100,
    commitmentLimit: 1000,
    requiresApprovalFor: ['large_spending', 'commitments', 'external_comms'],
  },
  trusted_partner: {
    canAutoNegotiate: true,
    autoApproveThreshold: 500,
    canAutoRespondToRfqs: true,
    canAutoApplyToJobs: true,
    canProactivelyReachOut: true,
    canMakeRecommendations: true,
    canScheduleMeetings: true,
    canSendEmails: true,
    canSendSms: true,
    canPostOnBehalf: false,
    spendingLimit: 500,
    commitmentLimit: 5000,
    requiresApprovalFor: ['major_commitments', 'external_posts'],
  },
  guardian: {
    canAutoNegotiate: true,
    autoApproveThreshold: 2500,
    canAutoRespondToRfqs: true,
    canAutoApplyToJobs: true,
    canProactivelyReachOut: true,
    canMakeRecommendations: true,
    canScheduleMeetings: true,
    canSendEmails: true,
    canSendSms: true,
    canPostOnBehalf: true,
    spendingLimit: 2500,
    commitmentLimit: 25000,
    requiresApprovalFor: ['major_financial_decisions'],
  },
}

// ============================================================================
// RELATIONSHIP MANAGEMENT
// ============================================================================

/**
 * Get the companion relationship for a user
 */
export async function getCompanionRelationship(userId: string): Promise<CompanionRelationship> {
  try {
    const result = await query(
      `SELECT * FROM companion_relationships WHERE user_id = $1`,
      [userId]
    )

    if (result.rows.length > 0) {
      return rowToRelationship(result.rows[0])
    }

    // Initialize new relationship
    return await initializeRelationship(userId)
  } catch (error) {
    console.error('[Relationship] Error getting relationship:', error)
    return createDefaultRelationship(userId)
  }
}

/**
 * Initialize a new relationship
 */
async function initializeRelationship(userId: string): Promise<CompanionRelationship> {
  const relationship = createDefaultRelationship(userId)

  try {
    await query(
      `INSERT INTO companion_relationships (
        user_id, trust_score, trust_tier, first_interaction, days_together,
        total_interactions, average_session_length, total_value_delivered,
        value_breakdown, autonomy, health, milestones, engagement, last_updated
      ) VALUES ($1, $2, $3, NOW(), 0, 0, 0, 0, $4, $5, $6, $7, $8, NOW())`,
      [
        userId,
        relationship.trustScore,
        relationship.trustTier,
        JSON.stringify(relationship.valueBreakdown),
        JSON.stringify(relationship.autonomy),
        JSON.stringify(relationship.health),
        JSON.stringify(relationship.milestones),
        JSON.stringify(relationship.engagement),
      ]
    )

    // Add first milestone
    await addMilestone(userId, {
      type: 'first_interaction',
      title: 'Our journey begins',
      description: "The start of a great partnership. I'm here to help you succeed.",
    })

    return relationship
  } catch (error) {
    console.error('[Relationship] Error initializing relationship:', error)
    return relationship
  }
}

/**
 * Record an interaction and update relationship metrics
 */
export async function recordInteraction(
  userId: string,
  interaction: {
    type: 'chat' | 'action' | 'insight_response' | 'feedback'
    quality?: number // 0-100
    duration?: number // minutes
    insightActedUpon?: boolean
    valueDelivered?: number
    valueType?: 'savings' | 'revenue' | 'time' | 'opportunity' | 'risk'
  }
): Promise<void> {
  try {
    // Get current relationship
    const relationship = await getCompanionRelationship(userId)

    // Update interaction count
    const newInteractionCount = relationship.totalInteractions + 1

    // Update session length average
    const totalSessionTime = relationship.averageSessionLength * relationship.totalInteractions
    const newAverageSession = (totalSessionTime + (interaction.duration || 5)) / newInteractionCount

    // Update value delivered
    let newValueDelivered = relationship.totalValueDelivered
    const newValueBreakdown = { ...relationship.valueBreakdown }

    if (interaction.valueDelivered && interaction.valueType) {
      newValueDelivered += interaction.valueDelivered

      switch (interaction.valueType) {
        case 'savings':
          newValueBreakdown.savings += interaction.valueDelivered
          break
        case 'revenue':
          newValueBreakdown.revenue += interaction.valueDelivered
          break
        case 'time':
          newValueBreakdown.timeHours += interaction.valueDelivered
          break
        case 'opportunity':
          newValueBreakdown.opportunitiesFound++
          break
        case 'risk':
          newValueBreakdown.risksAverted++
          break
      }
    }

    // Calculate trust score change
    let trustChange = 0

    if (interaction.quality) {
      trustChange += (interaction.quality - 50) / 50 // -1 to +1 based on quality
    }

    if (interaction.insightActedUpon !== undefined) {
      trustChange += interaction.insightActedUpon ? 0.5 : -0.2
    }

    if (interaction.valueDelivered && interaction.valueDelivered > 0) {
      trustChange += Math.min(1, interaction.valueDelivered / 1000) // Up to +1 for $1000+ value
    }

    const newTrustScore = Math.max(0, Math.min(100, relationship.trustScore + trustChange))

    // Calculate days together
    const daysTogether = Math.floor(
      (Date.now() - relationship.firstInteraction.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Determine new trust tier
    const newTier = calculateTrustTier(
      newTrustScore,
      daysTogether,
      newInteractionCount,
      newValueDelivered
    )

    // Check for tier upgrade
    if (newTier !== relationship.trustTier) {
      const tierOrder: TrustTier[] = ['new_acquaintance', 'developing', 'established', 'trusted_partner', 'guardian']
      if (tierOrder.indexOf(newTier) > tierOrder.indexOf(relationship.trustTier)) {
        await addMilestone(userId, {
          type: 'trust_upgrade',
          title: `Trust Level Upgraded to ${formatTierName(newTier)}`,
          description: TRUST_TIER_REQUIREMENTS[newTier].description,
        })
      }
    }

    // Check for value milestones
    await checkValueMilestones(userId, relationship.totalValueDelivered, newValueDelivered)

    // Check for interaction milestones
    await checkInteractionMilestones(userId, relationship.totalInteractions, newInteractionCount)

    // Update autonomy based on new tier
    const newAutonomy = { ...relationship.autonomy, ...DEFAULT_AUTONOMY[newTier] }

    // Update in database
    await query(
      `UPDATE companion_relationships SET
        trust_score = $2,
        trust_tier = $3,
        days_together = $4,
        total_interactions = $5,
        average_session_length = $6,
        total_value_delivered = $7,
        value_breakdown = $8,
        autonomy = $9,
        last_updated = NOW()
       WHERE user_id = $1`,
      [
        userId,
        newTrustScore,
        newTier,
        daysTogether,
        newInteractionCount,
        newAverageSession,
        newValueDelivered,
        JSON.stringify(newValueBreakdown),
        JSON.stringify(newAutonomy),
      ]
    )

    // Record as learning
    if (interaction.quality && interaction.quality > 80) {
      await recordLearning(userId, {
        category: 'feedback',
        description: `User responded positively to ${interaction.type} interaction`,
        confidence: 70,
        source: 'observed',
      })
    }
  } catch (error) {
    console.error('[Relationship] Error recording interaction:', error)
  }
}

/**
 * Check if Wells can take an action autonomously
 */
export async function canActAutonomously(
  userId: string,
  action: {
    type: 'negotiate' | 'approve' | 'respond' | 'apply' | 'reach_out' | 'schedule' | 'send_email' | 'send_sms' | 'post' | 'spend' | 'commit'
    value?: number
    details?: string
  }
): Promise<{
  allowed: boolean
  reason: string
  requiresApproval: boolean
  tierRequired?: TrustTier
}> {
  try {
    const relationship = await getCompanionRelationship(userId)
    const autonomy = relationship.autonomy

    switch (action.type) {
      case 'negotiate':
        if (!autonomy.canAutoNegotiate) {
          return {
            allowed: false,
            reason: "I need your approval to negotiate on your behalf. We're still building trust.",
            requiresApproval: true,
            tierRequired: 'trusted_partner',
          }
        }
        return { allowed: true, reason: "I'm authorized to negotiate for you.", requiresApproval: false }

      case 'approve':
        if (action.value && action.value > autonomy.autoApproveThreshold) {
          return {
            allowed: false,
            reason: `This amount ($${action.value.toLocaleString()}) exceeds my auto-approval limit of $${autonomy.autoApproveThreshold.toLocaleString()}.`,
            requiresApproval: true,
          }
        }
        return { allowed: true, reason: 'Within my approval authority.', requiresApproval: false }

      case 'respond':
        if (!autonomy.canAutoRespondToRfqs) {
          return {
            allowed: false,
            reason: 'I need your approval to respond to RFQs.',
            requiresApproval: true,
            tierRequired: 'established',
          }
        }
        return { allowed: true, reason: 'Authorized to respond to RFQs.', requiresApproval: false }

      case 'apply':
        if (!autonomy.canAutoApplyToJobs) {
          return {
            allowed: false,
            reason: 'I need your approval to apply to jobs on your behalf.',
            requiresApproval: true,
            tierRequired: 'trusted_partner',
          }
        }
        return { allowed: true, reason: 'Authorized to apply to matching jobs.', requiresApproval: false }

      case 'reach_out':
        if (!autonomy.canProactivelyReachOut) {
          return {
            allowed: false,
            reason: "I'll wait for you to initiate contact. We're still building trust.",
            requiresApproval: true,
            tierRequired: 'established',
          }
        }
        return { allowed: true, reason: 'Authorized to proactively reach out.', requiresApproval: false }

      case 'schedule':
        if (!autonomy.canScheduleMeetings) {
          return {
            allowed: false,
            reason: 'I need your approval to schedule meetings.',
            requiresApproval: true,
            tierRequired: 'trusted_partner',
          }
        }
        return { allowed: true, reason: 'Authorized to schedule meetings.', requiresApproval: false }

      case 'send_email':
        if (!autonomy.canSendEmails) {
          return {
            allowed: false,
            reason: 'I need your approval to send emails on your behalf.',
            requiresApproval: true,
            tierRequired: 'established',
          }
        }
        return { allowed: true, reason: 'Authorized to send emails.', requiresApproval: false }

      case 'send_sms':
        if (!autonomy.canSendSms) {
          return {
            allowed: false,
            reason: 'I need your approval to send text messages.',
            requiresApproval: true,
            tierRequired: 'trusted_partner',
          }
        }
        return { allowed: true, reason: 'Authorized to send SMS.', requiresApproval: false }

      case 'post':
        if (!autonomy.canPostOnBehalf) {
          return {
            allowed: false,
            reason: 'I need your approval to post on your behalf.',
            requiresApproval: true,
            tierRequired: 'guardian',
          }
        }
        return { allowed: true, reason: 'Authorized to post on your behalf.', requiresApproval: false }

      case 'spend':
        if (action.value && action.value > autonomy.spendingLimit) {
          return {
            allowed: false,
            reason: `This exceeds my spending limit of $${autonomy.spendingLimit.toLocaleString()}.`,
            requiresApproval: true,
          }
        }
        return { allowed: true, reason: 'Within spending authority.', requiresApproval: false }

      case 'commit':
        if (action.value && action.value > autonomy.commitmentLimit) {
          return {
            allowed: false,
            reason: `This commitment ($${action.value.toLocaleString()}) exceeds my limit of $${autonomy.commitmentLimit.toLocaleString()}.`,
            requiresApproval: true,
          }
        }
        return { allowed: true, reason: 'Within commitment authority.', requiresApproval: false }

      default:
        return {
          allowed: false,
          reason: 'Unknown action type. I\'ll ask for approval to be safe.',
          requiresApproval: true,
        }
    }
  } catch (error) {
    console.error('[Relationship] Error checking autonomy:', error)
    return {
      allowed: false,
      reason: 'Unable to verify authorization. Please approve this action.',
      requiresApproval: true,
    }
  }
}

/**
 * Grant additional autonomy (user-initiated)
 */
export async function grantAutonomy(
  userId: string,
  grants: Partial<AutonomyConfig>
): Promise<void> {
  try {
    const relationship = await getCompanionRelationship(userId)
    const newAutonomy = { ...relationship.autonomy, ...grants }

    await query(
      `UPDATE companion_relationships SET autonomy = $2, last_updated = NOW() WHERE user_id = $1`,
      [userId, JSON.stringify(newAutonomy)]
    )

    // Record the trust grant
    await recordLearning(userId, {
      category: 'preference',
      description: `User granted additional autonomy: ${Object.keys(grants).join(', ')}`,
      confidence: 100,
      source: 'explicit',
    })
  } catch (error) {
    console.error('[Relationship] Error granting autonomy:', error)
  }
}

/**
 * Add a relationship milestone
 */
export async function addMilestone(
  userId: string,
  milestone: Omit<RelationshipMilestone, 'id' | 'achievedAt' | 'celebrated' | 'celebrationMessage'>
): Promise<void> {
  const milestoneId = `mile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const celebrationMessage = generateCelebrationMessage(milestone.type, milestone.title)

  try {
    await query(
      `UPDATE companion_relationships SET
        milestones = milestones || $2::jsonb,
        last_updated = NOW()
       WHERE user_id = $1`,
      [
        userId,
        JSON.stringify([{
          id: milestoneId,
          ...milestone,
          achievedAt: new Date(),
          celebrated: false,
          celebrationMessage,
        }]),
      ]
    )
  } catch (error) {
    console.error('[Relationship] Error adding milestone:', error)
  }
}

/**
 * Get uncelebrated milestones
 */
export async function getUncelebratedMilestones(userId: string): Promise<RelationshipMilestone[]> {
  try {
    const relationship = await getCompanionRelationship(userId)
    return relationship.milestones.filter((m) => !m.celebrated)
  } catch (error) {
    console.error('[Relationship] Error getting uncelebrated milestones:', error)
    return []
  }
}

/**
 * Mark milestone as celebrated
 */
export async function celebrateMilestone(userId: string, milestoneId: string): Promise<void> {
  try {
    const relationship = await getCompanionRelationship(userId)
    const updatedMilestones = relationship.milestones.map((m) =>
      m.id === milestoneId ? { ...m, celebrated: true } : m
    )

    await query(
      `UPDATE companion_relationships SET milestones = $2, last_updated = NOW() WHERE user_id = $1`,
      [userId, JSON.stringify(updatedMilestones)]
    )
  } catch (error) {
    console.error('[Relationship] Error celebrating milestone:', error)
  }
}

/**
 * Assess relationship health
 */
export async function assessRelationshipHealth(userId: string): Promise<RelationshipHealth> {
  try {
    const relationship = await getCompanionRelationship(userId)
    const memory = await getDeepMemory(userId)

    // Calculate factors
    const recentInteractionQuality = await calculateRecentInteractionQuality(userId)
    const insightActedUponRate = await calculateInsightActedUponRate(userId)
    const feedbackSentiment = await calculateFeedbackSentiment(userId)
    const responseRate = await calculateResponseRate(userId)
    const valueDeliveryRate = await calculateValueDeliveryRate(userId)

    // Determine concerns and opportunities
    const concerns: string[] = []
    const opportunities: string[] = []

    if (recentInteractionQuality < 50) {
      concerns.push('Recent interactions have been less satisfying')
    }
    if (insightActedUponRate < 30) {
      concerns.push('Insights are not being acted upon')
    }
    if (responseRate < 50) {
      concerns.push('Low response rate to notifications')
    }
    if (relationship.daysTogether > 30 && relationship.trustTier === 'developing') {
      concerns.push('Trust has not progressed in a while')
    }

    if (valueDeliveryRate > 80) {
      opportunities.push('High value delivery - consider expanding scope')
    }
    if (insightActedUponRate > 70) {
      opportunities.push('User values insights - increase proactivity')
    }
    if (relationship.totalValueDelivered > 5000 && !relationship.autonomy.canAutoNegotiate) {
      opportunities.push('Consider requesting negotiation autonomy')
    }

    // Calculate overall status
    const avgScore = (recentInteractionQuality + insightActedUponRate + (feedbackSentiment + 100) / 2 + responseRate + valueDeliveryRate) / 5
    let status: RelationshipHealth['status'] = 'stable'

    if (avgScore >= 80) status = 'thriving'
    else if (avgScore >= 60) status = 'healthy'
    else if (avgScore >= 40) status = 'stable'
    else if (avgScore >= 20) status = 'needs_attention'
    else status = 'at_risk'

    const health: RelationshipHealth = {
      status,
      factors: {
        recentInteractionQuality,
        insightActedUponRate,
        feedbackSentiment,
        responseRate,
        valueDeliveryRate,
      },
      concerns,
      opportunities,
      lastAssessment: new Date(),
    }

    // Update in database
    await query(
      `UPDATE companion_relationships SET health = $2, last_updated = NOW() WHERE user_id = $1`,
      [userId, JSON.stringify(health)]
    )

    return health
  } catch (error) {
    console.error('[Relationship] Error assessing health:', error)
    return {
      status: 'stable',
      factors: {
        recentInteractionQuality: 50,
        insightActedUponRate: 50,
        feedbackSentiment: 0,
        responseRate: 50,
        valueDeliveryRate: 50,
      },
      concerns: [],
      opportunities: [],
      lastAssessment: new Date(),
    }
  }
}

/**
 * Get relationship summary for chat context
 */
export async function getRelationshipContext(userId: string): Promise<string> {
  try {
    const relationship = await getCompanionRelationship(userId)

    const lines: string[] = []

    lines.push(`=== WELLS-USER RELATIONSHIP ===`)
    lines.push(`Trust Level: ${formatTierName(relationship.trustTier)} (${relationship.trustScore}/100)`)
    lines.push(`Days Together: ${relationship.daysTogether}`)
    lines.push(`Total Interactions: ${relationship.totalInteractions}`)
    lines.push(`Value Delivered: $${relationship.totalValueDelivered.toLocaleString()}`)
    lines.push('')

    lines.push(`=== AUTONOMY ===`)
    if (relationship.autonomy.canAutoNegotiate) {
      lines.push('- Can negotiate automatically')
    }
    if (relationship.autonomy.autoApproveThreshold > 0) {
      lines.push(`- Can auto-approve up to $${relationship.autonomy.autoApproveThreshold}`)
    }
    if (relationship.autonomy.canProactivelyReachOut) {
      lines.push('- Can proactively reach out')
    }
    if (relationship.autonomy.canSendEmails) {
      lines.push('- Can send emails on behalf')
    }
    lines.push('')

    lines.push(`=== RELATIONSHIP GUIDANCE ===`)
    lines.push(TRUST_TIER_REQUIREMENTS[relationship.trustTier].description)

    if (relationship.health.concerns.length > 0) {
      lines.push('')
      lines.push('Concerns to address:')
      relationship.health.concerns.forEach((c) => lines.push(`- ${c}`))
    }

    return lines.join('\n')
  } catch (error) {
    console.error('[Relationship] Error getting context:', error)
    return ''
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateTrustTier(
  score: number,
  days: number,
  interactions: number,
  value: number
): TrustTier {
  const tiers: TrustTier[] = ['guardian', 'trusted_partner', 'established', 'developing', 'new_acquaintance']

  for (const tier of tiers) {
    const req = TRUST_TIER_REQUIREMENTS[tier]
    if (
      score >= req.minScore &&
      days >= req.minDays &&
      interactions >= req.minInteractions &&
      value >= req.minValueDelivered
    ) {
      return tier
    }
  }

  return 'new_acquaintance'
}

function formatTierName(tier: TrustTier): string {
  const names: Record<TrustTier, string> = {
    new_acquaintance: 'New Acquaintance',
    developing: 'Developing',
    established: 'Established',
    trusted_partner: 'Trusted Partner',
    guardian: 'Guardian',
  }
  return names[tier]
}

function createDefaultRelationship(userId: string): CompanionRelationship {
  return {
    userId,
    trustScore: 10,
    trustTier: 'new_acquaintance',
    firstInteraction: new Date(),
    daysTogether: 0,
    totalInteractions: 0,
    averageSessionLength: 0,
    totalValueDelivered: 0,
    valueBreakdown: {
      savings: 0,
      revenue: 0,
      timeHours: 0,
      opportunitiesFound: 0,
      risksAverted: 0,
    },
    autonomy: {
      canAutoNegotiate: false,
      autoApproveThreshold: 0,
      canAutoRespondToRfqs: false,
      canAutoApplyToJobs: false,
      canProactivelyReachOut: false,
      canMakeRecommendations: true,
      canScheduleMeetings: false,
      canSendEmails: false,
      canSendSms: false,
      canPostOnBehalf: false,
      spendingLimit: 0,
      commitmentLimit: 0,
      requiresApprovalFor: ['all'],
      allowedOverrideActions: [],
    },
    health: {
      status: 'stable',
      factors: {
        recentInteractionQuality: 50,
        insightActedUponRate: 50,
        feedbackSentiment: 0,
        responseRate: 50,
        valueDeliveryRate: 50,
      },
      concerns: [],
      opportunities: [],
      lastAssessment: new Date(),
    },
    milestones: [],
    engagement: {
      dailyActiveRate: 0,
      averageResponseTime: 0,
      peakActivityHours: [],
      preferredDays: [],
      conversationDepth: 0,
      questionAskRate: 0,
      feedbackRate: 0,
      mostUsedFeatures: [],
      underutilizedFeatures: [],
      featureAdoptionScore: 0,
    },
    lastUpdated: new Date(),
  }
}

function rowToRelationship(row: any): CompanionRelationship {
  return {
    userId: row.user_id,
    trustScore: row.trust_score,
    trustTier: row.trust_tier,
    firstInteraction: new Date(row.first_interaction),
    daysTogether: row.days_together,
    totalInteractions: row.total_interactions,
    averageSessionLength: row.average_session_length,
    totalValueDelivered: parseFloat(row.total_value_delivered) || 0,
    valueBreakdown: row.value_breakdown || {
      savings: 0,
      revenue: 0,
      timeHours: 0,
      opportunitiesFound: 0,
      risksAverted: 0,
    },
    autonomy: row.autonomy || createDefaultRelationship(row.user_id).autonomy,
    health: row.health || createDefaultRelationship(row.user_id).health,
    milestones: row.milestones || [],
    engagement: row.engagement || createDefaultRelationship(row.user_id).engagement,
    lastUpdated: new Date(row.last_updated),
  }
}

async function checkValueMilestones(
  userId: string,
  oldValue: number,
  newValue: number
): Promise<void> {
  const milestones = [100, 500, 1000, 5000, 10000, 25000, 50000, 100000]

  for (const milestone of milestones) {
    if (oldValue < milestone && newValue >= milestone) {
      await addMilestone(userId, {
        type: 'value_milestone',
        title: `$${milestone.toLocaleString()} in Value Delivered`,
        description: `Together, we've delivered over $${milestone.toLocaleString()} in value. Here's to many more wins!`,
        value: milestone,
      })
    }
  }
}

async function checkInteractionMilestones(
  userId: string,
  oldCount: number,
  newCount: number
): Promise<void> {
  const milestones = [10, 50, 100, 250, 500, 1000]

  for (const milestone of milestones) {
    if (oldCount < milestone && newCount >= milestone) {
      await addMilestone(userId, {
        type: 'interaction_milestone',
        title: `${milestone} Interactions Together`,
        description: `We've had ${milestone} conversations! I'm grateful for each one.`,
      })
    }
  }
}

function generateCelebrationMessage(type: MilestoneType, title: string): string {
  const messages: Record<MilestoneType, string[]> = {
    first_interaction: [
      "The beginning of something great!",
      "I'm honored to work with you.",
      "Here's to a successful partnership!",
    ],
    first_deal: [
      "Our first victory together!",
      "This is just the beginning.",
      "Great work - let's build on this!",
    ],
    trust_upgrade: [
      "Thank you for your trust.",
      "I'll continue to earn this.",
      "Ready for the next level!",
    ],
    value_milestone: [
      "Real value, real results.",
      "Every dollar counts.",
      "This is what partnership looks like.",
    ],
    time_milestone: [
      "Time flies when we're winning!",
      "Another milestone together.",
      "Grateful for every day.",
    ],
    interaction_milestone: [
      "So many great conversations!",
      "Thank you for including me.",
      "Each chat makes us stronger.",
    ],
    goal_achieved: [
      "You did it!",
      "Goal crushed!",
      "What's next on the list?",
    ],
    perfect_week: [
      "A perfect week!",
      "You're on fire!",
      "Flawless execution.",
    ],
    custom: [
      "Another achievement unlocked!",
      "Celebrating with you!",
      "You make it look easy.",
    ],
  }

  const typeMessages = messages[type] || messages.custom
  return typeMessages[Math.floor(Math.random() * typeMessages.length)]
}

async function calculateRecentInteractionQuality(userId: string): Promise<number> {
  try {
    const result = await query(
      `SELECT AVG(quality) as avg_quality
       FROM interaction_logs
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'`,
      [userId]
    )
    return parseFloat(result.rows[0]?.avg_quality) || 50
  } catch {
    return 50
  }
}

async function calculateInsightActedUponRate(userId: string): Promise<number> {
  try {
    const result = await query(
      `SELECT
        COUNT(*) FILTER (WHERE acted_upon = true) as acted,
        COUNT(*) as total
       FROM proactive_insights
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [userId]
    )
    const { acted, total } = result.rows[0]
    if (parseInt(total) === 0) return 50
    return (parseInt(acted) / parseInt(total)) * 100
  } catch {
    return 50
  }
}

async function calculateFeedbackSentiment(userId: string): Promise<number> {
  try {
    const result = await query(
      `SELECT AVG(sentiment_score) as avg_sentiment
       FROM user_feedback
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [userId]
    )
    return parseFloat(result.rows[0]?.avg_sentiment) || 0
  } catch {
    return 0
  }
}

async function calculateResponseRate(userId: string): Promise<number> {
  try {
    const result = await query(
      `SELECT
        COUNT(*) FILTER (WHERE read_at IS NOT NULL) as read,
        COUNT(*) as total
       FROM chat_queue
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'`,
      [userId]
    )
    const { read, total } = result.rows[0]
    if (parseInt(total) === 0) return 50
    return (parseInt(read) / parseInt(total)) * 100
  } catch {
    return 50
  }
}

async function calculateValueDeliveryRate(userId: string): Promise<number> {
  try {
    const result = await query(
      `SELECT
        COUNT(*) FILTER (WHERE potential_value > 0) as value_insights,
        COUNT(*) as total
       FROM proactive_insights
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [userId]
    )
    const { value_insights, total } = result.rows[0]
    if (parseInt(total) === 0) return 50
    return (parseInt(value_insights) / parseInt(total)) * 100
  } catch {
    return 50
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const RelationshipService = {
  getRelationship: getCompanionRelationship,
  recordInteraction,
  canActAutonomously,
  grantAutonomy,
  addMilestone,
  getUncelebratedMilestones,
  celebrateMilestone,
  assessHealth: assessRelationshipHealth,
  getContext: getRelationshipContext,
}

export default RelationshipService
