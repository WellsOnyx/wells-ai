// @ts-nocheck
/**
 * Wells Preference Learning System
 *
 * "Apply your heart to instruction and your ears to words of knowledge."
 * - Proverbs 23:12
 *
 * Wells learns from every interaction - what you like, what you don't,
 * how you make decisions, and what matters most to you.
 */

import { query, sqlQuery as sql } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'
import {
  WellsMemory,
  BehavioralPatterns,
  LearnedPreferences,
  MemoryUpdate,
} from './schema'
import { getMemory, updateMemory } from './service'

// ============================================================================
// TYPES
// ============================================================================

export interface LearningEvent {
  userId: string
  eventType: 'quote_accepted' | 'quote_rejected' | 'deal_won' | 'deal_lost' |
    'message_sent' | 'session_started' | 'feature_used' | 'preference_stated' |
    'feedback_given' | 'decision_made' | 'supplier_selected' | 'price_negotiated'
  data: Record<string, any>
  timestamp: Date
}

export interface LearningInsight {
  type: 'preference' | 'pattern' | 'behavior' | 'relationship'
  key: string
  value: any
  confidence: number  // 0-1
  source: 'observed' | 'inferred' | 'stated'
  evidence: string[]  // what led to this insight
}

export interface QuoteBehavior {
  accepted: number
  rejected: number
  averageAcceptedPrice: number
  averageRejectedPrice: number
  averageDecisionTimeMinutes: number
  preferredCategories: string[]
  preferredSuppliers: string[]
  commonRejectionReasons: string[]
}

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// EVENT PROCESSING
// ============================================================================

/**
 * Process a learning event and update memory accordingly
 */
export async function processLearningEvent(event: LearningEvent): Promise<LearningInsight[]> {
  const insights: LearningInsight[] = []

  try {
    // Store the raw event
    await storeEvent(event)

    // Process based on event type
    switch (event.eventType) {
      case 'quote_accepted':
        insights.push(...await processQuoteAccepted(event))
        break

      case 'quote_rejected':
        insights.push(...await processQuoteRejected(event))
        break

      case 'deal_won':
        insights.push(...await processDealWon(event))
        break

      case 'deal_lost':
        insights.push(...await processDealLost(event))
        break

      case 'message_sent':
        insights.push(...await processMessage(event))
        break

      case 'session_started':
        insights.push(...await processSessionStart(event))
        break

      case 'feature_used':
        insights.push(...await processFeatureUsage(event))
        break

      case 'preference_stated':
        insights.push(...await processExplicitPreference(event))
        break

      case 'feedback_given':
        insights.push(...await processFeedback(event))
        break

      case 'decision_made':
        insights.push(...await processDecision(event))
        break

      case 'supplier_selected':
        insights.push(...await processSupplierSelection(event))
        break

      case 'price_negotiated':
        insights.push(...await processPriceNegotiation(event))
        break
    }

    // Apply insights to memory
    await applyInsights(event.userId, insights)

    // Check for pattern updates
    await updatePatterns(event.userId)

    return insights
  } catch (error) {
    console.error('[Learning] Error processing event:', error)
    return []
  }
}

// ============================================================================
// EVENT PROCESSORS
// ============================================================================

/**
 * Learn from an accepted quote
 */
async function processQuoteAccepted(event: LearningEvent): Promise<LearningInsight[]> {
  const insights: LearningInsight[] = []
  const { price, category, supplier, decisionTimeMinutes, qualityScore } = event.data

  // Price sensitivity insight
  if (price) {
    const memory = await getMemory(event.userId)
    const avgPrice = memory?.recentContext.mentionedAmounts
      .filter(a => a.context.includes('quote'))
      .reduce((sum, a) => sum + a.amount, 0) / (memory?.recentContext.mentionedAmounts.length || 1)

    if (price < avgPrice * 0.9) {
      insights.push({
        type: 'preference',
        key: 'priceSensitivity',
        value: 'high',
        confidence: 0.7,
        source: 'observed',
        evidence: [`Accepted quote ${Math.round((1 - price / avgPrice) * 100)}% below average`],
      })
    }
  }

  // Category preference
  if (category) {
    insights.push({
      type: 'preference',
      key: 'preferredCategory',
      value: category,
      confidence: 0.6,
      source: 'observed',
      evidence: [`Accepted quote for ${category}`],
    })
  }

  // Supplier preference
  if (supplier) {
    insights.push({
      type: 'preference',
      key: 'preferredSupplier',
      value: supplier,
      confidence: 0.7,
      source: 'observed',
      evidence: [`Selected ${supplier} as supplier`],
    })
  }

  // Decision speed
  if (decisionTimeMinutes !== undefined) {
    let decisionStyle: LearnedPreferences['riskTolerance'] = 'moderate'
    if (decisionTimeMinutes < 10) decisionStyle = 'aggressive'
    else if (decisionTimeMinutes > 60) decisionStyle = 'conservative'

    insights.push({
      type: 'pattern',
      key: 'decisionSpeed',
      value: decisionTimeMinutes,
      confidence: 0.6,
      source: 'observed',
      evidence: [`Made decision in ${decisionTimeMinutes} minutes`],
    })
  }

  // Quality preference
  if (qualityScore && qualityScore > 4) {
    insights.push({
      type: 'preference',
      key: 'qualityPriority',
      value: 'high',
      confidence: 0.7,
      source: 'observed',
      evidence: [`Chose high-quality option (${qualityScore}/5)`],
    })
  }

  return insights
}

/**
 * Learn from a rejected quote
 */
async function processQuoteRejected(event: LearningEvent): Promise<LearningInsight[]> {
  const insights: LearningInsight[] = []
  const { price, category, supplier, reason, alternativeChosen } = event.data

  // Rejection reason analysis
  if (reason) {
    const lowerReason = reason.toLowerCase()

    if (lowerReason.includes('price') || lowerReason.includes('expensive') || lowerReason.includes('budget')) {
      insights.push({
        type: 'preference',
        key: 'priceSensitivity',
        value: 'high',
        confidence: 0.8,
        source: 'observed',
        evidence: [`Rejected quote citing: "${reason}"`],
      })
    }

    if (lowerReason.includes('quality') || lowerReason.includes('low quality')) {
      insights.push({
        type: 'preference',
        key: 'qualityPriority',
        value: 'high',
        confidence: 0.8,
        source: 'observed',
        evidence: [`Rejected quote citing: "${reason}"`],
      })
    }

    if (lowerReason.includes('slow') || lowerReason.includes('timing') || lowerReason.includes('delivery')) {
      insights.push({
        type: 'preference',
        key: 'speedPriority',
        value: 'high',
        confidence: 0.8,
        source: 'observed',
        evidence: [`Rejected quote citing: "${reason}"`],
      })
    }
  }

  // Supplier avoidance
  if (supplier && !alternativeChosen) {
    insights.push({
      type: 'preference',
      key: 'avoidSupplier',
      value: { id: supplier, reason: reason || 'Quote rejected' },
      confidence: 0.5,
      source: 'observed',
      evidence: [`Rejected quote from ${supplier}`],
    })
  }

  return insights
}

/**
 * Learn from a won deal
 */
async function processDealWon(event: LearningEvent): Promise<LearningInsight[]> {
  const insights: LearningInsight[] = []
  const { value, category, negotiationRounds, discountAchieved, supplier } = event.data

  // Successful negotiation patterns
  if (negotiationRounds !== undefined) {
    insights.push({
      type: 'pattern',
      key: 'negotiationRounds',
      value: negotiationRounds,
      confidence: 0.7,
      source: 'observed',
      evidence: [`Deal closed after ${negotiationRounds} rounds`],
    })
  }

  if (discountAchieved) {
    insights.push({
      type: 'pattern',
      key: 'typicalDiscount',
      value: discountAchieved,
      confidence: 0.7,
      source: 'observed',
      evidence: [`Achieved ${discountAchieved}% discount`],
    })
  }

  // Preferred supplier confirmation
  if (supplier) {
    insights.push({
      type: 'preference',
      key: 'preferredSupplier',
      value: supplier,
      confidence: 0.85,
      source: 'observed',
      evidence: [`Successfully closed deal with ${supplier}`],
    })
  }

  return insights
}

/**
 * Learn from a lost deal
 */
async function processDealLost(event: LearningEvent): Promise<LearningInsight[]> {
  const insights: LearningInsight[] = []
  const { reason, supplier, competitorChosen } = event.data

  if (reason) {
    const lowerReason = reason.toLowerCase()

    // Identify what went wrong
    if (lowerReason.includes('price')) {
      insights.push({
        type: 'preference',
        key: 'priceImportance',
        value: 'critical',
        confidence: 0.8,
        source: 'observed',
        evidence: [`Lost deal due to: "${reason}"`],
      })
    }

    if (lowerReason.includes('competitor') || competitorChosen) {
      insights.push({
        type: 'relationship',
        key: 'competitorPreference',
        value: competitorChosen || 'unknown',
        confidence: 0.6,
        source: 'observed',
        evidence: [`Lost deal to competitor: ${competitorChosen || 'unknown'}`],
      })
    }
  }

  return insights
}

/**
 * Learn from message content
 */
async function processMessage(event: LearningEvent): Promise<LearningInsight[]> {
  const insights: LearningInsight[] = []
  const { content, responseTime, length } = event.data

  // Response time patterns
  if (responseTime !== undefined) {
    insights.push({
      type: 'pattern',
      key: 'averageResponseTime',
      value: responseTime,
      confidence: 0.5,
      source: 'observed',
      evidence: [`Responded in ${responseTime} seconds`],
    })
  }

  // Message length preference
  if (length) {
    let messageLength: BehavioralPatterns['messageLength'] = 'moderate'
    if (length < 50) messageLength = 'brief'
    else if (length > 200) messageLength = 'detailed'

    insights.push({
      type: 'pattern',
      key: 'messageLength',
      value: messageLength,
      confidence: 0.4,
      source: 'observed',
      evidence: [`Message length: ${length} characters`],
    })
  }

  // Check for emoji usage
  const hasEmoji = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]/u.test(content || '')
  if (hasEmoji) {
    insights.push({
      type: 'pattern',
      key: 'usesEmoji',
      value: true,
      confidence: 0.6,
      source: 'observed',
      evidence: ['Used emoji in message'],
    })
  }

  return insights
}

/**
 * Learn from session timing
 */
async function processSessionStart(event: LearningEvent): Promise<LearningInsight[]> {
  const insights: LearningInsight[] = []
  const { hour, dayOfWeek, timezone } = event.data

  insights.push({
    type: 'pattern',
    key: 'activeHour',
    value: hour,
    confidence: 0.3,
    source: 'observed',
    evidence: [`Session started at ${hour}:00`],
  })

  if (dayOfWeek) {
    insights.push({
      type: 'pattern',
      key: 'activeDay',
      value: dayOfWeek,
      confidence: 0.3,
      source: 'observed',
      evidence: [`Active on ${dayOfWeek}`],
    })
  }

  return insights
}

/**
 * Learn from feature usage
 */
async function processFeatureUsage(event: LearningEvent): Promise<LearningInsight[]> {
  const insights: LearningInsight[] = []
  const { feature, duration, completed } = event.data

  if (feature) {
    insights.push({
      type: 'behavior',
      key: 'frequentFeature',
      value: feature,
      confidence: 0.5,
      source: 'observed',
      evidence: [`Used ${feature} feature`],
    })
  }

  return insights
}

/**
 * Learn from explicit preference statements
 */
async function processExplicitPreference(event: LearningEvent): Promise<LearningInsight[]> {
  const insights: LearningInsight[] = []
  const { preference, value, context } = event.data

  // Explicit statements have high confidence
  insights.push({
    type: 'preference',
    key: preference,
    value: value,
    confidence: 0.95,
    source: 'stated',
    evidence: [context || `User explicitly stated: ${preference} = ${value}`],
  })

  return insights
}

/**
 * Learn from user feedback
 */
async function processFeedback(event: LearningEvent): Promise<LearningInsight[]> {
  const insights: LearningInsight[] = []
  const { rating, category, comment } = event.data

  if (rating !== undefined) {
    if (rating >= 4) {
      insights.push({
        type: 'preference',
        key: `likes_${category}`,
        value: true,
        confidence: 0.8,
        source: 'stated',
        evidence: [`Rated ${category} ${rating}/5: "${comment || 'No comment'}"`],
      })
    } else if (rating <= 2) {
      insights.push({
        type: 'preference',
        key: `dislikes_${category}`,
        value: true,
        confidence: 0.8,
        source: 'stated',
        evidence: [`Rated ${category} ${rating}/5: "${comment || 'No comment'}"`],
      })
    }
  }

  return insights
}

/**
 * Learn from decision patterns
 */
async function processDecision(event: LearningEvent): Promise<LearningInsight[]> {
  const insights: LearningInsight[] = []
  const { decisionType, timeToDecide, factors, outcome } = event.data

  if (timeToDecide !== undefined) {
    let style: BehavioralPatterns['decisionStyle'] = 'deliberate'
    if (timeToDecide < 5) style = 'quick'
    else if (timeToDecide > 60) style = 'consensus'

    insights.push({
      type: 'pattern',
      key: 'decisionStyle',
      value: style,
      confidence: 0.6,
      source: 'observed',
      evidence: [`Made ${decisionType} decision in ${timeToDecide} minutes`],
    })
  }

  if (factors && Array.isArray(factors)) {
    for (const factor of factors) {
      insights.push({
        type: 'preference',
        key: `decisionFactor`,
        value: factor,
        confidence: 0.7,
        source: 'inferred',
        evidence: [`${factor} was a factor in ${decisionType} decision`],
      })
    }
  }

  return insights
}

/**
 * Learn from supplier selection
 */
async function processSupplierSelection(event: LearningEvent): Promise<LearningInsight[]> {
  const insights: LearningInsight[] = []
  const { supplierId, supplierName, category, reasonsForSelection } = event.data

  insights.push({
    type: 'preference',
    key: 'preferredSupplier',
    value: {
      id: supplierId,
      name: supplierName,
      category,
      reasons: reasonsForSelection,
    },
    confidence: 0.8,
    source: 'observed',
    evidence: [`Selected ${supplierName} for ${category}`],
  })

  return insights
}

/**
 * Learn from price negotiation
 */
async function processPriceNegotiation(event: LearningEvent): Promise<LearningInsight[]> {
  const insights: LearningInsight[] = []
  const { originalPrice, finalPrice, rounds, tactics } = event.data

  if (originalPrice && finalPrice) {
    const discount = ((originalPrice - finalPrice) / originalPrice) * 100

    insights.push({
      type: 'pattern',
      key: 'negotiationSuccess',
      value: discount,
      confidence: 0.8,
      source: 'observed',
      evidence: [`Negotiated ${discount.toFixed(1)}% off original price`],
    })

    if (discount > 15) {
      insights.push({
        type: 'pattern',
        key: 'negotiationStyle',
        value: 'aggressive',
        confidence: 0.7,
        source: 'inferred',
        evidence: [`Achieved ${discount.toFixed(1)}% discount`],
      })
    }
  }

  if (tactics && Array.isArray(tactics)) {
    for (const tactic of tactics) {
      insights.push({
        type: 'behavior',
        key: 'negotiationTactic',
        value: tactic,
        confidence: 0.6,
        source: 'observed',
        evidence: [`Used ${tactic} tactic in negotiation`],
      })
    }
  }

  return insights
}

// ============================================================================
// INSIGHT APPLICATION
// ============================================================================

/**
 * Apply insights to user memory
 */
async function applyInsights(userId: string, insights: LearningInsight[]): Promise<void> {
  if (insights.length === 0) return

  try {
    const memory = await getMemory(userId)
    if (!memory) return

    const updates: Parameters<typeof updateMemory>[1] = {}

    for (const insight of insights) {
      // Only apply high-confidence insights
      if (insight.confidence < 0.5) continue

      switch (insight.type) {
        case 'preference':
          if (!updates.learnedPreferences) updates.learnedPreferences = {}
          updates.learnedPreferences[insight.key as keyof LearnedPreferences] = insight.value
          break

        case 'pattern':
          if (!updates.patterns) updates.patterns = {}
          updates.patterns[insight.key as keyof BehavioralPatterns] = insight.value
          break

        case 'behavior':
          if (!updates.patterns) updates.patterns = {}
          // Add to frequent features if it's a feature insight
          if (insight.key === 'frequentFeature') {
            const current = memory.patterns.frequentlyUsedFeatures || []
            if (!current.includes(insight.value)) {
              updates.patterns.frequentlyUsedFeatures = [...current, insight.value].slice(-10)
            }
          }
          break
      }

      // Store insight in database
      await sql`
        INSERT INTO memory_insights (user_id, insight_type, insight_key, insight_value, confidence, source, evidence, created_at)
        VALUES (${userId}, ${insight.type}, ${insight.key}, ${JSON.stringify(insight.value)}, ${insight.confidence}, ${insight.source}, ${insight.evidence}, NOW())
      `
    }

    if (Object.keys(updates).length > 0) {
      await updateMemory(userId, updates)
    }
  } catch (error) {
    console.error('[Learning] Error applying insights:', error)
  }
}

/**
 * Update behavioral patterns based on accumulated data
 */
async function updatePatterns(userId: string): Promise<void> {
  try {
    // Get recent events for pattern analysis
    const result = await sql`
      SELECT event_type, event_data, created_at
      FROM learning_events
      WHERE user_id = ${userId}
        AND created_at > NOW() - INTERVAL '30 days'
      ORDER BY created_at DESC
      LIMIT 100
    `

    if (result.rows.length < 5) return  // Need enough data

    // Analyze session timing patterns
    const sessionEvents = result.rows.filter((r: any) => r.event_type === 'session_started')
    if (sessionEvents.length >= 3) {
      const hours = sessionEvents.map((e: any) => e.event_data?.hour).filter(Boolean)
      const avgHour = Math.round(hours.reduce((a: number, b: number) => a + b, 0) / hours.length)

      const days = sessionEvents.map((e: any) => e.event_data?.dayOfWeek).filter(Boolean)
      const dayCounts = days.reduce((acc: Record<string, number>, day: string) => {
        acc[day] = (acc[day] || 0) + 1
        return acc
      }, {})

      const activeDays = Object.entries(dayCounts)
        .filter(([_, count]) => (count as number) >= 2)
        .map(([day]) => day)

      await updateMemory(userId, {
        patterns: {
          activeHours: {
            start: Math.max(0, avgHour - 2),
            end: Math.min(23, avgHour + 8),
            timezone: sessionEvents[0]?.event_data?.timezone || 'America/New_York',
          },
          activeDays: activeDays as any[],
        },
      })
    }

    // Analyze decision speed
    const decisions = result.rows.filter((r: any) =>
      ['quote_accepted', 'quote_rejected', 'decision_made'].includes(r.event_type)
    )
    if (decisions.length >= 3) {
      const times = decisions
        .map((e: any) => e.event_data?.decisionTimeMinutes)
        .filter(Boolean)

      if (times.length > 0) {
        const avgTime = times.reduce((a: number, b: number) => a + b, 0) / times.length

        let decisionStyle: BehavioralPatterns['decisionStyle'] = 'deliberate'
        if (avgTime < 10) decisionStyle = 'quick'
        else if (avgTime > 120) decisionStyle = 'consensus'
        else if (avgTime > 60) decisionStyle = 'data-driven'

        await updateMemory(userId, {
          patterns: {
            decisionStyle,
            averageDecisionTimeHours: avgTime / 60,
          },
        })
      }
    }
  } catch (error) {
    console.error('[Learning] Error updating patterns:', error)
  }
}

// ============================================================================
// STORAGE
// ============================================================================

/**
 * Store a learning event for later analysis
 */
async function storeEvent(event: LearningEvent): Promise<void> {
  try {
    await sql`
      INSERT INTO learning_events (user_id, event_type, event_data, created_at)
      VALUES (${event.userId}, ${event.eventType}, ${JSON.stringify(event.data)}, ${event.timestamp})
    `
  } catch (error) {
    console.error('[Learning] Error storing event:', error)
  }
}

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * Get quote behavior analytics for a user
 */
export async function getQuoteBehavior(userId: string): Promise<QuoteBehavior> {
  try {
    const result = await sql`
      SELECT
        event_type,
        event_data,
        created_at
      FROM learning_events
      WHERE user_id = ${userId}
        AND event_type IN ('quote_accepted', 'quote_rejected')
      ORDER BY created_at DESC
    `

    const accepted = result.rows.filter((r: any) => r.event_type === 'quote_accepted')
    const rejected = result.rows.filter((r: any) => r.event_type === 'quote_rejected')

    const acceptedPrices = accepted.map((r: any) => r.event_data?.price).filter(Boolean)
    const rejectedPrices = rejected.map((r: any) => r.event_data?.price).filter(Boolean)

    const decisionTimes = [...accepted, ...rejected]
      .map((r: any) => r.event_data?.decisionTimeMinutes)
      .filter(Boolean)

    const categories = accepted.map((r: any) => r.event_data?.category).filter(Boolean)
    const suppliers = accepted.map((r: any) => r.event_data?.supplier).filter(Boolean)
    const reasons = rejected.map((r: any) => r.event_data?.reason).filter(Boolean)

    return {
      accepted: accepted.length,
      rejected: rejected.length,
      averageAcceptedPrice: acceptedPrices.length > 0
        ? acceptedPrices.reduce((a: number, b: number) => a + b, 0) / acceptedPrices.length
        : 0,
      averageRejectedPrice: rejectedPrices.length > 0
        ? rejectedPrices.reduce((a: number, b: number) => a + b, 0) / rejectedPrices.length
        : 0,
      averageDecisionTimeMinutes: decisionTimes.length > 0
        ? decisionTimes.reduce((a: number, b: number) => a + b, 0) / decisionTimes.length
        : 0,
      preferredCategories: [...new Set(categories)].slice(0, 5) as string[],
      preferredSuppliers: [...new Set(suppliers)].slice(0, 5) as string[],
      commonRejectionReasons: [...new Set(reasons)].slice(0, 5) as string[],
    }
  } catch (error) {
    console.error('[Learning] Error getting quote behavior:', error)
    return {
      accepted: 0,
      rejected: 0,
      averageAcceptedPrice: 0,
      averageRejectedPrice: 0,
      averageDecisionTimeMinutes: 0,
      preferredCategories: [],
      preferredSuppliers: [],
      commonRejectionReasons: [],
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const LearningService = {
  processLearningEvent,
  getQuoteBehavior,
}

export default LearningService
